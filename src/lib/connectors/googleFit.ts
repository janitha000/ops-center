import { createClient } from "@vercel/kv";
import { BiometricTelemetry, DailyBiometricHistoryPoint } from "../types";

const kvUrl = process.env.KV_REST_API_URL || "https://powerful-catfish-86904.upstash.io";
const kvToken = process.env.KV_REST_API_TOKEN || "gQAAAAAAAVN4AAIncDE5NDY0ZTE2MzVjYWU0ZjA4YTU3YmZmZjc1OWZmNmYwNnAxODY5MDQ";
const kv = createClient({ url: kvUrl, token: kvToken });

const KV_CONFIG_KEY = "ops_google_fit_config_v1";
const KV_TELEMETRY_KEY = "ops_google_fit_telemetry_v1";

// Sri Lanka Standard Time offset: UTC+05:30 (19,800,000 ms)
const SLT_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getSltDateParts(epochMs = Date.now()) {
  const slt = new Date(epochMs + SLT_OFFSET_MS);
  const year = slt.getUTCFullYear();
  const monthIdx = slt.getUTCMonth(); // 0-based
  const day = slt.getUTCDate();
  const isoDate = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const monthShort = slt.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return { year, monthIdx, day, isoDate, monthShort };
}

function getSltMidnightUtcMs(year: number, monthIdx: number, day: number): number {
  return Date.UTC(year, monthIdx, day, 0, 0, 0, 0) - SLT_OFFSET_MS;
}

export type GoogleFitConfig = {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
  targetWeightKg?: number;
  targetCaloriesExpended?: number;
  manualDailyOverrides?: Record<
    string,
    {
      weightKg?: number;
      caloriesExpended?: number;
    }
  >;
  updatedAt?: string;
};

let memoryConfig: GoogleFitConfig = {};

export async function getGoogleFitConfig(): Promise<GoogleFitConfig> {
  try {
    const data = await kv.get<GoogleFitConfig>(KV_CONFIG_KEY);
    if (data && typeof data === "object") {
      memoryConfig = data;
      return {
        ...data,
        clientId: data.clientId || process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_FIT_CLIENT_ID,
        clientSecret: data.clientSecret || process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_FIT_CLIENT_SECRET,
      };
    }
  } catch (err) {
    console.warn("Error reading Google Fit config from KV:", err);
  }

  return {
    ...memoryConfig,
    clientId: memoryConfig.clientId || process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_FIT_CLIENT_ID,
    clientSecret: memoryConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_FIT_CLIENT_SECRET,
  };
}

export async function saveGoogleFitConfig(partial: Partial<GoogleFitConfig>): Promise<GoogleFitConfig> {
  const existing = await getGoogleFitConfig();
  const merged: GoogleFitConfig = {
    ...existing,
    ...partial,
    manualDailyOverrides:
      partial.manualDailyOverrides !== undefined
        ? partial.manualDailyOverrides
        : existing.manualDailyOverrides || {},
    updatedAt: new Date().toISOString(),
  };
  memoryConfig = merged;

  try {
    await kv.set(KV_CONFIG_KEY, merged);
  } catch (err) {
    console.warn("Error saving Google Fit config to KV:", err);
  }

  return merged;
}

export function getGoogleFitRedirectUri(origin: string): string {
  const cleanOrigin = origin.replace(/\/$/, "");
  return `${cleanOrigin}/api/ops/biometrics/google-fit/callback`;
}

export async function buildGoogleFitAuthUrl(origin: string): Promise<string | null> {
  const cfg = await getGoogleFitConfig();
  if (!cfg.clientId) return null;

  const redirectUri = getGoogleFitRedirectUri(origin);
  const scopes = [
    "https://www.googleapis.com/auth/fitness.body.read",
    "https://www.googleapis.com/auth/fitness.activity.read",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleFitCode(code: string, origin: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getGoogleFitConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    return { ok: false, error: "Missing Google OAuth Client ID or Client Secret." };
  }

  const redirectUri = getGoogleFitRedirectUri(origin);
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { ok: false, error: data.error_description || data.error || "Token exchange failed" };
    }

    // Clear any stale manual overrides when freshly linking Google Fit OAuth
    await saveGoogleFitConfig({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || cfg.refreshToken,
      expiresAt: Date.now() + Number(data.expires_in || 3500) * 1000,
      manualDailyOverrides: {},
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error during token exchange" };
  }
}

async function getValidGoogleAccessToken(cfg: GoogleFitConfig): Promise<string | null> {
  if (cfg.accessToken && cfg.expiresAt && Date.now() < cfg.expiresAt - 60_000) {
    return cfg.accessToken;
  }

  if (!cfg.refreshToken || !cfg.clientId || !cfg.clientSecret) {
    return cfg.accessToken || null;
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: cfg.refreshToken,
        grant_type: "refresh_token",
      }).toString(),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;

    await saveGoogleFitConfig({
      accessToken: data.access_token,
      expiresAt: Date.now() + Number(data.expires_in || 3500) * 1000,
    });

    return data.access_token as string;
  } catch (err) {
    console.warn("Google Fit token refresh failed:", err);
    return null;
  }
}

export async function fetchBiometricTelemetry(): Promise<BiometricTelemetry> {
  const cfg = await getGoogleFitConfig();
  const nowMs = Date.now();
  const { year, monthIdx, day: currentDay, monthShort } = getSltDateParts(nowMs);
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();

  const targetWeightKg = cfg.targetWeightKg || 75.0;
  const targetCaloriesExpended = cfg.targetCaloriesExpended || 2200;
  const overrides = cfg.manualDailyOverrides || {};

  // 1. Query Google Fit REST API with exact Sri Lanka Time (UTC+05:30) 24-hour day buckets
  const accessToken = await getValidGoogleAccessToken(cfg);
  if (accessToken) {
    try {
      const startOfMonthMs = getSltMidnightUtcMs(year, monthIdx, 1);
      const endOfTodayMs = getSltMidnightUtcMs(year, monthIdx, currentDay + 1) - 1;
      const lookbackStartMs = startOfMonthMs - 14 * 86400_000;

      const res = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aggregateBy: [
            { dataTypeName: "com.google.weight" },
            { dataTypeName: "com.google.calories.expended" },
          ],
          bucketByTime: { durationMillis: 86400_000 },
          startTimeMillis: lookbackStartMs,
          endTimeMillis: endOfTodayMs,
        }),
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        const buckets: any[] = json.bucket || [];

        const dailyMap = new Map<string, { weightKg: number | null; caloriesExpended: number }>();
        let latestWeightOverall: number | null = null;

        for (const b of buckets) {
          const startMs = Number(b.startTimeMillis || 0);
          const { isoDate } = getSltDateParts(startMs);

          let weightVal: number | null = null;
          let calExpVal = 0;

          for (const ds of b.dataset || []) {
            const sourceId = String(ds.dataSourceId || "");
            for (const pt of ds.point || []) {
              const fp = pt.value?.[0]?.fpVal;
              if (typeof fp === "number" && fp > 0) {
                if (sourceId.includes("weight")) {
                  weightVal = Number(fp.toFixed(1));
                } else if (sourceId.includes("calories.expended")) {
                  calExpVal += fp;
                }
              }
            }
          }

          if (weightVal !== null) {
            latestWeightOverall = weightVal;
          }

          dailyMap.set(isoDate, {
            weightKg: weightVal,
            caloriesExpended: Math.round(calExpVal),
          });
        }

        const monthHistory: DailyBiometricHistoryPoint[] = [];
        let carryForwardWeight: number | null = null;
        let totalExpendedMtd = 0;
        let activeCalorieDaysCount = 0;

        for (let day = 1; day <= daysInMonth; day++) {
          const isoDate = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isFuture = day > currentDay;
          const bucketData = dailyMap.get(isoDate);
          const manual = overrides[isoDate];

          let weightKg: number | null = null;
          let caloriesExpended = 0;

          if (!isFuture) {
            if (manual?.weightKg !== undefined) {
              weightKg = manual.weightKg;
              carryForwardWeight = weightKg;
            } else if (bucketData?.weightKg !== null && bucketData?.weightKg !== undefined) {
              weightKg = bucketData.weightKg;
              carryForwardWeight = weightKg;
            } else if (carryForwardWeight !== null) {
              weightKg = carryForwardWeight;
            }

            if (manual?.caloriesExpended !== undefined) {
              caloriesExpended = manual.caloriesExpended;
            } else if (bucketData?.caloriesExpended) {
              caloriesExpended = bucketData.caloriesExpended;
            }

            if (caloriesExpended > 0) {
              totalExpendedMtd += caloriesExpended;
              activeCalorieDaysCount++;
            }
          }

          monthHistory.push({
            day,
            date: `${monthShort} ${day}`,
            isoDate,
            weightKg,
            caloriesExpended,
          });
        }

        const todayEntry = monthHistory[currentDay - 1];
        const firstLoggedWeightEntry = monthHistory.find((m) => m.weightKg !== null);
        const todayWeightKg = todayEntry?.weightKg ?? latestWeightOverall ?? 0;
        const startMonthWeightKg = firstLoggedWeightEntry?.weightKg ?? todayWeightKg;
        const weightDeltaMtdKg =
          todayWeightKg > 0 && startMonthWeightKg > 0
            ? Number((todayWeightKg - startMonthWeightKg).toFixed(1))
            : 0;
        const todayCaloriesExpended = todayEntry?.caloriesExpended ?? 0;
        const avgDailyCaloriesExpended =
          activeCalorieDaysCount > 0 ? Math.round(totalExpendedMtd / activeCalorieDaysCount) : 0;

        const livePayload: BiometricTelemetry = {
          googleFitConnected: true,
          source: "google_fit",
          lastSynced: new Date().toISOString(),
          todayWeightKg,
          targetWeightKg,
          startMonthWeightKg,
          weightDeltaMtdKg,
          todayCaloriesExpended,
          targetCaloriesExpended,
          avgDailyCaloriesExpended,
          mtdCaloriesExpended: totalExpendedMtd,
          monthHistory,
        };

        kv.set(KV_TELEMETRY_KEY, livePayload).catch(() => {});
        return livePayload;
      }
    } catch (err) {
      console.warn("Google Fit live fetch error:", err);
    }
  }

  // 2. If not connected yet, return clean zero/override state without fake weights
  const monthHistory: DailyBiometricHistoryPoint[] = [];
  let totalExpendedMtd = 0;
  let activeDays = 0;
  let lastWeight: number | null = null;

  for (let day = 1; day <= daysInMonth; day++) {
    const isoDate = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isFuture = day > currentDay;
    const manual = overrides[isoDate];

    let weightKg: number | null = null;
    let caloriesExpended = 0;

    if (!isFuture && manual) {
      if (manual.weightKg !== undefined) {
        weightKg = manual.weightKg;
        lastWeight = weightKg;
      }
      if (manual.caloriesExpended !== undefined) {
        caloriesExpended = manual.caloriesExpended;
        totalExpendedMtd += caloriesExpended;
        activeDays++;
      }
    }

    monthHistory.push({
      day,
      date: `${monthShort} ${day}`,
      isoDate,
      weightKg,
      caloriesExpended,
    });
  }

  const todayEntry = monthHistory[currentDay - 1];
  const firstEntry = monthHistory.find((m) => m.weightKg !== null);
  const todayWeightKg = todayEntry?.weightKg ?? lastWeight ?? 0;
  const startMonthWeightKg = firstEntry?.weightKg ?? todayWeightKg;
  const weightDeltaMtdKg = Number((todayWeightKg - startMonthWeightKg).toFixed(1));
  const todayCaloriesExpended = todayEntry?.caloriesExpended ?? 0;
  const avgDailyCaloriesExpended = activeDays > 0 ? Math.round(totalExpendedMtd / activeDays) : 0;

  return {
    googleFitConnected: Boolean(cfg.refreshToken || cfg.accessToken),
    source: Object.keys(overrides).length > 0 ? "manual" : "fallback",
    lastSynced: cfg.updatedAt || new Date().toISOString(),
    todayWeightKg,
    targetWeightKg,
    startMonthWeightKg,
    weightDeltaMtdKg,
    todayCaloriesExpended,
    targetCaloriesExpended,
    avgDailyCaloriesExpended,
    mtdCaloriesExpended: totalExpendedMtd,
    monthHistory,
  };
}
