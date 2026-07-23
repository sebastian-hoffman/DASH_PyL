import { Pool } from "pg";

let pool: Pool | null = null;

export const initPool = (): Pool => {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("⚠️  DATABASE_URL not set. Database features will be disabled.");
    return null as any;
  }

  pool = new Pool({ connectionString });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
  });

  return pool;
};

export const getPool = (): Pool | null => pool;

export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};
