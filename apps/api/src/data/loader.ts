import { getPool } from "../db/init.js";
import type { SourcePnlRow } from "../types/index.js";

let cachedAllRows: SourcePnlRow[] | null = null;

/**
 * Load all PNL rows from database.
 * Falls back to empty array if database unavailable.
 */
export const loadAllSourceRows = async (): Promise<SourcePnlRow[]> => {
  const pool = getPool();
  if (!pool) {
    console.warn("⚠️  Database unavailable, returning empty PNL data");
    return [];
  }

  try {
    const result = await pool.query(`
      SELECT 
        period,
        quarter,
        account,
        cost_center as "costCenter",
        cc_level1 as "ccLevel1",
        cc_level2 as "ccLevel2",
        level2,
        level3,
        amount
      FROM pnl_data
      ORDER BY period, account, cost_center
    `);

    cachedAllRows = result.rows as SourcePnlRow[];
    return cachedAllRows;
  } catch (err) {
    console.error("Error loading PNL data from database:", err);
    return [];
  }
};

/**
 * Load all rows from cache (synchronous, for backward compatibility).
 * Warning: Returns cached data, may be stale.
 * Use loadAllSourceRows() for fresh data.
 */
export const loadAllSourceRowsSync = (): SourcePnlRow[] => {
  return cachedAllRows || [];
};

/** Rows filtered by year (e.g. "2025" or "2026"). */
export const loadSourceRowsByYear = (year: string): SourcePnlRow[] =>
  loadAllSourceRowsSync().filter((r) => r.period.startsWith(`${year}-`));

/** Backward-compat: returns 2025 only (original behavior). */
export const loadSourceRows = (): SourcePnlRow[] => loadSourceRowsByYear("2025");
