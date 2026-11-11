"use client";

import React, { useState } from "react";
import { Sun, Zap, BatteryCharging, Power } from "lucide-react";
import { GridFleetData } from "@/lib/types";

interface GridFleetBayProps {
  gridFleet: GridFleetData;
}

export function GridFleetBay({ gridFleet }: GridFleetBayProps) {
  const { solar, fleet } = gridFleet;
  const [chargingOverride, setChargingOverride] = useState(fleet.isCharging);

  const solarTargetPct = Math.min(100, Math.round((solar.dailyKwh / solar.dailyTargetKwh) * 100));

  // Segmented battery meter (10 segments)
  const segments = 10;
  const filled = Math.round((fleet.batteryPct / 100) * segments);
  const batteryMeter = "█".repeat(filled) + "░".repeat(segments - filled);

  return (
    <div className="bg-[#140d04]/80 border border-[#3a2408] border-t border-t-white/10 rounded-md p-3.5 flex flex-col justify-between h-full">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#3a2408]">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
            <h2 className="text-[10px] font-semibold tracking-wider uppercase text-amber-400">
              Zone 3: Fleet &amp; Renewable Grid
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/40">
              SOLAR NET-METER
            </span>
          </div>
        </div>

        {/* ── Rooftop Solar Telemetry ── */}
        <div className="bg-[#0d0702] border border-[#3a2408] p-2.5 rounded mb-3">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1">
              <Sun className="h-3 w-3 text-amber-400" /> Rooftop Solar (Current)
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

        {/* ── EV Fleet Telemetry (BYD Sealion 6 AWD) ── */}
        <div className="bg-[#0d0702] border border-[#3a2408] p-2.5 rounded mb-3">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-400" /> {fleet.vehicleName}
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
                  ? "bg-amber-500 text-slate-950"
                  : "bg-[#251705] text-amber-300 border border-[#3a2408] hover:bg-[#321f07]"
              }`}
            >
              {chargingOverride ? "⚡ Charging" : "Start Charge"}
            </button>
          </div>
        </div>
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
    </div>
  );
}
