"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  Terminal,
  Server,
  Zap,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  AlertTriangle
} from "lucide-react";
import {
  BinanceBotData,
  SprintTask,
  HealthData,
  GridFleetData,
  InvestmentData,
  SpendIncomeData,
  FinancialData
} from "@/lib/types";
import { formatUSD, formatLKR } from "@/lib/utils";

interface OpsBarProps {
  bot: BinanceBotData;
  tasks: SprintTask[];
  health?: HealthData;
  gridFleet?: GridFleetData;
  investments?: InvestmentData;
  spendIncome?: SpendIncomeData;
  finance?: FinancialData;
  onGlobalSync?: () => void;
  refreshing?: boolean;
}

interface TacticalAlert {
  id: string;
  level: "critical" | "warning" | "info" | "success";
  domain: "TREASURY" | "GRID" | "SPEND" | "BIO" | "BOT";
  message: string;
  actionHint?: string;
}

export function OpsBar({
  bot,
  tasks: initialTasks,
  health,
  gridFleet,
  investments,
  spendIncome,
  finance,
  onGlobalSync,
  refreshing = false,
}: OpsBarProps) {
  const [tasks, setTasks] = useState<SprintTask[]>(initialTasks);
  const [taskFilter, setTaskFilter] = useState<"all" | "active" | "done">("all");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDomain, setNewTaskDomain] = useState<"FIN" | "BIO" | "GRID" | "OPS">("OPS");
  const [newTaskDeadline, setNewTaskDeadline] = useState("Today");

  // Operational Control Switches state
  const [isEvOverridden, setIsEvOverridden] = useState(false);
  const [isBotPaused, setIsBotPaused] = useState(false);
  const [activeAlertIndex, setActiveAlertIndex] = useState(0);

  // Load persisted tasks from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lifeops_sprint_tasks");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTasks(parsed);
        }
      }
    } catch {
      // fallback
    }
  }, []);

  // Sync tasks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("lifeops_sprint_tasks", JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  // Cycle task status: queued -> active -> complete -> queued
  const handleCycleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const nextStatus = t.status === "queued" ? "active" : t.status === "active" ? "complete" : "queued";
        return { ...t, status: nextStatus };
      })
    );
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
    setTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle("");
    setIsAddingTask(false);
  };

  const handleDeleteTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // ── DYNAMIC TACTICAL ALERTS COMPILATION ──
  const alerts: TacticalAlert[] = [];

  // 1. Treasury / FD Maturity alerts from investments
  if (investments?.maturityRadar) {
    const urgentMaturities = investments.maturityRadar.filter((m) => m.daysRemaining <= 30);
    urgentMaturities.slice(0, 2).forEach((m) => {
      alerts.push({
        id: `mat-${m.id}`,
        level: m.daysRemaining <= 7 ? "critical" : "warning",
        domain: "TREASURY",
        message: `${m.name} maturing in ${m.daysRemaining}d (${m.currency === "USD" ? formatUSD(m.amount) : formatLKR(m.amount)})`,
        actionHint: "Rollover review",
      });
    });
  }

  // 2. Solar grid pacing alert
  if (gridFleet?.solar) {
    const dailyTarget = gridFleet.solar.dailyTargetKwh || 15.0;
    if (gridFleet.solar.dailyKwh < dailyTarget * 0.8) {
      alerts.push({
        id: "alert-solar",
        level: "warning",
        domain: "GRID",
        message: `Solar yield ${gridFleet.solar.dailyKwh.toFixed(1)} kWh/d below ${dailyTarget.toFixed(0)} kWh target`,
        actionHint: "Check irradiance",
      });
    } else {
      alerts.push({
        id: "alert-solar-good",
        level: "success",
        domain: "GRID",
        message: `Solar generation nominal @ ${gridFleet.solar.dailyKwh.toFixed(1)} kWh today`,
        actionHint: "Net-plus exporting",
      });
    }
  }

  // 3. Fasting / Metabolic alert
  if (health?.today) {
    if (health.today.isFastingActive && health.today.fastingMinutes >= 960) {
      alerts.push({
        id: "alert-fasting-done",
        level: "success",
        domain: "BIO",
        message: `16h Fasting window reached (${(health.today.fastingMinutes / 60).toFixed(1)}h elapsed)`,
        actionHint: "Autophagy active",
      });
    } else if (health.today.sugar > health.today.sugarLimit) {
      alerts.push({
        id: "alert-sugar-high",
        level: "critical",
        domain: "BIO",
        message: `Daily sugar intake (${health.today.sugar}g) exceeds ${health.today.sugarLimit}g safety limit`,
        actionHint: "Insulin mitigation",
      });
    }
  }

  // 4. Budget burn alert
  if (spendIncome?.budgetUtilizationPct) {
    if (spendIncome.budgetUtilizationPct > 85) {
      alerts.push({
        id: "alert-budget",
        level: "warning",
        domain: "SPEND",
        message: `Baseline budget utilization at ${spendIncome.budgetUtilizationPct}%`,
        actionHint: "Throttle discretionary",
      });
    }
  }

  // Fallback nominal alert if empty
  if (alerts.length === 0) {
    alerts.push({
      id: "alert-nominal",
      level: "info",
      domain: "BOT",
      message: "All operational daemons synchronized. Zero incident warnings.",
      actionHint: "Nominal pace",
    });
  }

  // Safe active alert
  const currentAlert = alerts[activeAlertIndex % alerts.length];

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === "active") return t.status === "active";
    if (taskFilter === "done") return t.status === "complete";
    return true;
  });

  return (
    <div className="bg-[#080c20]/95 border border-[#1a2550] border-t border-t-white/10 rounded-md p-3.5 font-sans">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 mb-2.5 border-b border-[#1a2550] gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
          </span>
          <h2 className="text-[11px] font-mono font-bold tracking-wider uppercase text-indigo-400">
            ZONE 6: MISSION CONTROL &amp; OPS BAY
          </h2>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 uppercase">
            MASTER CONTROLLER
          </span>
        </div>

        {/* ── CROSS-BAY TACTICAL ALERTS TICKER ── */}
        <div className="flex items-center gap-2 bg-[#050818] border border-[#1f2c60] py-1 px-2 rounded-sm text-[9px] font-mono max-w-full sm:max-w-xl">
          <span
            className={`px-1 py-0.2 rounded text-[7.5px] font-bold uppercase shrink-0 ${
              currentAlert.level === "critical"
                ? "bg-rose-950 text-rose-300 border border-rose-800"
                : currentAlert.level === "warning"
                ? "bg-amber-950 text-amber-300 border border-amber-800"
                : currentAlert.level === "success"
                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                : "bg-indigo-950 text-indigo-300 border border-indigo-800"
            }`}
          >
            {currentAlert.domain}
          </span>
          <span className="text-slate-200 truncate">{currentAlert.message}</span>
          {currentAlert.actionHint && (
            <span className="text-indigo-400 hidden md:inline shrink-0 font-semibold">
              [{currentAlert.actionHint}]
            </span>
          )}

          <div className="flex items-center gap-1 shrink-0 ml-auto text-slate-500">
            <span className="text-[8px]">
              {activeAlertIndex + 1}/{alerts.length}
            </span>
            <button
              onClick={() => setActiveAlertIndex((prev) => (prev > 0 ? prev - 1 : alerts.length - 1))}
              className="p-0.5 rounded hover:bg-[#131a3d] text-slate-400 hover:text-white"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              onClick={() => setActiveAlertIndex((prev) => (prev + 1) % alerts.length)}
              className="p-0.5 rounded hover:bg-[#131a3d] text-slate-400 hover:text-white"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2-COLUMN COMMAND BRIDGE MATRIX ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* LEFT COLUMN (COL 1-5): SERVICES PULSE MATRIX & MANUAL OVERRIDE SWITCHES */}
        <div className="lg:col-span-5 space-y-2.5">
          {/* 1. Services Pulse Matrix */}
          <div className="bg-[#050818] border border-[#1a2550] p-2 rounded-sm font-mono text-[9px]">
            <div className="flex items-center justify-between text-slate-500 uppercase tracking-wider mb-1.5 px-0.5 font-semibold text-[8px]">
              <span className="flex items-center gap-1.5 text-indigo-300">
                <Server className="h-3 w-3 text-indigo-400" /> Unified Services Pulse Matrix
              </span>
              <span className="text-emerald-400 font-bold">6/6 Systems Online</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-[#090f2b] p-1.5 rounded border border-[#1a2550]/70">
                <span className="block text-[7.5px] text-slate-500 uppercase">FusionSolar</span>
                <span className="font-bold text-amber-400">● Synced</span>
              </div>
              <div className="bg-[#090f2b] p-1.5 rounded border border-[#1a2550]/70">
                <span className="block text-[7.5px] text-slate-500 uppercase">AWS EC2 Bot</span>
                <span className={`font-bold ${isBotPaused ? "text-amber-400" : "text-emerald-400"}`}>
                  {isBotPaused ? "● Paused" : "● Active"}
                </span>
              </div>
              <div className="bg-[#090f2b] p-1.5 rounded border border-[#1a2550]/70">
                <span className="block text-[7.5px] text-slate-500 uppercase">CSE Market</span>
                <span className="font-bold text-cyan-400">● Synced</span>
              </div>
              <div className="bg-[#090f2b] p-1.5 rounded border border-[#1a2550]/70">
                <span className="block text-[7.5px] text-slate-500 uppercase">Investor DB</span>
                <span className="font-bold text-emerald-400">● Connected</span>
              </div>
              <div className="bg-[#090f2b] p-1.5 rounded border border-[#1a2550]/70">
                <span className="block text-[7.5px] text-slate-500 uppercase">Calorie CC</span>
                <span className="font-bold text-teal-400">● 16:8 Live</span>
              </div>
              <div className="bg-[#090f2b] p-1.5 rounded border border-[#1a2550]/70">
                <span className="block text-[7.5px] text-slate-500 uppercase">BudgetFlow</span>
                <span className="font-bold text-indigo-300">● Tracked</span>
              </div>
            </div>
          </div>

          {/* 2. Tactical Manual Override Switches */}
          <div className="bg-[#050818] border border-[#1a2550] p-2 rounded-sm font-mono">
            <div className="flex items-center justify-between text-[8px] text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">
              <span>Tactical Manual Overrides</span>
              <span className="text-indigo-400">Hardware &amp; API Relays</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[8.5px]">
              {/* Action 1: Force Refresh All Data */}
              <button
                onClick={onGlobalSync}
                disabled={refreshing}
                className="flex items-center justify-center gap-1.5 py-2 px-1 rounded bg-[#0d1433] hover:bg-[#162152] border border-[#24336e] text-indigo-300 font-bold transition-colors disabled:opacity-50"
                title="Poll all daemons (FusionSolar, Stocks, Wealth, Health)"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
                <span>{refreshing ? "SYNCING..." : "SYNC ALL"}</span>
              </button>

              {/* Action 2: EV Pod Night Charge Override */}
              <button
                onClick={() => setIsEvOverridden(!isEvOverridden)}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded border font-bold transition-all ${
                  isEvOverridden
                    ? "bg-amber-950/80 border-amber-600/70 text-amber-300 shadow-[0_0_8px_#f59e0b]"
                    : "bg-[#0d1433] hover:bg-[#162152] border-[#24336e] text-slate-300"
                }`}
                title="Toggle instant EV pod charge vs 23:00 off-peak schedule"
              >
                <Zap className={`h-3 w-3 ${isEvOverridden ? "text-amber-400 animate-pulse" : "text-amber-500"}`} />
                <span>{isEvOverridden ? "CHARGING ON" : "EV OVERRIDE"}</span>
              </button>

              {/* Action 3: Trading Bot Circuit Breaker */}
              <button
                onClick={() => setIsBotPaused(!isBotPaused)}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded border font-bold transition-all ${
                  isBotPaused
                    ? "bg-rose-950/80 border-rose-600/80 text-rose-300 shadow-[0_0_8px_#f43f5e]"
                    : "bg-[#0d1433] hover:bg-[#162152] border-[#24336e] text-slate-300"
                }`}
                title="Freeze algorithmic bot trades during high market volatility"
              >
                {isBotPaused ? (
                  <ShieldAlert className="h-3 w-3 text-rose-400" />
                ) : (
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                )}
                <span>{isBotPaused ? "BOT FROZEN" : "BOT KILL-SW"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (COL 6-12): DAILY CRITICAL PATH SPRINT MANAGER */}
        <div className="lg:col-span-7 space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold px-0.5">
            <span className="flex items-center gap-1 text-indigo-300 font-bold">
              <Terminal className="h-3 w-3 text-indigo-400" /> Daily Critical Path Tasks
            </span>

            <div className="flex items-center gap-1.5 text-[8px]">
              <button
                onClick={() => setTaskFilter("all")}
                className={`px-1 rounded ${taskFilter === "all" ? "text-indigo-300 font-bold" : "text-slate-500"}`}
              >
                ALL ({tasks.length})
              </button>
              <span>•</span>
              <button
                onClick={() => setTaskFilter("active")}
                className={`px-1 rounded ${taskFilter === "active" ? "text-cyan-400 font-bold" : "text-slate-500"}`}
              >
                ACTIVE ({tasks.filter((t) => t.status === "active").length})
              </button>
              <span>•</span>
              <button
                onClick={() => setIsAddingTask(!isAddingTask)}
                className="px-1.5 py-0.5 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 font-bold flex items-center gap-0.5"
              >
                <Plus className="h-2.5 w-2.5" /> ADD
              </button>
            </div>
          </div>

          {/* Inline Add Task Form */}
          {isAddingTask && (
            <form onSubmit={handleAddTask} className="bg-[#050818] border border-[#232f63] p-1.5 rounded space-y-1 text-[9px]">
              <input
                type="text"
                placeholder="Task title (e.g. Rollover NDB FD at 10.25%)..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full bg-[#080d26] border border-[#1a2550] px-2 py-1 rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                autoFocus
              />
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  {(["OPS", "FIN", "BIO", "GRID"] as const).map((dom) => (
                    <button
                      type="button"
                      key={dom}
                      onClick={() => setNewTaskDomain(dom)}
                      className={`px-1.5 py-0.2 rounded text-[7.5px] font-bold ${
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
                    placeholder="Deadline (e.g. 14:00)"
                    value={newTaskDeadline}
                    onChange={(e) => setNewTaskDeadline(e.target.value)}
                    className="w-20 bg-[#080d26] border border-[#1a2550] px-1 py-0.5 rounded text-[8px] text-slate-300 text-center"
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[8px] hover:bg-emerald-500"
                  >
                    SAVE
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[8px]"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Task List */}
          <div className="space-y-1 max-h-[145px] overflow-y-auto pr-0.5">
            {filteredTasks.length === 0 ? (
              <div className="p-3 text-center text-[9px] text-slate-600 border border-dashed border-[#1a2550] rounded">
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
                    className={`flex items-center justify-between p-1.5 rounded border cursor-pointer select-none transition-all ${
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
                      <span className="text-[7.5px] px-1 rounded bg-[#11193d] text-indigo-300 font-semibold">
                        {task.domain}
                      </span>
                      <span className="text-[8px] text-slate-500">
                        {task.deadline}
                      </span>
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
  );
}
