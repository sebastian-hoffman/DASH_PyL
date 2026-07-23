import app from "./app.js";
import { port } from "./config/index.js";
import { initPool } from "./db/init.js";
import { runMigrations } from "./db/migrations.js";
import { loadAllSourceRows } from "./data/loader.js";

const startServer = async () => {
  try {
    // Initialize database pool if DATABASE_URL is set
    if (process.env.DATABASE_URL) {
      const pool = initPool();
      if (pool) {
        await runMigrations(pool);
        console.log("✅ Database initialized");
      }
    }

    // Load PNL data into cache (must complete before starting server)
    console.log("📖 Loading PNL data...");
    await loadAllSourceRows();
    console.log("✅ PNL data loaded - server ready");

    app.listen(port, () => {
      console.log(`DASH PL API running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
