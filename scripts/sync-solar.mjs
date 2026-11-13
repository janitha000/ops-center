#!/usr/bin/env node

const KIOSK_TOKEN = process.env.FUSIONSOLAR_KIOSK_TOKEN || "82GoF4jAoeF3Objka4hJAC2yP9FHu4jt";
const TARGET_URL = process.env.OPS_SOLAR_SYNC_URL || "https://ops-center-psi.vercel.app/api/ops/solar/sync";

async function run() {
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
    throw new Error(`Ops sync POST failed (${postRes.status}): ${errText}`);
  }

  const result = await postRes.json();
  console.log(`[${new Date().toISOString()}] ${result.message || "Synced"}`);
}

run().catch((err) => {
  console.error(`[${new Date().toISOString()}] Solar sync error:`, err.message);
  process.exit(1);
});
