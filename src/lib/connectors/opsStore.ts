import { neon } from "@neondatabase/serverless";
import { createClient } from "@vercel/kv";
import { MaturityRadarItem } from "../types";

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
const memoryOverrides = new Map<string, InstrumentDateOverride>([
  ["fd-combank-1", { instrumentId: "fd-combank-1", startDate: "2026-05-15", maturityDate: "2026-11-15" }],
  ["tbill-1", { instrumentId: "tbill-1", startDate: "2026-02-10", maturityDate: "2026-11-28" }],
  ["pfca-1", { instrumentId: "pfca-1", startDate: "2026-03-01", maturityDate: "2027-03-01" }],
]);

let memoryBotCache: Record<string, unknown> | null = null;
let memoryPalHoldings: any = null;
let memorySolarTelemetry: any = null;

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
  const sql = getSql();
  if (!sql) return memoryPalHoldings;

  try {
    const rows = await sql`SELECT data FROM ops_pal_holdings WHERE id = 1`;
    if (rows.length > 0) {
      return rows[0].data;
    }
    return memoryPalHoldings;
  } catch {
    return memoryPalHoldings;
  }
}

export async function savePalHoldings(data: any): Promise<void> {
  memoryPalHoldings = data;
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
