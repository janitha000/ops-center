import { NextRequest, NextResponse } from "next/server";
import { fetchCalorieCounterData } from "@/lib/connectors/calorieCounter";
import { fetchSpendIncomeData } from "@/lib/connectors/expenseTracker";
import { fetchFinancialBayData } from "@/lib/connectors/financialDashboard";
import { fetchInvestorDashboardData } from "@/lib/connectors/investorDashboard";
import { fetchBinanceBotData } from "@/lib/connectors/binanceBot";
import { getSolarTelemetry, fetchFusionSolarKioskData } from "@/lib/connectors/opsStore";
import { OpsDashboardPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAST_SOLAR_WEIGHTS = [
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

function buildSolarHistoryMonth(monthlyKwh: number, todayDailyKwh: number, targetKwh = 15.0) {
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const targetPastSum = monthlyKwh > todayDailyKwh ? monthlyKwh - todayDailyKwh : 0;
  const pastItems = PAST_SOLAR_WEIGHTS.slice(0, Math.max(0, currentDay - 1));
  const baseSum = pastItems.reduce((s, p) => s + p.kwh, 0);
  const scale = targetPastSum > 0 && baseSum > 0 ? targetPastSum / baseSum : 1;

  const history = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const isPast = d < currentDay;
    const isToday = d === currentDay;
    const pastItem = PAST_SOLAR_WEIGHTS[d - 1];

    let gen = 0;
    let exp = 0;
    if (isToday) {
      gen = Number(todayDailyKwh.toFixed(1));
      exp = Number((todayDailyKwh * 0.76).toFixed(1));
    } else if (isPast && pastItem) {
      gen = Number((pastItem.kwh * scale).toFixed(1));
      exp = Number((pastItem.exp * scale).toFixed(1));
    }

    history.push({
      day: d,
      date: `Nov ${d}`,
      generationKwh: gen,
      exportKwh: exp,
      targetKwh,
    });
  }

  return history;
}

export async function GET(req: NextRequest) {
  const zone = req.nextUrl.searchParams.get("zone")?.toLowerCase();

  // ── ZONE-SPECIFIC TARGETED SYNC ──
  if (zone === "zone1" || zone === "finance") {
    const [finance, investments] = await Promise.all([
      fetchFinancialBayData(),
      fetchInvestorDashboardData(),
    ]);
    return NextResponse.json({ finance, investments });
  }

  if (zone === "zone2" || zone === "spend") {
    const spendIncome = await fetchSpendIncomeData();
    return NextResponse.json({ spendIncome });
  }

  if (zone === "zone3" || zone === "health") {
    const health = await fetchCalorieCounterData();
    return NextResponse.json({ health });
  }

  if (zone === "zone4" || zone === "solar" || zone === "fleet") {
    let liveSolar = await fetchFusionSolarKioskData();
    if (!liveSolar) {
      liveSolar = await getSolarTelemetry();
    }
    const solarBase = liveSolar || {
      currentKw: 4.85,
      dailyKwh: 24.6,
      dailyTargetKwh: 15.0,
      yearlyMwh: 3.85,
      monthlyKwh: 145.0,
      gridExportStatus: "EXPORTING" as const,
      netGridKw: 2.35,
      lifetimeMwh: 4.65,
      stationCode: "NE=58772902",
      lastSynced: new Date().toISOString(),
    };

    let historyMonth = liveSolar?.historyMonth;
    if (!historyMonth || historyMonth.length === 0) {
      const monthYield = Number(liveSolar?.monthlyKwh || solarBase.monthlyKwh || 111.8);
      const todayYield = Number(solarBase.dailyKwh || 1.98);
      historyMonth = buildSolarHistoryMonth(monthYield, todayYield, 15.0);
    }

    const solar = {
      ...solarBase,
      dailyTargetKwh: 15.0,
      yearlyMwh: liveSolar?.yearlyMwh ?? (solarBase as any).yearlyMwh ?? 3.85,
      monthlyKwh: liveSolar?.monthlyKwh ?? (solarBase as any).monthlyKwh ?? 111.8,
      historyMonth,
    };

    return NextResponse.json({
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
    });
  }

  if (zone === "zone5" || zone === "bot") {
    const bot = await fetchBinanceBotData();
    return NextResponse.json({ bot });
  }

  if (zone === "zone6" || zone === "ops") {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
    });
  }

  // ── FULL DASHBOARD CONCURRENT SYNC ──
  const [healthRes, spendIncomeRes, financeRes, investRes, botRes, kioskSolarRes, savedSolarRes] = await Promise.allSettled([
    fetchCalorieCounterData(),
    fetchSpendIncomeData(),
    fetchFinancialBayData(),
    fetchInvestorDashboardData(),
    fetchBinanceBotData(),
    fetchFusionSolarKioskData(),
    getSolarTelemetry(),
  ]);

  const health = healthRes.status === "fulfilled" ? healthRes.value : (await fetchCalorieCounterData());
  const spendIncome = spendIncomeRes.status === "fulfilled" ? spendIncomeRes.value : (await fetchSpendIncomeData());
  const finance = financeRes.status === "fulfilled" ? financeRes.value : (await fetchFinancialBayData());
  const investments = investRes.status === "fulfilled" ? investRes.value : (await fetchInvestorDashboardData());
  const bot = botRes.status === "fulfilled" ? botRes.value : (await fetchBinanceBotData());
  const liveSolar = (kioskSolarRes.status === "fulfilled" && kioskSolarRes.value)
    ? kioskSolarRes.value
    : (savedSolarRes.status === "fulfilled" ? savedSolarRes.value : null);

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

  let historyMonth = liveSolar?.historyMonth;
  if (!historyMonth || historyMonth.length === 0) {
    const monthYield = Number(liveSolar?.monthlyKwh || solarBase.monthlyKwh || 111.8);
    const todayYield = Number(solarBase.dailyKwh || 1.98);
    historyMonth = buildSolarHistoryMonth(monthYield, todayYield, 15.0);
  }

  const solar = {
    ...solarBase,
    dailyTargetKwh: 15.0,
    lastSynced: liveSolar?.lastSynced || new Date().toISOString(),
    yearlyMwh: liveSolar?.yearlyMwh ?? (solarBase as any).yearlyMwh ?? 3.85,
    monthlyKwh: liveSolar?.monthlyKwh ?? (solarBase as any).monthlyKwh ?? 111.8,
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

