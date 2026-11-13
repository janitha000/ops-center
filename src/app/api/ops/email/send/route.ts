import { NextRequest, NextResponse } from "next/server";
import { generateAndSendOpsDigest, OpsDigestType } from "@/lib/email/sender";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      type?: string;
      to?: string;
    };

    const rawType = body.type?.toLowerCase();
    if (rawType && rawType !== "daily" && rawType !== "monthly") {
      return NextResponse.json(
        {
          success: false,
          mocked: false,
          error: `Invalid digest type "${body.type}". Expected "daily" or "monthly".`,
        },
        { status: 400 }
      );
    }

    const type: OpsDigestType = rawType === "monthly" ? "monthly" : "daily";
    const result = await generateAndSendOpsDigest(
      type,
      body.to,
      req.nextUrl.origin
    );

    return NextResponse.json(
      {
        success: result.success,
        mocked: result.mocked,
        messageId: result.messageId,
        subject: result.subject,
        to: result.to,
        error: result.error,
      },
      { status: result.success ? 200 : 502 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to send email digest";
    console.error("[Email Send] Error:", err);
    return NextResponse.json(
      { success: false, mocked: false, error: message },
      { status: 500 }
    );
  }
}
