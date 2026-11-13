import { createClient } from "@vercel/kv";
import { BiometricTelemetry, DailyBiometricHistoryPoint } from "../types";

const kvUrl = process.env.KV_REST_API_URL || "https://powerful-catfish-86904.upstash.io";
const kvToken = process.env.KV_REST_API_TOKEN || "gQAAAAAAAVN4AAIncDE5NDY0ZTE2MzVjYWU0ZjA4YTU3YmZmZjc1OWZmNmYwNnAxODY5MDQ";
const kv = createClient({ url: kvUrl, token: kvToken });

const KV_CONFIG_KEY = "ops_google_fit_config_v1";
const KV_TELEMETRY_KEY = "ops_google_fit_telemetry_v1";

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
let memoryTelemetry: BiometricTelemetry | null = null;

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
    manualDailyOverrides: {
      ...(existing.manualDailyOverrides || {}),
      ...(partial.manualDailyOverrides || {}),
    },
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

    await saveGoogleFitConfig({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || cfg.refreshToken,
      expiresAt: Date.now() + Number(data.expires_in || 3500) * 1000,
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

const DEFAULT_PAST_BIOMETRICS: Array<{ weightKg: number; caloriesExpended: number }> = [
  { weightKg: 76.4, caloriesExpended: 2180 },
  { weightKg: 76.3, caloriesExpended: 2240 },
  { weightKg: 76.1, caloriesExpended: 2090 },
  { weightKg: 76.2, caloriesExpended: 2310 },
  { weightKg: 76.0, caloriesExpended: 2150 },
  { weightKg: 75.9, caloriesExpended: 1980 },
  { weightKg: 75.8, caloriesExpended: 2290 },
  { weightKg: 75.7, caloriesExpended: 2120 },
  { weightKg: 75.6, caloriesExpended: 2210 },
  { weightKg: 75.5, caloriesExpended: 2170 },
  { weightKg: 75.4, caloriesExpended: 2260 },
  { weightKg: 75.3, caloriesExpended: 2190 },
  { weightKg: 75.2, caloriesExpended: 2140 },
];

export async function fetchBiometricTelemetry(): Promise<BiometricTelemetry> {
  const cfg = await getGoogleFitConfig();
  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const currentDay = now.getDate();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const monthShort = now.toLocaleString("en-US", { month: "short" });

  const targetWeightKg = cfg.targetWeightKg || 72.0;
  const targetCaloriesExpended = cfg.targetCaloriesExpended || 2200;
  const overrides = cfg.manualDailyOverrides || {};

  // 1. If connected to Google Fit, query Google Fitness REST API
  const accessToken = await getValidGoogleAccessToken(cfg);
  if (accessToken) {
    try {
      const startOfMonth = new Date(year, monthIdx, 1, 0, 0, 0, 0).getTime();
      const endOfToday = new Date(year, monthIdx, currentDay, 23, 59, 59, 999).getTime();

      // Also look back 14 days prior to month start to have a carry-forward weight if day 1 had no weigh-in
      const lookbackStart = startOfMonth - 14 * 86400_000;

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
          startTimeMillis: lookbackStart,
          endTimeMillis: endOfToday,
        }),
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        const buckets: any[] = json.bucket || [];

        const dailyMap = new Map<string, { weightKg: number | null; caloriesExpended: number }>();
        let lastKnownWeightKg: number | null = null;

        for (const b of buckets) {
          const startMs = Number(b.startTimeMillis || 0);
          const d = new Date(startMs);
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
            lastKnownWeightKg = weightVal;
          }

          dailyMap.set(iso, {
            weightKg: weightVal ?? lastKnownWeightKg,
            caloriesExpended: Math.round(calExpVal),
          });
        }

        const monthHistory: DailyBiometricHistoryPoint[] = [];
        let rollingWeight = lastKnownWeightKg || 75.2;
        let totalExpendedMtd = 0;
        let activeDaysCount = 0;

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
              rollingWeight = weightKg;
            } else if (bucketData?.weightKg !== null && bucketData?.weightKg !== undefined) {
              weightKg = bucketData.weightKg;
              rollingWeight = weightKg;
            } else {
              weightKg = rollingWeight;
            }

            if (manual?.caloriesExpended !== undefined) {
              caloriesExpended = manual.caloriesExpended;
            } else if (bucketData?.caloriesExpended) {
              caloriesExpended = bucketData.caloriesExpended;
            }

            if (caloriesExpended > 0) {
              totalExpendedMtd += caloriesExpended;
              activeDaysCount++;
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
        const todayWeightKg = todayEntry?.weightKg || rollingWeight || 75.2;
        const startMonthWeightKg = firstEntry?.weightKg || todayWeightKg;
        const weightDeltaMtdKg = Number((todayWeightKg - startMonthWeightKg).toFixed(1));
        const todayCaloriesExpended = todayEntry?.caloriesExpended || 0;
        const avgDailyCaloriesExpended = activeDaysCount > 0 ? Math.round(totalExpendedMtd / activeDaysCount) : targetCaloriesExpended;

        const livePayload: BiometricTelemetry = {
          googleFitConnected: true,
          source: "google_fit",
          lastSynced: now.toISOString(),
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

        memoryTelemetry = livePayload;
        kv.set(KV_TELEMETRY_KEY, livePayload).catch(() => {});
        return livePayload;
      }
    } catch (err) {
      console.warn("Google Fit live fetch error:", err);
    }
  }

  // 2. Fallback / Manual Overrides Mode (before Google Fit OAuth is completed or if token expired)
  const monthHistory: DailyBiometricHistoryPoint[] = [];
  let totalExpendedMtd = 0;
  let lastWeight = 76.4;

  for (let day = 1; day <= daysInMonth; day++) {
    const isoDate = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isFuture = day > currentDay;
    const preset = DEFAULT_PAST_BIOMETRICS[(day - 1) % DEFAULT_PAST_BIOMETRICS.length];
    const manual = overrides[isoDate];

    let weightKg: number | null = null;
    let caloriesExpended = 0;

    if (!isFuture) {
      weightKg = manual?.weightKg ?? preset.weightKg;
      caloriesExpended = manual?.caloriesExpended ?? preset.caloriesExpended;
      lastWeight = weightKg;
      totalExpendedMtd += caloriesExpended;
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
  const firstEntry = monthHistory[0];
  const todayWeightKg = todayEntry?.weightKg ?? lastWeight;
  const startMonthWeightKg = firstEntry?.weightKg ?? 76.4;
  const weightDeltaMtdKg = Number((todayWeightKg - startMonthWeightKg).toFixed(1));
  const todayCaloriesExpended = todayEntry?.caloriesExpended ?? 2140;
  const avgDailyCaloriesExpended = currentDay > 0 ? Math.round(totalExpendedMtd / currentDay) : 2180;
  const hasManualOverrides = Object.keys(overrides).length > 0;

  return {
    googleFitConnected: Boolean(cfg.refreshToken || cfg.accessToken),
    source: hasManualOverrides ? "manual" : "fallback",
    lastSynced: cfg.updatedAt || now.toISOString(),
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
