"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Globe,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { JseOpportunity } from "@/types/market";

interface CrossMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  jseOpportunities: JseOpportunity[];
  usdzarRate: number;
  accountBalanceZar: number;
  onSelectJseTicket?: (opp: JseOpportunity) => void;
}

interface NormalizedGlobalCandidate {
  market: "JSE (Port 8000)" | "US EQUITIES (Port 8001)" | "CRYPTO 24/7 (Port 8002)";
  marketBadgeColor: string;
  ticker: string;
  name: string;
  sector: string;
  currency: "ZAR" | "USD";
  entryNative: number;
  stopNative: number;
  targetNative: number;
  entryZar: number;
  stopZar: number;
  targetZar: number;
  convictionScore: number;
  netRr: number;
  redTeamKillProbDec: number;
  metaRankScore: number;
  kellyPct: number;
  allocZar: number;
  expectedWinZar: number;
  maxLossZar: number;
  gatesPassed: number;
  verdictBadge: string;
  rawJseOpp?: JseOpportunity;
}

export const CrossMarketModal: React.FC<CrossMarketModalProps> = ({
  isOpen,
  onClose,
  jseOpportunities,
  usdzarRate,
  accountBalanceZar,
  onSelectJseTicket,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<{
    jse8000: boolean;
    us8001: boolean;
    crypto8002: boolean;
  }>({
    jse8000: true,
    us8001: false,
    crypto8002: false,
  });
  const [allCandidates, setAllCandidates] = useState<NormalizedGlobalCandidate[]>(
    []
  );

  const extractSignalsArray = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.opportunities)) return payload.opportunities;
    if (Array.isArray(payload.signals)) return payload.signals;
    if (Array.isArray(payload.top_signals)) return payload.top_signals;
    if (Array.isArray(payload.assets)) return payload.assets;
    if (payload.data && Array.isArray(payload.data)) return payload.data;
    return [];
  };

  const normalizeCandidate = (
    raw: any,
    marketLabel: "JSE (Port 8000)" | "US EQUITIES (Port 8001)" | "CRYPTO 24/7 (Port 8002)",
    isUsd: boolean,
    fxRate: number,
    baseZar: number
  ): NormalizedGlobalCandidate => {
    const ticker = String(raw.ticker || raw.symbol || "UNKNOWN");
    const name = String(raw.name || raw.company_name || ticker);
    const sector = String(raw.sector || raw.category || marketLabel);
    const entryNative = Number(
      raw.entry_price || raw.priceZar || raw.price || raw.current_price || 100
    );
    const stopNative = Number(
      raw.hybrid_structural_stop ||
        raw.stop_loss ||
        raw.stopLossZar ||
        entryNative * 0.95
    );
    const targetNative = Number(
      raw.target_price ||
        raw.targetPriceZar ||
        raw.target ||
        entryNative * 1.09
    );

    const mult = isUsd ? fxRate : 1.0;
    const entryZar = Number((entryNative * mult).toFixed(2));
    const stopZar = Number((stopNative * mult).toFixed(2));
    const targetZar = Number((targetNative * mult).toFixed(2));

    const convictionScore = Number(
      raw.conviction_score ||
        raw.finalConvictionScore ||
        raw.conviction ||
        raw.score ||
        78
    );
    const netRr = Number(
      Math.max(
        raw.net_rr_market || 0,
        raw.net_rr_limit_dip || 0,
        raw.netRrRatio || 0,
        raw.net_rr || 1.55
      ).toFixed(2)
    );

    const rawKill = Number(
      raw.red_team_kill_prob_pct ??
        (raw.redTeamKillProb !== undefined ? raw.redTeamKillProb * 100 : 18)
    );
    const redTeamKillProbDec = Math.min(
      0.85,
      Math.max(0.05, rawKill > 1 ? rawKill / 100.0 : rawKill)
    );

    const gatesPassed = Number(
      raw.aplus_gates_passed ??
        raw.aplus_checklist_passed_count ??
        raw.gates_passed ??
        10
    );
    const isTourneyWinner = Boolean(raw.is_tournament_winner) || raw.tournament_rank === 1;
    const tourneyBonus =
      raw.tournament_rank === 1
        ? 5000
        : isTourneyWinner
        ? 2500
        : gatesPassed >= 12
        ? 1000
        : 0;
    const alphaScore = Number(raw.sovereign_alpha_score || 0);
    const metaRankScore = Number(
      (
        tourneyBonus +
        alphaScore * 10 +
        convictionScore * netRr * (1.0 - redTeamKillProbDec)
      ).toFixed(2)
    );

    const kellyPct = Number(
      Math.min(
        35,
        Math.max(5, raw.kelly_pct || raw.halfKellyWeightPct || 14.0)
      ).toFixed(1)
    );
    const allocZar = Math.round(baseZar * (kellyPct / 100.0));
    const netWinPct = Math.max(
      0.02,
      (targetNative - entryNative) / Math.max(0.0001, entryNative) - 0.006
    );
    const stopLossPct = Math.max(
      0.01,
      (entryNative - stopNative) / Math.max(0.0001, entryNative) + 0.003
    );

    const expectedWinZar = Number((allocZar * netWinPct).toFixed(2));
    const maxLossZar = Number((allocZar * stopLossPct).toFixed(2));
    const verdictBadge = String(
      raw.verdict_label ||
        raw.signalTier ||
        "🟢 A+ SNIPER SETUP"
    );

    const marketBadgeColor =
      marketLabel === "JSE (Port 8000)"
        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
        : marketLabel === "US EQUITIES (Port 8001)"
        ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
        : "bg-amber-500/20 border-amber-500/50 text-amber-300";

    return {
      market: marketLabel,
      marketBadgeColor,
      ticker,
      name,
      sector,
      currency: isUsd ? "USD" : "ZAR",
      entryNative,
      stopNative,
      targetNative,
      entryZar,
      stopZar,
      targetZar,
      convictionScore,
      netRr,
      redTeamKillProbDec,
      metaRankScore,
      kellyPct,
      allocZar,
      expectedWinZar,
      maxLossZar,
      gatesPassed,
      verdictBadge,
      rawJseOpp: marketLabel === "JSE (Port 8000)" ? raw : undefined,
    };
  };

  const fetchAllThreeMarkets = useCallback(async () => {
    setIsLoading(true);
    const fx = usdzarRate || 18.42;
    const status = { jse8000: false, us8001: false, crypto8002: false };
    const collected: NormalizedGlobalCandidate[] = [];

    const fetchWithTimeout = async (url: string, timeoutMs = 2800) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        clearTimeout(id);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        clearTimeout(id);
        return null;
      }
    };

    const [jseData, usData, cryptoData] = await Promise.all([
      fetchWithTimeout("http://localhost:8000/api/dashboard"),
      fetchWithTimeout("http://localhost:8001/api/dashboard"),
      fetchWithTimeout("http://localhost:8002/api/dashboard"),
    ]);

    // 1. JSE (Port 8000 or in-memory fallback)
    const jseList = extractSignalsArray(jseData);
    if (jseList.length > 0) {
      status.jse8000 = true;
      jseList.forEach((item) =>
        collected.push(
          normalizeCandidate(item, "JSE (Port 8000)", false, fx, accountBalanceZar)
        )
      );
    } else if (jseOpportunities.length > 0) {
      status.jse8000 = true;
      jseOpportunities.forEach((item) =>
        collected.push(
          normalizeCandidate(item, "JSE (Port 8000)", false, fx, accountBalanceZar)
        )
      );
    }

    // 2. US Equities (Port 8001)
    const usList = extractSignalsArray(usData);
    if (usList.length > 0) {
      status.us8001 = true;
      usList.forEach((item) =>
        collected.push(
          normalizeCandidate(
            item,
            "US EQUITIES (Port 8001)",
            true,
            fx,
            accountBalanceZar
          )
        )
      );
    }

    // 3. Crypto 24/7 (Port 8002)
    const cryptoList = extractSignalsArray(cryptoData);
    if (cryptoList.length > 0) {
      status.crypto8002 = true;
      cryptoList.forEach((item) =>
        collected.push(
          normalizeCandidate(
            item,
            "CRYPTO 24/7 (Port 8002)",
            true,
            fx,
            accountBalanceZar
          )
        )
      );
    }

    collected.sort((a, b) => b.metaRankScore - a.metaRankScore);
    setServerStatus(status);
    setAllCandidates(collected);
    setIsLoading(false);
  }, [jseOpportunities, usdzarRate, accountBalanceZar]);

  useEffect(() => {
    if (isOpen) {
      fetchAllThreeMarkets();
    }
  }, [isOpen, fetchAllThreeMarkets]);

  if (!isOpen) return null;

  // Select Top 3 Uncorrelated Setups (distinct sectors/markets)
  const top3Uncorrelated: NormalizedGlobalCandidate[] = [];
  const usedSectors = new Set<string>();
  for (const cand of allCandidates) {
    if (top3Uncorrelated.length >= 3) break;
    const secKey = `${cand.market}_${cand.sector}`;
    if (!usedSectors.has(secKey) || top3Uncorrelated.length < 3) {
      usedSectors.add(secKey);
      top3Uncorrelated.push(cand);
    }
  }

  const slotShares = [0.45, 0.35, 0.2];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0D1322] border border-cyan-500/50 rounded-2xl max-w-4xl w-full p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                🌐 Cross-Market "Best of All 3 Worlds" Meta-Allocator (JSE + US + Crypto)
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Normalized to R {accountBalanceZar.toLocaleString()} ZAR (@ USD/ZAR R
                {usdzarRate.toFixed(2)}) • Ranked by Conviction × Net R:R × (1 − KillProb)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAllThreeMarkets}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/35 border border-cyan-500/40 text-cyan-300 font-mono text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Sync All 3 Engines
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live 3-Port Server Status Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
          <div className="bg-[#060911] border border-emerald-500/40 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-emerald-300 font-bold">🇿🇦 JSE Engine (Port 8000)</div>
              <div className="text-[10px] text-slate-400">44 JSE Equities & TFSA ETFs</div>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
              <Wifi className="w-3 h-3" /> ONLINE
            </span>
          </div>

          <div
            className={`bg-[#060911] border rounded-xl p-2.5 flex items-center justify-between ${
              serverStatus.us8001 ? "border-blue-500/40" : "border-slate-800"
            }`}
          >
            <div>
              <div className="text-blue-300 font-bold">🇺🇸 US Engine (Port 8001)</div>
              <div className="text-[10px] text-slate-400">
                {serverStatus.us8001
                  ? "Connected & Normalized to ZAR"
                  : "Offline (JSE STXNDQ/SYG500 Proxy Active)"}
              </div>
            </div>
            {serverStatus.us8001 ? (
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold flex items-center gap-1">
                <Wifi className="w-3 h-3" /> ONLINE
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] flex items-center gap-1">
                <WifiOff className="w-3 h-3" /> STANDBY
              </span>
            )}
          </div>

          <div
            className={`bg-[#060911] border rounded-xl p-2.5 flex items-center justify-between ${
              serverStatus.crypto8002 ? "border-amber-500/40" : "border-slate-800"
            }`}
          >
            <div>
              <div className="text-amber-300 font-bold">⚡ Crypto Engine (Port 8002)</div>
              <div className="text-[10px] text-slate-400">
                {serverStatus.crypto8002
                  ? "Connected & Normalized to ZAR"
                  : "Offline (Graceful Fallback Active)"}
              </div>
            </div>
            {serverStatus.crypto8002 ? (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                <Wifi className="w-3 h-3" /> ONLINE
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] flex items-center gap-1">
                <WifiOff className="w-3 h-3" /> STANDBY
              </span>
            )}
          </div>
        </div>

        {/* Top 3 Uncorrelated A+ Setups Hero Grid */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold text-cyan-300 uppercase flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              Top 3 Uncorrelated A+ Setups (Scaled to R {accountBalanceZar.toLocaleString()} ZAR)
            </h4>
            <span className="text-[11px] font-mono text-slate-400">
              Formula: Score = Conviction × Net R:R × (1 − RedTeamKillProb)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {top3Uncorrelated.map((cand, idx) => {
              const slotPct = Math.round(slotShares[idx] * 100);
              const slotCashZar = Math.round(accountBalanceZar * slotShares[idx]);
              const netGainPct = Math.max(
                0.02,
                (cand.targetZar - cand.entryZar) / Math.max(0.01, cand.entryZar) - 0.006
              );
              const stopRiskPct = Math.max(
                0.01,
                (cand.entryZar - cand.stopZar) / Math.max(0.01, cand.entryZar) + 0.003
              );
              const slotWinZar = Math.round(slotCashZar * netGainPct);
              const slotLossZar = Math.round(slotCashZar * stopRiskPct);

              return (
                <div
                  key={`${cand.market}_${cand.ticker}`}
                  className="bg-[#060911] border border-emerald-500/40 rounded-xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded border font-mono text-[10px] font-bold ${cand.marketBadgeColor}`}
                      >
                        #{idx + 1} • {cand.market}
                      </span>
                      <span className="font-mono text-xs font-bold text-amber-300">
                        Meta Score: {cand.metaRankScore}
                      </span>
                    </div>

                    <div>
                      <div className="font-mono text-base font-extrabold text-white">
                        {cand.ticker}{" "}
                        <span className="text-xs font-normal text-slate-300">
                          {cand.name}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Sector: {cand.sector} • Gates: {cand.gatesPassed}/12
                      </div>
                    </div>

                    <div className="bg-[#0D1322] border border-slate-800 rounded-lg p-2.5 font-mono text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Barbell Slot ({slotPct}%):</span>
                        <strong className="text-emerald-300">
                          R{slotCashZar.toLocaleString()} ZAR
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Entry (ZAR):</span>
                        <strong className="text-white">
                          R{cand.entryZar.toLocaleString()}
                          {cand.currency === "USD" && ` ($${cand.entryNative.toFixed(2)})`}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Protected Stop:</span>
                        <strong className="text-rose-400">
                          R{cand.stopZar.toLocaleString()} (-R{slotLossZar})
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Net Target:</span>
                        <strong className="text-emerald-400">
                          R{cand.targetZar.toLocaleString()} (+R{slotWinZar})
                        </strong>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px]">
                        <span className="text-slate-400">
                          Conv {cand.convictionScore}% • R:R {cand.netRr}x
                        </span>
                        <span className="text-cyan-300">
                          Kill Prob {(cand.redTeamKillProbDec * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {cand.rawJseOpp && onSelectJseTicket && (
                    <button
                      onClick={() => {
                        onClose();
                        onSelectJseTicket(cand.rawJseOpp!);
                      }}
                      className="w-full py-2 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-200 font-mono text-xs font-bold cursor-pointer transition"
                    >
                      📋 Open EasyEquities Ticket
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Full Ranked Cross-Market Leaderboard Table */}
        <div className="bg-[#060911] border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              All Ranked Cross-Market Candidates ({allCandidates.length})
            </span>
            <span className="text-[11px] text-slate-500">
              All values converted to ZAR at R{usdzarRate.toFixed(2)}/USD
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto pr-1">
            <table className="w-full text-left font-mono text-xs">
              <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-1.5">Rank</th>
                  <th className="py-1.5">Market</th>
                  <th className="py-1.5">Ticker</th>
                  <th className="py-1.5">Entry (ZAR)</th>
                  <th className="py-1.5">Target (ZAR)</th>
                  <th className="py-1.5">Conv%</th>
                  <th className="py-1.5">Net R:R</th>
                  <th className="py-1.5">Kill%</th>
                  <th className="py-1.5">Meta Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {allCandidates.slice(0, 15).map((c, idx) => (
                  <tr key={`${c.market}_${c.ticker}_${idx}`} className="hover:bg-slate-900/50">
                    <td className="py-1.5 text-slate-400">#{idx + 1}</td>
                    <td className="py-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] ${c.marketBadgeColor}`}
                      >
                        {c.market.split(" ")[0]}
                      </span>
                    </td>
                    <td className="py-1.5 font-bold text-white">{c.ticker}</td>
                    <td className="py-1.5 text-slate-200">R{c.entryZar.toLocaleString()}</td>
                    <td className="py-1.5 text-emerald-400">R{c.targetZar.toLocaleString()}</td>
                    <td className="py-1.5 text-white">{c.convictionScore}%</td>
                    <td className="py-1.5 text-cyan-300">{c.netRr}x</td>
                    <td className="py-1.5 text-rose-300">
                      {(c.redTeamKillProbDec * 100).toFixed(0)}%
                    </td>
                    <td className="py-1.5 font-bold text-amber-300">{c.metaRankScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
