import React, { useCallback, useEffect, useState } from "react";

interface CorePosition {
  symbol: string;
  shares: number;
  avg_cost_zar: number | null;
  price_zar: number | null;
  status: string;
  value_zar: number | null;
  weight_pct: number | null;
  target_weight_pct: number;
  drift_pts: number | null;
}

interface CoreAction {
  symbol: string;
  side: "BUY" | "SELL";
  amount_zar: number;
  est_cost_zar: number;
  label?: string;
}

interface BelowMinimumLeg {
  symbol: string;
  side: "BUY" | "SELL";
  amount_zar: number;
  est_cost_zar: number;
  reason: string;
}

interface StressRow {
  fall_pct: number;
  loss_zar: number | null;
  loss_pct_of_total: number | null;
  exceeds_tolerance: boolean | null;
}

interface CorePortfolioView {
  as_of: string;
  priced_ok: boolean;
  status: string;
  positions: CorePosition[];
  target_weights: Record<string, number>;
  drift_pts: Record<string, number | null>;
  total_value_zar: number | null;
  risk_assets_value_zar: number | null;
  cash_zar: number;
  cash_weight_pct: number | null;
  cash_target_weight_pct: number;
  cash_drift_pts: number | null;
  last_rebalance_date: string | null;
  days_since_rebalance: number | null;
  rebalance_triggered?: boolean;
  actions_type: string | null;
  actions: CoreAction[];
  below_minimum: BelowMinimumLeg[];
  stress_table: StressRow[];
  max_loss_tolerance_zar: number;
  max_risk_asset_pct_for_tolerance_at_30pct_fall: number | null;
  high_water_mark_zar?: number;
  trading_paused?: boolean;
  drawdown_pct?: number;
  reference_note: string;
  disclaimer: string;
}

interface EditableHolding {
  symbol: string;
  shares: string;
  avg_cost_zar: string;
}

const API_BASE = ""; // same-origin; Vite proxies /api to the backend

function fmtZar(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || Number.isNaN(Number(val))) {
    return "n/a";
  }
  return `R${Number(val).toLocaleString("en-ZA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function fmtPct(val: number | null | undefined, decimals = 2, signed = false): string {
  if (val === null || val === undefined || Number.isNaN(Number(val))) {
    return "n/a";
  }
  const num = Number(val);
  const sign = signed && num > 0 ? "+" : "";
  return `${sign}${num.toFixed(decimals)}%`;
}

export const CorePortfolio: React.FC = () => {
  const [data, setData] = useState<CorePortfolioView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editHoldings, setEditHoldings] = useState<EditableHolding[]>([]);
  const [editCash, setEditCash] = useState<string>("0");
  const [savingHoldings, setSavingHoldings] = useState<boolean>(false);
  const [savingCash, setSavingCash] = useState<boolean>(false);
  const [markingRebalanced, setMarkingRebalanced] = useState<boolean>(false);
  const [ackingPause, setAckingPause] = useState<boolean>(false);

  const syncInputsFromView = useCallback((view: CorePortfolioView) => {
    setEditHoldings(
      (view.positions || []).map((p) => ({
        symbol: p.symbol,
        shares: String(p.shares ?? 0),
        avg_cost_zar: p.avg_cost_zar !== null && p.avg_cost_zar !== undefined ? String(p.avg_cost_zar) : "",
      }))
    );
    setEditCash(String(view.cash_zar ?? 0));
  }, []);

  const fetchCorePortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/core-portfolio`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as CorePortfolioView;
      setData(json);
      syncInputsFromView(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load core portfolio");
    } finally {
      setLoading(false);
    }
  }, [syncInputsFromView]);

  useEffect(() => {
    fetchCorePortfolio();
  }, [fetchCorePortfolio]);

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleSaveHoldings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHoldings(true);
    setError(null);
    try {
      const payload = editHoldings.map((h) => ({
        symbol: h.symbol,
        shares: Number(h.shares),
        avg_cost_zar: h.avg_cost_zar.trim() === "" ? null : Number(h.avg_cost_zar),
      }));
      const res = await fetch(`${API_BASE}/api/core-portfolio/holdings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Failed to save holdings (HTTP ${res.status})`);
      }
      const updated = (await res.json()) as CorePortfolioView;
      setData(updated);
      syncInputsFromView(updated);
      showTempNotice("Core ETF holdings saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save holdings");
    } finally {
      setSavingHoldings(false);
    }
  };

  const handleSaveCash = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCash(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/core-portfolio/cash`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cash_zar: Number(editCash) }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Failed to save cash (HTTP ${res.status})`);
      }
      const updated = (await res.json()) as CorePortfolioView;
      setData(updated);
      syncInputsFromView(updated);
      showTempNotice("Core cash balance saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save cash");
    } finally {
      setSavingCash(false);
    }
  };

  const handleMarkRebalanced = async () => {
    setMarkingRebalanced(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/core-portfolio/mark-rebalanced`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const updated = (await res.json()) as CorePortfolioView;
      setData(updated);
      syncInputsFromView(updated);
      showTempNotice(`Marked rebalanced on ${updated.last_rebalance_date || "today"}.`);
    } catch (err: any) {
      setError(err?.message || "Failed to mark rebalanced");
    } finally {
      setMarkingRebalanced(false);
    }
  };

  const handleAckPause = async () => {
    setAckingPause(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/risk/ack-pause`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const updated = (await res.json()) as CorePortfolioView;
      setData(updated);
      syncInputsFromView(updated);
      showTempNotice("Drawdown pause acknowledged; high-water mark reset to current total.");
    } catch (err: any) {
      setError(err?.message || "Failed to acknowledge drawdown pause");
    } finally {
      setAckingPause(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-[#090F1D] border border-slate-800 rounded-xl p-6 font-mono text-xs text-slate-300">
        Loading Core Portfolio...
      </div>
    );
  }

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Header & Summary Strip */}
      <div className="bg-[#090F1D] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[10px]">
              CORE PORTFOLIO
            </span>
            <h2 className="text-sm font-bold text-white">
              Equal-Weight Core ETF Allocation &amp; Fee-Aware Rebalance Tool
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            As of: {data?.as_of || "n/a"} • Last Rebalanced:{" "}
            <strong className="text-slate-200">{data?.last_rebalance_date || "Never"}</strong>
            {data?.days_since_rebalance !== null && data?.days_since_rebalance !== undefined
              ? ` (${data.days_since_rebalance}d ago)`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-lg bg-[#060911] border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Total Core Value</span>
            <strong className="text-white text-xs">{fmtZar(data?.total_value_zar)}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[#060911] border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Core Cash</span>
            <strong className="text-emerald-300 text-xs">{fmtZar(data?.cash_zar)}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[#060911] border border-slate-800">
            <span className="text-slate-400 block text-[10px]">High-Water Mark</span>
            <strong className="text-cyan-300 text-xs">{fmtZar(data?.high_water_mark_zar)}</strong>
          </div>
          <button
            type="button"
            onClick={handleMarkRebalanced}
            disabled={markingRebalanced}
            className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 text-indigo-200 font-bold text-[11px] transition disabled:opacity-50"
          >
            {markingRebalanced ? "Saving..." : "Mark rebalanced"}
          </button>
          <button
            type="button"
            onClick={fetchCorePortfolio}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[11px] transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error / Notice Banners */}
      {error && (
        <div className="bg-rose-950/80 border border-rose-500 rounded-xl px-4 py-2.5 text-rose-200 font-bold">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-950/80 border border-emerald-500 rounded-xl px-4 py-2.5 text-emerald-200 font-bold">
          {notice}
        </div>
      )}

      {/* Drawdown Pause Banner */}
      {data?.trading_paused && (
        <div className="bg-rose-950/90 border-2 border-rose-500 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-rose-200 font-extrabold text-sm">
              TRADING PAUSED — Account Drawdown Guard Active
            </div>
            <p className="text-rose-300 text-[11px] mt-0.5">
              Account value ({fmtZar(data.total_value_zar)}) is{" "}
              {data.drawdown_pct !== undefined ? `${data.drawdown_pct.toFixed(2)}% ` : ""}
              below high-water mark ({fmtZar(data.high_water_mark_zar)}). New BUY orders are blocked until acknowledged.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAckPause}
            disabled={ackingPause}
            className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition disabled:opacity-50"
          >
            {ackingPause ? "Acknowledging..." : "Acknowledge"}
          </button>
        </div>
      )}

      {/* Prices Unavailable Banner */}
      {data && !data.priced_ok && (
        <div className="bg-amber-950/80 border-2 border-amber-500 rounded-xl p-4">
          <div className="text-amber-200 font-extrabold text-sm">
            PRICES UNAVAILABLE - no suggestions
          </div>
          <p className="text-amber-300/90 text-[11px] mt-1">
            One or more core ETFs do not have a verified LIVE price frame in cache. Rebalance suggestions and portfolio totals are withheld until all four core ETFs are LIVE.
          </p>
        </div>
      )}

      {/* Target vs Current Weights Table */}
      <div className="bg-[#090F1D] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <span className="font-bold text-white text-xs">
            Target vs Current Weights &amp; Drift
          </span>
          <span className="text-[11px] text-slate-400">
            Status: <strong className={data?.priced_ok ? "text-emerald-400" : "text-amber-400"}>{data?.status}</strong>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase bg-[#060911]">
                <th className="py-2.5 px-3">Asset</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Shares</th>
                <th className="py-2.5 px-3 text-right">Avg Cost</th>
                <th className="py-2.5 px-3 text-right">Live Price</th>
                <th className="py-2.5 px-3 text-right">Current Value</th>
                <th className="py-2.5 px-3 text-right">Current Weight</th>
                <th className="py-2.5 px-3 text-right">Target Weight</th>
                <th className="py-2.5 px-3 text-right">Drift (pts)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {(data?.positions || []).map((pos) => {
                const driftAbs = pos.drift_pts !== null && pos.drift_pts !== undefined ? Math.abs(pos.drift_pts) : 0;
                return (
                  <tr key={pos.symbol} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-3 font-bold text-white">{pos.symbol}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          pos.status === "LIVE"
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                            : "bg-rose-500/20 border-rose-500/40 text-rose-300"
                        }`}
                      >
                        {pos.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200">{pos.shares.toFixed(4)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">{fmtZar(pos.avg_cost_zar)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-200">{fmtZar(pos.price_zar)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">{fmtZar(pos.value_zar)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-200">{fmtPct(pos.weight_pct)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">{fmtPct(pos.target_weight_pct)}</td>
                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        driftAbs > 5
                          ? "text-amber-300"
                          : "text-slate-300"
                      }`}
                    >
                      {pos.drift_pts !== null && pos.drift_pts !== undefined
                        ? `${pos.drift_pts > 0 ? "+" : ""}${pos.drift_pts.toFixed(2)} pts`
                        : "n/a"}
                    </td>
                  </tr>
                );
              })}
              {/* Cash Line */}
              <tr className="bg-[#060911]/60 font-bold">
                <td className="py-2.5 px-3 text-emerald-300">CASH (ZAR)</td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-slate-300">
                    CASH
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right text-slate-500">—</td>
                <td className="py-2.5 px-3 text-right text-slate-500">—</td>
                <td className="py-2.5 px-3 text-right text-slate-500">—</td>
                <td className="py-2.5 px-3 text-right text-emerald-300">{fmtZar(data?.cash_zar)}</td>
                <td className="py-2.5 px-3 text-right text-slate-200">{fmtPct(data?.cash_weight_pct)}</td>
                <td className="py-2.5 px-3 text-right text-slate-400">{fmtPct(data?.cash_target_weight_pct)}</td>
                <td className="py-2.5 px-3 text-right text-slate-300">
                  {data?.cash_drift_pts !== null && data?.cash_drift_pts !== undefined
                    ? `${data.cash_drift_pts > 0 ? "+" : ""}${data.cash_drift_pts.toFixed(2)} pts`
                    : "n/a"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions & Below-Minimum Legs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#090F1D] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white text-xs">
              Suggested Rebalance Actions
              {data?.actions_type ? (
                <span className="ml-2 px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] uppercase">
                  {data.actions_type}
                </span>
              ) : null}
            </h3>
          </div>

          {!data?.priced_ok ? (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 font-bold">
              PRICES UNAVAILABLE - no suggestions
            </div>
          ) : data.actions && data.actions.length > 0 ? (
            <div className="space-y-2">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                    <th className="py-1.5 px-2">Symbol</th>
                    <th className="py-1.5 px-2">Side</th>
                    <th className="py-1.5 px-2 text-right">Suggested Amount</th>
                    <th className="py-1.5 px-2 text-right">Est. One-Way Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.actions.map((act, i) => (
                    <tr key={`${act.symbol}-${i}`}>
                      <td className="py-2 px-2 font-bold text-white">{act.symbol}</td>
                      <td className="py-2 px-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            act.side === "BUY"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {act.side}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-white">{fmtZar(act.amount_zar)}</td>
                      <td className="py-2 px-2 text-right text-slate-400">{fmtZar(act.est_cost_zar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-[#060911] border border-slate-800 text-slate-400">
              No action needed (all core ETF weights are within the drift band and annual review window).
            </div>
          )}

          {/* Below Minimum Legs */}
          {data?.priced_ok && data.below_minimum && data.below_minimum.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-800">
              <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                Skipped Legs (below minimum trade size):
              </div>
              <div className="space-y-1">
                {data.below_minimum.map((bm, idx) => (
                  <div
                    key={`${bm.symbol}-${idx}`}
                    className="flex items-center justify-between text-[11px] text-slate-400 bg-[#060911] px-2.5 py-1.5 rounded border border-slate-800"
                  >
                    <span>
                      {bm.side} <strong>{bm.symbol}</strong> ({fmtZar(bm.amount_zar)})
                    </span>
                    <span className="text-amber-300/90">{bm.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Loss Stress Table */}
        <div className="bg-[#090F1D] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white text-xs">
              Risk-Asset Loss Stress Table
            </h3>
            <span className="text-[11px] text-slate-400">
              Max Loss Tolerance: <strong className="text-white">{fmtZar(data?.max_loss_tolerance_zar, 0)}</strong>
            </span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                <th className="py-1.5 px-2">Risk-Asset Fall</th>
                <th className="py-1.5 px-2 text-right">Est. Loss (ZAR)</th>
                <th className="py-1.5 px-2 text-right">% of Total Portfolio</th>
                <th className="py-1.5 px-2 text-right">vs Tolerance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(data?.stress_table || []).map((row) => {
                const exceeds = Boolean(row.exceeds_tolerance);
                return (
                  <tr
                    key={row.fall_pct}
                    className={
                      exceeds
                        ? "bg-rose-950/50 text-rose-200 font-bold"
                        : "text-slate-200"
                    }
                  >
                    <td className="py-2 px-2">-{row.fall_pct}% fall</td>
                    <td className="py-2 px-2 text-right">
                      {row.loss_zar !== null ? `-${fmtZar(row.loss_zar)}` : "n/a"}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {row.loss_pct_of_total !== null ? `-${row.loss_pct_of_total.toFixed(2)}%` : "n/a"}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {row.exceeds_tolerance === null ? (
                        <span className="text-slate-500">n/a</span>
                      ) : exceeds ? (
                        <span className="px-2 py-0.5 rounded bg-rose-500/30 border border-rose-400 text-rose-200 text-[10px]">
                          EXCEEDS TOLERANCE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px]">
                          WITHIN TOLERANCE
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
            <span>Max risk-asset allocation for tolerance at a 30% fall:</span>
            <strong className="text-amber-300">
              {fmtPct(data?.max_risk_asset_pct_for_tolerance_at_30pct_fall)}
            </strong>
          </div>
        </div>
      </div>

      {/* Holdings & Cash Editors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <form
          onSubmit={handleSaveHoldings}
          className="lg:col-span-2 bg-[#090F1D] border border-slate-800 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-xs">Update Core ETF Holdings</h3>
            <button
              type="submit"
              disabled={savingHoldings}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition disabled:opacity-50"
            >
              {savingHoldings ? "Saving..." : "Save Holdings"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {editHoldings.map((item, idx) => (
              <div
                key={item.symbol}
                className="p-2.5 rounded-lg bg-[#060911] border border-slate-800 flex flex-col gap-2"
              >
                <div className="font-bold text-white text-xs">{item.symbol}</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-slate-400">
                    Shares
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={item.shares}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditHoldings((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, shares: val } : p))
                        );
                      }}
                      className="mt-1 w-full px-2 py-1 rounded bg-[#090F1D] border border-slate-700 text-white text-xs"
                    />
                  </label>
                  <label className="text-[10px] text-slate-400">
                    Avg Cost (R ZAR)
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="optional"
                      value={item.avg_cost_zar}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditHoldings((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, avg_cost_zar: val } : p))
                        );
                      }}
                      className="mt-1 w-full px-2 py-1 rounded bg-[#090F1D] border border-slate-700 text-white text-xs"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </form>

        <form
          onSubmit={handleSaveCash}
          className="bg-[#090F1D] border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3"
        >
          <div className="space-y-2">
            <h3 className="font-bold text-white text-xs">Update Core Cash Balance</h3>
            <p className="text-[11px] text-slate-400">
              Enter uninvested cash held for the core portfolio (ZAR).
            </p>
            <label className="block text-[10px] text-slate-400 pt-1">
              Cash Balance (R ZAR)
              <input
                type="number"
                step="any"
                min="0"
                value={editCash}
                onChange={(e) => setEditCash(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 rounded bg-[#060911] border border-slate-700 text-white text-xs"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={savingCash}
            className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition disabled:opacity-50"
          >
            {savingCash ? "Saving Cash..." : "Save Cash Balance"}
          </button>
        </form>
      </div>

      {/* Reference Note & Disclaimer */}
      <div className="bg-[#090F1D] border border-slate-800 rounded-xl p-4 space-y-1.5 text-[11px]">
        <div className="text-slate-300">
          <strong className="text-slate-200">Reference Note:</strong> {data?.reference_note}
        </div>
        <div className="text-amber-300/90">
          <strong>Disclaimer:</strong> {data?.disclaimer}
        </div>
      </div>
    </div>
  );
};
