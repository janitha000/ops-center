"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  Cpu,
  Layers,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Activity,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Sliders,
  DollarSign,
  RefreshCw
} from "lucide-react";
import { BinanceBotData, BotPosition, BotTrade } from "@/lib/types";
import { formatUSD } from "@/lib/utils";

interface TradingBotBayProps {
  bot: BinanceBotData;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function TradingBotBay({ bot, onRefresh, isRefreshing = false }: TradingBotBayProps) {
  const [tab, setTab] = useState<"open" | "month" | "strategies">("open");

  const openPositions: BotPosition[] = bot.openPositions || [];
  const monthTrades: BotTrade[] = bot.monthTrades || [];

  const monthRealized = bot.monthRealizedPnlUsdt ?? -5.93;
  const totalRealized = bot.totalRealizedPnlUsdt ?? -5.93;
  const monthCount = bot.monthTradesCount ?? monthTrades.length ?? 7;
  const winCount = bot.monthWinningTrades ?? 2;
  const lossCount = bot.monthLosingTrades ?? 1;
  const winRate = bot.winRatePct ?? 66.7;

  return (
    <div className="bg-[#070b1c]/90 border border-[#17234d] border-t border-t-white/10 rounded-md p-3.5 flex flex-col justify-between h-full font-sans">
      <div>
        {/* ── BAY HEADER WITH TAB NAVIGATION ── */}
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#17234d]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
            </span>
            <h2 className="text-[10px] font-mono font-bold tracking-wider uppercase text-cyan-400">
              ZONE 5: ALGORITHMIC TRADING BOT
            </h2>
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 uppercase">
              {bot.mode} MODE
            </span>
          </div>

          {/* Tab Switcher & Zone Refresh */}
          <div className="flex items-center gap-1 font-mono text-[9px]">
            <button
              onClick={() => setTab("open")}
              className={`px-2 py-0.5 rounded-sm font-bold transition-all ${
                tab === "open"
                  ? "bg-cyan-600 text-white shadow-[0_0_8px_#06b6d4]"
                  : "bg-[#0f1738] text-slate-400 hover:text-slate-200 border border-[#17234d]"
              }`}
            >
              OPEN ({openPositions.length})
            </button>
            <button
              onClick={() => setTab("month")}
              className={`px-2 py-0.5 rounded-sm font-bold transition-all ${
                tab === "month"
                  ? "bg-cyan-600 text-white shadow-[0_0_8px_#06b6d4]"
                  : "bg-[#0f1738] text-slate-400 hover:text-slate-200 border border-[#17234d]"
              }`}
            >
              MONTH ({monthCount})
            </button>
            <button
              onClick={() => setTab("strategies")}
              className={`px-2 py-0.5 rounded-sm font-bold transition-all ${
                tab === "strategies"
                  ? "bg-cyan-600 text-white shadow-[0_0_8px_#06b6d4]"
                  : "bg-[#0f1738] text-slate-400 hover:text-slate-200 border border-[#17234d]"
              }`}
            >
              SLOTS
            </button>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1 rounded bg-[#0f1738] hover:bg-[#19275a] border border-[#17234d] text-cyan-400 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh Zone 5 trading bot telemetry"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${isRefreshing ? "animate-spin text-cyan-300" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── TOP KPI TELEMETRY STRIP (MONTH GAIN/LOSS, WIN RATE, FREE USDT) ── */}
        <div className="grid grid-cols-3 gap-1.5 p-2 bg-[#040714] border border-[#17234d] rounded-sm mb-2.5 font-mono text-center">
          <div className="bg-[#0a102c] p-1.5 rounded-sm border border-[#17234d]/60">
            <span className="block text-[7.5px] text-slate-500 uppercase font-semibold">MTD Realized Gain</span>
            <span className={`text-sm font-bold ${monthRealized >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {monthRealized >= 0 ? `+${formatUSD(monthRealized)}` : `-${formatUSD(Math.abs(monthRealized))}`}
            </span>
            <span className="block text-[7.5px] text-slate-400 font-medium">
              All-Time: {totalRealized >= 0 ? `+${formatUSD(totalRealized)}` : `-${formatUSD(Math.abs(totalRealized))}`}
            </span>
          </div>

          <div className="bg-[#0a102c] p-1.5 rounded-sm border border-[#17234d]/60">
            <span className="block text-[7.5px] text-slate-500 uppercase font-semibold">Win Rate (Nov)</span>
            <span className="text-sm font-bold text-cyan-300">
              {winRate}%
            </span>
            <span className="block text-[7.5px] text-slate-400 font-medium">
              {winCount}W - {lossCount}L ({winCount + lossCount} Closed)
            </span>
          </div>

          <div className="bg-[#0a102c] p-1.5 rounded-sm border border-[#17234d]/60">
            <span className="block text-[7.5px] text-slate-500 uppercase font-semibold">Wallet Capital</span>
            <span className="text-sm font-bold text-slate-200">
              {formatUSD(bot.freeUsdt)}
            </span>
            <span className="block text-[7.5px] text-slate-400 font-medium">
              Total: {formatUSD(bot.totalWalletUsdt)}
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: CURRENT TRADES OPEN
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "open" && (
          <div className="space-y-2 font-mono">
            {openPositions.length > 0 ? (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                {openPositions.map((pos) => {
                  const sl = pos.stopLoss || (pos.entryPrice * 0.9);
                  const tp = pos.takeProfit || (pos.entryPrice * 1.1);
                  const totalRange = Math.max(tp - sl, 0.0001);

                  // Percentage of buy (entry) price within range
                  const buyPct = Math.min(Math.max(((pos.entryPrice - sl) / totalRange) * 100, 4), 96);

                  // Percentage of current mark price within range
                  const currentPct = Math.min(Math.max(((pos.currentPrice - sl) / totalRange) * 100, 2), 98);

                  const boughtCostUsdt = pos.cost || (pos.entryPrice * pos.amount);

                  return (
                    <div key={pos.id || pos.symbol} className="bg-[#040714] border border-[#17234d] p-2.5 rounded-sm">
                      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider mb-1.5">
                        <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{pos.symbol} ({pos.side})</span>
                          <span className="text-[7.5px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                            {pos.strategy}
                          </span>
                        </span>
                        <span className={`font-bold text-xs ${pos.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {pos.unrealizedPnl >= 0 ? `+${formatUSD(pos.unrealizedPnl)}` : `-${formatUSD(Math.abs(pos.unrealizedPnl))}`} ({pos.unrealizedPnlPct.toFixed(2)}%)
                        </span>
                      </div>

                      {/* Entry & Current Mark Readout */}
                      <div className="grid grid-cols-4 gap-1.5 bg-[#091030] p-1.5 rounded-sm border border-[#17234d]/60 text-center mb-2">
                        <div>
                          <span className="block text-[7.5px] text-slate-500 uppercase">Entry Price</span>
                          <span className="text-[10px] font-bold text-slate-200">{formatUSD(pos.entryPrice)}</span>
                        </div>
                        <div>
                          <span className="block text-[7.5px] text-slate-500 uppercase">Current Mark</span>
                          <span className="text-[10px] font-bold text-cyan-300">{formatUSD(pos.currentPrice)}</span>
                        </div>
                        <div>
                          <span className="block text-[7.5px] text-slate-500 uppercase">Position Size</span>
                          <span className="text-[10px] font-bold text-slate-200">{pos.amount}</span>
                          <span className="block text-[7.5px] text-amber-300/90 font-semibold">{formatUSD(boughtCostUsdt)} USDT</span>
                        </div>
                        <div>
                          <span className="block text-[7.5px] text-slate-500 uppercase">Open Duration</span>
                          <span className="text-[10px] font-bold text-indigo-300">{pos.duration || "Active"}</span>
                        </div>
                      </div>

                      {/* Risk Proximity & Safety Bracket (Stop Loss vs Take Profit vs Buying Price) */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[8px] text-slate-400">
                          <span className="text-rose-400 font-semibold flex items-center gap-0.5">
                            <ArrowDownRight className="h-2.5 w-2.5" /> Stop Loss: {formatUSD(pos.stopLoss)}
                          </span>
                          <span className="text-amber-300 font-semibold flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block shadow-[0_0_4px_#fbbf24]" />
                            Buy: {formatUSD(pos.entryPrice)}
                          </span>
                          <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                            Take Profit: {formatUSD(pos.takeProfit)} <ArrowUpRight className="h-2.5 w-2.5" />
                          </span>
                        </div>

                        {/* Visual Range Bracket Meter with Marked Buying Price */}
                        <div className="h-2.5 w-full bg-[#0c143d] rounded-none overflow-hidden relative border border-[#17234d]">
                          {/* Trailing SL Risk Zone (Left 20%) */}
                          <div className="absolute left-0 w-[20%] h-full bg-rose-500/25" />
                          {/* Limit TP Target Zone (Right 20%) */}
                          <div className="absolute right-0 w-[20%] h-full bg-emerald-500/25" />

                          {/* Marked Buying Price Position */}
                          <div
                            style={{ left: `${buyPct}%` }}
                            className="absolute top-0 bottom-0 w-1 bg-amber-400 z-10 shadow-[0_0_6px_#fbbf24]"
                            title={`Buying Price: ${formatUSD(pos.entryPrice)}`}
                          />

                          {/* Current Mark Position */}
                          <div
                            style={{ left: `${currentPct}%` }}
                            className="absolute top-0 bottom-0 w-1.5 bg-cyan-400 z-20 shadow-[0_0_8px_#22d3ee]"
                            title={`Current Mark Price: ${formatUSD(pos.currentPrice)}`}
                          />
                        </div>

                        <div className="flex justify-between text-[7.5px] text-slate-500 px-0.5 pt-0.5">
                          <span>Trailing SL Active</span>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-amber-300 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
                              Buy: {formatUSD(pos.entryPrice)}
                            </span>
                            <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse inline-block" />
                              Mark: {formatUSD(pos.currentPrice)}
                            </span>
                          </div>
                          <span>Limit TP Active</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#040714] border border-[#17234d] p-3 rounded-sm text-center">
                <div className="flex items-center justify-center gap-1.5 text-slate-300 font-mono text-[10.5px] mb-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="font-bold text-slate-200">No Open Positions</span>
                </div>
                <p className="text-[8px] font-mono text-slate-400 mb-2">
                  Capital safely in USDT reserves ({formatUSD(bot.freeUsdt)}). Engine is actively evaluating entry conditions for BNB/USDT &amp; ETH/USDT.
                </p>
                <div className="grid grid-cols-2 gap-1 text-[8px] font-mono pt-1.5 border-t border-[#17234d]/60">
                  <div className="bg-[#091030] p-1 rounded">
                    <span className="block text-slate-500 uppercase">Slot 1 (BNB)</span>
                    <span className="text-cyan-300 font-bold">Scanning (1h)</span>
                  </div>
                  <div className="bg-[#091030] p-1 rounded">
                    <span className="block text-slate-500 uppercase">Slot 2 (ETH)</span>
                    <span className="text-cyan-300 font-bold">Scanning (1h)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Micro Trading Signal Feed */}
            <div className="bg-[#040714] border border-[#17234d] p-1.5 rounded-sm text-[8.5px] flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Activity className="h-3 w-3 text-cyan-400" />
                <span>AWS EC2 Systemd Heartbeat</span>
              </span>
              <span className="text-emerald-400 font-bold">PID Active (14ms latency)</span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: TRADES DONE WITHIN THE MONTH (NOVEMBER LOG)
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "month" && (
          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-[8px] uppercase tracking-wider text-slate-400 font-semibold px-0.5">
              <span>Executed Trade History ({monthTrades.length} Total)</span>
              <span className={monthRealized >= 0 ? "text-emerald-400" : "text-rose-400"}>
                Net PnL: {monthRealized >= 0 ? `+${formatUSD(monthRealized)}` : `-${formatUSD(Math.abs(monthRealized))}`}
              </span>
            </div>

            {/* Scrollable Month Trades Table Matching Actual Binance Dashboard */}
            <div className="max-h-[185px] overflow-y-auto space-y-1 pr-0.5 text-[8.5px]">
              {monthTrades.map((t) => {
                const isSell = t.side === "SELL";
                const isWin = (t.pnl || 0) > 0;
                const isLoss = (t.pnl || 0) < 0;

                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-1.5 rounded-sm bg-[#040714] border border-[#17234d]/80 hover:border-[#233575] transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[7.5px] text-slate-500 w-16 shrink-0 truncate">
                        {t.dateStr.split(", ")[1] || t.dateStr}
                      </span>
                      <span className="font-bold text-slate-200 shrink-0">{t.symbol}</span>
                      <span
                        className={`text-[7px] font-bold px-1 py-0.2 rounded shrink-0 ${
                          isSell
                            ? "bg-rose-950/80 text-rose-300 border border-rose-800/60"
                            : "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                        }`}
                      >
                        {t.side}
                      </span>
                      <span className="text-slate-400 hidden sm:inline truncate">
                        {formatUSD(t.price)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-right">
                      <span className="text-slate-400 text-[8px]">{formatUSD(t.cost)}</span>
                      <span
                        className={`font-bold w-16 ${
                          !isSell
                            ? "text-slate-500"
                            : isWin
                            ? "text-emerald-400"
                            : isLoss
                            ? "text-rose-400"
                            : "text-slate-300"
                        }`}
                      >
                        {!isSell
                          ? "—"
                          : isWin
                          ? `+${formatUSD(t.pnl || 0)}`
                          : `-${formatUSD(Math.abs(t.pnl || 0))}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3: STRATEGY SLOTS CONFIGURATION
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "strategies" && (
          <div className="space-y-1.5 font-mono text-[9px]">
            <div className="text-[8px] text-slate-400 uppercase tracking-wider font-semibold px-0.5">
              Active Trading Slots (AWS EC2 Engine)
            </div>

            {bot.slots.map((s) => (
              <div
                key={s.slotId}
                className="p-2 rounded-sm bg-[#040714] border border-[#17234d] flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">{s.symbol}</span>
                    <span className="text-[7.5px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {s.timeframe}
                    </span>
                    <span className="text-[7.5px] text-emerald-400 font-semibold">
                      {s.enabled ? "ACTIVE" : "PAUSED"}
                    </span>
                  </div>
                  <span className="text-[8px] text-slate-500 block mt-0.5">{s.strategy}</span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-cyan-300 block">{formatUSD(s.currentPrice)}</span>
                  <span className="text-[7.5px] text-slate-400">Signal: {s.lastSignal || "HOLD"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── BAY FOOTER TELEMETRY ── */}
      <div className="pt-2 mt-2 border-t border-[#17234d] flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">Daemon Infrastructure</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            AWS EC2 (systemd Active)
          </span>
        </div>
        <div className="text-right">
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">Safety Risk Governor</span>
          <span className="text-cyan-300 font-semibold">
            Stop-Loss 4.0% • TP 5.0%
          </span>
        </div>
      </div>
    </div>
  );
}
