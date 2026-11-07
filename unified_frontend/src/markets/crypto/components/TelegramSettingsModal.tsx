import React, { useState, useEffect } from "react";
import { X, Send, Search, Rocket, CheckCircle2, Terminal } from "lucide-react";
import { AlertSettings } from "../types/market";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AlertSettings;
  onSaveSettings: (newSettings: AlertSettings) => Promise<void>;
}

export const TelegramSettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [botToken, setBotToken] = useState(settings?.telegram_bot_token || "");
  const [chatId, setChatId] = useState(settings?.telegram_chat_id || "");
  const [discordWebhook, setDiscordWebhook] = useState(
    settings?.discord_webhook_url || ""
  );
  const [enabled, setEnabled] = useState(settings?.enabled ?? true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings) {
      setBotToken(settings.telegram_bot_token || "");
      setChatId(settings.telegram_chat_id || "");
      setDiscordWebhook(settings.discord_webhook_url || "");
      setEnabled(settings.enabled ?? true);
    }
  }, [settings]);

  if (!isOpen) return null;

  const handleAutoDetect = async () => {
    setBusy(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/engine/crypto/api/telegram/auto-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_bot_token: botToken }),
      });
      const data = await res.json();
      if (data.ok && data.chat_id) {
        setChatId(String(data.chat_id));
        setStatusMsg(data.message || `Auto-detected Chat ID: ${data.chat_id}`);
      } else {
        setErrorMsg(data.error || "Could not auto-detect Chat ID.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Network error during Auto-Detect.");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await onSaveSettings({
        telegram_bot_token: botToken,
        telegram_chat_id: chatId,
        discord_webhook_url: discordWebhook,
        enabled,
      });
      setStatusMsg("Saved Crypto 24/7 Telegram Sniper Bot configuration!");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save settings.");
    } finally {
      setBusy(false);
    }
  };

  const handleSendTest = async () => {
    setBusy(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await onSaveSettings({
        telegram_bot_token: botToken,
        telegram_chat_id: chatId,
        discord_webhook_url: discordWebhook,
        enabled: true,
      });
      const res = await fetch("/engine/crypto/api/telegram/test", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setStatusMsg(
          "🚀 Sent Test Alert + 07:30 / 19:30 SAST Crypto 12h Sniper Briefing to your Telegram!"
        );
      } else {
        setErrorMsg(data.error || "Telegram test alert failed.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Network error sending test alert.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-sky-500/40 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                📲 2-Way Interactive Telegram Sniper Bot &amp; 07:30 / 19:30 SAST Crypto 12h Briefings
              </h3>
              <p className="text-xs text-slate-400">
                Automatic &ge;10/12 A+ Alerts, Stage 4.5 / 7+ Coach Transitions &amp; Daily 07:30 / 19:30 SAST Briefings
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

        <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Bot Token Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">
              1. Telegram Bot Token (from @BotFather):
            </label>
            <input
              type="password"
              placeholder="e.g. 741928374:AAH..."
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-400"
            />
          </div>

          {/* Chat ID + Auto-Detect Button */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">
              2. Your Telegram Chat ID (send &ldquo;/start&rdquo; to your bot first, then click Auto-Detect):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. 123456789"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-400"
              />
              <button
                disabled={busy}
                onClick={handleAutoDetect}
                className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-extrabold flex items-center gap-1.5 transition shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                🔍 Auto-Detect My Chat ID
              </button>
            </div>
          </div>

          {statusMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              disabled={busy}
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold border border-slate-600 transition"
            >
              💾 Save Bot Settings
            </button>
            <button
              disabled={busy}
              onClick={handleSendTest}
              className="flex-1 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Rocket className="w-4 h-4" />
              🚀 Send Test Alert
            </button>
          </div>

          {/* Scheduled 07:30 & 19:30 SAST Crypto 12h Sniper Briefings Info */}
          <div className="rounded-xl bg-indigo-950/30 border border-indigo-500/30 p-3.5 text-xs space-y-1">
            <div className="font-bold text-indigo-300">
              ⚡ Scheduled 07:30 SAST &amp; 19:30 SAST (Daily) Crypto 12h Sniper Briefings:
            </div>
            <p className="text-slate-300 leading-relaxed">
              Automatically dispatches every morning at 07:30 SAST and evening at 19:30 SAST with the Top 2 Crypto 1x Spot A+ Setups, Perp Funding APR heat, and South African VALR/Luno ZAR Arbitrage spread.
            </p>
          </div>

          {/* 2-Way Interactive Command Cheat-Sheet */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
              <Terminal className="w-4 h-4" />
              2-Way Interactive Telegram Bot Commands
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-emerald-400 font-bold">/top</span> — Top 5 Crypto A+ Setups
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-emerald-400 font-bold">/barbell</span> — #1 R10k Crypto Barbell Plan
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-emerald-400 font-bold">/ticket SOL</span> — 1x Spot OCO Order Ticket
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-emerald-400 font-bold">/check BTC</span> — 12-Gate A+ &amp; Funding Audit
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-emerald-400 font-bold">/portfolio</span> — Live 7-Stage Coach Status
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-emerald-400 font-bold">/buy SOL 178.40 200 REAL</span> — Log Trade
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 sm:col-span-2">
                <span className="text-emerald-400 font-bold">/close SOL 195.80</span> — Close Trade &amp; Record Realized ZAR/USDT Audit
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default TelegramSettingsModal;
