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

    const lifetimeMwh = typeof body.lifetimeMwh === "number"
      ? body.lifetimeMwh
      : parseFloat(String(body.lifetimeMwh || body.totalYield || body.totalPower || "0").replace(/[^\d\.]/g, "")) || 14.82;

    const netGridKw = typeof body.netGridKw === "number"
      ? body.netGridKw
      : typeof body.feedInPower === "number"
      ? body.feedInPower
      : parseFloat(String(body.netGridKw || body.feedInPower || body.gridPower || currentKw * 0.75).replace(/[^\d\.]/g, "")) || 0;

    const dailyTargetKwh = typeof body.dailyTargetKwh === "number" && body.dailyTargetKwh > 0
      ? body.dailyTargetKwh
      : 30.0;

    let gridExportStatus: "EXPORTING" | "IMPORTING" | "NEUTRAL" = "EXPORTING";
    if (body.gridExportStatus === "IMPORTING" || body.gridExportStatus === "NEUTRAL") {
      gridExportStatus = body.gridExportStatus;
    } else if (currentKw <= 0.05) {
      gridExportStatus = "NEUTRAL";
    }

    const payload = {
      currentKw: Number(currentKw.toFixed(2)),
      dailyKwh: Number(dailyKwh.toFixed(2)),
      dailyTargetKwh,
      gridExportStatus,
      netGridKw: Number(netGridKw.toFixed(2)),
      lifetimeMwh: Number(lifetimeMwh.toFixed(2)),
      stationCode: body.stationCode || "NE=58772902",
      lastSynced: new Date().toISOString(),
      syncedFrom: "fusionsolar",
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
