"use client";

import React, { useState } from "react";
import { CheckCircle2, Circle, Clock, Terminal, Cpu } from "lucide-react";
import { BinanceBotData, SprintTask } from "@/lib/types";
import { formatUSD } from "@/lib/utils";

interface OpsBarProps {
  bot: BinanceBotData;
  tasks: SprintTask[];
}

export function OpsBar({ bot, tasks: initialTasks }: OpsBarProps) {
  const [tasks, setTasks] = useState<SprintTask[]>(initialTasks);

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

  return (
    <div className="bg-[#0a0d1e]/80 border border-[#192244] border-t border-t-white/10 rounded-md p-3.5 flex flex-col justify-between h-full">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#192244]">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6366f1]" />
            <h2 className="text-[10px] font-semibold tracking-wider uppercase text-indigo-400">
              Zone 5: Mission Control &amp; Ops Bay
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-800/40">
              SL TIME (UTC+05:30)
            </span>
          </div>
        </div>

        {/* ── Critical Path Sprint Tasks ── */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
            <span className="flex items-center gap-1">
              <Terminal className="h-3 w-3 text-indigo-400" /> Daily Critical Path
            </span>
            <span className="text-[10px] font-mono text-indigo-300">
              {tasks.filter((t) => t.status === "complete").length}/{tasks.length} Completed
            </span>
          </div>

          <div className="space-y-1.5">
            {tasks.map((task) => {
              const isDone = task.status === "complete";
              const isActive = task.status === "active";

              return (
                <div
                  key={task.id}
                  onClick={() => handleCycleTask(task.id)}
                  className={`flex items-center justify-between p-2 rounded border cursor-pointer select-none transition-all ${
                    isDone
                      ? "bg-[#060814] border-[#192244]/60 text-slate-500 opacity-60"
                      : isActive
                      ? "bg-[#0e1430] border-[#2a3875] text-slate-200"
                      : "bg-[#070917] border-[#192244] text-slate-400 hover:border-[#2a3875]"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    ) : isActive ? (
                      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                    )}
                    <span className={`text-xs font-mono truncate ${isDone ? "line-through text-slate-500" : ""}`}>
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[9px] font-mono px-1 rounded bg-[#131938] text-indigo-300">
                      {task.domain}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">
                      {task.deadline}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Binance Bot Micro Engine Readout ── */}
        <div className="bg-[#050713] border border-[#192244] p-2.5 rounded mb-2">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1">
              <Cpu className="h-3 w-3 text-cyan-400" /> Algorithmic Trading Bot (AWS EC2)
            </span>
            <span className="font-mono text-cyan-400 font-bold uppercase">{bot.mode} Mode</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-[9px] text-slate-500 block uppercase">Realized PnL</span>
              <span className="text-sm font-bold text-amber-400">+{formatUSD(bot.totalRealizedPnlUsdt)}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase">Win Rate</span>
              <span className="text-sm font-bold text-emerald-400">{bot.winRatePct}% ({bot.completedTradesCount} Trades)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-telemetry Footer ── */}
      <div className="pt-2 border-t border-[#192244] grid grid-cols-3 gap-1.5 text-[10px] font-mono text-slate-400">
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">EC2 Daemon</span>
          <span className="text-emerald-400 font-semibold">systemd Active</span>
        </div>
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">Open Slots</span>
          <span className="text-slate-200 font-semibold">{bot.openPositionsCount} In-Position</span>
        </div>
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">Free USDT</span>
          <span className="text-slate-200 font-semibold">{formatUSD(bot.freeUsdt)}</span>
        </div>
      </div>
    </div>
  );
}
