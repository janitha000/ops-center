import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    const expectedPin = process.env.APP_PIN || "5454";

    if (pin && String(pin).trim() === expectedPin.trim()) {
      const response = NextResponse.json({ success: true });
      response.cookies.set("ops_auth_session", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });
      return response;
    }

    return NextResponse.json({ error: "Invalid Security PIN" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Request processing error" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const session = req.cookies.get("ops_auth_session");
  return NextResponse.json({ authenticated: session?.value === "authenticated" });
}
