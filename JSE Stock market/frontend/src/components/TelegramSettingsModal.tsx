"use client";

import React, { useEffect, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Clock,
  MessageSquare,
  Search,
  Send,
  Sunrise,
  X,
} from "lucide-react";
import { AlertSettingsState } from "@/types/market";

export interface TelegramSettingsModalProps {
  isOpen: boolean;
  settings: AlertSettingsState;
  onClose: () => void;
  onSaveSettings: (newSettings: AlertSettingsState) => Promise<void>;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSaveSettings,
}) => {
  const [formState, setFormState] = useState<AlertSettingsState>(settings);
  const [preopenEnabled, setPreopenEnabled] = useState<boolean>(
    settings.preopenBriefing0845SastEnabled ?? true
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [detectingChat, setDetectingChat] = useState<boolean>(false);
  const [testingAlert, setTestingAlert] = useState<boolean>(false);
  const [sendingBriefing, setSendingBriefing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    setFormState(settings);
    setPreopenEnabled(settings.preopenBriefing0845SastEnabled ?? true);
  }, [settings]);

  if (!isOpen) return null;

  const handleAutoDetectChatId = async () => {
    setDetectingChat(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/telegram/detect-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: formState.telegramBotToken }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.chat_id) {
          setFormState((prev) => ({
            ...prev,
            telegramChatId: String(data.chat_id),
            telegramEnabled: true,
          }));
          setStatusMessage(
            `✅ Auto-Detected Chat ID: ${data.chat_id} (${
              data.username || "Telegram User"
            })`
          );
        } else {
          setStatusMessage(
            data.message ||
              "ℹ️ Send /start to your bot on Telegram first, then click Auto-Detect."
          );
        }
      }
    } catch {
      setStatusMessage("⚠️ Could not reach Telegram getUpdates endpoint.");
    } finally {
      setDetectingChat(false);
    }
  };

  const handleSendTestAlert = async () => {
    setTestingAlert(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_token: formState.telegramBotToken,
          chat_id: formState.telegramChatId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatusMessage(
          data.message ||
            data.details ||
            "🚀 Test Sniper Alert dispatched (Telegram + macOS Desktop)!"
        );
      }
    } finally {
      setTestingAlert(false);
    }
  };

  const handleSendPreOpenBriefingNow = async () => {
    setSendingBriefing(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/telegram/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setStatusMessage(
          data.sent
            ? "🌅 08:45 SAST JSE Pre-Open Briefing sent to your Telegram!"
            : "🌅 08:45 SAST JSE Pre-Open Briefing generated (configure Bot Token & Chat ID to push live to Telegram)."
        );
      }
    } finally {
      setSendingBriefing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings({
        ...formState,
        preopenBriefing0845SastEnabled: preopenEnabled,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const botCommands = [
    { cmd: "/start", desc: "Connect & view JSE V10.1 Sniper Command Menu" },
    { cmd: "/top", desc: "Top 3 JSE A+ setups with Plan A/B/C & Fill Prob %" },
    { cmd: "/barbell", desc: "Today's #1 R10,000 JSE Barbell Plan (45% / 35% / 20%)" },
    { cmd: "/ticket NPN.JO", desc: "Full EasyEquities Order Ticket for any .JO stock" },
    { cmd: "/check GFI.JO", desc: "12-Gate A+ Sniper Checklist & Conformal Corridor" },
    { cmd: "/portfolio", desc: "Open JSE positions, Net ZAR P&L & 7-Stage Coach" },
    { cmd: "/buy STXNDQ.JO 108.50 40", desc: "Log a new JSE position from Telegram" },
    { cmd: "/close STXNDQ.JO 116.20", desc: "Close position & record realized ZAR P&L" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0D1322] border border-cyan-500/50 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl text-xs max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                📲 2-Way Interactive Telegram Sniper Bot & 08:45 SAST Pre-Open Briefing
              </h3>
              <p className="text-slate-400 font-mono">
                Zero-Dependency Background Polling • Auto-Detect Chat ID • macOS Desktop Push
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

        <form onSubmit={handleSave} className="space-y-3.5">
          {/* Telegram Bot Token & Auto-Detect Chat ID */}
          <div className="bg-[#060911] border border-cyan-500/40 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-mono font-bold text-cyan-300">
                <input
                  type="checkbox"
                  checked={formState.telegramEnabled}
                  onChange={(e) =>
                    setFormState({ ...formState, telegramEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-cyan-500"
                />
                ✈️ Enable 2-Way Interactive Telegram Sniper Bot
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                Background Long-Polling Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 font-mono">
              <div className="sm:col-span-6">
                <label className="text-[10px] text-slate-400 block mb-1">
                  Telegram Bot Token (@BotFather)
                </label>
                <input
                  type="text"
                  placeholder="123456789:ABCdefGHIjklMNO..."
                  value={formState.telegramBotToken}
                  onChange={(e) =>
                    setFormState({ ...formState, telegramBotToken: e.target.value })
                  }
                  className="w-full bg-[#0D1322] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="text-[10px] text-slate-400 block mb-1">
                  Telegram Chat ID
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. 987654321"
                    value={formState.telegramChatId}
                    onChange={(e) =>
                      setFormState({ ...formState, telegramChatId: e.target.value })
                    }
                    className="w-full bg-[#0D1322] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAutoDetectChatId}
                    disabled={detectingChat}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-200 font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                    title="Auto-detect Chat ID after sending /start to your bot"
                  >
                    <Search className="w-3.5 h-3.5" />
                    {detectingChat ? "..." : "🔍 Auto-Detect"}
                  </button>
                </div>
              </div>
            </div>

            {/* 08:45 SAST Pre-Open Briefing Schedule Toggle */}
            <label className="flex items-center justify-between pt-2 border-t border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="font-mono font-bold text-amber-300">
                    🌅 Automated 08:45 SAST (Mon–Fri) JSE Pre-Open Morning Briefing
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Sends USD/ZAR OU Shield, Tencent 0700.HK Lead, Barbell Plan & Top 3 A+ Setups 15m before JSE open.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preopenEnabled}
                onChange={(e) => setPreopenEnabled(e.target.checked)}
                className="w-4 h-4 accent-amber-400"
              />
            </label>
          </div>

          {/* Interactive 2-Way Bot Commands Reference */}
          <div className="bg-[#060911] border border-slate-800 rounded-xl p-3.5 space-y-2 font-mono">
            <div className="font-bold text-slate-200 text-xs">
              🤖 Supported 2-Way Telegram Sniper Commands:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
              {botCommands.map((c) => (
                <div
                  key={c.cmd}
                  className="bg-[#0D1322] border border-slate-800/90 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2"
                >
                  <code className="text-emerald-300 font-bold shrink-0">{c.cmd}</code>
                  <span className="text-slate-400 text-[10px] text-right truncate">
                    {c.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* macOS Native Desktop + Discord Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="flex items-center justify-between bg-[#060911] border border-slate-800 rounded-xl p-3 cursor-pointer">
              <div>
                <div className="font-mono font-bold text-emerald-300">
                  🖥️ macOS Native Desktop (osascript)
                </div>
                <div className="text-[10px] text-slate-400">Zero API keys required</div>
              </div>
              <input
                type="checkbox"
                checked={formState.macosDesktopEnabled}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    macosDesktopEnabled: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-emerald-500"
              />
            </label>

            <div className="bg-[#060911] border border-slate-800 rounded-xl p-3 space-y-1.5">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-mono font-bold text-indigo-300">
                  💬 Discord Webhook
                </span>
                <input
                  type="checkbox"
                  checked={formState.discordEnabled}
                  onChange={(e) =>
                    setFormState({ ...formState, discordEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-indigo-500"
                />
              </label>
              <input
                type="text"
                placeholder="https://discord.com/api/webhooks/..."
                value={formState.discordWebhookUrl}
                onChange={(e) =>
                  setFormState({ ...formState, discordWebhookUrl: e.target.value })
                }
                className="w-full bg-[#0D1322] border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
              />
            </div>
          </div>

          {statusMessage && (
            <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-2.5 text-emerald-200 font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSendTestAlert}
                disabled={testingAlert}
                className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-mono font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {testingAlert ? "Sending..." : "🚀 Send Test Alert"}
              </button>

              <button
                type="button"
                onClick={handleSendPreOpenBriefingNow}
                disabled={sendingBriefing}
                className="px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-mono font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Sunrise className="w-3.5 h-3.5" />
                {sendingBriefing ? "Dispatching..." : "🌅 Send 08:45 SAST Briefing Now"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold cursor-pointer"
              >
                {saving ? "Saving..." : "Save Bot Config"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
