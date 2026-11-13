import { NextRequest, NextResponse } from "next/server";
import { generateOpsDigest, OpsDigestType } from "@/lib/email/sender";

export async function GET(req: NextRequest) {
  const rawType = req.nextUrl.searchParams.get("type")?.toLowerCase();
  const origin = req.nextUrl.origin;

  if (rawType && rawType !== "daily" && rawType !== "monthly") {
    return NextResponse.json(
      { success: false, error: `Invalid digest type "${rawType}". Expected "daily" or "monthly".` },
      { status: 400 }
    );
  }

  try {
    const type: OpsDigestType = rawType === "monthly" ? "monthly" : "daily";
    const digest = await generateOpsDigest(type, origin);

    return NextResponse.json({
      success: true,
      type: digest.type,
      subject: digest.subject,
      html: digest.html,
      decisionsCount: digest.decisionsCount,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to generate email preview";
    console.error("[Email Preview] Error:", err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
