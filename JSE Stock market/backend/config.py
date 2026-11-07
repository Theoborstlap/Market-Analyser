"""Canonical JSE Universe (Core equities + TFSA ETFs), Offshore Parity Map & JSE Fee/Tax Profiles (V9.0 + V10.1)."""

from typing import Any, Dict

# Tickers that were renamed on the JSE / Yahoo Finance. Legacy symbols (e.g. stored in the
# custom watchlist or the trade log) are mapped to the live symbol.
TICKER_RENAMES: Dict[str, str] = {
    "DIVTRX.JO": "STXDIV.JO",  # Satrix DIVI Plus ETF: DIVTRX.JO has no Yahoo data, STXDIV.JO is live
}

# Symbols whose single-bar moves can legitimately exceed PRICE_ANOMALY_PCT (volatility indices).
# They are exempt from the single-bar anomaly guard and the Hampel outlier scrubber.
ANOMALY_EXEMPT_SYMBOLS = {"^VIX"}

TFSA_ELIGIBLE_ETFS = {
    "STXNDQ.JO",
    "SYG500.JO",
    "STX40.JO",
    "GLD.JO",
    "CSP500.JO",
    "DIVTRX.JO",
    "STXDIV.JO",
}

JSE_UNIVERSE_MAP: Dict[str, Dict[str, Any]] = {
    # 1. TENCENT / GLOBAL TECH PROXIES (TECH_TENCENT)
    "NPN.JO": {"name": "Naspers Ltd", "sector": "TECH_TENCENT", "twin": "PRX.JO", "offshore": "0700.HK", "offshore_ccy": "HKD", "stt_exempt": False, "is_top40": True, "refPriceZar": 4185.0},
    "PRX.JO": {"name": "Prosus N.V.", "sector": "TECH_TENCENT", "twin": "NPN.JO", "offshore": "PRX.AS", "offshore_ccy": "EUR", "stt_exempt": False, "is_top40": True, "refPriceZar": 768.5},

    # 2. DUAL-LISTED GLOBAL & RAND-HEDGE GIANTS (RAND_HEDGE)
    "CFR.JO": {"name": "Compagnie Financière Richemont", "sector": "RAND_HEDGE", "twin": "BTI.JO", "offshore": "CFR.SW", "offshore_ccy": "CHF", "stt_exempt": False, "is_top40": True, "refPriceZar": 2895.0},
    "BTI.JO": {"name": "British American Tobacco", "sector": "RAND_HEDGE", "twin": "ANH.JO", "offshore": "BTI", "offshore_ccy": "USD", "stt_exempt": False, "is_top40": True, "refPriceZar": 672.4},
    "ANH.JO": {"name": "Anheuser-Busch InBev", "sector": "RAND_HEDGE", "twin": "BTI.JO", "offshore": "BUD", "offshore_ccy": "USD", "stt_exempt": False, "is_top40": True, "refPriceZar": 1125.0},
    "BID.JO": {"name": "Bid Corporation (Bidcorp)", "sector": "RAND_HEDGE", "twin": "BVT.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 452.8},
    "MNP.JO": {"name": "Mondi plc", "sector": "RAND_HEDGE", "twin": "SAP.JO", "offshore": "MNDI.L", "offshore_ccy": "GBp", "stt_exempt": False, "is_top40": True, "refPriceZar": 318.5},

    # 3. GOLD & PGM PRECIOUS METAL MINERS (PRECIOUS_MINER)
    "GFI.JO": {"name": "Gold Fields Ltd", "sector": "PRECIOUS_MINER", "twin": "ANG.JO", "offshore": "GFI", "offshore_ccy": "USD", "stt_exempt": False, "is_top40": True, "refPriceZar": 342.6},
    "ANG.JO": {"name": "AngloGold Ashanti", "sector": "PRECIOUS_MINER", "twin": "GFI.JO", "offshore": "AU", "offshore_ccy": "USD", "stt_exempt": False, "is_top40": True, "refPriceZar": 538.2},
    "HAR.JO": {"name": "Harmony Gold Mining", "sector": "PRECIOUS_MINER", "twin": "GFI.JO", "offshore": "HMY", "offshore_ccy": "USD", "stt_exempt": False, "is_top40": True, "refPriceZar": 214.5},
    "IMP.JO": {"name": "Impala Platinum (Implats)", "sector": "PRECIOUS_MINER", "twin": "SSW.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 108.4},
    "SSW.JO": {"name": "Sibanye-Stillwater", "sector": "PRECIOUS_MINER", "twin": "IMP.JO", "offshore": "SBSW", "offshore_ccy": "USD", "stt_exempt": False, "is_top40": True, "refPriceZar": 21.85},
    "VAL.JO": {"name": "Valterra Platinum (Amplats)", "sector": "PRECIOUS_MINER", "twin": "IMP.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 645.0},
    "NPH.JO": {"name": "Northam Platinum", "sector": "PRECIOUS_MINER", "twin": "IMP.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 129.6},

    # 4. DIVERSIFIED MINERS, COMMODITIES & ENERGY (COMMODITY_MINER)
    "BHG.JO": {"name": "BHP Group Ltd", "sector": "COMMODITY_MINER", "twin": "AGL.JO", "offshore": "BHP", "offshore_ccy": "USD", "stt_exempt": False, "is_top40": True, "refPriceZar": 512.0},
    "AGL.JO": {"name": "Anglo American plc", "sector": "COMMODITY_MINER", "twin": "BHG.JO", "offshore": "AAL.L", "offshore_ccy": "GBp", "stt_exempt": False, "is_top40": True, "refPriceZar": 564.5},
    "GLN.JO": {"name": "Glencore plc", "sector": "COMMODITY_MINER", "twin": "AGL.JO", "offshore": "GLEN.L", "offshore_ccy": "GBp", "stt_exempt": False, "is_top40": True, "refPriceZar": 94.2},
    "KIO.JO": {"name": "Kumba Iron Ore", "sector": "COMMODITY_MINER", "twin": "EXX.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": False, "refPriceZar": 368.0},
    "EXX.JO": {"name": "Exxaro Resources", "sector": "COMMODITY_MINER", "twin": "KIO.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 174.5},
    "SOL.JO": {"name": "Sasol Ltd", "sector": "COMMODITY_MINER", "twin": "EXX.JO", "offshore": "SSL", "offshore_ccy": "USD", "stt_exempt": False, "is_top40": True, "refPriceZar": 98.4},
    "SAP.JO": {"name": "Sappi Ltd", "sector": "COMMODITY_MINER", "twin": "MNP.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": False, "refPriceZar": 49.8},

    # 5. SA BANKS, INSURERS & FINANCIALS (SA_INC_FIN)
    "FSR.JO": {"name": "FirstRand Ltd", "sector": "SA_INC_FIN", "twin": "SBK.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 78.6},
    "SBK.JO": {"name": "Standard Bank Group", "sector": "SA_INC_FIN", "twin": "FSR.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 242.5},
    "CPI.JO": {"name": "Capitec Bank Holdings", "sector": "SA_INC_FIN", "twin": "FSR.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 3145.0},
    "ABG.JO": {"name": "Absa Group Ltd", "sector": "SA_INC_FIN", "twin": "NED.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 178.4},
    "NED.JO": {"name": "Nedbank Group", "sector": "SA_INC_FIN", "twin": "ABG.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 294.2},
    "INL.JO": {"name": "Investec Ltd", "sector": "SA_INC_FIN", "twin": "INP.JO", "offshore": "INVP.L", "offshore_ccy": "GBp", "stt_exempt": False, "is_top40": True, "refPriceZar": 136.8},
    "INP.JO": {"name": "Investec plc", "sector": "SA_INC_FIN", "twin": "INL.JO", "offshore": "INVP.L", "offshore_ccy": "GBp", "stt_exempt": False, "is_top40": True, "refPriceZar": 138.1},
    "SLM.JO": {"name": "Sanlam Ltd", "sector": "SA_INC_FIN", "twin": "DSY.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 88.9},
    "DSY.JO": {"name": "Discovery Ltd", "sector": "SA_INC_FIN", "twin": "SLM.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 194.5},
    "OUT.JO": {"name": "OUTsurance Group", "sector": "SA_INC_FIN", "twin": "DSY.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 64.2},
    "REM.JO": {"name": "Remgro Ltd", "sector": "SA_INC_FIN", "twin": "FSR.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 156.4},

    # 6. SA RETAILERS, HEALTHCARE, TELCOS & INDUSTRIALS (SA_INC_RETAIL)
    "SHP.JO": {"name": "Shoprite Holdings", "sector": "SA_INC_RETAIL", "twin": "CLS.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 298.5},
    "MRP.JO": {"name": "Mr Price Group", "sector": "SA_INC_RETAIL", "twin": "TFG.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 268.0},
    "TFG.JO": {"name": "The Foschini Group", "sector": "SA_INC_RETAIL", "twin": "MRP.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": False, "refPriceZar": 162.4},
    "WHL.JO": {"name": "Woolworths Holdings", "sector": "SA_INC_RETAIL", "twin": "SHP.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 63.8},
    "CLS.JO": {"name": "Clicks Group Ltd", "sector": "SA_INC_RETAIL", "twin": "SHP.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 382.0},
    "BVT.JO": {"name": "Bidvest Group", "sector": "SA_INC_RETAIL", "twin": "BID.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 278.5},
    "MTN.JO": {"name": "MTN Group Ltd", "sector": "SA_INC_RETAIL", "twin": "VOD.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 112.4},
    "VOD.JO": {"name": "Vodacom Group", "sector": "SA_INC_RETAIL", "twin": "MTN.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 118.6},
    "APN.JO": {"name": "Aspen Pharmacare", "sector": "SA_INC_RETAIL", "twin": "CLS.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": False, "is_top40": True, "refPriceZar": 174.2},

    # 7. JSE LIQUID ETFs — 0% STT EXEMPT & TFSA ELIGIBLE (JSE_ETF_TFSA)
    "STX40.JO":  {"name": "Satrix 40 ETF (JSE Top 40)", "sector": "JSE_ETF_TFSA", "twin": "SYG500.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": True, "is_top40": True, "refPriceZar": 82.45},
    "SYG500.JO": {"name": "Sygnia Itrix S&P 500 ETF", "sector": "JSE_ETF_TFSA", "twin": "STXNDQ.JO", "offshore": "SPY", "offshore_ccy": "USD", "stt_exempt": True, "is_top40": True, "refPriceZar": 106.8},
    "STXNDQ.JO": {"name": "Satrix NASDAQ 100 ETF", "sector": "JSE_ETF_TFSA", "twin": "SYG500.JO", "offshore": "QQQ", "offshore_ccy": "USD", "stt_exempt": True, "is_top40": True, "refPriceZar": 212.4},
    "GLD.JO":    {"name": "NewGold Bullion ETF", "sector": "JSE_ETF_TFSA", "twin": "GFI.JO", "offshore": "GLD", "offshore_ccy": "USD", "stt_exempt": True, "is_top40": True, "refPriceZar": 486.5},
    "CSP500.JO": {"name": "CoreShares S&P 500 ETF", "sector": "JSE_ETF_TFSA", "twin": "SYG500.JO", "offshore": "SPY", "offshore_ccy": "USD", "stt_exempt": True, "is_top40": True, "refPriceZar": 96.40},
    "STXDIV.JO": {"name": "Satrix DIVI Plus ETF", "sector": "JSE_ETF_TFSA", "twin": "STX40.JO", "offshore": None, "offshore_ccy": None, "stt_exempt": True, "is_top40": True, "refPriceZar": 2.91},
}

# Standard all-in EasyEquities ZAR equity fee estimates (mirrors frontend/src/lib/config.ts).
JSE_BUY_FEE_PCT = 0.65          # Buy fee: 0.65% (0.25% brokerage + 15% VAT + 0.075% STRATE settlement + 0.25% STT tax + levies)
JSE_SELL_FEE_PCT = 0.38         # Sell fee: 0.38% (0.25% brokerage + 15% VAT + 0.075% STRATE settlement + levies — no STT on sells)
JSE_EQUITY_FRICTION_PCT = 0.65  # Buy fee: 0.65% (0.25% brokerage + 15% VAT + 0.075% STRATE settlement + 0.25% STT tax + levies)
JSE_ETF_FRICTION_PCT = 0.38     # Sell fee: 0.38% (0.25% brokerage + 15% VAT + 0.075% STRATE settlement + levies — no STT on sells)

# Set to True only after Paper Lab executes and grades simulated trades.
ENGINE_VALIDATED = False            # signals/gates are NOT validated; do not trade from them
MIN_REAL_BARS = 250                 # minimum number of real daily OHLCV bars required for live eligibility
PRICE_STALE_DAYS = 5                # max calendar days between last real bar and today before marking STALE
PRICE_ANOMALY_PCT = 40.0            # max allowed single-bar absolute percentage move in last 5 bars
CORE_PORTFOLIO_ETFS = ["STX40.JO", "SYG500.JO", "STXNDQ.JO", "GLD.JO"]   # equal-weight core, used in a later phase
CORE_RISK_ASSET_PCT = 40.0
CORE_MAX_LOSS_TOLERANCE_ZAR = 1000.0  # maximum Rand loss tolerance for core portfolio allocation
CORE_MIN_TRADE_ZAR = 1000.0         # ignore rebalance legs smaller than this (fees make them pointless)
CORE_DRIFT_BAND_PTS = 5.0           # rebalance only if any weight is this many percentage points off target
CORE_REVIEW_DAYS = 365              # also review once a year
MAX_POSITION_PCT = 25.0             # max % of total account in one position
CASH_BUFFER_PCT = 10.0              # cash that must remain after a buy
MAX_ORDERS_PER_DAY = 3              # max buy orders allowed per calendar day
DUPLICATE_ORDER_WINDOW_MIN = 10     # window in minutes to block duplicate buy orders on the same symbol
MAX_LOSS_PER_TRADE_PCT = 1.0        # of total account, if a stop is given
DRAWDOWN_PAUSE_PCT = 10.0           # block new buys when account is this far below its high-water mark
SLIPPAGE_PER_SIDE_PCT = 0.10        # ASSUMPTION, not a quote

JSE_FEE_PROFILES = {
    "EASYEQUITIES_ZAR": {
        "label": "EasyEquities ZAR (Default Retail JSE Account)",
        "round_trip_top40_ordinary_pct": JSE_EQUITY_FRICTION_PCT,
        "round_trip_midcap_ordinary_pct": JSE_EQUITY_FRICTION_PCT,
        "round_trip_stt_exempt_etf_pct": JSE_ETF_FRICTION_PCT,
    },
    "EASYEQUITIES_TFSA": {
        "label": "EasyEquities TFSA (0% STT on ETFs, STT still applies to shares, 0% SARS CGT)",
        "round_trip_top40_ordinary_pct": JSE_EQUITY_FRICTION_PCT,
        "round_trip_midcap_ordinary_pct": JSE_EQUITY_FRICTION_PCT,
        "round_trip_stt_exempt_etf_pct": JSE_ETF_FRICTION_PCT,
    },
    "INSTITUTIONAL_DMA_ZAR": {
        "label": "Institutional DMA (0.08% Brokerage Leg)",
        "round_trip_top40_ordinary_pct": 0.59,
        "round_trip_midcap_ordinary_pct": 0.67,
        "round_trip_stt_exempt_etf_pct": 0.34,
    },
}


def is_stt_exempt_etf(ticker: str) -> bool:
    clean = ticker.strip().upper()
    if clean in TFSA_ELIGIBLE_ETFS:
        return True
    meta = JSE_UNIVERSE_MAP.get(clean, {})
    return bool(meta.get("stt_exempt", False) or meta.get("sector") == "JSE_ETF_TFSA")


def fee_round_trip_pct(symbol: str) -> float:
    clean = (symbol or "").strip().upper()
    if not clean.endswith(".JO") and f"{clean}.JO" in JSE_UNIVERSE_MAP:
        clean = f"{clean}.JO"
    meta = JSE_UNIVERSE_MAP.get(clean, {})
    if meta.get("sector") == "JSE_ETF_TFSA" or bool(meta.get("stt_exempt", False)):
        return float(JSE_ETF_FRICTION_PCT)
    return float(JSE_EQUITY_FRICTION_PCT)


def get_round_trip_friction_pct(ticker: str, fee_profile: str = "EASYEQUITIES_ZAR") -> float:
    clean = ticker.strip().upper()
    meta = JSE_UNIVERSE_MAP.get(clean, {})
    prof = JSE_FEE_PROFILES.get(fee_profile, JSE_FEE_PROFILES["EASYEQUITIES_ZAR"])
    if is_stt_exempt_etf(clean):
        return float(prof["round_trip_stt_exempt_etf_pct"])
    if not meta.get("is_top40", True):
        return float(prof["round_trip_midcap_ordinary_pct"])
    return float(prof["round_trip_top40_ordinary_pct"])


# ============================================================================
# PHASE 3: PAPER LAB CONSTANTS
# ============================================================================
PAPER_START_CAPITAL_ZAR = 10000.0
PAPER_SIGNAL_HORIZON_DAYS = 15          # trading days, used if a signal carries no horizon
PAPER_MIN_GRADED_FOR_RATE = 100         # below this, report NOT ENOUGH DATA
PAPER_JOB_HOUR_SAST = 17                # run after the JSE close
PAPER_JOB_MINUTE_SAST = 30
PAPER_CASH_RATE_PCT = 0.0               # cash assumed to earn nothing (assumption)

