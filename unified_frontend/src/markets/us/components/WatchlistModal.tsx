import React, { useState } from "react";
import { X, ListPlus, Trash2, PlusCircle, CheckCircle2 } from "lucide-react";
import { CustomWatchlistItem } from "../types/market";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  watchlist: CustomWatchlistItem[];
  onAddTicker: (symbol: string) => Promise<void>;
  onRemoveTicker: (symbol: string) => Promise<void>;
}

const POPULAR_SUGGESTIONS = ["COIN", "SNOW", "ARM", "PANW", "UBER", "MSTR", "ORCL", "CRM"];

export const WatchlistModal: React.FC<Props> = ({
  isOpen,
  onClose,
  watchlist,
  onAddTicker,
  onRemoveTicker,
}) => {
  const [symbolInput, setSymbolInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = async (sym: string) => {
    const clean = sym.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await onAddTicker(clean);
      setStatusMsg(`Added ${clean} to live US 12-Gate Scanner!`);
      setSymbolInput("");
    } catch (err: any) {
      setErrorMsg(err?.message || `Failed to validate US ticker ${clean}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-sky-500/40 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300">
              <ListPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                + Add Custom US NYSE / NASDAQ Stock
              </h3>
              <p className="text-xs text-slate-400">
                No-Code Watchlist Manager with Live yfinance Validation &amp; SQLite Persistence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Input Form */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter US Ticker (e.g. COIN, ARM, UBER, MSTR)"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-sky-400"
            />
            <button
              disabled={loading || !symbolInput.trim()}
              onClick={() => handleAdd(symbolInput)}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
            >
              <PlusCircle className="w-4 h-4" />
              {loading ? "Validating..." : "Validate & Add"}
            </button>
          </div>

          {statusMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {statusMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Quick-Add Suggestions */}
          <div>
            <div className="text-[11px] text-slate-400 font-semibold mb-1.5">
              1-Click Popular US Growth Additions:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_SUGGESTIONS.map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleAdd(sym)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-xs font-mono font-bold transition"
                >
                  + {sym}
                </button>
              ))}
            </div>
          </div>

          {/* Active Custom Watchlist List */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-3.5 py-2 bg-slate-900/80 border-b border-slate-800 text-xs font-bold text-slate-300 flex justify-between">
              <span>Custom US Watchlist ({watchlist.length})</span>
              <span className="text-slate-400 font-normal">+ 31 Core NYSE/NASDAQ Stocks</span>
            </div>
            {watchlist.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No custom US stocks added yet. All 31 core Wall Street tickers are active.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                {watchlist.map((item) => (
                  <div
                    key={item.symbol}
                    className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-white mr-2">
                        {item.symbol}
                      </span>
                      <span className="text-slate-400">{item.name}</span>
                    </div>
                    <button
                      onClick={() => onRemoveTicker(item.symbol)}
                      className="p-1 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
