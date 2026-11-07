"""
SEC / Finviz / WSB intel — V13 P4 DATA TRUTH edition  (marker: P4_US_DATA_TRUTH)

No SEC EDGAR, Finviz, congress-disclosure or ApeWisdom feed is connected.
Earlier versions invented every number from the letters of the ticker; that is removed.
Every field below is a neutral placeholder and the dict says so (data_status = UNAVAILABLE).
Numeric fields stay numeric because other modules call float() / int() on them.
"""
from typing import Dict, Any, Optional
import numpy as np

from config import US_UNIVERSE_MAP


def fetch_sec_finviz_wsb_intel(symbol: str, closes: np.ndarray, volumes: np.ndarray) -> Dict[str, Any]:
    meta = US_UNIVERSE_MAP.get(symbol, {})
    cik = meta.get("cik", "0000000000")
    return {
        "data_status": "UNAVAILABLE",
        "source": "NONE (no SEC / Finviz / WSB feed connected)",
        "cik": cik,
        "form4_insider_buys_30d": 0,
        "form4_net_buy_musd": 0.0,
        "recent_8k_summary": "UNAVAILABLE (no SEC feed connected)",
        "congressional_tracker": "UNAVAILABLE (no disclosure feed connected)",
        "short_float_pct": 0.0,
        "days_to_cover": 0.0,
        "institutional_ownership_pct": 65.0,
        "wsb_mentions_24h": 0,
        "wsb_velocity_pct": 0.0,
        "sue_score": 0.0,
        "pead_drift_status": "UNAVAILABLE (no earnings-surprise data)",
    }


async def fetch_sec_edgar_filings(symbol: str, cik: Optional[str]) -> Dict[str, Any]:
    if not cik:
        return {
            "sec_recent_8k_date": None,
            "sec_recent_form4_count_14d": 0,
            "sec_edgar_catalyst_badge": "ETF BASKET (SEC EXEMPT)",
        }
    return {
        "sec_recent_8k_date": None,
        "sec_recent_form4_count_14d": 0,
        "sec_edgar_catalyst_badge": "UNAVAILABLE (no SEC feed connected)",
    }


async def fetch_finviz_and_apewisdom(symbol: str, current_price: float) -> Dict[str, Any]:
    return {
        "data_status": "UNAVAILABLE",
        "finviz_target_price": None,
        "finviz_target_upside_pct": None,
        "finviz_recom": None,
        "short_float_pct": None,
        "short_ratio_days": None,
        "roe_pct": None,
        "forward_pe": None,
        "cluster_insider_buys_count": 0,
        "insider_net_tone": "UNAVAILABLE",
        "congress_trade_badge": "UNAVAILABLE",
    }
