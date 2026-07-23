import { getPool } from "../db/init.js";
import type { SourcePnlRow } from "../types/index.js";
import xlsx from "xlsx";
import path from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedAllRows: SourcePnlRow[] | null = null;

const num = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\./g, "").replace(",", "."));
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const parseExcelFile = (filePath: string): SourcePnlRow[] => {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const raw = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    return raw.map((r) => ({
      period: String(r["Año - mes"] || "").trim(),
      quarter: String(r["Trimestre"] || "").trim(),
      account: String(r["Cuenta"] || "").trim(),
      costCenter: String(r["Dimensión valor"] || "").trim(),
      ccLevel1: String(r["Nivel 1 dimensión"] || "").trim(),
      ccLevel2: String(r["Nivel 2 dimensión"] || "").trim(),
      level2: String(r["Nivel 2 cuenta"] || "").trim(),
      level3: String(r["Nivel 3 cuenta"] || "").trim(),
      amount: num(r["Importe pcipal"]),
    }));
  } catch (err) {
    console.error(`Error parsing Excel file: ${err}`);
    return [];
  }
};

/**
 * Load all PNL rows from database or fallback to Excel.
 * In production: uses pnl_data table
 * In development: falls back to Excel files if database unavailable
 */
export const loadAllSourceRows = async (): Promise<SourcePnlRow[]> => {
  const pool = getPool();
  
  if (pool) {
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
      console.error("Error loading from database:", err);
    }
  }

  // Fallback to Excel files (development without DATABASE_URL)
  console.warn("⚠️  Database unavailable, loading from Excel files...");
  const projectRoot = path.resolve(__dirname, "../../../..");
  const pnlPath2025 = path.join(projectRoot, "Perdidas y ganancias.xlsx");
  const pnlPath2026 = path.join(projectRoot, "PyG_2026_06.xlsx");

  const rows2025 = parseExcelFile(pnlPath2025);
  let rows2026: SourcePnlRow[] = [];
  try {
    rows2026 = parseExcelFile(pnlPath2026);
  } catch {
    // 2026 file not found, that's OK
  }

  cachedAllRows = [...rows2025, ...rows2026];
  console.log(`✅ Loaded ${cachedAllRows.length} rows from Excel files`);
  return cachedAllRows;
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
