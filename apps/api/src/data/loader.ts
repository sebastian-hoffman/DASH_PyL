import xlsx from "xlsx";
import { pnlExcelPath, pyg2026ExcelPath } from "../config/index.js";
import type { SourcePnlRow } from "../types/index.js";

let cachedAllRows: SourcePnlRow[] | null = null;

const num = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\./g, "").replace(",", "."));
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const parseFile = (filePath: string): SourcePnlRow[] => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return raw.map((r) => ({
    period:     String(r["Año - mes"]          || "").trim(),
    quarter:    String(r["Trimestre"]           || "").trim(),
    account:    String(r["Cuenta"]              || "").trim(),
    costCenter: String(r["Dimensión valor"]     || "").trim(),
    ccLevel1:   String(r["Nivel 1 dimensión"]   || "").trim(),
    ccLevel2:   String(r["Nivel 2 dimensión"]   || "").trim(),
    level2:     String(r["Nivel 2 cuenta"]      || "").trim(),
    level3:     String(r["Nivel 3 cuenta"]      || "").trim(),
    amount:     num(r["Importe pcipal"]),
  }));
};

/** Todos los años combinados. */
export const loadAllSourceRows = (): SourcePnlRow[] => {
  if (cachedAllRows) return cachedAllRows;
  const rows2025 = parseFile(pnlExcelPath);
  let rows2026: SourcePnlRow[] = [];
  try { rows2026 = parseFile(pyg2026ExcelPath); } catch { /* archivo no encontrado */ }
  cachedAllRows = [...rows2025, ...rows2026];
  return cachedAllRows;
};

/** Filas filtradas por año (p.ej. "2025" o "2026"). */
export const loadSourceRowsByYear = (year: string): SourcePnlRow[] =>
  loadAllSourceRows().filter((r) => r.period.startsWith(`${year}-`));

/** Backward-compat: devuelve solo 2025 (comportamiento original). */
export const loadSourceRows = (): SourcePnlRow[] => loadSourceRowsByYear("2025");
