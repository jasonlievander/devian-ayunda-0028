import pg from "pg";
import { createApp } from "./http/app";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL wajib diisi");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const app = createApp({ pool });

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });

async function shutdown(): Promise<void> {
  await app.close();
  await pool.end();
}

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
