import React, { useState, useEffect } from "react";
import { X, PlusCircle, Search, ShieldCheck } from "lucide-react";
import {
  CryptoAssetSignal,
  FeeProfile,
  ActiveCoachedTrade,
} from "../types/market";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  prefillSignal: CryptoAssetSignal | null;
  availableProfiles: FeeProfile[];
  currentProfileId: string;
  onSubmitTrade: (payload: {
    symbol: string;
    mode: string;
    broker_profile: string;
    entry_price: number;
    shares: number;
    stop_loss?: number;
    target_price?: number;
    plan_selected?: string;
  }) => void;
  onEvaluateCustomPosition: (payload: {
    symbol: string;
    entry_price: number;
    shares: number;
    broker_profile: string;
  }) => Promise<ActiveCoachedTrade | null>;
}

export const TradeLogModal: React.FC<Props> = ({
  isOpen,
  onClose,
  prefillSignal,
  availableProfiles,
  currentProfileId,
  onSubmitTrade,
  onEvaluateCustomPosition,
}) => {
  const [symbol, setSymbol] = useState("SOL");
  const [mode, setMode] = useState<"REAL" | "PAPER">("REAL");
  const [brokerProfile, setBrokerProfile] = useState(currentProfileId);
  const [entryPrice, setEntryPrice] = useState<string>("178.40");
  const [shares, setShares] = useState<string>("1.5");
  const [stopLoss, setStopLoss] = useState<string>("");
  const [targetPrice, setTargetPrice] = useState<string>("");
  const [auditResult, setAuditResult] = useState<ActiveCoachedTrade | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (prefillSignal) {
      setSymbol(prefillSignal.symbol);
      setEntryPrice(String(prefillSignal.entry_price));
      setStopLoss(String(prefillSignal.stop_loss));
      setTargetPrice(String(prefillSignal.target_price));
    }
  }, [prefillSignal]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ep = parseFloat(entryPrice) || 100;
    const sh = parseFloat(shares) || 1;
    onSubmitTrade({
      symbol: symbol.toUpperCase().trim().replace("-USD", ""),
      mode,
      broker_profile: brokerProfile,
      entry_price: ep,
      shares: sh,
      stop_loss: stopLoss ? parseFloat(stopLoss) : undefined,
      target_price: targetPrice ? parseFloat(targetPrice) : undefined,
      plan_selected: "PLAN_A",
    });
    onClose();
  };

  const handleInstantAudit = async () => {
    setBusy(true);
    try {
      const res = await onEvaluateCustomPosition({
        symbol: symbol.toUpperCase().trim().replace("-USD", ""),
        entry_price: parseFloat(entryPrice) || 100,
        shares: parseFloat(shares) || 1,
        broker_profile: brokerProfile,
      });
      setAuditResult(res);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl">
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-extrabold text-white">
              Log Real / Paper 1x Spot Crypto Trade or Audit Position
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Crypto Symbol (1x Spot)
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono font-bold text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Execution Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "REAL" | "PAPER")}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-bold text-emerald-300"
              >
                <option value="REAL">REAL 1x SPOT EXCHANGE</option>
                <option value="PAPER">PAPER WALLET ($100k USDT SIM)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Crypto Exchange Friction Profile
            </label>
            <select
              value={brokerProfile}
              onChange={(e) => setBrokerProfile(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-semibold text-amber-300"
            >
              {availableProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Entry Price ($ USDT)
              </label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                1x Spot Coin Quantity
              </label>
              <input
                type="number"
                step="any"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">
                OCO Stop-Loss ($ USDT, optional)
              </label>
              <input
                type="number"
                step="any"
                placeholder="Auto Smart VAH/VPOC Stop"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-rose-300"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">
                Target Price ($ USDT, optional)
              </label>
              <input
                type="number"
                step="any"
                placeholder="Auto Conformal P95 Target"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-emerald-300"
              />
            </div>
          </div>

          {auditResult && (
            <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/40 space-y-1">
              <div className="font-extrabold text-indigo-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                {auditResult.stage_label} ({auditResult.net_pnl_pct >= 0 ? "+" : ""}
                {auditResult.net_pnl_pct}% Net)
              </div>
              <p className="text-slate-200">{auditResult.action_directive}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleInstantAudit}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold flex items-center justify-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              {busy ? "Auditing..." : "Instant 7-Stage Audit"}
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold flex items-center justify-center gap-1.5 shadow-lg"
            >
              <PlusCircle className="w-4 h-4" />
              Save to Active Portfolio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default TradeLogModal;
