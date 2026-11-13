import { neon } from "@neondatabase/serverless";
import { createClient } from "@vercel/kv";
import { MaturityRadarItem, SprintTask } from "../types";

const kvUrl = process.env.KV_REST_API_URL || "https://powerful-catfish-86904.upstash.io";
const kvToken = process.env.KV_REST_API_TOKEN || "gQAAAAAAAVN4AAIncDE5NDY0ZTE2MzVjYWU0ZjA4YTU3YmZmZjc1OWZmNmYwNnAxODY5MDQ";
const kv = createClient({ url: kvUrl, token: kvToken });

export type InstrumentDateOverride = {
  instrumentId: string;
  startDate?: string;
  maturityDate?: string;
  notes?: string;
};

// Global in-memory cache for overrides and bot state if no database is connected
const memoryOverrides = new Map<string, InstrumentDateOverride>();

let memoryBotCache: Record<string, unknown> | null = null;
let memoryPalHoldings: any = null;
let memorySolarTelemetry: any = null;
let memoryStockMinPrices: Record<string, number> = {};

function getSql() {
  const url = process.env.OPS_DATABASE_URL || process.env.INVESTOR_DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export async function ensureOpsSchema(): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ops_instrument_dates (
        instrument_id TEXT PRIMARY KEY,
        start_date TEXT,
        maturity_date TEXT,
        notes TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS ops_bot_cache (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS ops_pal_holdings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS ops_solar_telemetry (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS ops_decision_acks (
        signal_id TEXT PRIMARY KEY,
        horizon TEXT NOT NULL,
        ack_count INTEGER NOT NULL DEFAULT 1,
        ack_date TEXT,
        ack_month TEXT,
        ack_forever BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS ops_sprint_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        domain TEXT NOT NULL,
        status TEXT NOT NULL,
        deadline TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
  } catch (err) {
    console.warn("Ops schema initialization note:", err);
  }
}

export async function getInstrumentOverrides(): Promise<Map<string, InstrumentDateOverride>> {
  const sql = getSql();
  if (!sql) return memoryOverrides;

  try {
    await ensureOpsSchema();
    const rows = await sql`SELECT instrument_id, start_date, maturity_date, notes FROM ops_instrument_dates`;
    const map = new Map<string, InstrumentDateOverride>();
    for (const r of rows) {
      map.set(String(r.instrument_id), {
        instrumentId: String(r.instrument_id),
        startDate: r.start_date ? String(r.start_date) : undefined,
        maturityDate: r.maturity_date ? String(r.maturity_date) : undefined,
        notes: r.notes ? String(r.notes) : undefined,
      });
    }
    // Merge fallback entries if empty
    if (map.size === 0) {
      return memoryOverrides;
    }
    return map;
  } catch (err) {
    console.warn("Error reading instrument overrides, using fallback memory map:", err);
    return memoryOverrides;
  }
}

export async function saveInstrumentOverride(override: InstrumentDateOverride): Promise<void> {
  memoryOverrides.set(override.instrumentId, override);
  const sql = getSql();
  if (!sql) return;

  try {
    await ensureOpsSchema();
    await sql`
      INSERT INTO ops_instrument_dates (instrument_id, start_date, maturity_date, notes, updated_at)
      VALUES (${override.instrumentId}, ${override.startDate ?? null}, ${override.maturityDate ?? null}, ${override.notes ?? null}, NOW())
      ON CONFLICT (instrument_id) DO UPDATE SET
        start_date = EXCLUDED.start_date,
        maturity_date = EXCLUDED.maturity_date,
        notes = EXCLUDED.notes,
        updated_at = NOW();
    `;
  } catch (err) {
    console.warn("Error saving instrument override to database:", err);
  }
}

export async function getCachedBotState(): Promise<Record<string, unknown> | null> {
  const sql = getSql();
  if (!sql) return memoryBotCache;

  try {
    const rows = await sql`SELECT data FROM ops_bot_cache WHERE id = 1`;
    if (rows.length > 0) {
      return rows[0].data as Record<string, unknown>;
    }
    return memoryBotCache;
  } catch {
    return memoryBotCache;
  }
}

export async function setCachedBotState(data: Record<string, unknown>): Promise<void> {
  memoryBotCache = data;
  const sql = getSql();
  if (!sql) return;

  try {
    await ensureOpsSchema();
    await sql`
      INSERT INTO ops_bot_cache (id, data, updated_at)
      VALUES (1, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW();
    `;
  } catch (err) {
    console.warn("Error saving bot cache to database:", err);
  }
}

export async function getPalHoldings(): Promise<any | null> {
  // 1. Try Upstash KV first for persistent serverless storage
  try {
    const kvData = await kv.get<any>("ops_pal_holdings_v1");
    if (kvData && typeof kvData === "object") {
      memoryPalHoldings = kvData;
      return kvData;
    }
  } catch (kvErr) {
    // fallback
  }

  // 2. Try Postgres
  const sql = getSql();
  if (sql) {
    try {
      const rows = await sql`SELECT data FROM ops_pal_holdings WHERE id = 1`;
      if (rows.length > 0) {
        return rows[0].data;
      }
    } catch {}
  }

  return memoryPalHoldings;
}

export async function savePalHoldings(data: any): Promise<void> {
  memoryPalHoldings = data;

  // 1. Save to Upstash KV so PAL syncs persist across Vercel serverless invocations
  try {
    await kv.set("ops_pal_holdings_v1", data);
  } catch (kvErr) {
    console.warn("Error saving pal holdings to Upstash KV:", kvErr);
  }

  // 2. Save to Neon Postgres if configured
  const sql = getSql();
  if (!sql) return;

  try {
    await ensureOpsSchema();
    await sql`
      INSERT INTO ops_pal_holdings (id, data, updated_at)
      VALUES (1, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW();
    `;
  } catch (err) {
    console.warn("Error saving pal holdings to database:", err);
  }
}

const CSE_SELL_FEE_RATE = 0.0112; // 1.12% statutory CSE sell-side brokerage & fees (used by PAL.lk)

export async function refreshPalHoldingsFromCse(force = false): Promise<any | null> {
  const existing = await getPalHoldings();
  if (!existing || !Array.isArray(existing.holdings) || existing.holdings.length === 0) {
    return existing;
  }

  if (!force && existing.syncedAt) {
    const ageMs = Date.now() - new Date(existing.syncedAt).getTime();
    if (!Number.isNaN(ageMs) && ageMs < 15 * 60 * 1000) {
      return existing;
    }
  }

  try {
    let updatedCount = 0;
    const updatedHoldings = await Promise.all(
      existing.holdings.map(async (h: any) => {
        const cleanSymbol = String(h.symbol || "").trim().toUpperCase();
        if (!cleanSymbol) return h;

        let price = Number(h.price || 0);
        let change = Number(h.change || 0);
        let changePct = Number(h.changePct || 0);

        try {
          const res = await fetch("https://www.cse.lk/api/companyInfoSummery", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Referer": "https://www.cse.lk",
            },
            body: new URLSearchParams({ symbol: cleanSymbol }),
            signal: AbortSignal.timeout(6000),
            cache: "no-store",
          });

          if (res.ok) {
            const j = await res.json();
            const info = j?.reqSymbolInfo;
            if (info && info.lastTradedPrice !== undefined && info.lastTradedPrice !== null) {
              const livePrice = Number(info.lastTradedPrice);
              if (livePrice > 0) {
                price = livePrice;
                change = Number(info.change ?? change);
                changePct = Number(info.changePercentage ?? changePct);
                updatedCount++;
              }
            }
          }
        } catch (cseErr) {
          console.warn(`Live CSE quote fetch failed for ${cleanSymbol}:`, cseErr);
        }

        const quantity = Number(h.quantity || 0);
        const costBasis = Number(h.costBasis || 0);
        const grossMarketValue = quantity > 0 && price > 0 ? quantity * price : Number(h.marketValue || 0);
        // PAL.lk defines VALUE as net sales proceeds after 1.12% statutory CSE sell-side fees
        const marketValue = quantity > 0 && price > 0 ? Math.round(grossMarketValue * (1 - CSE_SELL_FEE_RATE)) : Number(h.marketValue || 0);
        const unrealizedPnl = costBasis > 0 ? Math.round(marketValue - costBasis) : Number(h.unrealizedPnl || 0);
        const pnlPercent = costBasis > 0 ? Number(((unrealizedPnl / costBasis) * 100).toFixed(1)) : Number(h.pnlPercent || 0);

        return {
          ...h,
          price: Number(price.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePct: Number(changePct.toFixed(2)),
          marketValue,
          unrealizedPnl,
          pnlPercent,
        };
      })
    );

    if (updatedCount === 0 && !force) {
      return existing;
    }

    const totalMarketValue = Math.round(updatedHoldings.reduce((acc, h) => acc + h.marketValue, 0));
    const totalCost = Math.round(updatedHoldings.reduce((acc, h) => acc + h.costBasis, 0));
    const totalUnrealizedPnl = Math.round(updatedHoldings.reduce((acc, h) => acc + h.unrealizedPnl, 0));
    const totalUnrealizedPnlPct = totalCost > 0 ? Number(((totalUnrealizedPnl / totalCost) * 100).toFixed(1)) : 0;

    const refreshedPayload = {
      ...existing,
      syncedAt: new Date().toISOString(),
      source: "pal.lk + cse.lk",
      totalMarketValue,
      totalCost,
      totalUnrealizedPnl,
      totalUnrealizedPnlPct,
      count: updatedHoldings.length,
      holdings: updatedHoldings,
    };

    await savePalHoldings(refreshedPayload);
    return refreshedPayload;
  } catch (err) {
    console.warn("Error refreshing PAL holdings from CSE:", err);
    return existing;
  }
}

export async function getSolarTelemetry(): Promise<any | null> {
  // 1. Try Upstash KV first for fastest zero-latency persistence
  try {
    const kvData = await kv.get<any>("ops_solar_telemetry_v1");
    if (kvData) return kvData;
  } catch (kvErr) {
    // fallback
  }

  // 2. Try Postgres
  const sql = getSql();
  if (sql) {
    try {
      const rows = await sql`SELECT data FROM ops_solar_telemetry WHERE id = 1`;
      if (rows.length > 0) {
        return rows[0].data;
      }
    } catch {}
  }

  return memorySolarTelemetry;
}

export async function saveSolarTelemetry(data: any): Promise<void> {
  memorySolarTelemetry = data;

  // 1. Save to Upstash KV
  try {
    await kv.set("ops_solar_telemetry_v1", data);
  } catch (kvErr) {
    console.warn("Error saving solar telemetry to Upstash KV:", kvErr);
  }

  // 2. Save to Neon Postgres
  const sql = getSql();
  if (!sql) return;

  try {
    await ensureOpsSchema();
    await sql`
      INSERT INTO ops_solar_telemetry (id, data, updated_at)
      VALUES (1, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW();
    `;
  } catch (err) {
    console.warn("Error saving solar telemetry to database:", err);
  }
}

export const DEFAULT_FUSIONSOLAR_KIOSK_TOKEN = process.env.FUSIONSOLAR_KIOSK_TOKEN || "82GoF4jAoeF3Objka4hJAC2yP9FHu4jt";

/**
 * Direct unauthenticated REST API client for Huawei FusionSolar Kiosk
 * Queries intl.fusionsolar.huawei.com/rest/pvms/web/kiosk/v1/station-kiosk-file
 */
export async function fetchFusionSolarKioskData(token = DEFAULT_FUSIONSOLAR_KIOSK_TOKEN): Promise<any | null> {
  if (!token) return null;
  try {
    const url = `https://intl.fusionsolar.huawei.com/rest/pvms/web/kiosk/v1/station-kiosk-file?kk=${token}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": `https://intl.fusionsolar.huawei.com/pvmswebsite/nologin/assets/build/cloud.html`,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`FusionSolar Kiosk HTTP ${res.status} ${res.statusText}`);
      return null;
    }
    const json = await res.json();
    if (!json?.data) {
      console.warn("FusionSolar Kiosk empty/error payload:", json?.failCode, json?.message);
      return null;
    }

    // Huawei wraps HTML-escaped JSON inside data field
    const unescaped = json.data
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    const parsed = JSON.parse(unescaped);
    const kpi = parsed.realKpi || {};
    const overview = parsed.stationOverview || {};

    const currentKw = Number(kpi.realTimePower ?? 0);
    const dailyKwh = Number(kpi.dailyEnergy ?? 0);
    const monthlyKwh = Number(kpi.monthEnergy ?? 0);
    const yearlyMwh = Number(((Number(kpi.yearEnergy) || 0) / 1000).toFixed(2));
    const lifetimeMwh = Number(((Number(kpi.cumulativeEnergy) || 0) / 1000).toFixed(2));

    const solarPayload = {
      currentKw,
      dailyKwh,
      monthlyKwh: monthlyKwh > 0 ? monthlyKwh : undefined,
      yearlyMwh: yearlyMwh > 0 ? yearlyMwh : 3.85,
      lifetimeMwh: lifetimeMwh > 0 ? lifetimeMwh : 4.65,
      netGridKw: Number((currentKw * 0.76).toFixed(2)),
      dailyTargetKwh: 15.0,
      gridExportStatus: (currentKw > 0.05 ? "EXPORTING" : "NEUTRAL") as "EXPORTING" | "NEUTRAL",
      stationCode: overview.stationDn || "NE=58772902",
      stationName: overview.stationName || "Mr. Janitha Ambathenna",
      syncedFrom: "FusionSolar Kiosk API",
      lastSynced: new Date().toISOString(),
    };

    // Persist to database/KV cache asynchronously
    saveSolarTelemetry(solarPayload).catch(() => {});

    return solarPayload;
  } catch (err) {
    console.warn("FusionSolar Kiosk fetch error:", err);
    return null;
  }
}

export async function getStockMinPrices(): Promise<Record<string, number>> {
  try {
    const kvData = await kv.get<Record<string, number>>("ops_stock_min_prices_v1");
    if (kvData && typeof kvData === "object") return kvData;
  } catch (kvErr) {
    // fallback
  }

  const sql = getSql();
  if (sql) {
    try {
      const rows = await sql`SELECT data FROM ops_bot_cache WHERE id = 2`;
      if (rows.length > 0 && rows[0].data) {
        return rows[0].data as Record<string, number>;
      }
    } catch {}
  }

  return memoryStockMinPrices;
}

export async function saveStockMinPrices(prices: Record<string, number>): Promise<void> {
  memoryStockMinPrices = prices;

  try {
    await kv.set("ops_stock_min_prices_v1", prices);
  } catch (kvErr) {
    console.warn("Error saving stock min prices to Upstash KV:", kvErr);
  }

  const sql = getSql();
  if (!sql) return;
  try {
    await ensureOpsSchema();
    await sql`
      INSERT INTO ops_bot_cache (id, data, updated_at)
      VALUES (2, ${JSON.stringify(prices)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW();
    `;
  } catch (err) {
    console.warn("Error saving stock min prices to Postgres:", err);
  }
}

// ── Decision Acknowledgements (Daily / Monthly / Forever) ──────────────────────

export type DecisionAckRecord = {
  signalId: string;
  horizon: "live" | "daily" | "monthly";
  ackCount: number;
  ackDate: string | null;
  ackMonth: string | null;
  ackForever: boolean;
  isCurrentlySuppressed: boolean;
  canAckForever: boolean;
};

function getSltTodayAndMonth() {
  const slt = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const currentMonth = `${slt.getUTCFullYear()}-${String(slt.getUTCMonth() + 1).padStart(2, "0")}`;
  const todayIso = `${currentMonth}-${String(slt.getUTCDate()).padStart(2, "0")}`;
  return { todayIso, currentMonth };
}

const memoryDecisionAcks = new Map<string, Omit<DecisionAckRecord, "isCurrentlySuppressed" | "canAckForever">>();

function enrichAckRecord(
  rec: Omit<DecisionAckRecord, "isCurrentlySuppressed" | "canAckForever">,
  todayIso: string,
  currentMonth: string
): DecisionAckRecord {
  const isSuppressed =
    rec.horizon === "daily"
      ? rec.ackForever || rec.ackDate === todayIso
      : rec.horizon === "monthly"
      ? rec.ackMonth === currentMonth
      : rec.ackDate === todayIso;

  const canAckForever = rec.horizon === "daily" && rec.ackCount >= 3;

  return {
    ...rec,
    isCurrentlySuppressed: isSuppressed,
    canAckForever,
  };
}

export async function getDecisionAckRecords(): Promise<DecisionAckRecord[]> {
  const { todayIso, currentMonth } = getSltTodayAndMonth();
  const sql = getSql();

  if (sql) {
    try {
      await ensureOpsSchema();
      const rows = await sql`
        SELECT signal_id, horizon, ack_count, ack_date, ack_month, ack_forever
        FROM ops_decision_acks
      `;
      return rows.map((r) =>
        enrichAckRecord(
          {
            signalId: String(r.signal_id),
            horizon: (String(r.horizon) as "live" | "daily" | "monthly") || "daily",
            ackCount: Number(r.ack_count || 0),
            ackDate: r.ack_date ? String(r.ack_date) : null,
            ackMonth: r.ack_month ? String(r.ack_month) : null,
            ackForever: Boolean(r.ack_forever) && String(r.horizon) === "daily",
          },
          todayIso,
          currentMonth
        )
      );
    } catch (err) {
      console.warn("Error reading decision acks from Postgres:", err);
    }
  }

  try {
    const kvList = await kv.get<Array<Omit<DecisionAckRecord, "isCurrentlySuppressed" | "canAckForever">>>("ops_decision_acks_v1");
    if (Array.isArray(kvList)) {
      return kvList.map((r) => enrichAckRecord(r, todayIso, currentMonth));
    }
  } catch {}

  return Array.from(memoryDecisionAcks.values()).map((r) => enrichAckRecord(r, todayIso, currentMonth));
}

export async function acknowledgeDecision(
  signalId: string,
  horizon: "live" | "daily" | "monthly",
  mode: "period" | "forever" = "period"
): Promise<DecisionAckRecord[]> {
  const { todayIso, currentMonth } = getSltTodayAndMonth();
  const existingList = await getDecisionAckRecords();
  const existing = existingList.find((r) => r.signalId === signalId);

  const nextCount = (existing?.ackCount ?? 0) + 1;
  const allowForever = horizon === "daily" && mode === "forever" && (existing?.ackCount ?? 0) >= 3;

  const nextRec: Omit<DecisionAckRecord, "isCurrentlySuppressed" | "canAckForever"> = {
    signalId,
    horizon,
    ackCount: allowForever ? existing?.ackCount ?? nextCount : nextCount,
    ackDate: horizon === "monthly" ? null : todayIso,
    ackMonth: horizon === "monthly" ? currentMonth : null,
    ackForever: allowForever,
  };

  memoryDecisionAcks.set(signalId, nextRec);

  const sql = getSql();
  if (sql) {
    try {
      await ensureOpsSchema();
      await sql`
        INSERT INTO ops_decision_acks (signal_id, horizon, ack_count, ack_date, ack_month, ack_forever, updated_at)
        VALUES (${nextRec.signalId}, ${nextRec.horizon}, ${nextRec.ackCount}, ${nextRec.ackDate}, ${nextRec.ackMonth}, ${nextRec.ackForever}, NOW())
        ON CONFLICT (signal_id) DO UPDATE SET
          horizon = EXCLUDED.horizon,
          ack_count = EXCLUDED.ack_count,
          ack_date = EXCLUDED.ack_date,
          ack_month = EXCLUDED.ack_month,
          ack_forever = EXCLUDED.ack_forever,
          updated_at = NOW();
      `;
    } catch (err) {
      console.warn("Error saving decision ack to Postgres:", err);
    }
  }

  try {
    const merged = existingList.filter((r) => r.signalId !== signalId).map(({ isCurrentlySuppressed: _s, canAckForever: _c, ...rest }) => rest);
    merged.push(nextRec);
    await kv.set("ops_decision_acks_v1", merged);
  } catch {}

  return getDecisionAckRecords();
}

export async function resetActiveDecisionAcks(): Promise<DecisionAckRecord[]> {
  for (const [k, v] of memoryDecisionAcks.entries()) {
    memoryDecisionAcks.set(k, { ...v, ackDate: null, ackMonth: null, ackForever: false });
  }

  const sql = getSql();
  if (sql) {
    try {
      await ensureOpsSchema();
      await sql`
        UPDATE ops_decision_acks
        SET ack_date = NULL, ack_month = NULL, ack_forever = FALSE, updated_at = NOW()
      `;
    } catch (err) {
      console.warn("Error resetting decision acks in Postgres:", err);
    }
  }

  try {
    const kvList = await kv.get<Array<Omit<DecisionAckRecord, "isCurrentlySuppressed" | "canAckForever">>>("ops_decision_acks_v1");
    if (Array.isArray(kvList)) {
      await kv.set(
        "ops_decision_acks_v1",
        kvList.map((r) => ({ ...r, ackDate: null, ackMonth: null, ackForever: false }))
      );
    }
  } catch {}

  return getDecisionAckRecords();
}

// ── Daily Critical Path Sprint Tasks ─────────────────────────────────────────

let memorySprintTasks: SprintTask[] | null = null;

export async function getSavedSprintTasks(): Promise<SprintTask[] | null> {
  const sql = getSql();
  if (sql) {
    try {
      await ensureOpsSchema();
      const rows = await sql`
        SELECT id, title, domain, status, deadline
        FROM ops_sprint_tasks
        ORDER BY sort_order ASC, updated_at DESC
      `;
      if (rows.length > 0) {
        return rows.map((r) => ({
          id: String(r.id),
          title: String(r.title),
          domain: (String(r.domain) as SprintTask["domain"]) || "OPS",
          status: (String(r.status) as SprintTask["status"]) || "active",
          deadline: r.deadline ? String(r.deadline) : undefined,
        }));
      }
    } catch (err) {
      console.warn("Error reading sprint tasks from Postgres:", err);
    }
  }

  try {
    const kvTasks = await kv.get<SprintTask[]>("ops_sprint_tasks_v1");
    if (Array.isArray(kvTasks) && kvTasks.length > 0) {
      return kvTasks;
    }
  } catch {}

  return memorySprintTasks;
}

export async function saveSprintTasks(tasks: SprintTask[]): Promise<void> {
  memorySprintTasks = tasks;

  try {
    await kv.set("ops_sprint_tasks_v1", tasks);
  } catch {}

  const sql = getSql();
  if (!sql) return;

  try {
    await ensureOpsSchema();
    await sql`DELETE FROM ops_sprint_tasks`;
    for (let idx = 0; idx < tasks.length; idx++) {
      const t = tasks[idx];
      await sql`
        INSERT INTO ops_sprint_tasks (id, title, domain, status, deadline, sort_order, updated_at)
        VALUES (${t.id}, ${t.title}, ${t.domain}, ${t.status}, ${t.deadline ?? null}, ${idx}, NOW())
      `;
    }
  } catch (err) {
    console.warn("Error saving sprint tasks to Postgres:", err);
  }
}
