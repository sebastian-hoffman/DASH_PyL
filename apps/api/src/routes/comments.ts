import { Router, Request, Response } from "express";
import { getPool } from "../db/init.js";

const router = Router();

// GET comments for a file
router.get("/comments", async (req: Request, res: Response) => {
  const { fileId } = req.query;

  if (!fileId) {
    return res.status(400).json({ error: "fileId parameter required" });
  }

  const pool = getPool();
  if (!pool) {
    return res.json({ comments: [] });
  }

  try {
    const result = await pool.query(
      `SELECT id, file_id, author, content, created_at, updated_at 
       FROM comments 
       WHERE file_id = $1 
       ORDER BY created_at DESC`,
      [fileId]
    );

    res.json({ comments: result.rows });
  } catch (err) {
    console.error("Error fetching comments:", err);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST create comment on a file
router.post("/comments", async (req: Request, res: Response) => {
  const { fileId, author, content } = req.body;

  if (!fileId || !content) {
    return res.status(400).json({ error: "fileId and content are required" });
  }

  const pool = getPool();
  if (!pool) {
    return res.status(503).json({ error: "Database not available" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO comments (file_id, author, content)
       VALUES ($1, $2, $3)
       RETURNING id, file_id, author, content, created_at`,
      [fileId, author || "anonymous", content]
    );

    res.status(201).json({
      success: true,
      comment: result.rows[0],
    });
  } catch (err) {
    console.error("Error creating comment:", err);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// DELETE comment
router.delete("/comments/:commentId", async (req: Request, res: Response) => {
  const { commentId } = req.params;

  const pool = getPool();
  if (!pool) {
    return res.status(503).json({ error: "Database not available" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM comments WHERE id = $1 RETURNING id",
      [commentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    res.json({ success: true, message: "Comment deleted" });
  } catch (err) {
    console.error("Error deleting comment:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

export default router;
