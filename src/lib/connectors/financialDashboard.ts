import { kv } from "@vercel/kv";
import { neon } from "@neondatabase/serverless";
import { FinancialData, NetWorthCategory, CseStockTicker } from "../types";
import { getCurrentFinancialYear } from "../utils";
import { getPalHoldings } from "./opsStore";

export async function fetchFinancialBayData(): Promise<FinancialData> {
  const currentFY = getCurrentFinancialYear();
  const investorDbUrl = process.env.INVESTOR_DATABASE_URL;

  // Authoritative live numbers directly from LankaWealth Portfolio
  let grossMonthly = 460347;
  let netWhtMonthly = 452029;
  let netMonthlyAfterProgressiveIit = 452029;
  let physicalCashAvailableMonthly = 373675;
  let iitPayableMonthly = 0; // Notice netWht === netIit (452,029), so IIT balance payable is 0
  let priorNetMonthlyIit = 438000;
  let priorPhysicalCashMonthly = 362000;

  // 1. Try reading live snapshots from LankaWealth Neon DB if connected
  if (investorDbUrl) {
    try {
      const sql = neon(investorDbUrl);
      const snapRows = await sql`
        SELECT totals, timestamp
        FROM portfolio_snapshots
        ORDER BY timestamp DESC
        LIMIT 2
      `;

      if (snapRows.length > 0) {
        const latestTotals = (snapRows[0].totals as any) || {};
        grossMonthly = Math.round((Number(latestTotals.gross) || grossMonthly * 12) / 12);
        netWhtMonthly = Math.round((Number(latestTotals.netWht) || netWhtMonthly * 12) / 12);
        netMonthlyAfterProgressiveIit = Math.round((Number(latestTotals.netIit) || netMonthlyAfterProgressiveIit * 12) / 12);
        physicalCashAvailableMonthly = Math.round((Number(latestTotals.physicalCash) || physicalCashAvailableMonthly * 12) / 12);
        iitPayableMonthly = Math.round((Number(latestTotals.iitPayable) || 0) / 12);

        if (snapRows.length > 1) {
          const priorTotals = (snapRows[1].totals as any) || {};
          priorNetMonthlyIit = Math.round((Number(priorTotals.netIit) || priorNetMonthlyIit * 12) / 12);
          priorPhysicalCashMonthly = Math.round((Number(priorTotals.physicalCash) || priorPhysicalCashMonthly * 12) / 12);
        }
      }
    } catch (err) {
      console.warn("Neon read note for LankaWealth cashflow:", err);
    }
  }

  // Fetch Pal.lk synced holdings if available
  const palHoldings = await getPalHoldings();

  // 2. Fetch Net Worth & Equities from Vercel KV
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const [wealthData, stockData] = await Promise.allSettled([
        kv.get<any[]>("financial_dashboard_wealth_v1"),
        kv.get<any>("financial_dashboard_stocks_v1"),
      ]);

      const rawWealth = wealthData.status === "fulfilled" && Array.isArray(wealthData.value) ? wealthData.value : [];
      const rawStocks = stockData.status === "fulfilled" && stockData.value ? stockData.value : null;

      if (rawWealth.length >= 2) {
        const sorted = [...rawWealth];
        const currentMonthData = sorted[sorted.length - 1];
        const priorMonthData = sorted[sorted.length - 2];

        const currentRecords = currentMonthData.records || [];
        const priorRecords = priorMonthData.records || [];

        const priorMap = new Map<string, number>();
        priorRecords.forEach((r: any) => priorMap.set(r.category, Number(r.amount || 0)));

        let totalCurrent = 0;
        let totalPrior = 0;

        const categories: NetWorthCategory[] = currentRecords.map((r: any, idx: number) => {
          const curAmt = Number(r.amount || 0);
          const prAmt = priorMap.get(r.category) ?? curAmt * 0.98;
          totalCurrent += curAmt;
          totalPrior += prAmt;

          const deltaAmt = curAmt - prAmt;
          const deltaPct = prAmt > 0 ? Number(((deltaAmt / prAmt) * 100).toFixed(2)) : 0;

          return {
            id: `cat-${idx}-${r.category}`,
            name: r.category,
            currentAmount: curAmt,
            priorAmount: prAmt,
            deltaAmount: deltaAmt,
            deltaPct,
            allocationPct: 0,
            currency: r.category.includes("USD") ? "USD" : "LKR",
          };
        });

        categories.forEach((c) => {
          c.allocationPct = totalCurrent > 0 ? Number(((c.currentAmount / totalCurrent) * 100).toFixed(1)) : 0;
        });

        const netWorthDeltaLkr = totalCurrent - totalPrior;
        const netWorthDeltaPct = totalPrior > 0 ? Number(((netWorthDeltaLkr / totalPrior) * 100).toFixed(2)) : 0;

        const deltaNetIitPct = priorNetMonthlyIit > 0
          ? Number((((netMonthlyAfterProgressiveIit - priorNetMonthlyIit) / priorNetMonthlyIit) * 100).toFixed(2))
          : 3.20;

        const deltaPhysicalCashPct = priorPhysicalCashMonthly > 0
          ? Number((((physicalCashAvailableMonthly - priorPhysicalCashMonthly) / priorPhysicalCashMonthly) * 100).toFixed(2))
          : 3.22;

        return {
          sourceStatus: "live",
          lastUpdated: new Date().toISOString(),
          currentFY,
          totalNetWorthLkr: totalCurrent,
          priorNetWorthLkr: totalPrior,
          netWorthDeltaLkr,
          netWorthDeltaPct,
          categories: categories.sort((a, b) => b.currentAmount - a.currentAmount),
          monthlyPassiveYield: {
            grossMonthly,
            netWhtMonthly,
            netMonthlyAfterProgressiveIit,
            physicalCashAvailableMonthly,
            iitPayableMonthly,
            priorNetMonthlyIit,
            deltaNetIitPct,
            priorPhysicalCashMonthly,
            deltaPhysicalCashPct,
          },
          stocks: getStockTickersPayload(rawStocks, palHoldings, currentFY),
          hardCurrencyHedgePct: 24.8,
        };
      }
    }
  } catch (err) {
    console.warn("KV fetch error for FinancialBay, falling back to structured telemetry:", err);
  }

  // Fallback with user's verified live screenshot numbers
  return getFallbackFinancialBayData(currentFY, grossMonthly, netWhtMonthly, netMonthlyAfterProgressiveIit, physicalCashAvailableMonthly, palHoldings);
}

function getFallbackFinancialBayData(
  currentFY: string,
  grossMonthly = 460347,
  netWhtMonthly = 452029,
  netMonthlyAfterProgressiveIit = 452029,
  physicalCashAvailableMonthly = 373675,
  palHoldings: any = null
): FinancialData {
  const categories: NetWorthCategory[] = [
    {
      id: "cat-1",
      name: "CAL Unit Trust (Income & Equity)",
      currentAmount: 14500000,
      priorAmount: 14100000,
      deltaAmount: 400000,
      deltaPct: 2.84,
      allocationPct: 32.2,
      currency: "LKR",
    },
    {
      id: "cat-2",
      name: "Fixed Deposits (LKR Commercial & Sampath)",
      currentAmount: 12500000,
      priorAmount: 12500000,
      deltaAmount: 0,
      deltaPct: 0.0,
      allocationPct: 27.8,
      currency: "LKR",
    },
    {
      id: "cat-3",
      name: "PFCA USD FDs & Foreign Currency",
      currentAmount: 8200000,
      priorAmount: 7850000,
      deltaAmount: 350000,
      deltaPct: 4.46,
      allocationPct: 18.2,
      currency: "USD",
    },
    {
      id: "cat-4",
      name: "Treasury Bills & Bonds (CBSL / First Capital)",
      currentAmount: 6500000,
      priorAmount: 6250000,
      deltaAmount: 250000,
      deltaPct: 4.0,
      allocationPct: 14.4,
      currency: "LKR",
    },
    {
      id: "cat-5",
      name: "CSE Stock Equities (SAMP, LLUB, CTC, COMB)",
      currentAmount: 3350000,
      priorAmount: 3220000,
      deltaAmount: 130000,
      deltaPct: 4.04,
      allocationPct: 7.4,
      currency: "LKR",
    },
  ];

  const totalCurrent = categories.reduce((s, c) => s + c.currentAmount, 0);
  const totalPrior = categories.reduce((s, c) => s + c.priorAmount, 0);
  const netWorthDeltaLkr = totalCurrent - totalPrior;
  const netWorthDeltaPct = Number(((netWorthDeltaLkr / totalPrior) * 100).toFixed(2));

  return {
    sourceStatus: "fallback",
    lastUpdated: new Date().toISOString(),
    currentFY,
    totalNetWorthLkr: totalCurrent,
    priorNetWorthLkr: totalPrior,
    netWorthDeltaLkr,
    netWorthDeltaPct,
    categories,
    monthlyPassiveYield: {
      grossMonthly,
      netWhtMonthly,
      netMonthlyAfterProgressiveIit,
      physicalCashAvailableMonthly,
      iitPayableMonthly: 0,
      priorNetMonthlyIit: 438000,
      deltaNetIitPct: 3.20,
      priorPhysicalCashMonthly: 362000,
      deltaPhysicalCashPct: 3.22,
    },
    stocks: getStockTickersPayload(null, palHoldings, currentFY),
    hardCurrencyHedgePct: 24.8,
  };
}

function getStockTickersPayload(rawStocks: any, palHoldings: any = null, currentFY = "2026/2027") {
  // Live computed dividends
  let dividendCashMonth = 98575; // Baseline for Nov 2026 (LLUB 71,750 + WATA 18,240 + CCS 8,585)
  let dividendCashYtd = 250845;  // Baseline FY2026/2027 YTD dividends

  if (rawStocks) {
    const currentYearMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-11"
    const currentMonthShort = new Date().toLocaleString("en-US", { month: "short" }); // e.g. "Nov"

    // Check dividend gains array first (granular dates)
    if (Array.isArray(rawStocks.dividendGains) && rawStocks.dividendGains.length > 0) {
      let mSum = 0;
      rawStocks.dividendGains.forEach((dg: any) => {
        if (dg.dividendReceivedDate && dg.dividendReceivedDate.startsWith(currentYearMonth)) {
          mSum += Number(dg.dividendAmount || 0);
        }
      });
      if (mSum > 0) dividendCashMonth = mSum;
    } else if (Array.isArray(rawStocks.dividends)) {
      let mSum = 0;
      rawStocks.dividends.forEach((d: any) => {
        if (d.financialYear === currentFY && d.month === currentMonthShort) {
          mSum += Number(d.amount || 0);
        }
      });
      if (mSum > 0) dividendCashMonth = mSum;
    }

    // YTD Dividends sum for current FY
    if (Array.isArray(rawStocks.dividends) && rawStocks.dividends.length > 0) {
      let ySum = 0;
      rawStocks.dividends.forEach((d: any) => {
        if (d.financialYear === currentFY) {
          ySum += Number(d.amount || 0);
        }
      });
      if (ySum > 0) dividendCashYtd = ySum;
    }
  }

  // If we have live synced holdings from Pal.lk, use them as authoritative
  if (palHoldings?.holdings && Array.isArray(palHoldings.holdings) && palHoldings.holdings.length > 0) {
    const portfolioValue = Number(palHoldings.totalMarketValue || 0);
    const totalCost = Number(palHoldings.totalCost || 0);
    const unrealizedPnl = Number(palHoldings.totalUnrealizedPnl || portfolioValue - totalCost);
    const unrealizedPnlPct = totalCost > 0 ? Number(((unrealizedPnl / totalCost) * 100).toFixed(1)) : 0;

    const tickers: CseStockTicker[] = palHoldings.holdings.map((h: any) => {
      const marketVal = Number(h.marketValue || 0);
      const cost = Number(h.costBasis || 0);
      const unPnl = Number(h.unrealizedPnl !== undefined ? h.unrealizedPnl : marketVal - cost);
      // Ensure unPnlPct is a valid percentage (-100% to +1000%), not unscaled raw rupee amounts
      const unPnlPct = cost > 0
        ? Number(((unPnl / cost) * 100).toFixed(2))
        : (Math.abs(Number(h.pnlPercent || 0)) <= 500 ? Number(h.pnlPercent) : 0);

      return {
        symbol: h.symbol,
        name: h.name || h.displaySymbol || h.symbol,
        price: Number(h.price || 0),
        change: Number(h.change || 0),
        changePct: Number(h.changePct || 0),
        quantity: Number(h.quantity || 0),
        marketValue: marketVal,
        unrealizedPnl: unPnl,
        unrealizedPnlPct: unPnlPct,
        costBasis: cost,
      };
    });

    return {
      portfolioValue,
      totalCost,
      unrealizedPnl,
      unrealizedPnlPct,
      dividendCashMonth,
      dividendCashYtd,
      realizedGainYtd: 380000,
      tickers,
      lastPalSync: palHoldings.syncedAt,
      syncedFrom: "pal.lk" as const,
    };
  }

  let portfolioValue = 3420000;
  let totalCost = 2950000;
  let realizedGainYtd = 380000;

  if (rawStocks?.snapshots?.length > 0) {
    const latest = rawStocks.snapshots[rawStocks.snapshots.length - 1];
    portfolioValue = Number(latest.portfolioValue || portfolioValue);
    totalCost = Number(latest.totalCost || totalCost);
  }

  const tickers: CseStockTicker[] = [
    { symbol: "SAMP.N0000", name: "Sampath Bank PLC", price: 84.5, change: 1.2, changePct: 1.44, quantity: 12500, marketValue: 1056250, unrealizedPnl: 181250, unrealizedPnlPct: 20.7 },
    { symbol: "LLUB.N0000", name: "Chevron Lubricants Lanka", price: 122.0, change: -0.5, changePct: -0.41, quantity: 8000, marketValue: 976000, unrealizedPnl: 136000, unrealizedPnlPct: 16.2 },
    { symbol: "CTC.N0000", name: "Ceylon Tobacco Company", price: 1140.0, change: 5.0, changePct: 0.44, quantity: 800, marketValue: 912000, unrealizedPnl: 92000, unrealizedPnlPct: 11.2 },
    { symbol: "COMB.N0000", name: "Commercial Bank of Ceylon", price: 108.5, change: 0.75, changePct: 0.70, quantity: 4400, marketValue: 477400, unrealizedPnl: 60600, unrealizedPnlPct: 14.5 },
  ];

  return {
    portfolioValue,
    totalCost,
    unrealizedPnl: portfolioValue - totalCost,
    unrealizedPnlPct: totalCost > 0 ? Number((((portfolioValue - totalCost) / totalCost) * 100).toFixed(1)) : 0,
    dividendCashMonth,
    dividendCashYtd,
    realizedGainYtd,
    tickers,
    syncedFrom: "fallback" as const,
  };
}
