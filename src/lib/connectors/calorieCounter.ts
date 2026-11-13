import { neon } from "@neondatabase/serverless";
import { HealthData } from "../types";
import { fetchBiometricTelemetry } from "./googleFit";

const SLT_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getSltDateInfo(epochMs = Date.now()) {
  const slt = new Date(epochMs + SLT_OFFSET_MS);
  const year = slt.getUTCFullYear();
  const monthIdx = slt.getUTCMonth();
  const day = slt.getUTCDate();
  const isoDate = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, monthIdx, day, isoDate };
}

function cleanRscDate(val: string | null | undefined): string | null {
  if (!val || typeof val !== "string" || val === "$undefined") return null;
  return val.startsWith("$D") ? val.slice(2) : val;
}

interface RawCalorieMeal {
  loggedAt?: string | null;
  sugar?: number | string | null;
  calories?: number | string | null;
  type?: string | null;
}

interface ParsedDaySnapshot {
  consumedCalories: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFat: number;
  consumedSugar: number;
  calorieLimit: number;
  proteinGoal: number;
  sugarLimit: number;
  waterGoal: number;
  latestMealLoggedAt: string | null;
  yesterdayLastMealAt: string | null;
  fastBrokenMealAt: string | null;
  mealCaloriesByCategory?: Record<string, number>;
}

async function fetchCalorieDaySnapshot(appUrl: string, isoDate: string): Promise<ParsedDaySnapshot | null> {
  try {
    const res = await fetch(`${appUrl}/?date=${isoDate}`, {
      headers: {
        Cookie: "auth_pin=valid",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LifeOpsDashboard/1.0",
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Decode RSC flight chunks
    const regex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
    let allFlight = "";
    let match;
    while ((match = regex.exec(html)) !== null) {
      allFlight += match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\") + "\n";
    }

    // Parse TactileDashboard props JSON block directly
    const idx = allFlight.indexOf('"initialMeals":');
    if (idx !== -1) {
      const endIdx = allFlight.indexOf("]]", idx);
      if (endIdx !== -1) {
        const rawJson = "{" + allFlight.slice(idx, endIdx);
        try {
          const props = JSON.parse(rawJson);
          const meals: RawCalorieMeal[] = Array.isArray(props.initialMeals) ? props.initialMeals : [];
          const goals = props.initialGoals || {};

          // Sort meals chronologically to find first meal with sugar > 0 (fast broken)
          const sortedMeals = [...meals]
            .map((m) => ({
              ...m,
              cleanLoggedAt: cleanRscDate(m.loggedAt),
            }))
            .filter((m): m is RawCalorieMeal & { cleanLoggedAt: string } => Boolean(m.cleanLoggedAt))
            .sort(
              (a, b) =>
                new Date(a.cleanLoggedAt).getTime() - new Date(b.cleanLoggedAt).getTime()
            );

          const fastBrokenMeal = sortedMeals.find((m) => Number(m.sugar || 0) > 0);
          const mealCaloriesByCategory: Record<string, number> = {};
          for (const m of meals) {
            const cat = String(m?.type || "snack").trim().toLowerCase() || "snack";
            const cals = Math.round(Number(m?.calories || 0));
            if (cals > 0) {
              mealCaloriesByCategory[cat] = (mealCaloriesByCategory[cat] || 0) + cals;
            }
          }

          return {
            consumedCalories: Math.round(Number(props.consumedCalories || 0)),
            consumedProtein: Math.round(Number(props.consumedProtein || 0)),
            consumedCarbs: Math.round(Number(props.consumedCarbs || 0)),
            consumedFat: Math.round(Number(props.consumedFat || 0)),
            consumedSugar: Math.round(Number(props.consumedSugar || 0)),
            calorieLimit: Number(goals.calories || props.defaultTdee || 1600),
            proteinGoal: Number(goals.protein || 135),
            sugarLimit: Number(goals.sugar || 20),
            waterGoal: Number(goals.water || 8),
            latestMealLoggedAt: cleanRscDate(props.latestMealLoggedAt),
            yesterdayLastMealAt: cleanRscDate(props.yesterdayLastMealAt),
            fastBrokenMealAt: fastBrokenMeal ? fastBrokenMeal.cleanLoggedAt : null,
            mealCaloriesByCategory,
          };
        } catch {
          // fallback to regex extraction below
        }
      }
    }

    // Fallback regex on raw HTML if JSON slice failed
    const calMatch = html.match(/consumedCalories\\":(\d+)/);
    const protMatch = html.match(/consumedProtein\\":([\d\.]+)/);
    const carbMatch = html.match(/consumedCarbs\\":([\d\.]+)/);
    const fatMatch = html.match(/consumedFat\\":([\d\.]+)/);
    const sugMatch = html.match(/consumedSugar\\":([\d\.]+)/);
    const tdeeMatch = html.match(/defaultTdee\\":(\d+)/);
    const latestMatch = html.match(/latestMealLoggedAt\\":\\"([^\\"]*)\\"/);
    const yestMatch = html.match(/yesterdayLastMealAt\\":\\"([^\\"]*)\\"/);

    if (calMatch) {
      return {
        consumedCalories: parseInt(calMatch[1], 10),
        consumedProtein: protMatch ? Math.round(parseFloat(protMatch[1])) : 0,
        consumedCarbs: carbMatch ? Math.round(parseFloat(carbMatch[1])) : 0,
        consumedFat: fatMatch ? Math.round(parseFloat(fatMatch[1])) : 0,
        consumedSugar: sugMatch ? Math.round(parseFloat(sugMatch[1])) : 0,
        calorieLimit: tdeeMatch ? parseInt(tdeeMatch[1], 10) : 1600,
        proteinGoal: 135,
        sugarLimit: 20,
        waterGoal: 8,
        latestMealLoggedAt: latestMatch ? cleanRscDate(latestMatch[1]) : null,
        yesterdayLastMealAt: yestMatch ? cleanRscDate(yestMatch[1]) : null,
        fastBrokenMealAt: null,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchCalorieCounterData(): Promise<HealthData> {
  const appUrl = (process.env.CALORIE_APP_URL || "https://calorie-counter-navy.vercel.app").replace(/\/$/, "");
  const now = new Date();
  const { year, monthIdx, day: currentDay, isoDate: todayIso } = getSltDateInfo(now.getTime());

  // Fetch Google Fit biometrics + all days of current month from Calorie Counter in parallel
  const dayIsoList: string[] = [];
  for (let d = 1; d <= currentDay; d++) {
    dayIsoList.push(`${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const [biometrics, ...daySnapshots] = await Promise.all([
    fetchBiometricTelemetry(),
    ...dayIsoList.map((iso) => fetchCalorieDaySnapshot(appUrl, iso)),
  ]);

  const intakeByIso = new Map<string, ParsedDaySnapshot>();
  dayIsoList.forEach((iso, idx) => {
    const snap = daySnapshots[idx];
    if (snap) intakeByIso.set(iso, snap);
  });

  // Merge daily calorie intake into biometrics.monthHistory
  let mtdCaloriesIntake = 0;
  let activeIntakeDays = 0;
  for (const pt of biometrics.monthHistory) {
    const snap = intakeByIso.get(pt.isoDate);
    const dayIntake = snap ? snap.consumedCalories : 0;
    pt.caloriesIntake = dayIntake;
    if (pt.day <= currentDay && dayIntake > 0) {
      mtdCaloriesIntake += dayIntake;
      activeIntakeDays++;
    }
  }
  biometrics.mtdCaloriesIntake = mtdCaloriesIntake;
  biometrics.avgDailyCaloriesIntake =
    activeIntakeDays > 0 ? Math.round(mtdCaloriesIntake / activeIntakeDays) : 0;

  const todaySnap = intakeByIso.get(todayIso);

  if (todaySnap) {
    // Compute exact Fasting Interval matching Calorie Counter TopHUD.jsx logic:
    // Last meal yesterday -> First meal today with sugar > 0 (or ongoing to now)
    let fastingStartTime: string | null =
      todaySnap.yesterdayLastMealAt || todaySnap.latestMealLoggedAt;
    let fastingEndTime: string | null = null;
    let isFastingActive = true;
    let fastingMinutes = 0;

    if (todaySnap.yesterdayLastMealAt && todaySnap.fastBrokenMealAt) {
      fastingStartTime = todaySnap.yesterdayLastMealAt;
      fastingEndTime = todaySnap.fastBrokenMealAt;
      isFastingActive = false;
      const startMs = new Date(todaySnap.yesterdayLastMealAt).getTime();
      const endMs = new Date(todaySnap.fastBrokenMealAt).getTime();
      if (!isNaN(startMs) && !isNaN(endMs)) {
        fastingMinutes = Math.max(1, Math.floor((endMs - startMs) / 60000));
      }
    } else if (todaySnap.yesterdayLastMealAt && !todaySnap.fastBrokenMealAt) {
      fastingStartTime = todaySnap.yesterdayLastMealAt;
      fastingEndTime = null;
      isFastingActive = true;
      const startMs = new Date(todaySnap.yesterdayLastMealAt).getTime();
      if (!isNaN(startMs)) {
        fastingMinutes = Math.max(1, Math.floor((now.getTime() - startMs) / 60000));
      }
    } else if (todaySnap.latestMealLoggedAt) {
      fastingStartTime = todaySnap.latestMealLoggedAt;
      fastingEndTime = null;
      isFastingActive = true;
      const startMs = new Date(todaySnap.latestMealLoggedAt).getTime();
      if (!isNaN(startMs)) {
        fastingMinutes = Math.max(1, Math.floor((now.getTime() - startMs) / 60000));
      }
    }

    return {
      sourceStatus: "live",
      lastUpdated: now.toISOString(),
      today: {
        calories: todaySnap.consumedCalories,
        calorieLimit: todaySnap.calorieLimit,
        protein: todaySnap.consumedProtein,
        proteinGoal: todaySnap.proteinGoal,
        carbs: todaySnap.consumedCarbs,
        fat: todaySnap.consumedFat,
        sugar: todaySnap.consumedSugar,
        sugarLimit: todaySnap.sugarLimit,
        waterGlasses: 6,
        waterGoal: todaySnap.waterGoal,
        fastingMinutes,
        fastingGoalMinutes: 16 * 60,
        isFastingActive,
        fastingStartTime,
        fastingEndTime,
        streakDays: 14,
        weightKg: biometrics.todayWeightKg,
        caloriesExpended: biometrics.todayCaloriesExpended,
        mealCaloriesByCategory: todaySnap.mealCaloriesByCategory,
      },
      biometrics,
      hba1c: {
        current: 6.0,
        prior: 5.5,
        target: 5.6,
        quarterlyHistory: [],
      },
      history7d: buildRecent7dHistory(dayIsoList, intakeByIso, fastingMinutes),
    };
  }

  // Fallback if Calorie Counter web app is unreachable
  return {
    sourceStatus: "fallback",
    lastUpdated: now.toISOString(),
    today: {
      calories: 0,
      calorieLimit: 1600,
      protein: 0,
      proteinGoal: 135,
      carbs: 0,
      fat: 0,
      sugar: 0,
      sugarLimit: 20,
      waterGlasses: 6,
      waterGoal: 8,
      fastingMinutes: 600,
      fastingGoalMinutes: 16 * 60,
      isFastingActive: true,
      fastingStartTime: null,
      fastingEndTime: null,
      streakDays: 14,
      weightKg: biometrics.todayWeightKg,
      caloriesExpended: biometrics.todayCaloriesExpended,
    },
    biometrics,
    hba1c: {
      current: 6.0,
      prior: 5.5,
      target: 5.6,
      quarterlyHistory: [],
    },
    history7d: buildRecent7dHistory(dayIsoList, intakeByIso, 600),
  };
}

function buildRecent7dHistory(
  dayIsoList: string[],
  intakeByIso: Map<string, ParsedDaySnapshot>,
  todayFastMin: number
) {
  const recentIsos = dayIsoList.slice(-7);
  return recentIsos.map((iso, idx) => {
    const snap = intakeByIso.get(iso);
    const d = new Date(iso + "T00:00:00Z");
    const isLast = idx === recentIsos.length - 1;
    const dayLabel = isLast
      ? "Today"
      : d.toLocaleString("en-US", { weekday: "short", timeZone: "UTC" });

    let fastingHours = isLast ? Number((todayFastMin / 60).toFixed(1)) : 16.0;
    if (snap && snap.yesterdayLastMealAt && snap.fastBrokenMealAt) {
      const diffHrs =
        (new Date(snap.fastBrokenMealAt).getTime() -
          new Date(snap.yesterdayLastMealAt).getTime()) /
        3600_000;
      if (diffHrs > 0) fastingHours = Number(diffHrs.toFixed(1));
    }

    return {
      date: iso,
      dayLabel,
      calories: snap?.consumedCalories ?? 0,
      protein: snap?.consumedProtein ?? 0,
      carbs: snap?.consumedCarbs ?? 0,
      fat: snap?.consumedFat ?? 0,
      sugar: snap?.consumedSugar ?? 0,
      fastingHours,
    };
  });
}
