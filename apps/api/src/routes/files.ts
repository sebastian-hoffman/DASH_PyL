import { Router } from "express";
import { getPool } from "../db/init.js";

const router = Router();

router.get("/file-meta", async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.json({
      filename: "PyG_2026_06.xlsx",
      uploaded_at: new Date().toISOString(),
      changelog_notes: "Archivo por defecto (BD no disponible)",
    });
  }

  try {
    const result = await pool.query(
      "SELECT id, filename, file_path, uploaded_at, changelog_notes, uploaded_by FROM file_metadata ORDER BY uploaded_at DESC LIMIT 1"
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No file metadata found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching file metadata:", err);
    res.status(500).json({ error: "Failed to fetch file metadata" });
  }
});

router.get("/files-history", async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.json([]);
  }

  try {
    const result = await pool.query(
      "SELECT id, filename, uploaded_at, changelog_notes, uploaded_by FROM file_metadata ORDER BY uploaded_at DESC LIMIT 10"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching file history:", err);
    res.status(500).json({ error: "Failed to fetch file history" });
  }
});

export default router;
