"use client";

import React, { useState, useEffect } from "react";
import {
  Flame,
  Droplets,
  Scale,
  Sparkles,
  Wallet,
  Sun,
  Terminal,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { OpsDashboardPayload, SprintTask } from "@/lib/types";
import { TemporalDashboardModel } from "@/lib/decisions/types";
import { formatLKR, formatUSD } from "@/lib/utils";

interface DailyHorizonSectionProps {
  payload: OpsDashboardPayload;
  daily: TemporalDashboardModel["daily"];
  currency: "LKR" | "USD";
  onRefreshZone: (zoneKey: "zone1" | "zone2" | "zone3" | "zone4" | "zone5" | "zone6") => void;
  zoneRefreshing: Record<string, boolean>;
}

const TASKS_STORAGE_KEY = "lifeops_sprint_tasks";

export function DailyHorizonSection({
  payload,
  daily,
  currency,
  onRefreshZone,
  zoneRefreshing,
}: DailyHorizonSectionProps) {
  const { spendIncome, crossDomain, sprintTasks } = payload;
  const LKR_PER_USD = 310;

  const formatMoney = (amtLkr: number) =>
    currency === "LKR" ? formatLKR(amtLkr) : formatUSD(amtLkr / LKR_PER_USD);

  // ── SPRINT TASKS STATE SYNCED WITH localStorage ──
  const [tasks, setTasks] = useState<SprintTask[]>(sprintTasks || []);
  const [taskFilter, setTaskFilter] = useState<"all" | "active" | "done">("all");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDomain, setNewTaskDomain] = useState<"FIN" | "BIO" | "GRID" | "OPS">("OPS");
  const [newTaskDeadline, setNewTaskDeadline] = useState("Today");

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem(TASKS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTasks(parsed);
          }
        }
      } catch {
        // ignore
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveTasks = (next: SprintTask[]) => {
    setTasks(next);
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleCycleTask = (id: string) => {
    const next = tasks.map((t) => {
      if (t.id !== id) return t;
      const nextStatus: SprintTask["status"] =
        t.status === "queued" ? "active" : t.status === "active" ? "complete" : "queued";
      return { ...t, status: nextStatus };
    });
    saveTasks(next);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: SprintTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      domain: newTaskDomain,
      status: "active",
      deadline: newTaskDeadline || "Today",
    };
    saveTasks([newTask, ...tasks]);
    setNewTaskTitle("");
    setIsAddingTask(false);
  };

  const handleDeleteTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveTasks(tasks.filter((t) => t.id !== id));
  };

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === "active") return t.status === "active";
    if (taskFilter === "done") return t.status === "complete";
    return true;
  });

  // ── METABOLIC CALCULATIONS ──
  const calPct = daily.calorieLimit > 0 ? Math.round((daily.caloriesIntake / daily.calorieLimit) * 100) : 0;
  const burnPct =
    daily.targetCaloriesExpended > 0
      ? Math.round((daily.caloriesExpended / daily.targetCaloriesExpended) * 100)
      : 0;
  const proteinPct = daily.proteinGoal > 0 ? Math.min(100, Math.round((daily.proteinGrams / daily.proteinGoal) * 100)) : 0;
  const isSugarDanger = daily.sugarGrams > daily.sugarLimit;
  const sugarPct = daily.sugarLimit > 0 ? Math.min(100, Math.round((daily.sugarGrams / daily.sugarLimit) * 100)) : 0;

  // ── BURN PACE STYLING ──
  const burnBadgeStyle =
    daily.dailyBurnStatus === "OVER_PACE"
      ? "bg-rose-950/90 text-rose-300 border-rose-700/80"
      : daily.dailyBurnStatus === "CAUTION"
      ? "bg-amber-950/80 text-amber-300 border-amber-700/70"
      : "bg-emerald-950/80 text-emerald-300 border-emerald-700/70";

  return (
    <section className="space-y-2">
      {/* ── TIER 2 BANNER ── */}
      <div className="flex items-center justify-between bg-[#120e05] border border-amber-900/60 border-l-2 border-l-amber-400 rounded-sm px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-amber-400 rounded-none inline-block" />
          <h2 className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-300">
            TIER 2 // DAILY OPERATIONS &amp; PACING (24-HOUR SCORECARD)
          </h2>
        </div>
        <span className="text-[9px] font-mono text-slate-400 hidden sm:inline">
          QUOTAS · BURN PACE · METABOLIC GUARDRAILS · SPRINT QUEUE
        </span>
      </div>

      {/* ── 3-COLUMN DAILY MATRIX ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        {/* PANEL 1: TODAY'S METABOLIC & MACRO SCORECARD (4 COLS) */}
        <div className="lg:col-span-4 bg-[#041615]/90 border border-[#0d3b38] border-t border-t-white/10 rounded-md p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#0d3b38]">
              <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-teal-300">
                <Flame className="h-3.5 w-3.5 text-teal-400" />
                Today&apos;s Metabolic &amp; Macro Scorecard
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

            {/* Intake vs Burn & Net Balance */}
            <div className="grid grid-cols-3 gap-1.5 mb-2 font-mono">
              <div className="bg-[#020d0c] border border-[#0d3b38] p-2 rounded-sm">
                <span className="block text-[8px] text-slate-500 uppercase">Intake</span>
                <span className="text-sm font-bold text-teal-300">
                  {daily.caloriesIntake.toLocaleString()}
                </span>
                <span className="block text-[8px] text-slate-400">
                  / {daily.calorieLimit.toLocaleString()} ({calPct}%)
                </span>
              </div>

              <div className="bg-[#020d0c] border border-[#0d3b38] p-2 rounded-sm">
                <span className="block text-[8px] text-slate-500 uppercase">GFit Burn</span>
                <span className="text-sm font-bold text-amber-300">
                  {daily.caloriesExpended.toLocaleString()}
                </span>
                <span className="block text-[8px] text-slate-400">
                  / {daily.targetCaloriesExpended.toLocaleString()} ({burnPct}%)
                </span>
              </div>

              <div className="bg-[#020d0c] border border-[#0d3b38] p-2 rounded-sm">
                <span className="block text-[8px] text-slate-500 uppercase">Net Balance</span>
                <span
                  className={`text-sm font-bold ${
                    daily.netCalorieBalance <= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {daily.netCalorieBalance > 0
                    ? `+${daily.netCalorieBalance}`
                    : daily.netCalorieBalance}
                </span>
                <span className="block text-[8px] text-slate-400">kcal net</span>
              </div>
            </div>

            {/* Macros & Sugar Guardrail */}
            <div className="grid grid-cols-4 gap-1.5 mb-2 font-mono text-center">
              <div className="bg-[#020d0c] border border-[#0d3b38] p-1.5 rounded-sm">
                <span className="block text-[8px] text-slate-500 uppercase">Protein</span>
                <span className="text-xs font-bold text-teal-300">{daily.proteinGrams}g</span>
                <span className="block text-[8px] text-slate-400">/{daily.proteinGoal}g ({proteinPct}%)</span>
              </div>

              <div className="bg-[#020d0c] border border-[#0d3b38] p-1.5 rounded-sm">
                <span className="block text-[8px] text-slate-500 uppercase">Carbs</span>
                <span className="text-xs font-bold text-amber-300">{daily.carbsGrams}g</span>
                <span className="block text-[8px] text-slate-500">Macro</span>
              </div>

              <div className="bg-[#020d0c] border border-[#0d3b38] p-1.5 rounded-sm">
                <span className="block text-[8px] text-slate-500 uppercase">Fat</span>
                <span className="text-xs font-bold text-slate-200">{daily.fatGrams}g</span>
                <span className="block text-[8px] text-slate-500">Macro</span>
              </div>

              <div
                className={`p-1.5 rounded-sm border ${
                  isSugarDanger
                    ? "bg-rose-950/70 border-rose-600/80 shadow-[0_0_8px_rgba(244,63,94,0.2)]"
                    : "bg-[#020d0c] border-[#0d3b38]"
                }`}
              >
                <span className="flex items-center justify-center gap-0.5 text-[8px] text-slate-400 uppercase">
                  {isSugarDanger && <ShieldAlert className="h-2.5 w-2.5 text-rose-400" />}
                  Sugar
                </span>
                <span
                  className={`text-xs font-bold ${
                    isSugarDanger ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {daily.sugarGrams}g
                </span>
                <span className="block text-[8px] text-slate-400">
                  /&lt;{daily.sugarLimit}g ({sugarPct}%)
                </span>
              </div>
            </div>

            {/* Water, Weight & Streak */}
            <div className="grid grid-cols-3 gap-1.5 mb-2 font-mono">
              <div className="bg-[#020d0c] border border-[#0d3b38] p-2 rounded-sm flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <div>
                  <span className="block text-[8px] text-slate-500 uppercase">Water</span>
                  <span className="text-xs font-bold text-cyan-300">
                    {daily.waterGlasses}/{daily.waterGoal}
                  </span>
                </div>
              </div>

              <div className="bg-[#020d0c] border border-[#0d3b38] p-2 rounded-sm flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                <div>
                  <span className="block text-[8px] text-slate-500 uppercase">Weight</span>
                  <span className="text-xs font-bold text-white">
                    {daily.todayWeightKg > 0 ? `${daily.todayWeightKg.toFixed(1)}kg` : "—"}
                  </span>
                  <span className="block text-[7.5px] text-slate-500">
                    Goal {daily.targetWeightKg}kg
                  </span>
                </div>
              </div>

              <div className="bg-[#020d0c] border border-[#0d3b38] p-2 rounded-sm flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <div>
                  <span className="block text-[8px] text-slate-500 uppercase">Streak</span>
                  <span className="text-xs font-bold text-amber-300">{daily.streakDays}d</span>
                </div>
              </div>
            </div>

            {/* Next Meal Macro Prescription Callout */}
            <div className="bg-teal-950/50 border border-teal-600/60 border-l-2 border-l-teal-400 rounded-sm p-2 font-mono">
              <div className="flex items-center justify-between text-[8px] uppercase tracking-wider text-teal-300 font-bold mb-0.5">
                <span>Next Meal Macro Prescription</span>
                <span className="text-emerald-400">
                  {daily.remainingCaloriesToday.toLocaleString()} kcal left
                </span>
              </div>
              <p className="text-[10px] font-semibold text-white leading-snug">
                {daily.nextMealPrescription}
              </p>
              <div className="flex items-center justify-between text-[8px] text-slate-300 mt-1 pt-1 border-t border-teal-800/60">
                <span>
                  Protein needed:{" "}
                  <strong className="text-teal-300">{daily.remainingProteinGrams}g</strong>
                </span>
                <span>
                  Sugar cap left:{" "}
                  <strong
                    className={
                      daily.remainingSugarGrams === 0 && isSugarDanger
                        ? "text-rose-400"
                        : "text-emerald-300"
                    }
                  >
                    {daily.remainingSugarGrams}g
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 mt-2 border-t border-[#0d3b38] flex items-center justify-between font-mono text-[9px] text-slate-400">
            <span>
              Sugar Guardrail:{" "}
              <strong className={isSugarDanger ? "text-rose-400" : "text-emerald-400"}>
                {isSugarDanger ? "BREACHED" : "WITHIN LIMIT"}
              </strong>
            </span>
            <span>
              Target Weight: <strong className="text-teal-300">{daily.targetWeightKg} kg</strong>
            </span>
          </div>
        </div>

        {/* PANEL 2: TODAY'S SPEND & SAFE BURN RATE + 7D CHART (4 COLS) */}
        <div className="lg:col-span-4 bg-[#140b04]/90 border border-[#381a07] border-t border-t-white/10 rounded-md p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#381a07]">
              <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                <Wallet className="h-3.5 w-3.5 text-amber-400" />
                Daily Spend &amp; Cross-Domain (7D)
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-1.5 py-0.5 rounded-sm font-mono text-[8px] font-bold border ${burnBadgeStyle}`}
                >
                  {daily.dailyBurnStatus}
                </span>
                <button
                  onClick={() => onRefreshZone("zone2")}
                  disabled={!!zoneRefreshing.zone2}
                  className="p-1 rounded-sm bg-[#221004] hover:bg-[#341805] border border-[#381a07] text-amber-400 disabled:opacity-50"
                  title="Refresh Zone 2 Cashflow"
                >
                  <RefreshCw className={`h-2.5 w-2.5 ${zoneRefreshing.zone2 ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Burn Rate Strip */}
            <div className="grid grid-cols-3 gap-1.5 mb-2 font-mono">
              <div className="bg-[#0b0602] border border-[#381a07] p-2 rounded-sm">
                <span className="block text-[8px] text-slate-500 uppercase">Today&apos;s Spend</span>
                <span className="text-xs font-bold text-amber-300">
                  {formatMoney(daily.dailySpendLkr)}
                </span>
              </div>
              <div className="bg-[#0b0602] border border-[#381a07] p-2 rounded-sm">
                <span className="block text-[8px] text-slate-500 uppercase">Safe Burn Cap</span>
                <span className="text-xs font-bold text-emerald-400">
                  {formatMoney(daily.dailySafeBurnRateLkr)}
                </span>
              </div>
              <div className="bg-[#0b0602] border border-[#381a07] p-2 rounded-sm">
                <span className="block text-[8px] text-slate-500 uppercase">Budget Util</span>
                <span className="text-xs font-bold text-slate-200">
                  {spendIncome.budgetUtilizationPct}%
                </span>
              </div>
            </div>

            {/* Calendar Pace Variance Strip */}
            <div
              className={`flex items-center justify-between px-2 py-1.5 mb-2 rounded-sm border font-mono text-[9px] ${
                daily.calendarPaceVariancePct > 10
                  ? "bg-rose-950/60 border-rose-700/70 text-rose-200"
                  : daily.calendarPaceVariancePct > 0
                  ? "bg-amber-950/50 border-amber-700/60 text-amber-200"
                  : "bg-emerald-950/50 border-emerald-800/60 text-emerald-200"
              }`}
            >
              <span className="truncate">
                Budget Used <strong>{spendIncome.budgetUtilizationPct}%</strong> vs Month Elapsed{" "}
                <strong>{daily.monthElapsedPct}%</strong>
              </span>
              <span
                className={`font-bold shrink-0 ml-1 ${
                  daily.calendarPaceVariancePct > 10
                    ? "text-rose-300"
                    : daily.calendarPaceVariancePct > 0
                    ? "text-amber-300"
                    : "text-emerald-300"
                }`}
              >
                {daily.calendarPaceVariancePct > 0 ? "+" : ""}
                {daily.calendarPaceVariancePct}% pace variance
              </span>
            </div>

            {/* 7D Lifestyle/Dining Spend vs Caloric & Sugar Intake */}
            <div className="bg-[#0b0602] border border-[#381a07] rounded-sm p-2">
              <div className="flex items-center justify-between text-[9px] font-mono mb-1">
                <span className="text-slate-300 uppercase font-semibold">
                  7D Dining Spend vs. Caloric &amp; Sugar Intake
                </span>
                <span className="text-rose-400 font-bold text-[8px]">CORRELATION</span>
              </div>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={crossDomain.foodSpendVsCalorieCorrelation}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#1f1207" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      tick={{ fontSize: 9, fontFamily: "monospace" }}
                      tickFormatter={(d: string) => d.slice(5)}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#64748b"
                      tick={{ fontSize: 9, fontFamily: "monospace" }}
                      width={30}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#64748b"
                      tick={{ fontSize: 9, fontFamily: "monospace" }}
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#06080b",
                        borderColor: "#381a07",
                        borderRadius: "2px",
                        fontSize: "10px",
                        fontFamily: "monospace",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "9px", fontFamily: "monospace" }} />
                    <Bar
                      yAxisId="right"
                      dataKey="diningSpend"
                      fill="#3b82f6"
                      opacity={0.65}
                      barSize={14}
                      name="Dining LKR"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="calories"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      dot={false}
                      name="Calories"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="sugar"
                      stroke="#f43f5e"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      dot={false}
                      name="Sugar (g)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 3: TODAY'S SOLAR YIELD & DAILY CRITICAL PATH TASKS (4 COLS) */}
        <div className="lg:col-span-4 bg-[#080c20]/95 border border-[#1a2550] border-t border-t-white/10 rounded-md p-3 flex flex-col justify-between gap-2.5">
          {/* Today's Solar Yield Sub-card */}
          <div className="bg-[#0d0702] border border-[#3a2408] rounded-sm p-2.5 font-mono">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                <Sun className="h-3 w-3 text-amber-400" />
                Today&apos;s Solar Yield
              </span>
              <span className="text-emerald-400 font-bold">
                Est. +{formatLKR(daily.solarDailyEstRevenueLkr)}
              </span>
            </div>

            <div className="flex items-baseline justify-between mb-1">
              <span className="text-lg font-bold text-amber-300">
                {daily.solarDailyKwh.toFixed(1)}{" "}
                <span className="text-[10px] font-normal text-slate-400">
                  / {daily.solarDailyTargetKwh.toFixed(1)} kWh
                </span>
              </span>
              <span className="text-xs font-bold text-emerald-400">{daily.solarDailyPct}%</span>
            </div>

            <div className="h-1.5 w-full bg-[#201405] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.min(100, daily.solarDailyPct)}%` }}
              />
            </div>
          </div>

          {/* Daily Critical Path Sprint Tasks */}
          <div className="flex-1 flex flex-col font-mono">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
              <span className="flex items-center gap-1 text-indigo-300 font-bold">
                <Terminal className="h-3 w-3 text-indigo-400" /> Daily Critical Path Tasks
              </span>
              <div className="flex items-center gap-1.5 text-[8px]">
                <button
                  onClick={() => setTaskFilter("all")}
                  className={taskFilter === "all" ? "text-indigo-300 font-bold" : "text-slate-500"}
                >
                  ALL ({tasks.length})
                </button>
                <span>•</span>
                <button
                  onClick={() => setTaskFilter("active")}
                  className={taskFilter === "active" ? "text-cyan-400 font-bold" : "text-slate-500"}
                >
                  ACT ({tasks.filter((t) => t.status === "active").length})
                </button>
                <span>•</span>
                <button
                  onClick={() => setIsAddingTask((v) => !v)}
                  className="px-1.5 py-0.5 rounded-sm bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 font-bold flex items-center gap-0.5"
                >
                  <Plus className="h-2.5 w-2.5" /> ADD
                </button>
              </div>
            </div>

            {isAddingTask && (
              <form
                onSubmit={handleAddTask}
                className="bg-[#050818] border border-[#232f63] p-1.5 rounded-sm space-y-1 text-[9px] mb-1.5"
              >
                <input
                  type="text"
                  placeholder="Task title..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-[#080d26] border border-[#1a2550] px-2 py-1 rounded-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                  autoFocus
                />
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {(["OPS", "FIN", "BIO", "GRID"] as const).map((dom) => (
                      <button
                        type="button"
                        key={dom}
                        onClick={() => setNewTaskDomain(dom)}
                        className={`px-1.5 py-0.5 rounded-sm text-[7.5px] font-bold ${
                          newTaskDomain === dom
                            ? "bg-indigo-600 text-white"
                            : "bg-[#090f2b] text-slate-400 border border-[#1a2550]"
                        }`}
                      >
                        {dom}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newTaskDeadline}
                      onChange={(e) => setNewTaskDeadline(e.target.value)}
                      className="w-16 bg-[#080d26] border border-[#1a2550] px-1 py-0.5 rounded-sm text-[8px] text-slate-300 text-center"
                    />
                    <button
                      type="submit"
                      className="px-2 py-0.5 rounded-sm bg-emerald-600 text-white font-bold text-[8px]"
                    >
                      SAVE
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="space-y-1 max-h-[155px] overflow-y-auto pr-0.5">
              {filteredTasks.length === 0 ? (
                <div className="p-3 text-center text-[9px] text-slate-600 border border-dashed border-[#1a2550] rounded-sm">
                  No sprint tasks matching filter.
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const isDone = task.status === "complete";
                  const isActive = task.status === "active";
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleCycleTask(task.id)}
                      className={`flex items-center justify-between p-1.5 rounded-sm border cursor-pointer select-none transition-all ${
                        isDone
                          ? "bg-[#040612] border-[#1a2550]/60 text-slate-500 opacity-60"
                          : isActive
                          ? "bg-[#0b102b] border-[#293875] text-slate-200"
                          : "bg-[#06091c] border-[#1a2550] text-slate-400 hover:border-[#293875]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isDone ? (
                          <CheckCircle2 className="h-3 w-3 text-indigo-400 shrink-0" />
                        ) : isActive ? (
                          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                        ) : (
                          <Circle className="h-3 w-3 text-slate-600 shrink-0" />
                        )}
                        <span className={`text-[10px] truncate ${isDone ? "line-through text-slate-500" : ""}`}>
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        <span className="text-[7.5px] px-1 rounded-sm bg-[#11193d] text-indigo-300 font-semibold">
                          {task.domain}
                        </span>
                        <span className="text-[8px] text-slate-500">{task.deadline}</span>
                        <button
                          onClick={(e) => handleDeleteTask(task.id, e)}
                          className="text-slate-600 hover:text-rose-400 px-0.5"
                          title="Delete task"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
