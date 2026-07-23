import { Pool } from "pg";

export const runMigrations = async (pool: Pool): Promise<void> => {
  const client = await pool.connect();
  try {
    console.log("🔄 Running migrations...");

    // Create file_metadata table
    await client.query(`
      CREATE TABLE IF NOT EXISTS file_metadata (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        file_size BIGINT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        uploaded_by VARCHAR(255),
        changelog_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create comments table (associated with files)
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        file_id INTEGER REFERENCES file_metadata(id) ON DELETE CASCADE,
        author VARCHAR(255) NOT NULL DEFAULT 'anonymous',
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure there's at least one record
    const count = await client.query("SELECT COUNT(*) FROM file_metadata");
    if (count.rows[0].count === "0") {
      await client.query(`
        INSERT INTO file_metadata (filename, file_path, changelog_notes, uploaded_by)
        VALUES ($1, $2, $3, $4)
      `, ["PyG_2026_06.xlsx", "/data/PyG_2026_06.xlsx", "Archivo inicial del dashboard", "admin"]);
      console.log("✅ Initial file_metadata record created");
    }

    console.log("✅ Migrations completed successfully");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    throw err;
  } finally {
    client.release();
  }
};
