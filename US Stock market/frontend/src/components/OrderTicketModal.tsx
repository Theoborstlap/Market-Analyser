import React, { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Sliders,
  ShieldCheck,
  DollarSign,
  PlusCircle,
} from "lucide-react";
import { USEquitySignal } from "../types/market";

interface Props {
  signal: USEquitySignal | null;
  initialPlan?: "PLAN_A" | "PLAN_B" | "PLAN_C";
  accountBalanceZar: number;
  usdzarRate: number;
  onClose: () => void;
  onConfirmLogTrade: (payload: {
    symbol: string;
    mode: string;
    broker_profile: string;
    entry_price: number;
    shares: number;
    stop_loss: number;
    target_price: number;
    plan_selected: string;
  }) => void;
}

export const OrderTicketModal: React.FC<Props> = ({
  signal,
  initialPlan = "PLAN_A",
  accountBalanceZar,
  usdzarRate,
  onClose,
  onConfirmLogTrade,
}) => {
  if (!signal) return null;

  const [selectedPlan, setSelectedPlan] = useState<"PLAN_A" | "PLAN_B" | "PLAN_C">(
    initialPlan
  );
  const [brokerType, setBrokerType] = useState<"EASYEQUITIES_USD" | "US_ZERO_COMMISSION">(
    "EASYEQUITIES_USD"
  );

  const defaultAllocPct = Math.min(25, Math.max(8, signal.kelly_fraction_pct * 1.4));
  const defaultInvestZar = Math.round(accountBalanceZar * (defaultAllocPct / 100.0));
  const defaultInvestUsd = Number((defaultInvestZar / Math.max(usdzarRate, 0.01)).toFixed(2));

  const getPlanEntry = (plan: "PLAN_A" | "PLAN_B" | "PLAN_C") => {
    if (plan === "PLAN_B") return signal.limit_dip_entry_price;
    if (plan === "PLAN_C") return signal.blended_entry_price;
    return signal.entry_price;
  };

  const [liveBrokerPriceUsd, setLiveBrokerPriceUsd] = useState<number>(
    getPlanEntry(initialPlan)
  );
  const [customStopPriceUsd, setCustomStopPriceUsd] = useState<number>(
    signal.stop_loss
  );
  const [cashInvestUsd, setCashInvestUsd] = useState<number>(defaultInvestUsd);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLiveBrokerPriceUsd(getPlanEntry(selectedPlan));
    setCustomStopPriceUsd(signal.stop_loss);
  }, [selectedPlan, signal]);

  // 0ms Real-Time Recalculation Engine
  const feePct = brokerType === "EASYEQUITIES_USD" ? 0.62 : 0.065;
  const feeDec = feePct / 100.0;
  const safeEntry = Math.max(liveBrokerPriceUsd, 0.01);
  const targetPrice = signal.target_price;
  const cashInvestZar = cashInvestUsd * usdzarRate;

  const exactShares = cashInvestUsd / safeEntry;
  const feeAdjustedBreakeven = safeEntry * (1.0 + feeDec);

  const grossUpsidePct = ((targetPrice - safeEntry) / safeEntry) * 100.0;
  const grossDownsidePct = Math.max(
    0.1,
    ((safeEntry - customStopPriceUsd) / safeEntry) * 100.0
  );
  const netUpsidePct = Math.max(0.05, grossUpsidePct - feePct);
  const netDownsidePct = Math.max(0.1, grossDownsidePct + feePct);
  const liveNetRR = netUpsidePct / netDownsidePct;

  // EasyEquities USD Stop-Loss % & Take-Profit % Slider Values
  const eeStopLossSliderPct = Math.max(0.2, grossDownsidePct);
  const eeTakeProfitSliderPct = Math.max(0.5, grossUpsidePct);

  const maxRiskUsd =
    exactShares * Math.abs(safeEntry - customStopPriceUsd) + cashInvestUsd * feeDec;
  const maxRiskZar = maxRiskUsd * usdzarRate;
  const netProfitUsd =
    exactShares * Math.max(0, targetPrice - safeEntry) - cashInvestUsd * feeDec;
  const netProfitZar = netProfitUsd * usdzarRate;

  const minPriceSlider = Number((signal.val * 0.96).toFixed(2));
  const maxPriceSlider = Number((signal.target_price * 0.99).toFixed(2));
  const minStopSlider = Number((safeEntry * 0.88).toFixed(2));
  const maxStopSlider = Number((safeEntry * 0.992).toFixed(2));

  const ticketText = [
    `=== 🇺🇸 US V10.1 BROKER ORDER TICKET: ${signal.symbol} (${signal.name}) ===`,
    `Execution Plan   : ${selectedPlan} (${
      selectedPlan === "PLAN_A"
        ? "100% Market Order Now"
        : selectedPlan === "PLAN_B"
        ? `100% Sniper Limit Dip | 24h Fill Prob: ${signal.limit_fill_prob_pct.toFixed(0)}%`
        : "50% Market Now + 50% Limit Dip Scale-In"
    })`,
    `Broker Friction  : ${
      brokerType === "EASYEQUITIES_USD"
        ? "EasyEquities USD (0.62% Round-Trip)"
        : "IBKR / Alpaca / Schwab (0.065% Round-Trip)"
    }`,
    `Buy Price ($ USD): $${safeEntry.toFixed(2)}`,
    `Cash to Invest   : $${cashInvestUsd.toFixed(2)} USD (R ${Math.round(cashInvestZar).toLocaleString()} ZAR @ R${usdzarRate.toFixed(2)})`,
    `Fractional Shares: ${exactShares.toFixed(4)} shares`,
    `Protected Stop   : $${customStopPriceUsd.toFixed(2)} (EE Stop Slider: -${eeStopLossSliderPct.toFixed(2)}%)`,
    `Fee Breakeven    : $${feeAdjustedBreakeven.toFixed(2)} (Locked at Stage 3 +0.35T)`,
    `Capped Target    : $${targetPrice.toFixed(2)} (EE Take-Profit Slider: +${eeTakeProfitSliderPct.toFixed(2)}%)`,
    `Live Net R:R     : ${liveNetRR.toFixed(2)}x (AFTER ${feePct}% US Friction)`,
    `Max Stop Risk    : -$${maxRiskUsd.toFixed(2)} USD (-R ${Math.round(maxRiskZar).toLocaleString()} ZAR)`,
    `Expected Net Win : +$${netProfitUsd.toFixed(2)} USD (+R ${Math.round(netProfitZar).toLocaleString()} ZAR)`,
  ].join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(ticketText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                US ORDER TICKET
              </span>
              <h3 className="text-base font-extrabold text-white">
                {signal.symbol} — {signal.name}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              0ms Real-Time EasyEquities USD (0.62%) &amp; IBKR (0.065%) Execution Calculator
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* 3-Plan Tabs */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setSelectedPlan("PLAN_A")}
              className={`p-2.5 rounded-xl border text-left transition ${
                selectedPlan === "PLAN_A"
                  ? "bg-emerald-600/25 border-emerald-400 text-white shadow"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="text-xs font-extrabold text-emerald-300">
                Plan A (100% Market)
              </div>
              <div className="text-sm font-mono font-bold mt-0.5">
                ${signal.entry_price.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-slate-300">
                Net R:R: {signal.net_rr_market}x
              </div>
            </button>

            <button
              onClick={() => setSelectedPlan("PLAN_B")}
              className={`p-2.5 rounded-xl border text-left transition ${
                selectedPlan === "PLAN_B"
                  ? "bg-amber-500/25 border-amber-400 text-white shadow"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="text-xs font-extrabold text-amber-300">
                Plan B (Limit Dip — {signal.limit_fill_prob_pct.toFixed(0)}% Fill)
              </div>
              <div className="text-sm font-mono font-bold mt-0.5">
                ${signal.limit_dip_entry_price.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-slate-300">
                Net R:R: {signal.net_rr_limit_dip}x
              </div>
            </button>

            <button
              onClick={() => setSelectedPlan("PLAN_C")}
              disabled={signal.plan_c_viable === false}
              title={
                signal.plan_c_viable === false
                  ? "Position < R2,500: 50/50 split disabled to prevent double brokerage fee drag"
                  : "50% Market Now + 50% Limit Dip Scale-In"
              }
              className={`p-2.5 rounded-xl border text-left transition ${
                signal.plan_c_viable === false
                  ? "bg-slate-950/50 border-slate-800/60 text-slate-600 opacity-50 cursor-not-allowed"
                  : selectedPlan === "PLAN_C"
                  ? "bg-cyan-500/25 border-cyan-400 text-white shadow"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="text-xs font-extrabold text-cyan-300">
                Plan C (50/50 Scale-In)
              </div>
              <div className="text-sm font-mono font-bold mt-0.5">
                ${signal.blended_entry_price.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-slate-300">
                Net R:R: {signal.blended_net_rr}x
              </div>
            </button>
          </div>

          {/* V12.2 Expected-Utility Plan Rationale, Elastic 60/40 Box + 4-Step Profit Ladder */}
          <div className="bg-slate-950 border border-indigo-500/40 rounded-xl p-3 font-mono text-xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-200">
                <strong className="text-amber-300">
                  🧠 V12.2 Plan Selector ({signal.recommended_entry_plan || "PLAN_B_LIMIT_DIP"}):
                </strong>{" "}
                {signal.entry_plan_reason ||
                  "Maximizes Fill-Probability-Weighted Expected Value (EV) with adverse-selection guard."}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-cyan-300 text-[10px]">
                TTL: {signal.limit_order_ttl_hours || 8}h •{" "}
                {signal.limit_execution_mode || "PASSIVE_LIMIT"} • Zero-Risk Shield:{" "}
                {(signal.zero_risk_shield_prob_pct ?? 95.4).toFixed(1)}%
              </span>
            </div>

            <div className="p-2 rounded bg-slate-900 border border-cyan-500/30 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-slate-400 block text-[10px]">Leg 1 (60% Reclaim)</span>
                <span className="text-white font-bold">
                  ${(signal.reclaim_trigger_price || safeEntry).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Leg 2 (40% MAE Trap)</span>
                <span className="text-amber-300 font-bold">
                  ${(signal.mae_reserve_price || signal.limit_dip_entry_price).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Blended 60/40 Entry</span>
                <span className="text-cyan-300 font-bold">
                  ${signal.blended_entry_price.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Stop-Hunt Protected SL</span>
                <span className="text-rose-300 font-bold">
                  ${(signal.stop_hunt_protected_sl || customStopPriceUsd).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5 border-t border-slate-800 text-[11px]">
              <div className="bg-slate-900 p-2 rounded border border-emerald-500/40">
                <div className="text-[10px] text-emerald-300 font-bold">TP0 (20% Zero-Risk Shield)</div>
                <div className="text-white font-bold">
                  $
                  {(
                    signal.tp0_price ||
                    safeEntry + Math.abs(safeEntry - customStopPriceUsd) * 0.65
                  ).toFixed(2)}
                </div>
                <div className="text-[9px] text-emerald-200">
                  Lock SL @ ${(signal.breakeven_lock_price || feeAdjustedBreakeven).toFixed(2)}
                </div>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-cyan-500/30">
                <div className="text-[10px] text-slate-400">TP1 (30% De-Risk)</div>
                <div className="text-cyan-300 font-bold">
                  $
                  {(
                    signal.tp1_price ||
                    safeEntry + (targetPrice - safeEntry) * 0.38
                  ).toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-400">Trail SL → TP0</div>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-indigo-500/30">
                <div className="text-[10px] text-slate-400">TP2 (30% Mid-Swing)</div>
                <div className="text-indigo-300 font-bold">
                  $
                  {(
                    signal.tp2_price ||
                    safeEntry + (targetPrice - safeEntry) * 0.68
                  ).toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-400">Trail SL → TP1</div>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-purple-500/30">
                <div className="text-[10px] text-slate-400">TP3 (20% Runner)</div>
                <div className="text-purple-300 font-bold">
                  ${(signal.tp3_price || targetPrice).toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-400">0.85× ATR Ratchet</div>
              </div>
            </div>
          </div>

          {/* Broker Profile Switch */}
          <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 font-semibold">Broker Friction Model:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setBrokerType("EASYEQUITIES_USD")}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  brokerType === "EASYEQUITIES_USD"
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                EasyEquities USD (0.62%)
              </button>
              <button
                onClick={() => setBrokerType("US_ZERO_COMMISSION")}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  brokerType === "US_ZERO_COMMISSION"
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                IBKR / Alpaca (0.065%)
              </button>
            </div>
          </div>

          {/* Interactive Sliders & Number Inputs */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
              <Sliders className="w-4 h-4" />
              INTERACTIVE 0MS REAL-TIME SLIDERS &amp; INPUTS
            </div>

            {/* 1. Live Broker Price ($ USD) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="text-slate-300 font-semibold">
                  1. Live Broker Price ($ USD):
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={liveBrokerPriceUsd}
                  onChange={(e) =>
                    setLiveBrokerPriceUsd(parseFloat(e.target.value) || signal.entry_price)
                  }
                  className="w-28 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right font-mono font-bold text-white"
                />
              </div>
              <input
                type="range"
                min={minPriceSlider}
                max={maxPriceSlider}
                step="0.05"
                value={liveBrokerPriceUsd}
                onChange={(e) => setLiveBrokerPriceUsd(parseFloat(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* 2. Custom Stop-Loss Price ($ USD) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="text-slate-300 font-semibold">
                  2. Custom Stop-Loss Price ($ USD){" "}
                  <span className="text-indigo-400">
                    ({signal.stop_type_badge})
                  </span>
                  :
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={customStopPriceUsd}
                  onChange={(e) =>
                    setCustomStopPriceUsd(parseFloat(e.target.value) || signal.stop_loss)
                  }
                  className="w-28 bg-slate-900 border border-rose-700/60 rounded px-2 py-1 text-right font-mono font-bold text-rose-300"
                />
              </div>
              <input
                type="range"
                min={minStopSlider}
                max={maxStopSlider}
                step="0.05"
                value={customStopPriceUsd}
                onChange={(e) => setCustomStopPriceUsd(parseFloat(e.target.value))}
                className="w-full accent-rose-500"
              />
            </div>

            {/* 3. Cash to Invest ($ USD / R ZAR) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="text-slate-300 font-semibold">
                  3. Cash to Invest ($ USD / R ZAR):
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-2 py-1">
                    <span className="text-slate-400 text-xs mr-1">$</span>
                    <input
                      type="number"
                      step="5"
                      value={cashInvestUsd}
                      onChange={(e) =>
                        setCashInvestUsd(Math.max(5, parseFloat(e.target.value) || 50))
                      }
                      className="w-20 bg-transparent text-right font-mono font-bold text-cyan-300 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-2 py-1">
                    <span className="text-slate-400 text-xs mr-1">R</span>
                    <input
                      type="number"
                      step="100"
                      value={Math.round(cashInvestZar)}
                      onChange={(e) => {
                        const zar = Math.max(100, parseFloat(e.target.value) || 1000);
                        setCashInvestUsd(Number((zar / Math.max(usdzarRate, 0.01)).toFixed(2)));
                      }}
                      className="w-24 bg-transparent text-right font-mono font-bold text-emerald-300 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <input
                type="range"
                min={10}
                max={Math.max(1000, Math.round((accountBalanceZar / usdzarRate) * 1.5))}
                step={5}
                value={cashInvestUsd}
                onChange={(e) => setCashInvestUsd(parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>

          {/* Real-Time Output Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">
                Exact Fractional Shares
              </span>
              <span className="text-base font-mono font-extrabold text-white">
                {exactShares.toFixed(4)} sh
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">
                @ ${safeEntry.toFixed(2)} / share
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">
                Live Net R:R (After {feePct}%)
              </span>
              <span
                className={`text-base font-mono font-extrabold ${
                  liveNetRR >= 1.5 ? "text-emerald-400" : "text-amber-300"
                }`}
              >
                {liveNetRR.toFixed(2)}x
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">
                Breakeven: ${feeAdjustedBreakeven.toFixed(2)}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">
                EasyEquities Sliders
              </span>
              <span className="text-xs font-mono font-bold text-rose-400 block">
                Stop Slider: -{eeStopLossSliderPct.toFixed(2)}%
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400 block">
                TP Slider: +{eeTakeProfitSliderPct.toFixed(2)}%
              </span>
            </div>

            <div className="bg-rose-950/30 p-3 rounded-xl border border-rose-500/30">
              <span className="text-rose-300 block text-[11px]">
                Max Risk (Stop + Friction)
              </span>
              <span className="text-base font-mono font-extrabold text-rose-400">
                -${maxRiskUsd.toFixed(2)} USD
              </span>
              <span className="block text-xs font-mono text-rose-200 font-bold">
                -R {Math.round(maxRiskZar).toLocaleString()} ZAR
              </span>
            </div>

            <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/30">
              <span className="text-emerald-300 block text-[11px]">
                Net Profit (After Friction)
              </span>
              <span className="text-base font-mono font-extrabold text-emerald-400">
                +${netProfitUsd.toFixed(2)} USD
              </span>
              <span className="block text-xs font-mono text-emerald-200 font-bold">
                +R {Math.round(netProfitZar).toLocaleString()} ZAR
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">
                Capped Institutional Target
              </span>
              <span className="text-base font-mono font-extrabold text-indigo-300">
                ${targetPrice.toFixed(2)}
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">
                Call Wall: ${signal.options_intel.call_wall}
              </span>
            </div>
          </div>

          {/* Plan C 50/50 Tranche Breakdown if Plan C is selected */}
          {selectedPlan === "PLAN_C" && (
            <div className="rounded-xl bg-cyan-950/30 border border-cyan-500/40 p-3 text-xs text-cyan-100 space-y-1">
              <div className="font-bold text-cyan-300">
                ⚖️ Plan C (50/50 Institutional Scale-In Breakdown):
              </div>
              <div className="font-mono">
                • Tranche 1 (50% Market Now @ ${signal.entry_price.toFixed(2)}): Invest $
                {(cashInvestUsd * 0.5).toFixed(2)} (R{Math.round(cashInvestZar * 0.5)}) →{" "}
                {((cashInvestUsd * 0.5) / signal.entry_price).toFixed(4)} shares
              </div>
              <div className="font-mono">
                • Tranche 2 (50% Limit Dip @ ${signal.limit_dip_entry_price.toFixed(2)} |{" "}
                {signal.limit_fill_prob_pct.toFixed(0)}% 24h Fill): Invest $
                {(cashInvestUsd * 0.5).toFixed(2)} (R{Math.round(cashInvestZar * 0.5)}) →{" "}
                {((cashInvestUsd * 0.5) / signal.limit_dip_entry_price).toFixed(4)} shares
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold border border-slate-600 transition"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  Copied US Order Ticket!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-cyan-400" />
                  📋 Copy US Order Ticket
                </>
              )}
            </button>

            <button
              onClick={() => {
                onConfirmLogTrade({
                  symbol: signal.symbol,
                  mode: "REAL",
                  broker_profile: brokerType,
                  entry_price: safeEntry,
                  shares: Number(exactShares.toFixed(4)),
                  stop_loss: customStopPriceUsd,
                  target_price: targetPrice,
                  plan_selected: selectedPlan,
                });
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg transition"
            >
              <PlusCircle className="w-4 h-4" />
              ✅ Log Real Trade in 7-Stage Coach
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
