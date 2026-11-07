"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ShieldCheck,
  Sliders,
  Ticket,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  JseOpportunity,
  MacroCommoditySnapshot,
  PortfolioAnalytics,
} from "@/types/market";
import { JSE_EQUITY_FRICTION_PCT, JSE_ETF_FRICTION_PCT } from "@/lib/config";

export interface OrderTicketModalProps {
  opportunity: JseOpportunity | null;
  macro: MacroCommoditySnapshot;
  portfolioAnalytics: PortfolioAnalytics;
  accountCapitalZar: number;
  onClose: () => void;
  onConfirmLogRealTrade: (
    opp: JseOpportunity,
    customEntry?: number,
    customStop?: number,
    customShares?: number
  ) => void;
  onOneClickPaperBuy?: (opp: JseOpportunity) => void;
}

type PlanTab = "PLAN_A" | "PLAN_B" | "PLAN_C";

export const OrderTicketModal: React.FC<OrderTicketModalProps> = ({
  opportunity,
  macro,
  portfolioAnalytics,
  accountCapitalZar,
  onClose,
  onConfirmLogRealTrade,
  onOneClickPaperBuy,
}) => {
  const [activePlan, setActivePlan] = useState<PlanTab>("PLAN_A");
  const [liveBrokerPrice, setLiveBrokerPrice] = useState<number>(100);
  const [customStopLoss, setCustomStopLoss] = useState<number>(95);
  const [cashToInvest, setCashToInvest] = useState<number>(2000);
  const [copiedTicket, setCopiedTicket] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!opportunity) return;
    const recPlan = opportunity.recommended_entry_plan;
    const defaultPlan: PlanTab =
      recPlan === "PLAN_A_MARKET"
        ? "PLAN_A"
        : recPlan === "PLAN_C_50_50_SPLIT"
        ? "PLAN_C"
        : recPlan === "PLAN_B_LIMIT_DIP" ||
          opportunity.verdict_tier === "A_PLUS_LIMIT_DIP"
        ? "PLAN_B"
        : "PLAN_A";
    setActivePlan(defaultPlan);

    const baseEntry =
      defaultPlan === "PLAN_A"
        ? opportunity.entry_price || opportunity.priceZar
        : defaultPlan === "PLAN_B"
        ? opportunity.limit_dip_entry_price || opportunity.priceZar * 0.985
        : opportunity.blended_entry_price || opportunity.priceZar * 0.992;

    setLiveBrokerPrice(Number(baseEntry.toFixed(2)));
    setCustomStopLoss(
      Number(
        (opportunity.hybrid_structural_stop || opportunity.stopLossZar).toFixed(2)
      )
    );

    const kellyPct = Math.max(
      0.04,
      (opportunity.kelly_pct || opportunity.halfKellyWeightPct || 12.0) / 100.0
    );
    const scaledCash = Math.round(
      Math.max(250, Math.min(accountCapitalZar * 0.45, accountCapitalZar * kellyPct))
    );
    setCashToInvest(scaledCash);
  }, [opportunity, accountCapitalZar]);

  if (!opportunity) return null;

  const handlePlanSwitch = (plan: PlanTab) => {
    setActivePlan(plan);
    const planEntry =
      plan === "PLAN_A"
        ? opportunity.entry_price || opportunity.priceZar
        : plan === "PLAN_B"
        ? opportunity.limit_dip_entry_price || opportunity.priceZar * 0.985
        : opportunity.blended_entry_price || opportunity.priceZar * 0.992;
    setLiveBrokerPrice(Number(planEntry.toFixed(2)));
  };

  // JSE friction (shared constants: see lib/config.ts)
  const frictionPct =
    opportunity.roundTripFrictionPct ||
    (opportunity.sttExempt || opportunity.tfsa_badge
      ? JSE_ETF_FRICTION_PCT
      : JSE_EQUITY_FRICTION_PCT);
  const frictionDec = frictionPct / 100.0;

  const targetPrice = Number(
    (opportunity.target_price || opportunity.targetPriceZar).toFixed(2)
  );
  const entrySafe = Math.max(0.01, liveBrokerPrice);
  const stopSafe = Math.min(entrySafe * 0.995, Math.max(0.01, customStopLoss));
  const cashSafe = Math.max(50, cashToInvest);

  // Real-time 0ms calculations
  const exactFractionalShares = Number((cashSafe / entrySafe).toFixed(4));
  const feeAdjustedBreakeven = Number((entrySafe * (1.0 + frictionDec)).toFixed(2));

  const grossRewardPct = ((targetPrice - entrySafe) / entrySafe) * 100.0;
  const netRewardPct = Math.max(0.05, grossRewardPct - frictionPct);
  const stopDistPct = Math.max(0.15, ((entrySafe - stopSafe) / entrySafe) * 100.0);
  const totalRiskPct = stopDistPct + frictionPct * 0.5;
  const liveNetRr = Number((netRewardPct / Math.max(0.2, totalRiskPct)).toFixed(2));

  // EasyEquities Stop-Loss % and Take-Profit % Slider Values
  const eeStopLossSliderPct = Number(stopDistPct.toFixed(2));
  const eeTakeProfitSliderPct = Number(Math.max(0.5, grossRewardPct).toFixed(2));

  // Max Risk (-R) and Net Profit (+R)
  const maxRiskZar = Number((cashSafe * (totalRiskPct / 100.0)).toFixed(2));
  const netProfitZar = Number((cashSafe * (netRewardPct / 100.0)).toFixed(2));
  const accountRiskPct = Number(
    ((maxRiskZar / Math.max(500, accountCapitalZar)) * 100.0).toFixed(2)
  );

  // Price slider bounds
  const baseSpot = opportunity.priceZar || 100;
  const minPriceSlider = Number((baseSpot * 0.9).toFixed(2));
  const maxPriceSlider = Number((baseSpot * 1.06).toFixed(2));
  const minStopSlider = Number((baseSpot * 0.82).toFixed(2));
  const maxStopSlider = Number((entrySafe * 0.99).toFixed(2));

  const copyFieldVal = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1600);
  };

  const handleCopyFullTicket = () => {
    const planLabel =
      activePlan === "PLAN_A"
        ? "Plan A (100% Market Order)"
        : activePlan === "PLAN_B"
        ? `Plan B (100% Sniper Limit Dip Order — 24h Fill Prob: ${opportunity.limit_fill_prob_pct}%)`
        : "Plan C (50% Market Now + 50% Limit Dip Scale-In)";

    const ticketText = [
      `=== JSE SOVEREIGN V10.1 EASYEQUITIES ORDER TICKET ===`,
      `Ticker: ${opportunity.ticker} (${opportunity.name})`,
      `Account Type: ${
        opportunity.sttExempt
          ? `EasyEquities TFSA / ZAR (0% STT Exempt ETF — ${JSE_ETF_FRICTION_PCT.toFixed(2)}% Friction)`
          : `EasyEquities ZAR Standard (0.25% STT Included — ${JSE_EQUITY_FRICTION_PCT.toFixed(2)}% Friction)`
      }`,
      `Execution Plan: ${planLabel}`,
      `Cash to Invest: R ${cashSafe.toFixed(2)} ZAR (Account Base: R ${accountCapitalZar.toLocaleString()})`,
      `Order Entry Price: R ${entrySafe.toFixed(2)} (${exactFractionalShares} fractional shares)`,
      activePlan === "PLAN_C"
        ? `  -> Leg 1 (50% Market Now): R ${(cashSafe * 0.5).toFixed(2)} @ R ${(opportunity.entry_price || opportunity.priceZar).toFixed(2)}\n  -> Leg 2 (50% Limit Dip): R ${(cashSafe * 0.5).toFixed(2)} @ R ${(opportunity.limit_dip_entry_price || opportunity.priceZar * 0.985).toFixed(2)}`
        : null,
      `Protected Stop-Loss: R ${stopSafe.toFixed(2)} (${opportunity.stop_type_badge})`,
      `  -> EasyEquities Stop-Loss Slider: -${eeStopLossSliderPct}% | Max Loss: -R ${maxRiskZar.toFixed(2)}`,
      `Fee-Adjusted Breakeven: R ${feeAdjustedBreakeven.toFixed(2)}`,
      `Conformal Capped Target: R ${targetPrice.toFixed(2)}`,
      `  -> EasyEquities Take-Profit Slider: +${eeTakeProfitSliderPct}% | Net Win: +R ${netProfitZar.toFixed(2)} (+${netRewardPct.toFixed(2)}% NET)`,
      `Net Reward-to-Risk: ${liveNetRr}x | A+ Gates Passed: ${opportunity.aplus_gates_passed}/12`,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(ticketText);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0D1322] border border-emerald-500/60 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Ticket className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white">
                  1-Click EasyEquities Broker Order Ticket
                </h3>
                {opportunity.tfsa_badge ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-mono text-[10px] font-bold">
                    {opportunity.tfsa_badge}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                    {JSE_EQUITY_FRICTION_PCT.toFixed(2)}% Equity Friction (0.25% JSE STT Included)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {opportunity.ticker} — {opportunity.name} • {opportunity.stop_type_badge}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Plan A / Plan B / Plan C Execution Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
          <button
            onClick={() => handlePlanSwitch("PLAN_A")}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
              activePlan === "PLAN_A"
                ? "bg-emerald-500/20 border-emerald-500 text-white shadow-lg"
                : "bg-[#060911] border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="font-bold text-[11px] text-emerald-300">
              Plan A (100% Market)
            </div>
            <div className="text-sm font-extrabold mt-0.5">
              R{(opportunity.entry_price || opportunity.priceZar).toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400">
              Net R:R: {opportunity.net_rr_market || opportunity.netRrRatio}x • Instant Fill
            </div>
          </button>

          <button
            onClick={() => handlePlanSwitch("PLAN_B")}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
              activePlan === "PLAN_B"
                ? "bg-amber-500/20 border-amber-400 text-white shadow-lg"
                : "bg-[#060911] border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="font-bold text-[11px] text-amber-300">
              Plan B (100% Limit Dip)
            </div>
            <div className="text-sm font-extrabold mt-0.5">
              R{(opportunity.limit_dip_entry_price || opportunity.priceZar * 0.985).toFixed(2)}
            </div>
            <div className="text-[10px] text-amber-200">
              Net R:R: {opportunity.net_rr_limit_dip}x • Fill Prob:{" "}
              {opportunity.limit_fill_prob_pct}%
            </div>
          </button>

          <button
            onClick={() => handlePlanSwitch("PLAN_C")}
            disabled={opportunity.plan_c_viable === false}
            title={
              opportunity.plan_c_viable === false
                ? "Position < R2,500: 50/50 split disabled to prevent double brokerage fee drag"
                : "50% Market Now + 50% Limit Dip Scale-In"
            }
            className={`p-2.5 rounded-xl border text-left transition ${
              opportunity.plan_c_viable === false
                ? "bg-[#060911]/50 border-slate-800/60 text-slate-600 opacity-50 cursor-not-allowed"
                : activePlan === "PLAN_C"
                ? "bg-cyan-500/20 border-cyan-400 text-white shadow-lg cursor-pointer"
                : "bg-[#060911] border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
            }`}
          >
            <div className="font-bold text-[11px] text-cyan-300">
              Plan C (50/50 Scale-In)
            </div>
            <div className="text-sm font-extrabold mt-0.5">
              R{(opportunity.blended_entry_price || opportunity.priceZar * 0.992).toFixed(2)}
            </div>
            <div className="text-[10px] text-cyan-200">
              Blended Net R:R: {opportunity.blended_net_rr}x • Institutional Split
            </div>
          </button>
        </div>

        {/* V12.2 Why This Plan Was Selected, Elastic 60/40 Box & 4-Step Profit Target Ladder */}
        <div className="bg-[#060911] border border-emerald-500/30 rounded-xl p-3 font-mono text-xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-200">
              <strong className="text-amber-300">
                🧠 V12.2 Plan Selector ({opportunity.recommended_entry_plan || "PLAN_B_LIMIT_DIP"}):
              </strong>{" "}
              {opportunity.entry_plan_reason ||
                "Maximizes Fill-Probability-Weighted Expected Value (EV) with adverse-selection guard."}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px]">
              Limit TTL: {opportunity.limit_order_ttl_hours || 8}h •{" "}
              {opportunity.limit_execution_mode || "PASSIVE_LIMIT"} • Zero-Risk Shield:{" "}
              {(opportunity.zero_risk_shield_prob_pct ?? 95.4).toFixed(1)}%
            </span>
          </div>

          <div className="p-2 rounded bg-[#0D1322] border border-cyan-500/30 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-slate-400 block text-[10px]">Leg 1 (60% Reclaim)</span>
              <span className="text-white font-bold">
                R{(opportunity.reclaim_trigger_price || entrySafe).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Leg 2 (40% MAE Trap)</span>
              <span className="text-amber-300 font-bold">
                R{(opportunity.mae_reserve_price || opportunity.limit_dip_entry_price || entrySafe * 0.985).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Blended 60/40 Entry</span>
              <span className="text-cyan-300 font-bold">
                R{(opportunity.blended_entry_price || entrySafe * 0.992).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Stop-Hunt Protected SL</span>
              <span className="text-rose-300 font-bold">
                R{(opportunity.stop_hunt_protected_sl || stopSafe).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5 border-t border-slate-800 text-[11px]">
            <div className="bg-[#0D1322] p-2 rounded border border-emerald-500/40">
              <div className="text-[10px] text-emerald-300 font-bold">TP0 (20% Zero-Risk Shield)</div>
              <div className="text-white font-bold">
                R
                {(
                  opportunity.tp0_price ||
                  entrySafe + Math.abs(entrySafe - stopSafe) * 0.65
                ).toFixed(2)}
              </div>
              <div className="text-[9px] text-emerald-200">
                Lock SL @ R{(opportunity.breakeven_lock_price || feeAdjustedBreakeven).toFixed(2)}
              </div>
            </div>
            <div className="bg-[#0D1322] p-2 rounded border border-cyan-500/30">
              <div className="text-[10px] text-slate-400">TP1 (30% De-Risk)</div>
              <div className="text-cyan-300 font-bold">
                R
                {(
                  opportunity.tp1_price ||
                  entrySafe + (targetPrice - entrySafe) * 0.38
                ).toFixed(2)}
              </div>
              <div className="text-[9px] text-slate-400">Trail SL → TP0</div>
            </div>
            <div className="bg-[#0D1322] p-2 rounded border border-indigo-500/30">
              <div className="text-[10px] text-slate-400">TP2 (30% Mid-Swing)</div>
              <div className="text-indigo-300 font-bold">
                R
                {(
                  opportunity.tp2_price ||
                  entrySafe + (targetPrice - entrySafe) * 0.68
                ).toFixed(2)}
              </div>
              <div className="text-[9px] text-slate-400">Trail SL → TP1</div>
            </div>
            <div className="bg-[#0D1322] p-2 rounded border border-purple-500/30">
              <div className="text-[10px] text-slate-400">TP3 (20% Runner)</div>
              <div className="text-purple-300 font-bold">
                R{(opportunity.tp3_price || targetPrice).toFixed(2)}
              </div>
              <div className="text-[9px] text-slate-400">0.85× ATR Ratchet</div>
            </div>
          </div>
        </div>

        {/* Plan C Split Breakdown Banner */}
        {activePlan === "PLAN_C" && (
          <div className="bg-cyan-950/30 border border-cyan-500/40 rounded-xl p-3 font-mono text-xs flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-cyan-300 font-bold">Leg 1 (50% Market Now):</span>{" "}
              <span className="text-white">
                R{(cashSafe * 0.5).toFixed(2)} @ R{(opportunity.entry_price || opportunity.priceZar).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-amber-300 font-bold">
                Leg 2 (50% Limit Dip — {opportunity.limit_fill_prob_pct ?? 68}% 24h Fill):
              </span>{" "}
              <span className="text-white">
                R{(cashSafe * 0.5).toFixed(2)} @ R{(opportunity.limit_dip_entry_price || opportunity.priceZar * 0.985).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Interactive 0ms What-If Sliders & Number Inputs */}
        <div className="bg-[#060911] border border-slate-800 rounded-xl p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Interactive 0ms "What-If" Broker Execution Sliders
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Target Capped @ Conformal P95: R{targetPrice.toFixed(2)}
            </span>
          </div>

          {/* Slider 1: Live Broker Price (R ZAR) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300">Live Broker Entry Price (R ZAR):</label>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">R</span>
                <input
                  type="number"
                  step="0.05"
                  value={liveBrokerPrice}
                  onChange={(e) => setLiveBrokerPrice(Number(e.target.value) || 0)}
                  className="w-24 bg-[#0D1322] border border-slate-700 rounded px-2 py-0.5 text-right text-white font-bold"
                />
              </div>
            </div>
            <input
              type="range"
              min={minPriceSlider}
              max={maxPriceSlider}
              step={Math.max(0.01, Number(((maxPriceSlider - minPriceSlider) / 100).toFixed(2)))}
              value={Math.min(maxPriceSlider, Math.max(minPriceSlider, liveBrokerPrice))}
              onChange={(e) => setLiveBrokerPrice(Number(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* Slider 2: Custom Stop-Loss Price (R ZAR) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300">
                Custom Stop-Loss Price (R ZAR){" "}
                <span className="text-[10px] text-emerald-400">
                  (Smart VAH/VPOC Floor: R{(opportunity.hybrid_structural_stop || opportunity.stopLossZar).toFixed(2)})
                </span>
                :
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">R</span>
                <input
                  type="number"
                  step="0.05"
                  value={customStopLoss}
                  onChange={(e) => setCustomStopLoss(Number(e.target.value) || 0)}
                  className="w-24 bg-[#0D1322] border border-rose-500/50 rounded px-2 py-0.5 text-right text-rose-300 font-bold"
                />
              </div>
            </div>
            <input
              type="range"
              min={minStopSlider}
              max={maxStopSlider}
              step={Math.max(0.01, Number(((maxStopSlider - minStopSlider) / 100).toFixed(2)))}
              value={Math.min(maxStopSlider, Math.max(minStopSlider, customStopLoss))}
              onChange={(e) => setCustomStopLoss(Number(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* Slider 3: Cash to Invest (R ZAR) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300">
                Cash to Invest (R ZAR){" "}
                <span className="text-[10px] text-cyan-300">
                  (Kelly {opportunity.kelly_pct}% of R{accountCapitalZar.toLocaleString()})
                </span>
                :
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">R</span>
                <input
                  type="number"
                  step="100"
                  value={cashToInvest}
                  onChange={(e) => setCashToInvest(Number(e.target.value) || 0)}
                  className="w-28 bg-[#0D1322] border border-emerald-500/50 rounded px-2 py-0.5 text-right text-emerald-300 font-bold"
                />
              </div>
            </div>
            <input
              type="range"
              min={250}
              max={Math.max(2000, accountCapitalZar)}
              step={50}
              value={Math.min(Math.max(2000, accountCapitalZar), Math.max(250, cashToInvest))}
              onChange={(e) => setCashToInvest(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>

        {/* Real-Time Calculated Broker Output Box */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
          <div className="bg-[#060911] border border-slate-800 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">FRACTIONAL SHARES</div>
            <div className="text-sm font-extrabold text-white mt-0.5">
              {exactFractionalShares} sh
            </div>
            <div className="text-[10px] text-slate-500">
              @ R{entrySafe.toFixed(2)}
            </div>
          </div>

          <div className="bg-[#060911] border border-slate-800 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">LIVE NET R:R (AFTER STT)</div>
            <div
              className={`text-sm font-extrabold mt-0.5 ${
                liveNetRr >= 1.65
                  ? "text-emerald-400"
                  : liveNetRr >= 1.45
                  ? "text-amber-300"
                  : "text-rose-400"
              }`}
            >
              {liveNetRr}x NET
            </div>
            <div className="text-[10px] text-slate-500">
              Friction: {frictionPct}%
            </div>
          </div>

          <div className="bg-[#060911] border border-slate-800 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">FEE-ADJ BREAKEVEN</div>
            <div className="text-sm font-extrabold text-cyan-300 mt-0.5">
              R{feeAdjustedBreakeven.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500">
              +{frictionPct}% Cover
            </div>
          </div>

          <div className="bg-[#060911] border border-slate-800 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">MAX RISK / NET PROFIT</div>
            <div className="text-xs font-extrabold mt-0.5">
              <span className="text-rose-400">-R{maxRiskZar.toFixed(0)}</span>{" "}
              <span className="text-slate-600">/</span>{" "}
              <span className="text-emerald-400">+R{netProfitZar.toFixed(0)}</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Acct Risk: {accountRiskPct}%
            </div>
          </div>
        </div>

        {/* EasyEquities Stop-Loss % and Take-Profit % Slider Values + Copy Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
          <div className="bg-[#060911] border border-rose-500/40 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-rose-300 text-[10px] font-bold">
                EASYEQUITIES STOP-LOSS SLIDER
              </div>
              <div className="text-base font-extrabold text-white">
                -{eeStopLossSliderPct}%{" "}
                <span className="text-xs text-rose-300">(R{stopSafe.toFixed(2)})</span>
              </div>
              <div className="text-[10px] text-slate-400">
                Max Loss: -R{maxRiskZar.toFixed(2)}
              </div>
            </div>
            <button
              onClick={() => copyFieldVal("stop", stopSafe.toFixed(2))}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              title="Copy Stop-Loss Price"
            >
              {copiedField === "stop" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="bg-[#060911] border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-emerald-300 text-[10px] font-bold">
                EASYEQUITIES TAKE-PROFIT SLIDER
              </div>
              <div className="text-base font-extrabold text-white">
                +{eeTakeProfitSliderPct}%{" "}
                <span className="text-xs text-emerald-300">(R{targetPrice.toFixed(2)})</span>
              </div>
              <div className="text-[10px] text-slate-400">
                Net Win (after STT): +R{netProfitZar.toFixed(2)}
              </div>
            </div>
            <button
              onClick={() => copyFieldVal("target", targetPrice.toFixed(2))}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              title="Copy Take-Profit Price"
            >
              {copiedField === "target" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Flight Verification Summary */}
        <div className="bg-[#060911] border border-slate-800 rounded-xl p-3 space-y-1 font-mono text-[11px]">
          <div className="text-xs font-bold text-white flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Pre-Flight Verification ({opportunity.aplus_gates_passed}/12 A+ Gates)
            </span>
            {opportunity.earnings_warning_badge && (
              <span className="text-amber-300 text-[10px]">
                {opportunity.earnings_warning_badge}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-slate-300">
            <div className="flex items-center gap-1.5">
              {liveNetRr >= 1.45 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span>Net R:R {liveNetRr}x (Threshold &ge; 1.45x Mkt / 1.65x Dip)</span>
            </div>
            <div className="flex items-center gap-1.5">
              {macro.jseSessionStatus !== "CLOSING_AUCTION_TALX" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span>Outside 16:50 SAST Talx Closing Auction</span>
            </div>
            <div className="flex items-center gap-1.5">
              {!portfolioAnalytics.correlationClusterWarning ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span>Portfolio Correlation Safe (&rho; = {opportunity.max_portfolio_corr})</span>
            </div>
            <div className="flex items-center gap-1.5">
              {accountRiskPct <= 2.2 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span>Account Risk Capped ({accountRiskPct}% of R{accountCapitalZar.toLocaleString()})</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            onClick={handleCopyFullTicket}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
          >
            {copiedTicket ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                Copied Full EasyEquities Order Ticket!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                📋 Copy EasyEquities Order Ticket
              </>
            )}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {onOneClickPaperBuy && (
              <button
                onClick={() => {
                  onOneClickPaperBuy(opportunity);
                  onClose();
                }}
                className="px-3 py-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/35 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                🧪 Paper Buy
              </button>
            )}
            <button
              onClick={() => {
                onConfirmLogRealTrade(
                  opportunity,
                  entrySafe,
                  stopSafe,
                  exactFractionalShares
                );
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold cursor-pointer"
            >
              🟢 Log Real Broker Trade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
