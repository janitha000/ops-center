"use client";

import React from "react";
import {
  Sun,
  Zap,
  Clock,
  Cpu,
  TrendingUp,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { OpsDashboardPayload } from "@/lib/types";
import { TemporalDashboardModel } from "@/lib/decisions/types";
import { formatUSD, formatPercent, formatLKR } from "@/lib/utils";

interface LiveHorizonSectionProps {
  payload: OpsDashboardPayload;
  live: TemporalDashboardModel["live"];
  minPrices: Record<string, number>;
  onRefreshZone: (zoneKey: "zone1" | "zone2" | "zone3" | "zone4" | "zone5" | "zone6") => void;
  zoneRefreshing: Record<string, boolean>;
  evOverridden: boolean;
  onToggleEvOverride: () => void;
  botPaused: boolean;
  onToggleBotPaused: () => void;
}

function formatSltTime(isoStr: string | null | undefined, fallback = "—"): string {
  if (!isoStr) return fallback;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleTimeString("en-US", {
      timeZone: "Asia/Colombo",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return fallback;
  }
}

export function LiveHorizonSection({
  payload,
  live,
  minPrices,
  onRefreshZone,
  zoneRefreshing,
  evOverridden,
  onToggleEvOverride,
  botPaused,
  onToggleBotPaused,
}: LiveHorizonSectionProps) {
  const { gridFleet, bot, finance, health } = payload;

  // Segmented EV battery meter (10 segments)
  const evSegments = 10;
  const evFilled = Math.min(evSegments, Math.max(0, Math.round((live.evBatteryPct / 100) * evSegments)));

  // Fasting & 8h eating window calculations
  const fastingHours = Math.floor(live.fastingMinutes / 60);
  const fastingMins = live.fastingMinutes % 60;
  const fastingHhMm = `${fastingHours.toString().padStart(2, "0")}:${fastingMins
    .toString()
    .padStart(2, "0")}`;
  const fastingStartLabel = formatSltTime(live.fastingStartTime, "8:59 PM");
  const totalFastingSegments = 16;
  const filledFastingSegments = Math.min(
    totalFastingSegments,
    Math.floor((live.fastingMinutes / 960) * totalFastingSegments)
  );
  const isAutophagy = live.fastingMinutes >= 960;
  const isKetosis = live.fastingMinutes >= 720 && live.fastingMinutes < 960;

  const fastBrokenSource = live.fastBrokenAt ?? health.today.fastingEndTime ?? null;
  const showEatingWindow = !live.fastingActive && (live.eatingWindowActive || Boolean(fastBrokenSource));
  const eatingRemHours = Math.floor(live.eatingWindowRemainingMinutes / 60);
  const eatingRemMins = live.eatingWindowRemainingMinutes % 60;
  const eatingRemHhMm = `${eatingRemHours}h ${eatingRemMins.toString().padStart(2, "0")}m`;
  const eatingElapsedMinutes = Math.max(0, Math.min(480, 480 - live.eatingWindowRemainingMinutes));
  const totalEatingSegments = 8;
  const filledEatingSegments = Math.min(
    totalEatingSegments,
    Math.floor((eatingElapsedMinutes / 480) * totalEatingSegments)
  );
  const fastBrokenLabel = formatSltTime(fastBrokenSource);
  const eatingClosesLabel = formatSltTime(live.eatingWindowClosesAt);

  const openPositions = bot.openPositions || [];
  const effectiveBotActive = live.botRunning && !botPaused;

  const tickers = finance.stocks?.tickers || [];

  return (
    <section className="space-y-2">
      {/* ── TIER 1 BANNER ── */}
      <div className="flex items-center justify-between bg-[#0d0709] border border-rose-900/60 border-l-2 border-l-rose-500 rounded-sm px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          <h2 className="text-[10px] font-mono font-bold tracking-wider uppercase text-rose-300">
            TIER 1 // LIVE TELEMETRY STREAM (REAL-TIME INTRADAY STATE)
          </h2>
        </div>
        <span className="text-[9px] font-mono text-slate-400 hidden sm:inline">
          60s AUTO-POLL · INTRADAY HARDWARE &amp; MARKET PULSE
        </span>
      </div>

      {/* ── 4-COLUMN HIGH-DENSITY LIVE CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {/* CARD 1: SOLAR & EV GRID LIVE */}
        <div className="bg-[#120b04]/90 border border-[#3a2408] border-t border-t-white/10 rounded-md p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#3a2408]">
              <div className="flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                  Solar &amp; EV Grid Live
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-1.5 py-0.5 rounded-sm font-mono text-[8px] font-bold border ${
                    live.gridExportStatus === "EXPORTING"
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/70"
                      : live.gridExportStatus === "IMPORTING"
                      ? "bg-rose-950/80 text-rose-300 border-rose-700/70"
                      : "bg-slate-900 text-slate-300 border-slate-700"
                  }`}
                >
                  {live.gridExportStatus}
                </span>
                <button
                  onClick={() => onRefreshZone("zone4")}
                  disabled={!!zoneRefreshing.zone4}
                  className="p-1 rounded-sm bg-[#1c1105] hover:bg-[#2a1a08] border border-[#3a2408] text-amber-400 disabled:opacity-50"
                  title="Refresh Zone 4 Solar & EV"
                >
                  <RefreshCw className={`h-2.5 w-2.5 ${zoneRefreshing.zone4 ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Inverter + Net Grid */}
            <div className="grid grid-cols-2 gap-2 bg-[#0a0602] border border-[#3a2408]/80 rounded-sm p-2 mb-2 font-mono">
              <div>
                <span className="block text-[8px] text-slate-500 uppercase">Inverter Output</span>
                <span className="text-lg font-bold text-amber-300">{live.solarKw.toFixed(2)} kW</span>
              </div>
              <div className="border-l border-[#3a2408] pl-2">
                <span className="block text-[8px] text-slate-500 uppercase">Net Grid Flow</span>
                <span
                  className={`text-lg font-bold ${
                    live.gridExportStatus === "EXPORTING"
                      ? "text-emerald-400"
                      : live.gridExportStatus === "IMPORTING"
                      ? "text-rose-400"
                      : "text-slate-300"
                  }`}
                >
                  {live.netGridKw.toFixed(2)} kW
                </span>
              </div>
            </div>

            {/* BYD Sealion 6 Battery & Range */}
            <div className="bg-[#0a0602] border border-[#3a2408]/80 rounded-sm p-2 font-mono">
              <div className="flex items-center justify-between text-[9px] mb-1">
                <span className="text-amber-200 font-bold truncate">
                  {gridFleet.fleet.vehicleName}
                </span>
                <span
                  className={`text-[8px] font-bold ${
                    live.evChargerConnected ? "text-emerald-400" : "text-slate-500"
                  }`}
                >
                  {live.evChargerConnected ? "● POD CONNECTED" : "○ UNPLUGGED"}
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-1">
                <span className="text-base font-bold text-white">
                  {live.evBatteryPct}% <span className="text-[9px] font-normal text-slate-400">SOC</span>
                </span>
                <span className="text-[10px] text-slate-300">
                  Range: <strong className="text-amber-300">{live.evRangeKm} km</strong>
                </span>
              </div>

              {/* Segmented Battery Bar */}
              <div className="flex gap-0.5 h-2 w-full bg-[#1a1005] p-0.5 mb-1.5">
                {Array.from({ length: evSegments }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-full ${
                      idx < evFilled
                        ? live.evBatteryPct >= 50
                          ? "bg-amber-400"
                          : "bg-rose-400"
                        : "bg-[#241608]"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Interactive EV Night-Charge Override Toggle */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#3a2408] font-mono text-[9px]">
            <span className="text-slate-400">
              {evOverridden || live.evIsCharging ? "⚡ Instant Override Active" : "Sched: 23:00 Off-Peak"}
            </span>
            <button
              onClick={onToggleEvOverride}
              className={`px-2 py-1 rounded-sm font-bold border transition-all flex items-center gap-1 ${
                evOverridden || live.evIsCharging
                  ? "bg-amber-500 text-slate-950 border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                  : "bg-[#1c1105] text-amber-300 border-[#3a2408] hover:bg-[#2a1a08]"
              }`}
            >
              <Zap className="h-2.5 w-2.5" />
              <span>{evOverridden || live.evIsCharging ? "CHARGING ON" : "NIGHT OVERRIDE"}</span>
            </button>
          </div>
        </div>

        {/* CARD 2: 16:8 METABOLIC FASTING LIVE */}
        <div className="bg-[#041413]/90 border border-[#0d3b38] border-t border-t-white/10 rounded-md p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#0d3b38]">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-teal-400" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-300">
                  16:8 Metabolic Fasting
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-1.5 py-0.5 rounded-sm font-mono text-[8px] font-bold border ${
                    live.fastingActive
                      ? isAutophagy
                        ? "bg-emerald-950/90 text-emerald-300 border-emerald-700/80"
                        : isKetosis
                        ? "bg-teal-950/90 text-teal-300 border-teal-700/80"
                        : "bg-cyan-950/80 text-cyan-300 border-cyan-800/70"
                      : live.eatingWindowActive
                      ? live.eatingWindowRemainingMinutes <= 60
                        ? "bg-amber-950/90 text-amber-300 border-amber-700/80"
                        : "bg-teal-950/90 text-teal-200 border-teal-700/80"
                      : "bg-slate-900 text-slate-400 border-slate-700"
                  }`}
                >
                  {live.fastingActive
                    ? isAutophagy
                      ? "FAT OXIDATION / AUTOPHAGY"
                      : isKetosis
                      ? "FAT OXIDATION / KETOSIS"
                      : "FASTING LIVE"
                    : live.eatingWindowActive
                    ? "8H FEEDING WINDOW"
                    : "FEEDING WINDOW CLOSED"}
                </span>
                <button
                  onClick={() => onRefreshZone("zone3")}
                  disabled={!!zoneRefreshing.zone3}
                  className="p-1 rounded-sm bg-[#062422] hover:bg-[#0c3c39] border border-[#0d3b38] text-teal-400 disabled:opacity-50"
                  title="Refresh Zone 3 Biometrics"
                >
                  <RefreshCw className={`h-2.5 w-2.5 ${zoneRefreshing.zone3 ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {showEatingWindow ? (
              /* Live 8h Eating Window Closing Countdown */
              <div className="bg-[#020c0b] border border-[#0d3b38]/80 rounded-sm p-2.5 mb-2 font-mono">
                <div className="flex items-baseline justify-between mb-1">
                  <div>
                    <span className="block text-[8px] text-amber-400/90 uppercase font-bold">
                      8h Eating Window Remaining
                    </span>
                    <span
                      className={`text-2xl font-bold tracking-tight ${
                        live.eatingWindowRemainingMinutes === 0
                          ? "text-rose-400"
                          : live.eatingWindowRemainingMinutes <= 60
                          ? "text-amber-300"
                          : "text-teal-300"
                      }`}
                    >
                      {live.eatingWindowRemainingMinutes > 0 ? eatingRemHhMm : "0h 00m"}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1.5">/ 8.0h</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[8px] text-slate-400">
                      Broke Fast: <strong className="text-teal-200">{fastBrokenLabel}</strong>
                    </span>
                    <span className="block text-[9px] text-amber-300 font-bold mt-0.5">
                      Stop @ {eatingClosesLabel} SLT
                    </span>
                  </div>
                </div>

                {/* 8-Segment Hour-by-Hour Eating Window Progress Bar */}
                <div className="flex gap-0.5 h-2.5 w-full bg-[#061f1d] p-0.5 my-2">
                  {Array.from({ length: totalEatingSegments }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-full ${
                        i < filledEatingSegments
                          ? i >= 6
                            ? "bg-amber-400"
                            : "bg-teal-500"
                          : i === filledEatingSegments && live.eatingWindowActive
                          ? "bg-amber-300/70 animate-pulse"
                          : "bg-[#031211]"
                      }`}
                      title={`Feeding Hour ${i + 1} / 8`}
                    />
                  ))}
                </div>

                <div className="flex justify-between text-[8px] text-slate-500">
                  <span>Open ({fastBrokenLabel})</span>
                  <span className="text-teal-400/80">16:8 Window</span>
                  <span className="text-amber-400 font-bold">Close ({eatingClosesLabel})</span>
                </div>
              </div>
            ) : (
              /* Elapsed Fasting Timer */
              <div className="bg-[#020c0b] border border-[#0d3b38]/80 rounded-sm p-2.5 mb-2 font-mono">
                <div className="flex items-baseline justify-between mb-1">
                  <div>
                    <span className="block text-[8px] text-slate-500 uppercase">Elapsed Window</span>
                    <span className="text-2xl font-bold text-teal-300 tracking-tight">
                      {fastingHhMm}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1.5">/ 16.0h</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-400">{live.fastingPct}%</span>
                    <span className="block text-[8px] text-slate-400">
                      Start: <strong className="text-teal-200">{fastingStartLabel}</strong>
                    </span>
                  </div>
                </div>

                {/* 16-Segment Hour-by-Hour Progress Bar */}
                <div className="flex gap-0.5 h-2.5 w-full bg-[#061f1d] p-0.5 my-2">
                  {Array.from({ length: totalFastingSegments }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-full ${
                        i < filledFastingSegments
                          ? i >= 12
                            ? "bg-emerald-400 shadow-[0_0_4px_#34d399]"
                            : "bg-teal-500"
                          : i === filledFastingSegments && live.fastingActive
                          ? "bg-teal-400/70 animate-pulse"
                          : "bg-[#031211]"
                      }`}
                      title={`Hour ${i + 1} / 16`}
                    />
                  ))}
                </div>

                <div className="flex justify-between text-[8px] text-slate-500">
                  <span>0h</span>
                  <span className="text-teal-400/80">12h Fat Oxidation</span>
                  <span className="text-emerald-400 font-bold">16h Autophagy</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#0d3b38] font-mono text-[9px] text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-400" />
              Streak: <strong className="text-teal-300">{health.today.streakDays}d</strong>
            </span>
            <span>
              Sugar today:{" "}
              <strong
                className={
                  health.today.sugar > health.today.sugarLimit ? "text-rose-400" : "text-emerald-400"
                }
              >
                {health.today.sugar}g / {health.today.sugarLimit}g
              </strong>
            </span>
          </div>
        </div>

        {/* CARD 3: TRADING BOT LIVE RADAR */}
        <div className="bg-[#070b1a]/90 border border-[#17234d] border-t border-t-white/10 rounded-md p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#17234d]">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                  Trading Bot Radar
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[8px]">
                <span className="px-1.5 py-0.5 rounded-sm bg-cyan-950/80 text-cyan-300 border border-cyan-800/70 uppercase font-bold">
                  {live.botMode}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-sm font-bold border uppercase ${
                    effectiveBotActive
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/70"
                      : "bg-rose-950/80 text-rose-300 border-rose-700/70"
                  }`}
                >
                  {botPaused ? "FROZEN" : live.botRunning ? "ACTIVE" : "OFFLINE"}
                </span>
                <button
                  onClick={() => onRefreshZone("zone5")}
                  disabled={!!zoneRefreshing.zone5}
                  className="p-1 rounded-sm bg-[#0d1533] hover:bg-[#172452] border border-[#17234d] text-cyan-400 disabled:opacity-50"
                  title="Refresh Zone 5 Trading Bot"
                >
                  <RefreshCw className={`h-2.5 w-2.5 ${zoneRefreshing.zone5 ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Wallet USDT & Active Signals */}
            <div className="grid grid-cols-3 gap-1.5 bg-[#040714] border border-[#17234d]/80 rounded-sm p-2 mb-2 font-mono">
              <div>
                <span className="block text-[8px] text-slate-500 uppercase">Free USDT</span>
                <span className="text-sm font-bold text-slate-100">
                  {formatUSD(live.botFreeUsdt)}
                </span>
                <span className="block text-[8px] text-cyan-400 font-semibold">
                  {live.botIdleCashPct.toFixed(1)}% Free USDT
                </span>
              </div>
              <div className="border-l border-[#17234d] pl-2">
                <span className="block text-[8px] text-slate-500 uppercase">Total Wallet</span>
                <span className="text-sm font-bold text-cyan-300">
                  {formatUSD(live.botTotalWalletUsdt)}
                </span>
                <span className="block text-[8px] text-slate-400">
                  {live.botOpenPositionsCount} open pos
                </span>
              </div>
              <div className="border-l border-[#17234d] pl-2">
                <span className="block text-[8px] text-slate-500 uppercase">Slot Signals</span>
                <span
                  className={`text-sm font-bold ${
                    live.botActiveSignalsCount > 0 ? "text-emerald-400" : "text-slate-300"
                  }`}
                >
                  {live.botActiveSignalsCount}
                </span>
                <span className="block text-[8px] text-slate-400">
                  Active / {bot.slots?.length || 0} slots
                </span>
              </div>
            </div>

            {/* Open Positions List */}
            <div className="space-y-1.5 max-h-[125px] overflow-y-auto pr-0.5 font-mono">
              {openPositions.length === 0 ? (
                <div className="bg-[#040714] border border-[#17234d]/70 rounded-sm p-2 text-center text-[9px] text-slate-400">
                  0 open positions · Scanning {bot.slots?.length || 0} slots ({live.botActiveSignalsCount} active signals)
                </div>
              ) : (
                openPositions.map((pos) => {
                  const isLong = pos.side === "LONG";
                  const slDistPct =
                    pos.stopLoss > 0 && pos.currentPrice > 0
                      ? ((isLong ? pos.currentPrice - pos.stopLoss : pos.stopLoss - pos.currentPrice) /
                          pos.currentPrice) *
                        100
                      : null;
                  const tpDistPct =
                    pos.takeProfit > 0 && pos.currentPrice > 0
                      ? ((isLong ? pos.takeProfit - pos.currentPrice : pos.currentPrice - pos.takeProfit) /
                          pos.currentPrice) *
                        100
                      : null;
                  const isNearTp = tpDistPct !== null && tpDistPct >= 0 && tpDistPct <= 2.5;

                  return (
                    <div
                      key={pos.id || pos.symbol}
                      className="bg-[#040714] border border-[#17234d] rounded-sm p-1.5 text-[9px]"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-cyan-300">
                          {pos.symbol}{" "}
                          <span
                            className={`text-[8px] px-1 rounded-2xs ${
                              isLong
                                ? "bg-emerald-950 text-emerald-300"
                                : "bg-rose-950 text-rose-300"
                            }`}
                          >
                            {pos.side}
                          </span>
                        </span>
                        <span
                          className={`font-bold ${
                            pos.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {pos.unrealizedPnl >= 0
                            ? `+${formatUSD(pos.unrealizedPnl)}`
                            : `-${formatUSD(Math.abs(pos.unrealizedPnl))}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[8px] text-slate-400">
                        <span>
                          In: {formatUSD(pos.entryPrice)} → {formatUSD(pos.currentPrice)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[8px] mt-0.5 pt-0.5 border-t border-[#17234d]/60">
                        <span className="text-rose-300/90">
                          SL {pos.stopLoss > 0 ? formatUSD(pos.stopLoss) : "—"}{" "}
                          {slDistPct !== null && (
                            <span className="text-slate-400">({slDistPct.toFixed(1)}% away)</span>
                          )}
                        </span>
                        <span className={isNearTp ? "text-emerald-300 font-bold" : "text-emerald-400/90"}>
                          TP {pos.takeProfit > 0 ? formatUSD(pos.takeProfit) : "—"}{" "}
                          {tpDistPct !== null && (
                            <span className={isNearTp ? "text-emerald-300" : "text-slate-400"}>
                              ({tpDistPct.toFixed(1)}% to TP)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bot Kill-Switch Toggle */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#17234d] font-mono text-[9px]">
            <span className="text-slate-400">
              uPnL:{" "}
              <strong
                className={live.botUnrealizedPnlUsdt >= 0 ? "text-emerald-400" : "text-rose-400"}
              >
                {live.botUnrealizedPnlUsdt >= 0
                  ? `+${formatUSD(live.botUnrealizedPnlUsdt)}`
                  : `-${formatUSD(Math.abs(live.botUnrealizedPnlUsdt))}`}
              </strong>
            </span>
            <button
              onClick={onToggleBotPaused}
              className={`px-2 py-1 rounded-sm font-bold border transition-all flex items-center gap-1 ${
                botPaused
                  ? "bg-rose-950/90 border-rose-500 text-rose-200 shadow-[0_0_8px_rgba(244,63,94,0.35)]"
                  : "bg-[#0d1533] border-[#17234d] text-slate-200 hover:border-rose-500/70"
              }`}
            >
              {botPaused ? (
                <ShieldAlert className="h-2.5 w-2.5 text-rose-400" />
              ) : (
                <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
              )}
              <span>{botPaused ? "BOT FROZEN" : "KILL-SWITCH"}</span>
            </button>
          </div>
        </div>

        {/* CARD 4: CSE INTRADAY STOCK WATCH */}
        <div className="bg-[#07120c]/90 border border-[#133323] border-t border-t-white/10 rounded-md p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#133323]">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300">
                  CSE Intraday Watch
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[8px]">
                <span className="px-1.5 py-0.5 rounded-sm bg-emerald-950/80 text-emerald-300 border border-emerald-800/70 font-bold">
                  {live.cseStockCount} TICKERS
                </span>
                {live.cseAlertsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-sm bg-amber-950/80 text-amber-300 border border-amber-700/70 font-bold">
                    {live.cseAlertsCount} BUY ZONE
                  </span>
                )}
                <button
                  onClick={() => onRefreshZone("zone1")}
                  disabled={!!zoneRefreshing.zone1}
                  className="p-1 rounded-sm bg-[#0b2419] hover:bg-[#133323] border border-[#164e35] text-emerald-400 disabled:opacity-50"
                  title="Refresh Zone 1 CSE Equities"
                >
                  <RefreshCw className={`h-2.5 w-2.5 ${zoneRefreshing.zone1 ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="space-y-1 max-h-[175px] overflow-y-auto pr-0.5 font-mono">
              {tickers.length === 0 ? (
                <div className="bg-[#040c08] border border-[#133323] rounded-sm p-2 text-center text-[9px] text-slate-500">
                  No PAL.lk CSE tickers synced.
                </div>
              ) : (
                tickers.slice(0, 6).map((t) => {
                  const cleanSym = t.symbol.split(".")[0].toUpperCase();
                  const minTarget = minPrices[cleanSym] ?? minPrices[t.symbol.toUpperCase()];
                  const hasMin = typeof minTarget === "number" && minTarget > 0;
                  const distPct = hasMin ? ((t.price - minTarget) / minTarget) * 100 : null;
                  const isBelowMin = hasMin && t.price < minTarget;

                  return (
                    <div
                      key={t.symbol}
                      className="bg-[#040c08] border border-[#133323] rounded-sm px-2 py-1 text-[9.5px] flex items-center justify-between gap-1"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-100">{cleanSym}</span>
                          <span
                            className={`text-[8px] ${
                              (t.changePct ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {formatPercent(t.changePct ?? 0)}
                          </span>
                        </div>
                        <div className="text-[8px] text-slate-500">
                          {hasMin ? (
                            <span className={isBelowMin ? "text-emerald-400 font-bold" : "text-slate-400"}>
                              Min {formatLKR(minTarget)} ({distPct! >= 0 ? `+${distPct!.toFixed(1)}%` : `${distPct!.toFixed(1)}%`})
                            </span>
                          ) : (
                            <span>No min target</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`font-bold ${isBelowMin ? "text-emerald-400" : "text-white"}`}>
                          Rs. {t.price.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div
                          className={`text-[8px] font-semibold ${
                            (t.unrealizedPnlPct ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          uPnL {formatPercent(t.unrealizedPnlPct ?? 0)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-1.5 pt-2 mt-2 border-t border-[#133323] font-mono">
            {/* Top Intraday Mover & Max Portfolio Concentration Strip */}
            <div className="grid grid-cols-2 gap-1.5 bg-[#040c08] border border-[#133323] rounded-sm px-2 py-1 text-[8.5px]">
              <div className="truncate">
                <span className="text-slate-500 uppercase">Top Mover: </span>
                {live.cseTopMoverSymbol ? (
                  <strong
                    className={
                      live.cseTopMoverChangePct >= 0 ? "text-emerald-400" : "text-rose-400"
                    }
                  >
                    {live.cseTopMoverSymbol.split(".")[0]} {formatPercent(live.cseTopMoverChangePct)}
                  </strong>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
              <div className="text-right truncate border-l border-[#133323] pl-1.5">
                <span className="text-slate-500 uppercase">Max Conc: </span>
                {live.cseMaxConcentrationSymbol ? (
                  <strong
                    className={
                      live.cseMaxConcentrationPct >= 22 ? "text-amber-300" : "text-slate-200"
                    }
                  >
                    {live.cseMaxConcentrationSymbol.split(".")[0]}{" "}
                    {live.cseMaxConcentrationPct.toFixed(1)}%
                  </strong>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span>
                Port:{" "}
                <strong className="text-emerald-300">
                  {formatLKR(finance.stocks.portfolioValue, true)}
                </strong>
              </span>
              <button
                onClick={() => onRefreshZone("zone1")}
                disabled={!!zoneRefreshing.zone1}
                className="px-2 py-0.5 rounded-sm bg-[#0b2419] hover:bg-[#133323] border border-[#164e35] text-emerald-300 font-bold flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`h-2.5 w-2.5 ${zoneRefreshing.zone1 ? "animate-spin" : ""}`} />
                <span>SYNC ZONE 1</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
