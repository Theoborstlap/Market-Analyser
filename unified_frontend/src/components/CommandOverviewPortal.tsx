import React, { useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  Cpu,
  DollarSign,
  Flame,
  Globe,
  Layers,
  LineChart,
  Lock,
  Play,
  Radio,
  RefreshCw,
  Rocket,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal as TerminalIcon,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { MarketId } from "./GlobalMarketNav";
import { formatZar } from "../utils/formatters";
import { terminalStore, useTerminalStore } from "../store/terminalStore";

interface CommandOverviewPortalProps {
  onSelectMarket: (market: MarketId) => void;
  onOpenOrderTicket: (symbol?: string) => void;
}

// 3D Floating Token SVG Badges
const BtcCoinBadge: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`relative group cursor-pointer transition-transform duration-500 hover:scale-110 ${className}`}
    title="Bitcoin (BTC) · Layer 1 Digital Gold"
  >
    <div className="absolute -inset-2 rounded-full bg-amber-500/20 blur-md group-hover:bg-amber-500/35 transition-all" />
    <svg className="w-12 h-12 relative drop-shadow-[0_4px_16px_rgba(245,158,11,0.4)]" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" fill="url(#btc-grad)" stroke="#F59E0B" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="19" fill="#181208" stroke="#F59E0B" strokeOpacity="0.4" strokeWidth="0.8" />
      <path
        d="M27.5 21.5C28.5 20.8 29 19.8 28.6 18.2C28.1 16.2 26.2 15.5 23.8 15.5H18V32.5H24.5C27 32.5 29.2 31.4 29.5 29C29.8 26.8 28.8 25.4 27.5 24.8M21.5 18.5H23.5C25 18.5 26 19.2 26.2 20.2C26.4 21.4 25.4 22.2 23.8 22.2H21.5M21.5 25.8H24.2C25.8 25.8 26.8 26.8 26.6 28C26.4 29.3 25.2 30 23.6 30H21.5M20 13V15.5M26 13V15.5M20 32.5V35M26 32.5V35"
        stroke="#F59E0B"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <radialGradient id="btc-grad" cx="0.3" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#3A280B" />
          <stop offset="100%" stopColor="#120D04" />
        </radialGradient>
      </defs>
    </svg>
  </div>
);

const EthCoinBadge: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`relative group cursor-pointer transition-transform duration-500 hover:scale-110 ${className}`}
    title="Ethereum (ETH) · Smart Contracts & DeFi"
  >
    <div className="absolute -inset-2 rounded-full bg-cyan-500/20 blur-md group-hover:bg-cyan-500/40 transition-all" />
    <svg className="w-12 h-12 relative drop-shadow-[0_4px_16px_rgba(0,229,255,0.4)]" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" fill="url(#eth-grad)" stroke="#00E5FF" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="19" fill="#06121E" stroke="#00E5FF" strokeOpacity="0.4" strokeWidth="0.8" />
      <path d="M24 10L16 23.5L24 28L32 23.5L24 10Z" fill="url(#eth-top)" stroke="#00E5FF" strokeWidth="1.2" />
      <path d="M24 29.5L16 25L24 37L32 25L24 29.5Z" fill="url(#eth-bottom)" stroke="#00E5FF" strokeWidth="1.2" />
      <defs>
        <radialGradient id="eth-grad" cx="0.3" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#0B2B38" />
          <stop offset="100%" stopColor="#040F16" />
        </radialGradient>
        <linearGradient id="eth-top" x1="16" y1="10" x2="32" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67E8F9" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0891B2" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="eth-bottom" x1="16" y1="25" x2="32" y2="37" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#164E63" stopOpacity="0.3" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

const SolCoinBadge: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`relative group cursor-pointer transition-transform duration-500 hover:scale-110 ${className}`}
    title="Solana (SOL) · Ultra High Speed L1"
  >
    <div className="absolute -inset-2 rounded-full bg-purple-500/20 blur-md group-hover:bg-purple-500/40 transition-all" />
    <svg className="w-12 h-12 relative drop-shadow-[0_4px_16px_rgba(168,85,247,0.4)]" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" fill="url(#sol-grad)" stroke="#A855F7" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="19" fill="#130722" stroke="#A855F7" strokeOpacity="0.4" strokeWidth="0.8" />
      <path d="M16 16.5H30L32 19.5H18L16 16.5Z" fill="#22D3EE" />
      <path d="M32 22.5H18L16 25.5H30L32 22.5Z" fill="#A855F7" />
      <path d="M16 28.5H30L32 31.5H18L16 28.5Z" fill="#34D399" />
      <defs>
        <radialGradient id="sol-grad" cx="0.3" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#2D114D" />
          <stop offset="100%" stopColor="#0B0314" />
        </radialGradient>
      </defs>
    </svg>
  </div>
);

const HederaCoinBadge: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`relative group cursor-pointer transition-transform duration-500 hover:scale-110 ${className}`}
    title="Hedera & Cross-Market L2/L3 Bus"
  >
    <div className="absolute -inset-2 rounded-full bg-emerald-500/20 blur-md group-hover:bg-emerald-500/35 transition-all" />
    <svg className="w-12 h-12 relative drop-shadow-[0_4px_16px_rgba(16,185,129,0.4)]" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" fill="url(#h-grad)" stroke="#10B981" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="19" fill="#071913" stroke="#10B981" strokeOpacity="0.4" strokeWidth="0.8" />
      <path d="M18 16V32M30 16V32M18 21.5H30M18 26.5H30" stroke="#34D399" strokeWidth="2.4" strokeLinecap="round" />
      <defs>
        <radialGradient id="h-grad" cx="0.3" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#063524" />
          <stop offset="100%" stopColor="#02140D" />
        </radialGradient>
      </defs>
    </svg>
  </div>
);

export const CommandOverviewPortal: React.FC<CommandOverviewPortalProps> = ({
  onSelectMarket,
  onOpenOrderTicket,
}) => {
  const [activePlanTab, setActivePlanTab] = useState<"bot" | "api">("bot");
  const [selectedPlanTier, setSelectedPlanTier] = useState<"starter" | "pro" | "elite">("pro");

  const portfolioCapitalZar = useTerminalStore((s) => s.portfolioCapitalZar);
  const freeCashZar = useTerminalStore((s) => s.freeCashZar);
  const realizedPnlZar = useTerminalStore((s) => s.realizedPnlZar);
  const wsConnected = useTerminalStore((s) => s.wsConnected);

  // Live Watchlist Preview with instant order action
  const LIVE_TICKERS = [
    { symbol: "BTC/USDT", name: "Bitcoin", price: "$87,420.50", change: "+7.5%", isUp: true, vol: "$24.2B", icon: "₿", market: "crypto" as MarketId },
    { symbol: "ETH/USDT", name: "Ethereum", price: "$3,195.80", change: "-0.9%", isUp: false, vol: "$12.8B", icon: "Ξ", market: "crypto" as MarketId },
    { symbol: "SOL/USDT", name: "Solana", price: "$185.35", change: "+8.2%", isUp: true, vol: "$6.4B", icon: "◎", market: "crypto" as MarketId },
    { symbol: "NVDA", name: "NVIDIA Corp", price: "$142.60", change: "+4.1%", isUp: true, vol: "$18.1B", icon: "🟩", market: "us" as MarketId },
    { symbol: "AAPL", name: "Apple Inc", price: "$224.50", change: "+1.8%", isUp: true, vol: "$9.5B", icon: "🍎", market: "us" as MarketId },
    { symbol: "NPN.JO", name: "Naspers Ltd", price: "R 3,540.00", change: "+2.3%", isUp: true, vol: "R 850M", icon: "🇿🇦", market: "jse" as MarketId },
  ];

  const ASSET_RAILS = [
    { label: "STOCKS · JSE", market: "jse" as MarketId, icon: "🇿🇦" },
    { label: "WALL ST · US", market: "us" as MarketId, icon: "🇺🇸" },
    { label: "CRYPTO 24/7", market: "crypto" as MarketId, icon: "⚡" },
    { label: "AUTONOMOUS BOT", market: "bot" as MarketId, icon: "🤖" },
    { label: "FUTURES & PERPS", market: "crypto" as MarketId, icon: "📈" },
    { label: "DEEP QUANT", market: "bot" as MarketId, icon: "🧠" },
    { label: "KELLY COMPOUNDING", market: "bot" as MarketId, icon: "💎" },
    { label: "ANTI-TILT SHIELD", market: "bot" as MarketId, icon: "🛡️" },
    { label: "L2/L3 BLOTTER", market: "jse" as MarketId, icon: "📊" },
  ];

  const BENTO_FEATURES = [
    {
      title: "PERSONAL SOVEREIGN INDEX",
      desc: "Real-time consolidated cross-market NAV, drawdown envelope, and portfolio equity curve.",
      icon: LineChart,
      market: "jse" as MarketId,
      badge: "LIVE INDEX",
    },
    {
      title: "FUND MANAGER COMPARISON",
      desc: "Benchmark multi-market algorithmic alpha against institutional hedge funds & S&P 500.",
      icon: Brain,
      market: "bot" as MarketId,
      badge: "ALPHA 4.2x",
    },
    {
      title: "FUTURES OI & MICROSTRUCTURE",
      desc: "L2/L3 order book depth with microsecond queue estimates and iceberg detection.",
      icon: Layers,
      market: "crypto" as MarketId,
      badge: "L2/L3 DEPTH",
    },
    {
      title: "FII / INSTITUTIONAL ACTIVITY",
      desc: "Smart-money institutional tracking, block trade anomalies, and dark pool footprint.",
      icon: Globe,
      market: "us" as MarketId,
      badge: "SMART MONEY",
    },
    {
      title: "ADVANCED WATCHLIST & SCANNER",
      desc: "Dynamic opportunity scanner across JSE, US, and Crypto with Bayesian conviction filtering.",
      icon: Target,
      market: "jse" as MarketId,
      badge: "50+ SIGNALS",
    },
    {
      title: "KELLY CAPITAL COMPOUNDING",
      desc: "Continuous parameter drift adaptation with fractional Kelly criterion position sizing.",
      icon: Zap,
      market: "bot" as MarketId,
      badge: "HALF-KELLY",
    },
    {
      title: "ACTIVE PORTFOLIO COACH",
      desc: "Real-time AI telemetry diagnosing factor concentration, volatility drag, and rebalancing.",
      icon: Sparkles,
      market: "crypto" as MarketId,
      badge: "AI ADVISOR",
    },
    {
      title: "LIVE OPTION GREEKS & VOLATILITY",
      desc: "Microstructure volatility surfaces, IV rank, and delta-neutral hedging execution.",
      icon: Activity,
      market: "us" as MarketId,
      badge: "GREEKS ENGINE",
    },
  ];

  return (
    <div className="min-h-full bg-[#04070D] text-slate-100 selection:bg-cyan-500/20 selection:text-cyan-200 overflow-x-hidden relative">
      {/* Background Ambient Glow Waves (from Image 1 & 3) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[650px] bg-gradient-to-b from-teal-500/10 via-cyan-500/5 to-transparent blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-[800px] right-0 w-[600px] h-[600px] bg-gradient-to-l from-emerald-500/10 via-teal-500/5 to-transparent blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[800px] h-[500px] bg-gradient-to-r from-purple-500/10 via-cyan-500/5 to-transparent blur-[130px] pointer-events-none -z-10" />

      {/* Cyber HUD Grid Overlay */}
      <div className="absolute inset-0 hud-grid opacity-40 pointer-events-none -z-10" />

      {/* ========================================================================= */}
      {/* 1. HERO SECTION: "Trading Isn't the Product. The System Is." (Image 1) */}
      {/* ========================================================================= */}
      <section className="relative pt-12 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Floating 3D Coin Badges Flanking the Hero */}
        <BtcCoinBadge className="absolute top-8 left-4 lg:left-12 animate-float-slow hidden sm:block" />
        <EthCoinBadge className="absolute top-20 right-4 lg:right-16 animate-float-delayed hidden sm:block" />
        <SolCoinBadge className="absolute bottom-32 left-8 lg:left-24 animate-float-delayed hidden md:block" />
        <HederaCoinBadge className="absolute bottom-28 right-8 lg:right-24 animate-float-slow hidden md:block" />

        {/* Brand Kicker Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-cyan-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(0,229,255,0.15)] mb-6 animate-pulse-glow">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-[11px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
            SOVEREIGN XTRADER • AUTONOMOUS OMNI-MARKET TERMINAL
          </span>
        </div>

        {/* Hero Title */}
        <h1 className="font-orbitron font-extrabold text-4xl sm:text-6xl lg:text-7xl tracking-tight text-white max-w-4xl leading-[1.1] mb-6">
          Trading Isn't the Product.{" "}
          <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-400 bg-clip-text text-transparent block">
            The System Is.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 text-sm sm:text-base lg:text-lg max-w-2xl font-light mb-8 leading-relaxed">
          Whether you need a ready-to-go AI trading bot or robust AI APIs to create your own tools across JSE, US Wall Street, and Crypto, we've got you covered.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mb-14">
          <button
            type="button"
            onClick={() => onSelectMarket("bot")}
            className="group relative px-7 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold text-sm shadow-[0_0_25px_rgba(0,229,255,0.4)] hover:shadow-[0_0_35px_rgba(0,229,255,0.6)] hover:brightness-110 transition-all flex items-center gap-2 active:scale-95"
          >
            <Bot className="w-4 h-4" />
            <span>Connect & Launch Bot</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            type="button"
            onClick={() => onOpenOrderTicket()}
            className="px-6 py-3 rounded-full glass-panel hover:bg-white/[0.08] border border-white/20 text-white font-medium text-sm transition-all hover:border-cyan-400/50 flex items-center gap-2 active:scale-95"
            title="Press Space anywhere to open Quick Order Ticket"
          >
            <TerminalIcon className="w-4 h-4 text-cyan-400" />
            <span>Quick Order Ticket</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-slate-300">Space</kbd>
          </button>

          <button
            type="button"
            onClick={() => onSelectMarket("jse")}
            className="px-5 py-3 rounded-full glass-pill hover:bg-white/[0.06] text-slate-300 hover:text-white font-medium text-sm transition-all flex items-center gap-2"
          >
            <span>🇿🇦 JSE Equities</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectMarket("us")}
            className="px-5 py-3 rounded-full glass-pill hover:bg-white/[0.06] text-slate-300 hover:text-white font-medium text-sm transition-all flex items-center gap-2"
          >
            <span>🇺🇸 US Wall St</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectMarket("crypto")}
            className="px-5 py-3 rounded-full glass-pill hover:bg-white/[0.06] text-slate-300 hover:text-white font-medium text-sm transition-all flex items-center gap-2"
          >
            <span>⚡ Crypto 24/7</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 8-METRIC GLASSMORPHISM BENTO GRID (2 rows x 4 cols from Image 1) */}
        {/* ========================================================================= */}
        <div className="w-full max-w-5xl grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-left">
          {/* Card 1: Total PnL */}
          <div className="glass-panel-glow p-4 sm:p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-bl-full blur-xl group-hover:bg-cyan-500/20 transition-all" />
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Total PnL</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tabular-nums">
              {formatZar(realizedPnlZar || 314250, { decimals: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">+17.26% Cumulative</div>
          </div>

          {/* Card 2: Total APY */}
          <div className="glass-panel p-4 sm:p-5 rounded-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Total APY</span>
              <Flame className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-cyan-300 tabular-nums">
              7,940%
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Peak MAB Engine Run</div>
          </div>

          {/* Card 3: Number of Trades */}
          <div className="glass-panel p-4 sm:p-5 rounded-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Number of Trades</span>
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white tabular-nums">
              10,000+
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Zero Manual Slippage</div>
          </div>

          {/* Card 4: Position Size / Capital */}
          <div className="glass-panel p-4 sm:p-5 rounded-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Position Size</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white tabular-nums">
              {formatZar(portfolioCapitalZar || 1500000, { decimals: 0 })}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Total Deployed Capital</div>
          </div>

          {/* Card 5: Liquidations */}
          <div className="glass-panel p-4 sm:p-5 rounded-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Liquidations</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tabular-nums">
              0.00%
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Anti-Tilt Shield Active</div>
          </div>

          {/* Card 6: Total Order Price */}
          <div className="glass-panel p-4 sm:p-5 rounded-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Filled Orders</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white tabular-nums">
              7,940
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">100% Fill Parity</div>
          </div>

          {/* Card 7: Volume */}
          <div className="glass-panel p-4 sm:p-5 rounded-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>24h L2/L3 Volume</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-cyan-300 tabular-nums">
              R 10,000,000+
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Multiplexed IPC Bus</div>
          </div>

          {/* Card 8: Queue Latency */}
          <div className="glass-panel p-4 sm:p-5 rounded-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Bus Latency</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tabular-nums">
              &lt; 4.2 ms
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Sub-tick Execution</div>
          </div>
        </div>

        {/* Partner Institutional Trust Strip (Image 1) */}
        <div className="mt-12 pt-8 border-t border-white/5 w-full max-w-4xl">
          <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500 mb-4">
            Trusted by 50,000+ algorithmic traders & quant desks worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 opacity-60 grayscale hover:grayscale-0 transition-all">
            <span className="font-orbitron font-bold text-sm tracking-wider text-slate-300">JSE FIX 4.4</span>
            <span className="font-orbitron font-bold text-sm tracking-wider text-slate-300">ALPACA US</span>
            <span className="font-orbitron font-bold text-sm tracking-wider text-slate-300">BINANCE SPOT</span>
            <span className="font-orbitron font-bold text-sm tracking-wider text-slate-300">HEDERA HBAR</span>
            <span className="font-orbitron font-bold text-sm tracking-wider text-slate-300">WAYLINE QUANT</span>
            <span className="font-orbitron font-bold text-sm tracking-wider text-slate-300">INVICTUS</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. WEALTH CREATION ASSET RAIL (Image 2) */}
      {/* ========================================================================= */}
      <section className="py-8 border-y border-white/10 bg-slate-950/60 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
              Simplifying Wealth Creation Across Global Capital Markets
            </h2>
          </div>

          {/* Connected Neon Pipeline Rail */}
          <div className="relative flex items-center justify-between overflow-x-auto pb-2 scrollbar-none gap-3">
            {/* Luminous Connecting Wire */}
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent -translate-y-1/2 pointer-events-none hidden sm:block" />

            {ASSET_RAILS.map((rail, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectMarket(rail.market)}
                className="relative shrink-0 z-10 px-4 py-2 rounded-xl glass-panel hover:bg-slate-900 border border-white/10 hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(0,229,255,0.25)] transition-all flex items-center gap-2 group cursor-pointer"
              >
                <span className="text-base group-hover:scale-125 transition-transform">{rail.icon}</span>
                <span className="text-xs font-mono font-bold text-slate-300 group-hover:text-cyan-300 whitespace-nowrap">
                  {rail.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. DUAL SHOWCASE: AI Signals Tablet & AlgoLift Sci-Fi FUI (Image 1 + 3) */}
      {/* ========================================================================= */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left / Top Card: "From AI Signals To Auto Trading - All In One Platform" */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden border border-white/10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-4">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>Real-Time Execution Bus</span>
            </div>
            <h2 className="font-orbitron font-bold text-2xl sm:text-3xl text-white mb-3">
              From AI Signals To Auto Trading — All In One Platform
            </h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Whether you want a ready-to-go AI Trading bot or powerful AI APIs to build your own tools—we've got you covered with sub-millisecond market feeds.
            </p>

            <div className="flex items-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => onSelectMarket("bot")}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition shadow-[0_0_20px_rgba(0,229,255,0.3)] flex items-center gap-1.5"
              >
                <span>Launch Trading Bot</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onOpenOrderTicket()}
                className="px-5 py-2.5 rounded-xl glass-panel text-white font-medium text-xs hover:border-cyan-400 transition"
              >
                <span>Open Blotter</span>
              </button>
            </div>

            {/* Embedded Live Market Watchlist Tablet Frame (from Image 1 Top Right) */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/90 p-3 sm:p-4 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[10px] font-mono uppercase text-slate-500">
                <span className="w-28">Asset</span>
                <span className="text-right flex-1">Price</span>
                <span className="text-right w-20">24h Chg</span>
                <span className="text-right w-20">Action</span>
              </div>

              <div className="space-y-2">
                {LIVE_TICKERS.map((ticker) => (
                  <div
                    key={ticker.symbol}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-cyan-500/20 transition-all font-mono text-xs"
                  >
                    <div className="flex items-center gap-2 w-28">
                      <span className="text-sm">{ticker.icon}</span>
                      <div>
                        <div className="font-bold text-white text-xs">{ticker.symbol}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[80px]">{ticker.name}</div>
                      </div>
                    </div>
                    <div className="text-right flex-1 font-semibold text-slate-200">
                      {ticker.price}
                    </div>
                    <div className={`text-right w-20 font-bold ${ticker.isUp ? "text-emerald-400" : "text-rose-400"}`}>
                      {ticker.change}
                    </div>
                    <div className="text-right w-20">
                      <button
                        type="button"
                        onClick={() => {
                          terminalStore.updateImmediate({ activeBookSymbol: ticker.symbol });
                          onOpenOrderTicket(ticker.symbol);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-500/30 text-[10px] font-bold text-cyan-300 transition-all"
                      >
                        Trade
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Card: AlgoLift Sci-Fi HUD Avatar & Chess King (Image 3) */}
          <div className="glass-panel-glow p-6 sm:p-8 rounded-3xl relative overflow-hidden border border-cyan-500/30 flex flex-col items-center text-center">
            {/* Tech HUD Corner Brackets */}
            <div className="absolute top-4 left-4 text-[10px] font-mono text-cyan-400/60 select-none">
              [+ ML-POWERED VALIDATION +] <span className="text-cyan-400">.:</span>
            </div>
            <div className="absolute bottom-4 left-4 text-[10px] font-mono text-cyan-400/60 select-none">
              [.: INSTITUTIONAL GRADE ACCURACY :.]
            </div>
            <div className="absolute top-4 right-4 text-[10px] font-mono text-emerald-400/60 select-none">
              MAB THOMPSON SAMPLING
            </div>

            {/* Stylized Algolift Brand Headline */}
            <h2 className="font-orbitron font-black text-3xl sm:text-4xl text-white tracking-widest uppercase mt-4 mb-2">
              ALGOLIFT
            </h2>
            <p className="text-xs font-mono text-cyan-300 mb-6 tracking-wider">
              SOVEREIGN NEURAL ARBITRAGE & REINFORCEMENT LEARNING
            </p>

            {/* Central Android Silhouette & Dashed Orbit Rings (Image 3) */}
            <div className="relative w-64 h-64 my-4 flex items-center justify-center">
              {/* Outer Dashed Orbit Ring */}
              <div className="absolute inset-0 rounded-full border border-dashed border-cyan-400/30 animate-spin-slow" />
              {/* Middle Dashed Ring */}
              <div className="absolute inset-6 rounded-full border border-dashed border-emerald-400/20" />
              {/* Glowing Aura Behind Avatar */}
              <div className="absolute inset-10 rounded-full bg-gradient-to-b from-cyan-500/25 to-emerald-500/10 blur-xl" />

              {/* Sci-Fi Android Head Silhouette with Dot Matrix Visor */}
              <div className="relative z-10 w-36 h-48 rounded-t-full bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border border-cyan-400/40 shadow-2xl flex flex-col items-center pt-8 overflow-hidden">
                <div className="w-24 h-10 rounded-xl bg-slate-950 border border-cyan-400/50 flex items-center justify-around px-2 shadow-[0_0_15px_rgba(0,229,255,0.4)]">
                  {/* Visor Dot Matrix */}
                  <div className="grid grid-cols-4 gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  </div>
                </div>
                {/* Tech lines */}
                <div className="w-12 h-1 bg-cyan-400/30 rounded mt-4" />
                <div className="w-8 h-0.5 bg-emerald-400/30 rounded mt-1.5" />
              </div>

              {/* Floating Holographic HUD Card with Wireframe Chess King (Image 3 Right) */}
              <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-2xl glass-panel-glow border border-cyan-400/40 text-left max-w-[150px] shadow-2xl backdrop-blur-xl">
                {/* Wireframe Chess King Icon */}
                <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-400/40 flex items-center justify-center mb-2 text-cyan-300">
                  <svg className="w-6 h-6 stroke-cyan-300 stroke-[1.8] fill-none" viewBox="0 0 24 24">
                    <path d="M12 2v4M10 4h4M9 9l3-3 3 3M7 14h10M6 18h12M5 22h14M8 9l-1 5h10l-1-5M9 14v4M15 14v4" />
                  </svg>
                </div>
                <div className="text-[11px] font-bold text-white font-mono leading-tight">No code &lt;/&gt;</div>
                <div className="text-[10px] text-cyan-400 font-mono">Just strategy</div>
                <div className="text-[8px] text-slate-400 font-mono mt-1">Institutional grade accuracy</div>
              </div>
            </div>

            {/* Launch Callout */}
            <button
              type="button"
              onClick={() => onSelectMarket("bot")}
              className="mt-6 px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 text-slate-950 font-bold text-xs hover:brightness-110 shadow-[0_0_20px_rgba(0,229,255,0.4)] transition flex items-center gap-2"
            >
              <Cpu className="w-4 h-4" />
              <span>Inspect Algorithmic Model</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. PERPS & QUANT SPECIALIST SECTION (Image 1 Middle Right) */}
      {/* ========================================================================= */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl relative overflow-hidden border border-white/10">
          <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-gradient-to-br from-cyan-500/10 via-emerald-500/10 to-transparent blur-3xl pointer-events-none" />

          <div className="max-w-2xl mb-10">
            <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-bold block mb-2">
              High Conviction Architecture
            </span>
            <h2 className="font-orbitron font-extrabold text-3xl sm:text-4xl text-white mb-4">
              Perps & Quant Specialist, Not a Multipurpose Bot.
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Engineered exclusively for statistical edge, liquidity preservation, and non-linear capital growth across high-frequency market regimes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: Compound Returns */}
            <div className="p-6 rounded-2xl glass-card-interactive border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base mb-2 font-orbitron">Compound Returns</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                AI predicts market trend regimes for longs and shorts, compounding returns with continuous parameter drift adaptation and Half-Kelly fractioning.
              </p>
            </div>

            {/* Feature 2: Institutional Execution */}
            <div className="p-6 rounded-2xl glass-card-interactive border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base mb-2 font-orbitron">Institutional Execution</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Keep your keys. Non-custodial direct API and FIX 4.4 routing with pro-grade sub-5ms internal queue speed and zero front-running.
              </p>
            </div>

            {/* Feature 3: Intelligent Hedging */}
            <div className="p-6 rounded-2xl glass-card-interactive border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base mb-2 font-orbitron">Intelligent Hedging</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                The more market volatility spikes, the tighter your risk envelope becomes with Bayesian multi-specialist voting and downside circuit breakers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. ADVANCED TRADING FEATURES BENTO GRID (Image 2 Bottom) */}
      {/* ========================================================================= */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-orbitron font-extrabold text-3xl sm:text-4xl text-white tracking-wide mb-3">
            ADVANCED TRADING FEATURES
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            These institutional capabilities empower you to reach your wealth creation and alpha targets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BENTO_FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                onClick={() => onSelectMarket(feat.market)}
                className="glass-card-interactive p-6 rounded-2xl cursor-pointer group flex flex-col justify-between h-48"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-all">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-cyan-300">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="font-orbitron font-bold text-xs text-white uppercase tracking-wider mb-2 group-hover:text-cyan-300 transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-3">
                    {feat.desc}
                  </p>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 group-hover:translate-x-1 transition-transform pt-2">
                  <span>Open Engine</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. STRATEGY & BOT PRICING TIER MATRIX (Image 1 Bottom Left) */}
      {/* ========================================================================= */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl relative overflow-hidden border border-white/10 text-center">
          <div className="max-w-2xl mx-auto mb-8">
            <h2 className="font-orbitron font-extrabold text-3xl sm:text-4xl text-white mb-3">
              Choose Your Strategy Tier
            </h2>
            <p className="text-slate-400 text-sm">
              Select an execution tier that fits your algorithmic trading parameters.
            </p>

            {/* Pill Toggle */}
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-950/80 border border-white/10 mt-6">
              <button
                type="button"
                onClick={() => setActivePlanTab("bot")}
                className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activePlanTab === "bot"
                    ? "bg-cyan-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Trading Bot
              </button>
              <button
                type="button"
                onClick={() => setActivePlanTab("api")}
                className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activePlanTab === "api"
                    ? "bg-cyan-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Institutional API
              </button>
            </div>
          </div>

          {/* Pricing Table / Cards from Image 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-5xl mx-auto mb-8">
            {/* Tier 1: STARTER */}
            <div
              onClick={() => setSelectedPlanTier("starter")}
              className={`p-6 rounded-2xl cursor-pointer transition-all ${
                selectedPlanTier === "starter"
                  ? "glass-panel-glow border-cyan-400/60 shadow-[0_0_30px_rgba(0,229,255,0.2)]"
                  : "glass-panel border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 font-mono text-xs font-bold text-slate-300">
                  STARTER
                </span>
                <span className="font-mono font-bold text-2xl text-white">$79<span className="text-xs text-slate-400">/mo</span></span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed mb-6">
                AI-powered trading for beginners. Fully automated, safe, and simple. Single chain, Trading Ethereum & Bitcoin Spot.
              </p>
              <ul className="space-y-2 text-[11px] font-mono text-slate-400 border-t border-white/10 pt-4">
                <li className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  Single-engine automation
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  15-min cycle polling
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  Conservative Kelly sizing (0.25x)
                </li>
              </ul>
            </div>

            {/* Tier 2: PRO (Featured in Image 1 with glowing cyan highlight) */}
            <div
              onClick={() => setSelectedPlanTier("pro")}
              className={`p-6 rounded-2xl cursor-pointer transition-all relative ${
                selectedPlanTier === "pro"
                  ? "glass-panel-glow border-cyan-400 shadow-[0_0_35px_rgba(0,229,255,0.3)] ring-1 ring-cyan-400/50"
                  : "glass-panel border-white/10 hover:border-white/20"
              }`}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 font-bold text-[9px] uppercase tracking-wider shadow-md">
                Most Popular
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 font-mono text-xs font-bold text-cyan-300">
                  PRO
                </span>
                <span className="font-mono font-bold text-2xl text-cyan-300">$149<span className="text-xs text-slate-400">/mo</span></span>
              </div>
              <p className="text-slate-200 text-xs leading-relaxed mb-6">
                Starter Packet + multi-chain execution, JSE equities & US Wall Street access, Half-Kelly compounding, priority websocket.
              </p>
              <ul className="space-y-2 text-[11px] font-mono text-slate-300 border-t border-white/10 pt-4">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  All 3 Engines (JSE, US, Crypto)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  Sub-second L2/L3 tick stream
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  Anti-Tilt Circuit Breaker active
                </li>
              </ul>
            </div>

            {/* Tier 3: ELITE */}
            <div
              onClick={() => setSelectedPlanTier("elite")}
              className={`p-6 rounded-2xl cursor-pointer transition-all ${
                selectedPlanTier === "elite"
                  ? "glass-panel-glow border-cyan-400/60 shadow-[0_0_30px_rgba(0,229,255,0.2)]"
                  : "glass-panel border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 font-mono text-xs font-bold text-slate-300">
                  ELITE
                </span>
                <span className="font-mono font-bold text-2xl text-white">$199<span className="text-xs text-slate-400">/mo</span></span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed mb-6">
                Pro Packet + autonomous MAB agent, real-time L3 blotter, zero-latency direct IPC bus, and full annual audit reports.
              </p>
              <ul className="space-y-2 text-[11px] font-mono text-slate-400 border-t border-white/10 pt-4">
                <li className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  Full MAB Multi-Analyst Consensus
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  Cross-market stat arbitrage
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  Institutional FIX 4.4 direct colocation
                </li>
              </ul>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectMarket("bot")}
            className="px-8 py-3.5 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 font-bold text-sm shadow-[0_0_25px_rgba(0,229,255,0.35)] hover:brightness-110 transition flex items-center gap-2 mx-auto"
          >
            <Rocket className="w-4 h-4" />
            <span>Deploy Selected Tier in Bot Engine</span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. DIGITAL PARTICLE WAVE CTA BANNER (Image 1 Bottom Right) */}
      {/* ========================================================================= */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden glass-panel-glow border border-cyan-500/30 p-8 sm:p-14 text-center">
          {/* Cyan Particle Wave Simulation Graphics */}
          <div className="absolute inset-0 hud-grid-dots opacity-40 pointer-events-none" />
          <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[800px] h-[250px] bg-gradient-to-t from-cyan-500/25 via-emerald-500/15 to-transparent blur-2xl pointer-events-none" />

          <h2 className="font-orbitron font-extrabold text-3xl sm:text-5xl text-white mb-4 relative z-10">
            Start Your Trading Journey Today
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto mb-8 relative z-10 font-light">
            Discover how our automated sovereign system can transform your multi-market trading experience effortlessly and efficiently.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 relative z-10">
            <button
              type="button"
              onClick={() => onSelectMarket("bot")}
              className="px-8 py-3.5 rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 text-slate-950 font-black text-sm shadow-[0_0_30px_rgba(0,229,255,0.5)] hover:scale-105 transition-all"
            >
              Get Started Now
            </button>
            <button
              type="button"
              onClick={() => onSelectMarket("jse")}
              className="px-7 py-3.5 rounded-full glass-panel hover:bg-white/[0.08] text-white font-bold text-sm border border-white/20 transition-all"
            >
              Enter Trading Terminal
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CommandOverviewPortal;
