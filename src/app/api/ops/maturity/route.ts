import { NextRequest, NextResponse } from "next/server";
import { saveInstrumentOverride } from "@/lib/connectors/opsStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { instrumentId, startDate, maturityDate, notes } = body;

    if (!instrumentId) {
      return NextResponse.json({ error: "Missing instrumentId" }, { status: 400 });
    }

    await saveInstrumentOverride({
      instrumentId,
      startDate,
      maturityDate,
      notes,
    });

    return NextResponse.json({ success: true, instrumentId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save" }, { status: 500 });
  }
}
