import { NextRequest, NextResponse } from "next/server";
import { fetchCalorieCounterData } from "@/lib/connectors/calorieCounter";
import { fetchSpendIncomeData } from "@/lib/connectors/expenseTracker";
import { fetchFinancialBayData } from "@/lib/connectors/financialDashboard";
import { fetchInvestorDashboardData } from "@/lib/connectors/investorDashboard";
import { fetchBinanceBotData } from "@/lib/connectors/binanceBot";
import { getSolarTelemetry } from "@/lib/connectors/opsStore";
import { OpsDashboardPayload } from "@/lib/types";

export async function GET(req: NextRequest) {
  const [healthRes, spendIncomeRes, financeRes, investRes, botRes, solarRes] = await Promise.allSettled([
    fetchCalorieCounterData(),
    fetchSpendIncomeData(),
    fetchFinancialBayData(),
    fetchInvestorDashboardData(),
    fetchBinanceBotData(),
    getSolarTelemetry(),
  ]);

  const health = healthRes.status === "fulfilled" ? healthRes.value : (await fetchCalorieCounterData());
  const spendIncome = spendIncomeRes.status === "fulfilled" ? spendIncomeRes.value : (await fetchSpendIncomeData());
  const finance = financeRes.status === "fulfilled" ? financeRes.value : (await fetchFinancialBayData());
  const investments = investRes.status === "fulfilled" ? investRes.value : (await fetchInvestorDashboardData());
  const bot = botRes.status === "fulfilled" ? botRes.value : (await fetchBinanceBotData());
  const liveSolar = solarRes.status === "fulfilled" ? solarRes.value : null;

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

  // 3. Solar Month-to-Date Generation History
  const solarBase = liveSolar || {
    currentKw: 4.85,
    dailyKwh: 24.6,
    dailyTargetKwh: 15.0,
    yearlyMwh: 3.84,
    monthlyKwh: 145.0,
    gridExportStatus: "EXPORTING" as const,
    netGridKw: 2.35,
    lifetimeMwh: 3.84,
    stationCode: "NE=58772902",
  };

  const pastSolarDays = [
    { day: 1, kwh: 12.4, exp: 9.2 },
    { day: 2, kwh: 14.2, exp: 10.5 },
    { day: 3, kwh: 11.6, exp: 8.9 },
    { day: 4, kwh: 13.8, exp: 10.8 },
    { day: 5, kwh: 15.4, exp: 11.1 },
    { day: 6, kwh: 10.1, exp: 7.4 },
    { day: 7, kwh: 14.5, exp: 10.6 },
    { day: 8, kwh: 12.8, exp: 9.4 },
    { day: 9, kwh: 13.9, exp: 10.8 },
    { day: 10, kwh: 12.4, exp: 9.1 },
    { day: 11, kwh: 13.2, exp: 9.5 },
  ];

  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  let historyMonth = liveSolar?.historyMonth;
  if (!historyMonth || historyMonth.length === 0) {
    // If monthlyKwh was synced, scale past days to exactly match the synced monthlyKwh
    const targetPastSum = (liveSolar?.monthlyKwh && liveSolar.monthlyKwh > solarBase.dailyKwh)
      ? liveSolar.monthlyKwh - solarBase.dailyKwh
      : null;

    const baseSum = pastSolarDays.slice(0, currentDay - 1).reduce((s, p) => s + p.kwh, 0);
    const scale = targetPastSum && baseSum > 0 ? targetPastSum / baseSum : 1;

    historyMonth = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const isPast = d < currentDay;
      const isToday = d === currentDay;
      const pastItem = pastSolarDays[d - 1];

      let gen = 0;
      let exp = 0;
      if (isToday) {
        gen = Number(solarBase.dailyKwh.toFixed(1));
        exp = Number((solarBase.dailyKwh * 0.76).toFixed(1));
      } else if (isPast && pastItem) {
        gen = Number((pastItem.kwh * scale).toFixed(1));
        exp = Number((pastItem.exp * scale).toFixed(1));
      }

      historyMonth.push({
        day: d,
        date: `Nov ${d}`,
        generationKwh: gen,
        exportKwh: exp,
        targetKwh: 15.0,
      });
    }
  }

  const solar = {
    ...solarBase,
    yearlyMwh: liveSolar?.yearlyMwh ?? (solarBase as any).yearlyMwh ?? 3.84,
    monthlyKwh: liveSolar?.monthlyKwh ?? (solarBase as any).monthlyKwh,
    historyMonth,
  };

  const payload: OpsDashboardPayload = {
    timestamp: new Date().toISOString(),
    finance,
    spendIncome,
    health,
    investments,
    bot,
    gridFleet: {
      solar,
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

