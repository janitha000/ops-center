"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  Wallet,
  ShieldCheck,
  Flame,
  Sun,
  Scale,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { OpsDashboardPayload } from "@/lib/types";
import { TemporalDashboardModel } from "@/lib/decisions/types";
import { formatLKR, formatUSD, formatPercent } from "@/lib/utils";
import { FinancialBay } from "./FinancialBay";
import { SpendIncomeBay } from "./SpendIncomeBay";
import { BiometricsBay } from "./BiometricsBay";
import { GridFleetBay } from "./GridFleetBay";
import { TradingBotBay } from "./TradingBotBay";
import { OpsBar } from "./OpsBar";
import { MaturityRadarPanel } from "./MaturityRadarPanel";

export type MonthlyBayTab = "all" | "finance" | "spend" | "biometrics" | "grid" | "bot_ops";

interface MonthlyHorizonSectionProps {
  payload: OpsDashboardPayload;
  monthly: TemporalDashboardModel["monthly"];
  currency: "LKR" | "USD";
  onToggleCurrency: () => void;
  onRefreshAll: () => void;
  refreshing: boolean;
  onRefreshZone: (zoneKey: "zone1" | "zone2" | "zone3" | "zone4" | "zone5" | "zone6") => void;
  zoneRefreshing: Record<string, boolean>;
  activeBayTab?: MonthlyBayTab;
  onBayTabChange?: (tab: MonthlyBayTab) => void;
}

export function MonthlyHorizonSection({
  payload,
  monthly,
  currency,
  onToggleCurrency,
  onRefreshAll,
  refreshing,
  onRefreshZone,
  zoneRefreshing,
  activeBayTab: controlledBayTab,
  onBayTabChange,
}: MonthlyHorizonSectionProps) {
  const [internalBayTab, setInternalBayTab] = useState<MonthlyBayTab>("all");
  const [baysExpanded, setBaysExpanded] = useState(true);

  const activeBayTab = controlledBayTab ?? internalBayTab;
  const setBayTab = (tab: MonthlyBayTab) => {
    setInternalBayTab(tab);
    onBayTabChange?.(tab);
    if (!baysExpanded) setBaysExpanded(true);
  };

  const LKR_PER_USD = 310;
  const formatVal = (amtLkr: number, compact = false) =>
    currency === "LKR"
      ? formatLKR(amtLkr, compact)
      : formatUSD(amtLkr / LKR_PER_USD, compact);

  const { finance, spendIncome, health, investments, bot, gridFleet, sprintTasks } = payload;

  return (
    <section className="space-y-2.5">
      {/* ── TIER 3 BANNER ── */}
      <div className="flex items-center justify-between bg-[#090b18] border border-indigo-900/60 border-l-2 border-l-indigo-500 rounded-sm px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-indigo-400 rounded-none inline-block" />
          <h2 className="text-[10px] font-mono font-bold tracking-wider uppercase text-indigo-300">
            TIER 3 // MONTHLY AGGREGATORS &amp; STRATEGIC RADAR (MTD &amp; FIRE)
          </h2>
          <span className="px-1.5 py-0.5 rounded-sm bg-indigo-950/80 border border-indigo-800/60 text-indigo-200 font-mono text-[8.5px] font-bold">
            {monthly.currentMonth}
          </span>
        </div>
        <span className="text-[9px] font-mono text-slate-400 hidden sm:inline">
          WEALTH · PASSIVE YIELD · MATURITY RADAR · DEEP-DIVE DOMAIN BAYS
        </span>
      </div>

      {/* ── TOP MONTHLY EXECUTIVE KPI STRIP (6 CARDS) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 font-mono">
        {/* 1. Total Net Worth */}
        <div className="bg-[#08140e]/90 border border-[#133323] border-t border-t-white/10 rounded-md p-2.5">
          <div className="flex items-center justify-between text-[8.5px] text-slate-400 uppercase mb-1">
            <span className="flex items-center gap-1 text-emerald-300 font-bold">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              Total Net Worth
            </span>
            <span
              className={`font-bold ${
                monthly.netWorthDeltaPct >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatPercent(monthly.netWorthDeltaPct)} MoM
            </span>
          </div>
          <div className="text-base font-bold text-white tracking-tight">
            {formatVal(monthly.totalNetWorthLkr, true)}
          </div>
          <div className="text-[8.5px] text-slate-400 mt-0.5">
            {currency === "LKR"
              ? formatUSD(monthly.totalNetWorthLkr / LKR_PER_USD, true)
              : formatLKR(monthly.totalNetWorthLkr, true)}
          </div>
        </div>

        {/* 2. Net Monthly Passive Yield */}
        <div className="bg-[#08140e]/90 border border-[#133323] border-t border-t-white/10 rounded-md p-2.5">
          <div className="flex items-center justify-between text-[8.5px] text-slate-400 uppercase mb-1">
            <span className="flex items-center gap-1 text-emerald-300 font-bold">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              Passive Yield (IIT)
            </span>
            <span className="text-cyan-300 font-bold">
              FI {monthly.trueFiCoverageBaselinePct.toFixed(0)}%
            </span>
          </div>
          <div className="text-base font-bold text-emerald-400 tracking-tight">
            {formatVal(monthly.netMonthlyPassiveAfterIitLkr)}
          </div>
          <div className="text-[8.5px] text-slate-400 mt-0.5">
            Base {monthly.trueFiCoverageBaselinePct.toFixed(1)}% · Total{" "}
            {monthly.trueFiCoverageTotalPct.toFixed(1)}%
          </div>
        </div>

        {/* 3. Monthly Cashflow */}
        <div className="bg-[#140b04]/90 border border-[#381a07] border-t border-t-white/10 rounded-md p-2.5">
          <div className="flex items-center justify-between text-[8.5px] text-slate-400 uppercase mb-1">
            <span className="flex items-center gap-1 text-amber-300 font-bold">
              <Wallet className="h-3 w-3 text-amber-400" />
              Monthly Cashflow
            </span>
            <span
              className={`font-bold ${
                monthly.savingsRatePct >= 20 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {monthly.savingsRatePct.toFixed(1)}% Sav
            </span>
          </div>
          <div
            className={`text-base font-bold tracking-tight ${
              monthly.netCashFlowLkr >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {monthly.netCashFlowLkr >= 0 ? "+" : ""}
            {formatVal(monthly.netCashFlowLkr, true)}
          </div>
          <div className="text-[8.5px] text-slate-400 mt-0.5 truncate">
            In {formatVal(monthly.totalInflowLkr, true)} · Out{" "}
            {formatVal(monthly.totalOutflowLkr, true)}
          </div>
        </div>

        {/* 4. Monthly Budget Burn */}
        <div className="bg-[#140b04]/90 border border-[#381a07] border-t border-t-white/10 rounded-md p-2.5">
          <div className="flex items-center justify-between text-[8.5px] text-slate-400 uppercase mb-1">
            <span className="flex items-center gap-1 text-amber-300 font-bold">
              <Flame className="h-3 w-3 text-amber-400" />
              Budget Burn (Normal)
            </span>
            <span
              className={`font-bold ${
                monthly.budgetUtilizationPct > 100
                  ? "text-rose-400"
                  : monthly.budgetUtilizationPct > 85
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {monthly.budgetUtilizationPct.toFixed(0)}%
            </span>
          </div>
          <div className="text-base font-bold text-amber-300 tracking-tight">
            {formatVal(monthly.normalLivingSpendLkr, true)}
          </div>
          <div className="text-[8.5px] text-slate-400 mt-0.5">
            Cap: {formatVal(monthly.baselineBudgetLkr, true)}
          </div>
        </div>

        {/* 5. Monthly Solar & Bot ROI */}
        <div className="bg-[#070b1c]/90 border border-[#17234d] border-t border-t-white/10 rounded-md p-2.5">
          <div className="flex items-center justify-between text-[8.5px] text-slate-400 uppercase mb-1">
            <span className="flex items-center gap-1 text-cyan-300 font-bold">
              <Sun className="h-3 w-3 text-amber-400" />
              Solar &amp; Bot MTD
            </span>
            <span className="text-cyan-400 font-bold">
              WR {monthly.botWinRatePct.toFixed(0)}%
            </span>
          </div>
          <div className="text-base font-bold text-amber-300 tracking-tight">
            {monthly.solarMtdKwh.toFixed(0)} kWh{" "}
            <span className="text-[10px] text-emerald-400 font-normal">
              ({formatLKR(monthly.solarMtdRevenueLkr, true)})
            </span>
          </div>
          <div className="text-[8.5px] text-slate-400 mt-0.5">
            Bot MTD:{" "}
            <strong
              className={
                monthly.botMtdRealizedPnlUsdt >= 0 ? "text-emerald-400" : "text-rose-400"
              }
            >
              {monthly.botMtdRealizedPnlUsdt >= 0
                ? `+${formatUSD(monthly.botMtdRealizedPnlUsdt)}`
                : `-${formatUSD(Math.abs(monthly.botMtdRealizedPnlUsdt))}`}
            </strong>
          </div>
        </div>

        {/* 6. Monthly Biometric Trend */}
        <div className="bg-[#041615]/90 border border-[#0d3b38] border-t border-t-white/10 rounded-md p-2.5">
          <div className="flex items-center justify-between text-[8.5px] text-slate-400 uppercase mb-1">
            <span className="flex items-center gap-1 text-teal-300 font-bold">
              <Scale className="h-3 w-3 text-teal-400" />
              Biometric MTD
            </span>
            <span className="text-slate-400">
              Goal &lt;{monthly.hba1cTarget}%
            </span>
          </div>
          <div
            className={`text-base font-bold tracking-tight ${
              monthly.weightDeltaMtdKg <= 0 ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {monthly.weightDeltaMtdKg > 0
              ? `+${monthly.weightDeltaMtdKg.toFixed(1)}`
              : monthly.weightDeltaMtdKg.toFixed(1)}{" "}
            kg MTD
          </div>
          <div className="text-[8.5px] text-slate-400 mt-0.5">
            HbA1c:{" "}
            <strong
              className={
                monthly.hba1cCurrent <= monthly.hba1cTarget
                  ? "text-emerald-400"
                  : "text-amber-300"
              }
            >
              {monthly.hba1cCurrent.toFixed(1)}%
            </strong>{" "}
            / {monthly.hba1cTarget.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* ── DAILY BURN RUN-RATE (AREA CHART) + MATURITY RADAR PANEL ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5">
        {/* Daily Spend Burn Rate vs. Linear Run-Rate */}
        <div className="xl:col-span-5 bg-[#090b0e] border border-[#161b22] border-t border-t-white/10 rounded-md p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#161b22] text-xs font-mono">
            <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
              Daily Spend Burn Rate vs. Linear Run-Rate
            </span>
            <span className="text-amber-400 font-bold">
              {spendIncome.budgetUtilizationPct}% OF BASELINE
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spendIncome.dailyBurnRunRate}>
                <CartesianGrid strokeDasharray="2 2" stroke="#161b22" />
                <XAxis
                  dataKey="day"
                  stroke="#4b5563"
                  tick={{ fontSize: 10, fontFamily: "monospace" }}
                />
                <YAxis
                  stroke="#4b5563"
                  tick={{ fontSize: 10, fontFamily: "monospace" }}
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#06080b",
                    borderColor: "#1e2633",
                    borderRadius: "2px",
                    fontSize: "11px",
                    fontFamily: "monospace",
                  }}
                  formatter={(v) => [formatLKR(Number(v ?? 0)), ""]}
                />
                <Area
                  type="monotone"
                  dataKey="actualSpend"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  fillOpacity={0.15}
                  fill="#f59e0b"
                  name="Actual Spend"
                />
                <Line
                  type="monotone"
                  dataKey="idealBudgetTrajectory"
                  stroke="#64748b"
                  strokeDasharray="3 3"
                  dot={false}
                  strokeWidth={1}
                  name="Budget Cap"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fixed Income & Treasury Maturity Radar */}
        <div id="maturity-radar" className="xl:col-span-7">
          <MaturityRadarPanel items={investments.maturityRadar} onRefresh={onRefreshAll} />
        </div>
      </div>

      {/* ── TABBED / EXPANDABLE DEEP-DIVE DOMAIN BAYS ── */}
      <div className="bg-[#090b0e] border border-[#1a2230] border-t border-t-white/10 rounded-md p-2.5 space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-[#161b22]">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-200">
              DEEP-DIVE DOMAIN BAYS (FULL TELEMETRY &amp; SYNC MODALS)
            </span>
          </div>

          <div className="flex items-center gap-1 flex-wrap font-mono text-[9px]">
            {(
              [
                { key: "all", label: "ALL BAYS" },
                { key: "finance", label: "FINANCE & EQUITIES" },
                { key: "spend", label: "CASHFLOW & SPEND" },
                { key: "biometrics", label: "BIOMETRICS MTD" },
                { key: "grid", label: "GRID & FLEET" },
                { key: "bot_ops", label: "BOT & OPS" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setBayTab(tab.key)}
                className={`px-2 py-0.5 rounded-sm font-bold border transition-colors ${
                  activeBayTab === tab.key
                    ? "bg-indigo-600 text-white border-indigo-400"
                    : "bg-[#0d1117] text-slate-400 hover:text-slate-200 border-[#1e2633]"
                }`}
              >
                {tab.label}
              </button>
            ))}

            <button
              onClick={() => setBaysExpanded((v) => !v)}
              className="ml-1 px-2 py-0.5 rounded-sm bg-[#0d1117] hover:bg-[#161b22] border border-[#1e2633] text-slate-300 font-bold flex items-center gap-1"
              title={baysExpanded ? "Collapse domain bays" : "Expand domain bays"}
            >
              {baysExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  <span>HIDE</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  <span>EXPAND</span>
                </>
              )}
            </button>
          </div>
        </div>

        {baysExpanded && (
          <div className="space-y-2.5">
            {activeBayTab === "all" && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
                  <div className="lg:col-span-6 h-full min-h-[460px]">
                    <FinancialBay
                      finance={finance}
                      currency={currency}
                      onToggleCurrency={onToggleCurrency}
                      onRefresh={() => onRefreshZone("zone1")}
                      isRefreshing={!!zoneRefreshing.zone1}
                    />
                  </div>
                  <div className="lg:col-span-6 h-full min-h-[460px]">
                    <SpendIncomeBay
                      spendIncome={spendIncome}
                      currency={currency}
                      onRefresh={() => onRefreshZone("zone2")}
                      isRefreshing={!!zoneRefreshing.zone2}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-2.5">
                  <div className="lg:col-span-4 h-full min-h-[380px]">
                    <BiometricsBay
                      health={health}
                      onRefresh={() => onRefreshZone("zone3")}
                      isRefreshing={!!zoneRefreshing.zone3}
                    />
                  </div>
                  <div className="lg:col-span-4 h-full min-h-[380px]">
                    <GridFleetBay
                      gridFleet={gridFleet}
                      onRefresh={() => onRefreshZone("zone4")}
                      isRefreshing={!!zoneRefreshing.zone4}
                    />
                  </div>
                  <div className="lg:col-span-4 h-full min-h-[380px]">
                    <TradingBotBay
                      bot={bot}
                      onRefresh={() => onRefreshZone("zone5")}
                      isRefreshing={!!zoneRefreshing.zone5}
                    />
                  </div>
                </div>

                <OpsBar
                  bot={bot}
                  tasks={sprintTasks}
                  health={health}
                  gridFleet={gridFleet}
                  investments={investments}
                  spendIncome={spendIncome}
                  finance={finance}
                  onGlobalSync={onRefreshAll}
                  refreshing={refreshing}
                  onRefresh={() => onRefreshZone("zone6")}
                  isRefreshing={!!zoneRefreshing.zone6}
                />
              </>
            )}

            {activeBayTab === "finance" && (
              <FinancialBay
                finance={finance}
                currency={currency}
                onToggleCurrency={onToggleCurrency}
                onRefresh={() => onRefreshZone("zone1")}
                isRefreshing={!!zoneRefreshing.zone1}
              />
            )}

            {activeBayTab === "spend" && (
              <SpendIncomeBay
                spendIncome={spendIncome}
                currency={currency}
                onRefresh={() => onRefreshZone("zone2")}
                isRefreshing={!!zoneRefreshing.zone2}
              />
            )}

            {activeBayTab === "biometrics" && (
              <BiometricsBay
                health={health}
                onRefresh={() => onRefreshZone("zone3")}
                isRefreshing={!!zoneRefreshing.zone3}
              />
            )}

            {activeBayTab === "grid" && (
              <GridFleetBay
                gridFleet={gridFleet}
                onRefresh={() => onRefreshZone("zone4")}
                isRefreshing={!!zoneRefreshing.zone4}
              />
            )}

            {activeBayTab === "bot_ops" && (
              <div className="space-y-2.5">
                <TradingBotBay
                  bot={bot}
                  onRefresh={() => onRefreshZone("zone5")}
                  isRefreshing={!!zoneRefreshing.zone5}
                />
                <OpsBar
                  bot={bot}
                  tasks={sprintTasks}
                  health={health}
                  gridFleet={gridFleet}
                  investments={investments}
                  spendIncome={spendIncome}
                  finance={finance}
                  onGlobalSync={onRefreshAll}
                  refreshing={refreshing}
                  onRefresh={() => onRefreshZone("zone6")}
                  isRefreshing={!!zoneRefreshing.zone6}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
