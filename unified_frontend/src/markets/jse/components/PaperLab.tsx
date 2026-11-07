import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldAlert, FlaskConical, Scale, CheckCircle2, Clock } from "lucide-react";

const API_BASE = "/engine/jse"; // same-origin; Vite proxies /api to the backend

interface BenchmarkStats {
  nav_now: number | null;
  return_pct: number | null;
  max_drawdown_pct: number | null;
}

interface CoreSeriesRow {
  bar_date: string;
  nav_zar: number;
  return_pct: number;
  bench_100_eq_etf_zar: number;
  bench_100_eq_etf_return_pct: number;
  bench_stx40_zar: number;
  bench_stx40_return_pct: number;
}

interface PaperCoreReport {
  inception_date: string | null;
  inception_capital_zar: number;
  days_tracked: number;
  nav_now: number | null;
  return_pct: number | null;
  max_drawdown_pct: number | null;
  benchmarks: Record<string, BenchmarkStats>;
  series?: CoreSeriesRow[];
}

interface PaperSignalsReport {
  logged: number;
  pending: number;
  open: number;
  graded: number;
  wins: number;
  losses: number;
  expired: number;
  ungradable: number;
  win_rate_pct: number | null;
  avg_net_return_pct: number | null;
  profit_factor?: number | null;
  brier_score?: number | null;
  avg_stated_win_prob_pct: number | null;
  avg_base_rate_pct: number | null;
  calibration_note: string;
  min_graded_for_rate?: number;
}

interface PaperSignalRow {
  id: number;
  signal_bar_date: string;
  symbol: string;
  entry_bar_date: string | null;
  entry_price: number | null;
  target_price: number | null;
  stop_price: number | null;
  horizon_days: number;
  stated_win_prob_pct: number | null;
  base_rate_pct: number | null;
  engine_version: string;
  status: string;
  graded_bar_date: string | null;
  exit_price: number | null;
  net_return_pct: number | null;
}

interface PaperLabReport {
  core: PaperCoreReport;
  signals: PaperSignalsReport;
  status: string;
  notice: string;
  recent_signals?: PaperSignalRow[];
}

function fmtZar(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "NO DATA YET";
  return `R ${Number(v).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v: number | null | undefined, signed = false): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "NO DATA YET";
  const n = Number(v);
  const prefix = signed && n > 0 ? "+" : "";
  return `${prefix}${n.toFixed(2)}%`;
}

export const PaperLab: React.FC = () => {
  const [report, setReport] = useState<PaperLabReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningNow, setRunningNow] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/paper/report`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: PaperLabReport = await res.json();
      setReport(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load Paper Lab report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
    const timer = window.setInterval(fetchReport, 120000);
    return () => window.clearInterval(timer);
  }, [fetchReport]);

  const handleRunNow = async () => {
    setRunningNow(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/paper/run-now`, { method: "POST" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: PaperLabReport = await res.json();
      setReport(data);
    } catch (e: any) {
      setError(e?.message || "Failed to run Paper Lab job");
    } finally {
      setRunningNow(false);
    }
  };

  if (loading && !report) {
    return (
      <div className="p-6 text-slate-300 text-sm flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
        Loading Paper Lab report...
      </div>
    );
  }

  const core = report?.core;
  const sig = report?.signals;
  const nGraded = sig?.graded ?? 0;
  const minGraded = sig?.min_graded_for_rate ?? 100;
  const enoughGraded = nGraded >= minGraded && sig?.win_rate_pct !== null && sig?.win_rate_pct !== undefined;
  const notEnoughText = `NOT ENOUGH DATA (${nGraded} of ${minGraded} graded)`;

  const benchEq = core?.benchmarks?.["100% equal-weight core ETFs, same costs"];
  const benchStx = core?.benchmarks?.["STX40.JO only"];

  return (
    <div className="space-y-4 text-slate-100">
      {/* Notice Banner & Header */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              JSE Paper Lab • Status: {report?.status ?? "COLLECTING DATA"}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
              Append-Only • Real LIVE Closes Only
            </span>
          </div>
          <p className="text-xs text-amber-200/90 font-medium">
            {report?.notice ??
              "Results over this few trades are mostly luck. A strategy needs well over 100 graded trades AND a long track record before the numbers mean anything."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRunNow}
            disabled={runningNow}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningNow ? "animate-spin" : ""}`} />
            {runningNow ? "Running..." : "Run now"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: Hypothetical R10,000 Core Portfolio vs Benchmarks */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" />
              Hypothetical R10,000 Core Portfolio (Real LIVE Closes)
            </h3>
            <p className="text-[11px] text-slate-400">
              Inception: <span className="text-slate-200 font-mono">{core?.inception_date ?? "Not started yet"}</span>
              {" • "}Days Tracked: <span className="text-slate-200 font-mono">{core?.days_tracked ?? 0}</span>
              {" • "}Max Drawdown: <span className="text-slate-200 font-mono">{fmtPct(core?.max_drawdown_pct)}</span>
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Current Core NAV</div>
            <div className="text-base font-bold font-mono text-emerald-300">{fmtZar(core?.nav_now)}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-left">
                <th className="py-2 pr-3 font-semibold">Portfolio / Benchmark</th>
                <th className="py-2 px-3 font-semibold text-right">Current NAV</th>
                <th className="py-2 px-3 font-semibold text-right">Net Return</th>
                <th className="py-2 pl-3 font-semibold text-right">Max Drawdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              <tr>
                <td className="py-2 pr-3 font-sans font-semibold text-white">
                  Core Portfolio (80% Equal-Weight Core ETFs / 20% Cash, Net of Fees &amp; Slippage)
                </td>
                <td className="py-2 px-3 text-right text-emerald-300">{fmtZar(core?.nav_now)}</td>
                <td className="py-2 px-3 text-right text-slate-200">{fmtPct(core?.return_pct, true)}</td>
                <td className="py-2 pl-3 text-right text-slate-300">{fmtPct(core?.max_drawdown_pct)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-sans text-slate-300">
                  100% equal-weight core ETFs, same costs
                </td>
                <td className="py-2 px-3 text-right text-slate-200">{fmtZar(benchEq?.nav_now)}</td>
                <td className="py-2 px-3 text-right text-slate-200">{fmtPct(benchEq?.return_pct, true)}</td>
                <td className="py-2 pl-3 text-right text-slate-300">{fmtPct(benchEq?.max_drawdown_pct)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-sans text-slate-300">
                  STX40.JO only
                </td>
                <td className="py-2 px-3 text-right text-slate-200">{fmtZar(benchStx?.nav_now)}</td>
                <td className="py-2 px-3 text-right text-slate-200">{fmtPct(benchStx?.return_pct, true)}</td>
                <td className="py-2 pl-3 text-right text-slate-300">{fmtPct(benchStx?.max_drawdown_pct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Actionable Signal Log & Empirical Grader */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
              Forward Signal Grader (Engine: unvalidated)
            </h3>
            <p className="text-[11px] text-slate-400">
              {sig?.calibration_note ?? "No signals graded yet."}
            </p>
          </div>
          <div className="text-xs font-mono text-amber-300">
            {enoughGraded ? `GRADED (${nGraded} trades)` : notEnoughText}
          </div>
        </div>

        {/* Signal Counts Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { label: "Logged", value: sig?.logged ?? 0 },
            { label: "Pending Entry", value: sig?.pending ?? 0 },
            { label: "Open", value: sig?.open ?? 0 },
            { label: "Graded", value: sig?.graded ?? 0 },
            { label: "Wins", value: sig?.wins ?? 0 },
            { label: "Losses", value: sig?.losses ?? 0 },
            { label: "Expired", value: sig?.expired ?? 0 },
            { label: "Ungradable", value: sig?.ungradable ?? 0 },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-400">{item.label}</div>
              <div className="text-sm font-bold font-mono text-white mt-0.5">{item.value}</div>
            </div>
          ))}
        </div>

        {/* Rate Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Realized Win Rate</div>
            <div className="text-sm font-bold font-mono text-amber-300 mt-1">
              {enoughGraded ? fmtPct(sig?.win_rate_pct) : notEnoughText}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Avg Net Return (After Costs)</div>
            <div className="text-sm font-bold font-mono text-amber-300 mt-1">
              {enoughGraded ? fmtPct(sig?.avg_net_return_pct, true) : notEnoughText}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Avg Stated Win Probability</div>
            <div className="text-sm font-bold font-mono text-slate-200 mt-1">
              {sig?.avg_stated_win_prob_pct !== null && sig?.avg_stated_win_prob_pct !== undefined
                ? fmtPct(sig.avg_stated_win_prob_pct)
                : notEnoughText}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Historical Base Rate (Pre-Signal)</div>
            <div className="text-sm font-bold font-mono text-slate-200 mt-1">
              {sig?.avg_base_rate_pct !== null && sig?.avg_base_rate_pct !== undefined
                ? fmtPct(sig.avg_base_rate_pct)
                : notEnoughText}
            </div>
          </div>
        </div>

        {/* Recent Logged Signals Table */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Logged Actionable Signals (Append-Only)
          </div>
          {!report?.recent_signals || report.recent_signals.length === 0 ? (
            <div className="text-xs text-slate-400 italic py-2">
              No actionable signals logged yet. Click &ldquo;Run now&rdquo; or wait for the 17:30 SAST weekday close job.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-left">
                    <th className="py-1.5 pr-2">Signal Bar</th>
                    <th className="py-1.5 px-2">Symbol</th>
                    <th className="py-1.5 px-2">Status</th>
                    <th className="py-1.5 px-2 text-right">Entry Open</th>
                    <th className="py-1.5 px-2 text-right">Target</th>
                    <th className="py-1.5 px-2 text-right">Stop</th>
                    <th className="py-1.5 px-2 text-right">Stated Prob</th>
                    <th className="py-1.5 px-2 text-right">Base Rate</th>
                    <th className="py-1.5 pl-2 text-right">Net Return</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {report.recent_signals.map((row) => (
                    <tr key={`${row.signal_bar_date}-${row.symbol}`}>
                      <td className="py-1.5 pr-2 text-slate-300">{row.signal_bar_date}</td>
                      <td className="py-1.5 px-2 font-bold text-white">{row.symbol}</td>
                      <td className="py-1.5 px-2 text-amber-300">{row.status}</td>
                      <td className="py-1.5 px-2 text-right text-slate-200">
                        {row.entry_price !== null ? row.entry_price.toFixed(2) : "PENDING"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-emerald-300">
                        {row.target_price !== null ? row.target_price.toFixed(2) : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-rose-300">
                        {row.stop_price !== null ? row.stop_price.toFixed(2) : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-slate-300">
                        {row.stated_win_prob_pct !== null ? `${row.stated_win_prob_pct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-slate-300">
                        {row.base_rate_pct !== null ? `${row.base_rate_pct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-1.5 pl-2 text-right text-slate-200">
                        {row.net_return_pct !== null ? fmtPct(row.net_return_pct, true) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
