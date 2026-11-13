import type {
  BotPosition,
  MaturityRadarItem,
  OpsDashboardPayload,
  SprintTask,
} from "@/lib/types";
import { formatLKR, formatUSD } from "@/lib/utils";
import type {
  DecisionHorizon,
  DecisionSeverity,
  DecisionSignal,
  TemporalDashboardModel,
} from "./types";

const CEB_NET_PLUS_TARIFF_LKR = 37;
const DEFAULT_SOLAR_EXPORT_RATIO = 0.76;
const DEFAULT_SOLAR_DAILY_TARGET_KWH = 15.0;
const DEFAULT_FASTING_GOAL_MINUTES = 960;
const EATING_WINDOW_MINUTES = 480;
const BLENDED_POST_TAX_PORTFOLIO_YIELD = 0.096;
const DEFAULT_USD_LKR_RATE = 310;
const FALLBACK_POST_TAX_FD_RATE_PCT = 8.78;
const KCAL_PER_KG_FAT = 7700;

const SEVERITY_RANK: Record<DecisionSeverity, number> = {
  critical: 0,
  warning: 1,
  opportunity: 2,
  nominal: 3,
};

const HORIZON_RANK: Record<DecisionHorizon, number> = {
  live: 0,
  daily: 1,
  monthly: 2,
};

function safeNum(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safePositive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function roundTo(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatDurationMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return hours > 0 ? `${hours}h ${rem}m` : `${rem}m`;
}

function formatTickerLkr(price: number): string {
  return `Rs. ${price.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getReferenceDate(timestamp?: string): Date {
  if (timestamp) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

function getReferenceHour(timestamp?: string): number {
  return getReferenceDate(timestamp).getHours();
}

function formatClockTime(iso: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Colombo",
  });
}

function normalizeGridExportStatus(
  status: unknown
): "EXPORTING" | "IMPORTING" | "NEUTRAL" {
  if (status === "EXPORTING" || status === "IMPORTING" || status === "NEUTRAL") {
    return status;
  }
  return "NEUTRAL";
}

function normalizeMinPrices(
  minStockPrices?: Record<string, number>
): Record<string, number> {
  const normalized: Record<string, number> = {};
  if (!minStockPrices) return normalized;
  for (const [symbol, price] of Object.entries(minStockPrices)) {
    if (typeof price === "number" && Number.isFinite(price) && price > 0) {
      normalized[symbol.toUpperCase()] = price;
    }
  }
  return normalized;
}

function extractOpenPositions(payload: OpsDashboardPayload): BotPosition[] {
  const explicit = payload.bot?.openPositions;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit;
  }
  const slots = payload.bot?.slots ?? [];
  return slots
    .filter((slot) => slot.hasOpenPosition)
    .map((slot) => ({
      id: slot.slotId,
      symbol: slot.symbol,
      side: "LONG" as const,
      entryPrice: safeNum(slot.entryPrice),
      currentPrice: safeNum(slot.currentPrice),
      amount: 0,
      cost: 0,
      unrealizedPnl: safeNum(slot.unrealizedPnl),
      unrealizedPnlPct: safeNum(slot.unrealizedPnlPct),
      stopLoss: safeNum(slot.stopLoss),
      takeProfit: safeNum(slot.takeProfit),
      strategy: slot.strategy,
    }));
}

function computeLiveSummary(
  payload: OpsDashboardPayload,
  normalizedMinPrices: Record<string, number>
): TemporalDashboardModel["live"] {
  const solar = payload.gridFleet?.solar;
  const fleet = payload.gridFleet?.fleet;
  const today = payload.health?.today;
  const bot = payload.bot;
  const tickers = payload.finance?.stocks?.tickers ?? [];
  const refMs = getReferenceDate(payload.timestamp).getTime();

  const openPositions = extractOpenPositions(payload);
  const botUnrealizedPnlUsdt = roundTo(
    openPositions.reduce((sum, pos) => sum + safeNum(pos.unrealizedPnl), 0),
    2
  );

  const fastingActive = Boolean(today?.isFastingActive);
  const fastingMinutes = safeNum(today?.fastingMinutes);
  const fastingGoalMinutes = safePositive(
    today?.fastingGoalMinutes,
    DEFAULT_FASTING_GOAL_MINUTES
  );
  const fastingPct = Math.min(
    100,
    Math.max(0, Math.round((fastingMinutes / fastingGoalMinutes) * 100))
  );

  const fastBrokenAt =
    !fastingActive && today?.fastingEndTime ? today.fastingEndTime : null;
  let eatingWindowClosesAt: string | null = null;
  let eatingWindowRemainingMinutes = 0;
  let eatingWindowActive = false;

  if (fastBrokenAt) {
    const fastBrokenMs = Date.parse(fastBrokenAt);
    if (!Number.isNaN(fastBrokenMs)) {
      const closesAtMs = fastBrokenMs + EATING_WINDOW_MINUTES * 60 * 1000;
      eatingWindowClosesAt = new Date(closesAtMs).toISOString();
      const elapsedMinutes = Math.max(0, (refMs - fastBrokenMs) / 60000);
      eatingWindowRemainingMinutes = Math.max(
        0,
        Math.round(EATING_WINDOW_MINUTES - elapsedMinutes)
      );
      eatingWindowActive = eatingWindowRemainingMinutes > 0;
    }
  }

  const botFreeUsdt = roundTo(safeNum(bot?.freeUsdt), 2);
  const botTotalWalletUsdt = roundTo(safeNum(bot?.totalWalletUsdt), 2);
  const botActiveSignalsCount = (bot?.slots ?? []).filter(
    (slot) => slot.enabled && slot.lastSignal && slot.lastSignal.toUpperCase() !== "HOLD"
  ).length;
  const botIdleCashPct =
    botTotalWalletUsdt > 0 ? roundTo((botFreeUsdt / botTotalWalletUsdt) * 100, 1) : 0;

  const cseAlertsCount = tickers.reduce((count, ticker) => {
    const target = normalizedMinPrices[ticker.symbol.toUpperCase()];
    return target && ticker.price > 0 && ticker.price <= target ? count + 1 : count;
  }, 0);

  let cseTopMoverSymbol: string | null = null;
  let cseTopMoverChangePct = 0;
  let maxAbsChange = -1;
  for (const ticker of tickers) {
    const absChange = Math.abs(safeNum(ticker.changePct));
    if (absChange > maxAbsChange) {
      maxAbsChange = absChange;
      cseTopMoverSymbol = ticker.symbol;
      cseTopMoverChangePct = roundTo(safeNum(ticker.changePct), 2);
    }
  }

  const totalPortfolioVal = safePositive(
    payload.finance?.stocks?.portfolioValue,
    tickers.reduce((sum, t) => sum + safeNum(t.marketValue), 0)
  );
  let cseMaxConcentrationSymbol: string | null = null;
  let cseMaxConcentrationPct = 0;
  if (totalPortfolioVal > 0) {
    for (const ticker of tickers) {
      const pct = (safeNum(ticker.marketValue) / totalPortfolioVal) * 100;
      if (pct > cseMaxConcentrationPct) {
        cseMaxConcentrationPct = pct;
        cseMaxConcentrationSymbol = ticker.symbol;
      }
    }
    cseMaxConcentrationPct = roundTo(cseMaxConcentrationPct, 1);
  }

  return {
    solarKw: roundTo(safeNum(solar?.currentKw), 2),
    gridExportStatus: normalizeGridExportStatus(solar?.gridExportStatus),
    netGridKw: roundTo(safeNum(solar?.netGridKw), 2),
    evBatteryPct: Math.round(safeNum(fleet?.batteryPct)),
    evRangeKm: Math.round(safeNum(fleet?.estimatedRangeKm)),
    evIsCharging: Boolean(fleet?.isCharging),
    evChargerConnected: Boolean(fleet?.chargerConnected),
    fastingActive,
    fastingMinutes,
    fastingGoalMinutes,
    fastingPct,
    fastingStartTime: today?.fastingStartTime ?? null,
    eatingWindowActive,
    fastBrokenAt,
    eatingWindowClosesAt,
    eatingWindowRemainingMinutes,
    botRunning: Boolean(bot?.isRunning),
    botMode: bot?.mode ?? "offline",
    botOpenPositionsCount: Math.max(
      safeNum(bot?.openPositionsCount),
      openPositions.length
    ),
    botFreeUsdt,
    botTotalWalletUsdt,
    botUnrealizedPnlUsdt,
    botActiveSignalsCount,
    botIdleCashPct,
    cseStockCount: tickers.length,
    cseAlertsCount,
    cseTopMoverSymbol,
    cseTopMoverChangePct,
    cseMaxConcentrationSymbol,
    cseMaxConcentrationPct,
  };
}

function computeDailySummary(
  payload: OpsDashboardPayload
): TemporalDashboardModel["daily"] {
  const today = payload.health?.today;
  const biometrics = payload.health?.biometrics;
  const spendIncome = payload.spendIncome;
  const solar = payload.gridFleet?.solar;
  const tasks = payload.sprintTasks ?? [];
  const refDate = getReferenceDate(payload.timestamp);

  const caloriesIntake = Math.round(safeNum(today?.calories));
  const calorieLimit = Math.round(safePositive(today?.calorieLimit, 2000));
  const caloriesExpended = Math.round(
    safeNum(today?.caloriesExpended ?? biometrics?.todayCaloriesExpended)
  );
  const targetCaloriesExpended = Math.round(
    safePositive(biometrics?.targetCaloriesExpended, 500)
  );

  const proteinGrams = roundTo(safeNum(today?.protein), 1);
  const proteinGoal = roundTo(safePositive(today?.proteinGoal, 120), 1);
  const sugarGrams = roundTo(safeNum(today?.sugar), 1);
  const sugarLimit = roundTo(safePositive(today?.sugarLimit, 30), 1);
  const carbsGrams = roundTo(safeNum(today?.carbs), 1);
  const fatGrams = roundTo(safeNum(today?.fat), 1);

  const remainingCaloriesToday = Math.max(0, calorieLimit - caloriesIntake);
  const remainingProteinGrams = Math.max(0, roundTo(proteinGoal - proteinGrams, 1));
  const remainingSugarGrams = Math.max(0, roundTo(sugarLimit - sugarGrams, 1));
  const nextMealPrescription =
    remainingCaloriesToday > 0
      ? `Target ${remainingProteinGrams}g protein within ${remainingCaloriesToday} kcal (<= ${remainingSugarGrams}g sugar)`
      : "0 kcal remaining — close eating window & hydrate";

  const dailySpendLkr = Math.round(
    safeNum(
      spendIncome?.todayActualSpend ?? spendIncome?.outflow?.household?.todayActualSpend
    )
  );
  const dailySafeBurnRateLkr = Math.round(
    safeNum(
      spendIncome?.dailySafeBurnRate ?? spendIncome?.outflow?.household?.dailySafeBurnRate
    )
  );

  let dailyBurnStatus: "SAFE" | "CAUTION" | "OVER_PACE" = "SAFE";
  if (dailySafeBurnRateLkr > 0) {
    if (dailySpendLkr > dailySafeBurnRateLkr) {
      dailyBurnStatus = "OVER_PACE";
    } else if (dailySpendLkr >= dailySafeBurnRateLkr * 0.85) {
      dailyBurnStatus = "CAUTION";
    }
  }

  const currentDay = refDate.getDate();
  const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
  const monthElapsedPct =
    daysInMonth > 0 ? roundTo((currentDay / daysInMonth) * 100, 1) : 0;
  const budgetUtilizationPct = roundTo(safeNum(spendIncome?.budgetUtilizationPct), 1);
  const calendarPaceVariancePct = roundTo(budgetUtilizationPct - monthElapsedPct, 1);

  const solarDailyKwh = roundTo(safeNum(solar?.dailyKwh), 1);
  const solarDailyTargetKwh = roundTo(
    safePositive(solar?.dailyTargetKwh, DEFAULT_SOLAR_DAILY_TARGET_KWH),
    1
  );
  const solarDailyPct = Math.max(
    0,
    Math.round((solarDailyKwh / solarDailyTargetKwh) * 100)
  );

  const todayDay = currentDay;
  const todayHistory = solar?.historyMonth?.find((h) => h.day === todayDay);
  const dailyExportKwh =
    todayHistory && todayHistory.exportKwh > 0
      ? todayHistory.exportKwh
      : solarDailyKwh * DEFAULT_SOLAR_EXPORT_RATIO;
  const solarDailyEstRevenueLkr = Math.round(dailyExportKwh * CEB_NET_PLUS_TARIFF_LKR);

  const activeTasksCount = tasks.filter((t) => t.status === "active").length;
  const completedTasksCount = tasks.filter((t) => t.status === "complete").length;

  return {
    caloriesIntake,
    calorieLimit,
    caloriesExpended,
    targetCaloriesExpended,
    netCalorieBalance: caloriesIntake - caloriesExpended,
    proteinGrams,
    proteinGoal,
    sugarGrams,
    sugarLimit,
    waterGlasses: Math.round(safeNum(today?.waterGlasses)),
    waterGoal: Math.round(safePositive(today?.waterGoal, 8)),
    streakDays: Math.round(safeNum(today?.streakDays)),
    todayWeightKg: roundTo(
      safeNum(today?.weightKg ?? biometrics?.todayWeightKg),
      1
    ),
    targetWeightKg: roundTo(safeNum(biometrics?.targetWeightKg), 1),
    dailySpendLkr,
    dailySafeBurnRateLkr,
    dailyBurnStatus,
    monthElapsedPct,
    calendarPaceVariancePct,
    remainingCaloriesToday,
    remainingProteinGrams,
    remainingSugarGrams,
    carbsGrams,
    fatGrams,
    nextMealPrescription,
    solarDailyKwh,
    solarDailyTargetKwh,
    solarDailyPct,
    solarDailyEstRevenueLkr,
    activeTasksCount,
    completedTasksCount,
  };
}

function computeMonthlySummary(
  payload: OpsDashboardPayload
): TemporalDashboardModel["monthly"] {
  const finance = payload.finance;
  const spendIncome = payload.spendIncome;
  const investments = payload.investments;
  const solar = payload.gridFleet?.solar;
  const bot = payload.bot;
  const health = payload.health;
  const crossDomain = payload.crossDomain;
  const refDate = getReferenceDate(payload.timestamp);

  const totalInflowLkr = Math.round(
    safeNum(spendIncome?.inflow?.totalInflow ?? spendIncome?.totalMonthlyIncome)
  );
  const totalOutflowLkr = Math.round(
    safeNum(spendIncome?.outflow?.totalOutflow ?? spendIncome?.totalMonthlySpend)
  );
  const netCashFlowLkr = Math.round(
    safeNum(spendIncome?.netCashFlow, totalInflowLkr - totalOutflowLkr)
  );
  const normalLivingSpendLkr = Math.round(
    safeNum(
      spendIncome?.normalLivingSpend ?? spendIncome?.outflow?.household?.normal
    )
  );

  const maturityRadar = investments?.maturityRadar ?? [];
  const urgentMaturitiesCount = maturityRadar.filter(
    (m) => Number.isFinite(m.daysRemaining) && m.daysRemaining <= 7
  ).length;
  const warningMaturitiesCount = maturityRadar.filter(
    (m) =>
      Number.isFinite(m.daysRemaining) && m.daysRemaining > 7 && m.daysRemaining <= 30
  ).length;

  const validDays = maturityRadar
    .map((m) => m.daysRemaining)
    .filter((d) => Number.isFinite(d));
  const nonNegativeDays = validDays.filter((d) => d >= 0);
  const nextMaturityDays =
    nonNegativeDays.length > 0
      ? Math.min(...nonNegativeDays)
      : validDays.length > 0
      ? Math.min(...validDays)
      : null;

  const currentDay = refDate.getDate();
  const history = solar?.historyMonth ?? [];
  const historyMtdGen = history
    .filter((h) => h.day <= currentDay)
    .reduce((sum, h) => sum + safeNum(h.generationKwh), 0);
  const solarMtdKwh = roundTo(
    solar?.monthlyKwh && solar.monthlyKwh > 0
      ? solar.monthlyKwh
      : historyMtdGen > 0
      ? historyMtdGen
      : safeNum(solar?.dailyKwh),
    1
  );
  const historyMtdExport = history
    .filter((h) => h.day <= currentDay)
    .reduce((sum, h) => sum + safeNum(h.exportKwh), 0);
  const solarMtdRevenueLkr = Math.round(
    (historyMtdExport > 0
      ? historyMtdExport
      : solarMtdKwh * DEFAULT_SOLAR_EXPORT_RATIO) * CEB_NET_PLUS_TARIFF_LKR
  );

  // OD Cost vs. Fixed Income Yield Arbitrage
  const odItems = spendIncome?.outflow?.od?.items ?? [];
  const odDrawnLkr = Math.round(
    odItems.reduce((sum, i) => sum + safeNum(i.currentDrawn), 0)
  );
  const odLimitLkr = Math.round(
    odItems.reduce((sum, i) => sum + safeNum(i.overdraftLimit), 0)
  );
  const odLatestInterestLkr = Math.round(
    odItems.reduce((sum, i) => sum + safeNum(i.latestInterest), 0)
  );
  const odEffectiveAnnualRatePct =
    odDrawnLkr > 0 ? roundTo(((odLatestInterestLkr * 12) / odDrawnLkr) * 100, 2) : 0;
  const lkrFdRates = maturityRadar
    .filter((m) => m.type === "fd" && m.currency === "LKR" && safeNum(m.rate) > 0)
    .map((m) => m.rate);
  const lowestPostTaxFdRatePct =
    lkrFdRates.length > 0
      ? roundTo(Math.min(...lkrFdRates) * 0.9, 2)
      : FALLBACK_POST_TAX_FD_RATE_PCT;
  const odVsFdArbitrageSpreadPct =
    odDrawnLkr > 0 && odEffectiveAnnualRatePct > 0
      ? roundTo(odEffectiveAnnualRatePct - lowestPostTaxFdRatePct, 2)
      : 0;

  // Category Budget Breach Radar
  const rawCategories =
    (spendIncome?.categories && spendIncome.categories.length > 0
      ? spendIncome.categories
      : spendIncome?.outflow?.household?.categories) ?? [];
  const breachedCategories = rawCategories
    .filter(
      (c) =>
        c.parentType === "normal" &&
        c.id !== "cat-undocumented" &&
        safeNum(c.budgetAmount) > 0 &&
        safeNum(c.amount) > safeNum(c.budgetAmount)
    )
    .map((c) => {
      const amountLkr = Math.round(safeNum(c.amount));
      const budgetLkr = Math.round(safeNum(c.budgetAmount));
      return {
        name: c.name,
        amountLkr,
        budgetLkr,
        overrunLkr: amountLkr - budgetLkr,
      };
    })
    .sort((a, b) => b.overrunLkr - a.overrunLkr);

  const breachedCategoriesCount = breachedCategories.length;
  const topBreachedCategories = breachedCategories.slice(0, 4);
  const undocCat = rawCategories.find((c) => c.id === "cat-undocumented");
  const undocumentedBufferLkr = Math.round(
    safeNum(
      spendIncome?.outflow?.household?.undocumentedBuffer,
      safeNum(undocCat?.amount)
    )
  );

  // Expected Fat Loss vs. Actual Scale Weight Delta & Target Weight ETA
  const biometrics = health?.biometrics;
  const mtdIntake = safeNum(biometrics?.mtdCaloriesIntake);
  const mtdBurn = safeNum(biometrics?.mtdCaloriesExpended);
  const mtdCalorieDeficitKcal = Math.round(mtdBurn - mtdIntake);
  const expectedFatLossMtdKg = roundTo((mtdIntake - mtdBurn) / KCAL_PER_KG_FAT, 2);
  const todayWeightKg = safeNum(health?.today?.weightKg ?? biometrics?.todayWeightKg);
  const targetWeightKg = safeNum(biometrics?.targetWeightKg);
  const avgDailyDeficit =
    safeNum(biometrics?.avgDailyCaloriesExpended) -
    safeNum(biometrics?.avgDailyCaloriesIntake);
  const estimatedDaysToTargetWeight =
    targetWeightKg > 0 && todayWeightKg > targetWeightKg && avgDailyDeficit > 100
      ? Math.round(((todayWeightKg - targetWeightKg) * KCAL_PER_KG_FAT) / avgDailyDeficit)
      : null;

  // Tax Efficiency & USD Hard Currency Hedge
  const incomeCategories = finance?.incomeCategories ?? [];
  let taxFreeMonthly = 0;
  let whtTaxedMonthly = 0;
  let usdFromCategories = 0;
  for (const cat of incomeCategories) {
    const net = safeNum(cat.netMonthly);
    const isTaxFree =
      cat.badgeType === "ut" ||
      cat.badgeType === "cse" ||
      cat.badgeType === "pfca" ||
      Boolean(cat.note && /tax-free/i.test(cat.note));
    if (isTaxFree) {
      taxFreeMonthly += net;
    } else {
      whtTaxedMonthly += net;
    }
    usdFromCategories += safeNum(cat.usdInvested);
  }
  const totalIncomeCategoriesNet = taxFreeMonthly + whtTaxedMonthly;
  const taxFreePassiveSharePct =
    totalIncomeCategoriesNet > 0
      ? roundTo((taxFreeMonthly / totalIncomeCategoriesNet) * 100, 1)
      : 0;
  const whtTaxedPassiveSharePct =
    totalIncomeCategoriesNet > 0
      ? roundTo((whtTaxedMonthly / totalIncomeCategoriesNet) * 100, 1)
      : 0;
  const hardCurrencyHedgePct = roundTo(safeNum(finance?.hardCurrencyHedgePct, 24.8), 1);
  const usdInvestedTotal = usdFromCategories > 0 ? Math.round(usdFromCategories) : 58000;

  // Cross-Domain Executive Metrics
  const botMtdRealizedPnlUsdt = roundTo(
    safeNum(bot?.monthRealizedPnlUsdt ?? bot?.totalRealizedPnlUsdt),
    2
  );
  const monthlyFreedomVelocityLkr =
    netCashFlowLkr > 0
      ? Math.round((netCashFlowLkr * BLENDED_POST_TAX_PORTFOLIO_YIELD) / 12)
      : 0;
  const monthlyFiCoverageGainPct =
    normalLivingSpendLkr > 0
      ? roundTo((monthlyFreedomVelocityLkr / normalLivingSpendLkr) * 100, 2)
      : 0;

  const utilitiesAndSubsSum = Math.round(
    rawCategories
      .filter(
        (c) =>
          c.parentType === "normal" &&
          (/util|bill|subscrip/i.test(c.name) ||
            c.id === "cat-util" ||
            c.id === "cat-sub")
      )
      .reduce((sum, c) => sum + safeNum(c.amount), 0)
  );
  const utilitiesAndSubsSpendLkr = utilitiesAndSubsSum > 0 ? utilitiesAndSubsSum : 41300;
  const solarBotUtilityOffsetPct = roundTo(
    ((solarMtdRevenueLkr + Math.max(0, botMtdRealizedPnlUsdt * DEFAULT_USD_LKR_RATE)) /
      Math.max(1, utilitiesAndSubsSpendLkr)) *
      100,
    1
  );

  return {
    currentMonth:
      spendIncome?.currentMonth || refDate.toISOString().slice(0, 7),
    totalNetWorthLkr: Math.round(safeNum(finance?.totalNetWorthLkr)),
    netWorthDeltaPct: roundTo(safeNum(finance?.netWorthDeltaPct), 2),
    netMonthlyPassiveAfterIitLkr: Math.round(
      safeNum(
        finance?.monthlyPassiveYield?.netMonthlyAfterProgressiveIit ??
          investments?.monthlyYields?.netIit
      )
    ),
    physicalCashAvailableMonthlyLkr: Math.round(
      safeNum(
        finance?.monthlyPassiveYield?.physicalCashAvailableMonthly ??
          investments?.monthlyYields?.physicalCash
      )
    ),
    trueFiCoverageBaselinePct: roundTo(
      safeNum(crossDomain?.trueFiCoverageBaselinePct),
      1
    ),
    trueFiCoverageTotalPct: roundTo(
      safeNum(crossDomain?.trueFiCoverageTotalPct),
      1
    ),
    totalInflowLkr,
    totalOutflowLkr,
    netCashFlowLkr,
    savingsRatePct: roundTo(safeNum(spendIncome?.savingsRatePct), 1),
    budgetUtilizationPct: roundTo(safeNum(spendIncome?.budgetUtilizationPct), 1),
    normalLivingSpendLkr,
    baselineBudgetLkr: Math.round(
      safeNum(
        spendIncome?.baselineBudget ?? spendIncome?.outflow?.household?.baselineBudget
      )
    ),
    dailyAverageSpendLkr: Math.round(
      safeNum(
        spendIncome?.dailyAverageSpend ?? spendIncome?.outflow?.household?.dailyAverageSpend
      )
    ),
    urgentMaturitiesCount,
    warningMaturitiesCount,
    nextMaturityDays,
    solarMtdKwh,
    solarMtdRevenueLkr,
    botMtdRealizedPnlUsdt,
    botWinRatePct: roundTo(safeNum(bot?.winRatePct), 1),
    weightDeltaMtdKg: roundTo(safeNum(health?.biometrics?.weightDeltaMtdKg), 1),
    odDrawnLkr,
    odLimitLkr,
    odLatestInterestLkr,
    odEffectiveAnnualRatePct,
    lowestPostTaxFdRatePct,
    odVsFdArbitrageSpreadPct,
    breachedCategoriesCount,
    topBreachedCategories,
    undocumentedBufferLkr,
    mtdCalorieDeficitKcal,
    expectedFatLossMtdKg,
    estimatedDaysToTargetWeight,
    taxFreePassiveSharePct,
    whtTaxedPassiveSharePct,
    hardCurrencyHedgePct,
    usdInvestedTotal,
    monthlyFreedomVelocityLkr,
    monthlyFiCoverageGainPct,
    solarBotUtilityOffsetPct,
    utilitiesAndSubsSpendLkr,
    hba1cCurrent: 0,
    hba1cTarget: 0,
  };
}

function buildLiveSignals(
  payload: OpsDashboardPayload,
  live: TemporalDashboardModel["live"],
  normalizedMinPrices: Record<string, number>
): DecisionSignal[] {
  const signals: DecisionSignal[] = [];
  const refHour = getReferenceHour(payload.timestamp);
  const isDaytime = live.solarKw > 0.1 || (refHour >= 6 && refHour < 23);

  // 1. Solar export vs EV charging state
  if (
    live.gridExportStatus === "EXPORTING" &&
    live.netGridKw > 2 &&
    live.evBatteryPct < 85 &&
    live.evChargerConnected &&
    !live.evIsCharging
  ) {
    signals.push({
      id: "live-grid-ev-solar-surplus",
      horizon: "live",
      domain: "GRID",
      severity: "opportunity",
      title: "Charge EV on Solar Surplus",
      metricLabel: "Net Solar Export / EV SoC",
      currentValue: `+${live.netGridKw.toFixed(1)} kW export · ${live.evBatteryPct}% SoC`,
      thresholdValue: "> 2.0 kW export & SoC < 85%",
      whyItMatters:
        "Excess PV export can directly top up the EV battery instead of drawing paid grid power later.",
      recommendedAction:
        "Start EV charging now while net solar export exceeds 2.0 kW.",
      actionLabel: "Start EV Charge",
      actionType: "toggle_ev",
      targetZone: "zone4",
    });
  } else if (
    live.gridExportStatus === "IMPORTING" &&
    live.evIsCharging &&
    isDaytime
  ) {
    signals.push({
      id: "live-grid-ev-daytime-import",
      horizon: "live",
      domain: "GRID",
      severity: "warning",
      title: "Defer EV Charge to Off-Peak",
      metricLabel: "Grid Import During EV Charge",
      currentValue: `${Math.abs(live.netGridKw).toFixed(1)} kW grid import`,
      thresholdValue: "Off-peak window >= 23:00",
      whyItMatters:
        "Charging the EV from daytime grid import incurs higher peak tariffs instead of solar surplus or off-peak rates.",
      recommendedAction:
        "Pause EV charging now and schedule resumption at 23:00 off-peak.",
      actionLabel: "Pause EV Charge",
      actionType: "toggle_ev",
      targetZone: "zone4",
    });
  } else if (live.gridExportStatus === "EXPORTING" && live.evIsCharging) {
    signals.push({
      id: "live-grid-ev-solar-active",
      horizon: "live",
      domain: "GRID",
      severity: "nominal",
      title: "EV Charging on Solar Surplus",
      metricLabel: "Solar Output / EV SoC",
      currentValue: `${live.solarKw.toFixed(1)} kW · ${live.evBatteryPct}% SoC`,
      thresholdValue: "Net-exporting",
      whyItMatters:
        "EV charging is currently offset by live rooftop solar generation.",
      recommendedAction: "Maintain charging until 85% SoC or export drops.",
      actionLabel: "View Grid Bay",
      actionType: "open_tab",
      targetZone: "zone4",
    });
  }

  // 2. Fasting window status
  if (live.fastingActive) {
    const remainingMinutes = Math.max(
      0,
      live.fastingGoalMinutes - live.fastingMinutes
    );
    if (live.fastingMinutes >= live.fastingGoalMinutes) {
      signals.push({
        id: "live-bio-fasting-target-reached",
        horizon: "live",
        domain: "BIO",
        severity: "opportunity",
        title: "16h Autophagy Target Reached",
        metricLabel: "Active Fasting Window",
        currentValue: formatDurationMinutes(live.fastingMinutes),
        thresholdValue: formatDurationMinutes(live.fastingGoalMinutes),
        whyItMatters:
          "Metabolic fast has crossed the 16h autophagy threshold, supporting insulin sensitivity and fat oxidation.",
        recommendedAction:
          "Open eating window with a high-protein, low-sugar meal or extend fast comfortably.",
        actionLabel: "Open Bio Bay",
        actionType: "open_tab",
        targetZone: "zone3",
      });
    } else {
      signals.push({
        id: "live-bio-fasting-active",
        horizon: "live",
        domain: "BIO",
        severity: "nominal",
        title: "Fasting Window In Progress",
        metricLabel: "Time to 16h Target",
        currentValue: `${formatDurationMinutes(live.fastingMinutes)} (${live.fastingPct}%)`,
        thresholdValue: `${formatDurationMinutes(remainingMinutes)} remaining`,
        whyItMatters:
          "Staying hydrated and zero-calorie preserves insulin suppression until the 16h window closes.",
        recommendedAction: `Stay fasted for ${formatDurationMinutes(remainingMinutes)} more; hydrate with water or black coffee.`,
        actionLabel: "Open Bio Bay",
        actionType: "open_tab",
        targetZone: "zone3",
      });
    }
  } else if (live.fastBrokenAt && live.eatingWindowActive) {
    const closingSoon = live.eatingWindowRemainingMinutes <= 60;
    const closesTimeStr = formatClockTime(live.eatingWindowClosesAt);
    signals.push({
      id: "live-bio-eating-window",
      horizon: "live",
      domain: "BIO",
      severity: closingSoon ? "warning" : "nominal",
      title: closingSoon
        ? "8h Eating Window Closing Soon"
        : "8h Eating Window Active",
      metricLabel: "8h Feeding Window Countdown",
      currentValue: `${formatDurationMinutes(live.eatingWindowRemainingMinutes)} remaining`,
      thresholdValue: closesTimeStr ? `Closes ${closesTimeStr}` : "8h window limit",
      whyItMatters:
        "Closing meals on time protects your 16h overnight fasting cadence, fat oxidation, and daily caloric cap.",
      recommendedAction: closingSoon
        ? `8h eating window closes in ${formatDurationMinutes(live.eatingWindowRemainingMinutes)} — finish final protein & hydrate.`
        : `Complete remaining protein and calorie targets within ${formatDurationMinutes(live.eatingWindowRemainingMinutes)}.`,
      actionLabel: "Open Bio Bay",
      actionType: "open_tab",
      targetZone: "zone3",
    });
  }

  // 3. Trading bot status & open positions stop-loss proximity
  if (!live.botRunning) {
    signals.push({
      id: "live-bot-offline",
      horizon: "live",
      domain: "BOT",
      severity: "warning",
      title: "Trading Bot Offline",
      metricLabel: "Bot Execution Daemon",
      currentValue: `Stopped (${live.botMode})`,
      thresholdValue: "Running",
      whyItMatters:
        "Algorithmic strategy slots and automated stop-loss guards are inactive while the bot is stopped.",
      recommendedAction:
        "Verify Binance connectivity and restart the trading bot daemon.",
      actionLabel: "Start Bot",
      actionType: "toggle_bot",
      targetZone: "zone5",
    });
  }

  const openPositions = extractOpenPositions(payload);
  for (const pos of openPositions) {
    if (pos.currentPrice <= 0) continue;

    if (pos.stopLoss > 0) {
      const distancePct =
        pos.side === "SHORT"
          ? ((pos.stopLoss - pos.currentPrice) / pos.currentPrice) * 100
          : ((pos.currentPrice - pos.stopLoss) / pos.currentPrice) * 100;

      if (distancePct <= 3.5) {
        const isImminent = distancePct <= 1.5;
        signals.push({
          id: `live-bot-stoploss-${pos.symbol}`,
          horizon: "live",
          domain: "BOT",
          severity: isImminent ? "critical" : "warning",
          title: isImminent
            ? `Stop-Loss Imminent: ${pos.symbol}`
            : `Stop-Loss Proximity: ${pos.symbol}`,
          metricLabel: `${pos.symbol} (${pos.side}) SL Buffer`,
          currentValue: `${distancePct.toFixed(2)}% ($${pos.currentPrice.toFixed(2)})`,
          thresholdValue: `SL $${pos.stopLoss.toFixed(2)}`,
          whyItMatters:
            "Price is trading tightly against the protective stop-loss level, risking automated exit.",
          recommendedAction:
            "Inspect order book volatility and confirm stop-loss placement in Bot Bay.",
          actionLabel: "Inspect Bot",
          actionType: "open_tab",
          targetZone: "zone5",
        });
      }
    }

    if (pos.takeProfit > 0) {
      const tpDistancePct =
        pos.side === "SHORT"
          ? ((pos.currentPrice - pos.takeProfit) / pos.currentPrice) * 100
          : ((pos.takeProfit - pos.currentPrice) / pos.currentPrice) * 100;

      if (tpDistancePct <= 2.5) {
        signals.push({
          id: `live-bot-tp-${pos.symbol}`,
          horizon: "live",
          domain: "BOT",
          severity: "opportunity",
          title: `Take-Profit Proximity: ${pos.symbol}`,
          metricLabel: `${pos.symbol} (${pos.side}) TP Distance`,
          currentValue: `${tpDistancePct.toFixed(2)}% ($${pos.currentPrice.toFixed(2)})`,
          thresholdValue: `TP $${pos.takeProfit.toFixed(2)}`,
          whyItMatters:
            "Position is within 2.5% of its take-profit target; trailing the stop-loss protects unrealized gains from reversal.",
          recommendedAction:
            "Trail stop-loss closer to entry/profit or prepare partial profit lock-in in Bot Bay.",
          actionLabel: "Manage TP",
          actionType: "open_tab",
          targetZone: "zone5",
        });
      }
    }
  }

  if (live.botActiveSignalsCount > 0) {
    const activeSlotLabels = (payload.bot?.slots ?? [])
      .filter((s) => s.enabled && s.lastSignal && s.lastSignal.toUpperCase() !== "HOLD")
      .map((s) => `${s.symbol} (${s.lastSignal})`)
      .slice(0, 3);
    signals.push({
      id: "live-bot-active-signals",
      horizon: "live",
      domain: "BOT",
      severity: "opportunity",
      title: `${live.botActiveSignalsCount} Active Bot Slot Signal${
        live.botActiveSignalsCount === 1 ? "" : "s"
      }`,
      metricLabel: "Strategy Trigger / Idle USDT",
      currentValue: `${activeSlotLabels.join(", ")} · ${live.botIdleCashPct.toFixed(1)}% idle USDT`,
      thresholdValue: "Non-HOLD signal active",
      whyItMatters:
        "Enabled strategy slots have fired directional signals while free USDT liquidity is available for deployment.",
      recommendedAction:
        "Verify signal execution and position sizing in Bot Bay.",
      actionLabel: "Open Bot Bay",
      actionType: "open_tab",
      targetZone: "zone5",
    });
  }

  // 4. CSE stock tickers: concentration, drawdown/profit & minStockPrices target
  const tickers = payload.finance?.stocks?.tickers ?? [];
  if (live.cseMaxConcentrationSymbol && live.cseMaxConcentrationPct >= 22) {
    signals.push({
      id: "live-fin-cse-concentration",
      horizon: "live",
      domain: "FIN",
      severity: "warning",
      title: `CSE Concentration Risk: ${live.cseMaxConcentrationSymbol}`,
      metricLabel: "Single-Stock Weight",
      currentValue: `${live.cseMaxConcentrationPct.toFixed(1)}% of portfolio`,
      thresholdValue: "< 22.0% position cap",
      whyItMatters: `${live.cseMaxConcentrationSymbol} exceeds 22% of total CSE equity value, amplifying single-issuer volatility.`,
      recommendedAction: `Trim future allocations to ${live.cseMaxConcentrationSymbol} and diversify new equity buys into underweight tickers.`,
      actionLabel: "Review Equities",
      actionType: "open_tab",
      targetZone: "zone1",
    });
  }

  for (const ticker of tickers) {
    const unrealizedPnlPct = safeNum(ticker.unrealizedPnlPct);
    if (unrealizedPnlPct <= -8) {
      signals.push({
        id: `live-fin-cse-drawdown-${ticker.symbol}`,
        horizon: "live",
        domain: "FIN",
        severity: "warning",
        title: `Deep Drawdown Review: ${ticker.symbol}`,
        metricLabel: `${ticker.symbol} Unrealized P&L`,
        currentValue: `${unrealizedPnlPct.toFixed(2)}% (${formatLKR(ticker.unrealizedPnl)})`,
        thresholdValue: "> -8.0% drawdown guard",
        whyItMatters: `${ticker.name || ticker.symbol} is down ${Math.abs(unrealizedPnlPct).toFixed(1)}% against cost basis, warranting a thesis check.`,
        recommendedAction: `Audit ${ticker.symbol} earnings outlook to decide between averaging down or rotating capital.`,
        actionLabel: "Review Equities",
        actionType: "open_tab",
        targetZone: "zone1",
      });
    } else if (unrealizedPnlPct >= 8) {
      signals.push({
        id: `live-fin-cse-profit-${ticker.symbol}`,
        horizon: "live",
        domain: "FIN",
        severity: "opportunity",
        title: `Profit-Take / Rebalance: ${ticker.symbol}`,
        metricLabel: `${ticker.symbol} Unrealized Gain`,
        currentValue: `+${unrealizedPnlPct.toFixed(2)}% (+${formatLKR(ticker.unrealizedPnl)})`,
        thresholdValue: ">= +8.0% (clears 1.12% CSE fee)",
        whyItMatters: `${ticker.name || ticker.symbol} gain comfortably clears the 1.12% CSE sell transaction fee for tax-free capital gain harvesting.`,
        recommendedAction: `Consider trimming part of ${ticker.symbol} to lock in gains or rebalance portfolio concentration.`,
        actionLabel: "Review Equities",
        actionType: "open_tab",
        targetZone: "zone1",
      });
    }

    const targetPrice = normalizedMinPrices[ticker.symbol.toUpperCase()];
    if (!targetPrice || ticker.price <= 0 || ticker.price > targetPrice) {
      continue;
    }
    const discountPct = ((targetPrice - ticker.price) / targetPrice) * 100;
    signals.push({
      id: `live-fin-cse-target-${ticker.symbol}`,
      horizon: "live",
      domain: "FIN",
      severity: "opportunity",
      title: `Accumulate ${ticker.symbol} Below Target`,
      metricLabel: `${ticker.symbol} Last Traded`,
      currentValue: formatTickerLkr(ticker.price),
      thresholdValue: `<= ${formatTickerLkr(targetPrice)}`,
      whyItMatters: `${ticker.name || ticker.symbol} is trading ${discountPct.toFixed(1)}% at or below your target accumulation price.`,
      recommendedAction: `Review order depth and allocate tranche for ${ticker.symbol} via CSE broker.`,
      actionLabel: "Review Equities",
      actionType: "open_tab",
      targetZone: "zone1",
    });
  }

  return signals;
}

function buildDailySignals(
  payload: OpsDashboardPayload,
  daily: TemporalDashboardModel["daily"]
): DecisionSignal[] {
  const signals: DecisionSignal[] = [];

  // 1. Sugar guardrail
  if (daily.sugarGrams > daily.sugarLimit) {
    signals.push({
      id: "daily-bio-sugar-exceeded",
      horizon: "daily",
      domain: "BIO",
      severity: "critical",
      title: "Daily Sugar Limit Exceeded",
      metricLabel: "Added / Total Sugar",
      currentValue: `${daily.sugarGrams}g`,
      thresholdValue: `<= ${daily.sugarLimit}g`,
      whyItMatters:
        "Exceeding the daily sugar ceiling consumes remaining caloric budget and suppresses fat oxidation.",
      recommendedAction:
        "Eliminate simple carbs for remaining meals and take a 20-minute post-meal walk.",
      actionLabel: "Open Bio Bay",
      actionType: "open_tab",
      targetZone: "zone3",
    });
  } else if (daily.sugarGrams >= daily.sugarLimit * 0.8) {
    signals.push({
      id: "daily-bio-sugar-warning",
      horizon: "daily",
      domain: "BIO",
      severity: "warning",
      title: "Approaching Daily Sugar Cap",
      metricLabel: "Daily Sugar Budget",
      currentValue: `${daily.sugarGrams}g`,
      thresholdValue: `${daily.sugarLimit}g max`,
      whyItMatters:
        "Less than 20% of the daily sugar allowance remains for the rest of the day.",
      recommendedAction:
        "Keep remaining meals strictly zero-sugar and prioritize fiber and protein.",
      actionLabel: "Open Bio Bay",
      actionType: "open_tab",
      targetZone: "zone3",
    });
  }

  // 2. Calorie limit & protein deficit
  if (daily.caloriesIntake > daily.calorieLimit) {
    const overage = daily.caloriesIntake - daily.calorieLimit;
    signals.push({
      id: "daily-bio-calorie-over",
      horizon: "daily",
      domain: "BIO",
      severity: overage > daily.calorieLimit * 0.15 ? "critical" : "warning",
      title: "Daily Calorie Limit Exceeded",
      metricLabel: "Calorie Intake",
      currentValue: `${daily.caloriesIntake} kcal (+${overage})`,
      thresholdValue: `<= ${daily.calorieLimit} kcal`,
      whyItMatters:
        "Sustained caloric surplus stalls MTD weight target progress and net energy deficit.",
      recommendedAction:
        "Close eating window early and add low-intensity cardio to offset surplus.",
      actionLabel: "Open Bio Bay",
      actionType: "open_tab",
      targetZone: "zone3",
    });
  }

  if (daily.proteinGrams < daily.proteinGoal * 0.6) {
    const remainingProtein = Math.round(daily.proteinGoal - daily.proteinGrams);
    signals.push({
      id: "daily-bio-protein-deficit",
      horizon: "daily",
      domain: "BIO",
      severity: "warning",
      title: "Protein Deficit Today",
      metricLabel: "Protein Intake",
      currentValue: `${daily.proteinGrams}g (${Math.round(
        (daily.proteinGrams / daily.proteinGoal) * 100
      )}%)`,
      thresholdValue: `>= ${daily.proteinGoal}g`,
      whyItMatters:
        "Insufficient protein during caloric restriction increases lean mass loss and hunger.",
      recommendedAction: `Prioritize ${remainingProtein}g lean protein (eggs, chicken, fish, or whey) in remaining meals.`,
      actionLabel: "Open Bio Bay",
      actionType: "open_tab",
      targetZone: "zone3",
    });
  }

  // 3. Daily spend vs dailySafeBurnRate & calendar pace variance
  if (
    daily.dailySafeBurnRateLkr > 0 &&
    daily.dailySpendLkr > daily.dailySafeBurnRateLkr
  ) {
    const overRatio = daily.dailySpendLkr / daily.dailySafeBurnRateLkr;
    signals.push({
      id: "daily-spend-burn-over-pace",
      horizon: "daily",
      domain: "SPEND",
      severity: overRatio >= 1.25 ? "critical" : "warning",
      title: "Daily Spend Above Safe Burn Rate",
      metricLabel: "Today's Normal Spend vs Safe Cap",
      currentValue: formatLKR(daily.dailySpendLkr),
      thresholdValue: `<= ${formatLKR(daily.dailySafeBurnRateLkr)}/day`,
      whyItMatters:
        "Running above the daily safe burn rate compresses monthly savings and erodes passive surplus.",
      recommendedAction:
        "Freeze discretionary purchases today and defer non-essential spend until pace normalizes.",
      actionLabel: "Review Spend",
      actionType: "open_tab",
      targetZone: "zone2",
    });
  }

  if (daily.calendarPaceVariancePct > 10) {
    const budgetUtilPct = roundTo(safeNum(payload.spendIncome?.budgetUtilizationPct), 1);
    signals.push({
      id: "daily-spend-calendar-pace",
      horizon: "daily",
      domain: "SPEND",
      severity: "warning",
      title: "Budget Burn Ahead of Month Pace",
      metricLabel: "Budget Used vs. Month Elapsed",
      currentValue: `${budgetUtilPct}% used vs ${daily.monthElapsedPct}% elapsed (+${daily.calendarPaceVariancePct}% pace)`,
      thresholdValue: "<= +10.0% ahead of calendar pace",
      whyItMatters: `Budget ${budgetUtilPct}% used vs ${daily.monthElapsedPct}% of month elapsed (+${daily.calendarPaceVariancePct}% over pace), risking a late-month baseline overshoot.`,
      recommendedAction:
        "Hold discretionary purchases for the next few days to bring spend trajectory back in line with calendar pace.",
      actionLabel: "Review Pace",
      actionType: "open_tab",
      targetZone: "zone2",
    });
  }

  // 4. Daily solar yield vs dailyTargetKwh
  if (daily.solarDailyKwh < daily.solarDailyTargetKwh * 0.8) {
    signals.push({
      id: "daily-grid-solar-below-target",
      horizon: "daily",
      domain: "GRID",
      severity: "warning",
      title: "Daily Solar Yield Below Target",
      metricLabel: "Daily Generation",
      currentValue: `${daily.solarDailyKwh.toFixed(1)} kWh (${daily.solarDailyPct}%)`,
      thresholdValue: `>= ${daily.solarDailyTargetKwh.toFixed(1)} kWh`,
      whyItMatters:
        "Lower daily kWh output reduces Net-Plus export credits and lowers monthly tariff offset.",
      recommendedAction:
        "Check FusionSolar inverter telemetry and cloud/shading conditions before end of solar window.",
      actionLabel: "Sync Solar",
      actionType: "refresh_zone",
      targetZone: "zone4",
    });
  } else if (daily.solarDailyKwh >= daily.solarDailyTargetKwh) {
    signals.push({
      id: "daily-grid-solar-target-met",
      horizon: "daily",
      domain: "GRID",
      severity: "nominal",
      title: "Daily Solar Target Achieved",
      metricLabel: "Daily Generation / Est. Credit",
      currentValue: `${daily.solarDailyKwh.toFixed(1)} kWh (${formatLKR(
        daily.solarDailyEstRevenueLkr
      )})`,
      thresholdValue: `${daily.solarDailyTargetKwh.toFixed(1)} kWh target`,
      whyItMatters:
        "Rooftop PV array has hit its daily energy yield benchmark.",
      recommendedAction:
        "Keep high-draw loads balanced to maximize Net-Plus export value.",
      actionLabel: "View Grid Bay",
      actionType: "open_tab",
      targetZone: "zone4",
    });
  }

  // 5. Active critical-path sprint tasks due today
  const todayIso = new Date().toISOString().slice(0, 10);
  const dueTodayTasks = (payload.sprintTasks ?? []).filter((task: SprintTask) => {
    if (task.status === "complete") return false;
    if (task.status === "active") {
      if (!task.deadline) return true;
      return (
        /today|urgent|critical|asap|eod/i.test(task.deadline) ||
        task.deadline === todayIso
      );
    }
    return Boolean(task.deadline && (/today/i.test(task.deadline) || task.deadline === todayIso));
  });

  if (dueTodayTasks.length > 0) {
    const previewTitles = dueTodayTasks
      .slice(0, 2)
      .map((t) => t.title)
      .join("; ");
    signals.push({
      id: "daily-ops-critical-tasks",
      horizon: "daily",
      domain: "OPS",
      severity: dueTodayTasks.length >= 3 ? "warning" : "nominal",
      title: `${dueTodayTasks.length} Critical Sprint Task${
        dueTodayTasks.length === 1 ? "" : "s"
      } Due Today`,
      metricLabel: "Active Critical Path",
      currentValue: `${dueTodayTasks.length} open`,
      thresholdValue: "0 overdue at EOD",
      whyItMatters: `Unresolved active items block daily execution: ${previewTitles}.`,
      recommendedAction: `Complete "${dueTodayTasks[0].title}" in Mission Control before end of day.`,
      actionLabel: "Open Sprint Board",
      actionType: "open_tab",
      targetZone: "zone6",
    });
  }

  return signals;
}

function formatMaturityAmount(item: MaturityRadarItem): string {
  return item.currency === "USD" ? formatUSD(item.amount) : formatLKR(item.amount);
}

function buildMonthlySignals(
  payload: OpsDashboardPayload,
  monthly: TemporalDashboardModel["monthly"]
): DecisionSignal[] {
  const signals: DecisionSignal[] = [];

  // 1. Treasury / FD Maturity Radar
  const maturities = payload.investments?.maturityRadar ?? [];
  for (const item of maturities) {
    if (!Number.isFinite(item.daysRemaining) || item.daysRemaining > 30) {
      continue;
    }
    const isCritical = item.daysRemaining <= 7;
    const dueLabel =
      item.daysRemaining <= 0 ? "Today / Overdue" : `${item.daysRemaining}d`;
    signals.push({
      id: `monthly-fin-maturity-${item.id}`,
      horizon: "monthly",
      domain: "FIN",
      severity: isCritical ? "critical" : "warning",
      title: isCritical
        ? `Urgent Maturity: ${item.name}`
        : `Upcoming Maturity: ${item.name}`,
      metricLabel: `${item.institution} · ${formatMaturityAmount(item)}`,
      currentValue: `${dueLabel} @ ${item.rate.toFixed(2)}%`,
      thresholdValue: isCritical ? "<= 7 days" : "<= 30 days",
      whyItMatters:
        "Unactioned maturities risk rolling into low-yield savings or losing reinvestment compounding.",
      recommendedAction: isCritical
        ? "Execute rollover, T-Bill bid, or liquidity sweep immediately."
        : "Compare rollover yields and queue reinvestment allocation ahead of maturity.",
      actionLabel: "Review Maturity",
      actionType: "review_maturity",
      targetZone: "zone1",
    });
  }

  // 2. Baseline budget utilization
  if (monthly.budgetUtilizationPct > 100) {
    signals.push({
      id: "monthly-spend-budget-breach",
      horizon: "monthly",
      domain: "SPEND",
      severity: "critical",
      title: "Baseline Monthly Budget Exceeded",
      metricLabel: "Baseline Budget Utilization",
      currentValue: `${monthly.budgetUtilizationPct.toFixed(1)}% (${formatLKR(
        monthly.normalLivingSpendLkr
      )})`,
      thresholdValue: `<= 100% (${formatLKR(monthly.baselineBudgetLkr)})`,
      whyItMatters:
        "Monthly living expenses have exceeded the baseline cap, reducing net investable cash flow.",
      recommendedAction:
        "Audit top variance categories in Spend & Income Bay and pause non-essential outflows.",
      actionLabel: "Audit Spend",
      actionType: "open_tab",
      targetZone: "zone2",
    });
  } else if (monthly.budgetUtilizationPct > 85) {
    signals.push({
      id: "monthly-spend-budget-high",
      horizon: "monthly",
      domain: "SPEND",
      severity: "warning",
      title: "Baseline Budget Utilization High",
      metricLabel: "Baseline Budget Utilization",
      currentValue: `${monthly.budgetUtilizationPct.toFixed(1)}%`,
      thresholdValue: "<= 85% buffer",
      whyItMatters:
        "Less than 15% of the monthly baseline living budget remains for the rest of the month.",
      recommendedAction:
        "Throttle discretionary spending to avoid breaching the baseline ceiling.",
      actionLabel: "Review Budget",
      actionType: "open_tab",
      targetZone: "zone2",
    });
  }

  // 2b. Monthly MTD total vs average MTD within budget (excluding 1-time spikes & 10% buffer)
  const refDate = getReferenceDate(payload.timestamp);
  const currentDay = refDate.getDate();
  const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
  const mtdNormalLoggedLkr = Math.max(
    0,
    monthly.normalLivingSpendLkr - monthly.undocumentedBufferLkr
  );
  const expectedMtdBudgetLkr =
    daysInMonth > 0 && monthly.baselineBudgetLkr > 0
      ? Math.round((monthly.baselineBudgetLkr / daysInMonth) * currentDay)
      : 0;

  if (expectedMtdBudgetLkr > 0 && mtdNormalLoggedLkr > expectedMtdBudgetLkr) {
    const overMtdLkr = mtdNormalLoggedLkr - expectedMtdBudgetLkr;
    const overMtdRatio = mtdNormalLoggedLkr / expectedMtdBudgetLkr;
    signals.push({
      id: "monthly-spend-mtd-above-budget-pace",
      horizon: "monthly",
      domain: "SPEND",
      severity: overMtdRatio >= 1.2 ? "critical" : "warning",
      title: "MTD Spend Above Budget Pace",
      metricLabel: `Day ${currentDay}/${daysInMonth} Normal MTD · Avg ${formatLKR(
        monthly.dailyAverageSpendLkr
      )}/day`,
      currentValue: `${formatLKR(mtdNormalLoggedLkr)} (+${formatLKR(overMtdLkr)})`,
      thresholdValue: `<= ${formatLKR(expectedMtdBudgetLkr)} MTD pace`,
      whyItMatters: `Logged normal MTD spend (${formatLKR(mtdNormalLoggedLkr)}) is ${formatLKR(
        overMtdLkr
      )} above the linear Day ${currentDay} allowance of your ${formatLKR(
        monthly.baselineBudgetLkr
      )} monthly budget.`,
      recommendedAction:
        "Slow discretionary categories for the next several days so MTD normal spend converges back to the linear budget curve.",
      actionLabel: "Audit Spend",
      actionType: "open_tab",
      targetZone: "zone2",
    });
  }

  // 3. Overdraft drawn interest / utilization alert
  const od = payload.spendIncome?.outflow?.od;
  const odTotal = safeNum(od?.total);
  const odItems = od?.items ?? [];
  const totalOdDrawn = odItems.reduce((sum, i) => sum + safeNum(i.currentDrawn), 0);
  const totalOdLimit = odItems.reduce((sum, i) => sum + safeNum(i.overdraftLimit), 0);
  const totalOdInterest = odItems.reduce(
    (sum, i) => sum + safeNum(i.latestInterest),
    0
  );

  if (odTotal > 0 || totalOdDrawn > 0) {
    const odUtilPct = totalOdLimit > 0 ? (totalOdDrawn / totalOdLimit) * 100 : 0;
    const isCriticalOd = odUtilPct >= 80;
    signals.push({
      id: "monthly-spend-od-utilization",
      horizon: "monthly",
      domain: "SPEND",
      severity: isCriticalOd ? "critical" : "warning",
      title: "Overdraft Drawn & Interest Drag",
      metricLabel: "OD Payment / Drawn Balance",
      currentValue:
        totalOdDrawn > 0
          ? `${formatLKR(totalOdDrawn)} drawn (${odUtilPct.toFixed(0)}%)`
          : `${formatLKR(odTotal)}/mo`,
      thresholdValue: "Rs. 0 drawn",
      whyItMatters: `Active overdraft utilization creates recurring interest drag (${formatLKR(
        totalOdInterest > 0 ? totalOdInterest : odTotal
      )}/mo).`,
      recommendedAction:
        "Sweep surplus cash flow or maturing liquidity to pay down the overdraft principal.",
      actionLabel: "Inspect OD",
      actionType: "open_tab",
      targetZone: "zone2",
    });
  }

  // 4. Monthly investment commitment progress
  const commitment = payload.investments?.commitment;
  if (commitment && safeNum(commitment.plannedAmount) > 0) {
    const fulfilledPct = roundTo(safeNum(commitment.fulfilledPct), 1);
    const shortfall = Math.max(
      0,
      Math.round(commitment.plannedAmount - safeNum(commitment.achievedAmount))
    );
    if (fulfilledPct < 100) {
      signals.push({
        id: "monthly-fin-investment-commitment",
        horizon: "monthly",
        domain: "FIN",
        severity: fulfilledPct < 70 ? "warning" : "opportunity",
        title: "Investment Commitment Pending",
        metricLabel: "Monthly Allocation Progress",
        currentValue: `${fulfilledPct.toFixed(1)}% (${formatLKR(
          safeNum(commitment.achievedAmount)
        )})`,
        thresholdValue: `100% (${formatLKR(commitment.plannedAmount)})`,
        whyItMatters: `${formatLKR(
          shortfall
        )} remains to fulfill this month's planned capital deployment toward FIRE.`,
        recommendedAction: `Deploy ${formatLKR(
          shortfall
        )} into UT, T-Bills, or target CSE equities before month-end.`,
        actionLabel: "Open Finance Bay",
        actionType: "open_tab",
        targetZone: "zone1",
      });
    } else {
      signals.push({
        id: "monthly-fin-investment-commitment-met",
        horizon: "monthly",
        domain: "FIN",
        severity: "nominal",
        title: "Monthly Investment Commitment Met",
        metricLabel: "Monthly Allocation Progress",
        currentValue: `${fulfilledPct.toFixed(1)}% (${formatLKR(
          safeNum(commitment.achievedAmount)
        )})`,
        thresholdValue: formatLKR(commitment.plannedAmount),
        whyItMatters:
          "Monthly capital deployment target is fully satisfied, keeping compound FIRE trajectory on pace.",
        recommendedAction: "Route any extra surplus to overdraft reduction or cash buffer.",
        actionLabel: "Open Finance Bay",
        actionType: "open_tab",
        targetZone: "zone1",
      });
    }
  }

  // 5. True FI Coverage milestone
  if (monthly.trueFiCoverageBaselinePct > 0 || monthly.trueFiCoverageTotalPct > 0) {
    const reachedBaselineFi = monthly.trueFiCoverageBaselinePct >= 100;
    signals.push({
      id: "monthly-fin-fi-coverage",
      horizon: "monthly",
      domain: "FIN",
      severity: reachedBaselineFi ? "opportunity" : "nominal",
      title: reachedBaselineFi
        ? "Baseline FI Coverage Reached"
        : "True FI Coverage Milestone",
      metricLabel: "Passive Cash / Baseline Living",
      currentValue: `${monthly.trueFiCoverageBaselinePct.toFixed(1)}% baseline · ${monthly.trueFiCoverageTotalPct.toFixed(1)}% total`,
      thresholdValue: "100% baseline FI",
      whyItMatters: reachedBaselineFi
        ? "Monthly passive income after IIT fully covers baseline living expenses."
        : `Net passive cashflow (${formatLKR(
            monthly.physicalCashAvailableMonthlyLkr
          )}/mo) covers ${monthly.trueFiCoverageBaselinePct.toFixed(
            1
          )}% of baseline living spend.`,
      recommendedAction: reachedBaselineFi
        ? "Continue compounding surplus toward 100% total-expense FI coverage."
        : "Focus on high-yield rollovers and disciplined monthly investment commitments.",
      actionLabel: "Open Finance Bay",
      actionType: "open_tab",
      targetZone: "zone1",
    });
  }

  // 6. OD Cost vs. Fixed Income Yield Arbitrage
  if (monthly.odDrawnLkr > 0 && monthly.odVsFdArbitrageSpreadPct > 0) {
    signals.push({
      id: "monthly-fin-od-arbitrage",
      horizon: "monthly",
      domain: "FIN",
      severity: "opportunity",
      title: "OD vs. FD Yield Arbitrage",
      metricLabel: "OD Effective Rate vs. Post-WHT FD",
      currentValue: `${monthly.odEffectiveAnnualRatePct.toFixed(2)}% OD vs ${monthly.lowestPostTaxFdRatePct.toFixed(2)}% net FD (+${monthly.odVsFdArbitrageSpreadPct.toFixed(2)}%)`,
      thresholdValue: "0.00% spread",
      whyItMatters: `Paying down ${formatLKR(monthly.odDrawnLkr)} OD saves ${monthly.odEffectiveAnnualRatePct.toFixed(2)}% tax-free vs ${monthly.lowestPostTaxFdRatePct.toFixed(2)}% post-WHT FD yield (+${monthly.odVsFdArbitrageSpreadPct.toFixed(2)}% risk-free arbitrage spread).`,
      recommendedAction:
        "Sweep maturing low-yield FD capital or net cash surplus to reduce OD principal before renewing FDs.",
      actionLabel: "Audit OD Arbitrage",
      actionType: "open_tab",
      targetZone: "zone2",
    });
  }

  // 7. Category Budget Breach Radar
  if (monthly.breachedCategoriesCount > 0) {
    const topBreachSummary = monthly.topBreachedCategories
      .map((c) => `${c.name} (+${formatLKR(c.overrunLkr)})`)
      .join(", ");
    signals.push({
      id: "monthly-spend-category-breaches",
      horizon: "monthly",
      domain: "SPEND",
      severity: "warning",
      title: `${monthly.breachedCategoriesCount} Categor${
        monthly.breachedCategoriesCount === 1 ? "y" : "ies"
      } Over Budget`,
      metricLabel: "Category Overrun Radar",
      currentValue: topBreachSummary,
      thresholdValue: "Within category caps",
      whyItMatters: `Individual normal categories have breached caps (${topBreachSummary}), eroding monthly savings potential.`,
      recommendedAction: `Inspect ${monthly.topBreachedCategories[0]?.name || "breached categories"} in Spend & Income Bay and tighten remaining variable spend.`,
      actionLabel: "Inspect Categories",
      actionType: "open_tab",
      targetZone: "zone2",
    });
  }

  // 8. Expected Fat Loss vs. Actual Scale Weight Delta & Target Weight ETA
  const biometrics = payload.health?.biometrics;
  const hasBioTrajectory =
    safeNum(biometrics?.mtdCaloriesIntake) > 0 ||
    safeNum(biometrics?.mtdCaloriesExpended) > 0 ||
    monthly.weightDeltaMtdKg !== 0 ||
    monthly.estimatedDaysToTargetWeight !== null;

  if (hasBioTrajectory) {
    const isSurplus = monthly.mtdCalorieDeficitKcal < 0;
    const isWaterVariance =
      !isSurplus && monthly.weightDeltaMtdKg > 0 && monthly.expectedFatLossMtdKg < -0.2;
    const deltaSign = monthly.weightDeltaMtdKg > 0 ? "+" : "";
    const fatSign = monthly.expectedFatLossMtdKg > 0 ? "+" : "";
    const etaText =
      monthly.estimatedDaysToTargetWeight !== null
        ? `~${monthly.estimatedDaysToTargetWeight}d to target weight`
        : "Log intake & burn for ETA";

    signals.push({
      id: "monthly-bio-weight-trajectory",
      horizon: "monthly",
      domain: "BIO",
      severity: isSurplus ? "warning" : "nominal",
      title: isSurplus
        ? "MTD Caloric Surplus Warning"
        : isWaterVariance
        ? "Weight Trajectory: Water Retention vs. Deficit"
        : "MTD Fat Loss & Target Weight Pace",
      metricLabel: "Scale Delta vs. Expected Fat Loss",
      currentValue: `${deltaSign}${monthly.weightDeltaMtdKg.toFixed(1)} kg scale · ${fatSign}${monthly.expectedFatLossMtdKg.toFixed(2)} kg math`,
      thresholdValue: etaText,
      whyItMatters: `MTD net calorie deficit of ${monthly.mtdCalorieDeficitKcal.toLocaleString()} kcal implies ${fatSign}${monthly.expectedFatLossMtdKg.toFixed(2)} kg fat change (at 7,700 kcal/kg) compared to ${deltaSign}${monthly.weightDeltaMtdKg.toFixed(1)} kg on the scale.`,
      recommendedAction:
        monthly.estimatedDaysToTargetWeight !== null
          ? `Maintain current daily deficit to reach target weight in ~${monthly.estimatedDaysToTargetWeight} days.`
          : "Keep consistent daily calorie logging and Google Fit burn telemetry to project target weight ETA.",
      actionLabel: "Open Bio Bay",
      actionType: "open_tab",
      targetZone: "zone3",
    });
  }

  // 9. Cross-Domain Executive Metrics (Freedom Velocity & Solar/Bot Utility Offset)
  if (monthly.monthlyFreedomVelocityLkr > 0 || monthly.solarBotUtilityOffsetPct > 0) {
    signals.push({
      id: "monthly-ops-freedom-velocity",
      horizon: "monthly",
      domain: "OPS",
      severity: "opportunity",
      title: "Freedom Velocity & Utility Offset",
      metricLabel: "Perpetual FI Added / Bills Offset",
      currentValue: `+${formatLKR(monthly.monthlyFreedomVelocityLkr)}/mo · ${monthly.solarBotUtilityOffsetPct.toFixed(1)}% offset`,
      thresholdValue: `+${monthly.monthlyFiCoverageGainPct.toFixed(2)}% FI coverage gain`,
      whyItMatters: `Net savings lock in +${formatLKR(monthly.monthlyFreedomVelocityLkr)}/mo perpetual passive income at 9.6% blended post-tax yield (+${monthly.monthlyFiCoverageGainPct.toFixed(2)}% FI gain), while Solar + Bot offset ${monthly.solarBotUtilityOffsetPct.toFixed(1)}% of ${formatLKR(monthly.utilitiesAndSubsSpendLkr)} utilities & subscriptions.`,
      recommendedAction:
        "Deploy monthly net surplus into high-yield instruments before month-end to cement this perpetual cashflow gain.",
      actionLabel: "Review Strategy",
      actionType: "open_tab",
      targetZone: "zone1",
    });
  }

  return signals;
}

function sortSignals(signals: DecisionSignal[]): DecisionSignal[] {
  return [...signals].sort((a, b) => {
    const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return HORIZON_RANK[a.horizon] - HORIZON_RANK[b.horizon];
  });
}

export function evaluateTemporalOps(
  payload: OpsDashboardPayload,
  minStockPrices?: Record<string, number>
): TemporalDashboardModel {
  const normalizedMinPrices = normalizeMinPrices(minStockPrices);

  const live = computeLiveSummary(payload, normalizedMinPrices);
  const daily = computeDailySummary(payload);
  const monthly = computeMonthlySummary(payload);

  const all = sortSignals([
    ...buildLiveSignals(payload, live, normalizedMinPrices),
    ...buildDailySignals(payload, daily),
    ...buildMonthlySignals(payload, monthly),
  ]);

  const byHorizon = {
    live: all.filter((s) => s.horizon === "live"),
    daily: all.filter((s) => s.horizon === "daily"),
    monthly: all.filter((s) => s.horizon === "monthly"),
  };

  return {
    generatedAt: payload.timestamp || new Date().toISOString(),
    decisions: {
      all,
      criticalCount: all.filter((s) => s.severity === "critical").length,
      warningCount: all.filter((s) => s.severity === "warning").length,
      opportunityCount: all.filter((s) => s.severity === "opportunity").length,
      byHorizon,
    },
    live,
    daily,
    monthly,
  };
}
