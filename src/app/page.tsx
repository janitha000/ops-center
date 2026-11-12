"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Layers,
  RefreshCw,
  Clock,
  Target,
  Wallet,
  Activity,
  Zap,
  Flame,
  Terminal,
  Cpu,
  BarChart2
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ComposedChart,
  Line
} from "recharts";
import { OpsDashboardPayload, TimeHorizon } from "@/lib/types";
import { formatLKR, formatUSD, formatPercent } from "@/lib/utils";
import { PinLockScreen } from "@/components/auth/PinLockScreen";
import { FinancialBay } from "@/components/dashboard/FinancialBay";
import { SpendIncomeBay } from "@/components/dashboard/SpendIncomeBay";
import { BiometricsBay } from "@/components/dashboard/BiometricsBay";
import { GridFleetBay } from "@/components/dashboard/GridFleetBay";
import { TradingBotBay } from "@/components/dashboard/TradingBotBay";
import { OpsBar } from "@/components/dashboard/OpsBar";
import { MaturityRadarPanel } from "@/components/dashboard/MaturityRadarPanel";

export default function OperationsDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [data, setData] = useState<OpsDashboardPayload | null>(null);
  const [horizon, setHorizon] = useState<TimeHorizon>("mtd");
  const [currency, setCurrency] = useState<"LKR" | "USD">("LKR");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoneRefreshing, setZoneRefreshing] = useState<Record<string, boolean>>({});
  const [currentTime, setCurrentTime] = useState<string>("");

  // Live SL UTC+05:30 Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-LK", {
          timeZone: "Asia/Colombo",
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " UTC+05:30"
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check auth
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth");
        const json = await res.json();
        setIsAuthenticated(!!json.authenticated);
      } catch {
        setIsAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

  // Fetch sync payload
  const fetchSyncData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/ops/sync");
      if (res.ok) {
        const json: OpsDashboardPayload = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Per-zone selective refresh callback
  const handleRefreshZone = useCallback(async (zoneKey: "zone1" | "zone2" | "zone3" | "zone4" | "zone5" | "zone6") => {
    setZoneRefreshing((prev) => ({ ...prev, [zoneKey]: true }));
    try {
      const res = await fetch(`/api/ops/sync?zone=${zoneKey}`);
      if (res.ok) {
        const partial = await res.json();
        setData((prev) => (prev ? { ...prev, ...partial } : prev));
      }
    } catch (err) {
      console.error(`Error refreshing ${zoneKey}:`, err);
    } finally {
      setZoneRefreshing((prev) => ({ ...prev, [zoneKey]: false }));
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSyncData();
    }
  }, [isAuthenticated, fetchSyncData]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#090b0e] flex items-center justify-center font-mono text-xs text-slate-500">
        [INITIALIZING TELEMETRY STREAM...]
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PinLockScreen onUnlock={() => setIsAuthenticated(true)} />;
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#090b0e] flex flex-col items-center justify-center gap-2 font-mono text-xs text-slate-400">
        <RefreshCw className="h-5 w-5 text-cyan-400 animate-spin" />
        <span>SYNCING DOMAIN ZONES (5 DAEMONS)...</span>
      </div>
    );
  }

  const { health, spendIncome, finance, investments, bot, gridFleet, sprintTasks, crossDomain } = data;

  return (
    <div className="min-h-screen bg-[#090b0e] text-[#e6edf3] font-sans antialiased selection:bg-cyan-500 selection:text-slate-950 pb-10">
      {/* ── HIGH-DENSITY SYSTEM OPS BAR (TOP) ── */}
      <header className="border-b border-[#161b22] bg-[#06080b] px-3 py-2 sticky top-0 z-40">
        <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          {/* Brand & Telemetry Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-100 tracking-wider">
              <span className="h-2 w-2 bg-emerald-500 rounded-none inline-block animate-pulse" />
              LIFE OPS // DOMAIN-ZONED TELEMETRY
            </div>
            <span className="text-[10px] font-mono text-slate-500 hidden md:inline">|</span>
            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
              <span className="text-emerald-400">● 5/5 DAEMONS ONLINE</span>
              <span>•</span>
              <span>HOST: AWS EC2 + NEON</span>
              <span>•</span>
              <span className="text-cyan-400 font-semibold">{currentTime}</span>
            </div>
          </div>

          {/* Quick Controls & Currency Switcher */}
          <div className="flex items-center gap-2">
            {/* Horizon Selector */}
            <div className="flex items-center gap-1 bg-[#0d1117] border border-[#1e2633] rounded-sm p-0.5 font-mono text-[10px]">
              {(
                [
                  { id: "pulse", label: "PULSE" },
                  { id: "7d", label: "7D SPRINT" },
                  { id: "mtd", label: "MTD OPS" },
                  { id: "fy", label: "FY/FIRE" },
                ] as const
              ).map((h) => (
                <button
                  key={h.id}
                  onClick={() => setHorizon(h.id)}
                  className={`px-2 py-0.5 rounded-none font-semibold transition-colors ${
                    horizon === h.id
                      ? "bg-[#1e2633] text-cyan-300 border-b-2 border-cyan-400"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrency((c) => (c === "LKR" ? "USD" : "LKR"))}
              className="px-2 py-0.5 rounded-sm font-mono text-[10px] font-bold bg-[#0d1117] border border-[#1e2633] text-emerald-400 hover:bg-[#161b22] transition-colors"
            >
              BASE: {currency}
            </button>

            <button
              onClick={fetchSyncData}
              disabled={refreshing}
              className="p-1 rounded-sm bg-[#0d1117] border border-[#1e2633] text-slate-400 hover:text-white"
              title="Refresh telemetry"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ── 12-COLUMN MAIN TELEMETRY MATRIX ── */}
      <main className="max-w-[1720px] mx-auto p-2.5 sm:p-3 space-y-2.5">
        
        {/* ROW 1: PRIMARY DOMAIN BAYS (12-COLUMN INDUSTRIAL GRID) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
          {/* ZONE 1: FINANCIAL & EQUITIES BAY (6 COLUMNS = EXACT HALF SCREEN) */}
          <div className="lg:col-span-6 h-full min-h-[460px]">
            <FinancialBay
              finance={finance}
              currency={currency}
              onToggleCurrency={() => setCurrency((c) => (c === "LKR" ? "USD" : "LKR"))}
              onRefresh={() => handleRefreshZone("zone1")}
              isRefreshing={!!zoneRefreshing.zone1}
            />
          </div>

          {/* ZONE 2: SPENDINGS & INCOME TELEMETRY BAY (6 COLUMNS = SECOND HALF) */}
          <div className="lg:col-span-6 h-full min-h-[460px]">
            <SpendIncomeBay
              spendIncome={spendIncome}
              currency={currency}
              onRefresh={() => handleRefreshZone("zone2")}
              isRefreshing={!!zoneRefreshing.zone2}
            />
          </div>
        </div>

        {/* ROW 2: BIOMETRICS, FLEET/GRID & ALGORITHMIC TRADING BOT (12 COLUMNS) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-2.5">
          {/* ZONE 3: METABOLIC & BIOMETRIC BAY (4 COLS) */}
          <div className="lg:col-span-4 h-full min-h-[380px]">
            <BiometricsBay
              health={health}
              onRefresh={() => handleRefreshZone("zone3")}
              isRefreshing={!!zoneRefreshing.zone3}
            />
          </div>

          {/* ZONE 4: FLEET & RENEWABLE GRID (4 COLS) */}
          <div className="lg:col-span-4 h-full min-h-[380px]">
            <GridFleetBay
              gridFleet={gridFleet}
              onRefresh={() => handleRefreshZone("zone4")}
              isRefreshing={!!zoneRefreshing.zone4}
            />
          </div>

          {/* ZONE 5: ALGORITHMIC TRADING BOT (4 COLS) */}
          <div className="lg:col-span-4 h-full min-h-[380px]">
            <TradingBotBay
              bot={bot}
              onRefresh={() => handleRefreshZone("zone5")}
              isRefreshing={!!zoneRefreshing.zone5}
            />
          </div>
        </div>

        {/* ZONE 6: MISSION CONTROL & OPS BAY (12 COLUMNS FULL-WIDTH MATRIX) */}
        <div>
          <OpsBar
            bot={bot}
            tasks={sprintTasks}
            health={health}
            gridFleet={gridFleet}
            investments={investments}
            spendIncome={spendIncome}
            finance={finance}
            onGlobalSync={fetchSyncData}
            refreshing={refreshing}
            onRefresh={() => handleRefreshZone("zone6")}
            isRefreshing={!!zoneRefreshing.zone6}
          />
        </div>

        {/* ROW 3: FIXED INCOME & TREASURY MATURITY RADAR (12 COLUMNS FULL-WIDTH MATRIX) */}
        <div>
          <MaturityRadarPanel items={investments.maturityRadar} onRefresh={fetchSyncData} />
        </div>

        {/* ROW 3: INDUSTRIAL TELEMETRY CHARTS (2-COLUMN HIGH-DENSITY GRID) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {/* Burn Rate Run-Chart */}
          <div className="bg-[#090b0e] border border-[#161b22] border-t border-t-white/10 rounded-md p-3">
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#161b22] text-xs font-mono">
              <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                Daily Spend Burn Rate vs. Linear Run-Rate
              </span>
              <span className="text-amber-400 font-bold">{spendIncome.budgetUtilizationPct}% OF BASELINE</span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spendIncome.dailyBurnRunRate}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#161b22" />
                  <XAxis dataKey="day" stroke="#4b5563" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                  <YAxis stroke="#4b5563" tick={{ fontSize: 10, fontFamily: "monospace" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#06080b", borderColor: "#1e2633", borderRadius: "2px", fontSize: "11px", fontFamily: "monospace" }}
                    formatter={(v: any) => [formatLKR(Number(v)), ""]}
                  />
                  <Area type="monotone" dataKey="actualSpend" stroke="#f59e0b" strokeWidth={1.5} fillOpacity={0.15} fill="#f59e0b" name="Actual Spend" />
                  <Line type="monotone" dataKey="idealBudgetTrajectory" stroke="#64748b" strokeDasharray="3 3" dot={false} strokeWidth={1} name="Budget Cap" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dining Spend vs Calorie/Sugar Correlation */}
          <div className="bg-[#090b0e] border border-[#161b22] border-t border-t-white/10 rounded-md p-3">
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#161b22] text-xs font-mono">
              <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                Lifestyle Spend vs. Glycemic &amp; Caloric Response (7D)
              </span>
              <span className="text-rose-400 font-bold">CROSS-DOMAIN CORRELATION</span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={crossDomain.foodSpendVsCalorieCorrelation}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#161b22" />
                  <XAxis dataKey="date" stroke="#4b5563" tick={{ fontSize: 10, fontFamily: "monospace" }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis yAxisId="left" stroke="#4b5563" tick={{ fontSize: 10, fontFamily: "monospace" }} tickFormatter={(v) => `${v}k`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#4b5563" tick={{ fontSize: 10, fontFamily: "monospace" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#06080b", borderColor: "#1e2633", borderRadius: "2px", fontSize: "11px", fontFamily: "monospace" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px", fontFamily: "monospace" }} />
                  <Bar yAxisId="right" dataKey="diningSpend" fill="#3b82f6" opacity={0.6} barSize={16} name="Dining LKR" />
                  <Line yAxisId="left" type="monotone" dataKey="calories" stroke="#f59e0b" strokeWidth={1.5} name="Calories" />
                  <Line yAxisId="left" type="monotone" dataKey="sugar" stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="2 2" name="Sugar (g)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
