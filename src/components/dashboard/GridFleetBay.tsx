"use client";

import React, { useState } from "react";
import { Sun, Zap, BatteryCharging, Power, BarChart2, Calendar } from "lucide-react";
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
  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const [chargingOverride, setChargingOverride] = useState(fleet.isCharging);
  const [isSolarSyncOpen, setIsSolarSyncOpen] = useState(false);

  const solarTargetPct = Math.min(100, Math.round((solar.dailyKwh / solar.dailyTargetKwh) * 100));
  const syncTimeStr = formatRelativeTime(solar.lastSynced);

  // Segmented battery meter (10 segments)
  const segments = 10;
  const filled = Math.round((fleet.batteryPct / 100) * segments);
  const batteryMeter = "█".repeat(filled) + "░".repeat(segments - filled);

  // ── Month View Calculations ──
  const now = new Date();
  const currentDay = now.getDate();
  const history = solar.historyMonth || [];
  const mtdGenerated = history
    .filter((h) => h.day <= currentDay)
    .reduce((sum, h) => sum + h.generationKwh, 0);
  const mtdTarget = currentDay * (solar.dailyTargetKwh || 30.0);
  const mtdExported = history
    .filter((h) => h.day <= currentDay)
    .reduce((sum, h) => sum + h.exportKwh, 0);
  const mtdPacePct = mtdTarget > 0 ? Math.round((mtdGenerated / mtdTarget) * 100) : 100;
  const avgDailyKwh = currentDay > 0 ? (mtdGenerated / currentDay).toFixed(1) : "0.0";
  const monthlyRevenueLkr = Math.round(mtdExported * 37); // CEB Net-Plus tariff @ 37 LKR/kWh

  return (
    <div className="bg-[#140d04]/80 border border-[#3a2408] border-t border-t-white/10 rounded-md p-3.5 flex flex-col justify-between h-full font-sans">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#3a2408]">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
            <h2 className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-400">
              Zone 3: Fleet &amp; Renewable Grid
            </h2>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[9px]">
            {/* View Mode Toggle: Day vs Month Bar Chart */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("day")}
                className={`px-2 py-0.5 rounded-sm font-bold transition-all ${
                  viewMode === "day"
                    ? "bg-amber-600 text-slate-950 shadow-[0_0_8px_#f59e0b]"
                    : "bg-[#251705] text-slate-400 hover:text-slate-200 border border-[#3a2408]"
                }`}
              >
                DAY
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`px-2 py-0.5 rounded-sm font-bold transition-all ${
                  viewMode === "month"
                    ? "bg-amber-600 text-slate-950 shadow-[0_0_8px_#f59e0b]"
                    : "bg-[#251705] text-slate-400 hover:text-slate-200 border border-[#3a2408]"
                }`}
              >
                MONTH
              </button>
            </div>

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
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/40 hidden sm:inline">
              NET-METER
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW 1: DAY VIEW (LIVE ROOFTOP SOLAR & EV TELEMETRY)
        ══════════════════════════════════════════════════════════════════════ */}
        {viewMode === "day" && (
          <>
            {/* Rooftop Solar Current Telemetry Card */}
            <div className="bg-[#0d0702] border border-[#3a2408] p-2.5 rounded mb-3">
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

              {/* Daily Generation vs Target */}
              <div className="mt-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
                  <span>Today: {solar.dailyKwh.toFixed(1)} kWh</span>
                  <span>Target: {solar.dailyTargetKwh} kWh ({solarTargetPct}%)</span>
                </div>
                <div className="h-1.5 w-full bg-[#201405] rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-sm transition-all duration-500"
                    style={{ width: `${solarTargetPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* EV Fleet Telemetry (BYD Sealion 6 AWD) */}
            <div className="bg-[#0d0702] border border-[#3a2408] p-2.5 rounded mb-3">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                <span className="flex items-center gap-1 text-amber-300">
                  <Zap className="h-3 w-3 text-amber-400" />
                  <span>{fleet.vehicleName}</span>
                </span>
                <span className="text-[10px] font-mono text-amber-300">
                  {fleet.chargerConnected ? "Home Pod Connected" : "Unplugged"}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="text-xl font-bold font-mono text-amber-300 tracking-tight">
                  {fleet.batteryPct}% <span className="text-xs font-normal text-slate-400">SOC</span>
                </div>
                <div className="text-xs font-mono text-slate-300">
                  Est Range: <strong className="text-amber-300">{fleet.estimatedRangeKm} km</strong> (EV)
                </div>
              </div>

              {/* Segmented Battery Meter */}
              <div className="mt-1.5 text-[11px] font-mono tracking-tighter text-amber-400 select-none">
                {batteryMeter}
              </div>

              {/* Smart Charge Trigger */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 pt-1.5 border-t border-[#3a2408]/80">
                <span>Schedule: Off-Peak (23:00)</span>
                <button
                  onClick={() => setChargingOverride(!chargingOverride)}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors ${
                    chargingOverride
                      ? "bg-amber-500 text-slate-950 font-mono"
                      : "bg-[#251705] text-amber-300 border border-[#3a2408] hover:bg-[#321f07] font-mono"
                  }`}
                >
                  {chargingOverride ? "⚡ Charging" : "Start Charge"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW 2: MONTH VIEW (MONTHLY SOLAR GENERATION BAR CHART)
        ══════════════════════════════════════════════════════════════════════ */}
        {viewMode === "month" && (
          <div className="space-y-2.5">
            {/* Monthly KPI Overview Strip */}
            <div className="bg-[#0d0702] border border-[#3a2408] p-2.5 rounded">
              <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <BarChart2 className="h-3 w-3 text-amber-400" />
                  <span>Month Solar Generation (November)</span>
                </span>
                <span className="text-emerald-400 font-bold">
                  Pace: {mtdPacePct}% ({mtdGenerated.toFixed(1)} kWh)
                </span>
              </div>

              {/* Primary Month Metrics Grid */}
              <div className="grid grid-cols-3 gap-1.5 font-mono text-center my-1.5">
                <div className="bg-[#180e05] p-1.5 rounded border border-[#3a2408]">
                  <span className="block text-[8px] text-slate-400 uppercase">MTD Yield</span>
                  <span className="text-xs font-bold text-amber-300">{mtdGenerated.toFixed(1)} kWh</span>
                  <span className="block text-[7.5px] text-slate-500">Day {currentDay} of 30</span>
                </div>
                <div className="bg-[#180e05] p-1.5 rounded border border-[#3a2408]">
                  <span className="block text-[8px] text-slate-400 uppercase">Daily Average</span>
                  <span className="text-xs font-bold text-slate-200">{avgDailyKwh} kWh/d</span>
                  <span className="block text-[7.5px] text-amber-400">Target: 30.0</span>
                </div>
                <div className="bg-[#180e05] p-1.5 rounded border border-[#3a2408]">
                  <span className="block text-[8px] text-slate-400 uppercase">Net-Plus Revenue</span>
                  <span className="text-xs font-bold text-emerald-400">Rs. {monthlyRevenueLkr.toLocaleString()}</span>
                  <span className="block text-[7.5px] text-slate-500">@ Rs. 37/kWh</span>
                </div>
              </div>

              {/* Monthly Day-by-Day Recharts Bar Chart */}
              <div className="h-[125px] w-full mt-2 font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history} margin={{ top: 8, right: 2, left: -24, bottom: -5 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#251705" vertical={false} />
                    <XAxis
                      dataKey="day"
                      stroke="#785324"
                      tick={{ fontSize: 8, fill: "#a8783e" }}
                      interval={2}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#785324"
                      tick={{ fontSize: 8, fill: "#a8783e" }}
                      domain={[0, 40]}
                      tickLine={false}
                    />
                    <ReferenceLine
                      y={solar.dailyTargetKwh || 30.0}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                    />
                    <Tooltip content={<CustomSolarTooltip />} />
                    <Bar dataKey="generationKwh" radius={[2, 2, 0, 0]}>
                      {history.map((entry, index) => {
                        const isToday = entry.day === currentDay;
                        const isFuture = entry.day > currentDay;
                        const isTargetMet = entry.generationKwh >= (solar.dailyTargetKwh || 30.0);
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

              {/* Legend & Summary */}
              <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 mt-1 pt-1 border-t border-[#251705]">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-[#f59e0b] inline-block" />
                    <span>Past Days</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-[#10b981] inline-block" />
                    <span>Today (Live)</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 border-t border-dashed border-amber-400 inline-block" />
                    <span>30 kWh Goal</span>
                  </span>
                </div>
                <span className="text-amber-400 font-bold">PROJ: {Math.round(Number(avgDailyKwh) * 30)} kWh</span>
              </div>
            </div>

            {/* EV Fleet Monthly Solar Charging Contribution */}
            <div className="bg-[#0d0702] border border-[#3a2408] p-2 rounded flex items-center justify-between text-[10px] font-mono">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <div>
                  <span className="text-slate-200 font-semibold">{fleet.vehicleName} Solar Fuel</span>
                  <span className="block text-[8px] text-slate-500">100% Zero-Carbon Home Pod Charging</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 font-bold">84 kWh MTD</span>
                <span className="block text-[8px] text-slate-500">~520 km Added</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Sub-telemetry Footer ── */}
      <div className="pt-2 border-t border-[#3a2408] grid grid-cols-3 gap-1.5 text-[10px] font-mono text-slate-400">
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">Lifetime Solar</span>
          <span className="text-slate-200 font-semibold">{solar.lifetimeMwh.toFixed(2)} MWh</span>
        </div>
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">Grid Tariff Mode</span>
          <span className="text-amber-300 font-semibold">Net-Plus</span>
        </div>
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">Pod Status</span>
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
        onSyncSuccess={() => {
          setTimeout(() => {
            window.location.reload();
          }, 600);
        }}
      />
    </div>
  );
}
