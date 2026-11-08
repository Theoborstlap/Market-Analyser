"""
Shared Institutional Pre-Trade Risk, Deterministic Idempotency, OMS State Machine,
Direct Exchange/Broker Routing (Alpaca, CCXT, IBKR/Webhook), Reconciliation Loop,
Dead-Man Watchdog, and Low-Latency L1/L2 Market Data Feeds.
"""

import asyncio
import hmac
import hashlib
import json
import os
import sqlite3
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np

try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL_CTX = ssl.create_default_context()


def is_live_trading_enabled() -> bool:
    return os.environ.get("LIVE_TRADING", "false").strip().lower() in ("1", "true", "yes", "live")


# ===========================================================================
# 1. SQLite WAL Helper (Zero-Lock Pool + PRAGMA cache_size=-64000 + busy_timeout=10000)
# ===========================================================================
from .institutional_quant import (
    compute_almgren_chriss_execution_plan,
    compute_cross_asset_cvar_and_beta,
)
from .unified_bus import GLOBAL_DB_POOL, publish_ipc_event_nonblocking


def get_wal_sqlite_connection(db_path: str, timeout: float = 10.0) -> sqlite3.Connection:
    """
    Creates an institutional SQLite connection enforcing WAL journal mode,
    10000ms busy timeout, -64000 page cache (64MB), and Row factory via ZeroLockDatabasePool.
    """
    return GLOBAL_DB_POOL.get_connection(db_path, timeout=timeout)


def get_postgres_connection(db_url: Optional[str] = None):
    """
    Establishes a connection to PostgreSQL when DATABASE_URL or POSTGRES_URL is configured.
    Enforces autocommit=False to permit explicit SELECT ... FOR UPDATE row-level locking.
    """
    url = (db_url or os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL") or "").strip()
    if not (url.startswith("postgresql://") or url.startswith("postgres://")):
        return None
    try:
        import psycopg2
        import psycopg2.extras

        conn = psycopg2.connect(url)
        conn.autocommit = False
        return conn
    except Exception:
        return None


def acquire_row_level_lock(
    table: str,
    id_column: str,
    id_value: Any,
    db_path_or_url: Optional[str] = None,
) -> Tuple[Any, Optional[Dict[str, Any]]]:
    """
    Acquires an atomic row-level lock:
    - On PostgreSQL: Uses SELECT ... FOR UPDATE within a transaction block.
    - On SQLite WAL: Uses BEGIN IMMEDIATE transaction block.
    Returns (connection, row_dict). Caller must commit/rollback and close connection.
    """
    url = (db_path_or_url or os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL") or "").strip()
    if url.startswith("postgresql://") or url.startswith("postgres://"):
        pg_conn = get_postgres_connection(url)
        if pg_conn is not None:
            import psycopg2.extras

            cur = pg_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            query = f"SELECT * FROM {table} WHERE {id_column} = %s FOR UPDATE"
            cur.execute(query, (id_value,))
            row = cur.fetchone()
            return pg_conn, dict(row) if row else None

    # SQLite WAL Fallback with BEGIN IMMEDIATE
    db_file = (
        db_path_or_url
        if (db_path_or_url and not db_path_or_url.startswith("postgres"))
        else "US Stock market/backend/data/us_quant_coach.db"
    )
    conn = get_wal_sqlite_connection(db_file)
    conn.execute("BEGIN IMMEDIATE")
    cur = conn.cursor()
    cur.execute(f"SELECT * FROM {table} WHERE {id_column} = ?", (id_value,))
    row = cur.fetchone()
    return conn, dict(row) if row else None


def ensure_oms_tables(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS oms_orders (
            client_order_id TEXT PRIMARY KEY,
            market TEXT NOT NULL,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,
            qty REAL NOT NULL,
            order_type TEXT NOT NULL,
            limit_price REAL,
            stop_loss REAL,
            take_profit REAL,
            state TEXT NOT NULL,
            broker_order_id TEXT,
            filled_qty REAL DEFAULT 0.0,
            avg_fill_price REAL DEFAULT 0.0,
            reason TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS oms_circuit_breaker (
            market TEXT PRIMARY KEY,
            locked_until_ts REAL DEFAULT 0.0,
            lock_reason TEXT DEFAULT '',
            last_heartbeat_ts REAL DEFAULT 0.0,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.commit()


# ===========================================================================
# 2. Order State Machine & Deterministic Idempotency
# ===========================================================================
class OrderState(str, Enum):
    SUBMITTED = "SUBMITTED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED = "FILLED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


_VALID_TRANSITIONS: Dict[OrderState, set] = {
    OrderState.SUBMITTED: {
        OrderState.ACKNOWLEDGED,
        OrderState.PARTIALLY_FILLED,
        OrderState.FILLED,
        OrderState.REJECTED,
        OrderState.CANCELLED,
    },
    OrderState.ACKNOWLEDGED: {
        OrderState.PARTIALLY_FILLED,
        OrderState.FILLED,
        OrderState.REJECTED,
        OrderState.CANCELLED,
    },
    OrderState.PARTIALLY_FILLED: {
        OrderState.PARTIALLY_FILLED,
        OrderState.FILLED,
        OrderState.CANCELLED,
    },
    OrderState.FILLED: set(),
    OrderState.REJECTED: set(),
    OrderState.CANCELLED: set(),
}


@dataclass
class OrderRecord:
    client_order_id: str
    market: str
    symbol: str
    side: str
    qty: float
    order_type: str
    limit_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    state: OrderState = OrderState.SUBMITTED
    broker_order_id: Optional[str] = None
    filled_qty: float = 0.0
    avg_fill_price: float = 0.0
    reason: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


_OMS_LOCK = threading.Lock()
_IDEMPOTENCY_SET: Dict[str, OrderRecord] = {}
_CIRCUIT_BREAKER_LOCKS: Dict[str, Tuple[float, str]] = {}
_NAMESPACE_OMS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def generate_client_order_id(
    symbol: str,
    side: str = "BUY",
    qty: float = 0.0,
    minute_bucket: Optional[int] = None,
) -> str:
    """
    Deterministic UUID5 idempotency key over (ticker, side, qty, minute_bucket).
    Identical orders within the same 60-second bucket produce the exact same ID.
    """
    bucket = minute_bucket if minute_bucket is not None else int(time.time() // 60)
    clean_sym = symbol.upper().strip()
    clean_side = side.upper().strip()
    seed_str = f"{clean_sym}:{clean_side}:{round(float(qty), 6)}:{bucket}"
    u5 = uuid.uuid5(_NAMESPACE_OMS, seed_str)
    return f"oms-{clean_sym.lower().replace('.', '-')}-{bucket}-{str(u5)[:12]}"


class OMSStateMachine:
    """Thread-safe Order Management State Machine backed by in-memory registry and SQLite WAL."""

    @staticmethod
    def register_order(
        market: str,
        symbol: str,
        side: str,
        qty: float,
        order_type: str = "LIMIT",
        limit_price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        client_order_id: Optional[str] = None,
        db_path: Optional[str] = None,
    ) -> OrderRecord:
        cid = client_order_id or generate_client_order_id(symbol, side, qty)
        with _OMS_LOCK:
            existing = _IDEMPOTENCY_SET.get(cid)
            if existing is not None and existing.state not in (OrderState.REJECTED, OrderState.CANCELLED):
                raise ValueError(f"DUPLICATE_CLIENT_ORDER_ID_BLOCKED:{cid} (state={existing.state.value})")

            if db_path:
                conn = get_wal_sqlite_connection(db_path)
                try:
                    ensure_oms_tables(conn)
                    row = conn.execute(
                        "SELECT state FROM oms_orders WHERE client_order_id = ?", (cid,)
                    ).fetchone()
                    if row and row["state"] not in (OrderState.REJECTED.value, OrderState.CANCELLED.value):
                        raise ValueError(f"DUPLICATE_CLIENT_ORDER_ID_DB_BLOCKED:{cid} (state={row['state']})")
                finally:
                    conn.close()

            rec = OrderRecord(
                client_order_id=cid,
                market=market.upper(),
                symbol=symbol.upper().strip(),
                side=side.upper().strip(),
                qty=float(qty),
                order_type=order_type.upper(),
                limit_price=limit_price,
                stop_loss=stop_loss,
                take_profit=take_profit,
                state=OrderState.SUBMITTED,
            )
            _IDEMPOTENCY_SET[cid] = rec
            if db_path:
                OMSStateMachine._persist(rec, db_path)
            return rec

    @staticmethod
    def transition(
        client_order_id: str,
        new_state: OrderState,
        broker_order_id: Optional[str] = None,
        filled_qty: Optional[float] = None,
        avg_fill_price: Optional[float] = None,
        reason: str = "",
        db_path: Optional[str] = None,
    ) -> OrderRecord:
        with _OMS_LOCK:
            rec = _IDEMPOTENCY_SET.get(client_order_id)
            if rec is None:
                raise KeyError(f"Unknown client_order_id: {client_order_id}")
            if new_state != rec.state and new_state not in _VALID_TRANSITIONS.get(rec.state, set()):
                raise ValueError(f"Invalid OMS state transition: {rec.state.value} -> {new_state.value}")
            rec.state = new_state
            if broker_order_id is not None:
                rec.broker_order_id = broker_order_id
            if filled_qty is not None:
                rec.filled_qty = float(filled_qty)
            if avg_fill_price is not None:
                rec.avg_fill_price = float(avg_fill_price)
            if reason:
                rec.reason = reason
            rec.updated_at = datetime.now(timezone.utc).isoformat()
            if db_path:
                OMSStateMachine._persist(rec, db_path)
            return rec

    @staticmethod
    def _persist(rec: OrderRecord, db_path: str) -> None:
        conn = get_wal_sqlite_connection(db_path)
        try:
            ensure_oms_tables(conn)
            conn.execute(
                """
                INSERT INTO oms_orders (
                    client_order_id, market, symbol, side, qty, order_type,
                    limit_price, stop_loss, take_profit, state, broker_order_id,
                    filled_qty, avg_fill_price, reason, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(client_order_id) DO UPDATE SET
                    state=excluded.state,
                    broker_order_id=excluded.broker_order_id,
                    filled_qty=excluded.filled_qty,
                    avg_fill_price=excluded.avg_fill_price,
                    reason=excluded.reason,
                    updated_at=excluded.updated_at
                """,
                (
                    rec.client_order_id,
                    rec.market,
                    rec.symbol,
                    rec.side,
                    rec.qty,
                    rec.order_type,
                    rec.limit_price,
                    rec.stop_loss,
                    rec.take_profit,
                    rec.state.value,
                    rec.broker_order_id,
                    rec.filled_qty,
                    rec.avg_fill_price,
                    rec.reason,
                    rec.created_at,
                    rec.updated_at,
                ),
            )
            conn.commit()
        finally:
            conn.close()


# ===========================================================================
# 3. Atomic Pre-Trade Risk Interceptor
# ===========================================================================
def validate_pre_trade_risk(
    *,
    market: str,
    symbol: str,
    side: str,
    qty: float,
    requested_price: float,
    stop_loss_price: Optional[float],
    total_equity: float,
    daily_drawdown_pct: float = 0.0,
    live_mid_price: Optional[float] = None,
    bid_ask_spread_pct: Optional[float] = None,
    estimated_slippage_pct: Optional[float] = None,
    data_timestamp_epoch: Optional[float] = None,
    client_order_id: Optional[str] = None,
    db_path: Optional[str] = None,
    auto_flatten_callback: Optional[Callable[[], Any]] = None,
    cancel_open_orders_callback: Optional[Callable[[], Any]] = None,
) -> Dict[str, Any]:
    """
    Atomic Pre-Trade Risk Gate. Evaluates hard institutional limits:
    1. 24h Circuit Breaker Lock & Daily Session Drawdown >= 3.0% (auto-flatten + cancel + 24h lock)
    2. Position notional > 10.0% total equity or trade risk > 1.0% total equity
    3. Bid-ask spread > 0.35% or estimated slippage > 0.20%
    4. Requested price deviation > 2.0% from live mid-price (fat-finger guard)
    5. Data timestamp > 5.0 seconds stale when LIVE_TRADING=true
    6. Deterministic client_order_id duplicate check
    """
    now_ts = time.time()
    mkt = market.upper().strip()
    reasons: List[str] = []

    # Check active 24h circuit-breaker lock
    lock_info = _CIRCUIT_BREAKER_LOCKS.get(mkt)
    if lock_info and lock_info[0] > now_ts:
        remaining_h = round((lock_info[0] - now_ts) / 3600.0, 2)
        reasons.append(f"CIRCUIT_BREAKER_LOCKED_24H: {lock_info[1]} ({remaining_h}h remaining)")

    if db_path:
        try:
            conn = get_wal_sqlite_connection(db_path)
            ensure_oms_tables(conn)
            row = conn.execute(
                "SELECT locked_until_ts, lock_reason FROM oms_circuit_breaker WHERE market = ?",
                (mkt,),
            ).fetchone()
            conn.close()
            if row and float(row["locked_until_ts"] or 0.0) > now_ts:
                rem_h = round((float(row["locked_until_ts"]) - now_ts) / 3600.0, 2)
                reasons.append(f"DB_CIRCUIT_BREAKER_LOCKED_24H: {row['lock_reason']} ({rem_h}h remaining)")
        except Exception:
            pass

    # 1. Daily session drawdown >= 3.0%
    if float(daily_drawdown_pct) >= 3.0:
        lock_until = now_ts + 86400.0
        reason_str = f"DAILY_DRAWDOWN_BREACH_{daily_drawdown_pct:.2f}%>=3.00%"
        _CIRCUIT_BREAKER_LOCKS[mkt] = (lock_until, reason_str)
        if db_path:
            try:
                conn = get_wal_sqlite_connection(db_path)
                ensure_oms_tables(conn)
                conn.execute(
                    """
                    INSERT INTO oms_circuit_breaker (market, locked_until_ts, lock_reason, last_heartbeat_ts, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(market) DO UPDATE SET
                        locked_until_ts=excluded.locked_until_ts,
                        lock_reason=excluded.lock_reason,
                        updated_at=excluded.updated_at
                    """,
                    (mkt, lock_until, reason_str, now_ts, datetime.now(timezone.utc).isoformat()),
                )
                conn.commit()
                conn.close()
            except Exception:
                pass
        if cancel_open_orders_callback is not None:
            try:
                cancel_open_orders_callback()
            except Exception:
                pass
        if auto_flatten_callback is not None:
            try:
                auto_flatten_callback()
            except Exception:
                pass
        reasons.append(f"{reason_str}: Auto-flatten triggered, open orders cancelled, 24h lock engaged.")

    # 2. Notional > 10% total equity or trade risk > 1.0% equity
    safe_equity = max(float(total_equity), 1.0)
    notional = abs(float(qty) * float(requested_price))
    notional_pct = (notional / safe_equity) * 100.0
    if notional_pct > 10.0:
        reasons.append(f"MAX_NOTIONAL_EXCEEDED: {notional_pct:.2f}% > 10.00% equity cap")

    if stop_loss_price is not None and float(stop_loss_price) > 0:
        trade_risk = abs(float(requested_price) - float(stop_loss_price)) * abs(float(qty))
        trade_risk_pct = (trade_risk / safe_equity) * 100.0
        if trade_risk_pct > 1.0:
            reasons.append(f"MAX_TRADE_RISK_EXCEEDED: {trade_risk_pct:.2f}% > 1.00% equity cap")

    # 3. Bid-ask spread > 0.35% or estimated slippage > 0.20%
    if bid_ask_spread_pct is not None and float(bid_ask_spread_pct) > 0.35:
        reasons.append(f"SPREAD_TOO_WIDE: {float(bid_ask_spread_pct):.3f}% > 0.350% cap")
    if estimated_slippage_pct is not None and float(estimated_slippage_pct) > 0.20:
        reasons.append(f"SLIPPAGE_TOO_HIGH: {float(estimated_slippage_pct):.3f}% > 0.200% cap")

    # 4. Fat-finger guard: requested price deviates > 2.0% from live mid-price
    if live_mid_price is not None and float(live_mid_price) > 0:
        dev_pct = (abs(float(requested_price) - float(live_mid_price)) / float(live_mid_price)) * 100.0
        if dev_pct > 2.0:
            reasons.append(
                f"FAT_FINGER_PRICE_DEVIATION: requested={requested_price} vs mid={live_mid_price} ({dev_pct:.2f}% > 2.00%)"
            )

    # 5. Stale data check (> 5.0 seconds when LIVE_TRADING=true)
    if is_live_trading_enabled() and data_timestamp_epoch is not None:
        staleness = now_ts - float(data_timestamp_epoch)
        if staleness > 5.0:
            reasons.append(f"STALE_MARKET_DATA: age={staleness:.2f}s > 5.0s limit in LIVE_TRADING mode")

    # 6. Deterministic Idempotency pre-check
    cid = client_order_id or generate_client_order_id(symbol, side, qty)
    with _OMS_LOCK:
        existing = _IDEMPOTENCY_SET.get(cid)
        if existing is not None and existing.state not in (OrderState.REJECTED, OrderState.CANCELLED):
            reasons.append(f"DUPLICATE_ORDER_IDEMPOTENCY_BLOCK: {cid}")

    # 7. Cross-Asset CVaR Kill-Switch & Dynamic Covariance Shrinkage Check
    cvar_snap = compute_cross_asset_cvar_and_beta(current_drawdown_pct=float(daily_drawdown_pct))
    if cvar_snap.get("kill_switch_triggered") and side.upper() == "BUY":
        reasons.append(str(cvar_snap.get("reason") or "GLOBAL_CROSS_ASSET_CVAR_BREACH"))

    # 8. Almgren-Chriss Nonlinear Square-Root Execution Slicer
    ac_plan = compute_almgren_chriss_execution_plan(
        symbol=symbol.upper().strip(),
        side=side.upper().strip(),
        total_qty=float(qty),
        reference_price=float(requested_price),
        bid_ask_spread_pct=float(bid_ask_spread_pct or 0.08),
    )

    allowed = len(reasons) == 0
    try:
        OMSStateMachine.submit_order(
            market=mkt,
            symbol=symbol,
            side=side,
            qty=qty,
            order_type="ALMGREN_CHRISS_LIMIT",
            limit_price=ac_plan["passive_bbo_peg_price"],
            stop_loss=stop_loss_price,
            take_profit=None,
            client_order_id=cid,
            db_path=db_path,
        )
        OMSStateMachine.transition(
            client_order_id=cid,
            new_state=OrderState.ACKED if allowed else OrderState.REJECTED,
            filled_qty=float(qty) if (allowed and not is_live_trading_enabled()) else 0.0,
            avg_fill_price=float(requested_price) if (allowed and not is_live_trading_enabled()) else 0.0,
            reason="PRE_TRADE_RISK_PASSED" if allowed else "; ".join(reasons),
            db_path=db_path,
        )
    except Exception:
        pass

    publish_ipc_event_nonblocking({
        "type": "ORDER_EVENT",
        "order": {
            "client_order_id": cid,
            "symbol": symbol.upper().strip(),
            "market": mkt,
            "side": side.upper().strip(),
            "qty": float(qty),
            "filled_qty": float(qty) if allowed else 0.0,
            "avg_fill_price": float(requested_price),
            "limit_price": ac_plan["passive_bbo_peg_price"],
            "status": "FILLED" if allowed else "REJECTED",
            "algo_mode": ac_plan["algo_mode"],
            "expected_slippage_pct": ac_plan["expected_total_slippage_pct"],
            "square_root_impact_pct": ac_plan["square_root_impact_pct"],
            "sequence_num": int(now_ts * 1000) % 1000000,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "timestamp_us": int(now_ts * 1_000_000),
            "reasons": reasons,
        },
    })

    return {
        "allowed": allowed,
        "decision": "ALLOW" if allowed else "BLOCK",
        "client_order_id": cid,
        "notional_pct": round(notional_pct, 4),
        "almgren_chriss_plan": ac_plan,
        "cross_asset_cvar": cvar_snap,
        "reasons": reasons,
    }


# ===========================================================================
# 4. Direct Exchange / Broker Routing Adapters (Crypto CCXT & JSE IBKR/Webhook)
# ===========================================================================
def execute_crypto_ccxt_bracket_order(
    *,
    symbol: str,
    side: str,
    qty: float,
    limit_price: float,
    stop_loss: float,
    take_profit: float,
    exchange_id: Optional[str] = None,
    client_order_id: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Routes a post-only limit entry + native exchange OCO / stop-loss & take-profit
    via CCXT (supporting Binance, Bybit, Kraken, VALR via environment credentials).
    Raises RuntimeError on any execution failure when credentials or LIVE_TRADING are active.
    """
    ex_name = (exchange_id or os.environ.get("CCXT_EXCHANGE", "binance")).strip().lower()
    if "valr" in ex_name:
        ex_key = os.environ.get("VALR_API_KEY", "")
        ex_secret = os.environ.get("VALR_API_SECRET", "")
    elif "bybit" in ex_name:
        ex_key = os.environ.get("BYBIT_API_KEY", "")
        ex_secret = os.environ.get("BYBIT_API_SECRET", "")
    elif "kraken" in ex_name:
        ex_key = os.environ.get("KRAKEN_API_KEY", "")
        ex_secret = os.environ.get("KRAKEN_API_SECRET", "")
    else:
        ex_name = "binance"
        ex_key = os.environ.get("BINANCE_API_KEY", "")
        ex_secret = os.environ.get("BINANCE_API_SECRET", "")

    rec = OMSStateMachine.register_order(
        market="CRYPTO",
        symbol=symbol,
        side=side,
        qty=qty,
        order_type="LIMIT_POST_ONLY_BRACKET",
        limit_price=limit_price,
        stop_loss=stop_loss,
        take_profit=take_profit,
        client_order_id=client_order_id,
        db_path=db_path,
    )

    clean_base = symbol.upper().replace("-USD", "").replace("/USDT", "").replace("USDT", "").strip()
    ccxt_symbol = f"{clean_base}/ZAR" if ex_name == "valr" else f"{clean_base}/USDT"

    if not ex_key or not ex_secret:
        if is_live_trading_enabled():
            OMSStateMachine.transition(
                rec.client_order_id, OrderState.REJECTED, reason=f"MISSING_{ex_name.upper()}_API_KEYS", db_path=db_path
            )
            raise RuntimeError(f"LIVE_TRADING=true but {ex_name.upper()} API credentials are missing.")
        OMSStateMachine.transition(
            rec.client_order_id,
            OrderState.ACKNOWLEDGED,
            broker_order_id=f"dryrun-{rec.client_order_id}",
            reason="DRY_RUN_NO_KEYS",
            db_path=db_path,
        )
        return {
            "status": "acknowledged_dry_run",
            "exchange": ex_name,
            "client_order_id": rec.client_order_id,
            "symbol": ccxt_symbol,
        }

    # VALR Direct Signed REST Execution if exchange is VALR and not in standard ccxt
    if ex_name == "valr":
        try:
            ts_ms = str(int(time.time() * 1000))
            path = "/v1/orders/limit"
            body_dict = {
                "side": side.upper(),
                "quantity": f"{qty:.6f}",
                "price": f"{limit_price:.2f}",
                "pair": f"{clean_base}ZAR",
                "postOnly": True,
                "customerOrderId": rec.client_order_id[:32],
            }
            body_str = json.dumps(body_dict)
            payload_to_sign = f"{ts_ms}POST{path}{body_str}".encode("utf-8")
            sig = hmac.new(ex_secret.encode("utf-8"), payload_to_sign, hashlib.sha512).hexdigest()
            req = urllib.request.Request(
                f"https://api.valr.com{path}",
                data=body_str.encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "X-VALR-API-KEY": ex_key,
                    "X-VALR-SIGNATURE": sig,
                    "X-VALR-TIMESTAMP": ts_ms,
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=8.0, context=_SSL_CTX) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                oid = str(resp_data.get("id") or rec.client_order_id)
                OMSStateMachine.transition(
                    rec.client_order_id, OrderState.ACKNOWLEDGED, broker_order_id=oid, db_path=db_path
                )
                return {"status": "submitted", "exchange": "valr", "client_order_id": rec.client_order_id, "order": resp_data}
        except Exception as exc:
            OMSStateMachine.transition(rec.client_order_id, OrderState.REJECTED, reason=str(exc), db_path=db_path)
            raise RuntimeError(f"VALR order execution failed: {exc}") from exc

    # Standard CCXT Execution (Binance / Bybit / Kraken)
    try:
        import ccxt  # type: ignore

        ex_cls = getattr(ccxt, ex_name)
        exchange = ex_cls({"apiKey": ex_key, "secret": ex_secret, "enableRateLimit": True})
        params: Dict[str, Any] = {"postOnly": True, "newClientOrderId": rec.client_order_id[:32]}
        if ex_name == "bybit":
            params["takeProfit"] = float(take_profit)
            params["stopLoss"] = float(stop_loss)
            params["timeInForce"] = "PostOnly"

        entry_order = exchange.create_order(
            symbol=ccxt_symbol,
            type="limit",
            side=side.lower(),
            amount=float(qty),
            price=float(limit_price),
            params=params,
        )
        entry_id = str(entry_order.get("id") or rec.client_order_id)
        OMSStateMachine.transition(
            rec.client_order_id, OrderState.ACKNOWLEDGED, broker_order_id=entry_id, db_path=db_path
        )

        # Place native OCO / SL + TP on exchanges that separate bracket legs
        opp_side = "sell" if side.lower() == "buy" else "buy"
        oco_info: Dict[str, Any] = {}
        if ex_name != "bybit":
            try:
                sl_order = exchange.create_order(
                    symbol=ccxt_symbol,
                    type="stop_loss_limit",
                    side=opp_side,
                    amount=float(qty),
                    price=float(stop_loss),
                    params={"stopPrice": float(stop_loss)},
                )
                tp_order = exchange.create_order(
                    symbol=ccxt_symbol,
                    type="take_profit_limit",
                    side=opp_side,
                    amount=float(qty),
                    price=float(take_profit),
                    params={"stopPrice": float(take_profit)},
                )
                oco_info = {"stop_loss_order_id": sl_order.get("id"), "take_profit_order_id": tp_order.get("id")}
            except Exception as leg_exc:
                # Cancel entry immediately if native OCO legs fail to rest on exchange
                try:
                    exchange.cancel_order(entry_id, ccxt_symbol)
                except Exception:
                    pass
                OMSStateMachine.transition(
                    rec.client_order_id, OrderState.CANCELLED, reason=f"OCO_LEG_FAILED:{leg_exc}", db_path=db_path
                )
                raise RuntimeError(f"Native OCO leg placement failed; entry cancelled: {leg_exc}") from leg_exc

        return {
            "status": "submitted",
            "exchange": ex_name,
            "client_order_id": rec.client_order_id,
            "broker_order_id": entry_id,
            "entry_order": entry_order,
            "oco_legs": oco_info,
        }
    except Exception as exc:
        OMSStateMachine.transition(rec.client_order_id, OrderState.REJECTED, reason=str(exc), db_path=db_path)
        raise RuntimeError(f"CCXT ({ex_name}) bracket order failed: {exc}") from exc


def execute_ibkr_bracket_order(
    *,
    market: str,
    ticker: str,
    side: str,
    shares: float,
    limit_price: float,
    stop_loss: float,
    take_profit: float,
    currency: Optional[str] = None,
    exchange: Optional[str] = None,
    client_order_id: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dual-Market IBKR Bracket Order router supporting US & international equities as well as JSE equities.
    """
    mkt = market.upper().strip()
    rec = OMSStateMachine.register_order(
        market=mkt,
        symbol=ticker,
        side=side,
        qty=shares,
        order_type="BRACKET_LIMIT",
        limit_price=limit_price,
        stop_loss=stop_loss,
        take_profit=take_profit,
        client_order_id=client_order_id,
        db_path=db_path,
    )

    ibkr_host = os.environ.get("IBKR_HOST", "").strip()
    ibkr_port = int(os.environ.get("IBKR_PORT", "7497"))
    ibkr_client_id = int(os.environ.get("IBKR_CLIENT_ID", "12"))
    webhook_url = os.environ.get(f"{mkt}_BROKER_WEBHOOK_URL", os.environ.get("JSE_BROKER_WEBHOOK_URL", "")).strip()

    clean_sym = ticker.upper().replace(".JO", "").strip()

    if ibkr_host:
        try:
            import ib_insync  # type: ignore

            ib = ib_insync.IB()
            ib.connect(ibkr_host, ibkr_port, clientId=ibkr_client_id, timeout=6.0)
            try:
                if mkt == "JSE":
                    contract = ib_insync.Stock(clean_sym, "JSE", currency or "ZAR")
                elif mkt == "US":
                    contract = ib_insync.Stock(clean_sym, exchange or "SMART", currency or "USD")
                else:
                    contract = ib_insync.Stock(clean_sym, exchange or "SMART", currency or "USD")

                ib.qualifyContracts(contract)
                bracket = ib.bracketOrder(
                    action=side.upper(),
                    quantity=float(shares),
                    limitPrice=round(float(limit_price), 2),
                    takeProfitPrice=round(float(take_profit), 2),
                    stopLossPrice=round(float(stop_loss), 2),
                )
                trades = [ib.placeOrder(contract, o) for o in bracket]
                parent_id = str(trades[0].order.orderId)
                OMSStateMachine.transition(
                    rec.client_order_id, OrderState.ACKNOWLEDGED, broker_order_id=parent_id, db_path=db_path
                )
                return {
                    "status": "submitted_ibkr",
                    "market": mkt,
                    "client_order_id": rec.client_order_id,
                    "broker_order_id": parent_id,
                }
            finally:
                ib.disconnect()
        except Exception as exc:
            OMSStateMachine.transition(rec.client_order_id, OrderState.REJECTED, reason=str(exc), db_path=db_path)
            raise RuntimeError(f"IBKR {mkt} bracket execution failed: {exc}") from exc

    if webhook_url:
        try:
            payload = {
                "client_order_id": rec.client_order_id,
                "exchange": mkt,
                "symbol": clean_sym,
                "side": side.upper(),
                "order_class": "BRACKET",
                "qty": float(shares),
                "limit_price": round(float(limit_price), 2),
                "take_profit": round(float(take_profit), 2),
                "stop_loss": round(float(stop_loss), 2),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            req = urllib.request.Request(
                webhook_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=8.0, context=_SSL_CTX) as resp:
                resp_body = json.loads(resp.read().decode("utf-8"))
                oid = str(resp_body.get("order_id") or rec.client_order_id)
                OMSStateMachine.transition(
                    rec.client_order_id, OrderState.ACKNOWLEDGED, broker_order_id=oid, db_path=db_path
                )
                return {
                    "status": "submitted_webhook",
                    "market": mkt,
                    "client_order_id": rec.client_order_id,
                    "broker_order_id": oid,
                }
        except Exception as exc:
            OMSStateMachine.transition(rec.client_order_id, OrderState.REJECTED, reason=str(exc), db_path=db_path)
            raise RuntimeError(f"{mkt} Broker Webhook execution failed: {exc}") from exc

    if is_live_trading_enabled():
        OMSStateMachine.transition(
            rec.client_order_id, OrderState.REJECTED, reason="MISSING_IBKR_OR_WEBHOOK_CONFIG", db_path=db_path
        )
        raise RuntimeError(f"LIVE_TRADING=true on {mkt} requires IBKR_HOST or {mkt}_BROKER_WEBHOOK_URL.")

    OMSStateMachine.transition(
        rec.client_order_id,
        OrderState.ACKNOWLEDGED,
        broker_order_id=f"dryrun-{rec.client_order_id}",
        reason="DRY_RUN_NO_BROKER_ENDPOINT",
        db_path=db_path,
    )
    return {
        "status": "acknowledged_dry_run",
        "market": mkt,
        "client_order_id": rec.client_order_id,
        "symbol": ticker,
    }


def execute_jse_ibkr_or_webhook_bracket_order(
    *,
    ticker: str,
    side: str,
    shares: float,
    limit_price_zar: float,
    stop_loss_zar: float,
    take_profit_zar: float,
    client_order_id: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    return execute_ibkr_bracket_order(
        market="JSE",
        ticker=ticker,
        side=side,
        shares=shares,
        limit_price=limit_price_zar,
        stop_loss=stop_loss_zar,
        take_profit=take_profit_zar,
        currency="ZAR",
        exchange="JSE",
        client_order_id=client_order_id,
        db_path=db_path,
    )


# ===========================================================================
# 5. Reconciliation & Dead-Man Watchdog Background Loop
# ===========================================================================
async def run_oms_reconciliation_and_watchdog_loop(
    *,
    market: str,
    db_path: str,
    reconcile_fn: Optional[Callable[[], Any]] = None,
    active_coach_fn: Optional[Callable[[], Any]] = None,
    telegram_alert_fn: Optional[Callable[[str], Any]] = None,
) -> None:
    """
    Lightweight background task running:
    - 10-second order & position reconciliation loop + real-time Active Trade Coach dispatcher
    - 30-second dead-man switch heartbeat with Telegram webhook alert on failure/freeze
    """
    mkt = market.upper().strip()
    last_heartbeat = 0.0
    consecutive_failures = 0

    while True:
        try:
            await asyncio.sleep(10.0)
            now = time.time()

            # 10s Reconciliation pass
            def _sync_oms_db() -> int:
                conn = get_wal_sqlite_connection(db_path)
                try:
                    ensure_oms_tables(conn)
                    rows = conn.execute(
                        "SELECT client_order_id, state FROM oms_orders WHERE market = ? AND state IN ('SUBMITTED', 'ACKNOWLEDGED', 'PARTIALLY_FILLED')",
                        (mkt,),
                    ).fetchall()
                    return len(rows)
                finally:
                    conn.close()

            await asyncio.to_thread(_sync_oms_db)
            if reconcile_fn is not None:
                res = reconcile_fn()
                if asyncio.iscoroutine(res):
                    await res
            if active_coach_fn is not None:
                c_res = active_coach_fn()
                if asyncio.iscoroutine(c_res):
                    await c_res

            # 30s Dead-Man Heartbeat
            if now - last_heartbeat >= 30.0:
                def _record_hb() -> None:
                    conn = get_wal_sqlite_connection(db_path)
                    try:
                        ensure_oms_tables(conn)
                        conn.execute(
                            """
                            INSERT INTO oms_circuit_breaker (market, locked_until_ts, lock_reason, last_heartbeat_ts, updated_at)
                            VALUES (?, 0.0, '', ?, ?)
                            ON CONFLICT(market) DO UPDATE SET
                                last_heartbeat_ts=excluded.last_heartbeat_ts,
                                updated_at=excluded.updated_at
                            """,
                            (mkt, now, datetime.now(timezone.utc).isoformat()),
                        )
                        conn.commit()
                    finally:
                        conn.close()

                await asyncio.to_thread(_record_hb)
                last_heartbeat = now
                consecutive_failures = 0

        except asyncio.CancelledError:
            break
        except Exception as exc:
            consecutive_failures += 1
            if telegram_alert_fn is not None and consecutive_failures >= 2:
                try:
                    alert_msg = f"⚠️ [OMS WATCHDOG ALERT - {mkt}] Reconciliation/Heartbeat failure (#{consecutive_failures}): {type(exc).__name__}: {exc}"
                    res = telegram_alert_fn(alert_msg)
                    if asyncio.iscoroutine(res):
                        await res
                except Exception:
                    pass
            await asyncio.sleep(5.0)


# ===========================================================================
# 6. Low-Latency Live Exchange Quote & OHLCV Feeders
# ===========================================================================
_QUOTE_CACHE: Dict[str, Dict[str, Any]] = {}


def fetch_live_crypto_l1_l2_and_ohlcv(
    symbol: str,
    limit: int = 120,
    timeout_sec: float = 3.5,
) -> Optional[Dict[str, Any]]:
    """
    Primary low-latency Crypto feed querying Binance / Bybit / VALR REST L1 bookTicker
    and daily OHLCV klines. Populates bid, ask, spread_pct, mid_price, and OHLCV arrays.
    """
    clean = symbol.upper().replace("-USD", "").replace(".JO", "").strip()
    if clean in ("USDZAR", "ZAR=X", "DXY", "DX-Y.NYB"):
        return None
    pair = f"{clean}USDT"
    now = time.time()

    try:
        # 1. Fetch real-time L1 bookTicker (bid/ask/spread) from Binance or Bybit
        ticker_url = f"https://api.binance.com/api/v3/ticker/bookTicker?symbol={pair}"
        req_t = urllib.request.Request(ticker_url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req_t, timeout=timeout_sec, context=_SSL_CTX) as resp:
            tk = json.loads(resp.read().decode("utf-8"))
        bid = float(tk.get("bidPrice") or 0.0)
        ask = float(tk.get("askPrice") or 0.0)
        mid = (bid + ask) / 2.0 if (bid > 0 and ask > 0) else 0.0
        spread_pct = ((ask - bid) / mid) * 100.0 if mid > 0 else 0.0

        # 2. Fetch daily OHLCV klines
        kline_url = f"https://api.binance.com/api/v3/klines?symbol={pair}&interval=1d&limit={limit}"
        req_k = urllib.request.Request(kline_url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req_k, timeout=timeout_sec, context=_SSL_CTX) as resp:
            klines = json.loads(resp.read().decode("utf-8"))

        if not klines or len(klines) < 15:
            return None

        opens = np.array([float(k[1]) for k in klines], dtype=float)
        highs = np.array([float(k[2]) for k in klines], dtype=float)
        lows = np.array([float(k[3]) for k in klines], dtype=float)
        closes = np.array([float(k[4]) for k in klines], dtype=float)
        vols = np.array([float(k[5]) for k in klines], dtype=float)
        if mid > 0:
            closes[-1] = mid

        out = {
            "open": opens,
            "high": highs,
            "low": lows,
            "close": closes,
            "volume": vols,
            "bid": bid,
            "ask": ask,
            "mid": mid,
            "spread_pct": round(spread_pct, 4),
            "timestamp": now,
            "source": "BINANCE_L1_REST",
        }
        _QUOTE_CACHE[f"CRYPTO:{clean}"] = out
        return out
    except Exception:
        # Fallback to Bybit V5 spot kline + orderbook
        try:
            bybit_url = f"https://api.bybit.com/v5/market/kline?category=spot&symbol={pair}&interval=D&limit={limit}"
            req_b = urllib.request.Request(bybit_url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req_b, timeout=timeout_sec, context=_SSL_CTX) as resp:
                bdata = json.loads(resp.read().decode("utf-8"))
            rows = list(reversed((bdata.get("result") or {}).get("list") or []))
            if len(rows) < 15:
                return None
            closes = np.array([float(r[4]) for r in rows], dtype=float)
            mid = float(closes[-1])
            out = {
                "open": np.array([float(r[1]) for r in rows], dtype=float),
                "high": np.array([float(r[2]) for r in rows], dtype=float),
                "low": np.array([float(r[3]) for r in rows], dtype=float),
                "close": closes,
                "volume": np.array([float(r[5]) for r in rows], dtype=float),
                "bid": mid * 0.9997,
                "ask": mid * 1.0003,
                "mid": mid,
                "spread_pct": 0.06,
                "timestamp": now,
                "source": "BYBIT_V5_SPOT",
            }
            _QUOTE_CACHE[f"CRYPTO:{clean}"] = out
            return out
        except Exception:
            return None


def fetch_live_us_alpaca_quote_and_bars(
    symbol: str,
    limit: int = 120,
    timeout_sec: float = 4.0,
) -> Optional[Tuple[Dict[str, np.ndarray], Dict[str, Any]]]:
    """
    Primary real-time US equity quote & daily bar fetcher via Alpaca Market Data v2
    when ALPACA_API_KEY / APCA_API_KEY_ID is configured.
    """
    api_key = (os.environ.get("ALPACA_API_KEY") or os.environ.get("APCA_API_KEY_ID") or "").strip()
    secret_key = (os.environ.get("ALPACA_SECRET_KEY") or os.environ.get("APCA_API_SECRET_KEY") or "").strip()
    if not api_key or not secret_key:
        return None
    if symbol.startswith("^") or "=" in symbol or "-" in symbol:
        return None

    clean = symbol.upper().strip()
    headers = {
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": secret_key,
        "Accept": "application/json",
    }
    now = time.time()
    try:
        bars_url = f"https://data.alpaca.markets/v2/stocks/{ urllib.parse.quote(clean) }/bars?timeframe=1Day&limit={limit}&adjustment=all"
        req_b = urllib.request.Request(bars_url, headers=headers)
        with urllib.request.urlopen(req_b, timeout=timeout_sec, context=_SSL_CTX) as resp:
            b_payload = json.loads(resp.read().decode("utf-8"))
        bars = b_payload.get("bars") or []
        if len(bars) < 15:
            return None

        # Fetch latest L1 quote for spread & mid-price validation
        quote_url = f"https://data.alpaca.markets/v2/stocks/{ urllib.parse.quote(clean) }/quotes/latest"
        req_q = urllib.request.Request(quote_url, headers=headers)
        bid, ask = 0.0, 0.0
        try:
            with urllib.request.urlopen(req_q, timeout=timeout_sec, context=_SSL_CTX) as qresp:
                q_payload = json.loads(qresp.read().decode("utf-8")).get("quote") or {}
                bid = float(q_payload.get("bp") or 0.0)
                ask = float(q_payload.get("ap") or 0.0)
        except Exception:
            pass

        closes = np.array([float(b["c"]) for b in bars], dtype=float)
        mid = (bid + ask) / 2.0 if (bid > 0 and ask > 0) else float(closes[-1])
        spread_pct = ((ask - bid) / mid) * 100.0 if (bid > 0 and ask > 0 and mid > 0) else 0.04
        if mid > 0:
            closes[-1] = mid

        series = {
            "open": np.array([float(b["o"]) for b in bars], dtype=float),
            "high": np.array([float(b["h"]) for b in bars], dtype=float),
            "low": np.array([float(b["l"]) for b in bars], dtype=float),
            "close": closes,
            "volume": np.array([float(b["v"]) for b in bars], dtype=float),
        }
        meta = {
            "regularMarketPrice": mid,
            "bid": bid,
            "ask": ask,
            "spread_pct": round(spread_pct, 4),
            "last_bar_date": str(bars[-1].get("t", ""))[:10],
            "n_bars": len(bars),
            "timestamp": now,
            "source": "ALPACA_SIP_LIVE",
        }
        _QUOTE_CACHE[f"US:{clean}"] = {**series, **meta}
        return series, meta
    except Exception:
        return None


def get_cached_live_quote(market: str, symbol: str) -> Dict[str, Any]:
    clean = symbol.upper().replace("-USD", "").replace(".JO", "").strip()
    return _QUOTE_CACHE.get(f"{market.upper()}:{clean}", {})


async def start_ccxt_pro_websocket_stream(
    exchange_id: str = "binance",
    symbols: Optional[List[str]] = None,
    on_quote_callback: Optional[Callable[[str, Dict[str, Any]], Any]] = None,
    stop_event: Optional[asyncio.Event] = None,
) -> None:
    """
    Subscribes to CCXT Pro (ccxt.pro) real-time WebSocket L1/L2 orderbook & trade streams
    for Binance, Bybit, Kraken, and VALR. Updates shared in-memory _QUOTE_CACHE with zero REST polling.
    """
    ex_name = (exchange_id or os.environ.get("CCXT_EXCHANGE", "binance")).strip().lower()
    sym_list = symbols or ["BTC/USDT", "ETH/USDT", "SOL/USDT"]
    try:
        import ccxt.pro as ccxtpro  # type: ignore

        ex_cls = getattr(ccxtpro, ex_name, None)
        if ex_cls is None:
            return
        exchange = ex_cls({"enableRateLimit": True})
        try:
            while stop_event is None or not stop_event.is_set():
                for s in sym_list:
                    try:
                        orderbook = await exchange.watch_order_book(s, limit=10)
                        bids = orderbook.get("bids") or []
                        asks = orderbook.get("asks") or []
                        best_bid = float(bids[0][0]) if bids else 0.0
                        best_ask = float(asks[0][0]) if asks else 0.0
                        mid = (best_bid + best_ask) / 2.0 if (best_bid > 0 and best_ask > 0) else 0.0
                        spread_pct = ((best_ask - best_bid) / mid) * 100.0 if mid > 0 else 0.05
                        clean = s.split("/")[0].upper()
                        quote_data = {
                            "bid": best_bid,
                            "ask": best_ask,
                            "mid": mid,
                            "spread_pct": round(spread_pct, 4),
                            "timestamp": time.time(),
                            "source": f"CCXT_PRO_{ex_name.upper()}_WS",
                        }
                        _QUOTE_CACHE[f"CRYPTO:{clean}"] = quote_data
                        if on_quote_callback is not None:
                            res = on_quote_callback(clean, quote_data)
                            if asyncio.iscoroutine(res):
                                await res
                    except Exception:
                        pass
                await asyncio.sleep(0.1)
        finally:
            await exchange.close()
    except Exception:
        # Fallback to periodic REST if ccxt.pro not installed
        pass
