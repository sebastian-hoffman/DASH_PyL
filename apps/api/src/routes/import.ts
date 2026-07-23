import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import xlsx from "xlsx";
import { getPool } from "../db/init.js";

const router = Router();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.originalname}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/octet-stream",
      "text/plain",
    ];
    if (
      allowedMimes.includes(file.mimetype) ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xlsx, .xls) are allowed"));
    }
  },
});

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
};

router.post("/import", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  const pool = getPool();
  if (!pool) {
    return res.status(503).json({ error: "Database not available" });
  }

  const client = await pool.connect();

  try {
    // 1. Parse new file
    const newRows = parseExcelFile(req.file.path);

    if (newRows.length === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "No valid data found in file" });
    }

    // Extract unique periods from new data
    const newPeriods = [...new Set(newRows.map((r) => r.period))].sort();

    // 2. Get state BEFORE import
    const beforeResult = await client.query(
      `SELECT COUNT(*) as count, array_agg(DISTINCT period ORDER BY period) as periods
       FROM pnl_data`
    );
    const rowsBefore = parseInt(beforeResult.rows[0].count || "0");
    const periodsBefore = beforeResult.rows[0].periods || [];

    // 3. Start transaction
    await client.query("BEGIN");

    try {
      // 3a. Delete all current data
      await client.query("DELETE FROM pnl_data");

      // 3b. Insert all new data
      for (const row of newRows) {
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
      }

      // 3c. Calculate differences
      const periodsDiff = {
        added: newPeriods.filter((p: string) => !periodsBefore.includes(p)),
        updated: newPeriods.filter((p: string) => periodsBefore.includes(p)),
        removed: periodsBefore.filter((p: string) => !newPeriods.includes(p)),
      };

      // 3d. Build summary
      const summary = {
        anterior: {
          total_filas: rowsBefore,
          periodos: periodsBefore,
        },
        nuevo: {
          total_filas: newRows.length,
          periodos: newPeriods,
        },
        cambios: {
          filas_nuevas: newRows.length - rowsBefore,
          periodos_agregados: periodsDiff.added,
          periodos_actualizados: periodsDiff.updated,
          periodos_removidos: periodsDiff.removed,
        },
      };

      // 3e. Save metadata
      const fileResult = await client.query(
        `INSERT INTO file_metadata 
         (filename, file_path, file_size, uploaded_at, uploaded_by, changelog_notes, rows_previous, rows_imported, periods_affected, summary)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          req.file.originalname,
          req.file.path,
          req.file.size,
          req.body.uploaded_by || "web-ui",
          req.body.changelog_notes || "",
          newPeriods,
          rowsBefore,
          newRows.length,
          JSON.stringify(summary),
        ]
      );

      await client.query("COMMIT");

      res.json({
        success: true,
        summary,
        fileId: fileResult.rows[0].id,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("Import error:", err);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({
      error: err instanceof Error ? err.message : "Import failed",
    });
  } finally {
    client.release();
  }
});

// GET import history
router.get("/import-history", async (req: Request, res: Response) => {
  const pool = getPool();
  if (!pool) {
    return res.json([]);
  }

  try {
    const result = await pool.query(
      `SELECT id, filename, uploaded_at, uploaded_by, rows_previous, rows_imported, summary
       FROM file_metadata
       ORDER BY uploaded_at DESC
       LIMIT 20`
    );

    const history = result.rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      uploaded_at: row.uploaded_at,
      uploaded_by: row.uploaded_by,
      summary: typeof row.summary === "string" ? JSON.parse(row.summary) : row.summary,
    }));

    res.json(history);
  } catch (err) {
    console.error("Error fetching import history:", err);
    res.status(500).json({ error: "Failed to fetch import history" });
  }
});

export default router;
