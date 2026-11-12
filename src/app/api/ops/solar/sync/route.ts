import { NextRequest, NextResponse } from "next/server";
import { saveSolarTelemetry, getSolarTelemetry } from "@/lib/connectors/opsStore";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET() {
  const cached = await getSolarTelemetry();
  return NextResponse.json(
    {
      success: true,
      data: cached,
    },
    {
      headers: CORS_HEADERS,
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extract power and yield metrics (handling various casing or raw text formats)
    const currentKw = typeof body.currentKw === "number"
      ? body.currentKw
      : parseFloat(String(body.currentKw || body.power || body.currentPower || "0").replace(/[^\d\.]/g, "")) || 0;

    const dailyKwh = typeof body.dailyKwh === "number"
      ? body.dailyKwh
      : parseFloat(String(body.dailyKwh || body.dailyYield || body.todayYield || "0").replace(/[^\d\.]/g, "")) || 0;

    let monthlyKwh = typeof body.monthlyKwh === "number"
      ? body.monthlyKwh
      : parseFloat(String(body.monthlyKwh || body.monthYield || body.monthlyYield || body.monthEnergy || body.month || "0").replace(/[^\d\.]/g, "")) || 0;
    // Auto-convert if sent in MWh
    if (body.monthlyMwh || body.monthMwh) {
      const mMwh = typeof (body.monthlyMwh || body.monthMwh) === "number"
        ? (body.monthlyMwh || body.monthMwh)
        : parseFloat(String(body.monthlyMwh || body.monthMwh).replace(/[^\d\.]/g, "")) || 0;
      if (mMwh > 0) monthlyKwh = mMwh * 1000;
    } else if (monthlyKwh > 0 && monthlyKwh < 10) {
      monthlyKwh = monthlyKwh * 1000;
    }

    let yearlyMwh = typeof body.yearlyMwh === "number"
      ? body.yearlyMwh
      : parseFloat(String(body.yearlyMwh || body.yearYield || body.yearlyYield || body.thisYear || body.year || "0").replace(/[^\d\.]/g, "")) || 0;
    if (body.yearlyKwh || body.yearKwh || yearlyMwh > 50) {
      const yKwh = body.yearlyKwh || body.yearKwh || yearlyMwh;
      const num = typeof yKwh === "number" ? yKwh : parseFloat(String(yKwh).replace(/[^\d\.]/g, "")) || 0;
      yearlyMwh = num > 50 ? num / 1000 : num;
    }
    if (yearlyMwh <= 0) yearlyMwh = 3.84;

    let lifetimeMwh = typeof body.lifetimeMwh === "number"
      ? body.lifetimeMwh
      : parseFloat(String(body.lifetimeMwh || body.totalYield || body.totalPower || body.total || "0").replace(/[^\d\.]/g, "")) || 0;
    if (body.lifetimeKwh || body.totalKwh || lifetimeMwh > 100) {
      const totKwh = body.lifetimeKwh || body.totalKwh || lifetimeMwh;
      const num = typeof totKwh === "number" ? totKwh : parseFloat(String(totKwh).replace(/[^\d\.]/g, "")) || 0;
      lifetimeMwh = num > 100 ? num / 1000 : num;
    }
    if (lifetimeMwh <= 0) lifetimeMwh = yearlyMwh || 3.84;

    // Auto-detect and reconcile shifted or swapped yield metrics
    // In solar PV: Today's Yield < Month's Yield < Year's Yield <= Lifetime Total
    let finalDailyKwh = dailyKwh;
    let finalMonthlyKwh = monthlyKwh;
    let finalYearlyMwh = yearlyMwh;
    let finalLifetimeMwh = lifetimeMwh;

    if (finalDailyKwh > 40 || (finalMonthlyKwh > 1000 && finalMonthlyKwh > finalDailyKwh) || (finalLifetimeMwh < 2 && finalDailyKwh > 50)) {
      const raw = [finalDailyKwh, finalMonthlyKwh, finalYearlyMwh, finalLifetimeMwh];
      
      // Monthly MTD: typically 35 - 900 kWh
      const mCandidate = raw.find(n => n > 35 && n < 900);
      if (mCandidate) finalMonthlyKwh = mCandidate;

      // Yearly YTD: either > 900 kWh or in MWh around 2 - 20
      const yCandidate = raw.find(n => n >= 900 && n <= 10000);
      if (yCandidate) finalYearlyMwh = Number((yCandidate / 1000).toFixed(2));
      else {
        const yMwhCandidate = raw.find(n => n >= 2 && n <= 20 && n !== finalMonthlyKwh);
        if (yMwhCandidate) finalYearlyMwh = Number(yMwhCandidate.toFixed(2));
      }

      // Total Lifetime: the largest MWh number (>= yearly)
      const tCandidate = raw.find(n => n >= (finalYearlyMwh || 2) && n <= 50);
      if (tCandidate) finalLifetimeMwh = Number(tCandidate.toFixed(2));

      // Today's Yield: the smallest number <= 35
      const dCandidate = raw.find(n => n > 0 && n <= 35 && n !== finalLifetimeMwh && n !== finalYearlyMwh);
      if (dCandidate) finalDailyKwh = Number(dCandidate.toFixed(2));
    }

    const netGridKw = typeof body.netGridKw === "number"
      ? body.netGridKw
      : typeof body.feedInPower === "number"
      ? body.feedInPower
      : parseFloat(String(body.netGridKw || body.feedInPower || body.gridPower || currentKw * 0.75).replace(/[^\d\.]/g, "")) || 0;

    const dailyTargetKwh = typeof body.dailyTargetKwh === "number" && body.dailyTargetKwh > 0
      ? body.dailyTargetKwh
      : 15.0;

    let gridExportStatus: "EXPORTING" | "IMPORTING" | "NEUTRAL" = "EXPORTING";
    if (body.gridExportStatus === "IMPORTING" || body.gridExportStatus === "NEUTRAL") {
      gridExportStatus = body.gridExportStatus;
    } else if (currentKw <= 0.05) {
      gridExportStatus = "NEUTRAL";
    }

    const historyMonth = Array.isArray(body.historyMonth) && body.historyMonth.length > 0
      ? body.historyMonth
      : undefined;

    const payload = {
      currentKw: Number(currentKw.toFixed(2)),
      dailyKwh: Number(finalDailyKwh.toFixed(2)),
      dailyTargetKwh,
      monthlyKwh: finalMonthlyKwh > 0 ? Number(finalMonthlyKwh.toFixed(1)) : undefined,
      yearlyMwh: finalYearlyMwh > 0 ? Number(finalYearlyMwh.toFixed(2)) : 3.84,
      gridExportStatus,
      netGridKw: Number(netGridKw.toFixed(2)),
      lifetimeMwh: Number(finalLifetimeMwh.toFixed(2)),
      stationCode: body.stationCode || "NE=58772902",
      lastSynced: new Date().toISOString(),
      syncedFrom: "fusionsolar",
      historyMonth,
    };

    await saveSolarTelemetry(payload);

    return NextResponse.json(
      {
        success: true,
        message: `Successfully synced FusionSolar telemetry: ${payload.currentKw} kW, ${payload.dailyKwh} kWh today`,
        data: payload,
      },
      {
        headers: CORS_HEADERS,
      }
    );
  } catch (err: any) {
    console.error("Solar telemetry sync error:", err);
    return NextResponse.json(
      { error: "Failed to process FusionSolar sync", details: err.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
