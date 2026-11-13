import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleFitConfig,
  saveGoogleFitConfig,
  getGoogleFitRedirectUri,
  buildGoogleFitAuthUrl,
  fetchBiometricTelemetry,
} from "@/lib/connectors/googleFit";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const [cfg, biometrics] = await Promise.all([
    getGoogleFitConfig(),
    fetchBiometricTelemetry(),
  ]);

  const authUrl = await buildGoogleFitAuthUrl(origin);

  return NextResponse.json({
    connected: Boolean(cfg.refreshToken || cfg.accessToken),
    hasCredentials: Boolean(cfg.clientId && cfg.clientSecret),
    clientId: cfg.clientId || "",
    hasClientSecret: Boolean(cfg.clientSecret),
    redirectUri: getGoogleFitRedirectUri(origin),
    authUrl,
    targetWeightKg: cfg.targetWeightKg || 72.0,
    targetCaloriesExpended: cfg.targetCaloriesExpended || 2200,
    biometrics,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const origin = req.nextUrl.origin;

    const updates: Record<string, any> = {};
    if (typeof body.clientId === "string" && body.clientId.trim()) {
      updates.clientId = body.clientId.trim();
    }
    if (typeof body.clientSecret === "string" && body.clientSecret.trim()) {
      updates.clientSecret = body.clientSecret.trim();
    }
    if (typeof body.refreshToken === "string" && body.refreshToken.trim()) {
      updates.refreshToken = body.refreshToken.trim();
    }
    if (typeof body.accessToken === "string" && body.accessToken.trim()) {
      updates.accessToken = body.accessToken.trim();
      updates.expiresAt = Date.now() + 3500 * 1000;
    }
    if (typeof body.targetWeightKg === "number" && body.targetWeightKg > 0) {
      updates.targetWeightKg = body.targetWeightKg;
    }
    if (typeof body.targetCaloriesExpended === "number" && body.targetCaloriesExpended > 0) {
      updates.targetCaloriesExpended = body.targetCaloriesExpended;
    }

    // Optional manual daily entry (today or specific date)
    if (body.dailyEntry && typeof body.dailyEntry === "object") {
      const now = new Date();
      const defaultIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const dateKey = body.dailyEntry.isoDate || defaultIso;
      const entry: { weightKg?: number; caloriesExpended?: number } = {};

      if (typeof body.dailyEntry.weightKg === "number" && body.dailyEntry.weightKg > 0) {
        entry.weightKg = Number(body.dailyEntry.weightKg.toFixed(1));
      }
      if (typeof body.dailyEntry.caloriesExpended === "number" && body.dailyEntry.caloriesExpended >= 0) {
        entry.caloriesExpended = Math.round(body.dailyEntry.caloriesExpended);
      }

      updates.manualDailyOverrides = {
        [dateKey]: entry,
      };
    }

    await saveGoogleFitConfig(updates);
    const authUrl = await buildGoogleFitAuthUrl(origin);
    const biometrics = await fetchBiometricTelemetry();

    return NextResponse.json({
      ok: true,
      authUrl,
      redirectUri: getGoogleFitRedirectUri(origin),
      biometrics,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to update Google Fit configuration" },
      { status: 400 }
    );
  }
}
