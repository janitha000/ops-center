"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Zap,
  RefreshCw,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import {
  DecisionHorizon,
  DecisionSignal,
  TemporalDashboardModel,
} from "@/lib/decisions/types";

interface DecisionCommandStripProps {
  decisions: TemporalDashboardModel["decisions"];
  horizonFilter?: "all" | DecisionHorizon;
  onHorizonFilterChange?: (filter: "all" | DecisionHorizon) => void;
  onAction?: (signal: DecisionSignal) => void;
  zoneRefreshing?: Record<string, boolean>;
}

const ACK_STORAGE_KEY = "lifeops_ack_decisions_v2";

interface AckRecord {
  signalId: string;
  horizon: DecisionHorizon;
  ackCount: number;
  ackDate: string | null;
  ackMonth: string | null;
  ackForever: boolean;
  isCurrentlySuppressed: boolean;
  canAckForever: boolean;
}

function getSltTodayAndMonth() {
  const slt = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const currentMonth = `${slt.getUTCFullYear()}-${String(slt.getUTCMonth() + 1).padStart(2, "0")}`;
  const todayIso = `${currentMonth}-${String(slt.getUTCDate()).padStart(2, "0")}`;
  return { todayIso, currentMonth };
}

const HORIZON_BADGE_STYLES: Record<DecisionHorizon, string> = {
  live: "bg-rose-950/90 text-rose-300 border-rose-700/80",
  daily: "bg-amber-950/80 text-amber-300 border-amber-700/70",
  monthly: "bg-indigo-950/80 text-indigo-300 border-indigo-700/70",
};

const SEVERITY_CARD_STYLES: Record<DecisionSignal["severity"], string> = {
  critical: "bg-[#19080d]/90 border-rose-800/80 shadow-[0_0_12px_rgba(244,63,94,0.12)]",
  warning: "bg-[#171105]/90 border-amber-800/70",
  opportunity: "bg-[#051814]/90 border-emerald-800/70",
  nominal: "bg-[#0b0e14]/90 border-[#1e2633]",
};

const SEVERITY_PILL_STYLES: Record<DecisionSignal["severity"], string> = {
  critical: "text-rose-300 bg-rose-950 border-rose-700/80",
  warning: "text-amber-300 bg-amber-950 border-amber-700/70",
  opportunity: "text-emerald-300 bg-emerald-950 border-emerald-700/70",
  nominal: "text-cyan-300 bg-cyan-950 border-cyan-800/60",
};

export function DecisionCommandStrip({
  decisions,
  horizonFilter: controlledFilter,
  onHorizonFilterChange,
  onAction,
  zoneRefreshing = {},
}: DecisionCommandStripProps) {
  const [internalFilter, setInternalFilter] = useState<"all" | DecisionHorizon>("all");
  const [ackRecords, setAckRecords] = useState<Record<string, AckRecord>>({});
  const [showAll, setShowAll] = useState(false);

  const activeFilter = controlledFilter ?? internalFilter;
  const setFilter = (f: "all" | DecisionHorizon) => {
    setInternalFilter(f);
    onHorizonFilterChange?.(f);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(ACK_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            setAckRecords(parsed);
          }
        }
      } catch {
        // ignore localStorage read errors
      }
    });

    fetch("/api/ops/acks", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json?.success || !Array.isArray(json.records)) return;
        const map: Record<string, AckRecord> = {};
        for (const rec of json.records as AckRecord[]) {
          map[rec.signalId] = rec;
        }
        setAckRecords(map);
        try {
          localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(map));
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // offline fallback uses localStorage cache
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistMap = (next: Record<string, AckRecord>) => {
    setAckRecords(next);
    try {
      localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore localStorage write errors
    }
  };

  const handleAcknowledge = async (
    signal: DecisionSignal,
    mode: "period" | "forever" = "period"
  ) => {
    const { todayIso, currentMonth } = getSltTodayAndMonth();
    const existing = ackRecords[signal.id];
    const nextCount = (existing?.ackCount ?? 0) + 1;
    const allowForever =
      signal.horizon === "daily" && mode === "forever" && (existing?.ackCount ?? 0) >= 3;

    const optimistic: AckRecord = {
      signalId: signal.id,
      horizon: signal.horizon,
      ackCount: allowForever ? existing?.ackCount ?? nextCount : nextCount,
      ackDate: signal.horizon === "monthly" ? null : todayIso,
      ackMonth: signal.horizon === "monthly" ? currentMonth : null,
      ackForever: allowForever,
      isCurrentlySuppressed: true,
      canAckForever: signal.horizon === "daily" && nextCount >= 3,
    };
    persistMap({ ...ackRecords, [signal.id]: optimistic });

    try {
      const res = await fetch("/api/ops/acks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId: signal.id, horizon: signal.horizon, mode }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.records)) {
          const map: Record<string, AckRecord> = {};
          for (const rec of json.records as AckRecord[]) {
            map[rec.signalId] = rec;
          }
          persistMap(map);
        }
      }
    } catch {
      // optimistic state kept in localStorage
    }
  };

  const handleResetAck = async () => {
    const cleared: Record<string, AckRecord> = {};
    for (const [id, rec] of Object.entries(ackRecords)) {
      cleared[id] = {
        ...rec,
        ackDate: null,
        ackMonth: null,
        ackForever: false,
        isCurrentlySuppressed: false,
      };
    }
    persistMap(cleared);

    try {
      await fetch("/api/ops/acks", { method: "DELETE" });
    } catch {
      // ignore
    }
  };

  const pool = useMemo(() => {
    if (activeFilter === "all") return decisions.all;
    return decisions.byHorizon[activeFilter] || [];
  }, [decisions, activeFilter]);

  const unacknowledged = useMemo(() => {
    const { todayIso, currentMonth } = getSltTodayAndMonth();
    return pool.filter((s) => {
      const rec = ackRecords[s.id];
      if (!rec) return true;
      if (rec.horizon === "daily") {
        return !(rec.ackForever || rec.ackDate === todayIso);
      }
      if (rec.horizon === "monthly") {
        return rec.ackMonth !== currentMonth;
      }
      return rec.ackDate !== todayIso;
    });
  }, [pool, ackRecords]);

  const ackCountInPool = pool.length - unacknowledged.length;
  const visibleSignals = showAll ? unacknowledged : unacknowledged.slice(0, 6);

  const criticalCount = unacknowledged.filter((s) => s.severity === "critical").length;
  const warningCount = unacknowledged.filter((s) => s.severity === "warning").length;
  const opportunityCount = unacknowledged.filter((s) => s.severity === "opportunity").length;

  return (
    <section className="bg-[#090b0e] border border-[#1a2230] border-t border-t-white/10 rounded-md p-3">
      {/* ── TIER 0 HEADER BAR ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[#161b22]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
            <h2 className="text-[11px] font-mono font-bold tracking-wider uppercase text-slate-100">
              TIER 0 // DECISION COMMAND STRIP
            </h2>
          </div>

          {/* Severity Count Badges */}
          <div className="flex items-center gap-1.5 font-mono text-[9px]">
            <span className="px-1.5 py-0.5 rounded-sm font-bold bg-rose-950/90 text-rose-300 border border-rose-800/80">
              {criticalCount} CRITICAL
            </span>
            <span className="px-1.5 py-0.5 rounded-sm font-bold bg-amber-950/80 text-amber-300 border border-amber-800/70">
              {warningCount} WARNING
            </span>
            <span className="px-1.5 py-0.5 rounded-sm font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/70">
              {opportunityCount} OPPORTUNITY
            </span>
          </div>
        </div>

        {/* Horizon Filter Pills & Reset Ack */}
        <div className="flex items-center gap-1.5 flex-wrap font-mono text-[9px]">
          {(
            [
              { key: "all", label: `ALL (${decisions.all.length})` },
              { key: "live", label: `LIVE (${decisions.byHorizon.live.length})` },
              { key: "daily", label: `DAILY (${decisions.byHorizon.daily.length})` },
              { key: "monthly", label: `MONTHLY (${decisions.byHorizon.monthly.length})` },
            ] as const
          ).map((pill) => {
            const isActive = activeFilter === pill.key;
            return (
              <button
                key={pill.key}
                onClick={() => setFilter(pill.key)}
                className={`px-2 py-0.5 rounded-sm font-bold transition-all border ${
                  isActive
                    ? pill.key === "live"
                      ? "bg-rose-600/90 text-white border-rose-400"
                      : pill.key === "daily"
                      ? "bg-amber-600/90 text-slate-950 border-amber-400"
                      : pill.key === "monthly"
                      ? "bg-indigo-600 text-white border-indigo-400"
                      : "bg-cyan-600 text-white border-cyan-400"
                    : "bg-[#0d1117] text-slate-400 hover:text-slate-200 border-[#1e2633]"
                }`}
              >
                {pill.label}
              </button>
            );
          })}

          {ackCountInPool > 0 && (
            <button
              onClick={handleResetAck}
              className="ml-1 px-2 py-0.5 rounded-sm font-bold bg-[#0d1117] border border-[#1e2633] text-slate-400 hover:text-cyan-300 flex items-center gap-1"
              title="Restore acknowledged decision signals"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>RESTORE ({ackCountInPool})</span>
            </button>
          )}
        </div>
      </div>

      {/* ── SIGNAL CARDS GRID ── */}
      {visibleSignals.length === 0 ? (
        <div className="bg-[#06090e] border border-[#161b22] rounded-sm p-3 flex items-center justify-between font-mono text-[10px] text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              All signals in <strong className="text-slate-200 uppercase">{activeFilter}</strong> horizon are nominal or acknowledged.
            </span>
          </div>
          {ackCountInPool > 0 && (
            <button
              onClick={handleResetAck}
              className="px-2 py-0.5 rounded-sm bg-[#0d1117] border border-[#1e2633] text-cyan-400 hover:text-white font-bold"
            >
              Show {ackCountInPool} Dismissed
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {visibleSignals.map((sig) => {
              const isZoneRefreshing = sig.targetZone ? !!zoneRefreshing[sig.targetZone] : false;
              const hasPrimaryAction =
                sig.actionType && sig.actionType !== "acknowledge" && onAction;

              return (
                <div
                  key={sig.id}
                  className={`border border-t border-t-white/10 rounded-sm p-2.5 flex flex-col justify-between gap-2 transition-colors ${
                    SEVERITY_CARD_STYLES[sig.severity]
                  }`}
                >
                  <div>
                    {/* Top Tags Row */}
                    <div className="flex items-center justify-between gap-1.5 mb-1.5 font-mono text-[8.5px]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border font-bold uppercase ${
                            HORIZON_BADGE_STYLES[sig.horizon]
                          }`}
                        >
                          {sig.horizon === "live" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                          )}
                          {sig.horizon}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-sm bg-[#0d1117] border border-[#1e2633] text-cyan-300 font-bold">
                          {sig.domain}
                        </span>
                      </div>

                      <span
                        className={`px-1.5 py-0.5 rounded-sm border font-bold uppercase ${
                          SEVERITY_PILL_STYLES[sig.severity]
                        }`}
                      >
                        {sig.severity}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="flex items-start gap-1.5 mb-1.5">
                      {sig.severity === "critical" ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                      ) : sig.severity === "opportunity" ? (
                        <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <h3 className="text-xs font-mono font-bold text-slate-100 leading-snug">
                        {sig.title}
                      </h3>
                    </div>

                    {/* Current vs Threshold Metric Strip */}
                    <div className="grid grid-cols-2 gap-1.5 bg-[#06080b]/90 border border-[#161b22] rounded-sm px-2 py-1 mb-1.5 font-mono text-[9.5px]">
                      <div>
                        <span className="block text-[7.5px] uppercase text-slate-500">
                          {sig.metricLabel || "Current"}
                        </span>
                        <span className="font-bold text-slate-100">{sig.currentValue}</span>
                      </div>
                      <div className="border-l border-[#161b22] pl-2">
                        <span className="block text-[7.5px] uppercase text-slate-500">
                          Threshold / Target
                        </span>
                        <span className="font-semibold text-slate-400">{sig.thresholdValue}</span>
                      </div>
                    </div>

                    {/* Why It Matters & Recommended Action */}
                    <p className="text-[10px] text-slate-400 leading-relaxed mb-1">
                      <span className="font-mono text-[9px] uppercase text-slate-500 font-bold mr-1">
                        Why:
                      </span>
                      {sig.whyItMatters}
                    </p>
                    <p className="text-[10px] text-cyan-200/90 leading-relaxed">
                      <span className="font-mono text-[9px] uppercase text-cyan-400 font-bold mr-1">
                        Action:
                      </span>
                      {sig.recommendedAction}
                    </p>
                  </div>

                  {/* Action Footer */}
                  <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-white/5 font-mono text-[9px]">
                    {hasPrimaryAction ? (
                      <button
                        onClick={() => onAction(sig)}
                        disabled={isZoneRefreshing}
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-sm bg-cyan-950/80 hover:bg-cyan-900/90 border border-cyan-700/70 text-cyan-200 font-bold transition-colors disabled:opacity-50"
                      >
                        {sig.actionType === "refresh_zone" ? (
                          <RefreshCw
                            className={`h-2.5 w-2.5 ${isZoneRefreshing ? "animate-spin" : ""}`}
                          />
                        ) : (
                          <ArrowRight className="h-2.5 w-2.5" />
                        )}
                        <span>{sig.actionLabel || "EXECUTE ACTION"}</span>
                      </button>
                    ) : (
                      <span className="text-[8.5px] text-slate-500 uppercase">
                        Advisory Signal
                      </span>
                    )}

                    <button
                      onClick={() => handleAcknowledge(sig, "period")}
                      className="px-2 py-1 rounded-sm bg-[#0d1117] hover:bg-[#161b22] border border-[#1e2633] text-slate-300 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors"
                      title={
                        sig.horizon === "monthly"
                          ? "Ignore for the rest of this month"
                          : "Ignore for today only"
                      }
                    >
                      <Check className="h-2.5 w-2.5" />
                      <span>{sig.horizon === "monthly" ? "ACK MONTH" : "ACK TODAY"}</span>
                    </button>

                    {sig.horizon === "daily" && ackRecords[sig.id]?.canAckForever && (
                      <button
                        onClick={() => handleAcknowledge(sig, "forever")}
                        className="px-2 py-1 rounded-sm bg-rose-950/70 hover:bg-rose-900/80 border border-rose-700/70 text-rose-200 font-bold transition-colors"
                        title={`Acknowledged ${ackRecords[sig.id].ackCount} times — click to ignore forever`}
                      >
                        ∞ FOREVER
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {unacknowledged.length > 6 && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={() => setShowAll((prev) => !prev)}
                className="px-3 py-1 rounded-sm bg-[#0d1117] hover:bg-[#161b22] border border-[#1e2633] font-mono text-[9px] font-bold text-cyan-400"
              >
                {showAll
                  ? "SHOW TOP 6 SIGNALS"
                  : `SHOW ALL ${unacknowledged.length} SIGNALS (+${unacknowledged.length - 6})`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
