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

function getReferenceHour(timestamp?: string): number {
  if (timestamp) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getHours();
    }
  }
  return new Date().getHours();
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

  const openPositions = extractOpenPositions(payload);
  const botUnrealizedPnlUsdt = roundTo(
    openPositions.reduce((sum, pos) => sum + safeNum(pos.unrealizedPnl), 0),
    2
  );

  const fastingMinutes = safeNum(today?.fastingMinutes);
  const fastingGoalMinutes = safePositive(
    today?.fastingGoalMinutes,
    DEFAULT_FASTING_GOAL_MINUTES
  );
  const fastingPct = Math.min(
    100,
    Math.max(0, Math.round((fastingMinutes / fastingGoalMinutes) * 100))
  );

  const cseAlertsCount = tickers.reduce((count, ticker) => {
    const target = normalizedMinPrices[ticker.symbol.toUpperCase()];
    return target && ticker.price > 0 && ticker.price <= target ? count + 1 : count;
  }, 0);

  return {
    solarKw: roundTo(safeNum(solar?.currentKw), 2),
    gridExportStatus: normalizeGridExportStatus(solar?.gridExportStatus),
    netGridKw: roundTo(safeNum(solar?.netGridKw), 2),
    evBatteryPct: Math.round(safeNum(fleet?.batteryPct)),
    evRangeKm: Math.round(safeNum(fleet?.estimatedRangeKm)),
    evIsCharging: Boolean(fleet?.isCharging),
    evChargerConnected: Boolean(fleet?.chargerConnected),
    fastingActive: Boolean(today?.isFastingActive),
    fastingMinutes,
    fastingGoalMinutes,
    fastingPct,
    fastingStartTime: today?.fastingStartTime ?? null,
    botRunning: Boolean(bot?.isRunning),
    botMode: bot?.mode ?? "offline",
    botOpenPositionsCount: Math.max(
      safeNum(bot?.openPositionsCount),
      openPositions.length
    ),
    botFreeUsdt: roundTo(safeNum(bot?.freeUsdt), 2),
    botTotalWalletUsdt: roundTo(safeNum(bot?.totalWalletUsdt), 2),
    botUnrealizedPnlUsdt,
    cseStockCount: tickers.length,
    cseAlertsCount,
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

  const caloriesIntake = Math.round(safeNum(today?.calories));
  const calorieLimit = Math.round(safePositive(today?.calorieLimit, 2000));
  const caloriesExpended = Math.round(
    safeNum(today?.caloriesExpended ?? biometrics?.todayCaloriesExpended)
  );
  const targetCaloriesExpended = Math.round(
    safePositive(biometrics?.targetCaloriesExpended, 500)
  );

  const dailySpendLkr = Math.round(
    safeNum(
      spendIncome?.dailyAverageSpend ?? spendIncome?.outflow?.household?.dailyAverageSpend
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

  const solarDailyKwh = roundTo(safeNum(solar?.dailyKwh), 1);
  const solarDailyTargetKwh = roundTo(
    safePositive(solar?.dailyTargetKwh, DEFAULT_SOLAR_DAILY_TARGET_KWH),
    1
  );
  const solarDailyPct = Math.max(
    0,
    Math.round((solarDailyKwh / solarDailyTargetKwh) * 100)
  );

  const todayDay = new Date().getDate();
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
    proteinGrams: roundTo(safeNum(today?.protein), 1),
    proteinGoal: roundTo(safePositive(today?.proteinGoal, 120), 1),
    sugarGrams: roundTo(safeNum(today?.sugar), 1),
    sugarLimit: roundTo(safePositive(today?.sugarLimit, 30), 1),
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

  const totalInflowLkr = Math.round(
    safeNum(spendIncome?.inflow?.totalInflow ?? spendIncome?.totalMonthlyIncome)
  );
  const totalOutflowLkr = Math.round(
    safeNum(spendIncome?.outflow?.totalOutflow ?? spendIncome?.totalMonthlySpend)
  );
  const netCashFlowLkr = Math.round(
    safeNum(spendIncome?.netCashFlow, totalInflowLkr - totalOutflowLkr)
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

  const currentDay = new Date().getDate();
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

  return {
    currentMonth:
      spendIncome?.currentMonth || new Date().toISOString().slice(0, 7),
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
    normalLivingSpendLkr: Math.round(
      safeNum(
        spendIncome?.normalLivingSpend ?? spendIncome?.outflow?.household?.normal
      )
    ),
    baselineBudgetLkr: Math.round(
      safeNum(
        spendIncome?.baselineBudget ?? spendIncome?.outflow?.household?.baselineBudget
      )
    ),
    urgentMaturitiesCount,
    warningMaturitiesCount,
    nextMaturityDays,
    solarMtdKwh,
    solarMtdRevenueLkr,
    botMtdRealizedPnlUsdt: roundTo(
      safeNum(bot?.monthRealizedPnlUsdt ?? bot?.totalRealizedPnlUsdt),
      2
    ),
    botWinRatePct: roundTo(safeNum(bot?.winRatePct), 1),
    weightDeltaMtdKg: roundTo(safeNum(health?.biometrics?.weightDeltaMtdKg), 1),
    hba1cCurrent: roundTo(safeNum(health?.hba1c?.current), 1),
    hba1cTarget: roundTo(safePositive(health?.hba1c?.target, 5.7), 1),
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
    if (pos.stopLoss <= 0 || pos.currentPrice <= 0) continue;
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

  // 4. CSE stock tickers below minStockPrices target
  const tickers = payload.finance?.stocks?.tickers ?? [];
  for (const ticker of tickers) {
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
        "Exceeding the daily sugar ceiling spikes glycemic variability and works against HbA1c reduction.",
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

  // 3. Daily spend vs dailySafeBurnRate
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
      metricLabel: "Avg Daily Spend vs Safe Cap",
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
