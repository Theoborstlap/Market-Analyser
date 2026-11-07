"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  PlusCircle,
  Trash2,
  X,
} from "lucide-react";
import { CustomWatchlistItem } from "@/types/market";

interface WatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWatchlist: CustomWatchlistItem[];
  onWatchlistUpdated: () => void;
}

export const WatchlistModal: React.FC<WatchlistModalProps> = ({
  isOpen,
  onClose,
  initialWatchlist,
  onWatchlistUpdated,
}) => {
  const [tickerInput, setTickerInput] = useState<string>("");
  const [nameInput, setNameInput] = useState<string>("");
  const [sectorInput, setSectorInput] = useState<string>("SA_INC_RETAIL");
  const [items, setItems] = useState<CustomWatchlistItem[]>(initialWatchlist || []);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialWatchlist || []);
  }, [initialWatchlist]);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/watchlist")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.watchlist)) {
          setItems(data.watchlist);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tickerInput.trim()) return;
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      const clean = tickerInput.trim().toUpperCase();
      const formatted = clean.endsWith(".JO") ? clean : `${clean}.JO`;
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: formatted,
          name: nameInput.trim() || undefined,
          sector: sectorInput,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setStatusMsg(
          `🛑 ${data.error || `Could not validate ${formatted}: no verified live price.`}`
        );
      } else {
        if (Array.isArray(data.watchlist)) {
          setItems(data.watchlist);
        }
        setStatusMsg(
          `✅ Validated & Added ${formatted} (${
            data.added?.name || formatted
          } @ R${Number(data.added?.price_zar || 0).toFixed(2)})`
        );
        setTickerInput("");
        setNameInput("");
        onWatchlistUpdated();
      }
    } catch {
      setStatusMsg("⚠️ Network error while adding custom JSE stock.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveTicker = async (ticker: string) => {
    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(ticker)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.watchlist)) {
          setItems(data.watchlist);
        } else {
          setItems((prev) =>
            prev.filter((i) => (i.ticker || i.symbol) !== ticker)
          );
        }
        setStatusMsg(`🗑️ Removed ${ticker} from custom watchlist.`);
        onWatchlistUpdated();
      }
    } catch {}
  };

  const quickSuggestions = [
    { ticker: "AVI.JO", name: "AVI Limited", sector: "SA_INC_RETAIL" },
    { ticker: "PPH.JO", name: "Pepkor Holdings", sector: "SA_INC_RETAIL" },
    { ticker: "TRU.JO", name: "Truworths International", sector: "SA_INC_RETAIL" },
    { ticker: "TKG.JO", name: "Telkom SA SOC", sector: "SA_INC_RETAIL" },
    { ticker: "OMU.JO", name: "Old Mutual Ltd", sector: "SA_INC_FIN" },
    { ticker: "MOM.JO", name: "Momentum Group", sector: "SA_INC_FIN" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0D1322] border border-emerald-500/50 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                ➕ No-Code JSE Custom Stock Watchlist Manager
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Auto-appends .JO • Validates via Yahoo Finance (ZAc/100 → R ZAR) • Persists in SQLite
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

        {/* Form */}
        <form onSubmit={handleAddTicker} className="space-y-3 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">
                JSE Ticker Symbol
              </label>
              <input
                type="text"
                placeholder="e.g. AVI or PPH.JO"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                className="w-full bg-[#060911] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">
                Company Name (Optional)
              </label>
              <input
                type="text"
                placeholder="Auto-detected if blank"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full bg-[#060911] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">
                JSE Sector Bucket
              </label>
              <select
                value={sectorInput}
                onChange={(e) => setSectorInput(e.target.value)}
                className="w-full bg-[#060911] border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="SA_INC_RETAIL">SA Inc Retail / Ind</option>
                <option value="SA_INC_FIN">SA Banks & Insurers</option>
                <option value="RAND_HEDGE">Global Rand-Hedge</option>
                <option value="PRECIOUS_MINER">Gold & PGM Miners</option>
                <option value="COMMODITY_MINER">Diversified Miners</option>
                <option value="JSE_ETF_TFSA">TFSA ETF (0% STT)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !tickerInput.trim()}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 cursor-pointer transition"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating JSE Ticker & Normalizing ZAc → R ZAR...
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                Validate & Add JSE Stock to 12-Gate Scanner
              </>
            )}
          </button>
        </form>

        {/* Quick 1-Click Popular JSE Mid-Cap Suggestions */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono text-slate-400">
            Quick-Add Popular JSE Mid-Caps:
          </div>
          <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
            {quickSuggestions.map((s) => (
              <button
                key={s.ticker}
                type="button"
                onClick={() => {
                  setTickerInput(s.ticker);
                  setNameInput(s.name);
                  setSectorInput(s.sector);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#060911] hover:bg-slate-800 border border-slate-800 text-emerald-300 cursor-pointer transition"
              >
                + {s.ticker} ({s.name})
              </button>
            ))}
          </div>
        </div>

        {statusMsg && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-2.5 text-xs font-mono text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Active Custom Watchlist Items */}
        <div className="bg-[#060911] border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="text-xs font-mono font-bold text-slate-300">
            Custom JSE Watchlist Tickers ({items.length})
          </div>
          {items.length === 0 ? (
            <div className="text-xs text-slate-500 font-mono py-3 text-center">
              The default JSE Top 40 & TFSA ETF universe is active. Add any custom .JO symbol above!
            </div>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {items.map((item) => {
                const sym = item.ticker || item.symbol || "UNKNOWN.JO";
                return (
                  <div
                    key={sym}
                    className="bg-[#0D1322] border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between font-mono text-xs"
                  >
                    <div>
                      <span className="font-bold text-white">{sym}</span>{" "}
                      <span className="text-slate-400">{item.name}</span>{" "}
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px]">
                        {item.sector}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveTicker(sym)}
                      className="p-1.5 rounded bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 cursor-pointer"
                      title="Remove from watchlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
