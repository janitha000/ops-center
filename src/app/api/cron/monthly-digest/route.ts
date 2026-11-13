import { NextRequest, NextResponse } from "next/server";
import {
  generateAndSendOpsDigest,
  isCronRequestAuthorized,
} from "@/lib/email/sender";

async function handleMonthlyDigest(req: NextRequest, recipient?: string) {
  if (!isCronRequestAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateAndSendOpsDigest(
      "monthly",
      recipient,
      req.nextUrl.origin
    );

    return NextResponse.json(
      {
        ok: result.success,
        type: "monthly" as const,
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
      err instanceof Error ? err.message : "Failed to run monthly digest cron";
    console.error("[Cron Monthly Digest] Error:", err);
    return NextResponse.json(
      { ok: false, type: "monthly" as const, error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to") || undefined;
  return handleMonthlyDigest(req, to);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { to?: string };
  const to = body.to || req.nextUrl.searchParams.get("to") || undefined;
  return handleMonthlyDigest(req, to);
}
