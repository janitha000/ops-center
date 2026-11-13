import { NextRequest, NextResponse } from "next/server";
import { buildGoogleFitAuthUrl } from "@/lib/connectors/googleFit";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const authUrl = await buildGoogleFitAuthUrl(origin);

  if (!authUrl) {
    return NextResponse.redirect(`${origin}/?gfit=missing_credentials`);
  }

  return NextResponse.redirect(authUrl);
}
