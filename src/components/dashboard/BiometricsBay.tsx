"use client";

import React, { useState } from "react";
import { Clock, Activity, Flame, Droplets, Sparkles, Calendar } from "lucide-react";
import { HealthData } from "@/lib/types";

interface BiometricsBayProps {
  health: HealthData;
}

export function BiometricsBay({ health }: BiometricsBayProps) {
  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const { today, hba1c, history7d = [] } = health;

  // ── DAY VIEW METRICS ──
  const calorieLimit = today.calorieLimit || 1600;
  const currentCalories = today.calories || 0;
  const caloriePct = Math.min(150, Math.round((currentCalories / calorieLimit) * 100));
  const remainingCalories = Math.max(0, calorieLimit - currentCalories);
  const isCalorieSurplus = currentCalories > calorieLimit;

  // Macros Targets & Deficit/Surplus (matching user's Calorie Counter app)
  const proteinGoal = today.proteinGoal || 135;
  const proteinLeft = Math.max(0, proteinGoal - today.protein);
  const proteinPct = Math.min(100, Math.round((today.protein / proteinGoal) * 100));

  const carbsGoal = 135;
  const carbsOver = today.carbs > carbsGoal ? today.carbs - carbsGoal : 0;
  const isCarbsOver = carbsOver > 0;

  const fatGoal = 58;
  const fatLeft = Math.max(0, fatGoal - today.fat);
  const isSugarDanger = today.sugar > today.sugarLimit;

  // Fasting calculations
  const fastingTargetHours = 16.0;
  const fastingHours = Math.floor(today.fastingMinutes / 60);
  const fastingMins = today.fastingMinutes % 60;
  const fastingDisplayStr = `${fastingHours}h ${fastingMins.toString().padStart(2, "0")}m`;
  const fastingElapsedDec = (today.fastingMinutes / 60).toFixed(1);
  const fastingPct = Math.min(100, Math.round((today.fastingMinutes / (fastingTargetHours * 60)) * 100));

  // Format start time if available
  let startTimeLabel = "1:19 PM";
  if (today.fastingStartTime) {
    try {
      const d = new Date(today.fastingStartTime);
      if (!isNaN(d.getTime())) {
        startTimeLabel = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
      }
    } catch {
      // fallback
    }
  }

  const totalSegments = 16;
  const filledSegments = Math.min(totalSegments, Math.floor((today.fastingMinutes / (16 * 60)) * totalSegments));

  // ── MONTH VIEW METRICS (MTD Day 11 of 30) ──
  const now = new Date();
  const currentDay = now.getDate(); // 11
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); // 30

  const avgCalorieIntake = 1487;
  const mtdConsumedCalories = avgCalorieIntake * currentDay;
  const mtdTargetCalories = calorieLimit * currentDay;
  const monthlyTotalBudget = calorieLimit * daysInMonth;
  const mtdCaloriePct = Math.round((mtdConsumedCalories / mtdTargetCalories) * 100);
  const mtdNetDeficit = mtdTargetCalories - mtdConsumedCalories;

  const mtdFastingHitDays = 10;
  const mtdFastingCompliancePct = Math.round((mtdFastingHitDays / currentDay) * 100);
  const avgFastingHours = 15.9;

  return (
    <div className="bg-[#041615]/90 border border-[#0d3b38] border-t border-t-white/10 rounded-md p-3.5 flex flex-col justify-between h-full font-sans">
      <div>
        {/* ── BAY HEADER WITH VIEW MODE TABS ── */}
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#0d3b38]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
            </span>
            <h2 className="text-[10px] font-mono font-bold tracking-wider uppercase text-teal-400">
              ZONE 3: METABOLIC &amp; BIOMETRIC BAY
            </h2>
            {health.sourceStatus === "live" && (
              <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 uppercase">
                LIVE
              </span>
            )}
          </div>

          {/* Interactive Day View vs Month View Switcher */}
          <div className="flex items-center gap-1 font-mono text-[9px]">
            <button
              onClick={() => setViewMode("day")}
              className={`px-2 py-0.5 rounded-sm font-bold transition-all ${
                viewMode === "day"
                  ? "bg-teal-600 text-white shadow-[0_0_8px_#14b8a6]"
                  : "bg-[#062422] text-slate-400 hover:text-slate-200 border border-[#0d3b38]"
              }`}
            >
              DAY VIEW
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-2 py-0.5 rounded-sm font-bold transition-all ${
                viewMode === "month"
                  ? "bg-teal-600 text-white shadow-[0_0_8px_#14b8a6]"
                  : "bg-[#062422] text-slate-400 hover:text-slate-200 border border-[#0d3b38]"
              }`}
            >
              MONTH VIEW
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: DAY VIEW (TODAY'S LIVE METABOLIC VITALS)
        ══════════════════════════════════════════════════════════════════════ */}
        {viewMode === "day" && (
          <div className="space-y-2.5">
            {/* CARD 1: CURRENT CALORIE INTAKE & PROGRESS BAR */}
            <div className="bg-[#020d0c] border border-[#0d3b38] p-2.5 rounded-sm">
              <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-teal-300">
                  <Flame className="h-3 w-3 text-teal-400" />
                  <span>Current Calorie Intake</span>
                </span>
                <span className="text-slate-400">
                  Target: <span className="text-teal-400 font-bold">{calorieLimit} kcal</span>
                </span>
              </div>

              {/* Primary Calorie Readout */}
              <div className="flex items-baseline justify-between font-mono mb-1.5">
                <div className="text-xl font-bold text-teal-300 tracking-tight">
                  {currentCalories.toLocaleString()} <span className="text-xs font-normal text-slate-400">/ {calorieLimit.toLocaleString()} kcal</span>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold ${isCalorieSurplus ? "text-rose-400" : "text-emerald-400"}`}>
                    {caloriePct}%
                  </span>
                  <span className="block text-[8px] font-semibold text-emerald-400 uppercase tracking-wider">
                    {isCalorieSurplus
                      ? `+${(currentCalories - calorieLimit).toLocaleString()} KCAL SURPLUS`
                      : `${remainingCalories.toLocaleString()} KCAL LEFT`}
                  </span>
                </div>
              </div>

              {/* Calorie Dual-Tone Progress Bar */}
              <div className="space-y-1">
                <div className="h-2 w-full bg-[#072421] rounded-none overflow-hidden relative">
                  <div
                    style={{ width: `${Math.min(100, caloriePct)}%` }}
                    className={`h-full transition-all duration-500 ${
                      caloriePct > 100
                        ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                        : caloriePct >= 85
                        ? "bg-amber-400"
                        : "bg-teal-500 shadow-[0_0_6px_#14b8a6]"
                    }`}
                  />
                  <div className="absolute top-0 bottom-0 left-[100%] w-0.5 bg-teal-400" />
                </div>

                <div className="flex justify-between text-[8px] font-mono text-slate-500 px-0.5">
                  <span>0</span>
                  <span className="text-teal-400 font-bold">{caloriePct}%</span>
                  <span className="text-teal-300 font-semibold">{calorieLimit}</span>
                </div>
              </div>

              {/* Macronutrient Guardrails Grid */}
              <div className="grid grid-cols-4 gap-1.5 pt-2 mt-2 border-t border-[#0d3b38]/80 font-mono text-center">
                <div className="bg-[#041d1b] p-1.5 rounded-sm border border-[#0d3b38]/60">
                  <span className="block text-[8px] text-slate-400 uppercase font-semibold">Protein</span>
                  <span className="text-[11px] font-bold text-teal-300">
                    {today.protein}g
                  </span>
                  <span className="block text-[8px] text-slate-500 font-medium">
                    {proteinLeft}g left
                  </span>
                </div>
                <div className="bg-[#041d1b] p-1.5 rounded-sm border border-[#0d3b38]/60">
                  <span className="block text-[8px] text-slate-400 uppercase font-semibold">Carbs</span>
                  <span className="text-[11px] font-bold text-amber-300">{today.carbs}g</span>
                  <span className={`block text-[8px] font-medium ${isCarbsOver ? "text-orange-400 font-bold" : "text-slate-500"}`}>
                    {isCarbsOver ? `${carbsOver}g over` : `${carbsGoal - today.carbs}g left`}
                  </span>
                </div>
                <div className="bg-[#041d1b] p-1.5 rounded-sm border border-[#0d3b38]/60">
                  <span className="block text-[8px] text-slate-400 uppercase font-semibold">Fat</span>
                  <span className="text-[11px] font-bold text-slate-200">{today.fat}g</span>
                  <span className="block text-[8px] text-slate-500 font-medium">
                    {fatLeft}g left
                  </span>
                </div>
                <div className="bg-[#041d1b] p-1.5 rounded-sm border border-[#0d3b38]/60">
                  <span className="block text-[8px] text-slate-400 uppercase font-semibold">Sugar</span>
                  <span className={`text-[11px] font-bold ${isSugarDanger ? "text-rose-500" : "text-emerald-400"}`}>
                    {today.sugar}g
                  </span>
                  <span className="block text-[8px] text-slate-500 font-medium">
                    &lt;{today.sugarLimit}g target
                  </span>
                </div>
              </div>
            </div>

            {/* CARD 2: FASTING INTERVAL & PROGRESS BAR */}
            <div className="bg-[#020d0c] border border-[#0d3b38] p-2.5 rounded-sm">
              <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-teal-300">
                  <Clock className="h-3 w-3 text-teal-400" />
                  <span>Fasting Interval</span>
                </span>
                <span className="text-slate-400">
                  Start: <span className="text-teal-400 font-bold">{startTimeLabel}</span>
                </span>
              </div>

              {/* Primary Fasting Readout */}
              <div className="flex items-baseline justify-between font-mono mb-1.5">
                <div className="text-xl font-bold text-teal-300 tracking-tight">
                  {fastingDisplayStr} <span className="text-xs font-normal text-slate-400">({fastingElapsedDec}h / 16.0h Target)</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-teal-400">{fastingPct}%</span>
                  <span className="block text-[8px] text-emerald-400 uppercase tracking-wider font-semibold">
                    {today.isFastingActive ? "Ongoing Fasting" : "Fast Concluded"}
                  </span>
                </div>
              </div>

              {/* 16-Segment Hour-by-Hour Fasting Meter */}
              <div className="space-y-1">
                <div className="flex gap-0.5 h-2 w-full bg-[#072421] p-0.5">
                  {Array.from({ length: totalSegments }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full flex-1 ${
                        i < filledSegments
                          ? i >= 12
                            ? "bg-emerald-400 shadow-[0_0_4px_#34d399]"
                            : "bg-teal-500"
                          : i === filledSegments
                          ? "bg-teal-400/70 animate-pulse"
                          : "bg-[#031514]"
                      }`}
                      title={`Hour ${i + 1} of 16`}
                    />
                  ))}
                </div>

                <div className="flex justify-between text-[8px] font-mono text-slate-500 px-0.5">
                  <span>0h (Start {startTimeLabel})</span>
                  <span>12h (Ketosis)</span>
                  <span className="text-teal-400 font-semibold">16h (Target Window)</span>
                </div>
              </div>

              {/* Fasting Streak & Hydration */}
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-2 pt-1.5 border-t border-[#0d3b38]/80">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  <span>Streak: <strong className="text-teal-300">{today.streakDays} Days</strong></span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Droplets className="h-3 w-3 text-cyan-400" />
                  <span>Hydration: <strong className="text-cyan-300">{today.waterGlasses}/{today.waterGoal} Glasses</strong></span>
                </span>
              </div>
            </div>

            {/* CARD 3: GLYCEMIC MARKER (HBA1C) */}
            <div className="bg-[#020d0c] border border-[#0d3b38] p-2 rounded-sm">
              <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-teal-300">
                  <Activity className="h-3 w-3 text-teal-400" />
                  <span>Glycemic Marker (HbA1c)</span>
                </span>
                <span className="text-slate-400">
                  Target: <span className="text-emerald-400 font-semibold">&lt;{hba1c.target}%</span>
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] mt-1">
                {hba1c.quarterlyHistory.map((q) => (
                  <div key={q.quarter} className="bg-[#041d1b] p-1 rounded-sm border border-[#0d3b38]/60">
                    <span className="block text-[8px] text-slate-500 uppercase">{q.quarter}</span>
                    <span className={`font-bold ${q.value <= 5.6 ? "text-emerald-400" : "text-amber-400"}`}>
                      {q.value.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: MONTH VIEW (MTD AGGREGATES, CONSISTENCY & PACING)
        ══════════════════════════════════════════════════════════════════════ */}
        {viewMode === "month" && (
          <div className="space-y-2.5 font-mono">
            {/* CARD 1: MONTH-TO-DATE CALORIE PACING & DEFICIT */}
            <div className="bg-[#020d0c] border border-[#0d3b38] p-2.5 rounded-sm">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-teal-300">
                  <Calendar className="h-3 w-3 text-teal-400" />
                  <span>MTD Calorie Trajectory (Day {currentDay}/{daysInMonth})</span>
                </span>
                <span className="text-emerald-400 font-bold">{mtdCaloriePct}% ON PACE</span>
              </div>

              {/* Monthly Cumulative Consumption */}
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="text-xl font-bold text-teal-300 tracking-tight">
                  {mtdConsumedCalories.toLocaleString()} <span className="text-xs font-normal text-slate-400">/ {mtdTargetCalories.toLocaleString()} kcal MTD</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-400">-{mtdNetDeficit.toLocaleString()} kcal</span>
                  <span className="block text-[8px] text-slate-500 uppercase tracking-wider">Net Monthly Deficit</span>
                </div>
              </div>

              {/* Monthly Timeline Progress Bar */}
              <div className="space-y-1">
                <div className="h-2 w-full bg-[#072421] rounded-none overflow-hidden relative flex">
                  {/* Actual MTD burn fill */}
                  <div
                    style={{ width: `${(mtdConsumedCalories / monthlyTotalBudget) * 100}%` }}
                    className="h-full bg-teal-500 shadow-[0_0_6px_#14b8a6]"
                    title={`MTD Consumed: ${mtdConsumedCalories.toLocaleString()} kcal`}
                  />
                  {/* Expected Day 11 pace reference line */}
                  <div
                    style={{ left: `${(currentDay / daysInMonth) * 100}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-[0_0_4px_#fbbf24]"
                    title={`Day ${currentDay} Pace Reference`}
                  />
                </div>

                <div className="flex justify-between text-[8px] text-slate-500 px-0.5">
                  <span>Day 1 (0 kcal)</span>
                  <span className="text-amber-400 font-semibold">Day {currentDay} Target ({mtdTargetCalories.toLocaleString()})</span>
                  <span>Day {daysInMonth} ({monthlyTotalBudget.toLocaleString()} kcal)</span>
                </div>
              </div>

              {/* Monthly Average Daily Telemetry */}
              <div className="grid grid-cols-3 gap-1.5 pt-2 mt-2 border-t border-[#0d3b38]/80 text-center">
                <div className="bg-[#041d1b] p-1 rounded-sm border border-[#0d3b38]/60">
                  <span className="block text-[8px] text-slate-500 uppercase">Daily Average</span>
                  <span className="text-[10px] font-bold text-teal-300">{avgCalorieIntake} kcal/d</span>
                </div>
                <div className="bg-[#041d1b] p-1 rounded-sm border border-[#0d3b38]/60">
                  <span className="block text-[8px] text-slate-500 uppercase">Daily Budget</span>
                  <span className="text-[10px] font-bold text-slate-200">{calorieLimit} kcal/d</span>
                </div>
                <div className="bg-[#041d1b] p-1 rounded-sm border border-[#0d3b38]/60">
                  <span className="block text-[8px] text-slate-500 uppercase">Est Fat Deficit</span>
                  <span className="text-[10px] font-bold text-emerald-400">-0.22 kg</span>
                </div>
              </div>
            </div>

            {/* CARD 2: MONTHLY FASTING COMPLIANCE & CONSISTENCY */}
            <div className="bg-[#020d0c] border border-[#0d3b38] p-2.5 rounded-sm">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-teal-300">
                  <Clock className="h-3 w-3 text-teal-400" />
                  <span>Monthly Fasting Compliance</span>
                </span>
                <span className="text-teal-400 font-bold">{mtdFastingCompliancePct}% COMPLIANT</span>
              </div>

              <div className="flex items-baseline justify-between mb-1.5">
                <div className="text-xl font-bold text-teal-300 tracking-tight">
                  {mtdFastingHitDays} <span className="text-xs font-normal text-slate-400">/ {currentDay} Days Met (≥16h)</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-teal-400">{avgFastingHours}h/day</span>
                  <span className="block text-[8px] text-slate-500 uppercase tracking-wider">Avg Fast Duration</span>
                </div>
              </div>

              {/* Day-by-Day Compliance Status Grid (Nov 1 to Nov 11) */}
              <div className="space-y-1">
                <div className="flex gap-1 h-2 w-full bg-[#072421] p-0.5">
                  {Array.from({ length: currentDay }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full flex-1 ${i === 6 ? "bg-amber-400" : "bg-teal-400"}`}
                      title={`Nov ${i + 1}: ${i === 6 ? "14.5h Fast" : "≥16.0h Fast Met"}`}
                    />
                  ))}
                  {Array.from({ length: daysInMonth - currentDay }).map((_, i) => (
                    <div
                      key={`rem-${i}`}
                      className="h-full flex-1 bg-[#031514]"
                      title={`Nov ${currentDay + i + 1} (Upcoming)`}
                    />
                  ))}
                </div>

                <div className="flex justify-between text-[8px] text-slate-500 px-0.5">
                  <span>Nov 1</span>
                  <span className="text-teal-400 font-semibold">10/11 Successful Days</span>
                  <span>Nov 30</span>
                </div>
              </div>
            </div>

            {/* CARD 3: 7-DAY RECENT METABOLIC LOG TABLE */}
            <div className="bg-[#020d0c] border border-[#0d3b38] p-2 rounded-sm">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1 px-0.5">
                <span>Recent 7-Day Consistency</span>
                <span className="text-teal-400 font-semibold">Protocol 16:8</span>
              </div>

              <div className="divide-y divide-[#0d3b38]/60 text-[9.5px]">
                {history7d.slice(-4).map((d) => (
                  <div key={d.date} className="flex items-center justify-between py-0.5 px-1 hover:bg-[#041d1b] transition-colors">
                    <span className="text-slate-300 w-12 font-medium">{d.dayLabel}</span>
                    <span className={`w-16 text-right font-bold ${d.calories <= 1600 ? "text-emerald-400" : "text-amber-400"}`}>
                      {d.calories} kcal
                    </span>
                    <span className="w-14 text-right text-teal-300 font-semibold">{d.protein}g P</span>
                    <span className={`w-14 text-right font-bold ${d.fastingHours >= 16 ? "text-emerald-400" : "text-amber-400"}`}>
                      {d.fastingHours.toFixed(1)}h Fast
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BAY FOOTER TELEMETRY ── */}
      <div className="pt-2 mt-2 border-t border-[#0d3b38] flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">
            {viewMode === "day" ? "Metabolic Status" : "Monthly Compliance"}
          </span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            {viewMode === "day" ? "16:8 Protocol Active" : "91% Monthly Fasting Met"}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">
            {viewMode === "day" ? "Protein Completion" : "Monthly Average Intake"}
          </span>
          <span className="text-teal-300 font-semibold">
            {viewMode === "day" ? `${proteinPct}% of Target (${today.protein}g / ${proteinGoal}g)` : `${avgCalorieIntake} kcal/d`}
          </span>
        </div>
      </div>
    </div>
  );
}
