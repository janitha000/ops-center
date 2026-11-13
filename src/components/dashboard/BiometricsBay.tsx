"use client";

import React, { useState } from "react";
import { Clock, Flame, Droplets, Sparkles, RefreshCw, Scale, Settings2, Zap } from "lucide-react";
import { HealthData } from "@/lib/types";
import { GoogleFitModal } from "./GoogleFitModal";

interface BiometricsBayProps {
  health: HealthData;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function formatSltTime(isoStr: string | null | undefined): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("en-US", {
      timeZone: "Asia/Colombo",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return null;
  }
}

export function BiometricsBay({ health, onRefresh, isRefreshing = false }: BiometricsBayProps) {
  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const [isGfitModalOpen, setIsGfitModalOpen] = useState(false);
  const { today, biometrics } = health;

  // ── DAY VIEW METRICS ──
  const calorieLimit = today.calorieLimit || 1600;
  const currentCalories = today.calories || 0;
  const caloriePct = Math.min(150, Math.round((currentCalories / calorieLimit) * 100));
  const remainingCalories = Math.max(0, calorieLimit - currentCalories);
  const isCalorieSurplus = currentCalories > calorieLimit;

  // Macros Targets & Deficit/Surplus
  const proteinGoal = today.proteinGoal || 135;
  const proteinLeft = Math.max(0, proteinGoal - today.protein);
  const proteinPct = Math.min(100, Math.round((today.protein / proteinGoal) * 100));

  const carbsGoal = 135;
  const carbsOver = today.carbs > carbsGoal ? today.carbs - carbsGoal : 0;
  const isCarbsOver = carbsOver > 0;

  const fatGoal = 45;
  const fatLeft = Math.max(0, fatGoal - today.fat);
  const isSugarDanger = today.sugar > today.sugarLimit;

  // Fasting calculations (matching Calorie Counter TopHUD)
  const fastingTargetHours = 16.0;
  const fastingHours = Math.floor(today.fastingMinutes / 60);
  const fastingMins = today.fastingMinutes % 60;
  const fastingDisplayStr = `${fastingHours}h ${fastingMins.toString().padStart(2, "0")}m`;
  const fastingElapsedDec = (today.fastingMinutes / 60).toFixed(1);
  const fastingPct = Math.min(100, Math.round((today.fastingMinutes / (fastingTargetHours * 60)) * 100));

  const startTimeLabel = formatSltTime(today.fastingStartTime) || "8:59 PM";
  const endTimeLabel = formatSltTime(today.fastingEndTime);

  const totalSegments = 16;
  const filledSegments = Math.min(totalSegments, Math.floor((today.fastingMinutes / (16 * 60)) * totalSegments));

  // ── BIOMETRICS: WEIGHT, INTAKE & CALORIE EXPENDITURE ──
  const now = new Date();
  const sltNow = new Date(now.getTime() + 5.5 * 3600_000);
  const currentDay = sltNow.getUTCDate();
  const daysInMonth = new Date(Date.UTC(sltNow.getUTCFullYear(), sltNow.getUTCMonth() + 1, 0)).getUTCDate();
  const monthName = sltNow.toLocaleString("en-US", { month: "short", timeZone: "UTC" });

  const todayWeightKg = biometrics?.todayWeightKg ?? today.weightKg ?? 0;
  const targetWeightKg = biometrics?.targetWeightKg ?? 75.0;
  const startMonthWeightKg = biometrics?.startMonthWeightKg ?? todayWeightKg;
  const weightDeltaMtdKg = biometrics?.weightDeltaMtdKg ?? 0;
  const weightToTargetKg = todayWeightKg > 0 ? Number((todayWeightKg - targetWeightKg).toFixed(1)) : 0;

  const todayCaloriesExpended = biometrics?.todayCaloriesExpended ?? today.caloriesExpended ?? 0;
  const targetCaloriesExpended = biometrics?.targetCaloriesExpended ?? 2200;
  const expendedPct = Math.min(140, Math.round((todayCaloriesExpended / targetCaloriesExpended) * 100));
  const netCalorieBalance = currentCalories - todayCaloriesExpended;

  const googleFitConnected = biometrics?.googleFitConnected ?? false;
  const monthHistory = biometrics?.monthHistory ?? [];
  const weightHistoryDays = monthHistory.filter((d) => d.day <= currentDay && d.weightKg !== null);
  const logHistoryDays = monthHistory.filter(
    (d) =>
      d.day <= currentDay &&
      (d.weightKg !== null || d.caloriesExpended > 0 || (d.caloriesIntake || 0) > 0)
  );

  const avgDailyCaloriesExpended = biometrics?.avgDailyCaloriesExpended ?? 0;
  const mtdCaloriesExpended = biometrics?.mtdCaloriesExpended ?? 0;
  const avgDailyCaloriesIntake = biometrics?.avgDailyCaloriesIntake ?? 0;
  const mtdCaloriesIntake = biometrics?.mtdCaloriesIntake ?? 0;
  const mtdNetBalance = mtdCaloriesIntake - mtdCaloriesExpended;

  // Compute min/max for dynamic scaling in Month View Weight chart
  const weightValues = weightHistoryDays.map((d) => d.weightKg as number);
  const minWeight = weightValues.length > 0 ? Math.min(...weightValues, targetWeightKg) - 1.0 : 70.0;
  const maxWeight = weightValues.length > 0 ? Math.max(...weightValues) + 1.0 : 85.0;
  const weightRange = Math.max(1, maxWeight - minWeight);

  return (
    <div className="bg-[#041615]/90 border border-[#0d3b38] border-t border-t-white/10 rounded-md p-3.5 flex flex-col justify-between h-full font-sans">
      <div>
        {/* ── BAY HEADER WITH VIEW MODE TABS ── */}
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#0d3b38]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
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

          {/* Interactive Day View vs Month View Switcher & Google Fit Setup */}
          <div className="flex items-center gap-1 font-mono text-[9px]">
            <button
              onClick={() => setIsGfitModalOpen(true)}
              className={`px-1.5 py-0.5 rounded-sm font-bold flex items-center gap-1 transition-all border ${
                googleFitConnected
                  ? "bg-emerald-950/70 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/70"
                  : "bg-[#062422] text-teal-300 border-teal-700/60 hover:bg-[#0c3c39]"
              }`}
              title="Configure Google Fit OAuth (OKOK & Samsung Health)"
            >
              <Settings2 className="h-2.5 w-2.5" />
              <span>{googleFitConnected ? "GFIT" : "CONNECT GFIT"}</span>
            </button>
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
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1 rounded bg-[#062422] hover:bg-[#0c3c39] border border-[#0d3b38] text-teal-400 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh Zone 3 biometrics data"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${isRefreshing ? "animate-spin text-teal-300" : ""}`} />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: DAY VIEW (TODAY'S LIVE METABOLIC & BIOMETRIC VITALS)
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
                  {endTimeLabel ? (
                    <span>
                      Window: <span className="text-teal-400 font-bold">{startTimeLabel} → {endTimeLabel}</span>
                    </span>
                  ) : (
                    <span>
                      Since: <span className="text-teal-400 font-bold">{startTimeLabel}</span>
                    </span>
                  )}
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
                    {today.isFastingActive ? "Ongoing • 0g Sugar" : `Fast Broken (${endTimeLabel})`}
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
                          : i === filledSegments && today.isFastingActive
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

            {/* CARD 3: TODAY WEIGHT & CALORIE EXPENDITURE (GOOGLE FIT / OKOK / SAMSUNG HEALTH) */}
            <div className="bg-[#020d0c] border border-[#0d3b38] p-2.5 rounded-sm font-mono">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                <span className="flex items-center gap-1.5 text-teal-300">
                  <Scale className="h-3 w-3 text-teal-400" />
                  <span>Today Weight &amp; Calorie Expenditure</span>
                </span>
                <button
                  onClick={() => setIsGfitModalOpen(true)}
                  className="text-[8px] text-teal-400 hover:text-teal-200 underline uppercase font-bold"
                >
                  {googleFitConnected ? "Google Fit Live" : "Sync / Edit"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Left Box: Today's Weight (OKOK / Google Fit) */}
                <div className="bg-[#041d1b] p-2 rounded-sm border border-[#0d3b38]/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[8px] text-slate-400 uppercase">
                    <span>Today Weight</span>
                    <span className={weightDeltaMtdKg <= 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                      {weightDeltaMtdKg > 0 ? `+${weightDeltaMtdKg}` : weightDeltaMtdKg} kg MTD
                    </span>
                  </div>
                  <div className="my-1 flex items-baseline justify-between">
                    <span className="text-lg font-bold text-white tracking-tight">
                      {todayWeightKg > 0 ? todayWeightKg.toFixed(1) : "—"} <span className="text-[10px] font-normal text-teal-300">kg</span>
                    </span>
                    <span className="text-[8.5px] text-slate-400">
                      Goal: <strong className="text-teal-300">{targetWeightKg.toFixed(1)}kg</strong>
                    </span>
                  </div>
                  <div className="text-[8px] text-slate-500 flex items-center justify-between pt-1 border-t border-[#0d3b38]/60">
                    <span>OKOK / GFit</span>
                    <span className={weightToTargetKg <= 0 ? "text-emerald-400 font-semibold" : "text-teal-300"}>
                      {todayWeightKg <= 0 ? "Await reading" : weightToTargetKg <= 0 ? "Target Reached" : `${weightToTargetKg.toFixed(1)} kg to goal`}
                    </span>
                  </div>
                </div>

                {/* Right Box: Today's Calorie Expenditure (Samsung Health / Google Fit) */}
                <div className="bg-[#041d1b] p-2 rounded-sm border border-[#0d3b38]/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[8px] text-slate-400 uppercase">
                    <span className="flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5 text-amber-400" />
                      <span>Expenditure</span>
                    </span>
                    <span className="text-amber-300 font-bold">{expendedPct}%</span>
                  </div>
                  <div className="my-1 flex items-baseline justify-between">
                    <span className="text-lg font-bold text-amber-300 tracking-tight">
                      {todayCaloriesExpended.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">kcal</span>
                    </span>
                    <span className="text-[8.5px] text-slate-400">
                      Goal: <strong className="text-slate-300">{targetCaloriesExpended}</strong>
                    </span>
                  </div>
                  <div className="text-[8px] text-slate-500 flex items-center justify-between pt-1 border-t border-[#0d3b38]/60">
                    <span>Net Balance</span>
                    <span className={netCalorieBalance <= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                      {netCalorieBalance > 0 ? `+${netCalorieBalance}` : netCalorieBalance} kcal
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: MONTH VIEW (WEIGHT, CALORIE INTAKE & EXPENDITURE HISTORY)
        ══════════════════════════════════════════════════════════════════════ */}
        {viewMode === "month" && (
          <div className="space-y-2.5 font-mono">
            {/* CARD 1: MONTHLY WEIGHT HISTORY (OKOK / GOOGLE FIT) */}
            <div className="bg-[#020d0c] border border-[#0d3b38] p-2.5 rounded-sm">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-teal-300">
                  <Scale className="h-3 w-3 text-teal-400" />
                  <span>{monthName} Weight History (Day {currentDay}/{daysInMonth})</span>
                </span>
                <span className={weightDeltaMtdKg <= 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                  {weightDeltaMtdKg > 0 ? `+${weightDeltaMtdKg}` : weightDeltaMtdKg} KG MTD
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-1.5">
                <div className="text-lg font-bold text-white tracking-tight">
                  {todayWeightKg > 0 ? `${todayWeightKg.toFixed(1)} kg` : "—"} <span className="text-[10px] font-normal text-slate-400">(Start: {startMonthWeightKg > 0 ? `${startMonthWeightKg.toFixed(1)} kg` : "—"})</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-teal-300">Target: {targetWeightKg.toFixed(1)} kg</span>
                </div>
              </div>

              {/* Day-by-Day Weight History Bars across Month */}
              <div className="space-y-1">
                <div className="flex items-end gap-0.5 h-10 w-full bg-[#061e1c] p-1 border border-[#0d3b38]/60">
                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const entry = monthHistory.find((m) => m.day === dayNum);
                    const hasWeight = dayNum <= currentDay && entry?.weightKg !== null && entry?.weightKg !== undefined;
                    const w = hasWeight ? (entry!.weightKg as number) : 0;
                    const heightPct = hasWeight
                      ? Math.min(100, Math.max(20, Math.round(((w - minWeight) / weightRange) * 100)))
                      : 8;
                    const isToday = dayNum === currentDay;

                    return (
                      <div key={dayNum} className="flex-1 h-full flex items-end">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t-[1px] transition-all ${
                            !hasWeight
                              ? "bg-[#031211]"
                              : isToday
                              ? "bg-emerald-400 shadow-[0_0_5px_#34d399]"
                              : "bg-teal-500/80 hover:bg-teal-300"
                          }`}
                          title={hasWeight ? `${monthName} ${dayNum}: ${w.toFixed(1)} kg` : `${monthName} ${dayNum}: No reading`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[8px] text-slate-500 px-0.5">
                  <span>{monthName} 1</span>
                  <span className="text-emerald-400 font-semibold">Today: {todayWeightKg > 0 ? `${todayWeightKg.toFixed(1)} kg` : "—"}</span>
                  <span>{monthName} {daysInMonth}</span>
                </div>
              </div>
            </div>

            {/* CARD 2: MONTHLY CALORIE INTAKE & EXPENDITURE HISTORY */}
            <div className="bg-[#020d0c] border border-[#0d3b38] p-2.5 rounded-sm">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-teal-300">
                  <Flame className="h-3 w-3 text-teal-400" />
                  <span>{monthName} Calorie Intake &amp; Expenditure</span>
                </span>
                <span className={mtdNetBalance <= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  NET: {mtdNetBalance > 0 ? `+${mtdNetBalance.toLocaleString()}` : mtdNetBalance.toLocaleString()} KCAL
                </span>
              </div>

              {/* Dual Summary: MTD Intake vs MTD Expenditure */}
              <div className="grid grid-cols-2 gap-2 mb-1.5">
                <div className="bg-[#041d1b] px-2 py-1 rounded-sm border border-[#0d3b38]/70 flex items-baseline justify-between">
                  <div>
                    <span className="block text-[7.5px] text-slate-400 uppercase">MTD Intake</span>
                    <span className="text-sm font-bold text-teal-300">{mtdCaloriesIntake.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">kcal</span></span>
                  </div>
                  <span className="text-[8px] text-slate-400">Avg: <strong className="text-teal-300">{avgDailyCaloriesIntake}</strong>/d</span>
                </div>

                <div className="bg-[#041d1b] px-2 py-1 rounded-sm border border-[#0d3b38]/70 flex items-baseline justify-between">
                  <div>
                    <span className="block text-[7.5px] text-slate-400 uppercase">MTD Burned</span>
                    <span className="text-sm font-bold text-amber-300">{mtdCaloriesExpended.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">kcal</span></span>
                  </div>
                  <span className="text-[8px] text-slate-400">Avg: <strong className="text-amber-300">{avgDailyCaloriesExpended}</strong>/d</span>
                </div>
              </div>

              {/* Paired Day-by-Day Intake (Teal) & Expenditure (Amber) Bars across Month */}
              <div className="space-y-1">
                <div className="flex items-end gap-0.5 h-11 w-full bg-[#061e1c] p-1 border border-[#0d3b38]/60">
                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const entry = monthHistory.find((m) => m.day === dayNum);
                    const intake = dayNum <= currentDay ? entry?.caloriesIntake || 0 : 0;
                    const exp = dayNum <= currentDay ? entry?.caloriesExpended || 0 : 0;
                    const hasAny = intake > 0 || exp > 0;

                    const intakeHeight = intake > 0 ? Math.min(100, Math.max(15, Math.round((intake / 2600) * 100))) : 0;
                    const expHeight = exp > 0 ? Math.min(100, Math.max(15, Math.round((exp / 2600) * 100))) : 0;

                    return (
                      <div
                        key={dayNum}
                        className="flex-1 h-full flex items-end gap-[1px]"
                        title={
                          hasAny
                            ? `${monthName} ${dayNum}: ${intake.toLocaleString()} kcal Intake | ${exp.toLocaleString()} kcal Burned`
                            : `${monthName} ${dayNum}: No data`
                        }
                      >
                        {hasAny ? (
                          <>
                            <div
                              style={{ height: `${intakeHeight}%` }}
                              className="w-1/2 bg-teal-400 rounded-t-[1px]"
                            />
                            <div
                              style={{ height: `${expHeight}%` }}
                              className="w-1/2 bg-amber-400 rounded-t-[1px]"
                            />
                          </>
                        ) : (
                          <div className="w-full h-[8%] bg-[#031211]" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center text-[8px] text-slate-500 px-0.5">
                  <span>{monthName} 1</span>
                  <span className="flex items-center gap-2">
                    <span className="text-teal-300">■ Intake</span>
                    <span className="text-amber-300">■ Expenditure</span>
                  </span>
                  <span>{monthName} {daysInMonth}</span>
                </div>
              </div>
            </div>

            {/* CARD 3: DAILY WEIGHT, INTAKE & EXPENDITURE LOG TABLE */}
            <div className="bg-[#020d0c] border border-[#0d3b38] p-2 rounded-sm">
              <div className="flex items-center justify-between text-[8.5px] uppercase tracking-wider text-slate-400 font-semibold mb-1 px-1">
                <span className="w-12">Date</span>
                <span className="w-14 text-right">Weight</span>
                <span className="w-16 text-right text-teal-300">Intake</span>
                <span className="w-16 text-right text-amber-300">Burned</span>
                <span className="w-14 text-right">Net</span>
              </div>

              <div className="divide-y divide-[#0d3b38]/60 text-[9.5px] max-h-28 overflow-y-auto">
                {logHistoryDays
                  .slice(-7)
                  .reverse()
                  .map((d) => {
                    const intake = d.caloriesIntake || 0;
                    const exp = d.caloriesExpended || 0;
                    const netDay = intake - exp;
                    return (
                      <div key={d.isoDate} className="flex items-center justify-between py-0.5 px-1 hover:bg-[#041d1b] transition-colors">
                        <span className="text-slate-300 w-12 font-medium">
                          {d.day === currentDay ? `${d.date}*` : d.date}
                        </span>
                        <span className="w-14 text-right font-bold text-white">
                          {d.weightKg !== null ? `${d.weightKg.toFixed(1)}kg` : "—"}
                        </span>
                        <span className="w-16 text-right text-teal-300 font-semibold">
                          {intake.toLocaleString()} in
                        </span>
                        <span className="w-16 text-right text-amber-300 font-semibold">
                          {exp.toLocaleString()} out
                        </span>
                        <span className={`w-14 text-right font-bold ${netDay <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {netDay > 0 ? `+${netDay}` : netDay}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BAY FOOTER TELEMETRY ── */}
      <div className="pt-2 mt-2 border-t border-[#0d3b38] flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">
            {viewMode === "day" ? "Biometric Sync" : "Monthly Weight Trend"}
          </span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            {viewMode === "day"
              ? `${todayWeightKg > 0 ? `${todayWeightKg.toFixed(1)} kg` : "—"} • ${todayCaloriesExpended.toLocaleString()} kcal Burn`
              : `${startMonthWeightKg.toFixed(1)} kg → ${todayWeightKg.toFixed(1)} kg (${weightDeltaMtdKg > 0 ? `+${weightDeltaMtdKg}` : weightDeltaMtdKg} kg)`}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">
            {viewMode === "day" ? "Protein Completion" : "MTD Intake vs Burn"}
          </span>
          <span className="text-teal-300 font-semibold">
            {viewMode === "day"
              ? `${proteinPct}% of Target (${today.protein}g / ${proteinGoal}g)`
              : `${mtdCaloriesIntake.toLocaleString()} in / ${mtdCaloriesExpended.toLocaleString()} out`}
          </span>
        </div>
      </div>

      {/* Google Fit OAuth & Biometric Settings Modal */}
      <GoogleFitModal
        isOpen={isGfitModalOpen}
        onClose={() => setIsGfitModalOpen(false)}
        currentWeightKg={todayWeightKg}
        targetWeightKg={targetWeightKg}
        currentCaloriesExpended={todayCaloriesExpended}
        targetCaloriesExpended={targetCaloriesExpended}
        googleFitConnected={googleFitConnected}
        onSaved={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}
