"use client";

import React, { useEffect, useState } from "react";

export interface DataHealthSymbolEntry {
  symbol: string;
  status: string;
  reason?: string | null;
  n_real_bars?: number;
  last_real_bar?: string | null;
}

export interface DataHealthMacroEntry {
  key: string;
  status: string;
}

export interface DataHealthResponse {
  status?: string;
  generated_at?: string;
  engine_validated: boolean;
  counts: {
    live: number;
    blocked: number;
    total: number;
  };
  symbols: DataHealthSymbolEntry[];
  macro: DataHealthMacroEntry[];
}

interface DataHealthBannerProps {
  engineValidatedFallback?: boolean;
}

export const DataHealthBanner: React.FC<DataHealthBannerProps> = ({
  engineValidatedFallback = false,
}) => {
  const [health, setHealth] = useState<DataHealthResponse | null>(null);
  const [unreachable, setUnreachable] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const pollHealth = async () => {
      try {
        const res = await fetch("/engine/jse/api/data-health", {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as DataHealthResponse;
        if (mounted) {
          setHealth(data);
          setUnreachable(false);
        }
      } catch {
        if (mounted) {
          setUnreachable(true);
        }
      }
    };

    pollHealth();
    const timer = setInterval(pollHealth, 60000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const engineValidated =
    health !== null ? Boolean(health.engine_validated) : engineValidatedFallback;

  const blockedSymbols = (health?.symbols || []).filter(
    (s) => s.status !== "LIVE"
  );
  const blockedCount = health?.counts?.blocked ?? blockedSymbols.length;
  const unavailableMacroKeys = (health?.macro || [])
    .filter((m) => m.status !== "LIVE")
    .map((m) => m.key);

  const showRedBlockedBar =
    !unreachable && (blockedCount > 0 || unavailableMacroKeys.length > 0);

  return (
    <div className="w-full space-y-1.5 px-4 pt-2 max-w-[1900px] mx-auto font-mono text-xs">
      {unreachable && (
        <div className="bg-rose-950/90 border border-rose-500 text-rose-200 px-4 py-2 rounded-lg font-bold flex items-center justify-between">
          <span>🚨 BACKEND UNREACHABLE (/api/data-health)</span>
          <span className="text-[11px] text-rose-300">
            Live JSE price truth cannot be verified
          </span>
        </div>
      )}

      {!engineValidated && (
        <div className="bg-amber-950/90 border border-amber-500 text-amber-200 px-4 py-2 rounded-lg font-bold flex flex-wrap items-center justify-between gap-2">
          <span>⚠️ SIGNALS UNVALIDATED - do not trade from this dashboard</span>
          <span className="text-[11px] text-amber-300/90 font-normal">
            ENGINE_VALIDATED = False (Phase 1 Price Truth Mode)
          </span>
        </div>
      )}

      {showRedBlockedBar && (
        <div className="bg-rose-950/85 border border-rose-500/80 text-rose-100 rounded-lg overflow-hidden">
          <div
            onClick={() => setExpanded((prev) => !prev)}
            className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:bg-rose-900/40 transition"
          >
            <div className="font-bold flex flex-wrap items-center gap-3">
              <span>
                🛑 DATA HEALTH ALERT: {blockedCount} Blocked Symbol
                {blockedCount === 1 ? "" : "s"} (Live:{" "}
                {health?.counts?.live ?? 0}/{health?.counts?.total ?? 0})
              </span>
              {unavailableMacroKeys.length > 0 && (
                <span className="text-rose-300 text-[11px]">
                  • Unavailable Macro: {unavailableMacroKeys.join(", ")}
                </span>
              )}
            </div>
            <span className="text-[11px] underline text-rose-300">
              {expanded ? "▲ Hide Blocked Symbols" : "▼ Click to Expand Details"}
            </span>
          </div>

          {expanded && blockedSymbols.length > 0 && (
            <div className="border-t border-rose-500/40 bg-[#060911]/90 px-4 py-2.5 max-h-56 overflow-y-auto">
              <div className="text-[11px] text-rose-200 mb-2">
                Blocked tickers are excluded from the scanner. Buy and Log Trade are disabled for them.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-[11px]">
                {blockedSymbols.map((item) => (
                  <div
                    key={item.symbol}
                    className="bg-rose-950/40 border border-rose-500/30 rounded px-2.5 py-1.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-white">{item.symbol}</span>
                      {item.reason && (
                        <span className="text-rose-300 ml-1.5 text-[10px]">
                          ({item.reason})
                        </span>
                      )}
                      <div className="text-[10px] text-slate-400">
                        Bars: {item.n_real_bars ?? 0} • Last:{" "}
                        {item.last_real_bar || "n/a"}
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-rose-600/30 border border-rose-500/50 text-rose-200 font-bold text-[10px]">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
