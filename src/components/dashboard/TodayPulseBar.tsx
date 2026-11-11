"use client";

import React from "react";
import { Flame, Clock, Droplets, HeartPulse, ShieldAlert, Cpu, Sparkles } from "lucide-react";
import { HealthData, SpendIncomeData, BinanceBotData } from "@/lib/types";
import { formatLKR, formatUSD } from "@/lib/utils";

interface PulseBarProps {
  health: HealthData;
  spendIncome: SpendIncomeData;
  bot: BinanceBotData;
}

export function TodayPulseBar({ health, spendIncome, bot }: PulseBarProps) {
  const { today } = health;
  const caloriePct = Math.min(100, Math.round((today.calories / today.calorieLimit) * 100));
  const proteinPct = Math.min(100, Math.round((today.protein / today.proteinGoal) * 100));
  const fastingHours = (today.fastingMinutes / 60).toFixed(1);
  const fastingPct = Math.min(100, Math.round((today.fastingMinutes / today.fastingGoalMinutes) * 100));
  const isSugarDanger = today.sugar > today.sugarLimit;

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800/80 rounded-3xl p-4 md:p-5 backdrop-blur-xl shadow-xl shadow-slate-950/40 mb-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">Today&apos;s Live Pulse</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-400">24-hour real-time health balance, intraday spend, and crypto bot vitals.</p>
          </div>
        </div>

        {/* Binance Trading Bot Micro Status */}
        <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-800 rounded-2xl px-3.5 py-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold text-slate-300">Binance Bot:</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                bot.isRunning
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {bot.isRunning ? `${bot.mode} Active` : "Stopped"}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div className="text-xs">
            <span className="text-slate-400">Wallet: </span>
            <span className="font-mono font-semibold text-amber-400">{formatUSD(bot.totalWalletUsdt)}</span>
          </div>
        </div>
      </div>

      {/* Grid of Pulse Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-4">
        {/* Calories */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 font-medium">
              <Flame className="h-3.5 w-3.5 text-amber-500" /> Calories
            </span>
            <span className="font-mono text-[11px] text-slate-400">{caloriePct}%</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold font-mono text-white">{today.calories}</span>
            <span className="text-[11px] text-slate-400">/ {today.calorieLimit} kcal</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500" style={{ width: `${caloriePct}%` }} />
          </div>
        </div>

        {/* Protein */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 font-medium">
              <HeartPulse className="h-3.5 w-3.5 text-rose-500" /> Protein
            </span>
            <span className="font-mono text-[11px] text-slate-400">{proteinPct}%</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold font-mono text-white">{today.protein}g</span>
            <span className="text-[11px] text-slate-400">/ {today.proteinGoal}g</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500" style={{ width: `${proteinPct}%` }} />
          </div>
        </div>

        {/* Sugar Guardrail */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 font-medium">
              <ShieldAlert className={`h-3.5 w-3.5 ${isSugarDanger ? "text-rose-500" : "text-emerald-400"}`} /> Sugar Limit
            </span>
            <span className={`text-[10px] font-bold ${isSugarDanger ? "text-rose-400" : "text-emerald-400"}`}>
              {isSugarDanger ? "Over" : "Safe"}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold font-mono ${isSugarDanger ? "text-rose-400" : "text-white"}`}>{today.sugar}g</span>
            <span className="text-[11px] text-slate-400">/ &lt; {today.sugarLimit}g</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isSugarDanger ? "bg-rose-500" : "bg-emerald-400"}`}
              style={{ width: `${Math.min(100, (today.sugar / today.sugarLimit) * 100)}%` }}
            />
          </div>
        </div>

        {/* Fasting Timer */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 font-medium">
              <Clock className="h-3.5 w-3.5 text-indigo-400" /> Fasting
            </span>
            <span className="text-[10px] font-semibold text-indigo-400">{today.isFastingActive ? "Active" : "Done"}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold font-mono text-white">{fastingHours}h</span>
            <span className="text-[11px] text-slate-400">/ 16.0h target</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${fastingPct}%` }} />
          </div>
        </div>

        {/* Water & Streak */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 font-medium">
              <Droplets className="h-3.5 w-3.5 text-cyan-400" /> Hydration
            </span>
            <span className="text-[10px] font-semibold text-amber-400">🔥 {today.streakDays}d</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold font-mono text-white">{today.waterGlasses}</span>
            <span className="text-[11px] text-slate-400">/ {today.waterGoal} glasses</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (today.waterGlasses / today.waterGoal) * 100)}%` }}
            />
          </div>
        </div>

        {/* Today's Spend */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium text-slate-300">Today&apos;s Spend</span>
            <span className="text-[10px] text-emerald-400">Safe pace</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold font-mono text-white">{formatLKR(spendIncome.dailyAverageSpend)}</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 truncate">
            Safe pace: <span className="font-mono text-slate-300">{formatLKR(spendIncome.dailySafeBurnRate)}/day</span>
          </div>
        </div>
      </div>
    </div>
  );
}
