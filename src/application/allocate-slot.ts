import { createHash } from "node:crypto";
import { config } from "../config";
import { DomainError, validationError } from "../domain/errors";
import {
  assertCapacity,
  assertLeadTime,
  assertOperatingHours,
  type RoomPolicy,
} from "../domain/policy";
import { parseTimeRange } from "../domain/time";
import {
  nextId,
  overlaps,
  ACTIVE_STATUSES,
  type MemoryStore,
  type ReservationRecord,
  type StoreState,
} from "../infrastructure/memory-store";

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

function requestHash(input: AllocateSlotInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        roomId: String(input.roomId),
        orgId:
          input.orgId === undefined || input.orgId === null
            ? null
            : String(input.orgId),
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
  row: ReservationRecord,
  identity: { pemohonNama: string | null; nim: string | null },
): AllocatedReservation {
  return {
    id: BigInt(row.id),
    businessId: row.businessId,
    roomId: BigInt(row.roomId),
    userId: BigInt(row.userId),
    orgId: row.orgId === null ? null : BigInt(row.orgId),
    start: new Date(row.start),
    end: new Date(row.end),
    purpose: row.purpose,
    participants: row.participants,
    status: row.status,
    pemohonNama: identity.pemohonNama,
    nim: identity.nim,
  };
}

function nextBusinessId(state: StoreState, dayKey: string): string {
  const sequence = (state.dailySeq[dayKey] ?? 0) + 1;
  state.dailySeq[dayKey] = sequence;
  return `RSV-${dayKey.replaceAll("-", "")}-${String(sequence).padStart(4, "0")}`;
}

export async function allocateSlot(
  store: MemoryStore,
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
      : Number(input.orgId);
  const hash = requestHash(input);

  return store.transact((state) => {
    let resolvedUserId: number;

    if (nim !== undefined) {
      const existingUser = state.users.find((user) => user.nim === nim);
      if (existingUser !== undefined) {
        existingUser.nama = pemohonNama!;
        resolvedUserId = existingUser.id;
      } else {
        resolvedUserId = nextId(state, "users");
        state.users.push({
          id: resolvedUserId,
          nama: pemohonNama!,
          email: `${nim}@idbbali.ac.id`,
          peran: "mahasiswa",
          status: "aktif",
          nim,
        });
      }
    } else {
      resolvedUserId = Number(input.userId);
    }

    const user = state.users.find((candidate) => candidate.id === resolvedUserId);
    if (user === undefined) {
      throw new DomainError("NOT_FOUND", "Pengguna tidak ditemukan", 404);
    }
    if (user.status !== "aktif") {
      throw new DomainError("FORBIDDEN", "Akun tidak aktif", 403);
    }

    const identity = { pemohonNama: user.nama, nim: user.nim };

    const room = state.rooms.find(
      (candidate) => candidate.id === Number(input.roomId),
    );
    if (room === undefined) {
      throw new DomainError("NOT_FOUND", "Ruang tidak ditemukan", 404);
    }

    const existing = state.reservations.find(
      (reservation) =>
        reservation.userId === resolvedUserId &&
        reservation.idempotencyKey === input.idempotencyKey,
    );
    if (existing !== undefined) {
      if (existing.requestHash !== hash) {
        throw new DomainError(
          "IDEMPOTENCY_MISMATCH",
          "Kunci idempoten sudah dipakai untuk pengajuan yang berbeda",
          409,
          "idempotencyKey",
        );
      }
      return { reservation: mapReservation(existing, identity), replayed: true };
    }

    if (
      input.specialApproval === true &&
      !["petugas", "admin"].includes(user.peran)
    ) {
      throw new DomainError(
        "FORBIDDEN",
        "Persetujuan khusus hanya dapat diberikan petugas atau admin",
        403,
      );
    }

    if (!room.aktif) {
      throw new DomainError("ROOM_UNAVAILABLE", "Ruang sedang tidak aktif", 409);
    }

    if (
      room.kebijakan === "khusus" &&
      !room.allowedRoles.includes(user.peran)
    ) {
      throw new DomainError(
        "FORBIDDEN",
        "Peran Anda tidak diizinkan memakai ruang ini",
        403,
      );
    }

    if (orgId !== null) {
      const membership = state.orgMembers.some(
        (member) => member.userId === resolvedUserId && member.orgId === orgId,
      );
      if (!membership) {
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
      policy: room.kebijakan as RoomPolicy,
      roomType: room.tipe,
      purpose: input.purpose,
    });

    const blockConflict = state.blocks.some(
      (block) =>
        block.roomId === room.id &&
        overlaps(block.start, block.end, range.start, range.end),
    );
    if (blockConflict) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Slot ini beririsan dengan jadwal kuliah atau blokir petugas",
        409,
        "mulai",
      );
    }

    const conflicting = state.reservations.some(
      (reservation) =>
        reservation.roomId === room.id &&
        ACTIVE_STATUSES.includes(reservation.status) &&
        overlaps(reservation.start, reservation.end, range.start, range.end),
    );
    if (conflicting) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Slot ini baru saja dipesan. Pilih jam lain atau ruang lain.",
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

      const activeCount = state.reservations.filter(
        (reservation) =>
          reservation.userId === resolvedUserId &&
          ACTIVE_STATUSES.includes(reservation.status),
      ).length;

      if (activeCount >= config.quota.maxActivePersonal) {
        throw new DomainError(
          "QUOTA_EXCEEDED",
          `Maksimal ${config.quota.maxActivePersonal} reservasi aktif pribadi. Selesaikan atau batalkan salah satu sebelum mengajukan lagi.`,
          422,
        );
      }
    }

    const status: ReservationStatus =
      room.kebijakan === "terbuka" ? "disetujui" : "menunggu";
    const businessId = nextBusinessId(state, range.startWita.dateKey);
    const timestamp = now.toISOString();

    const reservation: ReservationRecord = {
      id: nextId(state, "reservations"),
      businessId,
      roomId: room.id,
      userId: resolvedUserId,
      orgId,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      purpose: input.purpose,
      participants: input.participants,
      status,
      idempotencyKey: input.idempotencyKey,
      requestHash: hash,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    state.reservations.push(reservation);

    state.events.push({
      id: nextId(state, "events"),
      reservationId: reservation.id,
      from: null,
      to: status,
      actorId: resolvedUserId,
      reason: null,
      waktu: timestamp,
    });

    return {
      reservation: mapReservation(reservation, identity),
      replayed: false,
    };
  });
}
