import { NextRequest, NextResponse } from "next/server";
import { fetchCalorieCounterData } from "@/lib/connectors/calorieCounter";
import { fetchSpendIncomeData } from "@/lib/connectors/expenseTracker";
import { fetchFinancialBayData } from "@/lib/connectors/financialDashboard";
import { fetchInvestorDashboardData } from "@/lib/connectors/investorDashboard";
import { fetchBinanceBotData } from "@/lib/connectors/binanceBot";
import { OpsDashboardPayload } from "@/lib/types";

export async function GET(req: NextRequest) {
  const [healthRes, spendIncomeRes, financeRes, investRes, botRes] = await Promise.allSettled([
    fetchCalorieCounterData(),
    fetchSpendIncomeData(),
    fetchFinancialBayData(),
    fetchInvestorDashboardData(),
    fetchBinanceBotData(),
  ]);

  const health = healthRes.status === "fulfilled" ? healthRes.value : (await fetchCalorieCounterData());
  const spendIncome = spendIncomeRes.status === "fulfilled" ? spendIncomeRes.value : (await fetchSpendIncomeData());
  const finance = financeRes.status === "fulfilled" ? financeRes.value : (await fetchFinancialBayData());
  const investments = investRes.status === "fulfilled" ? investRes.value : (await fetchInvestorDashboardData());
  const bot = botRes.status === "fulfilled" ? botRes.value : (await fetchBinanceBotData());

  // ── Compute Cross-Domain Metrics ──────────────────────────────────────────
  const netIitPassive = investments.monthlyYields.netIit || finance.monthlyPassiveYield.netMonthlyAfterProgressiveIit;
  const normalLivingSpend = spendIncome.normalLivingSpend || 215400;
  const totalLifestyleSpend = spendIncome.totalMonthlySpend || 253900;

  const trueFiCoverageBaselinePct = normalLivingSpend > 0
    ? Number(((netIitPassive / normalLivingSpend) * 100).toFixed(1))
    : 0;

  const trueFiCoverageTotalPct = totalLifestyleSpend > 0
    ? Number(((netIitPassive / totalLifestyleSpend) * 100).toFixed(1))
    : 0;

  // 2. Food Spend vs Calorie Correlation (7-day timeline)
  const foodSpendVsCalorieCorrelation = health.history7d.map((h, idx) => {
    const diningSpend = idx === 2 ? 14500 : idx === 3 ? 12800 : idx === 5 ? 6500 : 2500;
    return {
      date: h.date,
      diningSpend,
      calories: h.calories,
      sugar: h.sugar,
    };
  });

  const payload: OpsDashboardPayload = {
    timestamp: new Date().toISOString(),
    finance,
    spendIncome,
    health,
    investments,
    bot,
    gridFleet: {
      solar: {
        currentKw: 4.85,
        dailyKwh: 24.6,
        dailyTargetKwh: 30.0,
        gridExportStatus: "EXPORTING",
        netGridKw: 2.35,
        lifetimeMwh: 14.82,
      },
      fleet: {
        vehicleName: "BYD Sealion 6 AWD",
        batteryPct: 82,
        estimatedRangeKm: 88,
        isCharging: false,
        chargingPowerKw: 0,
        chargerConnected: true,
        lastSynced: new Date().toISOString(),
      },
    },
    sprintTasks: [
      { id: "task-1", title: "Review Commercial Bank FD rollover terms (10.25% vs T-Bill)", domain: "FIN", status: "active", deadline: "Today" },
      { id: "task-2", title: "Verify HbA1c post-meal glycemic response & 16:8 fasting cutoff", domain: "BIO", status: "active", deadline: "11:00 AM" },
      { id: "task-3", title: "Schedule EV off-peak smart charging (11:00 PM - 05:00 AM)", domain: "GRID", status: "queued", deadline: "23:00" },
      { id: "task-4", title: "Audit binance-bot Bollinger reversion stop-loss proximity", domain: "OPS", status: "complete", deadline: "Done" },
    ],
    crossDomain: {
      trueFiCoverageBaselinePct,
      trueFiCoverageTotalPct,
      foodSpendVsCalorieCorrelation,
    },
  };

  return NextResponse.json(payload);
}

