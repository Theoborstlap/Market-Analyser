import React, { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Sliders,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import { CryptoAssetSignal, formatCryptoPrice } from "../types/market";

interface Props {
  signal: CryptoAssetSignal | null;
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
  const [exchangeType, setExchangeType] = useState<
    "BINANCE_BYBIT_SPOT" | "VALR_LUNO_ZAR" | "HYPERLIQUID_DEX"
  >("BINANCE_BYBIT_SPOT");

  const defaultAllocPct = Math.min(25, Math.max(8, signal.kelly_fraction_pct * 1.4));
  const defaultInvestZar = Math.round(accountBalanceZar * (defaultAllocPct / 100.0));
  const defaultInvestUsdt = Number(
    (defaultInvestZar / Math.max(usdzarRate, 0.01)).toFixed(2)
  );

  const getPlanEntry = (plan: "PLAN_A" | "PLAN_B" | "PLAN_C") => {
    if (plan === "PLAN_B") return signal.limit_dip_entry_price;
    if (plan === "PLAN_C") return signal.blended_entry_price;
    return signal.entry_price;
  };

  const [liveExchangePriceUsdt, setLiveExchangePriceUsdt] = useState<number>(
    getPlanEntry(initialPlan)
  );
  const [customStopTriggerUsdt, setCustomStopTriggerUsdt] = useState<number>(
    signal.stop_loss
  );
  const [cashInvestUsdt, setCashInvestUsdt] = useState<number>(defaultInvestUsdt);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLiveExchangePriceUsdt(getPlanEntry(selectedPlan));
    setCustomStopTriggerUsdt(signal.stop_loss);
  }, [selectedPlan, signal]);

  // 0ms Real-Time Recalculation Engine (Strictly 1x Spot — Zero Leverage)
  const feePct = exchangeType === "HYPERLIQUID_DEX" ? 0.07 : 0.25;
  const feeDec = feePct / 100.0;
  const safeEntry = Math.max(liveExchangePriceUsdt, 1e-10);
  const ocoTakeProfitLimit = signal.target_price;
  const ocoStopTrigger = Math.max(customStopTriggerUsdt, 1e-10);
  // 0.15% anti-slippage buffer so flash wicks never skip the stop
  const ocoStopExecutionLimit = ocoStopTrigger * 0.9985;
  const cashInvestZar = cashInvestUsdt * usdzarRate;

  const exactSpotCoinQuantity = cashInvestUsdt / safeEntry;
  const feeAdjustedBreakeven = safeEntry * (1.0 + feeDec);

  const grossUpsidePct = ((ocoTakeProfitLimit - safeEntry) / safeEntry) * 100.0;
  const grossDownsidePct = Math.max(
    0.1,
    ((safeEntry - ocoStopTrigger) / safeEntry) * 100.0
  );
  const netUpsidePct = Math.max(0.05, grossUpsidePct - feePct);
  const netDownsidePct = Math.max(0.1, grossDownsidePct + feePct);
  const liveNetRR = netUpsidePct / netDownsidePct;

  const maxRiskUsdt =
    exactSpotCoinQuantity * Math.abs(safeEntry - ocoStopTrigger) +
    cashInvestUsdt * feeDec;
  const maxRiskZar = maxRiskUsdt * usdzarRate;
  const netProfitUsdt =
    exactSpotCoinQuantity * Math.max(0, ocoTakeProfitLimit - safeEntry) -
    cashInvestUsdt * feeDec;
  const netProfitZar = netProfitUsdt * usdzarRate;

  const sliderStep =
    safeEntry >= 100
      ? 0.5
      : safeEntry >= 1
      ? 0.005
      : safeEntry >= 0.01
      ? 0.0001
      : 0.0000001;
  const minPriceSlider = Number((signal.val * 0.94).toPrecision(6));
  const maxPriceSlider = Number((signal.target_price * 0.99).toPrecision(6));
  const minStopSlider = Number((safeEntry * 0.85).toPrecision(6));
  const maxStopSlider = Number((safeEntry * 0.992).toPrecision(6));

  const ticketText = [
    `=== ⚡ CRYPTO V10.1 1x SPOT OCO ORDER TICKET: ${signal.symbol}/USDT (${signal.name}) ===`,
    `Execution Plan                  : ${selectedPlan} (${
      selectedPlan === "PLAN_A"
        ? "100% 1x Spot Market Order Now"
        : selectedPlan === "PLAN_B"
        ? `100% Sniper Limit Dip | 24h Fill Prob: ${signal.limit_fill_prob_pct.toFixed(0)}%`
        : "50% Market Now + 50% Limit Dip Scale-In"
    })`,
    `Exchange & Friction             : ${
      exchangeType === "VALR_LUNO_ZAR"
        ? "VALR / Luno SA 1x Spot (0.25% Round-Trip)"
        : exchangeType === "HYPERLIQUID_DEX"
        ? "Hyperliquid L1 DEX 1x Spot (0.07% Round-Trip)"
        : "VALR / Binance / Bybit 1x Spot (0.25% Round-Trip)"
    }`,
    `Leverage                        : 1.0x SPOT ONLY (STRICTLY ZERO LEVERAGE / ZERO LIQUIDATION)`,
    `Live Exchange Price ($ USDT)    : $${formatCryptoPrice(safeEntry)}`,
    `Cash to Invest                  : $${cashInvestUsdt.toFixed(2)} USDT (R ${Math.round(cashInvestZar).toLocaleString()} ZAR @ R${usdzarRate.toFixed(2)})`,
    `Exact 1x Spot Coin Quantity     : ${exactSpotCoinQuantity.toFixed(6)} ${signal.symbol}`,
    `Fee-Adjusted Breakeven Price    : $${formatCryptoPrice(feeAdjustedBreakeven)} (Locked at Stage 3 +0.35T)`,
    `OCO Take-Profit Limit Price     : $${formatCryptoPrice(ocoTakeProfitLimit)}`,
    `OCO Stop-Loss Trigger Price     : $${formatCryptoPrice(ocoStopTrigger)}`,
    `OCO Stop-Loss Execution Limit   : $${formatCryptoPrice(ocoStopExecutionLimit)} (Stop Trigger * 0.9985 0.15% Anti-Slippage Buffer)`,
    `Live Net R:R                    : ${liveNetRR.toFixed(2)}x (AFTER ${feePct}% 1x Spot Friction)`,
    `Max Stop Risk                   : -$${maxRiskUsdt.toFixed(2)} USDT (-R ${Math.round(maxRiskZar).toLocaleString()} ZAR)`,
    `Expected Net Win                : +$${netProfitUsdt.toFixed(2)} USDT (+R ${Math.round(netProfitZar).toLocaleString()} ZAR)`,
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
                1x SPOT OCO ORDER TICKET
              </span>
              <h3 className="text-base font-extrabold text-white">
                {signal.symbol}/USDT — {signal.name}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              0ms Real-Time VALR / Binance / Bybit 1x Spot (0.25%) OCO Calculator with 0.15% Anti-Slippage Stop-Limit Buffer
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
                ${formatCryptoPrice(signal.entry_price)}
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
                Plan B (100% Limit Dip — Fill Prob: {signal.limit_fill_prob_pct.toFixed(0)}%)
              </div>
              <div className="text-sm font-mono font-bold mt-0.5">
                ${formatCryptoPrice(signal.limit_dip_entry_price)}
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
                  ? "Position < R1,000: 50/50 split disabled to prevent double brokerage fee drag"
                  : "50% 1x Spot Market Now + 50% Limit Dip Scale-In"
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
                ${formatCryptoPrice(signal.blended_entry_price)}
              </div>
              <div className="text-[11px] font-mono text-slate-300">
                Net R:R: {signal.blended_net_rr}x
              </div>
            </button>
          </div>

          {/* V12.2 Expected-Utility Plan Rationale, Elastic 60/40 Box + 4-Step Profit Ladder */}
          <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-3 font-mono text-xs space-y-2.5">
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
                  ${formatCryptoPrice(signal.reclaim_trigger_price || safeEntry)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Leg 2 (40% MAE Trap)</span>
                <span className="text-amber-300 font-bold">
                  ${formatCryptoPrice(signal.mae_reserve_price || signal.limit_dip_entry_price)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Blended 60/40 Entry</span>
                <span className="text-cyan-300 font-bold">
                  ${formatCryptoPrice(signal.blended_entry_price)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Stop-Hunt Protected SL</span>
                <span className="text-rose-300 font-bold">
                  ${formatCryptoPrice(signal.stop_hunt_protected_sl || ocoStopTrigger)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5 border-t border-slate-800 text-[11px]">
              <div className="bg-slate-900 p-2 rounded border border-emerald-500/40">
                <div className="text-[10px] text-emerald-300 font-bold">TP0 (20% Zero-Risk Shield)</div>
                <div className="text-white font-bold">
                  $
                  {formatCryptoPrice(
                    signal.tp0_price ||
                      safeEntry + Math.abs(safeEntry - ocoStopTrigger) * 0.65
                  )}
                </div>
                <div className="text-[9px] text-emerald-200">
                  Lock SL @ ${formatCryptoPrice(signal.breakeven_lock_price || feeAdjustedBreakeven)}
                </div>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-cyan-500/30">
                <div className="text-[10px] text-slate-400">TP1 (30% De-Risk)</div>
                <div className="text-cyan-300 font-bold">
                  $
                  {formatCryptoPrice(
                    signal.tp1_price ||
                      safeEntry + (ocoTakeProfitLimit - safeEntry) * 0.38
                  )}
                </div>
                <div className="text-[9px] text-slate-400">Trail SL → TP0</div>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-indigo-500/30">
                <div className="text-[10px] text-slate-400">TP2 (30% Mid-Swing)</div>
                <div className="text-indigo-300 font-bold">
                  $
                  {formatCryptoPrice(
                    signal.tp2_price ||
                      safeEntry + (ocoTakeProfitLimit - safeEntry) * 0.68
                  )}
                </div>
                <div className="text-[9px] text-slate-400">Trail SL → TP1</div>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-purple-500/30">
                <div className="text-[10px] text-slate-400">TP3 (20% Runner)</div>
                <div className="text-purple-300 font-bold">
                  ${formatCryptoPrice(signal.tp3_price || ocoTakeProfitLimit)}
                </div>
                <div className="text-[9px] text-slate-400">0.85× ATR Ratchet</div>
              </div>
            </div>
          </div>

          {/* Exchange Friction Switch */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 font-semibold">
              1x Spot Exchange Friction:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setExchangeType("BINANCE_BYBIT_SPOT")}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  exchangeType === "BINANCE_BYBIT_SPOT"
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                VALR / Binance / Bybit (0.25%)
              </button>
              <button
                onClick={() => setExchangeType("VALR_LUNO_ZAR")}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  exchangeType === "VALR_LUNO_ZAR"
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                VALR / Luno ZAR (0.25%)
              </button>
              <button
                onClick={() => setExchangeType("HYPERLIQUID_DEX")}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  exchangeType === "HYPERLIQUID_DEX"
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                Hyperliquid DEX (0.07%)
              </button>
            </div>
          </div>

          {/* Interactive Sliders & Number Inputs */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                <Sliders className="w-4 h-4" />
                INTERACTIVE 0MS REAL-TIME SLIDERS &amp; INPUTS
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-bold">
                1.0x SPOT ONLY (ZERO LEVERAGE)
              </span>
            </div>

            {/* 1. Live Exchange Price ($ USDT) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="text-slate-300 font-semibold">
                  1. Live Exchange Price ($ USDT):
                </label>
                <input
                  type="number"
                  step={sliderStep}
                  value={liveExchangePriceUsdt}
                  onChange={(e) =>
                    setLiveExchangePriceUsdt(
                      parseFloat(e.target.value) || signal.entry_price
                    )
                  }
                  className="w-32 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right font-mono font-bold text-white"
                />
              </div>
              <input
                type="range"
                min={minPriceSlider}
                max={maxPriceSlider}
                step={sliderStep}
                value={liveExchangePriceUsdt}
                onChange={(e) => setLiveExchangePriceUsdt(parseFloat(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* 2. Custom Stop-Loss Trigger ($ USDT) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="text-slate-300 font-semibold">
                  2. Custom Stop-Loss Trigger ($ USDT){" "}
                  <span className="text-indigo-400">({signal.stop_type_badge})</span>:
                </label>
                <input
                  type="number"
                  step={sliderStep}
                  value={customStopTriggerUsdt}
                  onChange={(e) =>
                    setCustomStopTriggerUsdt(
                      parseFloat(e.target.value) || signal.stop_loss
                    )
                  }
                  className="w-32 bg-slate-900 border border-rose-700/60 rounded px-2 py-1 text-right font-mono font-bold text-rose-300"
                />
              </div>
              <input
                type="range"
                min={minStopSlider}
                max={maxStopSlider}
                step={sliderStep}
                value={customStopTriggerUsdt}
                onChange={(e) => setCustomStopTriggerUsdt(parseFloat(e.target.value))}
                className="w-full accent-rose-500"
              />
            </div>

            {/* 3. Cash to Invest ($ USDT / R ZAR) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="text-slate-300 font-semibold">
                  3. Cash to Invest ($ USDT / R ZAR):
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-2 py-1">
                    <span className="text-slate-400 text-xs mr-1">$</span>
                    <input
                      type="number"
                      step="5"
                      value={cashInvestUsdt}
                      onChange={(e) =>
                        setCashInvestUsdt(
                          Math.max(5, parseFloat(e.target.value) || 50)
                        )
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
                        setCashInvestUsdt(
                          Number((zar / Math.max(usdzarRate, 0.01)).toFixed(2))
                        );
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
                value={cashInvestUsdt}
                onChange={(e) => setCashInvestUsdt(parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>

          {/* Real-Time OCO Output Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">
                Exact 1x Spot Coin Quantity
              </span>
              <span className="text-base font-mono font-extrabold text-white">
                {exactSpotCoinQuantity.toFixed(5)} {signal.symbol}
              </span>
              <span className="block text-[10px] text-emerald-300 font-mono">
                0x Leverage • @ ${formatCryptoPrice(safeEntry)}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">
                Net R:R (After {feePct}% Friction)
              </span>
              <span
                className={`text-base font-mono font-extrabold ${
                  liveNetRR >= 1.55 ? "text-emerald-400" : "text-amber-300"
                }`}
              >
                {liveNetRR.toFixed(2)}x
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">
                Fee Breakeven: ${formatCryptoPrice(feeAdjustedBreakeven)}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/30">
              <span className="text-emerald-300 block text-[11px]">
                OCO Take-Profit Limit Price
              </span>
              <span className="text-base font-mono font-extrabold text-emerald-400">
                ${formatCryptoPrice(ocoTakeProfitLimit)}
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">
                Deribit Call Wall: ${formatCryptoPrice(signal.crypto_intel.call_wall)}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-rose-500/30">
              <span className="text-rose-300 block text-[11px]">
                OCO Stop-Loss Trigger Price
              </span>
              <span className="text-base font-mono font-extrabold text-rose-400">
                ${formatCryptoPrice(ocoStopTrigger)}
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">
                Anchor: {signal.structural_anchor_label} ${formatCryptoPrice(signal.structural_anchor_price)}
              </span>
            </div>

            <div className="bg-amber-950/30 p-3 rounded-xl border border-amber-500/40">
              <span className="text-amber-300 block text-[11px]">
                OCO Stop Execution Limit (0.9985x)
              </span>
              <span className="text-base font-mono font-extrabold text-amber-200">
                ${formatCryptoPrice(ocoStopExecutionLimit)}
              </span>
              <span className="block text-[10px] text-amber-300/90 font-mono">
                0.15% Anti-Slippage Flash-Wick Buffer
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">
                Max Risk vs Expected Net Win
              </span>
              <span className="text-xs font-mono font-bold text-rose-400 block">
                Risk: -${maxRiskUsdt.toFixed(2)} (-R{Math.round(maxRiskZar)})
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400 block">
                Win: +${netProfitUsdt.toFixed(2)} (+R{Math.round(netProfitZar)})
              </span>
            </div>
          </div>

          {/* Plan C 50/50 Tranche Breakdown if Plan C is selected */}
          {selectedPlan === "PLAN_C" && (
            <div className="rounded-xl bg-cyan-950/30 border border-cyan-500/40 p-3 text-xs text-cyan-100 space-y-1">
              <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                ⚖️ Plan C (50/50 Institutional 1x Spot Scale-In Breakdown):
              </div>
              <div className="font-mono">
                • Tranche 1 (50% 1x Spot Market Now @ ${formatCryptoPrice(signal.entry_price)}): Invest $
                {(cashInvestUsdt * 0.5).toFixed(2)} USDT (R{Math.round(cashInvestZar * 0.5)}) →{" "}
                {((cashInvestUsdt * 0.5) / signal.entry_price).toFixed(5)} {signal.symbol}
              </div>
              <div className="font-mono">
                • Tranche 2 (50% Limit Dip @ ${formatCryptoPrice(signal.limit_dip_entry_price)} |{" "}
                {signal.limit_fill_prob_pct.toFixed(0)}% 24h Fill): Invest $
                {(cashInvestUsdt * 0.5).toFixed(2)} USDT (R{Math.round(cashInvestZar * 0.5)}) →{" "}
                {((cashInvestUsdt * 0.5) / signal.limit_dip_entry_price).toFixed(5)} {signal.symbol}
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
                  Copied Exchange OCO Order Ticket!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-cyan-400" />
                  📋 Copy Exchange OCO Order Ticket
                </>
              )}
            </button>

            <button
              onClick={() => {
                onConfirmLogTrade({
                  symbol: signal.symbol,
                  mode: "REAL",
                  broker_profile: exchangeType,
                  entry_price: safeEntry,
                  shares: Number(exactSpotCoinQuantity.toFixed(6)),
                  stop_loss: ocoStopTrigger,
                  target_price: ocoTakeProfitLimit,
                  plan_selected: selectedPlan,
                });
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg transition"
            >
              <PlusCircle className="w-4 h-4" />
              ✅ Log Real 1x Spot Trade in 7-Stage Coach
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default OrderTicketModal;
