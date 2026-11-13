"use client";

import React, { useState } from "react";
import { Radar, AlertCircle, Calendar, Plus, Check, Clock } from "lucide-react";
import { MaturityRadarItem } from "@/lib/types";
import { formatLKR, formatUSD } from "@/lib/utils";

interface MaturityRadarPanelProps {
  items: MaturityRadarItem[];
  onRefresh: () => void;
}

export function MaturityRadarPanel({ items, onRefresh }: MaturityRadarPanelProps) {
  const [editingItem, setEditingItem] = useState<MaturityRadarItem | null>(null);
  const [maturityDate, setMaturityDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOpenEdit = (item: MaturityRadarItem) => {
    setEditingItem(item);
    setMaturityDate(item.maturityDate || "");
    setNotes("");
  };

  const handleSaveDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSaving(true);
    try {
      const res = await fetch("/api/ops/maturity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentId: editingItem.id,
          maturityDate,
          notes,
        }),
      });

      if (res.ok) {
        setEditingItem(null);
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to update instrument date:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#0b0e14] border border-[#161b22] border-t border-t-white/10 rounded-md p-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-[#161b22]">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <h3 className="text-[10px] font-semibold tracking-wider uppercase text-slate-300">
            Fixed Income &amp; Treasury Securities Maturity Radar
          </h3>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1 text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            &lt; 7D Critical
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            &lt; 30D Warning
          </span>
        </div>
      </div>

      {/* High density matrix table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-[#161b22] text-slate-500 text-[9px] uppercase tracking-wider font-semibold">
              <th className="pb-2 pl-1">Security / Instrument</th>
              <th className="pb-2">Counterparty</th>
              <th className="pb-2 text-right">Principal</th>
              <th className="pb-2 text-right">Yield</th>
              <th className="pb-2">Maturity Date</th>
              <th className="pb-2 text-center">Countdown</th>
              <th className="pb-2 text-right">Maturity Payout</th>
              <th className="pb-2 pr-1 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#161b22]">
            {items.map((item) => {
              const hasDate = Boolean(item.maturityDate) && item.status !== "unknown";
              const isCritical = hasDate && item.daysRemaining <= 7;
              const isWarning = hasDate && item.daysRemaining > 7 && item.daysRemaining <= 30;

              return (
                <tr key={item.id} className="hover:bg-[#111620] transition-colors h-8">
                  <td className="py-1 pl-1 font-medium text-slate-200 flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        isCritical ? "bg-rose-500" : isWarning ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                    />
                    <span className="truncate max-w-[220px]">{item.name}</span>
                  </td>
                  <td className="py-1 text-slate-400 text-[11px] truncate max-w-[160px]">{item.institution}</td>
                  <td className="py-1 text-right text-slate-200">
                    {item.currency === "USD" ? formatUSD(item.amount) : formatLKR(item.amount)}
                  </td>
                  <td className="py-1 text-right text-cyan-400">{item.rate.toFixed(2)}%</td>
                  <td className="py-1 text-slate-400 text-[11px]">
                    {item.maturityDate ? new Date(item.maturityDate).toLocaleDateString("en-GB") : "Unset"}
                  </td>
                  <td className="py-1 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        isCritical
                          ? "bg-rose-950/80 text-rose-300 border border-rose-800/60"
                          : isWarning
                          ? "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                          : "text-slate-400"
                      }`}
                    >
                      {hasDate ? `${item.daysRemaining}d` : "—"}
                    </span>
                  </td>
                  <td className="py-1 text-right text-emerald-400 font-semibold">
                    {item.currency === "USD" ? formatUSD(item.expectedPayout) : formatLKR(item.expectedPayout)}
                  </td>
                  <td className="py-1 pr-1 text-center">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#161b22] text-slate-300 hover:bg-[#21262d] transition-colors"
                    >
                      SET
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Micro Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-xs rounded-md border border-[#30363d] bg-[#0d1117] p-4 text-xs font-mono">
            <h4 className="text-xs font-bold text-slate-200 mb-1 uppercase tracking-wider">Maturity Date Override</h4>
            <p className="text-[10px] text-slate-400 mb-3 truncate">{editingItem.name}</p>

            <form onSubmit={handleSaveDate} className="space-y-3">
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-slate-400 mb-1">Maturity Date</label>
                <input
                  type="date"
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                  className="w-full rounded border border-[#30363d] bg-[#040608] px-2 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-wider text-slate-400 mb-1">ISIN / Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Rollover to 364D T-Bill"
                  className="w-full rounded border border-[#30363d] bg-[#040608] px-2 py-1 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 rounded bg-[#21262d] py-1 text-[10px] font-semibold text-slate-300 hover:bg-[#30363d]"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded bg-cyan-600 py-1 text-[10px] font-semibold text-white hover:bg-cyan-500"
                >
                  {saving ? "SAVING..." : "UPDATE"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
