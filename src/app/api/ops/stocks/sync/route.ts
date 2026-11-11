import { NextRequest, NextResponse } from "next/server";
import { savePalHoldings, getPalHoldings } from "@/lib/connectors/opsStore";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET() {
  const cached = await getPalHoldings();
  return NextResponse.json(
    {
      success: true,
      data: cached,
    },
    {
      headers: CORS_HEADERS,
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Pal.lk returns either an array of summaries or an object containing an array
    let items: any[] = [];
    if (Array.isArray(body)) {
      items = body;
    } else if (Array.isArray(body?.data)) {
      items = body.data;
    } else if (Array.isArray(body?.summaries)) {
      items = body.summaries;
    } else if (Array.isArray(body?.holdings)) {
      items = body.holdings;
    } else if (body && typeof body === "object") {
      // Find first array property
      const arrKey = Object.keys(body).find((k) => Array.isArray(body[k]));
      if (arrKey) {
        items = body[arrKey];
      }
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "No portfolio items found in payload" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Normalize each holding item and fetch live CSE price if price is 0
    const normalized = await Promise.all(
      items
        .filter((item) => item && (item.symbol || item.displaySymbol))
        .map(async (item) => {
          const symbol = String(item.symbol || item.displaySymbol || "").trim().toUpperCase();
          const cleanSymbol = symbol.includes(".") ? symbol : `${symbol}.N0000`;
          const displaySymbol = String(item.displaySymbol || symbol.split(".")[0] || symbol);
          let name = String(item.name || item.companyName || displaySymbol);
          let quantity = Number(item.quantity || item.qty || 0);
          let marketValue = Number(item.marketValue || item.market_value || 0);
          let costBasis = Number(item.costBasis || item.cost_basis || item.totalCost || 0);
          let price = Number(
            item.currentPrice ||
            item.lastTradedPrice ||
            item.price ||
            (quantity > 0 && marketValue > 0 ? marketValue / quantity : 0)
          );
          let change = Number(item.todayChange || item.change || 0);
          let changePct = Number(item.changePercentage || item.changePct || 0);

          // If price is missing or 0, enrich directly from official live CSE API
          if (price <= 0) {
            try {
              const res = await fetch("https://www.cse.lk/api/companyInfoSummery", {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  "User-Agent": "Mozilla/5.0",
                  "Referer": "https://www.cse.lk",
                },
                body: new URLSearchParams({ symbol: cleanSymbol }),
                signal: AbortSignal.timeout(3000),
              });
              const j = await res.json();
              if (j?.reqSymbolInfo?.lastTradedPrice) {
                price = parseFloat(j.reqSymbolInfo.lastTradedPrice);
                changePct = parseFloat(j.reqSymbolInfo.changePercentage || "0");
                change = parseFloat(j.reqSymbolInfo.change || "0");
                if (j.reqSymbolInfo.name) name = j.reqSymbolInfo.name;
              }
            } catch (cseErr) {
              console.warn(`CSE quote fetch failed for ${cleanSymbol}:`, cseErr);
            }
          }

          if (marketValue <= 0 && quantity > 0 && price > 0) {
            marketValue = quantity * price;
          }

          const unrealizedPnl = Number(
            item.unrealizedGain ?? item.pnl ?? (marketValue > 0 && costBasis > 0 ? marketValue - costBasis : 0)
          );
          
          // Compute mathematically accurate PnL percentage against cost basis
          let pnlPercent = 0;
          if (costBasis > 0) {
            pnlPercent = Number((((marketValue - costBasis) / costBasis) * 100).toFixed(2));
          } else if (item.pnlPercent !== undefined && Math.abs(item.pnlPercent) <= 500) {
            pnlPercent = Number(item.pnlPercent);
          } else {
            pnlPercent = Number(changePct || 0);
          }

          return {
            symbol: cleanSymbol,
            displaySymbol,
            name,
            quantity,
            marketValue: Number(marketValue.toFixed(2)),
            costBasis: Number(costBasis.toFixed(2)),
            unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
            pnlPercent: Number(pnlPercent.toFixed(2)),
            price: Number(price.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePct: Number(changePct.toFixed(2)),
            sector: item.sector || "",
          };
        })
    );

    const totalMarketValue = normalized.reduce((acc, h) => acc + h.marketValue, 0);
    const totalCost = normalized.reduce((acc, h) => acc + h.costBasis, 0);
    const totalUnrealizedPnl = totalMarketValue - totalCost;
    const totalUnrealizedPnlPct = totalCost > 0 ? Number(((totalUnrealizedPnl / totalCost) * 100).toFixed(2)) : 0;

    const payloadToSave = {
      syncedAt: new Date().toISOString(),
      source: "pal.lk",
      totalMarketValue,
      totalCost,
      totalUnrealizedPnl,
      totalUnrealizedPnlPct,
      count: normalized.length,
      holdings: normalized,
    };

    await savePalHoldings(payloadToSave);

    return NextResponse.json(
      {
        success: true,
        message: `Synced ${normalized.length} CSE holdings from Pal.lk`,
        data: payloadToSave,
      },
      {
        headers: CORS_HEADERS,
      }
    );
  } catch (err: any) {
    console.error("Pal holdings sync error:", err);
    return NextResponse.json(
      { error: "Failed to process Pal.lk sync", details: err.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
