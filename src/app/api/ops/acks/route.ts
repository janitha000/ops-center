import { NextRequest, NextResponse } from "next/server";
import {
  acknowledgeDecision,
  getDecisionAckRecords,
  resetActiveDecisionAcks,
} from "@/lib/connectors/opsStore";

export async function GET() {
  try {
    const records = await getDecisionAckRecords();
    return NextResponse.json({ success: true, records });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load acknowledgements";
    return NextResponse.json({ success: false, error: message, records: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const signalId = typeof body?.signalId === "string" ? body.signalId.trim() : "";
    const horizon = body?.horizon;
    const mode = body?.mode === "forever" ? "forever" : "period";

    if (!signalId || (horizon !== "live" && horizon !== "daily" && horizon !== "monthly")) {
      return NextResponse.json(
        { success: false, error: "Invalid signalId or horizon" },
        { status: 400 }
      );
    }

    const records = await acknowledgeDecision(signalId, horizon, mode);
    return NextResponse.json({ success: true, records });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save acknowledgement";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const records = await resetActiveDecisionAcks();
    return NextResponse.json({ success: true, records });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reset acknowledgements";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
