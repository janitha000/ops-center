"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Clock, Mail } from "lucide-react";
import {
  AreaChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ComposedChart,
  Line,
} from "recharts";
import { OpsDashboardPayload } from "@/lib/types";
import { formatLKR } from "@/lib/utils";
import { evaluateTemporalOps } from "@/lib/decisions/engine";
import { DecisionHorizon, DecisionSignal } from "@/lib/decisions/types";
import { PinLockScreen } from "@/components/auth/PinLockScreen";
import { FinancialBay } from "@/components/dashboard/FinancialBay";
import { SpendIncomeBay } from "@/components/dashboard/SpendIncomeBay";
import { BiometricsBay } from "@/components/dashboard/BiometricsBay";
import { GridFleetBay } from "@/components/dashboard/GridFleetBay";
import { TradingBotBay } from "@/components/dashboard/TradingBotBay";
import { OpsBar } from "@/components/dashboard/OpsBar";
import { MaturityRadarPanel } from "@/components/dashboard/MaturityRadarPanel";
import { DecisionCommandStrip } from "@/components/dashboard/DecisionCommandStrip";
import { LiveHorizonSection } from "@/components/dashboard/LiveHorizonSection";
import { DailyHorizonSection } from "@/components/dashboard/DailyHorizonSection";
import {
  MonthlyHorizonSection,
  MonthlyBayTab,
} from "@/components/dashboard/MonthlyHorizonSection";
import { EmailDigestModal } from "@/components/dashboard/EmailDigestModal";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

type LayoutHorizonMode = "stream" | "live" | "daily" | "monthly" | "classic";

interface EndpointSyncCheck {
  name: string;
  timestamp?: string | null;
  ageMs: number;
  isSynced: boolean;
  ageLabel: string;
}

export interface ZoneSyncStatus {
  id: string;
  zoneKey: "zone1" | "zone2" | "zone3" | "zone4" | "zone5" | "zone6";
  label: string;
  fullName: string;
  isSynced: boolean;
  furthestEndpoint: EndpointSyncCheck;
  endpoints: EndpointSyncCheck[];
}

function evaluateEndpoint(name: string, timestamp?: string | null): EndpointSyncCheck {
  if (!timestamp) {
    return {
      name,
      timestamp: null,
      ageMs: Infinity,
      isSynced: false,
      ageLabel: "No sync record",
    };
  }

  const time = new Date(timestamp).getTime();
  if (isNaN(time)) {
    return {
      name,
      timestamp,
      ageMs: Infinity,
      isSynced: false,
      ageLabel: "Invalid timestamp",
    };
  }

  const ageMs = Math.max(0, Date.now() - time);
  const isSynced = ageMs <= THREE_HOURS_MS;

  const minutes = Math.floor(ageMs / 60000);
  let ageLabel = "";
  if (minutes < 1) {
    ageLabel = "Just now";
  } else if (minutes < 60) {
    ageLabel = `${minutes}m ago`;
  } else {
    const hours = (ageMs / 3600000).toFixed(1);
    ageLabel = `${hours}h ago`;
  }

  return {
    name,
    timestamp,
    ageMs,
    isSynced,
    ageLabel,
  };
}

function calculateZoneSyncStatus(data: OpsDashboardPayload | null): ZoneSyncStatus[] {
  if (!data) return [];

  const resolveZone = (
    id: string,
    zoneKey: "zone1" | "zone2" | "zone3" | "zone4" | "zone5" | "zone6",
    label: string,
    fullName: string,
    endpoints: EndpointSyncCheck[],
    extraCondition = true
  ): ZoneSyncStatus => {
    let furthest = endpoints[0];
    for (const ep of endpoints) {
      if (ep.ageMs > furthest.ageMs) {
        furthest = ep;
      }
    }

    const allEndpointsSynced = endpoints.every((ep) => ep.isSynced);
    const isSynced = allEndpointsSynced && extraCondition;

    return {
      id,
      zoneKey,
      label,
      fullName,
      isSynced,
      furthestEndpoint: furthest,
      endpoints,
    };
  };

  // ZONE 1: Financial & Equities Bay
  const z1 = resolveZone(
    "z1",
    "zone1",
    "Z1: FINANCE",
    "Zone 1: Financial & Equities Bay",
    [
      evaluateEndpoint("LankaWealth Net Worth", data.finance?.lastUpdated),
      evaluateEndpoint("Investor DB Holdings", data.investments?.lastUpdated),
      evaluateEndpoint("PAL CSE Stocks", data.finance?.stocks?.lastPalSync),
    ]
  );

  // ZONE 2: Spendings & Income Bay
  const z2 = resolveZone(
    "z2",
    "zone2",
    "Z2: CASH FLOW",
    "Zone 2: Spendings & Income Bay",
    [evaluateEndpoint("Expense & Cashflow DB", data.spendIncome?.lastUpdated)]
  );

  // ZONE 3: Metabolic & Biometric Bay
  const z3 = resolveZone(
    "z3",
    "zone3",
    "Z3: BIOMETRIC",
    "Zone 3: Metabolic & Biometric Bay",
    [evaluateEndpoint("Calorie & Nutrition DB", data.health?.lastUpdated)]
  );

  // ZONE 4: Fleet & Renewable Grid Bay
  const z4 = resolveZone(
    "z4",
    "zone4",
    "Z4: GRID & FLEET",
    "Zone 4: Fleet & Renewable Grid",
    [
      evaluateEndpoint("FusionSolar Inverter", data.gridFleet?.solar?.lastSynced),
      evaluateEndpoint("BYD Vehicle Pod", data.gridFleet?.fleet?.lastSynced),
    ]
  );

  // ZONE 5: Algorithmic Trading Bot Bay
  const botOnline = data.bot?.sourceStatus !== "offline" && data.bot?.isRunning !== false;
  const z5 = resolveZone(
    "z5",
    "zone5",
    "Z5: TRADING BOT",
    "Zone 5: Algorithmic Trading Bot",
    [evaluateEndpoint("AWS EC2 Trading Daemon", data.bot?.lastUpdated)],
    botOnline
  );

  // ZONE 6: Mission Control & Ops Bay
  const z6 = resolveZone(
    "z6",
    "zone6",
    "Z6: MISSION CTRL",
    "Zone 6: Mission Control & Ops Bay",
    [evaluateEndpoint("Ops Mission Telemetry", data.timestamp)]
  );

  return [z1, z2, z3, z4, z5, z6];
}

export default function OperationsDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [data, setData] = useState<OpsDashboardPayload | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutHorizonMode>("stream");
  const [decisionFilter, setDecisionFilter] = useState<"all" | DecisionHorizon>("all");
  const [monthlyBayTab, setMonthlyBayTab] = useState<MonthlyBayTab>("all");
  const [currency, setCurrency] = useState<"LKR" | "USD">("LKR");
  const [minPrices, setMinPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoneRefreshing, setZoneRefreshing] = useState<Record<string, boolean>>({});
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isDigestModalOpen, setIsDigestModalOpen] = useState(false);
  const [evOverridden, setEvOverridden] = useState(false);
  const [botPaused, setBotPaused] = useState(false);

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

  // Hydrate stock min prices for temporal decision engine
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const cached = localStorage.getItem("ops_stock_min_prices_v1");
        if (cached) {
          setMinPrices(JSON.parse(cached));
        }
      } catch {
        // ignore
      }
    });

    fetch("/api/ops/stocks/min-targets")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success && json.minPrices) {
          setMinPrices(json.minPrices);
          try {
            localStorage.setItem("ops_stock_min_prices_v1", JSON.stringify(json.minPrices));
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // ignore optional min targets error
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Fetch sync payload
  const fetchSyncData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/ops/sync", { cache: "no-store" });
      if (res.ok) {
        const json: OpsDashboardPayload = await res.json();
        setData(json);
        if (json.gridFleet?.fleet?.isCharging !== undefined) {
          setEvOverridden(json.gridFleet.fleet.isCharging);
        }
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Per-zone selective refresh callback
  const handleRefreshZone = useCallback(
    async (zoneKey: "zone1" | "zone2" | "zone3" | "zone4" | "zone5" | "zone6") => {
      setZoneRefreshing((prev) => ({ ...prev, [zoneKey]: true }));
      try {
        const res = await fetch(`/api/ops/sync?zone=${zoneKey}`, { cache: "no-store" });
        if (res.ok) {
          const partial = await res.json();
          setData((prev) => (prev ? { ...prev, ...partial } : prev));
        }
      } catch (err) {
        console.error(`Error refreshing ${zoneKey}:`, err);
      } finally {
        setZoneRefreshing((prev) => ({ ...prev, [zoneKey]: false }));
      }
    },
    []
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        fetchSyncData();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, fetchSyncData]);

  // Auto-poll solar telemetry (zone4) every 60s while tab is visible
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        handleRefreshZone("zone4");
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, handleRefreshZone]);

  // Calculate live zone synchronization telemetry unconditionally at the top level
  const zoneSyncStatuses = useMemo(() => {
    void currentTime;
    return calculateZoneSyncStatus(data);
  }, [data, currentTime]);

  // Evaluate temporal decision & horizon model
  const temporalModel = useMemo(
    () => (data ? evaluateTemporalOps(data, minPrices) : null),
    [data, minPrices]
  );

  // Sync decision command filter when user switches single-horizon views
  const handleLayoutModeChange = (mode: LayoutHorizonMode) => {
    setLayoutMode(mode);
    if (mode === "live" || mode === "daily" || mode === "monthly") {
      setDecisionFilter(mode);
    } else {
      setDecisionFilter("all");
    }
  };

  // Handle 1-click actions from DecisionCommandStrip
  const handleDecisionAction = useCallback(
    (signal: DecisionSignal) => {
      if (signal.actionType === "refresh_zone" && signal.targetZone) {
        handleRefreshZone(signal.targetZone);
        return;
      }
      if (signal.actionType === "toggle_ev") {
        setEvOverridden((v) => !v);
        return;
      }
      if (signal.actionType === "toggle_bot") {
        setBotPaused((v) => !v);
        return;
      }
      if (signal.actionType === "review_maturity") {
        if (layoutMode !== "stream" && layoutMode !== "monthly") {
          setLayoutMode("monthly");
          setDecisionFilter("monthly");
        }
        setTimeout(() => {
          document.getElementById("maturity-radar")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        return;
      }
      if (signal.actionType === "open_tab") {
        if (layoutMode !== "stream" && layoutMode !== "monthly") {
          setLayoutMode("monthly");
          setDecisionFilter("monthly");
        }
        const zoneToTab: Record<string, MonthlyBayTab> = {
          zone1: "finance",
          zone2: "spend",
          zone3: "biometrics",
          zone4: "grid",
          zone5: "bot_ops",
          zone6: "bot_ops",
        };
        if (signal.targetZone && zoneToTab[signal.targetZone]) {
          setMonthlyBayTab(zoneToTab[signal.targetZone]);
        }
      }
    },
    [handleRefreshZone, layoutMode]
  );

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

  if (loading || !data || !temporalModel) {
    return (
      <div className="min-h-screen bg-[#090b0e] flex flex-col items-center justify-center gap-2 font-mono text-xs text-slate-400">
        <RefreshCw className="h-5 w-5 text-cyan-400 animate-spin" />
        <span>SYNCING DOMAIN ZONES (5 DAEMONS)...</span>
      </div>
    );
  }

  const {
    health,
    spendIncome,
    finance,
    investments,
    bot,
    gridFleet,
    sprintTasks,
    crossDomain,
  } = data;

  return (
    <div className="min-h-screen bg-[#090b0e] text-[#e6edf3] font-sans antialiased selection:bg-cyan-500 selection:text-slate-950 pb-10">
      {/* ── HIGH-DENSITY SYSTEM OPS BAR (TOP) ── */}
      <header className="border-b border-[#161b22] bg-[#06080b] px-3 py-2 sticky top-0 z-40">
        <div className="max-w-[1720px] mx-auto space-y-2">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
            {/* Brand & Live Clock */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-100 tracking-wider">
                <span className="h-2 w-2 bg-emerald-500 rounded-none inline-block animate-pulse" />
                OPS Center
              </div>
              <span className="text-[10px] font-mono text-slate-600 hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-cyan-400 font-medium">
                <Clock className="h-3 w-3 text-cyan-400/80" />
                <span>{currentTime}</span>
              </div>
            </div>

            {/* ── ZONE SYNC HEALTH TELEMETRY PILLS (Z1 - Z6) ── */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {zoneSyncStatuses.map((z) => (
                <button
                  key={z.id}
                  onClick={() => handleRefreshZone(z.zoneKey)}
                  disabled={zoneRefreshing[z.zoneKey]}
                  title={`${z.fullName}\nStatus: ${
                    z.isSynced ? "SYNCED (≤3h threshold)" : "OUT OF SYNC (>3h or stale endpoint)"
                  }\nFurthest Source: ${z.furthestEndpoint.name} (${
                    z.furthestEndpoint.ageLabel
                  })\n\nTelemetry Endpoints:\n${z.endpoints
                    .map((e) => `• ${e.name}: ${e.ageLabel} [${e.isSynced ? "SYNCED" : "DESYNC"}]`)
                    .join("\n")}\n\nClick to selectively refresh ${z.label}`}
                  className={`group relative flex items-center gap-1.5 px-2 py-0.5 rounded-sm border font-mono text-[10px] transition-all cursor-pointer ${
                    z.isSynced
                      ? "bg-[#041a12] border-emerald-800/80 text-emerald-300 hover:bg-[#062419] hover:border-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.12)]"
                      : "bg-[#20080d] border-rose-800/90 text-rose-300 hover:bg-[#2c0b12] hover:border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.22)]"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    {zoneRefreshing[z.zoneKey] ? (
                      <RefreshCw className="h-2 w-2 text-cyan-400 animate-spin" />
                    ) : z.isSynced ? (
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    ) : (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                      </>
                    )}
                  </span>

                  <span className="font-bold tracking-tight text-slate-200 group-hover:text-white">
                    {z.label}
                  </span>

                  <span
                    className={`px-1 py-[0.5px] text-[8px] font-black tracking-wider rounded-2xs uppercase ${
                      z.isSynced
                        ? "bg-emerald-950 border border-emerald-700/60 text-emerald-300"
                        : "bg-rose-950 border border-rose-700/80 text-rose-300 animate-pulse"
                    }`}
                  >
                    {z.isSynced ? "SYNCED" : "DESYNC"}
                  </span>

                  <span className="text-[9px] text-slate-400 group-hover:text-slate-200 hidden 2xl:inline">
                    {z.furthestEndpoint.ageLabel}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick Controls + Mail Digest */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDigestModalOpen(true)}
                className="px-2 py-0.5 rounded-sm font-mono text-[10px] font-bold bg-cyan-950/80 border border-cyan-700/70 text-cyan-300 hover:bg-cyan-900/90 hover:text-white transition-colors flex items-center gap-1.5"
                title="Preview and dispatch Executive Daily / Monthly Email Digest"
              >
                <Mail className="h-3 w-3" />
                <span>MAIL DIGEST</span>
              </button>

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
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* ── LAYOUT HORIZON SWITCHER BAR ── */}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#12161d] font-mono text-[9.5px] flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[8.5px] uppercase tracking-wider text-slate-500 font-bold mr-1">
                HORIZON VIEW:
              </span>
              {(
                [
                  { key: "stream", label: "STREAM (LIVE → DAILY → MONTHLY)" },
                  { key: "live", label: "LIVE" },
                  { key: "daily", label: "DAILY" },
                  { key: "monthly", label: "MONTHLY" },
                  { key: "classic", label: "CLASSIC BAYS" },
                ] as const
              ).map((m) => {
                const active = layoutMode === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => handleLayoutModeChange(m.key)}
                    className={`px-2 py-0.5 rounded-sm font-bold border transition-colors ${
                      active
                        ? m.key === "live"
                          ? "bg-rose-600/90 text-white border-rose-400"
                          : m.key === "daily"
                          ? "bg-amber-600/90 text-slate-950 border-amber-400"
                          : m.key === "monthly"
                          ? "bg-indigo-600 text-white border-indigo-400"
                          : "bg-cyan-600 text-white border-cyan-400"
                        : "bg-[#0d1117] text-slate-400 hover:text-slate-200 border-[#1e2633]"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="text-[9px] text-slate-500 hidden lg:flex items-center gap-2">
              <span>
                SIGNALS:{" "}
                <strong className="text-rose-400">{temporalModel.decisions.criticalCount} CRIT</strong>{" "}
                ·{" "}
                <strong className="text-amber-400">{temporalModel.decisions.warningCount} WARN</strong>{" "}
                ·{" "}
                <strong className="text-emerald-400">
                  {temporalModel.decisions.opportunityCount} OPP
                </strong>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN TEMPORAL OR CLASSIC TELEMETRY MATRIX ── */}
      <main className="max-w-[1720px] mx-auto p-2.5 sm:p-3 space-y-3">
        {/* TIER 0: DECISION COMMAND STRIP (ALWAYS ON TOP) */}
        <DecisionCommandStrip
          decisions={temporalModel.decisions}
          horizonFilter={decisionFilter}
          onHorizonFilterChange={setDecisionFilter}
          onAction={handleDecisionAction}
          zoneRefreshing={zoneRefreshing}
        />

        {/* TEMPORAL STREAM / HORIZON VIEWS */}
        {layoutMode !== "classic" ? (
          <>
            {(layoutMode === "stream" || layoutMode === "live") && (
              <LiveHorizonSection
                payload={data}
                live={temporalModel.live}
                minPrices={minPrices}
                onRefreshZone={handleRefreshZone}
                zoneRefreshing={zoneRefreshing}
                evOverridden={evOverridden}
                onToggleEvOverride={() => setEvOverridden((v) => !v)}
                botPaused={botPaused}
                onToggleBotPaused={() => setBotPaused((v) => !v)}
              />
            )}

            {(layoutMode === "stream" || layoutMode === "daily") && (
              <DailyHorizonSection
                payload={data}
                daily={temporalModel.daily}
                currency={currency}
                onRefreshZone={handleRefreshZone}
                zoneRefreshing={zoneRefreshing}
              />
            )}

            {(layoutMode === "stream" || layoutMode === "monthly") && (
              <MonthlyHorizonSection
                payload={data}
                monthly={temporalModel.monthly}
                currency={currency}
                onToggleCurrency={() => setCurrency((c) => (c === "LKR" ? "USD" : "LKR"))}
                onRefreshAll={fetchSyncData}
                refreshing={refreshing}
                onRefreshZone={handleRefreshZone}
                zoneRefreshing={zoneRefreshing}
                activeBayTab={monthlyBayTab}
                onBayTabChange={setMonthlyBayTab}
              />
            )}
          </>
        ) : (
          /* CLASSIC BAYS VIEW */
          <div className="space-y-2.5">
            {/* ROW 1: PRIMARY DOMAIN BAYS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              <div className="lg:col-span-6 h-full min-h-[460px]">
                <FinancialBay
                  finance={finance}
                  currency={currency}
                  onToggleCurrency={() => setCurrency((c) => (c === "LKR" ? "USD" : "LKR"))}
                  onRefresh={() => handleRefreshZone("zone1")}
                  isRefreshing={!!zoneRefreshing.zone1}
                />
              </div>

              <div className="lg:col-span-6 h-full min-h-[460px]">
                <SpendIncomeBay
                  spendIncome={spendIncome}
                  currency={currency}
                  onRefresh={() => handleRefreshZone("zone2")}
                  isRefreshing={!!zoneRefreshing.zone2}
                />
              </div>
            </div>

            {/* ROW 2: BIOMETRICS, FLEET/GRID & ALGORITHMIC TRADING BOT */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-2.5">
              <div className="lg:col-span-4 h-full min-h-[380px]">
                <BiometricsBay
                  health={health}
                  onRefresh={() => handleRefreshZone("zone3")}
                  isRefreshing={!!zoneRefreshing.zone3}
                />
              </div>

              <div className="lg:col-span-4 h-full min-h-[380px]">
                <GridFleetBay
                  gridFleet={gridFleet}
                  onRefresh={() => handleRefreshZone("zone4")}
                  isRefreshing={!!zoneRefreshing.zone4}
                />
              </div>

              <div className="lg:col-span-4 h-full min-h-[380px]">
                <TradingBotBay
                  bot={bot}
                  onRefresh={() => handleRefreshZone("zone5")}
                  isRefreshing={!!zoneRefreshing.zone5}
                />
              </div>
            </div>

            {/* ZONE 6: MISSION CONTROL & OPS BAY */}
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

            {/* ROW 3: FIXED INCOME & TREASURY MATURITY RADAR */}
            <div id="maturity-radar">
              <MaturityRadarPanel items={investments.maturityRadar} onRefresh={fetchSyncData} />
            </div>

            {/* ROW 4: INDUSTRIAL TELEMETRY CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <div className="bg-[#090b0e] border border-[#161b22] border-t border-t-white/10 rounded-md p-3">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#161b22] text-xs font-mono">
                  <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                    Daily Spend Burn Rate vs. Linear Run-Rate
                  </span>
                  <span className="text-amber-400 font-bold">
                    {spendIncome.budgetUtilizationPct}% OF BASELINE
                  </span>
                </div>

                <div className="h-44 w-full">
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

              <div className="bg-[#090b0e] border border-[#161b22] border-t border-t-white/10 rounded-md p-3">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#161b22] text-xs font-mono">
                  <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                    Lifestyle Dining Spend vs. Caloric &amp; Sugar Intake (7D)
                  </span>
                  <span className="text-rose-400 font-bold">CROSS-DOMAIN CORRELATION</span>
                </div>

                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={crossDomain.foodSpendVsCalorieCorrelation}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#161b22" />
                      <XAxis
                        dataKey="date"
                        stroke="#4b5563"
                        tick={{ fontSize: 10, fontFamily: "monospace" }}
                        tickFormatter={(d) => d.slice(5)}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="#4b5563"
                        tick={{ fontSize: 10, fontFamily: "monospace" }}
                        tickFormatter={(v) => `${v}k`}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
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
                      />
                      <Legend wrapperStyle={{ fontSize: "10px", fontFamily: "monospace" }} />
                      <Bar
                        yAxisId="right"
                        dataKey="diningSpend"
                        fill="#3b82f6"
                        opacity={0.6}
                        barSize={16}
                        name="Dining LKR"
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="calories"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        name="Calories"
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="sugar"
                        stroke="#f43f5e"
                        strokeWidth={1.5}
                        strokeDasharray="2 2"
                        name="Sugar (g)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Executive Mail Digest Modal */}
      <EmailDigestModal
        isOpen={isDigestModalOpen}
        onClose={() => setIsDigestModalOpen(false)}
      />
    </div>
  );
}
