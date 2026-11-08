"""
SQLite Persistence Layer for Crypto Stock Market Sovereign Terminal (V10.1)
Database Path: ./Crypto Stock market/backend/data/crypto_quant_coach.db
Tables:
  - trades (Open & Closed Real/Paper 1x Spot Crypto Positions with V10.1 Audit & ZAR/USDT P&L)
  - custom_watchlist (No-Code "+ Add Crypto Coin" Watchlist)
  - paper_wallet (Persistent $10,000 USDT Virtual Practice Account)
  - shadow_signals (Out-of-Sample Signal Tracking for Agent MWU)
  - agent_weights (Self-Learning Specialist Multipliers)
  - alert_settings (Telegram Bot Token, Chat ID, Webhook, 07:30 & 19:30 SAST Briefing state)
  - user_settings (Persistent Account Balance ZAR & View Mode preferences)
"""
import os
import sys
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from config import DB_PATH, DEFAULT_FEE_PROFILE, DEFAULT_ROUND_TRIP_FEE_PCT, round_crypto_price

_ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT_DIR not in sys.path:
    sys.path.insert(0, _ROOT_DIR)
from shared_core.oms_engine import get_wal_sqlite_connection


SEED_DEMO_DATA = False  # V13 SEED PATCH: demo trade/wallet seeding is OFF. Do not set to True.


def get_conn() -> sqlite3.Connection:
    return get_wal_sqlite_connection(DB_PATH)


# Preserve V9.0 function aliases
def get_db_connection() -> sqlite3.Connection:
    return get_conn()


def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        narrative TEXT NOT NULL DEFAULT 'HIGH_SPEED_L1',
        sector TEXT NOT NULL DEFAULT 'HIGH_SPEED_L1',
        mode TEXT NOT NULL DEFAULT 'REAL',
        broker_profile TEXT NOT NULL DEFAULT 'BINANCE_BYBIT_SPOT',
        entry_price REAL NOT NULL,
        current_price REAL NOT NULL,
        highest_price_seen REAL NOT NULL DEFAULT 0.0,
        shares REAL NOT NULL,
        stop_loss REAL NOT NULL,
        target_price REAL NOT NULL,
        round_trip_fee_pct REAL NOT NULL DEFAULT 0.25,
        atr_at_entry REAL NOT NULL DEFAULT 2.5,
        plan_selected TEXT NOT NULL DEFAULT 'PLAN_A',
        stage_1_fired INTEGER NOT NULL DEFAULT 1,
        stage_2_fired INTEGER NOT NULL DEFAULT 0,
        stage_3_fired INTEGER NOT NULL DEFAULT 0,
        stage_4_fired INTEGER NOT NULL DEFAULT 0,
        stage_5_fired INTEGER NOT NULL DEFAULT 0,
        stage_6_fired INTEGER NOT NULL DEFAULT 0,
        stage_7_fired INTEGER NOT NULL DEFAULT 0,
        current_stage INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'OPEN',
        opened_at TEXT NOT NULL,
        closed_at TEXT DEFAULT NULL,
        exit_price REAL DEFAULT NULL,
        realized_pnl_usd REAL DEFAULT 0.0,
        realized_net_pnl_pct REAL DEFAULT NULL,
        realized_net_pnl_usd REAL DEFAULT NULL,
        realized_net_pnl_zar REAL DEFAULT NULL,
        close_reason TEXT DEFAULT NULL
    )
    """)

    # Idempotent column migrations for existing V9.0 DBs
    existing_cols = {
        row["name"] for row in cur.execute("PRAGMA table_info(trades)").fetchall()
    }
    migrations = [
        ("narrative", "TEXT NOT NULL DEFAULT 'HIGH_SPEED_L1'"),
        ("sector", "TEXT NOT NULL DEFAULT 'HIGH_SPEED_L1'"),
        ("mode", "TEXT NOT NULL DEFAULT 'REAL'"),
        ("broker_profile", "TEXT NOT NULL DEFAULT 'BINANCE_BYBIT_SPOT'"),
        ("entry_price", "REAL NOT NULL DEFAULT 0.0"),
        ("current_price", "REAL NOT NULL DEFAULT 0.0"),
        ("highest_price_seen", "REAL NOT NULL DEFAULT 0.0"),
        ("shares", "REAL NOT NULL DEFAULT 0.0"),
        ("stop_loss", "REAL NOT NULL DEFAULT 0.0"),
        ("target_price", "REAL NOT NULL DEFAULT 0.0"),
        ("round_trip_fee_pct", "REAL NOT NULL DEFAULT 0.25"),
        ("atr_at_entry", "REAL NOT NULL DEFAULT 1.0"),
        ("plan_selected", "TEXT NOT NULL DEFAULT 'PLAN_A'"),
        ("stage_1_fired", "INTEGER NOT NULL DEFAULT 1"),
        ("stage_2_fired", "INTEGER NOT NULL DEFAULT 0"),
        ("stage_3_fired", "INTEGER NOT NULL DEFAULT 0"),
        ("stage_4_fired", "INTEGER NOT NULL DEFAULT 0"),
        ("stage_5_fired", "INTEGER NOT NULL DEFAULT 0"),
        ("stage_6_fired", "INTEGER NOT NULL DEFAULT 0"),
        ("stage_7_fired", "INTEGER NOT NULL DEFAULT 0"),
        ("current_stage", "INTEGER NOT NULL DEFAULT 1"),
        ("exit_price", "REAL DEFAULT NULL"),
        ("realized_pnl_usd", "REAL DEFAULT 0.0"),
        ("realized_net_pnl_pct", "REAL DEFAULT NULL"),
        ("realized_net_pnl_usd", "REAL DEFAULT NULL"),
        ("realized_net_pnl_zar", "REAL DEFAULT NULL"),
        ("close_reason", "TEXT DEFAULT NULL"),
        ("tp0_hit", "INTEGER NOT NULL DEFAULT 0"),
        ("tp1_hit", "INTEGER NOT NULL DEFAULT 0"),
        ("tp2_hit", "INTEGER NOT NULL DEFAULT 0"),
        ("remaining_weight_pct", "REAL NOT NULL DEFAULT 100.0"),
        ("realized_partial_pnl_zar", "REAL NOT NULL DEFAULT 0.0"),
        ("limit_created_at", "TEXT DEFAULT NULL"),
        ("limit_ttl_hours", "INTEGER NOT NULL DEFAULT 8"),
        ("tp0_price", "REAL DEFAULT NULL"),
        ("breakeven_lock_price", "REAL DEFAULT NULL"),
        ("tp1_price", "REAL DEFAULT NULL"),
        ("tp2_price", "REAL DEFAULT NULL"),
        ("tp3_price", "REAL DEFAULT NULL"),
    ]
    for col_name, col_type in migrations:
        if col_name not in existing_cols:
            try:
                cur.execute(f"ALTER TABLE trades ADD COLUMN {col_name} {col_type}")
            except Exception:
                pass

    cur.execute("""
    CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        sector TEXT NOT NULL DEFAULT 'HIGH_SPEED_L1',
        mode TEXT NOT NULL DEFAULT 'REAL',
        broker_profile TEXT NOT NULL DEFAULT 'BINANCE_BYBIT_SPOT',
        entry_price REAL NOT NULL,
        current_price REAL NOT NULL,
        highest_price_seen REAL NOT NULL DEFAULT 0.0,
        shares REAL NOT NULL,
        stop_loss REAL NOT NULL,
        target_price REAL NOT NULL,
        round_trip_fee_pct REAL NOT NULL DEFAULT 0.36,
        status TEXT NOT NULL DEFAULT 'OPEN',
        tp0_hit INTEGER DEFAULT 0,
        tp1_hit INTEGER DEFAULT 0,
        tp2_hit INTEGER DEFAULT 0,
        remaining_weight_pct REAL DEFAULT 100.0,
        realized_partial_pnl_zar REAL DEFAULT 0.0,
        limit_created_at TEXT,
        limit_ttl_hours INTEGER DEFAULT 8,
        tp0_price REAL,
        breakeven_lock_price REAL,
        tp1_price REAL,
        tp2_price REAL,
        tp3_price REAL,
        opened_at TEXT DEFAULT (datetime('now'))
    )
    """)
    pos_cols = {row["name"] for row in cur.execute("PRAGMA table_info(positions)").fetchall()}
    for col_name, col_type in migrations:
        if col_name not in pos_cols:
            try:
                cur.execute(f"ALTER TABLE positions ADD COLUMN {col_name} {col_type}")
            except Exception:
                pass

    cur.execute("""
    CREATE TABLE IF NOT EXISTS capital_ledger (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        starting_capital_zar REAL DEFAULT 10000.0,
        free_cash_zar REAL DEFAULT 10000.0,
        deployed_capital_zar REAL DEFAULT 0.0,
        realized_pnl_zar REAL DEFAULT 0.0,
        updated_at TEXT
    )
    """)
    cap_cols = {row["name"] for row in cur.execute("PRAGMA table_info(capital_ledger)").fetchall()}
    for c_name, c_type in [
        ("starting_capital_zar", "REAL DEFAULT 10000.0"),
        ("free_cash_zar", "REAL DEFAULT 10000.0"),
        ("deployed_capital_zar", "REAL DEFAULT 0.0"),
        ("realized_pnl_zar", "REAL DEFAULT 0.0"),
        ("updated_at", "TEXT"),
    ]:
        if c_name not in cap_cols:
            try:
                cur.execute(f"ALTER TABLE capital_ledger ADD COLUMN {c_name} {c_type}")
            except Exception:
                pass
    cur.execute(
        "INSERT OR IGNORE INTO capital_ledger (id, starting_capital_zar, free_cash_zar, deployed_capital_zar, realized_pnl_zar, updated_at) VALUES (1, 10000.0, 10000.0, 0.0, 0.0, datetime('now'))"
    )

    cur.execute("""
    CREATE TABLE IF NOT EXISTS signal_alerts_log (
        ticker TEXT NOT NULL,
        alert_date TEXT NOT NULL,
        verdict TEXT,
        recommended_plan TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (ticker, alert_date)
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS shadow_signals_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT DEFAULT '',
        symbol TEXT DEFAULT '',
        verdict TEXT DEFAULT 'A+_SNIPER_BUY',
        recommended_entry_plan TEXT DEFAULT 'PLAN_A_MARKET',
        entry_price REAL NOT NULL DEFAULT 0.0,
        limit_dip_price REAL DEFAULT 0.0,
        stop_loss REAL NOT NULL DEFAULT 0.0,
        target_price REAL DEFAULT 0.0,
        tp0_price REAL DEFAULT 0.0,
        tp1_price REAL DEFAULT 0.0,
        tp2_price REAL DEFAULT 0.0,
        tp3_price REAL DEFAULT 0.0,
        calibrated_win_prob_pct REAL DEFAULT 60.0,
        outcome_status TEXT DEFAULT 'PENDING',
        created_at TEXT DEFAULT (datetime('now'))
    )
    """)
    sh_cols = {row["name"] for row in cur.execute("PRAGMA table_info(shadow_signals_log)").fetchall()}
    for c_name, c_type in [
        ("ticker", "TEXT DEFAULT ''"),
        ("limit_dip_price", "REAL DEFAULT 0.0"),
        ("tp0_price", "REAL DEFAULT 0.0"),
        ("tp1_price", "REAL DEFAULT 0.0"),
        ("tp2_price", "REAL DEFAULT 0.0"),
        ("tp3_price", "REAL DEFAULT 0.0"),
        ("outcome_status", "TEXT DEFAULT 'PENDING'"),
    ]:
        if c_name not in sh_cols:
            try:
                cur.execute(f"ALTER TABLE shadow_signals_log ADD COLUMN {c_name} {c_type}")
            except Exception:
                pass

    cur.execute("""
    CREATE TABLE IF NOT EXISTS custom_watchlist (
        symbol TEXT PRIMARY KEY,
        yf_ticker TEXT NOT NULL,
        name TEXT NOT NULL,
        sector TEXT NOT NULL DEFAULT 'CRYPTO_CUSTOM',
        twin TEXT NOT NULL DEFAULT 'BTC',
        added_at TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS paper_wallet (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        starting_cash_usd REAL NOT NULL DEFAULT 10000.0,
        cash_balance_usd REAL NOT NULL DEFAULT 10000.0,
        realized_pnl_usd REAL NOT NULL DEFAULT 0.0,
        total_trades_closed INTEGER NOT NULL DEFAULT 0,
        winning_trades INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS shadow_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        signal_tier TEXT DEFAULT 'A_PLUS',
        entry_price REAL NOT NULL DEFAULT 0.0,
        target_price REAL NOT NULL DEFAULT 0.0,
        stop_loss REAL NOT NULL DEFAULT 0.0,
        quant_score REAL NOT NULL DEFAULT 80.0,
        deriv_score REAL NOT NULL DEFAULT 80.0,
        onchain_score REAL NOT NULL DEFAULT 80.0,
        macro_score REAL NOT NULL DEFAULT 80.0,
        conviction_score REAL DEFAULT 82.0,
        outcome_status TEXT DEFAULT 'ACTIVE_TRACKING',
        return_pct REAL DEFAULT 0.0,
        evaluated INTEGER NOT NULL DEFAULT 0,
        outcome_win INTEGER DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS agent_weights (
        agent_id TEXT PRIMARY KEY,
        weight REAL NOT NULL,
        brier_score REAL NOT NULL DEFAULT 0.15,
        samples INTEGER NOT NULL DEFAULT 42,
        updated_at TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS alert_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        telegram_bot_token TEXT NOT NULL DEFAULT '9177348992:AAFLFS3NCJt36HIu72A3IZxU0Dguw-tvpjo',
        telegram_chat_id TEXT NOT NULL DEFAULT '5953317572',
        discord_webhook_url TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        last_update_id INTEGER NOT NULL DEFAULT 0,
        last_morning_brief_date TEXT NOT NULL DEFAULT '',
        last_evening_brief_date TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
    )
    """)

    alert_cols = {
        row["name"] for row in cur.execute("PRAGMA table_info(alert_settings)").fetchall()
    }
    for col_name, col_type in [
        ("last_update_id", "INTEGER NOT NULL DEFAULT 0"),
        ("last_morning_brief_date", "TEXT NOT NULL DEFAULT ''"),
        ("last_evening_brief_date", "TEXT NOT NULL DEFAULT ''"),
    ]:
        if col_name not in alert_cols:
            try:
                cur.execute(f"ALTER TABLE alert_settings ADD COLUMN {col_name} {col_type}")
            except Exception:
                pass

    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS bot_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled INTEGER NOT NULL DEFAULT 1,
        mode TEXT NOT NULL DEFAULT 'PAPER',
        max_active_positions INTEGER NOT NULL DEFAULT 3,
        min_kelly_fraction_pct REAL NOT NULL DEFAULT 8.0,
        eta_learning_rate REAL NOT NULL DEFAULT 0.08,
        polling_interval_sec INTEGER NOT NULL DEFAULT 15,
        auto_manage_coach INTEGER NOT NULL DEFAULT 1,
        broker_profile TEXT NOT NULL DEFAULT 'BINANCE_BYBIT_VIP',
        last_run_timestamp TEXT,
        updated_at TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS bot_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        action_type TEXT NOT NULL,
        symbol TEXT,
        trade_id INTEGER,
        details_json TEXT NOT NULL
    )
    """)

    cur.execute("SELECT COUNT(*) AS c FROM bot_settings")
    if cur.fetchone()["c"] == 0:
        cur.execute("""
            INSERT INTO bot_settings (
                id, enabled, mode, max_active_positions, min_kelly_fraction_pct,
                eta_learning_rate, polling_interval_sec, auto_manage_coach, broker_profile,
                last_run_timestamp, updated_at
            ) VALUES (1, 1, 'PAPER', 3, 8.0, 0.08, 15, 1, 'BINANCE_BYBIT_VIP', NULL, ?)
        """, (now_iso if 'now_iso' in locals() else datetime.now(timezone.utc).isoformat(),))

    now_iso = datetime.now(timezone.utc).isoformat()

    cur.execute("SELECT COUNT(*) AS c FROM paper_wallet")
    if cur.fetchone()["c"] == 0:
        cur.execute("""
            INSERT INTO paper_wallet (id, starting_cash_usd, cash_balance_usd, realized_pnl_usd, total_trades_closed, winning_trades, updated_at)
            VALUES (1, 600.0, 600.0, 0.0, 0, 0, ?)
        """, (now_iso,))

    default_agents = [
        ("quant_microstructure", 0.30, 0.138, 64),
        ("perp_funding_options", 0.27, 0.146, 64),
        ("onchain_defillama_dex", 0.23, 0.158, 64),
        ("macro_narrative_zar", 0.20, 0.165, 64),
    ]
    for aid, w, brier, samp in default_agents:
        cur.execute("""
            INSERT OR IGNORE INTO agent_weights (agent_id, weight, brier_score, samples, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """, (aid, w, brier, samp, now_iso))

    cur.execute("SELECT COUNT(*) AS c FROM alert_settings")
    if cur.fetchone()["c"] == 0:
        cur.execute("""
            INSERT INTO alert_settings (id, telegram_bot_token, telegram_chat_id, discord_webhook_url, enabled, last_update_id, last_morning_brief_date, last_evening_brief_date, updated_at)
            VALUES (1, '9177348992:AAFLFS3NCJt36HIu72A3IZxU0Dguw-tvpjo', '5953317572', '', 1, 0, '', '', ?)
        """, (now_iso,))
    else:
        cur.execute("""
            UPDATE alert_settings
            SET telegram_bot_token = '9177348992:AAFLFS3NCJt36HIu72A3IZxU0Dguw-tvpjo',
                telegram_chat_id = '5953317572',
                enabled = 1
            WHERE id = 1 AND (telegram_bot_token = '' OR telegram_chat_id = '')
        """)

    # Seed initial 1x Spot Crypto positions & historical closed trades if table is empty
    cur.execute("SELECT COUNT(*) AS c FROM trades")
    if cur.fetchone()["c"] == 0 and SEED_DEMO_DATA:  # V13 SEED PATCH
        t_open_1 = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        t_open_2 = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        # 1. Open Major L1 Anchor Position: BTC (1x Spot)
        cur.execute("""
            INSERT INTO trades (
                symbol, name, narrative, sector, mode, broker_profile,
                entry_price, current_price, highest_price_seen,
                shares, stop_loss, target_price, round_trip_fee_pct, atr_at_entry, plan_selected,
                stage_1_fired, stage_2_fired, stage_3_fired, current_stage, status, opened_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 3, 'OPEN', ?)
        """, (
            "BTC", "Bitcoin", "INSTITUTIONAL_CORE", "INSTITUTIONAL_CORE", "REAL", DEFAULT_FEE_PROFILE,
            85800.00, 88450.00, 89120.00, 0.0028, 82950.00, 94800.00, DEFAULT_ROUND_TRIP_FEE_PCT, 2150.0, "PLAN_A", t_open_1
        ))
        # 2. Open High-Velocity AI Compute Position: TAO (1x Spot)
        cur.execute("""
            INSERT INTO trades (
                symbol, name, narrative, sector, mode, broker_profile,
                entry_price, current_price, highest_price_seen,
                shares, stop_loss, target_price, round_trip_fee_pct, atr_at_entry, plan_selected,
                stage_1_fired, stage_2_fired, current_stage, status, opened_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 2, 'OPEN', ?)
        """, (
            "TAO", "Bittensor", "AI_COMPUTE", "AI_COMPUTE", "REAL", DEFAULT_FEE_PROFILE,
            326.00, 342.50, 345.80, 0.58, 304.50, 384.00, DEFAULT_ROUND_TRIP_FEE_PCT, 14.8, "PLAN_C", t_open_2
        ))

        # Seed 3 Realistic Closed 1x Spot Crypto Trades for R10k -> R100k Compounding Tracker
        closed_seeds = [
            ("SOL", "Solana", "HIGH_SPEED_L1", "HIGH_SPEED_L1", "REAL", DEFAULT_FEE_PROFILE,
             162.40, 178.20, 1.35, 153.80, 179.00, 0.25, 6.20, "PLAN_B",
             (datetime.now(timezone.utc) - timedelta(days=12)).isoformat(),
             (datetime.now(timezone.utc) - timedelta(days=8)).isoformat(),
             178.20, 9.48, 20.75, 377.24, "STAGE_6_PROFIT_HARVEST"),
            ("AAVE", "Aave Protocol", "DEFI_YIELD", "DEFI_YIELD", "REAL", DEFAULT_FEE_PROFILE,
             198.00, 214.20, 0.90, 187.50, 216.00, 0.25, 7.40, "PLAN_A",
             (datetime.now(timezone.utc) - timedelta(days=9)).isoformat(),
             (datetime.now(timezone.utc) - timedelta(days=5)).isoformat(),
             214.20, 7.93, 14.12, 256.70, "STAGE_5_SCALE_OUT"),
            ("RENDER", "Render Network", "AI_COMPUTE", "AI_COMPUTE", "REAL", DEFAULT_FEE_PROFILE,
             4.08, 4.44, 42.0, 3.82, 4.50, 0.25, 0.19, "PLAN_A",
             (datetime.now(timezone.utc) - timedelta(days=6)).isoformat(),
             (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
             4.44, 8.57, 14.67, 266.70, "TARGET_HIT_NET"),
        ]
        for row in closed_seeds:
            cur.execute("""
                INSERT INTO trades (
                    symbol, name, narrative, sector, mode, broker_profile,
                    entry_price, current_price, highest_price_seen, shares, stop_loss, target_price,
                    round_trip_fee_pct, atr_at_entry, plan_selected,
                    stage_1_fired, stage_2_fired, stage_3_fired, stage_4_fired, stage_5_fired, stage_6_fired,
                    current_stage, status, opened_at, closed_at, exit_price,
                    realized_pnl_usd, realized_net_pnl_pct, realized_net_pnl_usd, realized_net_pnl_zar, close_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 1, 1, 1, 6, 'CLOSED', ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                row[0], row[1], row[2], row[3], row[4], row[5],
                row[6], row[7], row[7], row[8], row[9], row[10],
                row[11], row[12], row[13],
                row[14], row[15], row[16],
                row[18], row[17], row[18], row[19], row[20]
            ))

    conn.commit()
    conn.close()


def init_sqlite_db() -> None:
    init_db()


def fetch_open_trades() -> List[Dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM trades WHERE status = 'OPEN' ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_closed_trades(limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM trades WHERE status = 'CLOSED' ORDER BY closed_at DESC, id DESC LIMIT ?",
        (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_paper_wallet() -> Dict[str, Any]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM paper_wallet WHERE id = 1").fetchone()
    conn.close()
    return dict(row) if row else {
        "starting_cash_usd": 10000.0,
        "cash_balance_usd": 10000.0,
        "realized_pnl_usd": 0.0,
        "total_trades_closed": 0,
        "winning_trades": 0,
    }


def fetch_agent_weights() -> Dict[str, Dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM agent_weights").fetchall()
    conn.close()
    return {r["agent_id"]: dict(r) for r in rows}


def fetch_custom_watchlist() -> List[Dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM custom_watchlist ORDER BY added_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_custom_watchlist_ticker(
    symbol: str,
    name: str,
    yf_ticker: Optional[str] = None,
    sector: str = "CRYPTO_CUSTOM",
    twin: str = "BTC"
) -> Dict[str, Any]:
    clean = symbol.upper().strip().replace("-USD", "")
    yf_sym = yf_ticker or f"{clean}-USD"
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_conn()
    conn.execute("""
        INSERT OR REPLACE INTO custom_watchlist (symbol, yf_ticker, name, sector, twin, added_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (clean, yf_sym, name, sector, twin, now_iso))
    conn.commit()
    conn.close()
    return {
        "symbol": clean,
        "yf_ticker": yf_sym,
        "name": name,
        "sector": sector,
        "twin": twin,
        "added_at": now_iso,
    }


def remove_custom_watchlist_ticker(symbol: str) -> bool:
    clean = symbol.upper().strip().replace("-USD", "")
    conn = get_conn()
    cur = conn.execute(
        "DELETE FROM custom_watchlist WHERE symbol = ? OR yf_ticker = ?",
        (clean, f"{clean}-USD")
    )
    deleted = cur.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def fetch_alert_settings() -> Dict[str, Any]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM alert_settings WHERE id = 1").fetchone()
    conn.close()
    if not row:
        return {
            "telegram_bot_token": "",
            "telegram_chat_id": "",
            "discord_webhook_url": "",
            "enabled": False,
            "last_update_id": 0,
            "last_morning_brief_date": "",
            "last_evening_brief_date": "",
        }
    d = dict(row)
    d["enabled"] = bool(d.get("enabled", 0))
    return d


def save_alert_settings(
    telegram_bot_token: str,
    telegram_chat_id: str,
    discord_webhook_url: str = "",
    enabled: bool = True
) -> Dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_conn()
    conn.execute("""
        UPDATE alert_settings
        SET telegram_bot_token = ?, telegram_chat_id = ?, discord_webhook_url = ?, enabled = ?, updated_at = ?
        WHERE id = 1
    """, (telegram_bot_token.strip(), telegram_chat_id.strip(), discord_webhook_url.strip(), 1 if enabled else 0, now_iso))
    conn.commit()
    conn.close()
    return fetch_alert_settings()


def update_telegram_cursor(
    last_update_id: int,
    last_morning_brief_date: Optional[str] = None,
    last_evening_brief_date: Optional[str] = None,
) -> None:
    conn = get_conn()
    if last_morning_brief_date is not None:
        conn.execute(
            "UPDATE alert_settings SET last_update_id = ?, last_morning_brief_date = ? WHERE id = 1",
            (last_update_id, last_morning_brief_date)
        )
    elif last_evening_brief_date is not None:
        conn.execute(
            "UPDATE alert_settings SET last_update_id = ?, last_evening_brief_date = ? WHERE id = 1",
            (last_update_id, last_evening_brief_date)
        )
    else:
        conn.execute(
            "UPDATE alert_settings SET last_update_id = ? WHERE id = 1",
            (last_update_id,)
        )
    conn.commit()
    conn.close()


def insert_trade(
    symbol: str,
    name: str,
    sector: str,
    mode: str,
    broker_profile: str,
    entry_price: float,
    shares: float,
    stop_loss: float,
    target_price: float,
    round_trip_fee_pct: float = DEFAULT_ROUND_TRIP_FEE_PCT,
    atr_at_entry: float = 2.5,
    plan_selected: str = "PLAN_A",
) -> int:
    now_iso = datetime.now(timezone.utc).isoformat()
    clean = symbol.upper().strip().replace("-USD", "")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO trades (
            symbol, name, narrative, sector, mode, broker_profile,
            entry_price, current_price, highest_price_seen, shares,
            stop_loss, target_price, round_trip_fee_pct, atr_at_entry, plan_selected,
            stage_1_fired, current_stage, status, opened_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'OPEN', ?)
    """, (
        clean, name, sector, sector, mode.upper(), broker_profile,
        float(entry_price), float(entry_price), float(entry_price), float(shares),
        float(stop_loss), float(target_price), float(round_trip_fee_pct), float(atr_at_entry), plan_selected,
        now_iso
    ))
    trade_id = cur.lastrowid
    if mode.upper() == "PAPER":
        cost_usd = float(entry_price) * float(shares) * (1.0 + float(round_trip_fee_pct) / 200.0)
        cur.execute("""
            UPDATE paper_wallet
            SET cash_balance_usd = MAX(0.0, cash_balance_usd - ?), updated_at = ?
            WHERE id = 1
        """, (cost_usd, now_iso))
    conn.commit()
    conn.close()
    return int(trade_id or 0)


def close_trade_by_id(
    trade_id: int,
    exit_price: Optional[float] = None,
    usdzar_rate: float = 18.18,
    close_reason: str = "MANUAL_CLOSE"
) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM trades WHERE id = ? AND status = 'OPEN'", (trade_id,)).fetchone()
    if not row:
        conn.close()
        return None
    t = dict(row)
    final_exit = float(exit_price) if (exit_price is not None and exit_price > 0) else float(t["current_price"])
    entry = float(t["entry_price"])
    shares = float(t["shares"])
    fee_pct = float(t.get("round_trip_fee_pct", DEFAULT_ROUND_TRIP_FEE_PCT))

    gross_pct = ((final_exit - entry) / max(entry, 1e-9)) * 100.0
    net_pct = gross_pct - fee_pct
    gross_usd = (final_exit - entry) * shares
    fees_usd = (entry * shares + final_exit * shares) * (fee_pct / 200.0)
    net_usd = gross_usd - fees_usd
    net_zar = net_usd * float(usdzar_rate)
    now_iso = datetime.now(timezone.utc).isoformat()

    cur.execute("""
        UPDATE trades
        SET status = 'CLOSED',
            current_price = ?,
            exit_price = ?,
            closed_at = ?,
            realized_pnl_usd = ?,
            realized_net_pnl_pct = ?,
            realized_net_pnl_usd = ?,
            realized_net_pnl_zar = ?,
            close_reason = ?
        WHERE id = ?
    """, (
        round_crypto_price(final_exit),
        round_crypto_price(final_exit),
        now_iso,
        round(net_usd, 2),
        round(net_pct, 3),
        round(net_usd, 2),
        round(net_zar, 2),
        close_reason,
        trade_id,
    ))

    if str(t.get("mode", "PAPER")).upper() == "PAPER":
        proceeds_usd = final_exit * shares * (1.0 - fee_pct / 200.0)
        win_inc = 1 if net_usd > 0 else 0
        cur.execute("""
            UPDATE paper_wallet
            SET cash_balance_usd = cash_balance_usd + ?,
                realized_pnl_usd = realized_pnl_usd + ?,
                total_trades_closed = total_trades_closed + 1,
                winning_trades = winning_trades + ?,
                updated_at = ?
            WHERE id = 1
        """, (proceeds_usd, net_usd, win_inc, now_iso))

    conn.commit()
    updated = cur.execute("SELECT * FROM trades WHERE id = ?", (trade_id,)).fetchone()
    conn.close()
    return dict(updated) if updated else None


def get_capital_ledger(account_balance_zar: float = 10000.0, usdzar_rate: float = 18.18) -> Dict[str, Any]:
    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM capital_ledger WHERE id = 1").fetchone()
    starting_zar = float(row["starting_capital_zar"]) if row else float(account_balance_zar)
    if abs(starting_zar - 10000.0) < 1e-3 and account_balance_zar != 10000.0:
        starting_zar = float(account_balance_zar)

    open_rows = cur.execute("SELECT * FROM trades WHERE status = 'OPEN'").fetchall()
    closed_rows = cur.execute("SELECT * FROM trades WHERE status = 'CLOSED'").fetchall()

    realized_closed_zar = sum(float(r["realized_net_pnl_zar"] or 0.0) for r in closed_rows)
    realized_partial_zar = sum(float(r["realized_partial_pnl_zar"] or 0.0) for r in open_rows)
    ledger_realized = float(row["realized_pnl_zar"] or 0.0) if row else 0.0
    total_realized_zar = round(max(realized_closed_zar + realized_partial_zar, ledger_realized), 2)

    deployed_zar = 0.0
    for r in open_rows:
        rem_w = float(r["remaining_weight_pct"] if r["remaining_weight_pct"] is not None else 100.0) / 100.0
        pos_usd = float(r["entry_price"]) * float(r["shares"]) * rem_w
        deployed_zar += pos_usd * float(usdzar_rate)
    deployed_zar = round(deployed_zar, 2)

    total_equity_zar = round(starting_zar + total_realized_zar, 2)
    free_cash_zar = round(max(0.0, total_equity_zar - deployed_zar), 2)
    conn.close()
    return {
        "starting_capital_zar": round(starting_zar, 2),
        "realized_pnl_zar": total_realized_zar,
        "deployed_capital_zar": deployed_zar,
        "free_cash_zar": free_cash_zar,
        "total_equity_zar": total_equity_zar,
    }


def partial_close_position(
    position_id: int,
    tier: str = "TP1",
    execution_price: Optional[float] = None,
    usdzar_rate: float = 18.18,
) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM trades WHERE id = ? AND status = 'OPEN'", (position_id,)).fetchone()
    if not row:
        conn.close()
        return None
    t = dict(row)
    tier_up = (tier or "TP1").upper().strip()
    rem_pct = float(t.get("remaining_weight_pct") if t.get("remaining_weight_pct") is not None else 100.0)
    shares_now = float(t["shares"])
    entry = float(t["entry_price"])
    curr_p = float(execution_price) if (execution_price is not None and execution_price > 0) else float(t["current_price"])
    fee_pct = float(t.get("round_trip_fee_pct", DEFAULT_ROUND_TRIP_FEE_PCT))

    if tier_up == "TP3" or rem_pct <= 22.0:
        conn.close()
        return close_trade_by_id(
            trade_id=position_id,
            exit_price=curr_p,
            usdzar_rate=usdzar_rate,
            close_reason=f"PARTIAL_{tier_up}_FINAL_EXIT",
        )

    risk_dist = max(entry * 0.015, entry - float(t["stop_loss"]))
    fee_buffer = entry * (fee_pct / 100.0)
    be_lock_p = float(t.get("breakeven_lock_price") or round_crypto_price(entry + fee_buffer + entry * 0.0025))
    tp0_p = float(t.get("tp0_price") or round_crypto_price(entry + 0.65 * risk_dist + fee_buffer))
    tp1_p = float(t.get("tp1_price") or round_crypto_price(entry + 1.15 * risk_dist + fee_buffer))

    if tier_up == "TP0":
        close_fraction = 0.20
        new_rem_pct = 80.0
    elif tier_up == "TP1":
        close_fraction = 0.375 if rem_pct <= 82.0 else 0.30
        new_rem_pct = 50.0
    else:
        close_fraction = 0.60 if rem_pct <= 52.0 else 0.30
        new_rem_pct = 20.0

    shares_closed = round(shares_now * close_fraction, 6)
    shares_remaining = round(max(0.000001, shares_now - shares_closed), 6)

    gross_usd = (curr_p - entry) * shares_closed
    fees_usd = (entry * shares_closed + curr_p * shares_closed) * (fee_pct / 200.0)
    net_usd = gross_usd - fees_usd
    net_zar = round(net_usd * float(usdzar_rate), 2)
    prev_partial_zar = float(t.get("realized_partial_pnl_zar") or 0.0)

    tp0_flag = 1 if tier_up == "TP0" else int(t.get("tp0_hit") or 0)
    tp1_flag = 1 if tier_up == "TP1" else int(t.get("tp1_hit") or 0)
    tp2_flag = 1 if tier_up == "TP2" else int(t.get("tp2_hit") or 0)

    if tier_up == "TP0":
        new_stop = max(float(t["stop_loss"]), be_lock_p)
    elif tier_up == "TP1":
        tp0_flag = 1
        new_stop = max(float(t["stop_loss"]), be_lock_p, tp0_p)
    else:
        tp0_flag = 1
        tp1_flag = 1
        new_stop = max(float(t["stop_loss"]), be_lock_p, tp1_p)

    cur.execute(
        """
        UPDATE trades
        SET shares = ?,
            remaining_weight_pct = ?,
            realized_partial_pnl_zar = ?,
            tp0_hit = ?,
            tp1_hit = ?,
            tp2_hit = ?,
            stop_loss = ?,
            current_price = ?
        WHERE id = ?
        """,
        (
            shares_remaining,
            new_rem_pct,
            round(prev_partial_zar + net_zar, 2),
            tp0_flag,
            tp1_flag,
            tp2_flag,
            round_crypto_price(new_stop),
            round_crypto_price(curr_p),
            position_id,
        ),
    )
    cur.execute(
        """
        UPDATE capital_ledger
        SET realized_pnl_zar = COALESCE(realized_pnl_zar, 0.0) + ?,
            free_cash_zar = COALESCE(free_cash_zar, 10000.0) + ?,
            updated_at = datetime('now')
        WHERE id = 1
        """,
        (net_zar, round(entry * shares_closed * float(usdzar_rate) + net_zar, 2)),
    )
    conn.commit()
    updated = cur.execute("SELECT * FROM trades WHERE id = ?", (position_id,)).fetchone()
    conn.close()
    return dict(updated) if updated else None


def has_signal_alert_been_sent_today(ticker: str, alert_date: str) -> bool:
    conn = get_conn()
    row = conn.execute(
        "SELECT 1 FROM signal_alerts_log WHERE ticker = ? AND alert_date = ?",
        (ticker.upper().strip(), alert_date),
    ).fetchone()
    conn.close()
    return row is not None


def record_signal_alert_sent(ticker: str, alert_date: str, verdict: str, recommended_plan: str) -> None:
    conn = get_conn()
    conn.execute(
        """
        INSERT OR IGNORE INTO signal_alerts_log (ticker, alert_date, verdict, recommended_plan, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        """,
        (ticker.upper().strip(), alert_date, verdict, recommended_plan),
    )
    conn.commit()
    conn.close()


def get_trading_memory_log() -> Any:
    """Returns the persistent TradingMemoryLog instance for Crypto market."""
    from shared_core import TradingMemoryLog
    memory_db = os.path.join(DB_DIR, "trading_memory.db")
    return TradingMemoryLog(db_path=memory_db)


def fetch_bot_settings() -> Dict[str, Any]:
    """Fetch current autonomous trading bot configuration."""
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM bot_settings WHERE id = 1").fetchone()
    except sqlite3.OperationalError:
        conn.close()
        init_db()
        conn = get_conn()
        row = conn.execute("SELECT * FROM bot_settings WHERE id = 1").fetchone()
    conn.close()
    if row:
        return dict(row)
    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "id": 1,
        "enabled": 1,
        "mode": "PAPER",
        "max_active_positions": 3,
        "min_kelly_fraction_pct": 8.0,
        "eta_learning_rate": 0.08,
        "polling_interval_sec": 15,
        "auto_manage_coach": 1,
        "broker_profile": "BINANCE_BYBIT_VIP",
        "last_run_timestamp": None,
        "updated_at": now_iso,
    }


def save_bot_settings(
    enabled: Optional[bool] = None,
    mode: Optional[str] = None,
    max_active_positions: Optional[int] = None,
    min_kelly_fraction_pct: Optional[float] = None,
    eta_learning_rate: Optional[float] = None,
    polling_interval_sec: Optional[int] = None,
    auto_manage_coach: Optional[bool] = None,
    broker_profile: Optional[str] = None,
    last_run_timestamp: Optional[str] = None,
) -> Dict[str, Any]:
    """Update autonomous trading bot configuration."""
    current = fetch_bot_settings()
    new_enabled = int(enabled) if enabled is not None else current["enabled"]
    new_mode = mode.upper().strip() if mode is not None else current["mode"]
    new_max_pos = int(max_active_positions) if max_active_positions is not None else current["max_active_positions"]
    new_kelly = float(min_kelly_fraction_pct) if min_kelly_fraction_pct is not None else current["min_kelly_fraction_pct"]
    new_eta = float(eta_learning_rate) if eta_learning_rate is not None else current["eta_learning_rate"]
    new_interval = int(polling_interval_sec) if polling_interval_sec is not None else current["polling_interval_sec"]
    new_coach = int(auto_manage_coach) if auto_manage_coach is not None else current["auto_manage_coach"]
    new_profile = broker_profile.strip() if broker_profile is not None else current["broker_profile"]
    new_last_run = last_run_timestamp if last_run_timestamp is not None else current.get("last_run_timestamp")
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_conn()
    conn.execute("""
        INSERT INTO bot_settings (
            id, enabled, mode, max_active_positions, min_kelly_fraction_pct,
            eta_learning_rate, polling_interval_sec, auto_manage_coach, broker_profile,
            last_run_timestamp, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            enabled = excluded.enabled,
            mode = excluded.mode,
            max_active_positions = excluded.max_active_positions,
            min_kelly_fraction_pct = excluded.min_kelly_fraction_pct,
            eta_learning_rate = excluded.eta_learning_rate,
            polling_interval_sec = excluded.polling_interval_sec,
            auto_manage_coach = excluded.auto_manage_coach,
            broker_profile = excluded.broker_profile,
            last_run_timestamp = excluded.last_run_timestamp,
            updated_at = excluded.updated_at
    """, (
        new_enabled, new_mode, new_max_pos, new_kelly,
        new_eta, new_interval, new_coach, new_profile,
        new_last_run, now_iso
    ))
    conn.commit()
    conn.close()
    return fetch_bot_settings()


def insert_bot_audit_event(
    action_type: str,
    symbol: Optional[str] = None,
    trade_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Record an action into the bot audit log."""
    import json
    now_iso = datetime.now(timezone.utc).isoformat()
    det_json = json.dumps(details or {}, default=str)
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO bot_audit_log (timestamp, action_type, symbol, trade_id, details_json)
            VALUES (?, ?, ?, ?, ?)
        """, (now_iso, action_type, symbol, trade_id, det_json))
        conn.commit()
    except sqlite3.OperationalError:
        conn.close()
        init_db()
        conn = get_conn()
        conn.execute("""
            INSERT INTO bot_audit_log (timestamp, action_type, symbol, trade_id, details_json)
            VALUES (?, ?, ?, ?, ?)
        """, (now_iso, action_type, symbol, trade_id, det_json))
        conn.commit()
    conn.close()


def fetch_bot_audit_logs(limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve recent bot actions and learning events."""
    import json
    conn = get_conn()
    try:
        rows = conn.execute("""
            SELECT * FROM bot_audit_log ORDER BY id DESC LIMIT ?
        """, (limit,)).fetchall()
    except sqlite3.OperationalError:
        conn.close()
        init_db()
        conn = get_conn()
        rows = conn.execute("""
            SELECT * FROM bot_audit_log ORDER BY id DESC LIMIT ?
        """, (limit,)).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["details"] = json.loads(d.get("details_json") or "{}")
        except Exception:
            d["details"] = {}
        result.append(d)
    return result


def update_agent_weights(
    weights: Dict[str, float],
    brier_scores: Optional[Dict[str, float]] = None,
) -> None:
    """Update learned specialist agent weights and calibration scores in SQLite."""
    conn = get_conn()
    now_iso = datetime.now(timezone.utc).isoformat()
    for aid, w in weights.items():
        brier = (brier_scores or {}).get(aid)
        if brier is not None:
            conn.execute("""
                UPDATE agent_weights
                SET weight = ?, brier_score = (brier_score * 0.8) + (? * 0.2), samples = samples + 1, updated_at = ?
                WHERE agent_id = ?
            """, (float(w), float(brier), now_iso, aid))
        else:
            conn.execute("""
                UPDATE agent_weights
                SET weight = ?, samples = samples + 1, updated_at = ?
                WHERE agent_id = ?
            """, (float(w), now_iso, aid))
    conn.commit()
    conn.close()


def update_trade_mark_price(
    trade_id: int,
    current_price: float,
    new_stop_loss: Optional[float] = None,
    new_stage: Optional[int] = None,
) -> None:
    """Update live price, trailing stop loss, and coach stage for an active trade."""
    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT highest_price_seen, stop_loss FROM trades WHERE id = ?", (trade_id,)).fetchone()
    if row:
        curr_p = round_crypto_price(current_price)
        highest = max(float(row["highest_price_seen"] or curr_p), curr_p)
        stop = float(row["stop_loss"])
        if new_stop_loss is not None:
            stop = max(stop, round_crypto_price(new_stop_loss))
        if new_stage is not None:
            cur.execute("""
                UPDATE trades
                SET current_price = ?, highest_price_seen = ?, stop_loss = ?, current_stage = ?
                WHERE id = ?
            """, (curr_p, highest, stop, new_stage, trade_id))
        else:
            cur.execute("""
                UPDATE trades
                SET current_price = ?, highest_price_seen = ?, stop_loss = ?
                WHERE id = ?
            """, (curr_p, highest, stop, trade_id))
        conn.commit()
    conn.close()


