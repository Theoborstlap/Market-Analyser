"""
Wall Street session clock + calendar stub — V13 P4 DATA TRUTH edition  (marker: P4_US_DATA_TRUTH)

* The session banner uses the correct US daylight-saving rule (second Sunday of March to first
  Sunday of November). The earlier version used a fixed UTC-4 and showed the wrong New York time
  from the first Sunday of November.
* US market holidays are NOT modelled.
* No economic calendar is connected. The macro numbers themselves are fetched in data_fetcher.py.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional


def _nth_sunday(year: int, month: int, n: int) -> datetime:
    first = datetime(year, month, 1, tzinfo=timezone.utc)
    offset = (6 - first.weekday()) % 7
    return first + timedelta(days=offset + 7 * (n - 1))


def _us_et_offset_hours(now_utc: datetime) -> int:
    """-4 during US daylight time (EDT), -5 otherwise (EST). Switch moments are 2:00 local time."""
    year = now_utc.year
    start = _nth_sunday(year, 3, 2).replace(hour=7)   # 02:00 EST = 07:00 UTC
    end = _nth_sunday(year, 11, 1).replace(hour=6)    # 02:00 EDT = 06:00 UTC
    return -4 if (start <= now_utc < end) else -5


def get_wall_street_session_banner(now_utc: Optional[datetime] = None) -> Dict[str, Any]:
    now_utc = now_utc or datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=timezone.utc)
    off = _us_et_offset_hours(now_utc)
    et_time = now_utc + timedelta(hours=off)
    sast_time = now_utc + timedelta(hours=2)
    et_min = et_time.hour * 60 + et_time.minute
    weekday = et_time.weekday()

    def _s(h: int, m: int) -> str:
        total = (h * 60 + m) - off * 60 + 120  # ET clock time -> SAST (UTC+2)
        return f"{(total // 60) % 24:02d}:{total % 60:02d}"

    if weekday >= 5:
        phase = "WEEKEND_QUANT_PREP"
        label = f"WEEKEND WALL STREET PREP: NEXT NY OPEN MONDAY {_s(9, 30)} SAST"
        sniper_note = f"Wait for Monday {_s(9, 45)} SAST (09:45 ET) after opening auction volatility settles."
    elif 240 <= et_min < 570:
        phase = "US_PRE_MARKET"
        label = f"US PRE-MARKET ACTIVE ({_s(4, 0)}–{_s(9, 30)} SAST / 04:00–09:30 ET)"
        sniper_note = f"Optimal entry window opens around {_s(9, 45)} SAST (09:45 ET)."
    elif 570 <= et_min < 585:
        phase = "NY_OPENING_BELL_WHIPSAW"
        label = f"NY OPENING BELL AUCTION ({_s(9, 30)}–{_s(9, 45)} SAST): HOLD OFF ON MARKET ORDERS"
        sniper_note = f"Opening volatility window; consider waiting until {_s(9, 45)} SAST once spreads compress."
    elif 585 <= et_min < 960:
        phase = "US_REGULAR_SESSION_SNIPER"
        label = f"WALL STREET REGULAR SESSION OPEN ({_s(9, 30)}–{_s(16, 0)} SAST / 09:30–16:00 ET)"
        sniper_note = "Regular session: deepest liquidity and tightest spreads."
    elif 960 <= et_min < 1200:
        phase = "US_AFTER_HOURS"
        label = f"US AFTER-HOURS SESSION ({_s(16, 0)}–{_s(20, 0)} SAST / 16:00–20:00 ET)"
        sniper_note = "Thin liquidity; earnings reactions and wide spreads."
    else:
        phase = "OVERNIGHT_FUTURES"
        label = "OVERNIGHT ES=F / NQ=F GLOBEX FUTURES SESSION"
        sniper_note = f"US pre-market opens at {_s(4, 0)} SAST; regular session opens at {_s(9, 30)} SAST."

    return {
        "phase": phase,
        "banner_label": label,
        "sniper_window_note": sniper_note,
        "sast_clock": sast_time.strftime("%H:%M:%S SAST"),
        "et_clock": et_time.strftime("%H:%M:%S") + (" EDT" if off == -4 else " EST"),
        "et_utc_offset_hours": off,
        "holidays_modelled": False,
    }


async def fetch_forexfactory_usd_calendar() -> Dict[str, Any]:
    return {
        "calendar_status": "UNAVAILABLE",
        "macro_lockout_warning": False,
        "upcoming_usd_events": [],
    }
