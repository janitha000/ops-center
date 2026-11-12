"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Terminal,
  Cpu,
  AlertTriangle,
  Zap,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Server,
  Activity,
  Layers,
  ArrowUpRight,
  TrendingUp,
  BatteryCharging
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
  const [activeTab, setActiveTab] = useState<"command" | "bot">("command");
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
      // fallback to initialTasks
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

  // Primary active trading slot
  const primarySlot = bot.slots && bot.slots.length > 0 ? bot.slots[0] : null;

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === "active") return t.status === "active";
    if (taskFilter === "done") return t.status === "complete";
    return true;
  });

  return (
    <div className="bg-[#0a0d1e]/90 border border-[#192244] border-t border-t-white/10 rounded-md p-3 flex flex-col justify-between h-full font-sans">
      <div>
        {/* ── HEADER WITH TABS & REAL-TIME SL CLOCK ── */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#192244]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            <h2 className="text-[10px] font-mono font-bold tracking-wider uppercase text-indigo-400">
              Zone 5: Mission Control &amp; Ops Bay
            </h2>
          </div>

          <div className="flex items-center gap-1 font-mono text-[9px]">
            <button
              onClick={() => setActiveTab("command")}
              className={`px-2 py-0.5 rounded-sm font-bold transition-all ${
                activeTab === "command"
                  ? "bg-indigo-600 text-white shadow-[0_0_8px_#6366f1]"
                  : "bg-[#101633] text-slate-400 hover:text-slate-200 border border-[#192244]"
              }`}
            >
              COMMAND &amp; SPRINT
            </button>
            <button
              onClick={() => setActiveTab("bot")}
              className={`px-2 py-0.5 rounded-sm font-bold transition-all ${
                activeTab === "bot"
                  ? "bg-indigo-600 text-white shadow-[0_0_8px_#6366f1]"
                  : "bg-[#101633] text-slate-400 hover:text-slate-200 border border-[#192244]"
              }`}
            >
              BOT ENGINE &amp; DAEMONS
            </button>
          </div>
        </div>

        {/* ── 1. UNIFIED SERVICES & DAEMONS HEARTBEAT MATRIX (ALWAYS ACCESSIBLE) ── */}
        <div className="bg-[#050817] border border-[#192244] p-1.5 rounded-sm mb-2 font-mono text-[8.5px]">
          <div className="flex items-center justify-between text-slate-500 uppercase tracking-wider mb-1 px-0.5 font-semibold text-[7.5px]">
            <span className="flex items-center gap-1 text-indigo-300">
              <Server className="h-2.5 w-2.5 text-indigo-400" /> Live Services Pulse Matrix
            </span>
            <span className="text-emerald-400">6/6 Systems Online</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-center">
            <div className="bg-[#080d24] py-0.5 px-1 rounded border border-[#192244]/60">
              <span className="block text-[7px] text-slate-500 uppercase">FusionSolar</span>
              <span className="font-bold text-amber-400">● Synced</span>
            </div>
            <div className="bg-[#080d24] py-0.5 px-1 rounded border border-[#192244]/60">
              <span className="block text-[7px] text-slate-500 uppercase">EC2 Bot</span>
              <span className={`font-bold ${isBotPaused ? "text-amber-400" : "text-emerald-400"}`}>
                {isBotPaused ? "● Paused" : "● Active"}
              </span>
            </div>
            <div className="bg-[#080d24] py-0.5 px-1 rounded border border-[#192244]/60">
              <span className="block text-[7px] text-slate-500 uppercase">CSE Market</span>
              <span className="font-bold text-cyan-400">● Synced</span>
            </div>
            <div className="bg-[#080d24] py-0.5 px-1 rounded border border-[#192244]/60">
              <span className="block text-[7px] text-slate-500 uppercase">Investor DB</span>
              <span className="font-bold text-emerald-400">● Connected</span>
            </div>
            <div className="bg-[#080d24] py-0.5 px-1 rounded border border-[#192244]/60">
              <span className="block text-[7px] text-slate-500 uppercase">Calorie CC</span>
              <span className="font-bold text-teal-400">● 16:8 Live</span>
            </div>
            <div className="bg-[#080d24] py-0.5 px-1 rounded border border-[#192244]/60">
              <span className="block text-[7px] text-slate-500 uppercase">BudgetFlow</span>
              <span className="font-bold text-indigo-300">● Tracked</span>
            </div>
          </div>
        </div>

        {/* ── 2. CROSS-BAY TACTICAL ALERTS TICKER ── */}
        <div className="bg-[#060a1d] border border-[#1d2752] p-1.5 rounded-sm mb-2 flex items-center justify-between gap-2 text-[9px] font-mono">
          <div className="flex items-center gap-1.5 min-w-0">
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
              <span className="text-indigo-400 hidden sm:inline shrink-0 font-semibold">
                [{currentAlert.actionHint}]
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 text-slate-500">
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

        {/* ── TAB 1: COMMAND & SPRINT VIEW ── */}
        {activeTab === "command" && (
          <div className="space-y-2">
            {/* Daily Critical Path Tasks Header */}
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
              <span className="flex items-center gap-1 font-mono text-indigo-300">
                <Terminal className="h-3 w-3 text-indigo-400" /> Daily Critical Path
              </span>

              <div className="flex items-center gap-1.5 font-mono text-[8px]">
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
                  className="px-1.5 py-0.5 rounded bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 font-bold flex items-center gap-0.5"
                >
                  <Plus className="h-2.5 w-2.5" /> ADD
                </button>
              </div>
            </div>

            {/* Inline Add Task Form */}
            {isAddingTask && (
              <form onSubmit={handleAddTask} className="bg-[#050817] border border-[#232f63] p-1.5 rounded space-y-1 font-mono text-[9px]">
                <input
                  type="text"
                  placeholder="Task title (e.g. Rollover NDB FD at 10.25%)..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-[#080d24] border border-[#192244] px-1.5 py-1 rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-400"
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
                            : "bg-[#0b102b] text-slate-400 border border-[#192244]"
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
                      className="w-20 bg-[#080d24] border border-[#192244] px-1 py-0.5 rounded text-[8px] text-slate-300 text-center"
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

            {/* Task List (Scrollable if dense) */}
            <div className="space-y-1 max-h-[175px] overflow-y-auto pr-0.5">
              {filteredTasks.length === 0 ? (
                <div className="p-3 text-center text-[9px] font-mono text-slate-600 border border-dashed border-[#192244] rounded">
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
                          ? "bg-[#060814] border-[#192244]/60 text-slate-500 opacity-60"
                          : isActive
                          ? "bg-[#0c122e] border-[#293673] text-slate-200"
                          : "bg-[#070917] border-[#192244] text-slate-400 hover:border-[#293673]"
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
                        <span className={`text-[10px] font-mono truncate ${isDone ? "line-through text-slate-500" : ""}`}>
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        <span className="text-[7.5px] font-mono px-1 rounded bg-[#131938] text-indigo-300 font-semibold">
                          {task.domain}
                        </span>
                        <span className="text-[8px] font-mono text-slate-500">
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
        )}

        {/* ── TAB 2: BOT ENGINE & DEEP TELEMETRY ── */}
        {activeTab === "bot" && (
          <div className="space-y-2 font-mono">
            {/* Binance Bot Operational Status Card */}
            <div className="bg-[#050713] border border-[#192244] p-2 rounded">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                <span className="flex items-center gap-1">
                  <Cpu className="h-3 w-3 text-cyan-400" /> Algorithmic Trading Bot (AWS EC2)
                </span>
                <span className={`text-[8px] px-1.5 py-0.2 rounded font-bold uppercase ${
                  isBotPaused
                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                    : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                }`}>
                  {isBotPaused ? "PAUSED (SAFETY LOCK)" : `${bot.mode} Mode Active`}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-xs pt-1 border-t border-[#192244]/80">
                <div className="bg-[#080d24] p-1.5 rounded border border-[#192244]/60">
                  <span className="text-[8px] text-slate-500 block uppercase font-semibold">Realized PnL</span>
                  <span className="text-xs font-bold text-amber-400">+{formatUSD(bot.totalRealizedPnlUsdt)}</span>
                </div>
                <div className="bg-[#080d24] p-1.5 rounded border border-[#192244]/60">
                  <span className="text-[8px] text-slate-500 block uppercase font-semibold">Win Rate</span>
                  <span className="text-xs font-bold text-emerald-400">{bot.winRatePct}% ({bot.completedTradesCount} Trades)</span>
                </div>
                <div className="bg-[#080d24] p-1.5 rounded border border-[#192244]/60">
                  <span className="text-[8px] text-slate-500 block uppercase font-semibold">Free USDT</span>
                  <span className="text-xs font-bold text-slate-200">{formatUSD(bot.freeUsdt)}</span>
                </div>
              </div>
            </div>

            {/* Active Trading Position Bracket & Stop Loss Range */}
            {primarySlot && primarySlot.hasOpenPosition && (
              <div className="bg-[#050713] border border-[#192244] p-2 rounded">
                <div className="flex items-center justify-between text-[8.5px] uppercase text-slate-400 mb-1">
                  <span className="font-bold text-cyan-300 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-cyan-400" /> {primarySlot.symbol} Position (Long)
                  </span>
                  <span className="text-emerald-400 font-bold">
                    +{primarySlot.unrealizedPnlPct?.toFixed(2)}% (+{formatUSD(primarySlot.unrealizedPnl || 0)})
                  </span>
                </div>

                <div className="flex items-center justify-between text-[9px] text-slate-300 mb-1">
                  <span>Entry: <strong className="text-slate-100">{formatUSD(primarySlot.entryPrice || 0)}</strong></span>
                  <span>Mark: <strong className="text-cyan-300">{formatUSD(primarySlot.currentPrice)}</strong></span>
                </div>

                {/* Stop Loss / Take Profit Visual Bracket */}
                <div className="space-y-0.5">
                  <div className="h-1.5 w-full bg-[#121938] rounded-full overflow-hidden relative">
                    <div className="absolute left-[20%] right-[20%] h-full bg-indigo-500/50" />
                    <div
                      style={{ left: "62%" }}
                      className="absolute top-0 bottom-0 w-1.5 bg-emerald-400 rounded-full shadow-[0_0_4px_#34d399]"
                      title="Current Mark Price"
                    />
                  </div>
                  <div className="flex justify-between text-[7.5px] text-slate-500">
                    <span className="text-rose-400 font-semibold">SL: {formatUSD(primarySlot.stopLoss || 0)} (-4.0%)</span>
                    <span className="text-emerald-400 font-semibold">TP: {formatUSD(primarySlot.takeProfit || 0)} (+5.0%)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 3. OPERATIONAL QUICK-ACTION SWITCHES FOOTER ── */}
      <div className="pt-2 mt-2 border-t border-[#192244]">
        <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">
          <span>Manual Override Switches</span>
          <span className="text-indigo-400">Tactical Control</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 font-mono text-[8.5px]">
          {/* Action 1: Force Refresh All Data */}
          <button
            onClick={onGlobalSync}
            disabled={refreshing}
            className="flex items-center justify-center gap-1 py-1.5 px-1 rounded bg-[#0e1430] hover:bg-[#16214d] border border-[#232f63] text-indigo-300 font-bold transition-colors disabled:opacity-50"
            title="Poll all daemons (FusionSolar, Stocks, Wealth, Health)"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
            <span>{refreshing ? "SYNCING..." : "SYNC ALL"}</span>
          </button>

          {/* Action 2: EV Pod Night Charge Override */}
          <button
            onClick={() => setIsEvOverridden(!isEvOverridden)}
            className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded border font-bold transition-all ${
              isEvOverridden
                ? "bg-amber-950/80 border-amber-600/70 text-amber-300 shadow-[0_0_6px_#f59e0b]"
                : "bg-[#0e1430] hover:bg-[#16214d] border-[#232f63] text-slate-300"
            }`}
            title="Toggle instant EV pod charge vs 23:00 off-peak schedule"
          >
            <Zap className={`h-2.5 w-2.5 ${isEvOverridden ? "text-amber-400 animate-pulse" : "text-amber-500"}`} />
            <span>{isEvOverridden ? "CHARGING ON" : "EV OVERRIDE"}</span>
          </button>

          {/* Action 3: Trading Bot Circuit Breaker */}
          <button
            onClick={() => setIsBotPaused(!isBotPaused)}
            className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded border font-bold transition-all ${
              isBotPaused
                ? "bg-rose-950/80 border-rose-600/80 text-rose-300 shadow-[0_0_6px_#f43f5e]"
                : "bg-[#0e1430] hover:bg-[#16214d] border-[#232f63] text-slate-300"
            }`}
            title="Freeze algorithmic bot trades during high market volatility"
          >
            {isBotPaused ? (
              <ShieldAlert className="h-2.5 w-2.5 text-rose-400" />
            ) : (
              <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
            )}
            <span>{isBotPaused ? "BOT FROZEN" : "BOT KILL-SW"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
