import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
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
    // Allow Excel files and common spreadsheet formats
    const allowedMimes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/octet-stream",
      "text/plain"
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xlsx, .xls) are allowed"));
    }
  },
});

router.get("/files/meta", async (req, res) => {
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

router.get("/files/history", async (req, res) => {
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

router.post("/files/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  const pool = getPool();
  const { changelog_notes, uploaded_by } = req.body;

  if (!pool) {
    return res.status(503).json({ error: "Database not available" });
  }

  try {
    const filePath = path.join(uploadDir, req.file.filename);
    const fileSize = req.file.size;
    
    const result = await pool.query(
      "INSERT INTO file_metadata (filename, file_path, file_size, uploaded_at, uploaded_by, changelog_notes) VALUES ($1, $2, $3, NOW(), $4, $5) RETURNING id, filename, uploaded_at",
      [req.file.originalname, filePath, fileSize, uploaded_by || "system", changelog_notes || ""]
    );

    res.json({
      success: true,
      file: result.rows[0],
      message: "File uploaded successfully",
    });
  } catch (err) {
    console.error("Error uploading file:", err);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(path.join(uploadDir, req.file.filename), () => {});
    }
    res.status(500).json({ error: "Failed to upload file" });
  }
});

export default router;
