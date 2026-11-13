"use client";

import React, { useState, useEffect } from "react";
import { TrendingUp, ArrowUpRight, DollarSign, Wallet, ShieldCheck, ChevronRight, Banknote, RefreshCw, SlidersHorizontal } from "lucide-react";
import { FinancialData, NetWorthCategory } from "@/lib/types";
import { formatLKR, formatUSD, formatPercent } from "@/lib/utils";
import { PalSyncModal } from "./PalSyncModal";
import { StockMinPriceModal } from "./StockMinPriceModal";

interface FinancialBayProps {
  finance: FinancialData;
  currency: "LKR" | "USD";
  onToggleCurrency: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
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

function formatExactSltTime(dateString?: string): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    timeZone: "Asia/Colombo",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function LivePulseDot() {
  return (
    <span className="relative inline-flex items-center justify-center h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500 shadow-[0_0_8px_#f43f5e]"></span>
    </span>
  );
}

export function FinancialBay({
  finance,
  currency,
  onToggleCurrency,
  onRefresh,
  isRefreshing = false,
}: FinancialBayProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isPalSyncOpen, setIsPalSyncOpen] = useState(false);
  const [minPrices, setMinPrices] = useState<Record<string, number>>({});
  const [isMinPriceModalOpen, setIsMinPriceModalOpen] = useState(false);
  const [, setNowTick] = useState(Date.now());
  const LKR_PER_USD = 310;

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Hydrate min prices from localStorage and server
  useEffect(() => {
    try {
      const cached = localStorage.getItem("ops_stock_min_prices_v1");
      if (cached) {
        setMinPrices(JSON.parse(cached));
      }
    } catch {}

    fetch("/api/ops/stocks/min-targets")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.minPrices) {
          setMinPrices(data.minPrices);
          try {
            localStorage.setItem("ops_stock_min_prices_v1", JSON.stringify(data.minPrices));
          } catch {}
        }
      })
      .catch((err) => console.warn("Could not load stock min prices:", err));
  }, []);

  const handleSaveMinPrices = async (newMinPrices: Record<string, number>) => {
    setMinPrices(newMinPrices);
    try {
      localStorage.setItem("ops_stock_min_prices_v1", JSON.stringify(newMinPrices));
    } catch {}

    try {
      await fetch("/api/ops/stocks/min-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minPrices: newMinPrices }),
      });
    } catch (err) {
      console.error("Failed to save min prices to server:", err);
    }
  };

  const lastStockSyncStr = formatRelativeTime(finance.stocks.lastPalSync);
  const lastStockSyncExactStr = formatExactSltTime(finance.stocks.lastPalSync);
  const lastCashflowSyncStr = formatRelativeTime(finance.lastUpdated);

  const formatVal = (amtLkr: number) => {
    return currency === "LKR"
      ? formatLKR(amtLkr)
      : formatUSD(amtLkr / LKR_PER_USD);
  };

  const isPositiveNetWorth = finance.netWorthDeltaLkr >= 0;
  const { monthlyPassiveYield } = finance;

  return (
    <div className="bg-[#08140e]/90 border border-[#133323] border-t border-t-white/10 rounded-md p-3.5 flex flex-col justify-between h-full">
      {/* ── BAY HEADER ── */}
      <div>
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#133323]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-none bg-[#10b981] animate-pulse" />
            <h2 className="text-[10px] font-mono font-bold tracking-wider uppercase text-emerald-400">
              ZONE 1: FINANCIAL &amp; EQUITIES BAY
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCurrency}
              className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-[#0b2419] border border-[#164e35] text-emerald-300 hover:bg-[#133323] transition-colors"
              title="Toggle LKR / USD currency readout"
            >
              {currency} ⇄
            </button>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-emerald-950/70 text-emerald-300 border border-emerald-800/40">
              AUDITED FY{finance.currentFY.slice(2)}
            </span>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1 rounded bg-[#0b2419] hover:bg-[#133323] border border-[#164e35] text-emerald-400 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh Zone 1 financial data"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${isRefreshing ? "animate-spin text-emerald-300" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── TOP-LEVEL TELEMETRY: TOTAL NET WORTH & MONTHLY PASSIVE ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          {/* Total Net Worth Counter with Period PnL */}
          <div className="bg-[#040c08] border border-[#133323] p-2.5 rounded-sm">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
              <span>Total Net Worth</span>
              <span className="text-[9px] font-mono text-slate-400">{finance.hardCurrencyHedgePct}% USD/USDT</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-300 tracking-tight">
              {formatVal(finance.totalNetWorthLkr)}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono mt-1">
              <span
                className={`px-1 py-0.2 rounded-sm font-semibold ${
                  isPositiveNetWorth ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"
                }`}
              >
                {formatPercent(finance.netWorthDeltaPct)}
              </span>
              <span className="text-slate-400">
                ({isPositiveNetWorth ? "+" : ""}{formatVal(finance.netWorthDeltaLkr)} MoM)
              </span>
            </div>
          </div>

          {/* 1. Net Monthly (After Progressive IIT) */}
          <div className="bg-[#040c08] border border-[#133323] p-2.5 rounded-sm relative overflow-hidden">
            <div className="flex items-center justify-between text-[8px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
              <div className="flex items-center gap-1.5 truncate">
                <LivePulseDot />
                <span className="truncate">Net Monthly (After IIT)</span>
              </div>
              <div className="flex items-center gap-1">
                {lastCashflowSyncStr && (
                  <span className="text-[7.5px] font-mono text-slate-500 font-normal lowercase">
                    {lastCashflowSyncStr}
                  </span>
                )}
                <span className="text-[8px] font-mono px-1 rounded-sm bg-[#1b1429] text-[#d8b4fe] border border-[#3b2a59]">
                  POST-TAX
                </span>
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-[#d8b4fe] tracking-tight">
              {formatVal(monthlyPassiveYield.netMonthlyAfterProgressiveIit)}<span className="text-[10px] text-slate-400 font-normal">/mo</span>
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mt-1">
              <span>WHT: {formatVal(monthlyPassiveYield.netWhtMonthly)}</span>
              <span className="text-emerald-400 font-medium">+{monthlyPassiveYield.deltaNetIitPct}%</span>
            </div>
          </div>

          {/* 2. Physical Cash Available (Monthly) */}
          <div className="bg-[#040c08] border border-[#133323] p-2.5 rounded-sm relative overflow-hidden">
            <div className="flex items-center justify-between text-[8px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
              <div className="flex items-center gap-1.5 truncate">
                <LivePulseDot />
                <span className="truncate">Physical Cash Available</span>
              </div>
              <div className="flex items-center gap-1">
                {lastCashflowSyncStr && (
                  <span className="text-[7.5px] font-mono text-slate-500 font-normal lowercase">
                    {lastCashflowSyncStr}
                  </span>
                )}
                <span className="text-[8px] font-mono px-1 rounded-sm bg-[#221803] text-[#fbbf24] border border-[#4d3707]">
                  MONTHLY
                </span>
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-[#fbbf24] tracking-tight">
              {formatVal(monthlyPassiveYield.physicalCashAvailableMonthly)}<span className="text-[10px] text-slate-400 font-normal">/mo</span>
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mt-1">
              <span className="truncate text-slate-500">FD+UT+Treasury+Div</span>
              <span className="text-amber-400 font-medium">+{monthlyPassiveYield.deltaPhysicalCashPct}%</span>
            </div>
          </div>
        </div>

        {/* ── TWO-PART CATEGORY MATRIX: 1. ASSET ALLOCATION & 2. MONTHLY INCOME PER CATEGORY ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          {/* ── PART 1: ASSET CATEGORY TELEMETRY (CURRENT VIEW) ── */}
          <div>
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1 px-0.5">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>1. Asset Category Telemetry</span>
              </span>
              <span className="font-mono text-[8px] text-slate-400">Allocation &amp; MoM Delta</span>
            </div>

            <div className="border border-[#133323] rounded-sm bg-[#040c08] divide-y divide-[#133323]">
              {finance.categories.map((c) => {
                const isGain = c.deltaAmount >= 0;
                const isSelected = selectedCategory === c.id;

                return (
                  <div
                    key={`capital-${c.id}`}
                    onClick={() => setSelectedCategory(isSelected ? null : c.id)}
                    className={`px-2.5 py-1.5 text-xs font-mono cursor-pointer transition-colors ${
                      isSelected ? "bg-[#0d2a1d]" : "hover:bg-[#071911]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500" />
                        <span className="font-semibold text-slate-200 truncate max-w-[110px] sm:max-w-[135px] text-[11px]">
                          {c.name}
                        </span>
                        <span className="text-[8.5px] px-1 py-0.2 rounded-sm bg-[#081a12] text-emerald-400 border border-[#133323] font-semibold">
                          {c.allocationPct}%
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 font-bold text-[11px]">{formatVal(c.currentAmount)}</span>
                        <span
                          className={`text-[9.5px] font-semibold min-w-[38px] text-right ${
                            isGain ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formatPercent(c.deltaPct)}
                        </span>
                      </div>
                    </div>

                    {/* Micro allocation bar */}
                    <div className="h-1 w-full bg-[#112419] rounded-none mt-1 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${c.allocationPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── PART 2: INVESTOR DASHBOARD PASSIVE INCOME CATEGORIES ── */}
          <div>
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1 px-0.5">
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>2. Monthly Income per Category</span>
              </span>
              <span className="font-mono text-[8px] text-amber-300 font-semibold">
                {formatVal(monthlyPassiveYield.physicalCashAvailableMonthly)}/mo
              </span>
            </div>

            <div className="border border-[#133323] rounded-sm bg-[#040c08] divide-y divide-[#133323]">
              {(finance.incomeCategories || []).map((cat) => {
                let badgeStyle = "bg-[#0b1f2e] text-cyan-300 border-cyan-800/60";
                if (cat.badgeType === "ut") badgeStyle = "bg-[#0b291d] text-emerald-300 border-emerald-800/60";
                else if (cat.badgeType === "treasury") badgeStyle = "bg-[#141738] text-indigo-300 border-indigo-800/60";
                else if (cat.badgeType === "cse") badgeStyle = "bg-[#1f1638] text-purple-300 border-purple-800/60";
                else if (cat.badgeType === "pfca") badgeStyle = "bg-[#2d1119] text-rose-300 border-rose-800/60";

                return (
                  <div
                    key={cat.id}
                    className="px-2.5 py-1.5 text-xs font-mono hover:bg-[#071911] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-slate-200 truncate max-w-[125px] sm:max-w-[145px] text-[11px]">
                          {cat.name}
                        </span>
                        <span className={`text-[7.5px] px-1 py-0.2 rounded-sm border font-semibold ${badgeStyle}`}>
                          {cat.badge}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-amber-300 font-bold text-[11px]">
                          {formatVal(cat.netMonthly)}<span className="text-[8.5px] text-slate-400 font-normal">/mo</span>
                        </span>
                        <span className="text-[9.5px] font-semibold min-w-[38px] text-right text-emerald-400" title={cat.rateLabel}>
                          {cat.rateLabel}
                        </span>
                      </div>
                    </div>

                    {/* Micro income share bar */}
                    <div className="h-1 w-full bg-[#181308] rounded-none mt-1 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
                        style={{ width: `${cat.sharePct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── CSE EQUITIES HOLDINGS & LIVE TELEMETRY ── */}
        <div>
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1 px-0.5">
            <div className="flex items-center gap-1.5">
              <LivePulseDot />
              <span>CSE Equity Holdings</span>
              <button
                onClick={() => setIsPalSyncOpen(true)}
                className={`px-1.5 py-0.5 rounded-sm text-[8px] font-mono font-bold transition-colors border ${
                  finance.stocks.syncedFrom === "pal.lk"
                    ? "bg-[#0b2419] border-emerald-600/50 text-emerald-300"
                    : "bg-[#0b1612] hover:bg-[#133323] border-[#164e35] text-slate-300 hover:text-emerald-300"
                }`}
                title="Sync live holdings from pal.lk"
              >
                {finance.stocks.syncedFrom === "pal.lk" ? "● PAL SYNCED" : "⇄ PAL SYNC"}
              </button>
              <button
                onClick={() => setIsMinPriceModalOpen(true)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[8px] font-mono font-bold bg-[#0b1612] hover:bg-[#133323] border border-[#164e35] text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
                title="Configure minimum price targets per stock"
              >
                <SlidersHorizontal className="h-2.5 w-2.5 text-cyan-400" />
                <span>MIN TARGETS</span>
              </button>
              {lastStockSyncExactStr ? (
                <span
                  className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm bg-[#061810] border border-[#133323] text-emerald-300/90 normal-case"
                  title={`Last PAL.lk sync: ${finance.stocks.lastPalSync}`}
                >
                  Last Sync: <strong className="text-white">{lastStockSyncExactStr}</strong> ({lastStockSyncStr})
                </span>
              ) : (
                <span className="text-[8px] font-mono text-amber-400/80 normal-case">
                  (Not synced yet)
                </span>
              )}
            </div>
            <span className="font-mono text-emerald-400">
              {finance.stocks.unrealizedPnl >= 0 ? "+" : ""}{formatVal(finance.stocks.unrealizedPnl)} ({formatPercent(finance.stocks.unrealizedPnlPct)})
            </span>
          </div>

          {/* Full Portfolio Value Readout + Dividends for the Month */}
          <div className="bg-[#040c08] border border-[#133323] p-2 rounded-sm mb-1.5 grid grid-cols-3 gap-2 font-mono items-center">
            <div>
              <div className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold">Total Portfolio Value</div>
              <div className="text-sm sm:text-base font-bold text-emerald-400 tracking-tight">
                {formatVal(finance.stocks.portfolioValue)}
              </div>
            </div>
            <div className="text-center border-x border-[#133323] px-1.5">
              <div className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold">MTD Dividends</div>
              <div className="text-sm sm:text-base font-bold text-[#34d399] tracking-tight">
                {formatVal(finance.stocks.dividendCashMonth)}
              </div>
              <div className="text-[8px] text-slate-500 truncate">
                YTD: {formatVal(finance.stocks.dividendCashYtd)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold">Invested Cost Basis</div>
              <div className="text-xs sm:text-sm font-semibold text-slate-300">
                {formatVal(finance.stocks.totalCost)}
              </div>
            </div>
          </div>

          {/* Holdings Grid with Accurate PnL % and Shares */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-1 font-mono text-[11px]">
            {finance.stocks.tickers.map((t) => {
              const isProfit = (t.unrealizedPnlPct ?? 0) >= 0;
              const cleanSym = t.symbol.split(".")[0].toUpperCase();
              const minPrice = minPrices[cleanSym] ?? minPrices[t.symbol.toUpperCase()];
              const hasMin = typeof minPrice === "number" && minPrice > 0;
              const isBelowMin = hasMin && t.price < minPrice;

              // Color rule (only current price):
              // Green -> if below min
              // white -> if above min
              let priceColorClass = "text-white font-bold";
              if (hasMin) {
                priceColorClass = isBelowMin ? "text-emerald-400 font-bold" : "text-white font-bold";
              }

              return (
                <div key={t.symbol} className="bg-[#040c08] border border-[#133323] p-1.5 rounded-sm flex flex-col justify-between">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-200" title={t.name}>{cleanSym}</span>
                    <span className={isProfit ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                      {formatPercent(t.unrealizedPnlPct ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline mt-0.5">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-xs ${priceColorClass}`}
                        title={
                          hasMin
                            ? `Current: ${formatLKR(t.price)} | Min Target: ${formatLKR(minPrice)} (${
                                isBelowMin ? "BELOW MIN - BUY ZONE" : "ABOVE MIN"
                              })`
                            : `Current Price: ${formatLKR(t.price)} (No min target set)`
                        }
                      >
                        {formatLKR(t.price)}
                      </span>
                      {hasMin && (
                        <span
                          className={`text-[8px] font-mono font-bold px-0.5 rounded-2xs ${
                            isBelowMin
                              ? "text-emerald-400 bg-emerald-950/80 border border-emerald-800/60"
                              : "text-slate-500"
                          }`}
                          title={`Configured Min Target: ${formatLKR(minPrice)}`}
                        >
                          &lt;{Math.round(minPrice)}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-500">
                      {t.quantity > 0 ? `${t.quantity.toLocaleString()} sh` : ""}
                    </span>
                  </div>
                  {t.marketValue > 0 && (
                    <div className="text-[9px] text-slate-400 flex justify-between mt-0.5 border-t border-[#133323]/50 pt-0.5">
                      <span>Val: {formatLKR(t.marketValue)}</span>
                      <span className={isProfit ? "text-emerald-400/80" : "text-rose-400/80"}>
                        {t.unrealizedPnl >= 0 ? "+" : ""}{formatLKR(t.unrealizedPnl)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pal.lk Sync Bridge Modal */}
      <PalSyncModal
        isOpen={isPalSyncOpen}
        onClose={() => setIsPalSyncOpen(false)}
        lastPalSync={finance.stocks.lastPalSync}
        syncedFrom={finance.stocks.syncedFrom}
        onSyncSuccess={() => {
          if (onRefresh) {
            onRefresh();
          } else {
            window.location.reload();
          }
        }}
      />

      {/* Stock Minimum Price Targets Settings Modal */}
      <StockMinPriceModal
        isOpen={isMinPriceModalOpen}
        onClose={() => setIsMinPriceModalOpen(false)}
        tickers={finance.stocks.tickers}
        minPrices={minPrices}
        onSave={handleSaveMinPrices}
      />
    </div>
  );
}
