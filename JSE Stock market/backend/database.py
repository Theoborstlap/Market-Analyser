"""Idempotent SQLite Database Engine for jse-quant-coach-247 V12.0 ("The Sovereign Omega 12/12 Finale" — ./data/jse_quant_coach.db)."""

import os
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "jse_quant_coach.db")


SEED_DEMO_DATA = False  # V13 SEED PATCH: demo trade/wallet seeding is OFF. Do not set to True.


def get_connection() -> sqlite3.Connection:
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_column(cur: sqlite3.Cursor, table: str, col_name: str, col_def: str) -> None:
    cur.execute(f"PRAGMA table_info({table})")
    existing = {row["name"] for row in cur.fetchall()}
    if col_name not in existing:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}")


def init_db() -> None:
    conn = get_connection()
    cur = conn.cursor()

    table_schema_sql = """
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        sector TEXT NOT NULL DEFAULT 'JSE_CUSTOM',
        trade_mode TEXT NOT NULL DEFAULT 'REAL_BROKER_TRADE',
        fee_profile TEXT NOT NULL DEFAULT 'EASYEQUITIES_ZAR',
        status TEXT NOT NULL DEFAULT 'OPEN',
        shares REAL NOT NULL DEFAULT 1.0,
        initial_shares REAL NOT NULL DEFAULT 1.0,
        entry_price_zar REAL NOT NULL,
        current_price_zar REAL NOT NULL,
        highest_price_zar REAL NOT NULL,
        stop_loss_zar REAL NOT NULL,
        target_price_zar REAL NOT NULL,
        target_net_pct REAL NOT NULL DEFAULT 8.0,
        target_gross_pct REAL NOT NULL DEFAULT 9.0,
        invested_capital_zar REAL NOT NULL DEFAULT 0.0,
        realized_pnl_zar REAL NOT NULL DEFAULT 0.0,
        realized_net_pnl_zar REAL NOT NULL DEFAULT 0.0,
        realized_net_pnl_pct REAL NOT NULL DEFAULT 0.0,
        exit_price REAL,
        exit_price_zar REAL,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        close_reason TEXT DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        scale_out_25_done INTEGER NOT NULL DEFAULT 0,
        scale_out_50_done INTEGER NOT NULL DEFAULT 0,
        tp1_price_zar REAL NOT NULL DEFAULT 0.0,
        tp2_price_zar REAL NOT NULL DEFAULT 0.0,
        tp3_price_zar REAL NOT NULL DEFAULT 0.0,
        tp0_hit INTEGER NOT NULL DEFAULT 0,
        tp1_hit INTEGER NOT NULL DEFAULT 0,
        tp2_hit INTEGER NOT NULL DEFAULT 0,
        tp3_hit INTEGER NOT NULL DEFAULT 0,
        remaining_weight_pct REAL NOT NULL DEFAULT 100.0,
        realized_partial_pnl_zar REAL NOT NULL DEFAULT 0.0,
        limit_created_at TEXT DEFAULT NULL,
        limit_ttl_hours INTEGER NOT NULL DEFAULT 8,
        tp0_price REAL NOT NULL DEFAULT 0.0,
        breakeven_lock_price REAL NOT NULL DEFAULT 0.0,
        tp1_price REAL NOT NULL DEFAULT 0.0,
        tp2_price REAL NOT NULL DEFAULT 0.0,
        tp3_price REAL NOT NULL DEFAULT 0.0,
        recommended_entry_plan TEXT NOT NULL DEFAULT 'PLAN_A_MARKET',
        chandelier_multiplier_atr REAL NOT NULL DEFAULT 1.25
    """

    cur.execute(f"CREATE TABLE IF NOT EXISTS portfolio ({table_schema_sql})")
    cur.execute(f"CREATE TABLE IF NOT EXISTS trades ({table_schema_sql})")
    cur.execute(f"CREATE TABLE IF NOT EXISTS positions ({table_schema_sql})")

    for tbl in ("portfolio", "trades", "positions"):
        _ensure_column(cur, tbl, "realized_net_pnl_zar", "REAL NOT NULL DEFAULT 0.0")
        _ensure_column(cur, tbl, "realized_net_pnl_pct", "REAL NOT NULL DEFAULT 0.0")
        _ensure_column(cur, tbl, "exit_price", "REAL")
        _ensure_column(cur, tbl, "exit_price_zar", "REAL")
        _ensure_column(cur, tbl, "closed_at", "TEXT")
        _ensure_column(cur, tbl, "close_reason", "TEXT DEFAULT ''")
        _ensure_column(cur, tbl, "scale_out_25_done", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(cur, tbl, "scale_out_50_done", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(cur, tbl, "tp1_price_zar", "REAL NOT NULL DEFAULT 0.0")
        _ensure_column(cur, tbl, "tp2_price_zar", "REAL NOT NULL DEFAULT 0.0")
        _ensure_column(cur, tbl, "tp3_price_zar", "REAL NOT NULL DEFAULT 0.0")
        _ensure_column(cur, tbl, "tp0_hit", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(cur, tbl, "tp1_hit", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(cur, tbl, "tp2_hit", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(cur, tbl, "tp3_hit", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(cur, tbl, "remaining_weight_pct", "REAL NOT NULL DEFAULT 100.0")
        _ensure_column(cur, tbl, "realized_partial_pnl_zar", "REAL NOT NULL DEFAULT 0.0")
        _ensure_column(cur, tbl, "limit_created_at", "TEXT DEFAULT NULL")
        _ensure_column(cur, tbl, "limit_ttl_hours", "INTEGER NOT NULL DEFAULT 8")
        _ensure_column(cur, tbl, "tp0_price", "REAL NOT NULL DEFAULT 0.0")
        _ensure_column(cur, tbl, "breakeven_lock_price", "REAL NOT NULL DEFAULT 0.0")
        _ensure_column(cur, tbl, "tp1_price", "REAL NOT NULL DEFAULT 0.0")
        _ensure_column(cur, tbl, "tp2_price", "REAL NOT NULL DEFAULT 0.0")
        _ensure_column(cur, tbl, "tp3_price", "REAL NOT NULL DEFAULT 0.0")
        _ensure_column(cur, tbl, "recommended_entry_plan", "TEXT NOT NULL DEFAULT 'PLAN_A_MARKET'")
        _ensure_column(cur, tbl, "chandelier_multiplier_atr", "REAL NOT NULL DEFAULT 1.25")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS custom_watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            sector TEXT NOT NULL DEFAULT 'JSE_CUSTOM',
            stt_exempt INTEGER NOT NULL DEFAULT 0,
            ref_price_zar REAL NOT NULL DEFAULT 100.0,
            added_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS paper_wallet (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            cash_balance_zar REAL NOT NULL DEFAULT 10000.0,
            initial_capital_zar REAL NOT NULL DEFAULT 10000.0,
            selected_fee_profile TEXT NOT NULL DEFAULT 'EASYEQUITIES_ZAR'
        )
        """
    )
    cur.execute(
        """
        INSERT OR IGNORE INTO paper_wallet (id, cash_balance_zar, initial_capital_zar, selected_fee_profile)
        VALUES (1, 10000.0, 10000.0, 'EASYEQUITIES_ZAR')
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS capital_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL DEFAULT 'LEDGER_UPDATE',
            ticker TEXT NOT NULL DEFAULT '',
            trade_id INTEGER,
            delta_cash_zar REAL NOT NULL DEFAULT 0.0,
            starting_capital_zar REAL NOT NULL DEFAULT 10000.0,
            free_cash_zar REAL NOT NULL DEFAULT 10000.0,
            free_cash_balance_zar REAL NOT NULL DEFAULT 10000.0,
            deployed_capital_zar REAL NOT NULL DEFAULT 0.0,
            locked_capital_zar REAL NOT NULL DEFAULT 0.0,
            realized_pnl_zar REAL NOT NULL DEFAULT 0.0,
            realized_net_pnl_zar REAL NOT NULL DEFAULT 0.0,
            notes TEXT NOT NULL DEFAULT '',
            updated_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    _ensure_column(cur, "capital_ledger", "starting_capital_zar", "REAL NOT NULL DEFAULT 10000.0")
    _ensure_column(cur, "capital_ledger", "free_cash_zar", "REAL NOT NULL DEFAULT 10000.0")
    _ensure_column(cur, "capital_ledger", "deployed_capital_zar", "REAL NOT NULL DEFAULT 0.0")
    _ensure_column(cur, "capital_ledger", "realized_pnl_zar", "REAL NOT NULL DEFAULT 0.0")
    _ensure_column(cur, "capital_ledger", "updated_at", "TEXT")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS signal_alerts_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_date TEXT NOT NULL,
            ticker TEXT NOT NULL,
            verdict TEXT DEFAULT 'A+_SNIPER_BUY',
            recommended_plan TEXT DEFAULT 'PLAN_A_MARKET',
            alert_type TEXT NOT NULL DEFAULT 'A+_SNIPER_BUY_12_12',
            recommended_entry_plan TEXT NOT NULL DEFAULT 'PLAN_A_MARKET',
            entry_price_zar REAL NOT NULL DEFAULT 0.0,
            limit_dip_price_zar REAL NOT NULL DEFAULT 0.0,
            bocpd_at_alert REAL NOT NULL DEFAULT 0.0,
            cancel_sent INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            UNIQUE(alert_date, ticker, alert_type)
        )
        """
    )
    _ensure_column(cur, "signal_alerts_log", "verdict", "TEXT DEFAULT 'A+_SNIPER_BUY'")
    _ensure_column(cur, "signal_alerts_log", "recommended_plan", "TEXT DEFAULT 'PLAN_A_MARKET'")
    _ensure_column(cur, "signal_alerts_log", "recommended_entry_plan", "TEXT NOT NULL DEFAULT 'PLAN_A_MARKET'")
    _ensure_column(cur, "signal_alerts_log", "entry_price_zar", "REAL NOT NULL DEFAULT 0.0")
    _ensure_column(cur, "signal_alerts_log", "limit_dip_price_zar", "REAL NOT NULL DEFAULT 0.0")
    _ensure_column(cur, "signal_alerts_log", "bocpd_at_alert", "REAL NOT NULL DEFAULT 0.0")
    _ensure_column(cur, "signal_alerts_log", "cancel_sent", "INTEGER NOT NULL DEFAULT 0")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS shadow_signals_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            entry_price REAL NOT NULL DEFAULT 0.0,
            limit_dip_price REAL NOT NULL DEFAULT 0.0,
            stop_loss REAL NOT NULL DEFAULT 0.0,
            tp0_price REAL NOT NULL DEFAULT 0.0,
            tp1_price REAL NOT NULL DEFAULT 0.0,
            tp2_price REAL NOT NULL DEFAULT 0.0,
            tp3_price REAL NOT NULL DEFAULT 0.0,
            calibrated_win_prob_pct REAL NOT NULL DEFAULT 80.0,
            outcome_status TEXT NOT NULL DEFAULT 'PENDING'
        )
        """
    )
    _ensure_column(cur, "shadow_signals_log", "tp0_price", "REAL NOT NULL DEFAULT 0.0")
    _ensure_column(cur, "shadow_signals_log", "tp1_price", "REAL NOT NULL DEFAULT 0.0")
    _ensure_column(cur, "shadow_signals_log", "tp2_price", "REAL NOT NULL DEFAULT 0.0")
    _ensure_column(cur, "shadow_signals_log", "tp3_price", "REAL NOT NULL DEFAULT 0.0")
    _ensure_column(cur, "shadow_signals_log", "outcome_status", "TEXT NOT NULL DEFAULT 'PENDING'")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS shadow_signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            signal_tier TEXT NOT NULL,
            entry_price_zar REAL NOT NULL,
            target_price_zar REAL NOT NULL,
            stop_loss_zar REAL NOT NULL,
            target_net_pct REAL NOT NULL,
            conviction_score REAL NOT NULL,
            tech_score REAL NOT NULL,
            sens_score REAL NOT NULL,
            offshore_score REAL NOT NULL,
            macro_score REAL NOT NULL,
            outcome_status TEXT NOT NULL DEFAULT 'PENDING',
            logged_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS agent_weights (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            technical_microstructure_weight REAL NOT NULL DEFAULT 0.31,
            sens_sentiment_weight REAL NOT NULL DEFAULT 0.26,
            fundamental_offshore_sotp_weight REAL NOT NULL DEFAULT 0.25,
            macro_commodity_sarb_weight REAL NOT NULL DEFAULT 0.18,
            total_graded_signals INTEGER NOT NULL DEFAULT 24,
            win_rate_pct REAL NOT NULL DEFAULT 75.0
        )
        """
    )
    cur.execute(
        """
        INSERT OR IGNORE INTO agent_weights (
            id, technical_microstructure_weight, sens_sentiment_weight,
            fundamental_offshore_sotp_weight, macro_commodity_sarb_weight,
            total_graded_signals, win_rate_pct
        ) VALUES (1, 0.31, 0.26, 0.25, 0.18, 0, 0.0)
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS alert_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            macos_desktop_enabled INTEGER NOT NULL DEFAULT 1,
            telegram_enabled INTEGER NOT NULL DEFAULT 1,
            telegram_bot_token TEXT NOT NULL DEFAULT '9177348992:AAFLFS3NCJt36HIu72A3IZxU0Dguw-tvpjo',
            telegram_chat_id TEXT NOT NULL DEFAULT '5953317572',
            morning_briefing_enabled INTEGER NOT NULL DEFAULT 1,
            last_update_id INTEGER NOT NULL DEFAULT 0,
            last_briefing_date TEXT NOT NULL DEFAULT '',
            discord_enabled INTEGER NOT NULL DEFAULT 0,
            discord_webhook_url TEXT NOT NULL DEFAULT '',
            alert_on_prime_alpha INTEGER NOT NULL DEFAULT 1,
            alert_on_offshore_arb INTEGER NOT NULL DEFAULT 1,
            alert_on_sens_pead INTEGER NOT NULL DEFAULT 1,
            alert_on_coach_stages INTEGER NOT NULL DEFAULT 1
        )
        """
    )
    _ensure_column(cur, "alert_settings", "morning_briefing_enabled", "INTEGER NOT NULL DEFAULT 1")
    _ensure_column(cur, "alert_settings", "last_update_id", "INTEGER NOT NULL DEFAULT 0")
    _ensure_column(cur, "alert_settings", "last_briefing_date", "TEXT NOT NULL DEFAULT ''")
    _ensure_column(cur, "alert_settings", "alert_on_prime_alpha", "INTEGER NOT NULL DEFAULT 1")
    _ensure_column(cur, "alert_settings", "alert_on_offshore_arb", "INTEGER NOT NULL DEFAULT 1")
    _ensure_column(cur, "alert_settings", "alert_on_sens_pead", "INTEGER NOT NULL DEFAULT 1")
    _ensure_column(cur, "alert_settings", "alert_on_coach_stages", "INTEGER NOT NULL DEFAULT 1")

    cur.execute(
        """
        INSERT OR IGNORE INTO alert_settings (id, macos_desktop_enabled, telegram_enabled, telegram_bot_token, telegram_chat_id, morning_briefing_enabled)
        VALUES (1, 1, 1, '9177348992:AAFLFS3NCJt36HIu72A3IZxU0Dguw-tvpjo', '5953317572', 1)
        """
    )
    cur.execute(
        """
        UPDATE alert_settings
        SET telegram_enabled = 1,
            telegram_bot_token = '9177348992:AAFLFS3NCJt36HIu72A3IZxU0Dguw-tvpjo',
            telegram_chat_id = '5953317572'
        WHERE id = 1 AND (telegram_bot_token = '' OR telegram_chat_id = '')
        """
    )

    # Seed initial positions if portfolio/trades are empty
    cur.execute("SELECT COUNT(*) AS cnt FROM portfolio")
    cnt = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) AS cnt_t FROM trades")
    cnt_t = cur.fetchone()["cnt_t"]

    if SEED_DEMO_DATA and cnt == 0 and cnt_t == 0:  # V13 SEED PATCH
        now = datetime.utcnow()
        open_1 = (now - timedelta(days=2)).isoformat()
        open_2 = (now - timedelta(days=4)).isoformat()
        open_3 = (now - timedelta(days=7)).isoformat()
        closed_3 = (now - timedelta(days=1)).isoformat()

        seed_rows = [
            (
                "NPN.JO", "Naspers Ltd", "TECH_TENCENT", "REAL_BROKER_TRADE", "EASYEQUITIES_ZAR",
                "OPEN", 0.85, 0.85, 4026.00, 4185.00, 4218.50, 3845.00, 4425.00, 8.98, 9.91,
                3422.10, 0.0, 0.0, 0.0, None, None, open_1, None, "",
                "Tencent 0700.HK SOTP catch-up + 3/3 Fractal Alignment entry on EasyEquities ZAR", 0, 0,
                4252.25, 4425.00, 4557.75, 0, 0, 0, "PLAN_A_MARKET", 1.25
            ),
            (
                "STXNDQ.JO", "Satrix NASDAQ 100 ETF", "JSE_ETF_TFSA", "REAL_BROKER_TRADE", "EASYEQUITIES_TFSA",
                "OPEN", 21.1864, 21.1864, 204.50, 212.40, 214.10, 196.80, 224.80, 9.38, 9.93,
                4332.62, 0.0, 0.0, 0.0, None, None, open_2, None, "",
                "45% Barbell Anchor — 0% STT TFSA Eligibility", 0, 0,
                214.13, 224.80, 231.54, 0, 0, 0, "PLAN_A_MARKET", 1.25
            ),
            (
                "SHP.JO", "Shoprite Holdings", "SA_INC_RETAIL", "REAL_BROKER_TRADE", "EASYEQUITIES_ZAR",
                "CLOSED", 12.0, 12.0, 274.60, 298.50, 298.50, 262.25, 298.50, 7.77, 8.70,
                3295.20, 256.14, 256.14, 7.77, 298.50, 298.50, open_3, closed_3, "TARGET_HIT_STAGE_6",
                "SENS >20% HEPS trading statement PEAD drift target harvested at Stage 6", 1, 1,
                290.04, 298.50, 307.46, 1, 1, 0, "PLAN_A_MARKET", 0.85
            ),
        ]
        insert_sql = """
            INSERT INTO {table} (
                ticker, name, sector, trade_mode, fee_profile, status,
                shares, initial_shares, entry_price_zar, current_price_zar, highest_price_zar,
                stop_loss_zar, target_price_zar, target_net_pct, target_gross_pct,
                invested_capital_zar, realized_pnl_zar, realized_net_pnl_zar, realized_net_pnl_pct,
                exit_price, exit_price_zar, opened_at, closed_at, close_reason,
                notes, scale_out_25_done, scale_out_50_done,
                tp1_price_zar, tp2_price_zar, tp3_price_zar, tp1_hit, tp2_hit, tp3_hit,
                recommended_entry_plan, chandelier_multiplier_atr
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        for r in seed_rows:
            cur.execute(insert_sql.format(table="portfolio"), r)
            cur.execute(insert_sql.format(table="trades"), r)
    elif cnt == 0 and cnt_t > 0:
        cur.execute("INSERT INTO portfolio SELECT * FROM trades")
    elif cnt > 0 and cnt_t == 0:
        cur.execute("INSERT INTO trades SELECT * FROM portfolio")

    # Ensure existing rows have sensible TP0/TP1/TP2/TP3 values if 0.0
    cur.execute(
        """
        UPDATE portfolio
        SET tp0_price = ROUND(entry_price_zar + 0.65 * MAX(0.5, entry_price_zar - stop_loss_zar), 2),
            breakeven_lock_price = ROUND(entry_price_zar * 1.0089, 2),
            tp1_price_zar = ROUND(entry_price_zar + 1.15 * MAX(0.5, entry_price_zar - stop_loss_zar), 2),
            tp1_price = ROUND(entry_price_zar + 1.15 * MAX(0.5, entry_price_zar - stop_loss_zar), 2),
            tp2_price_zar = ROUND(target_price_zar, 2),
            tp2_price = ROUND(target_price_zar, 2),
            tp3_price_zar = ROUND(target_price_zar * 1.03, 2),
            tp3_price = ROUND(target_price_zar * 1.03, 2)
        WHERE tp1_price_zar <= 0.0 OR tp2_price_zar <= 0.0 OR tp0_price <= 0.0
           OR tp0_price IS NULL OR breakeven_lock_price IS NULL OR tp0_hit IS NULL
        """
    )
    cur.execute(
        """
        UPDATE portfolio
        SET tp0_hit = COALESCE(tp0_hit, 0),
            tp1_hit = COALESCE(tp1_hit, 0),
            tp2_hit = COALESCE(tp2_hit, 0),
            tp3_hit = COALESCE(tp3_hit, 0),
            remaining_weight_pct = COALESCE(remaining_weight_pct, 100.0),
            realized_partial_pnl_zar = COALESCE(realized_partial_pnl_zar, 0.0),
            recommended_entry_plan = COALESCE(recommended_entry_plan, 'PLAN_A_MARKET'),
            chandelier_multiplier_atr = COALESCE(chandelier_multiplier_atr, 1.25)
        """
    )
    cur.execute("PRAGMA table_info(portfolio)")
    p_cols = [r["name"] for r in cur.fetchall()]
    cols_csv = ", ".join(p_cols)
    cur.execute("DELETE FROM positions")
    cur.execute(f"INSERT INTO positions ({cols_csv}) SELECT {cols_csv} FROM portfolio")

    # Seed capital_ledger if empty
    cur.execute("SELECT COUNT(*) AS cnt_l FROM capital_ledger")
    cnt_l = cur.fetchone()["cnt_l"]
    if cnt_l == 0:
        now_iso = datetime.utcnow().isoformat()
        cur.execute(
            """
            INSERT INTO capital_ledger (
                event_type, ticker, trade_id, delta_cash_zar,
                starting_capital_zar, free_cash_zar, free_cash_balance_zar,
                deployed_capital_zar, locked_capital_zar, realized_pnl_zar, realized_net_pnl_zar,
                notes, updated_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "INITIAL_DEPOSIT",
                "ZAR_CASH",
                None,
                10000.0,
                10000.0,
                10000.0,
                10000.0,
                0.0,
                0.0,
                0.0,
                0.0,
                "Initial R10,000.00 clean start (no trades)",  # V13 SEED PATCH
                now_iso,
                now_iso,
            ),
        )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS core_holdings (
            symbol TEXT PRIMARY KEY,
            shares REAL NOT NULL DEFAULT 0,
            avg_cost_zar REAL,
            updated_at TEXT
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS core_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS risk_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT,
            symbol TEXT,
            side TEXT,
            amount_zar REAL,
            decision TEXT,
            reasons TEXT
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS paper_prices (
            bar_date TEXT,
            symbol TEXT,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            PRIMARY KEY(bar_date, symbol)
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS paper_core_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS paper_signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            signal_bar_date TEXT,
            symbol TEXT,
            entry_bar_date TEXT,
            entry_price REAL,
            target_price REAL,
            stop_price REAL,
            horizon_days INTEGER,
            stated_win_prob_pct REAL,
            base_rate_pct REAL,
            engine_version TEXT,
            status TEXT,
            graded_bar_date TEXT,
            exit_price REAL,
            net_return_pct REAL,
            UNIQUE(signal_bar_date, symbol)
        )
        """
    )

    conn.commit()
    conn.close()


def insert_paper_price(
    bar_date: str,
    symbol: str,
    open_price: Optional[float],
    high_price: Optional[float],
    low_price: Optional[float],
    close_price: Optional[float],
) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR IGNORE INTO paper_prices (bar_date, symbol, open, high, low, close)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (bar_date, symbol, open_price, high_price, low_price, close_price),
    )
    inserted = cur.rowcount > 0
    conn.commit()
    conn.close()
    return inserted


def get_paper_prices(symbol: Optional[str] = None) -> List[Dict[str, Any]]:
    if symbol:
        return fetch_all_dict(
            "SELECT bar_date, symbol, open, high, low, close FROM paper_prices WHERE symbol = ? ORDER BY bar_date ASC",
            (symbol,),
        )
    return fetch_all_dict(
        "SELECT bar_date, symbol, open, high, low, close FROM paper_prices ORDER BY bar_date ASC, symbol ASC"
    )


def get_paper_core_meta(key: str, default: Optional[str] = None) -> Optional[str]:
    rows = fetch_all_dict("SELECT value FROM paper_core_meta WHERE key = ? LIMIT 1", (key,))
    if not rows or rows[0].get("value") is None:
        return default
    return str(rows[0]["value"])


def set_paper_core_meta(key: str, value: Any, overwrite: bool = False) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    if overwrite:
        cur.execute(
            "INSERT INTO paper_core_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (str(key), str(value)),
        )
    else:
        cur.execute(
            "INSERT OR IGNORE INTO paper_core_meta (key, value) VALUES (?, ?)",
            (str(key), str(value)),
        )
    changed = cur.rowcount > 0
    conn.commit()
    conn.close()
    return changed


def insert_paper_signal(
    signal_bar_date: str,
    symbol: str,
    target_price: float,
    stop_price: float,
    horizon_days: int,
    stated_win_prob_pct: Optional[float] = None,
    base_rate_pct: Optional[float] = None,
    engine_version: str = "v13-unvalidated",
    status: str = "PENDING_ENTRY",
    entry_bar_date: Optional[str] = None,
    entry_price: Optional[float] = None,
    graded_bar_date: Optional[str] = None,
    exit_price: Optional[float] = None,
    net_return_pct: Optional[float] = None,
) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR IGNORE INTO paper_signals (
            signal_bar_date, symbol, entry_bar_date, entry_price,
            target_price, stop_price, horizon_days, stated_win_prob_pct,
            base_rate_pct, engine_version, status, graded_bar_date,
            exit_price, net_return_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            signal_bar_date,
            symbol,
            entry_bar_date,
            entry_price,
            target_price,
            stop_price,
            int(horizon_days),
            stated_win_prob_pct,
            base_rate_pct,
            engine_version,
            status,
            graded_bar_date,
            exit_price,
            net_return_pct,
        ),
    )
    inserted = cur.rowcount > 0
    conn.commit()
    conn.close()
    return inserted


def get_paper_signals(statuses: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    if statuses:
        placeholders = ", ".join("?" for _ in statuses)
        return fetch_all_dict(
            f"SELECT * FROM paper_signals WHERE status IN ({placeholders}) ORDER BY signal_bar_date ASC, id ASC",
            tuple(statuses),
        )
    return fetch_all_dict("SELECT * FROM paper_signals ORDER BY signal_bar_date ASC, id ASC")


def activate_paper_signal_entry(
    signal_id: int,
    entry_bar_date: str,
    entry_price: float,
    target_price: float,
    stop_price: float,
) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE paper_signals
        SET entry_bar_date = ?,
            entry_price = ?,
            target_price = ?,
            stop_price = ?,
            status = 'OPEN'
        WHERE id = ? AND status = 'PENDING_ENTRY' AND entry_bar_date IS NULL
        """,
        (entry_bar_date, entry_price, target_price, stop_price, int(signal_id)),
    )
    updated = cur.rowcount > 0
    conn.commit()
    conn.close()
    return updated


def update_paper_signal_grading(
    signal_id: int,
    status: str,
    graded_bar_date: Optional[str] = None,
    exit_price: Optional[float] = None,
    net_return_pct: Optional[float] = None,
) -> bool:
    """Update ONLY the grading fields (status, graded_bar_date, exit_price, net_return_pct) and only while status is 'OPEN' or 'PENDING_ENTRY'."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE paper_signals
        SET status = ?,
            graded_bar_date = ?,
            exit_price = ?,
            net_return_pct = ?
        WHERE id = ? AND status IN ('OPEN', 'PENDING_ENTRY')
        """,
        (status, graded_bar_date, exit_price, net_return_pct, int(signal_id)),
    )
    updated = cur.rowcount > 0
    conn.commit()
    conn.close()
    return updated


def fetch_all_dict(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(query, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def sync_portfolio_and_trades(conn: Optional[sqlite3.Connection] = None) -> None:
    """Keep `portfolio`, `trades`, and `positions` tables mirrored so any endpoint or query sees identical state."""
    own_conn = conn is None
    if own_conn:
        conn = get_connection()
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(portfolio)")
    p_cols = [r["name"] for r in cur.fetchall()]
    cols_csv = ", ".join(p_cols)
    cur.execute("DELETE FROM trades")
    cur.execute(f"INSERT INTO trades ({cols_csv}) SELECT {cols_csv} FROM portfolio")
    cur.execute("DELETE FROM positions")
    cur.execute(f"INSERT INTO positions ({cols_csv}) SELECT {cols_csv} FROM portfolio")
    if own_conn:
        conn.commit()
        conn.close()


def get_free_cash_ledger(
    initial_capital_override: Optional[float] = None,
    conn: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """
    Live SQLite Free-Cash Ledger (`capital_ledger`):
    Tracks initial capital, realized net P&L, capital locked in open positions,
    free cash available for immediate execution, and 20% dry powder reserve.
    """
    if conn is not None:
        cur = conn.cursor()
        cur.execute("SELECT * FROM paper_wallet WHERE id = 1")
        wallet_rows = [dict(r) for r in cur.fetchall()]
        cur.execute("SELECT * FROM portfolio ORDER BY id DESC")
        all_trades = [dict(r) for r in cur.fetchall()]
        cur.execute("SELECT * FROM capital_ledger ORDER BY id DESC LIMIT 30")
        ledger_rows = [dict(r) for r in cur.fetchall()]
    else:
        wallet_rows = fetch_all_dict("SELECT * FROM paper_wallet WHERE id = 1")
        all_trades = fetch_all_dict("SELECT * FROM portfolio ORDER BY id DESC")
        ledger_rows = fetch_all_dict("SELECT * FROM capital_ledger ORDER BY id DESC LIMIT 30")

    w = wallet_rows[0] if wallet_rows else {"initial_capital_zar": 10000.0, "cash_balance_zar": 10000.0}
    initial_capital_zar = float(initial_capital_override or w.get("initial_capital_zar") or 10000.0)

    open_trades = [r for r in all_trades if str(r.get("status", "OPEN")).upper() == "OPEN"]
    closed_trades = [r for r in all_trades if str(r.get("status", "OPEN")).upper() == "CLOSED"]

    # Total realized net P&L across closed trades AND partial take-profits on open trades
    realized_closed_zar = sum(
        float(r.get("realized_net_pnl_zar") or r.get("realized_pnl_zar") or 0.0)
        for r in closed_trades
    )
    realized_partial_open_zar = sum(
        float(r.get("realized_net_pnl_zar") or r.get("realized_pnl_zar") or 0.0)
        for r in open_trades
    )
    total_realized_net_pnl_zar = round(realized_closed_zar + realized_partial_open_zar, 2)

    total_compounded_equity_zar = round(initial_capital_zar + total_realized_net_pnl_zar, 2)
    locked_in_open_positions_zar = round(
        sum(float(r.get("shares", 0.0)) * float(r.get("entry_price_zar", 0.0)) for r in open_trades),
        2,
    )
    free_cash_available_zar = round(max(0.0, total_compounded_equity_zar - locked_in_open_positions_zar), 2)
    reserved_dry_powder_zar = round(total_compounded_equity_zar * 0.20, 2)
    deployable_sniper_cash_zar = round(max(0.0, free_cash_available_zar), 2)

    return {
        "starting_capital_zar": round(initial_capital_zar, 2),
        "initial_capital_zar": round(initial_capital_zar, 2),
        "initialCapitalZar": round(initial_capital_zar, 2),
        "realized_pnl_zar": total_realized_net_pnl_zar,
        "realized_net_pnl_zar": total_realized_net_pnl_zar,
        "realizedNetPnlZar": total_realized_net_pnl_zar,
        "total_compounded_equity_zar": total_compounded_equity_zar,
        "totalCompoundedEquityZar": total_compounded_equity_zar,
        "locked_in_open_positions_zar": locked_in_open_positions_zar,
        "lockedInOpenPositionsZar": locked_in_open_positions_zar,
        "deployed_capital_zar": locked_in_open_positions_zar,
        "deployedCapitalZar": locked_in_open_positions_zar,
        "free_cash_available_zar": free_cash_available_zar,
        "freeCashAvailableZar": free_cash_available_zar,
        "free_cash_zar": free_cash_available_zar,
        "freeCashZar": free_cash_available_zar,
        "reserved_dry_powder_zar": reserved_dry_powder_zar,
        "reservedDryPowderZar": reserved_dry_powder_zar,
        "deployable_sniper_cash_zar": deployable_sniper_cash_zar,
        "deployableSniperCashZar": deployable_sniper_cash_zar,
        "open_positions_count": len(open_trades),
        "ledger_entries": ledger_rows,
        "ledgerEntries": ledger_rows,
    }


def record_capital_ledger_entry(
    event_type: str,
    ticker: str,
    trade_id: Optional[int],
    delta_cash_zar: float,
    realized_net_pnl_zar: float = 0.0,
    notes: str = "",
    conn: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """Append an immutable audit row to `capital_ledger` and return updated Free-Cash Ledger state."""
    own_conn = conn is None
    if own_conn:
        conn = get_connection()
    summary_before = get_free_cash_ledger(conn=conn)
    free_cash_after = round(max(0.0, summary_before["free_cash_available_zar"]), 2)
    locked_after = round(summary_before["locked_in_open_positions_zar"], 2)
    now_iso = datetime.utcnow().isoformat()

    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO capital_ledger (
            event_type, ticker, trade_id, delta_cash_zar, free_cash_balance_zar,
            locked_capital_zar, realized_net_pnl_zar, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_type,
            ticker,
            trade_id,
            round(delta_cash_zar, 2),
            free_cash_after,
            locked_after,
            round(realized_net_pnl_zar, 2),
            notes,
            now_iso,
        ),
    )
    if own_conn:
        conn.commit()
        conn.close()
        return get_free_cash_ledger()
    return get_free_cash_ledger(conn=conn)


def close_trade_by_id(
    id_or_symbol: Any,
    exit_price_zar: float,
    friction_pct: float,
    close_reason: str = "MANUAL_CLOSE",
) -> Dict[str, Any]:
    """
    Idempotent full close in ONE SQLite transaction:
    - Updates portfolio row conditionally on status = 'OPEN'.
    - Checks cursor.rowcount; if 0 rows changed, writes NO ledger row and returns ALREADY_CLOSED.
    - Mirrors trades/positions and appends capital_ledger row in the same transaction.
    """
    conn = get_connection()
    cur = conn.cursor()
    row = None
    try:
        tid = int(id_or_symbol)
        cur.execute("SELECT * FROM portfolio WHERE id = ?", (tid,))
        row = cur.fetchone()
    except (ValueError, TypeError):
        sym = str(id_or_symbol).strip().upper()
        if not sym.endswith(".JO"):
            sym = f"{sym}.JO"
        cur.execute("SELECT * FROM portfolio WHERE ticker = ? ORDER BY id DESC LIMIT 1", (sym,))
        row = cur.fetchone()

    if not row:
        conn.close()
        return {"ok": False, "error": "Trade not found"}

    trade = dict(row)
    tid = int(trade["id"])
    if str(trade.get("status", "")).upper() != "OPEN":
        conn.close()
        return {"ok": False, "error": "ALREADY_CLOSED", "code": "ALREADY_CLOSED", "id": tid}

    ticker = str(trade["ticker"])
    entry = float(trade["entry_price_zar"])
    shares = float(trade["shares"])
    prior_partial_pnl = float(trade.get("realized_net_pnl_zar") or trade.get("realized_pnl_zar") or 0.0)
    exit_price = round(float(exit_price_zar), 2)

    gross_pct = ((exit_price - entry) / max(0.01, entry)) * 100.0
    realized_net_pnl_pct = round(gross_pct - friction_pct, 2)
    gross_zar = shares * (exit_price - entry)
    fee_zar = (shares * entry) * (friction_pct / 100.0)
    final_leg_net_pnl_zar = round(gross_zar - fee_zar, 2)
    total_realized_net_pnl_zar = round(prior_partial_pnl + final_leg_net_pnl_zar, 2)
    closed_at = datetime.utcnow().isoformat()
    proceeds = round(shares * exit_price - fee_zar, 2)

    cur.execute(
        """
        UPDATE portfolio SET
            status = 'CLOSED',
            current_price_zar = ?,
            exit_price = ?,
            exit_price_zar = ?,
            closed_at = ?,
            realized_pnl_zar = ?,
            realized_net_pnl_zar = ?,
            realized_net_pnl_pct = ?,
            close_reason = ?
        WHERE id = ? AND status = 'OPEN'
        """,
        (
            exit_price,
            exit_price,
            exit_price,
            closed_at,
            total_realized_net_pnl_zar,
            total_realized_net_pnl_zar,
            realized_net_pnl_pct,
            close_reason,
            tid,
        ),
    )
    if cur.rowcount == 0:
        conn.rollback()
        conn.close()
        return {"ok": False, "error": "ALREADY_CLOSED", "code": "ALREADY_CLOSED", "id": tid}

    if "PAPER" in str(trade.get("trade_mode", "")).upper():
        cur.execute("UPDATE paper_wallet SET cash_balance_zar = cash_balance_zar + ? WHERE id = 1", (proceeds,))

    sync_portfolio_and_trades(conn=conn)
    record_capital_ledger_entry(
        event_type="FULL_CLOSE_POSITION",
        ticker=ticker,
        trade_id=tid,
        delta_cash_zar=proceeds,
        realized_net_pnl_zar=final_leg_net_pnl_zar,
        notes=f"Closed {shares:.4f} sh @ R{exit_price:.2f} ({close_reason}) -> Total Realized Net P&L R{total_realized_net_pnl_zar:+.2f}",
        conn=conn,
    )
    conn.commit()
    conn.close()
    return {
        "ok": True,
        "id": tid,
        "ticker": ticker,
        "status": "CLOSED",
        "exit_price": exit_price,
        "closed_at": closed_at,
        "realized_net_pnl_pct": realized_net_pnl_pct,
        "realized_net_pnl_zar": total_realized_net_pnl_zar,
        "close_reason": close_reason,
    }


def partial_close_or_scale_out_trade(
    trade_id: int,
    exec_price_zar: float,
    friction_pct: float,
    tier: Optional[str] = None,
    quantity_override: Optional[float] = None,
    percentage_override: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Idempotent partial close / scale-out in ONE SQLite transaction:
    - Conditional UPDATE on status = 'OPEN' and checks cursor.rowcount; if 0 rows changed, writes NO ledger row and returns ALREADY_CLOSED.
    - Refuses a quantity larger than the remaining quantity (shares).
    - Mirrors trades/positions and appends capital_ledger row in the same transaction.
    """
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM portfolio WHERE id = ?", (trade_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return {"ok": False, "error": f"Position #{trade_id} not found"}

    trade = dict(row)
    if str(trade.get("status", "")).upper() != "OPEN":
        conn.close()
        return {"ok": False, "error": "ALREADY_CLOSED", "code": "ALREADY_CLOSED", "id": trade_id}

    ticker = str(trade["ticker"])
    entry = float(trade["entry_price_zar"])
    shares = float(trade["shares"])
    if shares <= 0:
        conn.close()
        return {"ok": False, "error": "ALREADY_CLOSED", "code": "ALREADY_CLOSED", "id": trade_id}

    if quantity_override is not None and float(quantity_override) > shares + 1e-9:
        conn.close()
        return {"ok": False, "error": "QUANTITY_EXCEEDS_REMAINING", "code": "QUANTITY_EXCEEDS_REMAINING", "id": trade_id}

    initial_sh = float(trade.get("initial_shares") or shares)
    stop = float(trade["stop_loss_zar"])
    risk_dist = max(0.25, abs(entry - stop))
    exec_price = round(float(exec_price_zar), 2)

    tp0_p = float(trade.get("tp0_price") or round(entry * (1.0 + friction_pct / 100.0) + 0.65 * risk_dist, 2))
    be_lock_p = float(trade.get("breakeven_lock_price") or round(entry * (1.0 + friction_pct / 100.0 + 0.0015), 2))
    tp1_p = float(trade.get("tp1_price_zar") or trade.get("tp1_price") or round(entry + 1.25 * risk_dist, 2))

    resolved_tier = str(
        tier or ("TP0" if not trade.get("tp0_hit") else ("TP1" if not trade.get("tp1_hit") else "TP2"))
    ).upper()

    rem_w = float(trade.get("remaining_weight_pct") if trade.get("remaining_weight_pct") is not None else 100.0)
    if rem_w <= 0:
        conn.close()
        return {"ok": False, "error": "ALREADY_CLOSED", "code": "ALREADY_CLOSED", "id": trade_id}

    tp0_hit = int(trade.get("tp0_hit") or 0)
    tp1_hit = int(trade.get("tp1_hit") or 0)
    tp2_hit = int(trade.get("tp2_hit") or 0)
    tp3_hit = int(trade.get("tp3_hit") or 0)
    scale_25 = int(trade.get("scale_out_25_done") or 0)
    scale_50 = int(trade.get("scale_out_50_done") or 0)
    new_status = "OPEN"

    if percentage_override is not None and float(percentage_override) > 100.0:
        conn.close()
        return {"ok": False, "error": "QUANTITY_EXCEEDS_REMAINING", "code": "QUANTITY_EXCEEDS_REMAINING", "id": trade_id}

    if resolved_tier == "TP0":
        close_w = min(rem_w, 20.0)
        new_rem_w = max(0.0, rem_w - close_w)
        tp0_hit = 1
        new_stop = max(stop, be_lock_p)
    elif resolved_tier == "TP1":
        close_w = min(rem_w, 30.0)
        new_rem_w = max(0.0, rem_w - close_w)
        tp0_hit = 1
        tp1_hit = 1
        scale_25 = 1
        new_stop = max(stop, be_lock_p, tp0_p)
    elif resolved_tier == "TP2":
        close_w = min(rem_w, 30.0)
        new_rem_w = max(0.0, rem_w - close_w)
        tp0_hit = 1
        tp1_hit = 1
        tp2_hit = 1
        scale_50 = 1
        new_stop = max(stop, be_lock_p, tp1_p)
    else:
        close_w = rem_w
        new_rem_w = 0.0
        tp0_hit = 1
        tp1_hit = 1
        tp2_hit = 1
        tp3_hit = 1
        new_stop = max(stop, tp1_p)
        new_status = "CLOSED"

    if quantity_override is not None:
        shares_sold = round(float(quantity_override), 4)
        if shares_sold > shares + 1e-9:
            conn.close()
            return {"ok": False, "error": "QUANTITY_EXCEEDS_REMAINING", "code": "QUANTITY_EXCEEDS_REMAINING", "id": trade_id}
        frac = shares_sold / max(shares, 1e-6)
        if shares - shares_sold <= 1e-6:
            new_status = "CLOSED"
            new_rem_w = 0.0
    else:
        frac = (close_w / max(rem_w, 1e-6)) if rem_w > 0 else 0.25
        shares_sold = round(shares * frac, 4)
        if shares_sold > shares:
            shares_sold = shares

    remaining_shares = round(max(0.0, shares - shares_sold), 4) if new_status == "OPEN" else 0.0
    if remaining_shares <= 0.0:
        new_status = "CLOSED"
        new_rem_w = 0.0
    remaining_invested_zar = round(remaining_shares * entry, 2)

    leg_entry_val = shares_sold * entry
    leg_exit_val = shares_sold * exec_price
    leg_fee_zar = leg_entry_val * (friction_pct / 100.0)
    leg_net_pnl_zar = round((leg_exit_val - leg_entry_val) - leg_fee_zar, 2)
    freed_cash_zar = round(leg_entry_val + leg_net_pnl_zar, 2)

    prev_realized_zar = float(trade.get("realized_net_pnl_zar") or trade.get("realized_pnl_zar") or 0.0)
    new_realized_zar = round(prev_realized_zar + leg_net_pnl_zar, 2)
    new_realized_pct = round((new_realized_zar / max(1.0, initial_sh * entry)) * 100.0, 2)

    cur.execute(
        """
        UPDATE portfolio SET
            status = ?,
            shares = ?,
            invested_capital_zar = ?,
            current_price_zar = ?,
            highest_price_zar = MAX(highest_price_zar, ?),
            stop_loss_zar = ?,
            realized_pnl_zar = ?,
            realized_net_pnl_zar = ?,
            realized_net_pnl_pct = ?,
            realized_partial_pnl_zar = ?,
            remaining_weight_pct = ?,
            scale_out_25_done = ?,
            scale_out_50_done = ?,
            tp0_hit = ?,
            tp1_hit = ?,
            tp2_hit = ?,
            tp3_hit = ?,
            chandelier_multiplier_atr = 0.85
        WHERE id = ? AND status = 'OPEN'
        """,
        (
            new_status,
            remaining_shares,
            remaining_invested_zar,
            exec_price,
            exec_price,
            new_stop,
            new_realized_zar,
            new_realized_zar,
            new_realized_pct,
            new_realized_zar,
            new_rem_w,
            scale_25,
            scale_50,
            tp0_hit,
            tp1_hit,
            tp2_hit,
            tp3_hit,
            trade_id,
        ),
    )
    if cur.rowcount == 0:
        conn.rollback()
        conn.close()
        return {"ok": False, "error": "ALREADY_CLOSED", "code": "ALREADY_CLOSED", "id": trade_id}

    if "PAPER" in str(trade.get("trade_mode", "")).upper():
        cur.execute("UPDATE paper_wallet SET cash_balance_zar = cash_balance_zar + ? WHERE id = 1", (freed_cash_zar,))

    sync_portfolio_and_trades(conn=conn)
    ledger_state = record_capital_ledger_entry(
        event_type=f"PARTIAL_CLOSE_{resolved_tier}",
        ticker=ticker,
        trade_id=trade_id,
        delta_cash_zar=freed_cash_zar,
        realized_net_pnl_zar=leg_net_pnl_zar,
        notes=f"Banked {close_w:.0f}% ({shares_sold:.4f} sh) @ R{exec_price:.2f} -> Net P&L R{leg_net_pnl_zar:+.2f}, Stop locked @ R{new_stop:.2f}",
        conn=conn,
    )
    conn.commit()
    conn.close()
    return {
        "ok": True,
        "id": trade_id,
        "ticker": ticker,
        "tier": resolved_tier,
        "status": new_status,
        "fraction_closed": round(frac, 4),
        "shares_sold": shares_sold,
        "remaining_shares": remaining_shares,
        "remaining_weight_pct": new_rem_w,
        "execution_price_zar": exec_price,
        "realized_net_pnl_delta_zar": leg_net_pnl_zar,
        "cumulative_realized_net_pnl_zar": new_realized_zar,
        "new_stop_loss_zar": new_stop,
        "freed_cash_zar": freed_cash_zar,
        "capital_ledger": ledger_state,
    }


def get_core_holdings() -> List[Dict[str, Any]]:
    init_db()
    return fetch_all_dict("SELECT symbol, shares, avg_cost_zar, updated_at FROM core_holdings ORDER BY symbol ASC")


def set_core_holdings(holdings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    init_db()
    now_iso = datetime.utcnow().isoformat()
    conn = get_connection()
    cur = conn.cursor()
    for item in holdings:
        sym = str(item.get("symbol", "")).strip().upper()
        shares = float(item.get("shares", 0.0))
        avg_cost = item.get("avg_cost_zar")
        avg_cost_val = float(avg_cost) if avg_cost is not None else None
        cur.execute(
            """
            INSERT INTO core_holdings (symbol, shares, avg_cost_zar, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(symbol) DO UPDATE SET
                shares = excluded.shares,
                avg_cost_zar = excluded.avg_cost_zar,
                updated_at = excluded.updated_at
            """,
            (sym, shares, avg_cost_val, now_iso),
        )
    conn.commit()
    conn.close()
    return get_core_holdings()


def get_core_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    init_db()
    rows = fetch_all_dict("SELECT value FROM core_settings WHERE key = ? LIMIT 1", (key,))
    if not rows:
        return default
    return rows[0].get("value")


def set_core_setting(key: str, value: Any) -> None:
    init_db()
    conn = get_connection()
    cur = conn.cursor()
    val_str = None if value is None else str(value)
    cur.execute(
        """
        INSERT INTO core_settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (key, val_str),
    )
    conn.commit()
    conn.close()


def log_risk_event(
    symbol: str,
    side: str,
    amount_zar: float,
    decision: str,
    reasons: List[str],
    ts: Optional[str] = None,
) -> int:
    init_db()
    import json as _json
    ts_val = ts or datetime.utcnow().isoformat()
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO risk_events (ts, symbol, side, amount_zar, decision, reasons)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            ts_val,
            str(symbol or "").strip().upper(),
            str(side or "BUY").strip().upper(),
            round(float(amount_zar or 0.0), 2),
            str(decision or "PASS").strip().upper(),
            _json.dumps(list(reasons or [])),
        ),
    )
    rid = int(cur.lastrowid or 0)
    conn.commit()
    conn.close()
    return rid


def count_orders_today(today_prefix: Optional[str] = None) -> int:
    init_db()
    prefix = today_prefix or datetime.utcnow().strftime("%Y-%m-%d")
    rows = fetch_all_dict(
        "SELECT COUNT(*) AS cnt FROM portfolio WHERE substr(opened_at, 1, 10) = ?",
        (prefix,),
    )
    return int(rows[0]["cnt"]) if rows else 0


def recent_duplicate_exists(symbol: str, window_min: int = 10) -> bool:
    init_db()
    clean = (symbol or "").strip().upper()
    if clean and not clean.endswith(".JO"):
        clean_jo = f"{clean}.JO"
    else:
        clean_jo = clean
    cutoff = (datetime.utcnow() - timedelta(minutes=int(window_min))).isoformat()
    rows = fetch_all_dict(
        """
        SELECT id FROM portfolio
        WHERE (UPPER(ticker) = ? OR UPPER(ticker) = ?)
          AND opened_at >= ?
        LIMIT 1
        """,
        (clean, clean_jo, cutoff),
    )
    return len(rows) > 0


def has_signal_alert_been_sent_today(
    alert_date: str,
    ticker: str,
    alert_type: str = "A+_SNIPER_BUY_12_12",
) -> bool:
    rows = fetch_all_dict(
        "SELECT id FROM signal_alerts_log WHERE alert_date = ? AND ticker = ? AND alert_type = ? LIMIT 1",
        (alert_date, ticker, alert_type),
    )
    return len(rows) > 0


def record_signal_alert_sent(
    alert_date: str,
    ticker: str,
    alert_type: str = "A+_SNIPER_BUY_12_12",
    recommended_entry_plan: str = "PLAN_A_MARKET",
    entry_price_zar: float = 0.0,
    limit_dip_price_zar: float = 0.0,
    bocpd_at_alert: float = 0.0,
) -> None:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR IGNORE INTO signal_alerts_log (
            alert_date, ticker, alert_type, recommended_entry_plan,
            entry_price_zar, limit_dip_price_zar, bocpd_at_alert, cancel_sent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        """,
        (
            alert_date,
            ticker,
            alert_type,
            recommended_entry_plan,
            round(entry_price_zar, 2),
            round(limit_dip_price_zar, 2),
            round(bocpd_at_alert, 1),
            datetime.utcnow().isoformat(),
        ),
    )
    conn.commit()
    conn.close()


def get_active_plan_b_alerts_for_cancel_check(alert_date: str) -> List[Dict[str, Any]]:
    return fetch_all_dict(
        """
        SELECT * FROM signal_alerts_log
        WHERE alert_date = ?
          AND cancel_sent = 0
          AND recommended_entry_plan IN ('PLAN_B_LIMIT_DIP', 'PLAN_C_50_50_SPLIT')
        """,
        (alert_date,),
    )


def mark_signal_alert_cancelled(alert_id: int) -> None:
    conn = get_connection()
    conn.execute("UPDATE signal_alerts_log SET cancel_sent = 1 WHERE id = ?", (alert_id,))
    conn.commit()
    conn.close()


def get_trading_memory_log() -> Any:
    """Returns the persistent TradingMemoryLog instance for JSE market."""
    from shared_core import TradingMemoryLog
    memory_db = os.path.join(DB_DIR, "trading_memory.db")
    return TradingMemoryLog(db_path=memory_db)
