import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/migrate";

export interface TestDb {
  pool: pg.Pool;
  stop: () => Promise<void>;
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Tidak dapat menentukan port"));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

export async function startTestDb(): Promise<TestDb> {
  const port = await findFreePort();
  const databaseDir = await mkdtemp(path.join(os.tmpdir(), "idb-pg-"));

  const server = new EmbeddedPostgres({
    databaseDir,
    port,
    user: "postgres",
    password: "postgres",
    persistent: false,
    authMethod: "password",
    onLog: () => {},
    onError: (error) => {
      console.error(error);
    },
  });

  await server.initialise();
  await server.start();

  const pool = new pg.Pool({
    connectionString: `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
    max: 20,
  });

  await runMigrations(pool);

  return {
    pool,
    stop: async () => {
      await pool.end();
      await server.stop();
      await rm(databaseDir, { recursive: true, force: true });
    },
  };
}

export async function resetDb(pool: pg.Pool): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      reservation_events,
      reservations,
      reservation_daily_seq,
      room_blocks,
      room_facilities,
      org_members,
      organizations,
      rooms,
      users
    RESTART IDENTITY CASCADE
  `);
}

export interface SeedUserOptions {
  role?: string;
  email?: string;
}

export async function seedUser(
  pool: pg.Pool,
  options: SeedUserOptions = {},
): Promise<bigint> {
  const role = options.role ?? "mahasiswa";
  const email = options.email ?? `${role}-${Date.now()}-${Math.random()}@idbbali.ac.id`;
  const result = await pool.query<{ id: string }>(
    "INSERT INTO users (nama, email, peran) VALUES ($1, $2, $3) RETURNING id",
    [`Pengguna ${role}`, email, role],
  );
  return BigInt(result.rows[0]!.id);
}

export interface SeedRoomOptions {
  code?: string;
  name?: string;
  type?: string;
  capacity?: number | null;
  policy?: "terbuka" | "perlu_persetujuan" | "khusus";
  active?: boolean;
  allowedRoles?: string[];
}

export async function seedRoom(
  pool: pg.Pool,
  options: SeedRoomOptions = {},
): Promise<bigint> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO rooms (kode, nama, tipe, kapasitas, kebijakan, aktif, allowed_roles)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      options.code ?? `R-${Date.now()}-${Math.random()}`,
      options.name ?? options.code ?? "Ruang Uji",
      options.type ?? "diskusi",
      options.capacity === undefined ? 10 : options.capacity,
      options.policy ?? "terbuka",
      options.active ?? true,
      options.allowedRoles ?? [],
    ],
  );
  return BigInt(result.rows[0]!.id);
}

export async function seedBlock(
  pool: pg.Pool,
  roomId: bigint,
  start: string,
  end: string,
  reason = "Kuliah",
): Promise<void> {
  await pool.query(
    `INSERT INTO room_blocks (room_id, mulai, selesai, alasan, sumber)
     VALUES ($1, $2, $3, $4, 'kuliah')`,
    [roomId.toString(), start, end, reason],
  );
}

export async function seedOrganization(
  pool: pg.Pool,
  name = "BEM IDB",
): Promise<bigint> {
  const result = await pool.query<{ id: string }>(
    "INSERT INTO organizations (nama, jenis) VALUES ($1, 'BEM') RETURNING id",
    [name],
  );
  return BigInt(result.rows[0]!.id);
}

export async function addOrgMember(
  pool: pg.Pool,
  userId: bigint,
  orgId: bigint,
): Promise<void> {
  await pool.query(
    `INSERT INTO org_members (user_id, org_id, jabatan, periode)
     VALUES ($1, $2, 'Ketua', '2026/2027')`,
    [userId.toString(), orgId.toString()],
  );
}
