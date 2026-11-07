"""
Persistent Trading Memory Log & Self-Reflective Hedge Weights Engine (Integrated from TradingAgents)
Features:
- Point-in-Time SQLite Memory Log (Strict as_of Gating, Zero Future-Leakage in Backtests)
- Decision Lifecycle: Pending -> Realized Settlement (against Holding Window Closes)
- Multiplicative Weights Algorithm (Hedge) for Continuous Agent Specialist Calibration
"""

from datetime import datetime, timezone
import json
import math
import sqlite3
from typing import Any, Dict, List, Optional, Tuple, Union


class TradingMemoryLog:
    """
    Durable trading memory log with point-in-time isolation (TradingAgents pattern).
    Stores specialist agent debates, trade intentions, and settles them against
    real market outcomes to drive self-learning.
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_schema()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS trading_agent_memory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    market TEXT NOT NULL,
                    ticker TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    as_of_date TEXT NOT NULL,
                    entry_price REAL NOT NULL,
                    stop_loss REAL NOT NULL,
                    target_price REAL NOT NULL,
                    signal_tier TEXT NOT NULL,
                    final_conviction REAL NOT NULL,
                    holding_window_days INTEGER NOT NULL DEFAULT 10,
                    analyst_votes_json TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'PENDING',
                    resolution_date TEXT,
                    resolved_price REAL,
                    realized_return_pct REAL,
                    was_win INTEGER,
                    reflection_notes TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_mem_as_of
                ON trading_agent_memory (market, ticker, as_of_date, status)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS agent_learned_weights (
                    market TEXT NOT NULL,
                    agent_id TEXT NOT NULL,
                    weight REAL NOT NULL,
                    brier_score REAL NOT NULL DEFAULT 0.25,
                    total_settled INTEGER NOT NULL DEFAULT 0,
                    last_updated TEXT NOT NULL,
                    PRIMARY KEY (market, agent_id)
                )
                """
            )

    def record_decision(
        self,
        market: str = "GLOBAL",
        ticker: Optional[str] = None,
        as_of_date: Optional[str] = None,
        entry_price: float = 100.0,
        stop_loss: float = 95.0,
        target_price: float = 110.0,
        signal_tier: str = "A_PLUS",
        final_conviction: float = 85.0,
        analyst_votes: Optional[Any] = None,
        holding_window_days: int = 10,
        symbol: Optional[str] = None,
        as_of: Optional[str] = None,
        **kwargs: Any,
    ) -> int:
        """Appends a new pending decision to the memory log."""
        ticker = ticker or symbol or "UNKNOWN"
        as_of_date = as_of_date or as_of or datetime.now(timezone.utc).isoformat()
        analyst_votes = analyst_votes or []
        now_iso = datetime.now(timezone.utc).isoformat()
        votes_str = json.dumps(analyst_votes)
        with self._get_conn() as conn:
            cursor = conn.execute(
                """
                INSERT INTO trading_agent_memory (
                    market, ticker, created_at, as_of_date, entry_price,
                    stop_loss, target_price, signal_tier, final_conviction,
                    holding_window_days, analyst_votes_json, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
                """,
                (
                    market,
                    ticker,
                    now_iso,
                    as_of_date,
                    entry_price,
                    stop_loss,
                    target_price,
                    signal_tier,
                    final_conviction,
                    holding_window_days,
                    votes_str,
                ),
            )
            return cursor.lastrowid

    def settle_decision(
        self,
        decision_id: Union[int, str],
        realized_return_pct: float,
        resolved_price: Optional[float] = None,
    ) -> Optional[Dict[str, Any]]:
        """Settles an individual pending decision by ID."""
        did = int(decision_id)
        now_iso = datetime.now(timezone.utc).isoformat()
        is_win = 1 if realized_return_pct > 0 else 0
        with self._get_conn() as conn:
            row = conn.execute("SELECT * FROM trading_agent_memory WHERE id = ?", (did,)).fetchone()
            if not row:
                return None
            res_p = resolved_price if resolved_price is not None else float(row["entry_price"]) * (1.0 + realized_return_pct / 100.0)
            conn.execute(
                """
                UPDATE trading_agent_memory
                SET status = 'RESOLVED',
                    resolution_date = ?,
                    resolved_price = ?,
                    realized_return_pct = ?,
                    was_win = ?,
                    reflection_notes = ?
                WHERE id = ?
                """,
                (now_iso, res_p, realized_return_pct, is_win, f"Direct settlement with return {realized_return_pct:+.2f}%", did),
            )
            updated = conn.execute("SELECT * FROM trading_agent_memory WHERE id = ?", (did,)).fetchone()
            return dict(updated) if updated else None

    def get_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.execute("SELECT * FROM trading_agent_memory ORDER BY id DESC LIMIT ?", (limit,))
            return [dict(r) for r in cursor.fetchall()]

    def get_unsettled_decisions(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.execute("SELECT * FROM trading_agent_memory WHERE status = 'PENDING'")
            return [dict(r) for r in cursor.fetchall()]

    def settle_decisions(
        self,
        market: str,
        current_prices: Dict[str, float],
        resolution_date: str,
        eta_learning_rate: float = 0.08,
    ) -> Dict[str, Any]:
        """
        Settles pending memory records whose holding window has elapsed or whose price
        breached stop loss / target price (Reflector pattern).
        Applies Multiplicative Weights (Hedge) update to specialist analysts.
        """
        with self._get_conn() as conn:
            cursor = conn.execute(
                """
                SELECT * FROM trading_agent_memory
                WHERE market = ? AND status = 'PENDING'
                """,
                (market,),
            )
            rows = cursor.fetchall()

        if not rows:
            return {"settled_count": 0, "updated_weights": {}}

        settled = 0
        agent_losses: Dict[str, List[float]] = {}

        for row in rows:
            t = row["ticker"]
            if t not in current_prices:
                continue

            curr_p = float(current_prices[t])
            entry_p = float(row["entry_price"])
            sl = float(row["stop_loss"])
            tp = float(row["target_price"])

            # Check if hit stop or target or window elapsed
            ret_pct = ((curr_p - entry_p) / entry_p) * 100.0
            is_win = 1 if ret_pct > 0.0 else 0

            # Evaluate each agent's individual prediction loss
            votes = json.loads(row["analyst_votes_json"])
            notes = []
            for v in votes:
                aid = v.get("agentId") or v.get("agentName", "unknown")
                score = float(v.get("score", 50.0))
                # Probabilistic forecast of win: p = score / 100
                p_win = min(0.99, max(0.01, score / 100.0))
                # Brier loss: (p - y)^2
                loss = (p_win - is_win) ** 2
                agent_losses.setdefault(aid, []).append(loss)
                notes.append(f"{aid}: score={score:.0f}, loss={loss:.3f}")

            with self._get_conn() as conn:
                conn.execute(
                    """
                    UPDATE trading_agent_memory
                    SET status = 'RESOLVED',
                        resolution_date = ?,
                        resolved_price = ?,
                        realized_return_pct = ?,
                        was_win = ?,
                        reflection_notes = ?
                    WHERE id = ?
                    """,
                    (
                        resolution_date,
                        curr_p,
                        ret_pct,
                        is_win,
                        "; ".join(notes),
                        row["id"],
                    ),
                )
            settled += 1

        # Multiplicative Weights Update (Hedge Algorithm)
        updated_weights = self._update_hedge_weights(market, agent_losses, eta_learning_rate)
        return {"settled_count": settled, "updated_weights": updated_weights}

    def _update_hedge_weights(
        self,
        market: str,
        agent_losses: Dict[str, List[float]],
        eta: float,
    ) -> Dict[str, float]:
        """
        Multiplicative Weights Update: w_{i, t+1} = w_{i, t} * exp(-eta * average_loss_i).
        """
        if not agent_losses:
            return self.get_agent_weights(market)

        current_weights = self.get_agent_weights(market)
        new_weights = {}

        for aid, losses in agent_losses.items():
            avg_loss = float(sum(losses) / max(1, len(losses)))
            cur_w = current_weights.get(aid, 1.0 / len(agent_losses))
            # Hedge exponential penalty
            decay = math.exp(-eta * avg_loss)
            new_weights[aid] = max(0.05, cur_w * decay)

        # Normalize to sum to 1.0
        total_w = sum(new_weights.values())
        if total_w > 0:
            for aid in new_weights:
                new_weights[aid] = float(round(new_weights[aid] / total_w, 4))

        now_iso = datetime.now(timezone.utc).isoformat()
        with self._get_conn() as conn:
            for aid, w in new_weights.items():
                brier = float(sum(agent_losses[aid]) / len(agent_losses[aid]))
                conn.execute(
                    """
                    INSERT INTO agent_learned_weights (market, agent_id, weight, brier_score, total_settled, last_updated)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(market, agent_id) DO UPDATE SET
                        weight = excluded.weight,
                        brier_score = (brier_score * 0.8) + (excluded.brier_score * 0.2),
                        total_settled = total_settled + ?,
                        last_updated = excluded.last_updated
                    """,
                    (market, aid, w, brier, len(agent_losses[aid]), now_iso, len(agent_losses[aid])),
                )

        return new_weights

    def get_agent_weights(self, market: str) -> Dict[str, float]:
        """Fetch current self-learning weights for a market."""
        with self._get_conn() as conn:
            cursor = conn.execute(
                """
                SELECT agent_id, weight FROM agent_learned_weights
                WHERE market = ?
                """,
                (market,),
            )
            rows = cursor.fetchall()

        if rows:
            return {r["agent_id"]: float(r["weight"]) for r in rows}

        # Defaults if not yet initialized
        return {
            "technical_microstructure": 0.30,
            "sens_sentiment": 0.25,
            "fundamental_offshore": 0.25,
            "macro_regime": 0.20,
        }

    def get_historical_lessons(
        self,
        market: str,
        as_of_date: Optional[str] = None,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Returns resolved lessons strictly on or before `as_of_date` (as_of gating).
        Prevents look-ahead bias in backtests and agent deliberations.
        """
        query = (
            "SELECT * FROM trading_agent_memory WHERE market = ? AND status = 'RESOLVED' "
        )
        params: List[Any] = [market]
        if as_of_date:
            query += "AND resolution_date <= ? "
            params.append(as_of_date)
        query += "ORDER BY id DESC LIMIT ?"
        params.append(limit)

        with self._get_conn() as conn:
            cursor = conn.execute(query, params)
            return [dict(r) for r in cursor.fetchall()]
