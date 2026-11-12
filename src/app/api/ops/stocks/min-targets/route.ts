import { NextRequest, NextResponse } from "next/server";
import { getStockMinPrices, saveStockMinPrices } from "@/lib/connectors/opsStore";

export async function GET() {
  try {
    const minPrices = await getStockMinPrices();
    return NextResponse.json({ success: true, minPrices });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const minPrices: Record<string, number> = {};

    if (body.minPrices && typeof body.minPrices === "object") {
      for (const [key, val] of Object.entries(body.minPrices)) {
        const num = Number(val);
        if (!isNaN(num) && num >= 0) {
          minPrices[key.toUpperCase()] = num;
        }
      }
    } else if (body.symbol && typeof body.minPrice !== "undefined") {
      const existing = await getStockMinPrices();
      const num = Number(body.minPrice);
      if (!isNaN(num) && num >= 0) {
        existing[String(body.symbol).toUpperCase()] = num;
      } else {
        delete existing[String(body.symbol).toUpperCase()];
      }
      Object.assign(minPrices, existing);
    }

    await saveStockMinPrices(minPrices);
    return NextResponse.json({ success: true, minPrices });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
