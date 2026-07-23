import xlsx from "xlsx";
import path from "path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SourcePnlRow {
  period: string;
  quarter: string;
  account: string;
  costCenter: string;
  ccLevel1: string;
  ccLevel2: string;
  level2: string;
  level3: string;
  amount: number;
}

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
    console.error(`Error parsing ${filePath}:`, err);
    return [];
  }
};

const seedPnlData = async () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    console.log("🌱 Seeding PNL data...");

    // 1. Parse all Excel files
    const projectRoot = path.resolve(__dirname, "../../../..");
    const pnlPath2025 = path.join(projectRoot, "Perdidas y ganancias.xlsx");
    const pnlPath2026 = path.join(projectRoot, "PyG_2026_06.xlsx");

    console.log("📖 Parsing 2025 data...");
    let rows2025 = parseExcelFile(pnlPath2025);
    console.log(`   Found ${rows2025.length} rows for 2025`);

    console.log("📖 Parsing 2026 data...");
    let rows2026 = parseExcelFile(pnlPath2026);
    console.log(`   Found ${rows2026.length} rows for 2026`);

    const allRows = [...rows2025, ...rows2026];

    if (allRows.length === 0) {
      console.error("❌ No data found in Excel files");
      process.exit(1);
    }

    // 2. Start transaction
    await client.query("BEGIN");

    try {
      // Check if data already exists
      const existing = await client.query("SELECT COUNT(*) as count FROM pnl_data");
      const existingCount = parseInt(existing.rows[0].count || "0");

      if (existingCount > 0) {
        console.log(`⚠️  Found ${existingCount} existing rows. Clearing...`);
        await client.query("DELETE FROM pnl_data");
      }

      // 3. Insert all data
      console.log(`💾 Inserting ${allRows.length} rows...`);
      let inserted = 0;
      let skipped = 0;

      for (const row of allRows) {
        try {
          await client.query(
            `INSERT INTO pnl_data 
             (period, quarter, account, cost_center, cc_level1, cc_level2, level2, level3, amount)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT DO NOTHING`,
            [
              row.period,
              row.quarter,
              row.account,
              row.costCenter,
              row.ccLevel1,
              row.ccLevel2,
              row.level2,
              row.level3,
              row.amount,
            ]
          );
          inserted++;
        } catch (err) {
          skipped++;
          if (skipped <= 5) {
            console.error(`   Row error: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // 4. Save initial file metadata
      const periods = [...new Set(allRows.map((r) => r.period))].sort();
      const summary = {
        anterior: { total_filas: 0, periodos: [] },
        nuevo: { total_filas: inserted, periodos },
        cambios: {
          filas_nuevas: inserted,
          periodos_agregados: periods,
          periodos_actualizados: [],
          periodos_removidos: [],
        },
      };

      await client.query(
        `INSERT INTO file_metadata 
         (filename, uploaded_by, changelog_notes, rows_previous, rows_imported, periods_affected, summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          "initial-seed.xlsx",
          "system",
          "Initial data load from Excel files",
          0,
          inserted,
          periods,
          JSON.stringify(summary),
        ]
      );

      await client.query("COMMIT");

      console.log(`✅ Seed completed:`);
      console.log(`   - Inserted: ${inserted} rows`);
      console.log(`   - Skipped: ${skipped} rows`);
      console.log(`   - Periods: ${periods.join(", ")}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

seedPnlData();
