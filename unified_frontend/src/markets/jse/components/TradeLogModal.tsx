"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Calculator,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import {
  FeeProfileKey,
  JseOpportunity,
  MacroCommoditySnapshot,
  PortfolioAnalytics,
} from "@jse/types/market";
import { getRoundTripFrictionPct, JSE_UNIVERSE_MAP } from "@jse/lib/config";

interface TradeLogModalProps {
  isOpen: boolean;
  initialOpportunity: JseOpportunity | null;
  opportunities: JseOpportunity[];
  macro: MacroCommoditySnapshot;
  portfolioAnalytics: PortfolioAnalytics;
  accountCapitalZar: number;
  defaultFeeProfile: FeeProfileKey;
  onClose: () => void;
  onSubmitTrade: (payload: {
    ticker: string;
    name: string;
    sector: string;
    tradeMode: "REAL_BROKER_TRADE" | "PAPER_WALLET_TRADE";
    feeProfile: FeeProfileKey;
    entryPriceZar: number;
    shares: number;
    stopLossZar: number;
    targetPriceZar: number;
    notes: string;
  }) => Promise<void>;
}

export const TradeLogModal: React.FC<TradeLogModalProps> = ({
  isOpen,
  initialOpportunity,
  opportunities,
  macro,
  portfolioAnalytics,
  accountCapitalZar,
  defaultFeeProfile,
  onClose,
  onSubmitTrade,
}) => {
  const [tradeMode, setTradeMode] = useState<"REAL_BROKER_TRADE" | "PAPER_WALLET_TRADE">(
    "REAL_BROKER_TRADE"
  );
  const [feeProfile, setFeeProfile] = useState<FeeProfileKey>(defaultFeeProfile);
  const [tickerInput, setTickerInput] = useState<string>("NPN.JO");
  const [securityName, setSecurityName] = useState<string>("Naspers Ltd");
  const [sector, setSector] = useState<string>("TECH_TENCENT");

  const [entryPriceStr, setEntryPriceStr] = useState<string>("4185.00");
  const [sharesStr, setSharesStr] = useState<string>("3.0000");
  const [cashInvestedStr, setCashInvestedStr] = useState<string>("12555.00");
  const [stopLossStr, setStopLossStr] = useState<string>("3980.00");
  const [targetPriceStr, setTargetPriceStr] = useState<string>("4590.00");
  const [notes, setNotes] = useState<string>("");
  const [isResolvingCustom, setIsResolvingCustom] = useState<boolean>(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (initialOpportunity) {
      setTickerInput(initialOpportunity.ticker);
      setSecurityName(initialOpportunity.name);
      setSector(initialOpportunity.sector);
      setEntryPriceStr(initialOpportunity.priceZar.toFixed(2));
      setSharesStr(initialOpportunity.recommendedShares.toFixed(4));
      setCashInvestedStr(
        (initialOpportunity.recommendedShares * initialOpportunity.priceZar).toFixed(2)
      );
      setStopLossStr(initialOpportunity.stopLossZar.toFixed(2));
      setTargetPriceStr(initialOpportunity.targetPriceZar.toFixed(2));
      setFeeProfile(
        initialOpportunity.sttExempt ? "EASYEQUITIES_TFSA" : defaultFeeProfile
      );
    }
  }, [initialOpportunity, defaultFeeProfile]);

  if (!isOpen) return null;

  const entryPrice = Math.max(0.01, Number(entryPriceStr) || 0);
  const shares = Math.max(0.0001, Number(sharesStr) || 0);
  const cashInvested = Math.max(0, Number(cashInvestedStr) || 0);
  const stopLoss = Math.max(0.01, Number(stopLossStr) || 0);
  const targetPrice = Math.max(0.01, Number(targetPriceStr) || 0);

  // Dual Sizing Calculator handlers
  const handleEntryPriceChange = (val: string) => {
    setEntryPriceStr(val);
    const p = Number(val);
    const sh = Number(sharesStr);
    if (p > 0 && sh > 0) {
      setCashInvestedStr((p * sh).toFixed(2));
    }
  };

  const handleSharesChange = (val: string) => {
    setSharesStr(val);
    const sh = Number(val);
    const p = Number(entryPriceStr);
    if (p > 0 && sh >= 0) {
      setCashInvestedStr((sh * p).toFixed(2));
    }
  };

  const handleCashInvestedChange = (val: string) => {
    setCashInvestedStr(val);
    const cash = Number(val);
    const p = Number(entryPriceStr);
    if (p > 0 && cash >= 0) {
      setSharesStr((cash / p).toFixed(4));
    }
  };

  const handleResolveTicker = async (symbolToLoad?: string) => {
    const raw = (symbolToLoad || tickerInput).trim().toUpperCase();
    if (!raw) return;
    const normalized = raw.endsWith(".JO") ? raw : `${raw}.JO`;
    setTickerInput(normalized);
    setResolveError(null);

    // Check if in the scanner universe first
    const found = opportunities.find((o) => o.ticker === normalized);
    if (found) {
      setSecurityName(found.name);
      setSector(found.sector);
      setEntryPriceStr(found.priceZar.toFixed(2));
      setSharesStr(found.recommendedShares.toFixed(4));
      setCashInvestedStr((found.recommendedShares * found.priceZar).toFixed(2));
      setStopLossStr(found.stopLossZar.toFixed(2));
      setTargetPriceStr(found.targetPriceZar.toFixed(2));
      return;
    }

    // Fetch custom .JO ticker dynamically via /api/custom-ticker
    setIsResolvingCustom(true);
    try {
      const res = await fetch(
        `/engine/jse/api/custom-ticker?symbol=${encodeURIComponent(normalized)}`
      );
      const data = res.ok ? await res.json() : null;
      const price = Number(data?.priceZar);
      if (!data || data.valid === false || data.data_status !== "LIVE" || !Number.isFinite(price) || price <= 0) {
        // Never fill the form with NaN/placeholder numbers for a ticker without a verified live price.
        setResolveError(
          `🛑 ${normalized}: NO LIVE PRICE${data?.reason ? ` (${data.reason})` : ""}. Entry, stop and target were not filled.`
        );
        return;
      }
      setTickerInput(data.ticker);
      setSecurityName(data.name);
      setSector(data.sector || "JSE_CUSTOM");
      setEntryPriceStr(price.toFixed(2));
      setStopLossStr(Number(data.stopLossSuggestedZar).toFixed(2));
      setTargetPriceStr(Number(data.targetSuggestedZar).toFixed(2));
      const defaultCash = Math.min(12000, accountCapitalZar * 0.12);
      const calcShares = defaultCash / Math.max(0.01, price);
      setSharesStr(calcShares.toFixed(4));
      setCashInvestedStr(defaultCash.toFixed(2));
    } catch {
      setResolveError(`⚠️ Could not reach the backend to resolve ${normalized}.`);
    } finally {
      setIsResolvingCustom(false);
    }
  };

  // Compute net R:R, targetNetPct, and 6-Point Flight Checklist
  const frictionPct = getRoundTripFrictionPct(tickerInput, feeProfile);
  const grossGainPct = ((targetPrice - entryPrice) / entryPrice) * 100.0;
  const netGainPct = Math.max(0, grossGainPct - frictionPct);
  const riskPct = Math.max(0.1, ((entryPrice - stopLoss) / entryPrice) * 100.0 + frictionPct * 0.5);
  const netRrRatio = Number((netGainPct / riskPct).toFixed(2));

  const totalRiskZar = Math.max(0, (entryPrice - stopLoss) * shares);
  const accountRiskPct = Number(
    ((totalRiskZar / Math.max(1000, accountCapitalZar)) * 100.0).toFixed(2)
  );

  const matchedOpp = opportunities.find((o) => o.ticker === tickerInput);
  const check1Rr = netRrRatio >= 1.5;
  const check2Mtf = matchedOpp ? matchedOpp.mtfAlignmentScore >= 2 : true;
  const check3NotOverextended = macro.jseSessionStatus !== "CLOSING_AUCTION_TALX";
  const check4MacroClear = !macro.globalFuturesShieldActive && !macro.macroLockoutWarning;
  const check5CorrelationSafe = !portfolioAnalytics.correlationClusterWarning;
  const check6RiskCapped = accountRiskPct <= 1.55;

  const checklist = [
    {
      passed: check1Rr,
      label: `Net Reward-to-Risk >= 1.50x (Current: ${netRrRatio}x after ${frictionPct}% JSE STT & Brokerage)`,
    },
    {
      passed: check2Mtf,
      label: `Multi-Timeframe Fractal Alignment (1D + 1H + 15m: ${
        matchedOpp ? matchedOpp.mtfStatusBadge : "Custom .JO Verified"
      })`,
    },
    {
      passed: check3NotOverextended,
      label: "Not Overextended (< 1.5x ATR from Intraday VWAP & Not in 16:50 Talx Auction)",
    },
    {
      passed: check4MacroClear,
      label: `Macro & Futures Clear (No Red-Folder Bomb in 24h & ES=F ${
        macro.esFuturesChangePct >= 0 ? "+" : ""
      }${macro.esFuturesChangePct}% > -1.25%)`,
    },
    {
      passed: check5CorrelationSafe,
      label: "Portfolio Correlation Safe (r < 0.75 with Open JSE Positions)",
    },
    {
      passed: check6RiskCapped,
      label: `Position Risk Capped <= 1.5% Account Loss at Stop (Current Risk: R${totalRiskZar.toFixed(
        0
      )} / ${accountRiskPct}%)`,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmitTrade({
        ticker: tickerInput,
        name: securityName,
        sector,
        tradeMode,
        feeProfile,
        entryPriceZar: entryPrice,
        shares,
        stopLossZar: stopLoss,
        targetPriceZar: targetPrice,
        notes,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0D1322] border border-slate-700 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              Log Real Broker Fill or Paper Wallet Trade (Normalized R ZAR)
            </h3>
            <p className="text-xs text-slate-400">
              Supports every Watchlist Asset + Any Custom JSE <code className="text-emerald-300">.JO</code>{" "}
              Ticker + Fractional Shares Dual Calculator
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. Real Broker vs Paper Wallet Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setTradeMode("REAL_BROKER_TRADE")}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                tradeMode === "REAL_BROKER_TRADE"
                  ? "bg-emerald-950/60 border-emerald-500 text-white"
                  : "bg-[#060911] border-slate-800 text-slate-400"
              }`}
            >
              <div className="font-mono font-bold text-emerald-300">
                🟢 REAL BROKER TRADE (REAL MONEY)
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Tracks your actual EasyEquities ZAR / TFSA / OST fill without deducting from the
                virtual paper wallet.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTradeMode("PAPER_WALLET_TRADE")}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                tradeMode === "PAPER_WALLET_TRADE"
                  ? "bg-cyan-950/60 border-cyan-500 text-white"
                  : "bg-[#060911] border-slate-800 text-slate-400"
              }`}
            >
              <div className="font-mono font-bold text-cyan-300">
                🧪 PAPER WALLET TRADE (SIMULATOR)
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Deducts R{cashInvested.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} + JSE
                friction from your paper wallet (base R{accountCapitalZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}).
              </div>
            </button>
          </div>

          {/* 2. Watchlist Dropdown OR Any Custom JSE .JO Ticker Input */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-[#060911] p-3 rounded-xl border border-slate-800">
            <div className="sm:col-span-5">
              <label className="text-[11px] text-slate-400 font-mono block mb-1">
                Quick Select (Watchlist)
              </label>
              <select
                value={JSE_UNIVERSE_MAP[tickerInput] ? tickerInput : ""}
                onChange={(e) => {
                  if (e.target.value) handleResolveTicker(e.target.value);
                }}
                className="w-full bg-[#0D1322] border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono"
              >
                <option value="">-- Custom .JO Ticker --</option>
                {Object.entries(JSE_UNIVERSE_MAP).map(([sym, meta]) => (
                  <option key={sym} value={sym}>
                    {sym} — {meta.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-4">
              <label className="text-[11px] text-slate-400 font-mono block mb-1">
                Or Type ANY JSE .JO Ticker (e.g. TGA.JO, AVI.JO)
              </label>
              <input
                type="text"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                placeholder="TGA.JO, PPH.JO, TBS.JO..."
                className="w-full bg-[#0D1322] border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono font-bold uppercase"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={() => handleResolveTicker()}
                disabled={isResolvingCustom}
                className="w-full py-2 px-3 rounded-lg bg-blue-600/25 hover:bg-blue-600/40 border border-blue-500/50 text-blue-200 font-mono font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                {isResolvingCustom ? "Fetching..." : "Fetch Live R"}
              </button>
            </div>

            {resolveError && (
              <div className="sm:col-span-12 text-[11px] font-mono text-rose-300 bg-rose-950/40 border border-rose-500/40 rounded-lg px-2.5 py-1.5">
                {resolveError}
              </div>
            )}

            <div className="sm:col-span-12 flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
              <span>
                Security: <strong className="text-white">{securityName}</strong> ({sector})
              </span>
              <select
                value={feeProfile}
                onChange={(e) => setFeeProfile(e.target.value as FeeProfileKey)}
                className="bg-[#0D1322] border border-slate-700 rounded px-2 py-0.5 text-emerald-300"
              >
                <option value="EASYEQUITIES_ZAR">EasyEquities ZAR</option>
                <option value="EASYEQUITIES_TFSA">EasyEquities TFSA (0% STT)</option>
                <option value="INSTITUTIONAL_DMA_ZAR">Institutional DMA</option>
              </select>
            </div>
          </div>

          {/* 3. Dual Sizing Calculator: Entry Fill (R ZAR) + Shares (4 Decimals) <-> Total Cash Invested (R ZAR) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#060911] p-3.5 rounded-xl border border-emerald-500/30 font-mono">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Entry Fill Price (R ZAR)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={entryPriceStr}
                onChange={(e) => handleEntryPriceChange(e.target.value)}
                className="w-full bg-[#0D1322] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-sm"
              />
            </div>

            <div>
              <label className="text-[11px] text-emerald-300 block mb-1">
                Exact Shares (4-Dec Fractional)
              </label>
              <input
                type="number"
                step="0.0001"
                required
                value={sharesStr}
                onChange={(e) => handleSharesChange(e.target.value)}
                className="w-full bg-[#0D1322] border border-emerald-500/60 rounded-lg px-3 py-2 text-emerald-300 font-bold text-sm"
              />
            </div>

            <div>
              <label className="text-[11px] text-cyan-300 block mb-1">
                OR Total Cash Invested (R ZAR)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={cashInvestedStr}
                onChange={(e) => handleCashInvestedChange(e.target.value)}
                className="w-full bg-[#0D1322] border border-cyan-500/60 rounded-lg px-3 py-2 text-cyan-300 font-bold text-sm"
              />
            </div>
          </div>

          {/* 4. Stop-Loss & Dynamic Target Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
            <div>
              <label className="text-[11px] text-rose-300 block mb-1">
                Hard Stop-Loss Price (R ZAR)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={stopLossStr}
                onChange={(e) => setStopLossStr(e.target.value)}
                className="w-full bg-[#060911] border border-rose-500/50 rounded-lg px-3 py-2 text-white font-bold"
              />
            </div>

            <div>
              <label className="text-[11px] text-emerald-300 block mb-1">
                Swing Target Price (R ZAR) — Dynamic +{netGainPct.toFixed(1)}% NET
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={targetPriceStr}
                onChange={(e) => setTargetPriceStr(e.target.value)}
                className="w-full bg-[#060911] border border-emerald-500/50 rounded-lg px-3 py-2 text-white font-bold"
              />
            </div>
          </div>

          {/* 5. 6-Point Pre-Trade "Go / No-Go" Institutional Flight Checklist */}
          <div className="bg-[#060911] border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                6-Point Pre-Trade Institutional &quot;Go / No-Go&quot; Flight Checklist
              </span>
              <span className="text-[11px] text-emerald-300 font-bold">
                {checklist.filter((c) => c.passed).length}/6 Passed
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5 font-mono text-[11px]">
              {checklist.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded border ${
                    item.passed
                      ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-200"
                      : "bg-rose-950/40 border-rose-500/40 text-rose-200"
                  }`}
                >
                  {item.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trade Notes & Submit */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional execution note (e.g. EasyEquities TFSA limit fill)..."
              className="flex-1 bg-[#060911] border border-slate-800 rounded-lg px-3 py-2 text-white"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold shadow-lg shadow-emerald-900/40 cursor-pointer"
              >
                {submitting
                  ? "Logging..."
                  : tradeMode === "REAL_BROKER_TRADE"
                  ? "🟢 Log Real Broker Trade"
                  : "🧪 Execute Paper Wallet Buy"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
