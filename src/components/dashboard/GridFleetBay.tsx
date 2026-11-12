"use client";

import React, { useState } from "react";
import { Sun, Zap, BatteryCharging, Power, BarChart2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  CartesianGrid,
} from "recharts";
import { GridFleetData } from "@/lib/types";
import { SolarSyncModal } from "./SolarSyncModal";

interface GridFleetBayProps {
  gridFleet: GridFleetData;
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "";
  const now = Date.now();
  const past = new Date(dateString).getTime();
  if (isNaN(past)) return "";
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));
  if (diffSec < 45) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

function CustomSolarTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0b0602] border border-[#3a2408] p-1.5 rounded text-[9px] font-mono shadow-xl">
        <div className="text-amber-300 font-bold mb-0.5">{data.date}</div>
        <div className="text-slate-200">
          Generated: <span className="text-amber-400 font-bold">{data.generationKwh} kWh</span>
        </div>
        <div className="text-slate-400">
          Grid Export: <span className="text-emerald-400 font-bold">{data.exportKwh} kWh</span>
        </div>
        <div className="text-slate-500">
          Target: {data.targetKwh} kWh
        </div>
      </div>
    );
  }
  return null;
}

export function GridFleetBay({ gridFleet }: GridFleetBayProps) {
  const { solar, fleet } = gridFleet;
  const [chargingOverride, setChargingOverride] = useState(fleet.isCharging);
  const [isSolarSyncOpen, setIsSolarSyncOpen] = useState(false);

  const solarTargetPct = Math.min(100, Math.round((solar.dailyKwh / (solar.dailyTargetKwh || 15.0)) * 100));
  const syncTimeStr = formatRelativeTime(solar.lastSynced);

  // Segmented battery meter (10 segments)
  const segments = 10;
  const filled = Math.round((fleet.batteryPct / 100) * segments);
  const batteryMeter = "█".repeat(filled) + "░".repeat(segments - filled);

  // ── Month Calculations ──
  const now = new Date();
  const currentDay = now.getDate();
  const history = solar.historyMonth || [];
  const calculatedHistorySum = history
    .filter((h) => h.day <= currentDay)
    .reduce((sum, h) => sum + h.generationKwh, 0);
  const mtdGenerated = (solar.monthlyKwh && solar.monthlyKwh > 0)
    ? solar.monthlyKwh
    : calculatedHistorySum;
  const mtdTarget = currentDay * (solar.dailyTargetKwh || 15.0);
  const mtdExported = history
    .filter((h) => h.day <= currentDay)
    .reduce((sum, h) => sum + h.exportKwh, 0);
  const mtdPacePct = mtdTarget > 0 ? Math.round((mtdGenerated / mtdTarget) * 100) : 100;
  const avgDailyKwh = currentDay > 0 ? (mtdGenerated / currentDay).toFixed(1) : "0.0";
  const monthlyRevenueLkr = Math.round((mtdExported > 0 ? mtdExported : mtdGenerated * 0.76) * 37); // CEB Net-Plus tariff @ 37 LKR/kWh

  return (
    <div className="bg-[#140d04]/80 border border-[#3a2408] border-t border-t-white/10 rounded-md p-3 flex flex-col justify-between h-full font-sans">
      <div>
        {/* ── BAY HEADER ── */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#3a2408]">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
            <h2 className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-400">
              Zone 4: Fleet &amp; Renewable Grid
            </h2>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[9px]">
            <button
              onClick={() => setIsSolarSyncOpen(true)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors border flex items-center gap-1 ${
                solar.syncedFrom === "fusionsolar"
                  ? "bg-[#251705] border-amber-600/50 text-amber-300"
                  : "bg-[#180f04] hover:bg-[#251705] border-[#3a2408] text-slate-300 hover:text-amber-300"
              }`}
              title="Sync live solar generation from FusionSolar"
            >
              <span>{solar.syncedFrom === "fusionsolar" ? "● SOLAR SYNCED" : "⇄ SOLAR SYNC"}</span>
              {syncTimeStr && <span className="text-[7.5px] text-slate-500 lowercase">({syncTimeStr})</span>}
            </button>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/40">
              NET-METER
            </span>
          </div>
        </div>

        {/* ── CARD 1: ROOFTOP SOLAR REAL-TIME TELEMETRY ── */}
        <div className="bg-[#0d0702] border border-[#3a2408] p-2 rounded mb-2">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1 text-amber-300">
              <Sun className="h-3 w-3 text-amber-400" />
              <span>Rooftop Solar (Current)</span>
            </span>
            <span className="font-mono text-emerald-400 font-bold">{solar.gridExportStatus}</span>
          </div>

          <div className="flex items-baseline justify-between mb-1">
            <div className="text-xl font-bold font-mono text-amber-300 tracking-tight">
              {solar.currentKw.toFixed(2)} kW
            </div>
            <div className="text-xs font-mono text-slate-300">
              Export: <span className="text-emerald-400 font-semibold">{solar.netGridKw.toFixed(2)} kW</span>
            </div>
          </div>

          {/* Daily Generation vs Target Progress Bar */}
          <div>
            <div className="flex justify-between text-[9px] font-mono text-slate-400 mb-0.5">
              <span>Today: <strong className="text-amber-300 font-semibold">{solar.dailyKwh.toFixed(1)} kWh</strong></span>
              <span>Target: {solar.dailyTargetKwh || 15} kWh ({solarTargetPct}%)</span>
            </div>
            <div className="h-1.5 w-full bg-[#201405] rounded-none overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-none transition-all duration-500"
                style={{ width: `${solarTargetPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── CARD 2: MONTHLY SOLAR GENERATION BAR CHART (INTEGRATED ON SAME PANEL) ── */}
        <div className="bg-[#0d0702] border border-[#3a2408] p-2 rounded mb-2 font-mono">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5 text-amber-300">
              <BarChart2 className="h-3 w-3 text-amber-400" />
              <span>November Generation Yield</span>
            </span>
            <span className="text-emerald-400 text-[10px] font-bold">
              MTD: {mtdGenerated.toFixed(1)} kWh
            </span>
          </div>

          {/* Compact Bar Chart */}
          <div className="h-[95px] w-full mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history} margin={{ top: 4, right: 2, left: -25, bottom: -5 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#251705" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#785324"
                  tick={{ fontSize: 7.5, fill: "#a8783e" }}
                  interval={2}
                  tickLine={false}
                />
                <YAxis
                  stroke="#785324"
                  tick={{ fontSize: 7.5, fill: "#a8783e" }}
                  domain={[0, 25]}
                  tickLine={false}
                />
                <ReferenceLine
                  y={solar.dailyTargetKwh || 15.0}
                  stroke="#f59e0b"
                  strokeDasharray="2 2"
                  strokeWidth={1}
                />
                <Tooltip content={<CustomSolarTooltip />} />
                <Bar dataKey="generationKwh" radius={[2, 2, 0, 0]}>
                  {history.map((entry, index) => {
                    const isToday = entry.day === currentDay;
                    const isFuture = entry.day > currentDay;
                    const isTargetMet = entry.generationKwh >= (solar.dailyTargetKwh || 15.0);
                    const fill = isFuture
                      ? "#1a1005"
                      : isToday
                      ? "#10b981"
                      : isTargetMet
                      ? "#f59e0b"
                      : "#b45309";
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Micro Legend & MTD Metric Strip */}
          <div className="flex items-center justify-between text-[7.5px] text-slate-500 mt-1 pt-1 border-t border-[#251705]">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-[#f59e0b] inline-block" />
                <span>Yield</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-[#10b981] inline-block" />
                <span>Today (Live)</span>
              </span>
              <span className="text-amber-400/80">{solar.dailyTargetKwh || 15} kWh Goal</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span>Avg: <strong className="text-amber-300">{avgDailyKwh} kWh/d</strong></span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">Rs. {monthlyRevenueLkr.toLocaleString()} Net-Plus</span>
            </div>
          </div>
        </div>

        {/* ── CARD 3: EV FLEET TELEMETRY (BYD Sealion 6 AWD) ── */}
        <div className="bg-[#0d0702] border border-[#3a2408] p-2 rounded mb-1 font-mono">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1 text-amber-300">
              <Zap className="h-3 w-3 text-amber-400" />
              <span>{fleet.vehicleName}</span>
            </span>
            <span className="text-[9px] text-amber-300">
              {fleet.chargerConnected ? "Home Pod Connected" : "Unplugged"}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-base font-bold text-amber-300 tracking-tight">
              {fleet.batteryPct}% <span className="text-[10px] font-normal text-slate-400">SOC</span>
            </div>
            <div className="text-[10px] text-slate-300">
              Est Range: <strong className="text-amber-300">{fleet.estimatedRangeKm} km</strong>
            </div>
          </div>

          {/* Segmented Battery Meter */}
          <div className="text-[10px] tracking-tighter text-amber-400 select-none my-0.5">
            {batteryMeter}
          </div>

          {/* Smart Charge Trigger */}
          <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1 pt-1 border-t border-[#3a2408]/80">
            <span>Schedule: Off-Peak (23:00)</span>
            <button
              onClick={() => setChargingOverride(!chargingOverride)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-colors ${
                chargingOverride
                  ? "bg-amber-500 text-slate-950"
                  : "bg-[#251705] text-amber-300 border border-[#3a2408] hover:bg-[#321f07]"
              }`}
            >
              {chargingOverride ? "⚡ Charging" : "Start Charge"}
            </button>
          </div>
        </div>
      </div>

      {/* ── BAY FOOTER TELEMETRY ── */}
      <div className="pt-2 border-t border-[#3a2408] grid grid-cols-3 gap-1.5 text-[9.5px] font-mono text-slate-400">
        <div>
          <span className="block text-[7.5px] uppercase tracking-wider text-slate-500">Yearly / Total</span>
          <span className="text-slate-200 font-semibold">
            {solar.yearlyMwh ? solar.yearlyMwh.toFixed(2) : "3.84"} / {solar.lifetimeMwh.toFixed(2)} MWh
          </span>
        </div>
        <div>
          <span className="block text-[7.5px] uppercase tracking-wider text-slate-500">Grid Tariff Mode</span>
          <span className="text-amber-300 font-semibold">Net-Plus</span>
        </div>
        <div>
          <span className="block text-[7.5px] uppercase tracking-wider text-slate-500">Pod Status</span>
          <span className="text-emerald-400 font-semibold">Ready</span>
        </div>
      </div>

      {/* Solar Sync Bridge Modal */}
      <SolarSyncModal
        isOpen={isSolarSyncOpen}
        onClose={() => setIsSolarSyncOpen(false)}
        lastSolarSync={solar.lastSynced}
        syncedFrom={solar.syncedFrom}
        currentKw={solar.currentKw}
        dailyKwh={solar.dailyKwh}
        monthlyKwh={solar.monthlyKwh}
        yearlyMwh={solar.yearlyMwh}
        lifetimeMwh={solar.lifetimeMwh}
        onSyncSuccess={() => {
          setTimeout(() => {
            window.location.reload();
          }, 600);
        }}
      />
    </div>
  );
}
