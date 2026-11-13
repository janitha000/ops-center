import { NextRequest, NextResponse } from "next/server";
import {
  generateAndSendOpsDigest,
  isCronRequestAuthorized,
} from "@/lib/email/sender";

async function handleDailyDigest(req: NextRequest, recipient?: string) {
  if (!isCronRequestAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateAndSendOpsDigest(
      "daily",
      recipient,
      req.nextUrl.origin
    );

    return NextResponse.json(
      {
        ok: result.success,
        type: "daily" as const,
        mocked: result.mocked,
        messageId: result.messageId,
        subject: result.subject,
        to: result.to,
        decisionsCount: result.decisionsCount,
        error: result.error,
      },
      { status: result.success ? 200 : 502 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to run daily digest cron";
    console.error("[Cron Daily Digest] Error:", err);
    return NextResponse.json(
      { ok: false, type: "daily" as const, error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to") || undefined;
  return handleDailyDigest(req, to);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { to?: string };
  const to = body.to || req.nextUrl.searchParams.get("to") || undefined;
  return handleDailyDigest(req, to);
}
