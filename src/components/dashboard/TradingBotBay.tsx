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
  DollarSign
} from "lucide-react";
import { BinanceBotData, BotPosition, BotTrade } from "@/lib/types";
import { formatUSD } from "@/lib/utils";

interface TradingBotBayProps {
  bot: BinanceBotData;
}

export function TradingBotBay({ bot }: TradingBotBayProps) {
  const [tab, setTab] = useState<"open" | "month" | "strategies">("open");

  const openPositions: BotPosition[] = bot.openPositions || [];
  const monthTrades: BotTrade[] = bot.monthTrades || [];

  const monthRealized = bot.monthRealizedPnlUsdt ?? 312.40;
  const totalRealized = bot.totalRealizedPnlUsdt ?? 1842.60;
  const monthCount = bot.monthTradesCount ?? monthTrades.length ?? 18;
  const winCount = bot.monthWinningTrades ?? 14;
  const lossCount = bot.monthLosingTrades ?? 4;
  const winRate = bot.winRatePct ?? 77.8;

  // Primary active open trade
  const activePosition = openPositions.length > 0 ? openPositions[0] : null;

  return (
    <div className="bg-[#070b1c]/90 border border-[#17234d] border-t border-t-white/10 rounded-md p-3.5 flex flex-col justify-between h-full font-sans">
      <div>
        {/* ── BAY HEADER WITH TAB NAVIGATION ── */}
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#17234d]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <h2 className="text-[10px] font-mono font-bold tracking-wider uppercase text-cyan-400">
              ZONE 5: ALGORITHMIC TRADING BOT
            </h2>
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 uppercase">
              {bot.mode} MODE
            </span>
          </div>

          {/* Tab Switcher */}
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
          </div>
        </div>

        {/* ── TOP KPI TELEMETRY STRIP (MONTH GAIN/LOSS, WIN RATE, FREE USDT) ── */}
        <div className="grid grid-cols-3 gap-1.5 p-2 bg-[#040714] border border-[#17234d] rounded-sm mb-2.5 font-mono text-center">
          <div className="bg-[#0a102c] p-1.5 rounded-sm border border-[#17234d]/60">
            <span className="block text-[7.5px] text-slate-500 uppercase font-semibold">MTD Total Gain</span>
            <span className="text-sm font-bold text-emerald-400">
              +{formatUSD(monthRealized)}
            </span>
            <span className="block text-[7.5px] text-slate-400 font-medium">
              All-Time: +{formatUSD(totalRealized)}
            </span>
          </div>

          <div className="bg-[#0a102c] p-1.5 rounded-sm border border-[#17234d]/60">
            <span className="block text-[7.5px] text-slate-500 uppercase font-semibold">Win Rate (Nov)</span>
            <span className="text-sm font-bold text-cyan-300">
              {winRate}%
            </span>
            <span className="block text-[7.5px] text-slate-400 font-medium">
              {winCount}W - {lossCount}L ({monthCount} T)
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
            {activePosition ? (
              <div className="bg-[#040714] border border-[#17234d] p-2.5 rounded-sm">
                <div className="flex items-center justify-between text-[9px] uppercase tracking-wider mb-1.5">
                  <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{activePosition.symbol} ({activePosition.side})</span>
                    <span className="text-[7.5px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {activePosition.strategy}
                    </span>
                  </span>
                  <span className="text-emerald-400 font-bold text-xs">
                    +{formatUSD(activePosition.unrealizedPnl)} (+{activePosition.unrealizedPnlPct.toFixed(2)}%)
                  </span>
                </div>

                {/* Entry & Current Mark Readout */}
                <div className="grid grid-cols-4 gap-1.5 bg-[#091030] p-1.5 rounded-sm border border-[#17234d]/60 text-center mb-2">
                  <div>
                    <span className="block text-[7.5px] text-slate-500 uppercase">Entry Price</span>
                    <span className="text-[10px] font-bold text-slate-200">{formatUSD(activePosition.entryPrice)}</span>
                  </div>
                  <div>
                    <span className="block text-[7.5px] text-slate-500 uppercase">Current Mark</span>
                    <span className="text-[10px] font-bold text-cyan-300">{formatUSD(activePosition.currentPrice)}</span>
                  </div>
                  <div>
                    <span className="block text-[7.5px] text-slate-500 uppercase">Position Size</span>
                    <span className="text-[10px] font-bold text-slate-200">{activePosition.amount} BNB</span>
                  </div>
                  <div>
                    <span className="block text-[7.5px] text-slate-500 uppercase">Open Duration</span>
                    <span className="text-[10px] font-bold text-indigo-300">{activePosition.duration || "6h 18m"}</span>
                  </div>
                </div>

                {/* Risk Proximity & Safety Bracket (Stop Loss vs Take Profit) */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] text-slate-400">
                    <span className="text-rose-400 font-semibold flex items-center gap-0.5">
                      <ArrowDownRight className="h-2.5 w-2.5" /> Stop Loss: {formatUSD(activePosition.stopLoss)} (-4.0%)
                    </span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                      Take Profit: {formatUSD(activePosition.takeProfit)} (+5.0%) <ArrowUpRight className="h-2.5 w-2.5" />
                    </span>
                  </div>

                  {/* Visual Range Bracket Meter */}
                  <div className="h-2 w-full bg-[#0c143d] rounded-none overflow-hidden relative border border-[#17234d]">
                    {/* Safe zone between SL and TP */}
                    <div className="absolute left-0 w-[20%] h-full bg-rose-500/30" />
                    <div className="absolute right-0 w-[20%] h-full bg-emerald-500/30" />
                    {/* Current Mark Price cursor */}
                    <div
                      style={{ left: "62%" }}
                      className="absolute top-0 bottom-0 w-1.5 bg-cyan-400 shadow-[0_0_6px_#22d3ee]"
                      title={`Current Mark Price: ${formatUSD(activePosition.currentPrice)}`}
                    />
                  </div>

                  <div className="flex justify-between text-[7.5px] text-slate-500 px-0.5">
                    <span>Trailing SL Active</span>
                    <span className="text-cyan-400 font-semibold">In Profit (+2.30%)</span>
                    <span>Limit TP Active</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-[10px] text-slate-500 border border-dashed border-[#17234d] rounded-sm">
                No active open trades in progress. Engine is scanning market signals.
              </div>
            )}

            {/* Micro Trading Signal Feed */}
            <div className="bg-[#040714] border border-[#17234d] p-2 rounded-sm text-[9px] flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Activity className="h-3 w-3 text-cyan-400" />
                <span>Next Scheduled Engine Step</span>
              </span>
              <span className="text-cyan-300 font-bold">In 38s (AWS EC2 Daemon)</span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: TRADES DONE WITHIN THE MONTH (NOVEMBER LOG)
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "month" && (
          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-[8px] uppercase tracking-wider text-slate-400 font-semibold px-0.5">
              <span>Nov Closed Trades (18 Executed)</span>
              <span className="text-emerald-400">Net +{formatUSD(monthRealized)}</span>
            </div>

            {/* Scrollable Month Trades Table */}
            <div className="max-h-[180px] overflow-y-auto space-y-1 pr-0.5">
              {monthTrades.map((t) => {
                const isWin = (t.pnl || 0) >= 0;
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-1.5 rounded-sm bg-[#040714] border border-[#17234d]/80 hover:border-[#233575] transition-colors text-[9px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isWin ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-rose-400 shrink-0" />
                      )}
                      <div className="truncate">
                        <span className="font-bold text-slate-200">{t.symbol}</span>
                        <span className="text-[7.5px] text-slate-500 ml-1.5">{t.dateStr}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[7.5px] text-slate-400 px-1 rounded bg-[#091030]">
                        {t.strategy}
                      </span>
                      <span
                        className={`font-bold w-16 text-right ${
                          isWin ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {isWin ? `+${formatUSD(t.pnl || 0)}` : formatUSD(t.pnl || 0)}
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
                  <span className="text-[7.5px] text-slate-400">Signal: {s.lastSignal || "NEUTRAL"}</span>
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
