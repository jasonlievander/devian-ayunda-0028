import pg from "pg";
import { DomainError, validationError } from "../domain/errors";

export type AdminStatus = "menunggu" | "disetujui" | "ditolak";
export type AdminFilterStatus = AdminStatus | "semua" | "dibatalkan";

export interface AdminReservation {
  id: bigint;
  businessId: string;
  roomName: string;
  roomCode: string;
  pemohonNama: string;
  nim: string | null;
  start: Date;
  end: Date;
  purpose: string;
  participants: number;
  status: string;
  createdAt: Date;
  reason: string | null;
}

export interface AdminReservationFilters {
  query?: string | undefined;
  date?: string | undefined;
}

export interface AdminRoom {
  id: bigint;
  code: string;
  name: string;
  capacity: number | null;
  policy: string;
}

export interface AdminBlock {
  id: bigint;
  roomId: bigint;
  roomName: string;
  roomCode: string;
  start: Date;
  end: Date;
  reason: string;
  source: string;
  createdAt: Date;
}

export interface AdminEvent {
  id: bigint;
  businessId: string;
  roomName: string;
  from: string | null;
  to: string;
  reason: string | null;
  actor: string;
  waktu: Date;
}

export interface AdminStats {
  pending: number;
  approvedToday: number;
  roomsInUseToday: number;
  totalRooms: number;
}

export interface CreateBlockInput {
  roomId: bigint | number | string;
  start: string;
  end: string;
  reason: string;
}

interface AdminRow {
  id: string;
  business_id: string;
  room_name: string;
  room_code: string;
  pemohon_nama: string;
  nim: string | null;
  mulai: Date;
  selesai: Date;
  keperluan: string;
  peserta: number;
  status: string;
  created_at: Date;
  alasan: string | null;
}

const ALLOWED_STATUSES: AdminFilterStatus[] = [
  "menunggu",
  "disetujui",
  "ditolak",
  "dibatalkan",
  "semua",
];

const SELECT_ADMIN = `
  SELECT r.id, r.business_id, r.mulai, r.selesai, r.keperluan, r.peserta,
         r.status, r.created_at, u.nama AS pemohon_nama, u.nim,
         rm.nama AS room_name, rm.kode AS room_code, ev.alasan
  FROM reservations r
  JOIN users u ON u.id = r.user_id
  JOIN rooms rm ON rm.id = r.room_id
  LEFT JOIN LATERAL (
    SELECT e.alasan
    FROM reservation_events e
    WHERE e.reservation_id = r.id AND e.alasan IS NOT NULL
    ORDER BY e.waktu DESC, e.id DESC
    LIMIT 1
  ) ev ON true
`;

function mapRow(row: AdminRow): AdminReservation {
  return {
    id: BigInt(row.id),
    businessId: row.business_id,
    roomName: row.room_name,
    roomCode: row.room_code,
    pemohonNama: row.pemohon_nama,
    nim: row.nim,
    start: new Date(row.mulai),
    end: new Date(row.selesai),
    purpose: row.keperluan,
    participants: row.peserta,
    status: row.status,
    createdAt: new Date(row.created_at),
    reason: row.alasan,
  };
}

function validateReason(reason: string): string {
  const value = reason.trim();
  if (value.length < 3 || value.length > 500) {
    throw validationError(
      "Alasan wajib diisi (3–500 karakter)",
      "reason",
    );
  }
  return value;
}

function parseInstant(value: string, field: string): Date {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw validationError(
      `${field} wajib berupa waktu ISO-8601 dengan zona waktu`,
      field,
    );
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError(`${field} bukan waktu yang valid`, field);
  }
  return date;
}

function isExclusionViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23P01"
  );
}

export async function listReservations(
  pool: pg.Pool,
  status: AdminFilterStatus,
  filters: AdminReservationFilters = {},
): Promise<AdminReservation[]> {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw validationError("Status pengajuan tidak valid", "status");
  }

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status !== "semua") {
    params.push(status);
    conditions.push(`r.status = $${params.length}::reservation_status`);
  }

  if (filters.query !== undefined && filters.query.trim() !== "") {
    params.push(`%${filters.query.trim()}%`);
    const index = params.length;
    conditions.push(
      `(u.nama ILIKE $${index} OR u.nim ILIKE $${index} OR r.business_id ILIKE $${index} OR rm.nama ILIKE $${index})`,
    );
  }

  if (filters.date !== undefined && filters.date.trim() !== "") {
    params.push(filters.date.trim());
    const index = params.length;
    conditions.push(
      `(r.mulai AT TIME ZONE 'Asia/Makassar')::date = $${index}::date`,
    );
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query<AdminRow>(
    `${SELECT_ADMIN}
     ${where}
     ORDER BY r.created_at ASC, r.id ASC
     LIMIT 100`,
    params,
  );

  return result.rows.map(mapRow);
}

async function findById(
  client: pg.PoolClient,
  id: string,
): Promise<AdminRow | undefined> {
  const result = await client.query<AdminRow>(
    `${SELECT_ADMIN} WHERE r.id = $1`,
    [id],
  );
  return result.rows[0];
}

export async function approveReservation(
  pool: pg.Pool,
  id: bigint | number | string,
): Promise<AdminReservation> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query<{
      id: string;
      room_id: string;
      status: string;
      mulai: Date;
      selesai: Date;
    }>(
      `SELECT id, room_id, status, mulai, selesai
       FROM reservations WHERE id = $1 FOR UPDATE`,
      [String(id)],
    );
    const reservation = current.rows[0];
    if (reservation === undefined) {
      throw new DomainError("NOT_FOUND", "Pengajuan tidak ditemukan", 404);
    }
    if (reservation.status !== "menunggu") {
      throw new DomainError(
        "INVALID_STATE",
        "Pengajuan ini sudah diproses",
        409,
      );
    }

    const blocks = await client.query(
      `SELECT 1 FROM room_blocks
       WHERE room_id = $1
         AND tstzrange(mulai, selesai, '[)') && tstzrange($2, $3, '[)')
       LIMIT 1`,
      [
        reservation.room_id,
        new Date(reservation.mulai).toISOString(),
        new Date(reservation.selesai).toISOString(),
      ],
    );
    if (blocks.rowCount !== 0) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Ruang diblokir pada waktu tersebut; pengajuan tidak dapat disetujui",
        409,
      );
    }

    await client.query(
      "UPDATE reservations SET status = 'disetujui', updated_at = now() WHERE id = $1",
      [String(id)],
    );
    await client.query(
      `INSERT INTO reservation_events (reservation_id, dari, ke, pelaku, alasan)
       VALUES ($1, 'menunggu', 'disetujui', NULL, $2)`,
      [String(id), "Disetujui melalui panel petugas"],
    );

    const row = await findById(client, String(id));
    await client.query("COMMIT");
    return mapRow(row!);
  } catch (error) {
    await rollback(client);
    if (error instanceof DomainError) {
      throw error;
    }
    if (isExclusionViolation(error)) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Slot sudah dipakai; pengajuan tidak dapat disetujui",
        409,
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectReservation(
  pool: pg.Pool,
  id: bigint | number | string,
  reason: string,
): Promise<AdminReservation> {
  const alasan = validateReason(reason);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query<{ status: string }>(
      "SELECT status FROM reservations WHERE id = $1 FOR UPDATE",
      [String(id)],
    );
    const reservation = current.rows[0];
    if (reservation === undefined) {
      throw new DomainError("NOT_FOUND", "Pengajuan tidak ditemukan", 404);
    }
    if (reservation.status !== "menunggu") {
      throw new DomainError(
        "INVALID_STATE",
        "Pengajuan ini sudah diproses",
        409,
      );
    }

    await client.query(
      "UPDATE reservations SET status = 'ditolak', updated_at = now() WHERE id = $1",
      [String(id)],
    );
    await client.query(
      `INSERT INTO reservation_events (reservation_id, dari, ke, pelaku, alasan)
       VALUES ($1, 'menunggu', 'ditolak', NULL, $2)`,
      [String(id), alasan],
    );

    const row = await findById(client, String(id));
    await client.query("COMMIT");
    return mapRow(row!);
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelReservation(
  pool: pg.Pool,
  id: bigint | number | string,
  reason: string,
): Promise<AdminReservation> {
  const alasan = validateReason(reason);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query<{ status: string }>(
      "SELECT status FROM reservations WHERE id = $1 FOR UPDATE",
      [String(id)],
    );
    const reservation = current.rows[0];
    if (reservation === undefined) {
      throw new DomainError("NOT_FOUND", "Pengajuan tidak ditemukan", 404);
    }
    if (!["menunggu", "disetujui"].includes(reservation.status)) {
      throw new DomainError(
        "INVALID_STATE",
        "Reservasi ini tidak dapat dibatalkan pada status tersebut",
        409,
      );
    }

    await client.query(
      "UPDATE reservations SET status = 'dibatalkan', updated_at = now() WHERE id = $1",
      [String(id)],
    );
    await client.query(
      `INSERT INTO reservation_events (reservation_id, dari, ke, pelaku, alasan)
       VALUES ($1, $2::reservation_status, 'dibatalkan', NULL, $3)`,
      [String(id), reservation.status, alasan],
    );

    const row = await findById(client, String(id));
    await client.query("COMMIT");
    return mapRow(row!);
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function rollback(client: pg.PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // transaksi mungkin sudah selesai
  }
}

export async function getStats(pool: pg.Pool): Promise<AdminStats> {
  const result = await pool.query<{
    pending: number;
    approved_today: number;
    rooms_in_use_today: number;
    total_rooms: number;
  }>(`
    SELECT
      (SELECT count(*) FROM reservations WHERE status = 'menunggu')::int AS pending,
      (SELECT count(*) FROM reservations
        WHERE status IN ('disetujui', 'berlangsung')
          AND (mulai AT TIME ZONE 'Asia/Makassar')::date
              = (now() AT TIME ZONE 'Asia/Makassar')::date)::int AS approved_today,
      (SELECT count(DISTINCT room_id) FROM reservations
        WHERE status IN ('disetujui', 'berlangsung')
          AND (mulai AT TIME ZONE 'Asia/Makassar')::date
              = (now() AT TIME ZONE 'Asia/Makassar')::date)::int AS rooms_in_use_today,
      (SELECT count(*) FROM rooms WHERE aktif)::int AS total_rooms
  `);

  const row = result.rows[0]!;
  return {
    pending: row.pending,
    approvedToday: row.approved_today,
    roomsInUseToday: row.rooms_in_use_today,
    totalRooms: row.total_rooms,
  };
}

export async function listAdminRooms(pool: pg.Pool): Promise<AdminRoom[]> {
  const result = await pool.query<{
    id: string;
    kode: string;
    nama: string;
    kapasitas: number | null;
    kebijakan: string;
  }>(
    `SELECT id, kode, nama, kapasitas, kebijakan
     FROM rooms WHERE aktif ORDER BY kode ASC`,
  );

  return result.rows.map((row) => ({
    id: BigInt(row.id),
    code: row.kode,
    name: row.nama,
    capacity: row.kapasitas,
    policy: row.kebijakan,
  }));
}

export async function listBlocks(pool: pg.Pool): Promise<AdminBlock[]> {
  const result = await pool.query<{
    id: string;
    room_id: string;
    room_name: string;
    room_code: string;
    mulai: Date;
    selesai: Date;
    alasan: string;
    sumber: string;
    created_at: Date;
  }>(
    `SELECT b.id, b.room_id, rm.nama AS room_name, rm.kode AS room_code,
            b.mulai, b.selesai, b.alasan, b.sumber, b.created_at
     FROM room_blocks b
     JOIN rooms rm ON rm.id = b.room_id
     WHERE b.selesai >= now()
     ORDER BY b.mulai ASC, b.id ASC
     LIMIT 100`,
  );

  return result.rows.map((row) => ({
    id: BigInt(row.id),
    roomId: BigInt(row.room_id),
    roomName: row.room_name,
    roomCode: row.room_code,
    start: new Date(row.mulai),
    end: new Date(row.selesai),
    reason: row.alasan,
    source: row.sumber,
    createdAt: new Date(row.created_at),
  }));
}

export async function createBlock(
  pool: pg.Pool,
  input: CreateBlockInput,
): Promise<{ block: AdminBlock; cancelled: number }> {
  const reason = validateReason(input.reason);
  const start = parseInstant(input.start, "start");
  const end = parseInstant(input.end, "end");
  if (end.getTime() <= start.getTime()) {
    throw validationError("Waktu selesai harus setelah waktu mulai", "end");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const room = await client.query<{ id: string; aktif: boolean }>(
      "SELECT id, aktif FROM rooms WHERE id = $1 FOR UPDATE",
      [String(input.roomId)],
    );
    if (room.rows[0] === undefined) {
      throw new DomainError("NOT_FOUND", "Ruang tidak ditemukan", 404);
    }
    if (!room.rows[0].aktif) {
      throw new DomainError("ROOM_UNAVAILABLE", "Ruang sedang tidak aktif", 409);
    }

    const inserted = await client.query<{
      id: string;
      room_id: string;
      mulai: Date;
      selesai: Date;
      alasan: string;
      sumber: string;
      created_at: Date;
    }>(
      `INSERT INTO room_blocks (room_id, mulai, selesai, alasan, sumber)
       VALUES ($1, $2, $3, $4, 'petugas')
       RETURNING id, room_id, mulai, selesai, alasan, sumber, created_at`,
      [String(input.roomId), start.toISOString(), end.toISOString(), reason],
    );
    const blockRow = inserted.rows[0]!;

    const overlapping = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM reservations
       WHERE room_id = $1
         AND status IN ('menunggu', 'disetujui')
         AND tstzrange(mulai, selesai, '[)') && tstzrange($2, $3, '[)')
       FOR UPDATE`,
      [String(input.roomId), start.toISOString(), end.toISOString()],
    );

    for (const reservation of overlapping.rows) {
      await client.query(
        "UPDATE reservations SET status = 'dibatalkan', updated_at = now() WHERE id = $1",
        [reservation.id],
      );
      await client.query(
        `INSERT INTO reservation_events (reservation_id, dari, ke, pelaku, alasan)
         VALUES ($1, $2::reservation_status, 'dibatalkan', NULL, $3)`,
        [
          reservation.id,
          reservation.status,
          `Ruang diblokir: ${reason}`,
        ],
      );
    }

    const roomInfo = await client.query<{ nama: string; kode: string }>(
      "SELECT nama, kode FROM rooms WHERE id = $1",
      [String(input.roomId)],
    );

    await client.query("COMMIT");

    return {
      block: {
        id: BigInt(blockRow.id),
        roomId: BigInt(blockRow.room_id),
        roomName: roomInfo.rows[0]!.nama,
        roomCode: roomInfo.rows[0]!.kode,
        start: new Date(blockRow.mulai),
        end: new Date(blockRow.selesai),
        reason: blockRow.alasan,
        source: blockRow.sumber,
        createdAt: new Date(blockRow.created_at),
      },
      cancelled: overlapping.rowCount ?? 0,
    };
  } catch (error) {
    await rollback(client);
    if (error instanceof DomainError) {
      throw error;
    }
    if (isExclusionViolation(error)) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Blokir beririsan dengan blok lain pada ruang tersebut",
        409,
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function listEvents(
  pool: pg.Pool,
  limit = 50,
): Promise<AdminEvent[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const result = await pool.query<{
    id: string;
    business_id: string;
    room_name: string;
    dari: string | null;
    ke: string;
    alasan: string | null;
    pelaku: string | null;
    waktu: Date;
  }>(
    `SELECT e.id, r.business_id, rm.nama AS room_name, e.dari, e.ke,
            e.alasan, u.nama AS pelaku, e.waktu
     FROM reservation_events e
     JOIN reservations r ON r.id = e.reservation_id
     JOIN rooms rm ON rm.id = r.room_id
     LEFT JOIN users u ON u.id = e.pelaku
     ORDER BY e.waktu DESC, e.id DESC
     LIMIT $1`,
    [safeLimit],
  );

  return result.rows.map((row) => ({
    id: BigInt(row.id),
    businessId: row.business_id,
    roomName: row.room_name,
    from: row.dari,
    to: row.ke,
    reason: row.alasan,
    actor: row.pelaku ?? (row.ke === "menunggu" ? "Pemohon" : "Petugas"),
    waktu: new Date(row.waktu),
  }));
}
