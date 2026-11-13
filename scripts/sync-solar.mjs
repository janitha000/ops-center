#!/usr/bin/env node

const KIOSK_TOKEN = process.env.FUSIONSOLAR_KIOSK_TOKEN || "82GoF4jAoeF3Objka4hJAC2yP9FHu4jt";
const TARGET_URL = process.env.OPS_SOLAR_SYNC_URL || "https://ops-center-psi.vercel.app/api/ops/solar/sync";
const STOCKS_SYNC_URL = process.env.OPS_STOCKS_SYNC_URL || "https://ops-center-psi.vercel.app/api/ops/stocks/sync";
const CSE_SELL_FEE_RATE = 0.0112; // 1.12% CSE statutory sell-side brokerage & fees (matches PAL.lk)

async function syncSolar() {
  const kioskUrl = `https://intl.fusionsolar.huawei.com/rest/pvms/web/kiosk/v1/station-kiosk-file?kk=${KIOSK_TOKEN}`;
  const res = await fetch(kioskUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://intl.fusionsolar.huawei.com/pvmswebsite/nologin/assets/build/cloud.html",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`FusionSolar HTTP ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (!json?.data) {
    throw new Error(`FusionSolar empty payload (failCode=${json?.failCode})`);
  }

  const unescaped = json.data
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  const parsed = JSON.parse(unescaped);
  const kpi = parsed.realKpi || {};
  const overview = parsed.stationOverview || {};

  const currentKw = Number(kpi.realTimePower ?? 0);
  const dailyKwh = Number(kpi.dailyEnergy ?? 0);
  const monthlyKwh = Number(kpi.monthEnergy ?? 0);
  const yearlyMwh = Number(((Number(kpi.yearEnergy) || 0) / 1000).toFixed(2));
  const lifetimeMwh = Number(((Number(kpi.cumulativeEnergy) || 0) / 1000).toFixed(2));

  const payload = {
    currentKw: Number(currentKw.toFixed(2)),
    dailyKwh: Number(dailyKwh.toFixed(2)),
    monthlyKwh: monthlyKwh > 0 ? Number(monthlyKwh.toFixed(1)) : undefined,
    yearlyMwh: yearlyMwh > 0 ? yearlyMwh : 3.85,
    lifetimeMwh: lifetimeMwh > 0 ? lifetimeMwh : 4.65,
    netGridKw: Number((currentKw * 0.76).toFixed(2)),
    dailyTargetKwh: 15.0,
    gridExportStatus: currentKw > 0.05 ? "EXPORTING" : "NEUTRAL",
    stationCode: overview.stationDn || "NE=58772902",
  };

  const postRes = await fetch(TARGET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    throw new Error(`Ops solar sync POST failed (${postRes.status}): ${errText}`);
  }

  const result = await postRes.json();
  console.log(`[${new Date().toISOString()}] [Solar] ${result.message || "Synced"}`);
}

async function syncStocks() {
  // 1. Trigger server-side CSE quote refresh first
  const refreshRes = await fetch(STOCKS_SYNC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "refresh_cse" }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);

  if (refreshRes && refreshRes.ok) {
    const refreshJson = await refreshRes.json().catch(() => null);
    if (refreshJson?.success && refreshJson?.data?.holdings?.length > 0) {
      console.log(`[${new Date().toISOString()}] [CSE Stocks] ${refreshJson.message}`);
      return;
    }
  }

  // 2. Fallback: fetch stored holdings via GET, enrich locally from CSE API, and POST back
  const getRes = await fetch(STOCKS_SYNC_URL, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!getRes.ok) {
    throw new Error(`GET ${STOCKS_SYNC_URL} failed (${getRes.status})`);
  }
  const getJson = await getRes.json();
  const holdings = getJson?.data?.holdings || [];
  if (!Array.isArray(holdings) || holdings.length === 0) {
    console.log(`[${new Date().toISOString()}] [CSE Stocks] No holdings in store to refresh.`);
    return;
  }

  const updated = await Promise.all(
    holdings.map(async (h) => {
      const symbol = String(h.symbol || "").trim().toUpperCase();
      let price = Number(h.price || 0);
      let change = Number(h.change || 0);
      let changePct = Number(h.changePct || 0);

      try {
        const cseRes = await fetch("https://www.cse.lk/api/companyInfoSummery", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.cse.lk",
          },
          body: new URLSearchParams({ symbol }),
          signal: AbortSignal.timeout(6000),
        });
        if (cseRes.ok) {
          const j = await cseRes.json();
          const info = j?.reqSymbolInfo;
          if (info && Number(info.lastTradedPrice) > 0) {
            price = Number(info.lastTradedPrice);
            change = Number(info.change ?? change);
            changePct = Number(info.changePercentage ?? changePct);
          }
        }
      } catch {}

      const quantity = Number(h.quantity || 0);
      const costBasis = Number(h.costBasis || 0);
      const marketValue = Number((quantity * price).toFixed(2));
      const unrealizedGain = Number((marketValue * (1 - CSE_SELL_FEE_RATE) - costBasis).toFixed(2));
      const pnlPercent = costBasis > 0 ? Number(((unrealizedGain / costBasis) * 100).toFixed(2)) : 0;

      return {
        ...h,
        price,
        change,
        changePercentage: changePct,
        marketValue,
        unrealizedGain,
        pnlPercent,
      };
    })
  );

  const postRes = await fetch(STOCKS_SYNC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holdings: updated }),
    signal: AbortSignal.timeout(10000),
  });

  if (!postRes.ok) {
    throw new Error(`POST ${STOCKS_SYNC_URL} failed (${postRes.status})`);
  }
  const postJson = await postRes.json();
  console.log(`[${new Date().toISOString()}] [CSE Stocks] ${postJson.message || "Synced"}`);
}

async function run() {
  const results = await Promise.allSettled([syncSolar(), syncStocks()]);
  const failures = results.filter((r) => r.status === "rejected");
  failures.forEach((f) => console.error(`[${new Date().toISOString()}] Sync warning:`, f.reason?.message || f.reason));
  if (failures.length === results.length) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(`[${new Date().toISOString()}] Scheduler sync error:`, err.message);
  process.exit(1);
});
