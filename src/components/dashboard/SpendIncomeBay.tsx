"use client";

import React, { useState } from "react";
import {
  Wallet,
  Building,
  CreditCard,
  ShoppingBag,
  TrendingUp,
  ChevronRight,
  ShieldCheck,
  Percent,
  Target,
} from "lucide-react";
import { SpendIncomeData } from "@/lib/types";
import { formatLKR, formatUSD, formatPercent } from "@/lib/utils";

interface SpendIncomeBayProps {
  spendIncome: SpendIncomeData;
  currency: "LKR" | "USD";
}

function LivePulseDot() {
  return (
    <span className="relative inline-flex items-center justify-center h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500 shadow-[0_0_8px_#f43f5e]"></span>
    </span>
  );
}

export function SpendIncomeBay({ spendIncome, currency }: SpendIncomeBayProps) {
  const [activeTab, setActiveTab] = useState<"normal" | "one_time" | "loans" | "od" | "taxes" | "vindya">("normal");
  const LKR_PER_USD = 310;

  const formatVal = (amtLkr: number) => {
    return currency === "LKR"
      ? formatLKR(amtLkr)
      : formatUSD(amtLkr / LKR_PER_USD);
  };

  const { inflow, outflow } = spendIncome;
  const isPositiveSavings = spendIncome.netCashFlow >= 0;
  const isOverBudget = outflow.household.total > outflow.household.baselineBudget;

  const normalSpend = outflow.household.normal || 0;
  const baselineBudget = outflow.household.baselineBudget || 350000;
  const normalBudgetPct = baselineBudget > 0 ? Number(((normalSpend / baselineBudget) * 100).toFixed(1)) : 0;
  const normalBudgetRemaining = baselineBudget - normalSpend;

  const janithaPct = inflow.totalInflow > 0 ? (inflow.janithaSalary / inflow.totalInflow) * 100 : 0;
  const vindyaPct = inflow.totalInflow > 0 ? (inflow.vindyaSalary / inflow.totalInflow) * 100 : 0;
  const passivePct = inflow.totalInflow > 0 ? (inflow.lastMonthPassive / inflow.totalInflow) * 100 : 0;

  return (
    <div className="bg-[#140b04]/90 border border-[#381a07] border-t border-t-white/10 rounded-md p-3.5 flex flex-col justify-between h-full font-sans">
      <div>
        {/* ── BAY HEADER ── */}
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#381a07]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 bg-[#f59e0b] rounded-none animate-pulse" />
            <h2 className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-400">
              ZONE 2: SPENDINGS &amp; INCOME BAY
            </h2>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[9px]">
            <span className="px-1.5 py-0.5 rounded-sm bg-amber-950/70 text-amber-300 border border-amber-800/40">
              CASHFLOW MATRIX
            </span>
            <span className="px-1.5 py-0.5 rounded-sm bg-[#221004] text-slate-400 border border-[#381a07]">
              {spendIncome.currentMonth}
            </span>
          </div>
        </div>

        {/* ── ROW 1: TOTAL INFLOW VS TOTAL OUTFLOW (TOP-LEVEL SPLIT) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2.5">
          {/* TOTAL INFLOW CARD */}
          <div className="bg-[#0b0602] border border-[#381a07] p-2.5 rounded-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Total Inflow
              </span>
              <span className="text-[9px] font-mono px-1 rounded-sm bg-emerald-950/60 text-emerald-400 border border-emerald-800/30">
                ACTIVE MONTH
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 tracking-tight">
              {formatVal(inflow.totalInflow)}
            </div>

            {/* Segmented Inflow Allocation Bar */}
            <div className="h-1.5 w-full bg-[#201004] rounded-none overflow-hidden my-1.5 flex">
              <div style={{ width: `${vindyaPct}%` }} className="h-full bg-cyan-400" title={`Vindya: ${vindyaPct.toFixed(1)}%`} />
              <div style={{ width: `${janithaPct}%` }} className="h-full bg-emerald-500" title={`Janitha: ${janithaPct.toFixed(1)}%`} />
              <div style={{ width: `${passivePct}%` }} className="h-full bg-amber-400" title={`Passive: ${passivePct.toFixed(1)}%`} />
            </div>

            {/* 3 User-Specified Inflow Categories */}
            <div className="space-y-1 font-mono text-[10px] mt-0.5">
              <div className="flex justify-between items-center text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-emerald-500 inline-block" />
                  <span>Janitha Salary</span>
                </span>
                <span className="font-bold text-slate-200">
                  {formatVal(inflow.janithaSalary)} <span className="text-slate-500 text-[8px]">({janithaPct.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-cyan-400 inline-block" />
                  <span>Vindya Salary</span>
                </span>
                <span className="font-bold text-slate-200">
                  {formatVal(inflow.vindyaSalary)} <span className="text-slate-500 text-[8px]">({vindyaPct.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-amber-400 inline-block" />
                  <span>Last Month Passive Income</span>
                </span>
                <span className="font-bold text-amber-300">
                  {formatVal(inflow.lastMonthPassive)} <span className="text-slate-500 text-[8px]">({passivePct.toFixed(1)}%)</span>
                </span>
              </div>
            </div>
          </div>

          {/* TOTAL OUTFLOW / EXPENSES CARD */}
          <div className="bg-[#0b0602] border border-[#381a07] p-2.5 rounded-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                <LivePulseDot />
                Total Expenses
              </span>
              <span className="text-[9px] font-mono px-1 rounded-sm bg-rose-950/60 text-rose-400 border border-rose-800/30">
                ALLOCATED
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-rose-400 tracking-tight">
              {formatVal(outflow.totalOutflow)}
            </div>

            {/* Segmented Outflow Allocation Bar */}
            <div className="h-1.5 w-full bg-[#201004] rounded-none overflow-hidden my-1.5 flex">
              <div
                style={{ width: `${outflow.totalOutflow > 0 ? (outflow.loans.total / outflow.totalOutflow) * 100 : 0}%` }}
                className="h-full bg-rose-500"
                title={`Loans: ${formatVal(outflow.loans.total)}`}
              />
              <div
                style={{ width: `${outflow.totalOutflow > 0 ? (outflow.od.total / outflow.totalOutflow) * 100 : 0}%` }}
                className="h-full bg-amber-500"
                title={`OD: ${formatVal(outflow.od.total)}`}
              />
              <div
                style={{ width: `${outflow.totalOutflow > 0 ? (outflow.taxes.total / outflow.totalOutflow) * 100 : 0}%` }}
                className="h-full bg-purple-500"
                title={`Taxes: ${formatVal(outflow.taxes.total)}`}
              />
              <div
                style={{ width: `${outflow.totalOutflow > 0 ? (outflow.vindyaExpense / outflow.totalOutflow) * 100 : 0}%` }}
                className="h-full bg-cyan-400"
                title={`Vindya: ${formatVal(outflow.vindyaExpense)}`}
              />
              <div
                style={{ width: `${outflow.totalOutflow > 0 ? (outflow.household.normal / outflow.totalOutflow) * 100 : 0}%` }}
                className="h-full bg-emerald-500"
                title={`House Normal: ${formatVal(outflow.household.normal)}`}
              />
              <div
                style={{ width: `${outflow.totalOutflow > 0 ? (outflow.household.oneTime / outflow.totalOutflow) * 100 : 0}%` }}
                className="h-full bg-orange-500"
                title={`House One-Time: ${formatVal(outflow.household.oneTime)}`}
              />
            </div>

            {/* Outflow Pillars: Taxes, Loans, OD, Vindya, House Normal, House One-Time */}
            <div className="space-y-0.5 font-mono text-[9.5px] mt-0.5">
              <div
                onClick={() => setActiveTab("taxes")}
                className={`flex justify-between items-center cursor-pointer p-0.5 rounded-sm transition-colors ${
                  activeTab === "taxes" ? "bg-[#25101a] text-purple-300" : "text-slate-300 hover:bg-[#1a0e05]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-purple-500 inline-block" />
                  <span>Taxes (Salary PAYE / IIT)</span>
                </span>
                <span className="font-bold text-slate-200">
                  {formatVal(outflow.taxes.total)}
                </span>
              </div>

              <div
                onClick={() => setActiveTab("loans")}
                className={`flex justify-between items-center cursor-pointer p-0.5 rounded-sm transition-colors ${
                  activeTab === "loans" ? "bg-[#250d12] text-rose-300" : "text-slate-300 hover:bg-[#1a0e05]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-rose-500 inline-block" />
                  <span>Loans &amp; Debt Installments</span>
                </span>
                <span className="font-bold text-rose-400">
                  {formatVal(outflow.loans.total)}
                </span>
              </div>

              <div
                onClick={() => setActiveTab("od")}
                className={`flex justify-between items-center cursor-pointer p-0.5 rounded-sm transition-colors ${
                  activeTab === "od" ? "bg-[#271607] text-amber-300" : "text-slate-300 hover:bg-[#1a0e05]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-amber-500 inline-block" />
                  <span>OD Payments (Home OD)</span>
                </span>
                <span className="font-bold text-amber-400">
                  {formatVal(outflow.od.total)}
                </span>
              </div>

              <div
                onClick={() => setActiveTab("vindya")}
                className={`flex justify-between items-center cursor-pointer p-0.5 rounded-sm transition-colors ${
                  activeTab === "vindya" ? "bg-[#08202b] text-cyan-300" : "text-slate-300 hover:bg-[#1a0e05]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-cyan-400 inline-block" />
                  <span>Vindya Expense (Fixed)</span>
                </span>
                <span className="font-bold text-cyan-300">
                  {formatVal(outflow.vindyaExpense)}
                </span>
              </div>

              <div
                onClick={() => setActiveTab("normal")}
                className={`cursor-pointer p-1 rounded-sm transition-colors ${
                  activeTab === "normal" ? "bg-[#112417] text-emerald-300 ring-1 ring-emerald-500/30" : "text-slate-300 hover:bg-[#1a0e05]"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="flex items-center gap-1.5">
                    <LivePulseDot />
                    <span className="font-semibold text-[11px]">House: Normal Expense</span>
                    <span className="text-[7.5px] font-mono font-bold px-1 py-0.2 rounded-sm bg-amber-950/80 text-amber-300 border border-amber-800/50">
                      +10% UNDOC
                    </span>
                  </span>
                  <div className="text-right font-mono">
                    <span className="font-bold text-emerald-400 text-xs">
                      {formatVal(normalSpend)}
                    </span>
                    <span className="text-[8.5px] text-slate-500 ml-1">
                      / {formatVal(baselineBudget)}
                    </span>
                  </div>
                </div>

                {/* Normal Expenses Monthly Budget Progress Meter */}
                <div className="space-y-0.5">
                  <div className="h-1.5 w-full bg-[#241006] rounded-none overflow-hidden relative">
                    <div
                      style={{ width: `${Math.min(100, normalBudgetPct)}%` }}
                      className={`h-full transition-all duration-500 ${
                        normalBudgetPct > 100
                          ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                          : normalBudgetPct >= 85
                          ? "bg-amber-400 shadow-[0_0_6px_#f59e0b]"
                          : "bg-emerald-500"
                      }`}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[7.5px] font-mono">
                    <span className={normalBudgetPct > 100 ? "text-rose-400 font-bold" : normalBudgetPct >= 85 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                      {normalBudgetPct}% of budget
                    </span>
                    <span className="text-amber-300 font-semibold">
                      {normalBudgetRemaining >= 0
                        ? `${formatVal(normalBudgetRemaining)} runway left`
                        : `+${formatVal(Math.abs(normalBudgetRemaining))} over budget`}
                    </span>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setActiveTab("one_time")}
                className={`flex justify-between items-center cursor-pointer p-0.5 rounded-sm transition-colors ${
                  activeTab === "one_time" ? "bg-[#2a1708] text-orange-300" : "text-slate-300 hover:bg-[#1a0e05]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-orange-500 inline-block" />
                  <span>House: One-Time Expense</span>
                </span>
                <span className="font-bold text-orange-400">
                  {formatVal(outflow.household.oneTime)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 2: NET SURPLUS / SAVINGS EFFICIENCY STRIP ── */}
        <div className="bg-[#0b0602] border border-[#381a07] p-2 rounded-sm mb-2.5 flex items-center justify-between font-mono">
          <div>
            <div className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold">Net Cash Surplus</div>
            <div className={`text-base font-bold tracking-tight ${isPositiveSavings ? "text-cyan-300" : "text-rose-400"}`}>
              {formatVal(spendIncome.netCashFlow)}
            </div>
          </div>

          <div className="text-center px-2 border-x border-[#381a07]">
            <div className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold">Savings Retention</div>
            <div className="text-sm font-bold text-amber-400 tracking-tight">
              {spendIncome.savingsRatePct}%
            </div>
          </div>

          <div className="text-right">
            <div className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold">Income / Expense Ratio</div>
            <div className="text-sm font-bold text-emerald-400 tracking-tight">
              {outflow.totalOutflow > 0 ? `${((inflow.totalInflow / outflow.totalOutflow) * 100).toFixed(0)}%` : "100%"}
            </div>
          </div>
        </div>

        {/* ── ROW 3: DETAILED DRILL-DOWN TABS (HOUSEHOLD vs LOANS vs OD vs VINDYA vs TAXES) ── */}
        <div>
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1 px-0.5 overflow-x-auto">
            <div className="flex items-center gap-1 font-mono text-[9px] shrink-0">
              <button
                onClick={() => setActiveTab("normal")}
                className={`px-1.5 py-0.5 rounded-none font-bold transition-colors flex items-center gap-1.5 ${
                  activeTab === "normal" ? "bg-emerald-600 text-slate-950" : "bg-[#1a0e05] text-slate-400 hover:text-slate-200"
                }`}
              >
                <LivePulseDot />
                <span>Normal ({formatVal(outflow.household.normal)})</span>
              </button>
              <button
                onClick={() => setActiveTab("one_time")}
                className={`px-1.5 py-0.5 rounded-none font-bold transition-colors ${
                  activeTab === "one_time" ? "bg-orange-600 text-slate-950" : "bg-[#1a0e05] text-slate-400 hover:text-slate-200"
                }`}
              >
                One-Time ({formatVal(outflow.household.oneTime)})
              </button>
              <button
                onClick={() => setActiveTab("loans")}
                className={`px-1.5 py-0.5 rounded-none font-bold transition-colors ${
                  activeTab === "loans" ? "bg-rose-700 text-white" : "bg-[#1a0e05] text-slate-400 hover:text-slate-200"
                }`}
              >
                Loans ({formatVal(outflow.loans.total)})
              </button>
              <button
                onClick={() => setActiveTab("od")}
                className={`px-1.5 py-0.5 rounded-none font-bold transition-colors ${
                  activeTab === "od" ? "bg-amber-600 text-slate-950" : "bg-[#1a0e05] text-slate-400 hover:text-slate-200"
                }`}
              >
                OD ({formatVal(outflow.od.total)})
              </button>
              <button
                onClick={() => setActiveTab("vindya")}
                className={`px-1.5 py-0.5 rounded-none font-bold transition-colors ${
                  activeTab === "vindya" ? "bg-cyan-600 text-slate-950" : "bg-[#1a0e05] text-slate-400 hover:text-slate-200"
                }`}
              >
                Vindya ({formatVal(outflow.vindyaExpense)})
              </button>
              <button
                onClick={() => setActiveTab("taxes")}
                className={`px-1.5 py-0.5 rounded-none font-bold transition-colors ${
                  activeTab === "taxes" ? "bg-purple-700 text-white" : "bg-[#1a0e05] text-slate-400 hover:text-slate-200"
                }`}
              >
                Taxes ({formatVal(outflow.taxes.total)})
              </button>
            </div>
            <span className="font-mono text-slate-500 text-[8px] pl-1">
              {activeTab === "normal" ? `Cap: ${spendIncome.budgetUtilizationPct}%` : ""}
            </span>
          </div>

          <div className="h-[205px] border border-[#381a07] rounded-sm bg-[#0b0602] divide-y divide-[#381a07] overflow-y-auto">
            {/* TAB 1: NORMAL HOUSEHOLD LIVING EXPENSES */}
            {activeTab === "normal" && (
              <>
                {/* Monthly Baseline Budget Consumption Header */}
                <div className="p-2 bg-[#140a03] border-b border-[#381a07] font-mono sticky top-0 z-10">
                  <div className="flex justify-between items-center text-[9px] mb-1">
                    <span className="text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="h-3 w-3 text-amber-400" />
                      <span>Monthly Baseline Budget Gauge</span>
                    </span>
                    <span className="text-slate-300 text-[10px]">
                      <span className="font-bold text-emerald-400">{formatVal(normalSpend)}</span>
                      <span className="text-slate-500"> / {formatVal(baselineBudget)}</span>
                      <span className={`ml-1.5 font-bold ${normalBudgetPct > 100 ? "text-rose-400" : normalBudgetPct >= 85 ? "text-amber-400" : "text-emerald-400"}`}>
                        ({normalBudgetPct}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#200e05] overflow-hidden relative mb-1">
                    <div
                      style={{ width: `${Math.min(100, normalBudgetPct)}%` }}
                      className={`h-full transition-all duration-500 ${
                        normalBudgetPct > 100
                          ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                          : normalBudgetPct >= 85
                          ? "bg-amber-400"
                          : "bg-emerald-500"
                      }`}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-500">
                    <span>0</span>
                    <span className="text-amber-300 font-bold">
                      {normalBudgetRemaining >= 0
                        ? `${formatVal(normalBudgetRemaining)} RUNWAY REMAINING`
                        : `+${formatVal(Math.abs(normalBudgetRemaining))} OVER BUDGET`}
                    </span>
                    <span className="text-slate-400">LIMIT: {formatVal(baselineBudget)}</span>
                  </div>
                </div>

                {outflow.household.categories
                  .filter((c) => c.parentType !== "one_time")
                  .map((c) => {
                    const isOver = c.variance > 0;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between px-2.5 h-6 text-xs font-mono hover:bg-[#1a0e05] transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="truncate max-w-[160px] text-[11px] text-slate-300">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">{formatVal(c.amount)}</span>
                          <span className={`text-[10px] w-14 text-right font-semibold ${isOver ? "text-rose-400" : "text-emerald-400"}`}>
                            {isOver ? "+" : ""}{formatVal(c.variance)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </>
            )}

            {/* TAB 2: ONE-TIME HOUSEHOLD EXPENSES */}
            {activeTab === "one_time" && (
              <>
                {outflow.household.categories
                  .filter((c) => c.parentType === "one_time")
                  .map((c) => {
                    const isOver = c.variance > 0;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between px-2.5 h-6 text-xs font-mono hover:bg-[#1a0e05] transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="truncate max-w-[160px] text-[11px] text-slate-300">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">{formatVal(c.amount)}</span>
                          <span className={`text-[10px] w-14 text-right font-semibold ${isOver ? "text-rose-400" : "text-emerald-400"}`}>
                            {isOver ? "+" : ""}{formatVal(c.variance)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </>
            )}

            {/* TAB 3: LOANS OBLIGATIONS */}
            {activeTab === "loans" && (
              <>
                {outflow.loans.items.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between px-2.5 h-6 text-xs font-mono hover:bg-[#1a0e05] transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-1.5 w-1.5 bg-rose-500 inline-block" />
                      <span className="truncate max-w-[180px] text-[11px] text-slate-200 font-medium">{l.name}</span>
                      <span className="text-[8px] px-1 rounded-sm bg-[#221004] text-slate-400 border border-[#381a07] uppercase">
                        {l.type}
                      </span>
                    </div>
                    <span className="font-bold text-rose-400">{formatVal(l.monthlyPayment)}/mo</span>
                  </div>
                ))}
              </>
            )}

            {/* TAB 4: OVERDRAFT (OD) FACILITIES */}
            {activeTab === "od" && (
              <>
                {outflow.od.items.map((od) => (
                  <div
                    key={od.id}
                    className="flex flex-col justify-center px-2.5 py-1.5 text-xs font-mono hover:bg-[#1a0e05] transition-colors gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-1.5 w-1.5 bg-amber-500 inline-block" />
                        <span className="truncate max-w-[200px] text-[11px] text-amber-200 font-medium">{od.name}</span>
                      </div>
                      <span className="font-bold text-amber-400">{formatVal(od.monthlyPayment)}/mo</span>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] text-slate-400 pl-3.5">
                      <span>Drawn: <span className="text-slate-200 font-semibold">{formatVal(od.currentDrawn)}</span></span>
                      <span>Limit: <span className="text-slate-200 font-semibold">{formatVal(od.overdraftLimit)}</span></span>
                      <span>Interest: <span className="text-rose-400 font-semibold">{formatVal(od.latestInterest)}</span></span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* TAB 5: VINDYA MONTHLY PERSONAL EXPENSE */}
            {activeTab === "vindya" && (
              <div className="flex items-center justify-between px-2.5 py-2 text-xs font-mono hover:bg-[#1a0e05] transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-1.5 w-1.5 bg-cyan-400 inline-block" />
                  <div>
                    <span className="text-[11px] text-cyan-200 font-medium">Vindya Personal Expense</span>
                    <span className="block text-[8px] text-slate-500 uppercase tracking-wider">Fixed Monthly Allocation</span>
                  </div>
                </div>
                <span className="font-bold text-cyan-300">{formatVal(outflow.vindyaExpense)}/mo</span>
              </div>
            )}

            {/* TAB 6: TAXES DEDUCTIONS */}
            {activeTab === "taxes" && (
              <>
                <div className="flex items-center justify-between px-2.5 h-6 text-xs font-mono hover:bg-[#1a0e05] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-purple-500 inline-block" />
                    <span className="text-[11px] text-slate-200 font-medium">Janitha Salary PAYE / IIT</span>
                  </div>
                  <span className="font-bold text-purple-300">{formatVal(outflow.taxes.janithaTax)}</span>
                </div>
                <div className="flex items-center justify-between px-2.5 h-6 text-xs font-mono hover:bg-[#1a0e05] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-cyan-500 inline-block" />
                    <span className="text-[11px] text-slate-200 font-medium">Vindya Salary PAYE / IIT</span>
                  </div>
                  <span className="font-bold text-cyan-300">{formatVal(outflow.taxes.vindyaTax)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── BAY FOOTER TELEMETRY ── */}
      <div className="pt-2 mt-2 border-t border-[#381a07] shrink-0 grid grid-cols-3 gap-1.5 text-[10px] font-mono text-slate-400">
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">Daily Average Burn</span>
          <span className="text-slate-200 font-semibold">{formatVal(outflow.household.dailyAverageSpend)}/d</span>
        </div>
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">Safe Daily Runway</span>
          <span className="text-emerald-400 font-semibold">{formatVal(outflow.household.dailySafeBurnRate)}/d</span>
        </div>
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-500">Household Budget</span>
          <span className="text-amber-400 font-semibold">{formatVal(outflow.household.baselineBudget)}</span>
        </div>
      </div>
    </div>
  );
}
