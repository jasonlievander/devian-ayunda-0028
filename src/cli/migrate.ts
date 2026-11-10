import pg from "pg";
import { runMigrations } from "../infrastructure/migrate.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL wajib diisi");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });

try {
  await runMigrations(pool);
  console.log("Migrasi selesai");
} finally {
  await pool.end();
}
