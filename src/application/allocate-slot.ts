import { createHash } from "node:crypto";
import pg from "pg";
import { config } from "../config";
import { DomainError, validationError } from "../domain/errors";
import {
  assertCapacity,
  assertLeadTime,
  assertOperatingHours,
  type RoomPolicy,
} from "../domain/policy";
import { parseTimeRange } from "../domain/time";

export type ReservationStatus =
  | "menunggu"
  | "disetujui"
  | "berlangsung"
  | "selesai"
  | "ditolak"
  | "dibatalkan"
  | "kedaluwarsa"
  | "tidak_hadir";

export interface AllocateSlotInput {
  userId?: bigint | number | undefined;
  pemohonNama?: string | undefined;
  nim?: string | undefined;
  roomId: bigint | number;
  orgId?: bigint | number | null;
  start: string;
  end: string;
  purpose: string;
  participants: number;
  idempotencyKey: string;
  specialApproval?: boolean;
  now?: Date;
}

export interface AllocatedReservation {
  id: bigint;
  businessId: string;
  roomId: bigint;
  userId: bigint;
  orgId: bigint | null;
  start: Date;
  end: Date;
  purpose: string;
  participants: number;
  status: ReservationStatus;
  pemohonNama: string | null;
  nim: string | null;
}

export interface AllocationResult {
  reservation: AllocatedReservation;
  replayed: boolean;
}

interface UserRow {
  id: string;
  nama: string;
  peran: string;
  status: string;
  nim: string | null;
}

interface RoomRow {
  id: string;
  tipe: string;
  kapasitas: number | null;
  kebijakan: RoomPolicy;
  aktif: boolean;
  allowed_roles: string[];
}

interface ReservationRow {
  id: string;
  business_id: string;
  room_id: string;
  user_id: string;
  org_id: string | null;
  mulai: Date;
  selesai: Date;
  keperluan: string;
  peserta: number;
  status: ReservationStatus;
  request_hash: string;
}

const ACTIVE_STATUSES = ["menunggu", "disetujui", "berlangsung"] as const;

function requestHash(input: AllocateSlotInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        roomId: String(input.roomId),
        orgId: input.orgId === undefined || input.orgId === null ? null : String(input.orgId),
        start: input.start,
        end: input.end,
        purpose: input.purpose,
        participants: input.participants,
        specialApproval: input.specialApproval ?? false,
        pemohonNama: input.pemohonNama?.trim() ?? null,
        nim: input.nim?.trim() ?? null,
      }),
    )
    .digest("hex");
}

function mapReservation(
  row: ReservationRow,
  identity: { pemohonNama: string | null; nim: string | null } = {
    pemohonNama: null,
    nim: null,
  },
): AllocatedReservation {
  return {
    id: BigInt(row.id),
    businessId: row.business_id,
    roomId: BigInt(row.room_id),
    userId: BigInt(row.user_id),
    orgId: row.org_id === null ? null : BigInt(row.org_id),
    start: new Date(row.mulai),
    end: new Date(row.selesai),
    purpose: row.keperluan,
    participants: row.peserta,
    status: row.status,
    pemohonNama: identity.pemohonNama,
    nim: identity.nim,
  };
}

function isUniqueViolation(error: unknown): error is { code: string; constraint?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
}

function isExclusionViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23P01"
  );
}

async function nextBusinessId(
  client: pg.PoolClient,
  dayKey: string,
): Promise<string> {
  const result = await client.query<{ last_value: number }>(
    `INSERT INTO reservation_daily_seq (day, last_value)
     VALUES ($1, 1)
     ON CONFLICT (day)
     DO UPDATE SET last_value = reservation_daily_seq.last_value + 1
     RETURNING last_value`,
    [dayKey],
  );

  const sequence = result.rows[0]!.last_value;
  return `RSV-${dayKey.replaceAll("-", "")}-${String(sequence).padStart(4, "0")}`;
}

export async function allocateSlot(
  pool: pg.Pool,
  input: AllocateSlotInput,
): Promise<AllocationResult> {
  if (!input.idempotencyKey || input.idempotencyKey.trim() === "") {
    throw validationError("Kunci idempoten wajib diisi", "idempotencyKey");
  }

  const nim = input.nim?.trim();
  const pemohonNama = input.pemohonNama?.trim();

  if (nim !== undefined) {
    if (!/^\d{5,20}$/.test(nim)) {
      throw validationError("NIM harus 5–20 digit angka", "nim");
    }
    if (pemohonNama === undefined || pemohonNama.length < 2) {
      throw validationError("Nama pemohon minimal 2 karakter", "pemohonNama");
    }
  } else if (input.userId === undefined) {
    throw validationError(
      "Nama dan NIM pemohon wajib diisi",
      "pemohonNama",
    );
  }

  const now = input.now ?? new Date();
  const orgId =
    input.orgId === undefined || input.orgId === null
      ? null
      : String(input.orgId);
  const hash = requestHash(input);

  const client = await pool.connect();
  let resolvedUserId: string | null = null;
  let identity: { pemohonNama: string | null; nim: string | null } = {
    pemohonNama: null,
    nim: null,
  };

  try {
    await client.query("BEGIN");

    if (nim !== undefined) {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",
        [nim],
      );
      const created = await client.query<{ id: string }>(
        `INSERT INTO users (nama, email, peran, status, nim)
         VALUES ($1, $2, 'mahasiswa', 'aktif', $3)
         ON CONFLICT (nim) DO UPDATE SET nama = EXCLUDED.nama
         RETURNING id`,
        [pemohonNama, `${nim}@idbbali.ac.id`, nim],
      );
      resolvedUserId = created.rows[0]!.id;
    } else {
      resolvedUserId = String(input.userId);
    }

    const userResult = await client.query<UserRow>(
      "SELECT id, nama, peran, status, nim FROM users WHERE id = $1 FOR UPDATE",
      [resolvedUserId],
    );
    const user = userResult.rows[0];
    if (user === undefined) {
      throw new DomainError("NOT_FOUND", "Pengguna tidak ditemukan", 404);
    }
    if (user.status !== "aktif") {
      throw new DomainError("FORBIDDEN", "Akun tidak aktif", 403);
    }

    identity = { pemohonNama: user.nama, nim: user.nim };

    const roomResult = await client.query<RoomRow>(
      `SELECT id, tipe, kapasitas, kebijakan, aktif, allowed_roles
       FROM rooms WHERE id = $1 FOR UPDATE`,
      [String(input.roomId)],
    );
    const room = roomResult.rows[0];
    if (room === undefined) {
      throw new DomainError("NOT_FOUND", "Ruang tidak ditemukan", 404);
    }

    const existingResult = await client.query<ReservationRow>(
      `SELECT id, business_id, room_id, user_id, org_id, mulai, selesai,
              keperluan, peserta, status, request_hash
       FROM reservations
       WHERE user_id = $1 AND kunci_idempoten = $2`,
      [resolvedUserId, input.idempotencyKey],
    );
    const existing = existingResult.rows[0];
    if (existing !== undefined) {
      if (existing.request_hash !== hash) {
        throw new DomainError(
          "IDEMPOTENCY_MISMATCH",
          "Kunci idempoten sudah dipakai untuk pengajuan yang berbeda",
          409,
          "idempotencyKey",
        );
      }

      await client.query("COMMIT");
      return { reservation: mapReservation(existing, identity), replayed: true };
    }

    if (input.specialApproval === true && !["petugas", "admin"].includes(user.peran)) {
      throw new DomainError(
        "FORBIDDEN",
        "Persetujuan khusus hanya dapat diberikan petugas atau admin",
        403,
      );
    }

    if (!room.aktif) {
      throw new DomainError("ROOM_UNAVAILABLE", "Ruang sedang tidak aktif", 409);
    }

    if (room.kebijakan === "khusus" && !room.allowed_roles.includes(user.peran)) {
      throw new DomainError(
        "FORBIDDEN",
        "Peran Anda tidak diizinkan memakai ruang ini",
        403,
      );
    }

    if (orgId !== null) {
      const membership = await client.query(
        "SELECT 1 FROM org_members WHERE user_id = $1 AND org_id = $2 LIMIT 1",
        [resolvedUserId, orgId],
      );
      if (membership.rowCount === 0) {
        throw new DomainError(
          "FORBIDDEN",
          "Anda bukan pengurus organisasi tersebut",
          403,
        );
      }
    }

    const range = parseTimeRange(input.start, input.end);

    assertCapacity(input.participants, room.kapasitas);
    assertOperatingHours(range, {
      specialApproval: input.specialApproval ?? false,
    });
    assertLeadTime(range, {
      now,
      policy: room.kebijakan,
      roomType: room.tipe,
      purpose: input.purpose,
    });

    const blockConflict = await client.query(
      `SELECT 1 FROM room_blocks
       WHERE room_id = $1
         AND tstzrange(mulai, selesai, '[)') && tstzrange($2, $3, '[)')
       LIMIT 1`,
      [String(input.roomId), range.start.toISOString(), range.end.toISOString()],
    );
    if (blockConflict.rowCount !== 0) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Slot ini beririsan dengan jadwal kuliah atau blokir petugas",
        409,
        "mulai",
      );
    }

    const isPersonalQuotaRoom =
      orgId === null &&
      (config.quota.roomTypes as readonly string[]).includes(room.tipe);

    if (isPersonalQuotaRoom) {
      const durationMinutes =
        (range.end.getTime() - range.start.getTime()) / 60_000;
      if (durationMinutes > config.quota.maxHoursPerReservation * 60) {
        throw validationError(
          `Reservasi pribadi pada ruang ini maksimal ${config.quota.maxHoursPerReservation} jam`,
          "selesai",
        );
      }

      const activeCount = await client.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM reservations
         WHERE user_id = $1 AND status = ANY($2::reservation_status[])`,
        [resolvedUserId, ACTIVE_STATUSES],
      );

      if (activeCount.rows[0]!.total >= config.quota.maxActivePersonal) {
        throw new DomainError(
          "QUOTA_EXCEEDED",
          `Maksimal ${config.quota.maxActivePersonal} reservasi aktif pribadi. Selesaikan atau batalkan salah satu sebelum mengajukan lagi.`,
          422,
        );
      }
    }

    const status: ReservationStatus =
      room.kebijakan === "terbuka" ? "disetujui" : "menunggu";
    const businessId = await nextBusinessId(client, range.startWita.dateKey);

    const inserted = await client.query<ReservationRow>(
      `INSERT INTO reservations
        (business_id, room_id, user_id, org_id, mulai, selesai, keperluan,
         peserta, status, kunci_idempoten, request_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, business_id, room_id, user_id, org_id, mulai, selesai,
                 keperluan, peserta, status, request_hash`,
      [
        businessId,
        String(input.roomId),
        resolvedUserId,
        orgId,
        range.start.toISOString(),
        range.end.toISOString(),
        input.purpose,
        input.participants,
        status,
        input.idempotencyKey,
        hash,
      ],
    );

    const reservation = inserted.rows[0]!;

    await client.query(
      `INSERT INTO reservation_events (reservation_id, dari, ke, pelaku)
       VALUES ($1, NULL, $2, $3)`,
      [reservation.id, status, resolvedUserId],
    );

    await client.query("COMMIT");
    return { reservation: mapReservation(reservation, identity), replayed: false };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // transaksi mungkin sudah selesai
    }

    if (error instanceof DomainError) {
      throw error;
    }

    if (isExclusionViolation(error)) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Slot ini baru saja dipesan. Pilih jam lain atau ruang lain.",
        409,
        "mulai",
      );
    }

    if (
      isUniqueViolation(error) &&
      error.constraint?.includes("reservations_idempotency")
    ) {
      if (resolvedUserId === null) {
        throw error;
      }
      const existing = await client.query<ReservationRow>(
        `SELECT id, business_id, room_id, user_id, org_id, mulai, selesai,
                keperluan, peserta, status, request_hash
         FROM reservations
         WHERE user_id = $1 AND kunci_idempoten = $2`,
        [resolvedUserId, input.idempotencyKey],
      );
      const row = existing.rows[0];
      if (row !== undefined && row.request_hash === hash) {
        return { reservation: mapReservation(row, identity), replayed: true };
      }
      throw new DomainError(
        "IDEMPOTENCY_MISMATCH",
        "Kunci idempoten sudah dipakai untuk pengajuan yang berbeda",
        409,
        "idempotencyKey",
      );
    }

    throw error;
  } finally {
    client.release();
  }
}
