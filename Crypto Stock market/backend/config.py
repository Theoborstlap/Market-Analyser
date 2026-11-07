"""
Crypto Quantitative Trading Coach 24/7 — V10.1 Sovereign R10k Compounding & Hyper-Execution Finale
24/7/365 Institutional Crypto Configuration, 26-Coin Universe Map & 1x Spot Exchange Friction Profiles
"""
import os
from typing import Dict, Any

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Ensure DB_PATH always resolves to ./Crypto Stock market/backend/data/crypto_quant_coach.db
if os.path.basename(BASE_DIR) == "app":
    BACKEND_ROOT = os.path.dirname(BASE_DIR)
else:
    BACKEND_ROOT = BASE_DIR

DATA_DIR = os.path.join(BACKEND_ROOT, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "crypto_quant_coach.db")

BACKEND_PORT = 8002
FRONTEND_PORT = 5175


def round_crypto_price(val: float) -> float:
    """
    Preserves exact precision across high-value coins (BTC/ETH) and micro-priced coins (PEPE/SHIB).
    """
    v = float(val)
    av = abs(v)
    if av == 0:
        return 0.0
    if av >= 100.0:
        return round(v, 2)
    if av >= 1.0:
        return round(v, 4)
    if av >= 0.01:
        return round(v, 5)
    return round(v, 8)


def format_crypto_price(val: float) -> str:
    v = float(val)
    av = abs(v)
    if av >= 100.0:
        return f"{v:,.2f}"
    if av >= 1.0:
        return f"{v:.3f}" if av < 10.0 else f"{v:.2f}"
    if av >= 0.01:
        return f"{v:.4f}"
    return f"{v:.7f}"


# ---------------------------------------------------------------------------
# Crypto 1x Spot & Exchange Friction Profiles (Default: 0.25% 1x Spot Friction)
# ---------------------------------------------------------------------------
CRYPTO_FEE_PROFILES: Dict[str, Dict[str, Any]] = {
    "BINANCE_BYBIT_SPOT": {
        "id": "BINANCE_BYBIT_SPOT",
        "label": "VALR / Binance / Bybit 1x Spot (0.25% Round-Trip — Default)",
        "buy_brokerage_pct": 0.10,
        "sell_brokerage_pct": 0.10,
        "sec_taf_settlement_pct": 0.00,
        "spread_slippage_pct": 0.05,
        "round_trip_pct": 0.25,
        "leg_pct": 0.125,
        "funding_carry": False,
        "fx_funding_spread_pct": 0.35,
        "description": "1x Spot Exchange Friction (VALR / Binance / Bybit): 0.10% Buy + 0.10% Sell + 0.05% Order-Book Spread = 0.25% Round-Trip (Strictly Zero Leverage)"
    },
    "VALR_LUNO_ZAR": {
        "id": "VALR_LUNO_ZAR",
        "label": "VALR / Luno South Africa ZAR Spot (0.25% Round-Trip)",
        "buy_brokerage_pct": 0.10,
        "sell_brokerage_pct": 0.10,
        "sec_taf_settlement_pct": 0.00,
        "spread_slippage_pct": 0.05,
        "round_trip_pct": 0.25,
        "leg_pct": 0.125,
        "funding_carry": False,
        "fx_funding_spread_pct": 0.00,
        "description": "South African VALR / Luno Direct ZAR/USDT 1x Spot Execution: 0.25% Round-Trip Friction + Live SA ZAR Arbitrage Shield"
    },
    "HYPERLIQUID_DEX": {
        "id": "HYPERLIQUID_DEX",
        "label": "Hyperliquid On-Chain L1 DEX (0.07% Round-Trip)",
        "buy_brokerage_pct": 0.035,
        "sell_brokerage_pct": 0.035,
        "sec_taf_settlement_pct": 0.00,
        "spread_slippage_pct": 0.00,
        "round_trip_pct": 0.07,
        "leg_pct": 0.035,
        "funding_carry": True,
        "fx_funding_spread_pct": 0.25,
        "description": "Hyperliquid L1 On-Chain CLOB: 0.035% per leg + 0.00% gas = 0.07% Round-Trip"
    },
    "BINANCE_BYBIT_PERP_VIP": {
        "id": "BINANCE_BYBIT_PERP_VIP",
        "label": "Binance / Bybit VIP Execution (0.08% Round-Trip)",
        "buy_brokerage_pct": 0.04,
        "sell_brokerage_pct": 0.04,
        "sec_taf_settlement_pct": 0.00,
        "spread_slippage_pct": 0.00,
        "round_trip_pct": 0.08,
        "leg_pct": 0.04,
        "funding_carry": True,
        "fx_funding_spread_pct": 0.25,
        "description": "VIP Tier Maker/Taker Execution: 0.04% per leg = 0.08% Round-Trip"
    },
    "EASYEQUITIES_CRYPTO": {
        "id": "EASYEQUITIES_CRYPTO",
        "label": "EasyEquities Crypto / EC10 Bundle (1.00% Round-Trip)",
        "buy_brokerage_pct": 0.50,
        "sell_brokerage_pct": 0.50,
        "sec_taf_settlement_pct": 0.00,
        "spread_slippage_pct": 0.00,
        "round_trip_pct": 1.00,
        "leg_pct": 0.50,
        "funding_carry": False,
        "fx_funding_spread_pct": 0.00,
        "description": "EasyEquities Crypto ZAR Account: 0.50% Buy + 0.50% Sell = 1.00% Round-Trip"
    },
}

DEFAULT_FEE_PROFILE = "BINANCE_BYBIT_SPOT"
DEFAULT_CRYPTO_FEE_PROFILE = "BINANCE_BYBIT_SPOT"
DEFAULT_ROUND_TRIP_FEE_PCT = 0.25
DEFAULT_CRYPTO_ROUND_TRIP_FEE_PCT = 0.25

# ---------------------------------------------------------------------------
# 26 Core Institutional Crypto Universe across 5 Narrative Baskets
# ---------------------------------------------------------------------------
CRYPTO_UNIVERSE_MAP: Dict[str, Dict[str, Any]] = {
    # 1. INSTITUTIONAL MONETARY CORE (INSTITUTIONAL_CORE)
    "BTC":    {"name": "Bitcoin", "yf": "BTC-USD", "cex": "BTCUSDT", "hl": "BTC", "narrative": "INSTITUTIONAL_CORE", "sector": "INSTITUTIONAL_CORE", "twin": "ETH", "llama_chain": "Bitcoin", "llama_proto": None, "fdv_mcap_est": 1.05, "ref_price": 88450.0, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "ETH":    {"name": "Ethereum", "yf": "ETH-USD", "cex": "ETHUSDT", "hl": "ETH", "narrative": "INSTITUTIONAL_CORE", "sector": "INSTITUTIONAL_CORE", "twin": "BTC", "llama_chain": "Ethereum", "llama_proto": None, "fdv_mcap_est": 1.00, "ref_price": 2485.0, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "XRP":    {"name": "XRP (Ripple)", "yf": "XRP-USD", "cex": "XRPUSDT", "hl": "XRP", "narrative": "INSTITUTIONAL_CORE", "sector": "INSTITUTIONAL_CORE", "twin": "ADA", "llama_chain": "XRPL", "llama_proto": None, "fdv_mcap_est": 1.72, "ref_price": 2.38, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "LTC":    {"name": "Litecoin", "yf": "LTC-USD", "cex": "LTCUSDT", "hl": "LTC", "narrative": "INSTITUTIONAL_CORE", "sector": "INSTITUTIONAL_CORE", "twin": "BTC", "llama_chain": "Litecoin", "llama_proto": None, "fdv_mcap_est": 1.12, "ref_price": 96.40, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "LINK":   {"name": "Chainlink", "yf": "LINK-USD", "cex": "LINKUSDT", "hl": "LINK", "narrative": "INSTITUTIONAL_CORE", "sector": "INSTITUTIONAL_CORE", "twin": "AAVE", "llama_chain": None, "llama_proto": "chainlink", "fdv_mcap_est": 1.58, "ref_price": 16.85, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},

    # 2. HIGH-SPEED LAYER-1 & LAYER-2 ECOSYSTEMS (HIGH_SPEED_L1)
    "SOL":    {"name": "Solana", "yf": "SOL-USD", "cex": "SOLUSDT", "hl": "SOL", "narrative": "HIGH_SPEED_L1", "sector": "HIGH_SPEED_L1", "twin": "SUI", "llama_chain": "Solana", "llama_proto": None, "fdv_mcap_est": 1.21, "ref_price": 178.40, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "BNB":    {"name": "BNB Chain", "yf": "BNB-USD", "cex": "BNBUSDT", "hl": "BNB", "narrative": "HIGH_SPEED_L1", "sector": "HIGH_SPEED_L1", "twin": "ETH", "llama_chain": "BSC", "llama_proto": None, "fdv_mcap_est": 1.00, "ref_price": 628.00, "exchange": "BINANCE / BYBIT 1x SPOT"},
    "SUI":    {"name": "Sui Network", "yf": "SUI20947-USD", "cex": "SUIUSDT", "hl": "SUI", "narrative": "HIGH_SPEED_L1", "sector": "HIGH_SPEED_L1", "twin": "SOL", "llama_chain": "Sui", "llama_proto": None, "fdv_mcap_est": 3.25, "ref_price": 2.84, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "AVAX":   {"name": "Avalanche", "yf": "AVAX-USD", "cex": "AVAXUSDT", "hl": "AVAX", "narrative": "HIGH_SPEED_L1", "sector": "HIGH_SPEED_L1", "twin": "SOL", "llama_chain": "Avalanche", "llama_proto": None, "fdv_mcap_est": 1.74, "ref_price": 24.60, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "ADA":    {"name": "Cardano", "yf": "ADA-USD", "cex": "ADAUSDT", "hl": "ADA", "narrative": "HIGH_SPEED_L1", "sector": "HIGH_SPEED_L1", "twin": "DOT", "llama_chain": "Cardano", "llama_proto": None, "fdv_mcap_est": 1.26, "ref_price": 0.785, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "TON":    {"name": "Toncoin", "yf": "TON11419-USD", "cex": "TONUSDT", "hl": "TON", "narrative": "HIGH_SPEED_L1", "sector": "HIGH_SPEED_L1", "twin": "SOL", "llama_chain": "TON", "llama_proto": None, "fdv_mcap_est": 2.02, "ref_price": 3.85, "exchange": "BINANCE / BYBIT 1x SPOT"},
    "NEAR":   {"name": "NEAR Protocol", "yf": "NEAR-USD", "cex": "NEARUSDT", "hl": "NEAR", "narrative": "HIGH_SPEED_L1", "sector": "HIGH_SPEED_L1", "twin": "APT", "llama_chain": "Near", "llama_proto": None, "fdv_mcap_est": 1.04, "ref_price": 3.45, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "APT":    {"name": "Aptos", "yf": "APT21794-USD", "cex": "APTUSDT", "hl": "APT", "narrative": "HIGH_SPEED_L1", "sector": "HIGH_SPEED_L1", "twin": "SUI", "llama_chain": "Aptos", "llama_proto": None, "fdv_mcap_est": 2.05, "ref_price": 6.15, "exchange": "BINANCE / BYBIT 1x SPOT"},
    "DOT":    {"name": "Polkadot", "yf": "DOT-USD", "cex": "DOTUSDT", "hl": "DOT", "narrative": "HIGH_SPEED_L1", "sector": "HIGH_SPEED_L1", "twin": "ADA", "llama_chain": "Polkadot", "llama_proto": None, "fdv_mcap_est": 1.00, "ref_price": 4.65, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "ARB":    {"name": "Arbitrum", "yf": "ARB11841-USD", "cex": "ARBUSDT", "hl": "ARB", "narrative": "HIGH_SPEED_L1", "sector": "HIGH_SPEED_L1", "twin": "APT", "llama_chain": "Arbitrum", "llama_proto": None, "fdv_mcap_est": 2.40, "ref_price": 0.485, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},

    # 3. DECENTRALIZED AI & GPU COMPUTE (AI_COMPUTE)
    "TAO":    {"name": "Bittensor", "yf": "TAO22974-USD", "cex": "TAOUSDT", "hl": "TAO", "narrative": "AI_COMPUTE", "sector": "AI_COMPUTE", "twin": "FET", "llama_chain": None, "llama_proto": None, "fdv_mcap_est": 2.65, "ref_price": 342.50, "exchange": "BINANCE / BYBIT 1x SPOT"},
    "RENDER": {"name": "Render Network", "yf": "RENDER-USD", "cex": "RENDERUSDT", "hl": "RENDER", "narrative": "AI_COMPUTE", "sector": "AI_COMPUTE", "twin": "FET", "llama_chain": None, "llama_proto": None, "fdv_mcap_est": 1.24, "ref_price": 4.45, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "FET":    {"name": "Artificial Superintelligence", "yf": "FET-USD", "cex": "FETUSDT", "hl": "FET", "narrative": "AI_COMPUTE", "sector": "AI_COMPUTE", "twin": "TAO", "llama_chain": None, "llama_proto": None, "fdv_mcap_est": 1.08, "ref_price": 0.745, "exchange": "BINANCE / BYBIT 1x SPOT"},
    "INJ":    {"name": "Injective", "yf": "INJ-USD", "cex": "INJUSDT", "hl": "INJ", "narrative": "AI_COMPUTE", "sector": "AI_COMPUTE", "twin": "SOL", "llama_chain": "Injective", "llama_proto": None, "fdv_mcap_est": 1.02, "ref_price": 12.80, "exchange": "BINANCE / BYBIT 1x SPOT"},

    # 4. DEFI BLUE-CHIPS & REAL ON-CHAIN YIELD (DEFI_YIELD)
    "AAVE":   {"name": "Aave Protocol", "yf": "AAVE-USD", "cex": "AAVEUSDT", "hl": "AAVE", "narrative": "DEFI_YIELD", "sector": "DEFI_YIELD", "twin": "UNI", "llama_chain": None, "llama_proto": "aave", "fdv_mcap_est": 1.06, "ref_price": 214.50, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "UNI":    {"name": "Uniswap", "yf": "UNI7083-USD", "cex": "UNIUSDT", "hl": "UNI", "narrative": "DEFI_YIELD", "sector": "DEFI_YIELD", "twin": "AAVE", "llama_chain": None, "llama_proto": "uniswap", "fdv_mcap_est": 1.66, "ref_price": 7.65, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "MKR":    {"name": "Maker / Sky", "yf": "MKR-USD", "cex": "MKRUSDT", "hl": "MKR", "narrative": "DEFI_YIELD", "sector": "DEFI_YIELD", "twin": "AAVE", "llama_chain": None, "llama_proto": "makerdao", "fdv_mcap_est": 1.10, "ref_price": 1385.00, "exchange": "BINANCE / BYBIT 1x SPOT"},
    "LDO":    {"name": "Lido DAO", "yf": "LDO-USD", "cex": "LDOUSDT", "hl": "LDO", "narrative": "DEFI_YIELD", "sector": "DEFI_YIELD", "twin": "ETH", "llama_chain": None, "llama_proto": "lido", "fdv_mcap_est": 1.12, "ref_price": 1.24, "exchange": "BINANCE / BYBIT 1x SPOT"},

    # 5. HIGH-VELOCITY MEME BETA (MEME_BETA)
    "DOGE":   {"name": "Dogecoin", "yf": "DOGE-USD", "cex": "DOGEUSDT", "hl": "DOGE", "narrative": "MEME_BETA", "sector": "MEME_BETA", "twin": "SHIB", "llama_chain": "Dogecoin", "llama_proto": None, "fdv_mcap_est": 1.00, "ref_price": 0.194, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "SHIB":   {"name": "Shiba Inu", "yf": "SHIB-USD", "cex": "SHIBUSDT", "hl": "kSHIB", "narrative": "MEME_BETA", "sector": "MEME_BETA", "twin": "DOGE", "llama_chain": None, "llama_proto": None, "fdv_mcap_est": 1.00, "ref_price": 0.0000148, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
    "PEPE":   {"name": "Pepe", "yf": "PEPE24478-USD", "cex": "PEPEUSDT", "hl": "kPEPE", "narrative": "MEME_BETA", "sector": "MEME_BETA", "twin": "DOGE", "llama_chain": None, "llama_proto": None, "fdv_mcap_est": 1.00, "ref_price": 0.0000094, "exchange": "VALR / BINANCE / BYBIT 1x SPOT"},
}

MAJOR_L1_ANCHOR_TICKERS = {"BTC", "ETH", "SOL", "BNB", "LINK", "XRP", "LTC", "AVAX"}
AI_DEFI_LEADER_TICKERS = {"TAO", "RENDER", "AAVE", "FET", "INJ", "UNI", "MKR", "SUI", "NEAR", "APT", "LDO"}


def is_major_l1_anchor(symbol: str) -> bool:
    clean = symbol.upper().strip().replace("-USD", "")
    if clean in MAJOR_L1_ANCHOR_TICKERS:
        return True
    meta = CRYPTO_UNIVERSE_MAP.get(clean, {})
    return meta.get("narrative") == "INSTITUTIONAL_CORE"


def is_ai_defi_leader(symbol: str) -> bool:
    clean = symbol.upper().strip().replace("-USD", "")
    if clean in AI_DEFI_LEADER_TICKERS:
        return True
    meta = CRYPTO_UNIVERSE_MAP.get(clean, {})
    return meta.get("narrative") in ("AI_COMPUTE", "DEFI_YIELD", "HIGH_SPEED_L1")
