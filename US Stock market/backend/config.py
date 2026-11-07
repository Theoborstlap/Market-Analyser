"""
US Quantitative Trading Coach 24/7 — V10.1 Sovereign R10k Compounding & Hyper-Execution Finale
NYSE & NASDAQ Institutional Configuration, Universe Map & Broker Friction Profiles
"""
import os
from typing import Dict, Any

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Ensure DB_PATH always resolves to ./US Stock market/backend/data/us_quant_coach.db
if os.path.basename(BASE_DIR) == "app":
    BACKEND_ROOT = os.path.dirname(BASE_DIR)
else:
    BACKEND_ROOT = BASE_DIR

DATA_DIR = os.path.join(BACKEND_ROOT, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "us_quant_coach.db")

BACKEND_PORT = 8001
FRONTEND_PORT = 5174

# ---------------------------------------------------------------------------
# US Broker Friction Profiles (Round-Trip Buy + Sell + SEC/TAF/Spread)
# ---------------------------------------------------------------------------
US_FEE_PROFILES: Dict[str, Dict[str, Any]] = {
    "EASYEQUITIES_USD": {
        "id": "EASYEQUITIES_USD",
        "label": "EasyEquities USD Wallet (about 1.29% Round-Trip, unverified)",
        "buy_brokerage_pct": 0.25,
        "sell_brokerage_pct": 0.25,
        "sec_taf_settlement_pct": 0.003,  # SEC/FINRA, sell side only (approx.)
        "admin_fee_pct_per_side": 0.31,  # P4_US_DATA_TRUTH: from user-supplied fee text, UNVERIFIED
        "vat_pct_per_side": 0.084,  # about 15% VAT on brokerage + admin, UNVERIFIED
        "spread_slippage_pct": 0.08,
        "round_trip_pct": 1.29,
        "fx_funding_spread_pct": 1.15,  # ZAR -> USD funding spread (informational)
        "description": "EasyEquities USD Account (UNVERIFIED, check a real statement): per side 0.25% brokerage + 0.31% admin + about 0.084% VAT, plus SEC/FINRA on sells = about 1.29% round trip. Bid/ask spread and FX conversion (about 0.5% + VAT each way, plus bank spread) are NOT included."
    },
    "US_ZERO_COMMISSION": {
        "id": "US_ZERO_COMMISSION",
        "label": "IBKR / Alpaca / Schwab (0.065% Round-Trip)",
        "buy_brokerage_pct": 0.005,
        "sell_brokerage_pct": 0.005,
        "sec_taf_settlement_pct": 0.005,
        "spread_slippage_pct": 0.05,
        "round_trip_pct": 0.065,
        "fx_funding_spread_pct": 0.15,
        "description": "Direct US Broker (IBKR Pro / Alpaca / Schwab): SEC ($27.80/$1M) + FINRA TAF + 5 bps tight NBBO spread = 0.065% Round-Trip"
    }
}

DEFAULT_FEE_PROFILE = "EASYEQUITIES_USD"
DEFAULT_ROUND_TRIP_FEE_PCT = 1.29  # P4_US_DATA_TRUTH: unverified estimate, see US_FEE_PROFILES

# P4_US_DATA_TRUTH: price-truth thresholds read by data_fetcher.py
US_MIN_REAL_BARS = 250
US_PRICE_STALE_DAYS = 5
US_PRICE_ANOMALY_PCT = 40.0
USDZAR_FALLBACK_RATE = 16.50

# ---------------------------------------------------------------------------
# 31 Core US NYSE & NASDAQ Institutional Universe + Twins + SEC CIKs
# ---------------------------------------------------------------------------
US_UNIVERSE_MAP: Dict[str, Dict[str, Any]] = {
    # Mega-Cap Tech & AI Semiconductors
    "NVDA":  {"name": "NVIDIA Corp.", "sector": "TECH_AI", "ref_price": 138.60, "twin": "AMD",   "cik": "0001045810", "exchange": "NASDAQ"},
    "AAPL":  {"name": "Apple Inc.", "sector": "TECH_AI", "ref_price": 228.40, "twin": "MSFT",  "cik": "0000320193", "exchange": "NASDAQ"},
    "MSFT":  {"name": "Microsoft Corp.", "sector": "TECH_AI", "ref_price": 426.80, "twin": "GOOGL", "cik": "0000789019", "exchange": "NASDAQ"},
    "AMZN":  {"name": "Amazon.com Inc.", "sector": "TECH_AI", "ref_price": 210.50, "twin": "META",  "cik": "0001018724", "exchange": "NASDAQ"},
    "META":  {"name": "Meta Platforms Inc.", "sector": "TECH_AI", "ref_price": 592.30, "twin": "GOOGL", "cik": "0001326801", "exchange": "NASDAQ"},
    "GOOGL": {"name": "Alphabet Inc.", "sector": "TECH_AI", "ref_price": 181.20, "twin": "META",  "cik": "0001652044", "exchange": "NASDAQ"},
    "TSLA":  {"name": "Tesla Inc.", "sector": "TECH_AI", "ref_price": 258.90, "twin": "QQQ",   "cik": "0001318605", "exchange": "NASDAQ"},
    "AMD":   {"name": "Advanced Micro Devices", "sector": "TECH_AI", "ref_price": 152.40, "twin": "NVDA",  "cik": "0000002488", "exchange": "NASDAQ"},
    "AVGO":  {"name": "Broadcom Inc.", "sector": "TECH_AI", "ref_price": 176.80, "twin": "SMH",   "cik": "0001730168", "exchange": "NASDAQ"},
    "PLTR":  {"name": "Palantir Technologies", "sector": "TECH_AI", "ref_price": 55.40,  "twin": "CRWD",  "cik": "0001321655", "exchange": "NYSE"},
    "NFLX":  {"name": "Netflix Inc.", "sector": "TECH_AI", "ref_price": 765.00, "twin": "META",  "cik": "0001065280", "exchange": "NASDAQ"},
    "CRWD":  {"name": "CrowdStrike Holdings", "sector": "TECH_AI", "ref_price": 328.50, "twin": "PLTR",  "cik": "0001535527", "exchange": "NASDAQ"},

    # Wall Street Financials, Healthcare & Industrials
    "JPM":   {"name": "JPMorgan Chase & Co.", "sector": "FINANCIALS", "ref_price": 236.40, "twin": "GS",    "cik": "0000019617", "exchange": "NYSE"},
    "GS":    {"name": "Goldman Sachs Group", "sector": "FINANCIALS", "ref_price": 548.20, "twin": "JPM",   "cik": "0000886982", "exchange": "NYSE"},
    "V":     {"name": "Visa Inc.", "sector": "FINANCIALS", "ref_price": 308.60, "twin": "JPM",   "cik": "0001403161", "exchange": "NYSE"},
    "BRK-B": {"name": "Berkshire Hathaway B", "sector": "FINANCIALS", "ref_price": 456.80, "twin": "XLF",   "cik": "0001067983", "exchange": "NYSE"},
    "LLY":   {"name": "Eli Lilly and Co.", "sector": "HEALTHCARE", "ref_price": 838.50, "twin": "XLV",   "cik": "0000059478", "exchange": "NYSE"},
    "UNH":   {"name": "UnitedHealth Group", "sector": "HEALTHCARE", "ref_price": 584.20, "twin": "XLV",   "cik": "0000731766", "exchange": "NYSE"},
    "COST":  {"name": "Costco Wholesale", "sector": "CONSUMER",   "ref_price": 918.40, "twin": "AMZN",  "cik": "0000909832", "exchange": "NASDAQ"},
    "CAT":   {"name": "Caterpillar Inc.", "sector": "INDUSTRIALS","ref_price": 388.70, "twin": "XLI",   "cik": "0000018230", "exchange": "NYSE"},
    "XOM":   {"name": "Exxon Mobil Corp.", "sector": "ENERGY",     "ref_price": 119.80, "twin": "XLE",   "cik": "0000034088", "exchange": "NYSE"},

    # Core Benchmark & Sector Rotation ETFs
    "SPY":   {"name": "SPDR S&P 500 ETF", "sector": "SECTOR_ETF", "ref_price": 586.40, "twin": "QQQ",   "cik": "0000884394", "exchange": "NYSE"},
    "QQQ":   {"name": "Invesco QQQ Trust", "sector": "SECTOR_ETF", "ref_price": 502.80, "twin": "SPY",   "cik": "0001067839", "exchange": "NASDAQ"},
    "IWM":   {"name": "iShares Russell 2000", "sector": "SECTOR_ETF", "ref_price": 226.50, "twin": "SPY",   "cik": "0001100663", "exchange": "NYSE"},
    "SMH":   {"name": "VanEck Semiconductor ETF", "sector": "SECTOR_ETF", "ref_price": 254.20, "twin": "NVDA",  "cik": "0001137360", "exchange": "NASDAQ"},
    "XLK":   {"name": "Technology Select SPDR", "sector": "SECTOR_ETF", "ref_price": 232.10, "twin": "QQQ",   "cik": "0001064641", "exchange": "NYSE"},
    "XLF":   {"name": "Financial Select SPDR", "sector": "SECTOR_ETF", "ref_price": 48.60,  "twin": "JPM",   "cik": "0001064641", "exchange": "NYSE"},
    "XLE":   {"name": "Energy Select SPDR", "sector": "SECTOR_ETF", "ref_price": 91.40,  "twin": "XOM",   "cik": "0001064641", "exchange": "NYSE"},
    "XLV":   {"name": "Health Care Select SPDR", "sector": "SECTOR_ETF", "ref_price": 148.90, "twin": "LLY",   "cik": "0001064641", "exchange": "NYSE"},
    "XLI":   {"name": "Industrial Select SPDR", "sector": "SECTOR_ETF", "ref_price": 138.20, "twin": "CAT",   "cik": "0001064641", "exchange": "NYSE"},
    "GLD":   {"name": "SPDR Gold Shares ETF", "sector": "SECTOR_ETF", "ref_price": 254.80, "twin": "SPY",   "cik": "0001222333", "exchange": "NYSE"},
}

US_ETFS = {"SPY", "QQQ", "IWM", "SMH", "XLK", "XLF", "XLE", "XLV", "XLI", "GLD", "DIA", "TLT", "SLV", "ARKK"}
SAFE_ANCHOR_TICKERS = {"GLD", "SPY", "QQQ", "BRK-B", "COST", "JPM", "V", "MSFT", "AAPL", "XLK", "XLF", "XLV", "XLI"}


def is_us_etf(symbol: str) -> bool:
    clean = symbol.upper().strip()
    if clean in US_ETFS:
        return True
    meta = US_UNIVERSE_MAP.get(clean, {})
    return meta.get("sector") == "SECTOR_ETF" or "ETF" in meta.get("name", "").upper()


def is_safe_anchor(symbol: str) -> bool:
    clean = symbol.upper().strip()
    return clean in SAFE_ANCHOR_TICKERS or is_us_etf(clean)
