export type TimeHorizon = "pulse" | "7d" | "mtd" | "fy";

// ── Financial Bay: Net Worth & Category Telemetry ──────────────────────────────
export type NetWorthCategory = {
  id: string;
  name: string;
  currentAmount: number;
  priorAmount: number;
  deltaAmount: number;
  deltaPct: number;
  allocationPct: number;
  currency: "LKR" | "USD";
  monthlyIncome?: number;
  incomeSharePct?: number;
  annualYieldPct?: number;
};

export type CseStockTicker = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  quantity: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  costBasis?: number;
};

export type InvestorIncomeCategory = {
  id: string;
  name: string;
  badge: string;
  badgeType: "fd" | "ut" | "treasury" | "cse" | "pfca";
  investedAmount: number;
  grossMonthly: number;
  netMonthly: number;
  rateOrYieldPct: number;
  rateLabel: string;
  sharePct: number;
  usdInvested?: number;
  note?: string;
};

export type FinancialData = {
  sourceStatus: "live" | "fallback" | "offline";
  lastUpdated: string;
  currentFY: string;
  totalNetWorthLkr: number;
  priorNetWorthLkr: number;
  netWorthDeltaLkr: number;
  netWorthDeltaPct: number;
  categories: NetWorthCategory[];
  incomeCategories?: InvestorIncomeCategory[];
  // Official LankaWealth Passive Cashflow Metrics
  monthlyPassiveYield: {
    netMonthlyAfterProgressiveIit: number; // Net Monthly (After Progressive IIT)
    physicalCashAvailableMonthly: number;  // Physical Cash Available (Monthly)
    grossMonthly: number;
    netWhtMonthly: number;
    iitPayableMonthly: number;
    priorNetMonthlyIit: number;
    deltaNetIitPct: number;
    priorPhysicalCashMonthly: number;
    deltaPhysicalCashPct: number;
  };
  stocks: {
    portfolioValue: number;
    totalCost: number;
    unrealizedPnl: number;
    unrealizedPnlPct: number;
    dividendCashMonth: number;
    dividendCashYtd: number;
    realizedGainYtd: number;
    tickers: CseStockTicker[];
    lastPalSync?: string;
    syncedFrom?: "pal.lk" | "manual" | "financial-dashboard" | "fallback";
  };
  hardCurrencyHedgePct: number;
};

// ── Zone 2: Spendings & Income Telemetry ───────────────────────────────────────
export type InflowBreakdown = {
  totalInflow: number;
  janithaSalary: number;
  vindyaSalary: number;
  lastMonthPassive: number;
};

export type LoanRepaymentItem = {
  id: string;
  name: string;
  monthlyPayment: number;
  type: "vehicle" | "credit_card" | "overdraft";
  settled?: boolean;
};

export type OdPaymentItem = {
  id: string;
  name: string;
  monthlyPayment: number;
  currentDrawn: number;
  overdraftLimit: number;
  latestInterest: number;
};

export type OutflowBreakdown = {
  totalOutflow: number;
  taxes: {
    total: number;
    janithaTax: number;
    vindyaTax: number;
  };
  loans: {
    total: number;
    items: LoanRepaymentItem[];
  };
  od: {
    total: number;
    items: OdPaymentItem[];
  };
  vindyaExpense: number;
  household: {
    total: number;
    normal: number;
    oneTime: number;
    undocumentedBuffer?: number;
    baselineBudget: number;
    dailyAverageSpend: number;
    dailySafeBurnRate: number;
    categories: ExpenseCategoryItem[];
  };
};

export type IncomeSourceRecord = {
  id: string;
  source: string;
  earner: "Janitha" | "Vindya" | "Household";
  type: "Salary" | "Passive Income";
  amount: number;
  category?: string;
};

export type ExpenseCategoryItem = {
  id: string;
  name: string;
  amount: number;
  budgetAmount: number;
  variance: number;
  parentType: "normal" | "one_time";
  color: string;
};

export type SpendIncomeData = {
  sourceStatus: "live" | "fallback" | "offline";
  lastUpdated: string;
  currentMonth: string; // YYYY-MM
  // Inflow stream (Divided into 3 user categories)
  inflow: InflowBreakdown;
  // Outflow stream (Taxes, Loans, Household Expenses)
  outflow: OutflowBreakdown;
  // Top-level cash flow aggregates
  totalMonthlyIncome: number;
  priorMonthlyIncome: number;
  incomeDeltaPct: number;
  salaryIncome: number;
  passiveIncome: number;
  incomeSources: IncomeSourceRecord[];
  totalMonthlySpend: number;
  priorMonthlySpend: number;
  spendDeltaPct: number;
  normalLivingSpend: number;
  oneTimeSpend: number;
  baselineBudget: number;
  budgetUtilizationPct: number;
  dailyAverageSpend: number;
  dailySafeBurnRate: number;
  netCashFlow: number;
  savingsRatePct: number;
  categories: ExpenseCategoryItem[];
  dailyBurnRunRate: Array<{
    day: number;
    actualSpend: number;
    idealBudgetTrajectory: number;
  }>;
  monthlyCashflowHistory: Array<{
    month: string;
    income: number;
    normalExpense: number;
    oneTimeExpense: number;
    netSavings: number;
  }>;
};

// ── Health & Nutrition (Metabolic & Biometric) ────────────────────────────────
export type HealthData = {
  sourceStatus: "live" | "fallback" | "offline";
  lastUpdated: string;
  today: {
    calories: number;
    calorieLimit: number;
    protein: number;
    proteinGoal: number;
    carbs: number;
    fat: number;
    sugar: number;
    sugarLimit: number;
    waterGlasses: number;
    waterGoal: number;
    fastingMinutes: number;
    fastingGoalMinutes: number;
    isFastingActive: boolean;
    fastingStartTime: string | null;
    streakDays: number;
  };
  hba1c: {
    current: number;
    prior: number;
    target: number;
    quarterlyHistory: Array<{ quarter: string; value: number }>;
  };
  history7d: Array<{
    date: string;
    dayLabel: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sugar: number;
    fastingHours: number;
  }>;
};

// ── Investments & Passive Yield ───────────────────────────────────────────────
export type MaturityRadarItem = {
  id: string;
  name: string;
  institution: string;
  type: "fd" | "pfca_fd" | "tbill" | "tbond";
  currency: "LKR" | "USD";
  amount: number;
  rate: number;
  startDate?: string;
  maturityDate?: string;
  daysRemaining: number;
  status: "critical" | "warning" | "upcoming" | "unknown";
  expectedPayout: number;
  couponMonth?: number;
};

export type InvestmentData = {
  sourceStatus: "live" | "fallback" | "offline";
  lastUpdated: string;
  totalInvestedCapital: number;
  categoryBreakdown: {
    fds: number;
    uts: number;
    treasury: number;
    dividends: number;
    pfcaFds: number;
    stocks: number;
  };
  monthlyYields: {
    gross: number;
    netWht: number;
    netIit: number;
    physicalCash: number;
  };
  fire: {
    fiNumber: number;
    fiNumberToday: number;
    currentProgressPct: number;
    projectedYearsToFire: number;
    targetMonthlyIncome: number;
  };
  commitment: {
    month: string;
    plannedAmount: number;
    achievedAmount: number;
    fulfilledPct: number;
  };
  maturityRadar: MaturityRadarItem[];
};

// ── Binance Trading Bot ───────────────────────────────────────────────────────
export type BotTrade = {
  id: number | string;
  timestamp: string;
  dateStr: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  amount: number;
  cost: number;
  fee?: number;
  pnl?: number;
  pnlPct?: number;
  strategy: string;
  reason?: string;
};

export type BotPosition = {
  id?: number | string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  amount: number;
  cost: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  stopLoss: number;
  takeProfit: number;
  strategy: string;
  openedAt?: string;
  duration?: string;
};

export type BotSlot = {
  slotId: number;
  symbol: string;
  strategy: string;
  enabled: boolean;
  timeframe: string;
  currentPrice: number;
  lastSignal?: string;
  hasOpenPosition: boolean;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  unrealizedPnl?: number;
  unrealizedPnlPct?: number;
};

export type BinanceBotData = {
  sourceStatus: "live" | "cached" | "offline";
  lastUpdated: string;
  isRunning: boolean;
  mode: "paper" | "testnet" | "live";
  freeUsdt: number;
  totalWalletUsdt: number;
  openPositionsCount: number;
  completedTradesCount: number;
  winRatePct: number;
  totalRealizedPnlUsdt: number;
  monthRealizedPnlUsdt?: number;
  monthTradesCount?: number;
  monthWinningTrades?: number;
  monthLosingTrades?: number;
  slots: BotSlot[];
  openPositions?: BotPosition[];
  monthTrades?: BotTrade[];
};

// ── Fleet & Renewable Grid ───────────────────────────────────────────────────
export type GridFleetData = {
  solar: {
    currentKw: number;
    dailyKwh: number;
    dailyTargetKwh: number;
    monthlyKwh?: number;
    yearlyMwh?: number;
    gridExportStatus: "EXPORTING" | "IMPORTING" | "NEUTRAL";
    netGridKw: number;
    lifetimeMwh: number;
    lastSynced?: string;
    syncedFrom?: string;
    stationCode?: string;
    historyMonth?: Array<{
      day: number;
      date: string;
      generationKwh: number;
      exportKwh: number;
      targetKwh: number;
    }>;
  };
  fleet: {
    vehicleName: string;
    batteryPct: number;
    estimatedRangeKm: number;
    isCharging: boolean;
    chargingPowerKw: number;
    chargerConnected: boolean;
    lastSynced: string;
  };
};

// ── Sprint & Ops Tasks ────────────────────────────────────────────────────────
export type SprintTask = {
  id: string;
  title: string;
  domain: "FIN" | "BIO" | "OPS" | "GRID";
  status: "queued" | "active" | "complete";
  deadline?: string;
};

// ── Unified Aggregated Payload ────────────────────────────────────────────────
export type OpsDashboardPayload = {
  timestamp: string;
  finance: FinancialData;
  spendIncome: SpendIncomeData;
  health: HealthData;
  investments: InvestmentData;
  bot: BinanceBotData;
  gridFleet: GridFleetData;
  sprintTasks: SprintTask[];
  crossDomain: {
    trueFiCoverageBaselinePct: number;
    trueFiCoverageTotalPct: number;
    foodSpendVsCalorieCorrelation: Array<{
      date: string;
      diningSpend: number;
      calories: number;
      sugar: number;
    }>;
  };
};
