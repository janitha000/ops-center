import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleFitCode, fetchBiometricTelemetry } from "@/lib/connectors/googleFit";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/?gfit=error&reason=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?gfit=missing_code`);
  }

  const result = await exchangeGoogleFitCode(code, origin);
  if (!result.ok) {
    return NextResponse.redirect(
      `${origin}/?gfit=exchange_failed&reason=${encodeURIComponent(result.error || "unknown")}`
    );
  }

  // Trigger an initial Google Fit sync right after token exchange
  await fetchBiometricTelemetry().catch(() => {});

  return NextResponse.redirect(`${origin}/?gfit=connected`);
}
