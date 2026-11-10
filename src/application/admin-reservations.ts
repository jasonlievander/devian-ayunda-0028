import { DomainError, validationError } from "../domain/errors";
import { witaDateKey } from "../domain/time";
import {
  nextId,
  overlaps,
  ACTIVE_STATUSES,
  type MemoryStore,
  type ReservationEventRecord,
  type ReservationRecord,
  type RoomBlockRecord,
  type StoreState,
} from "../infrastructure/memory-store";

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

const ALLOWED_STATUSES: AdminFilterStatus[] = [
  "menunggu",
  "disetujui",
  "ditolak",
  "dibatalkan",
  "semua",
];

function latestReason(
  state: StoreState,
  reservationId: number,
): string | null {
  const events = state.events
    .filter(
      (event) =>
        event.reservationId === reservationId && event.reason !== null,
    )
    .sort((a, b) => {
      const diff = new Date(b.waktu).getTime() - new Date(a.waktu).getTime();
      return diff !== 0 ? diff : b.id - a.id;
    });
  return events[0]?.reason ?? null;
}

function mapReservation(
  state: StoreState,
  reservation: ReservationRecord,
): AdminReservation {
  const user = state.users.find(
    (candidate) => candidate.id === reservation.userId,
  );
  const room = state.rooms.find(
    (candidate) => candidate.id === reservation.roomId,
  );

  return {
    id: BigInt(reservation.id),
    businessId: reservation.businessId,
    roomName: room?.nama ?? "",
    roomCode: room?.kode ?? "",
    pemohonNama: user?.nama ?? "",
    nim: user?.nim ?? null,
    start: new Date(reservation.start),
    end: new Date(reservation.end),
    purpose: reservation.purpose,
    participants: reservation.participants,
    status: reservation.status,
    createdAt: new Date(reservation.createdAt),
    reason: latestReason(state, reservation.id),
  };
}

function validateReason(reason: string): string {
  const value = reason.trim();
  if (value.length < 3 || value.length > 500) {
    throw validationError("Alasan wajib diisi (3–500 karakter)", "reason");
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

function findReservation(
  state: StoreState,
  id: bigint | number | string,
): ReservationRecord {
  const reservation = state.reservations.find(
    (candidate) => candidate.id === Number(id),
  );
  if (reservation === undefined) {
    throw new DomainError("NOT_FOUND", "Pengajuan tidak ditemukan", 404);
  }
  return reservation;
}

function recordEvent(
  state: StoreState,
  reservationId: number,
  from: ReservationRecord["status"],
  to: ReservationRecord["status"],
  reason: string | null,
  actorId: number | null = null,
  waktu = new Date().toISOString(),
): void {
  state.events.push({
    id: nextId(state, "events"),
    reservationId,
    from,
    to,
    actorId,
    reason,
    waktu,
  });
}

export async function listReservations(
  store: MemoryStore,
  status: AdminFilterStatus,
  filters: AdminReservationFilters = {},
): Promise<AdminReservation[]> {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw validationError("Status pengajuan tidak valid", "status");
  }

  return store.read((state) => {
    const query = filters.query?.trim().toLowerCase();
    const date = filters.date?.trim();

    return state.reservations
      .filter((reservation) => {
        if (status !== "semua" && reservation.status !== status) {
          return false;
        }
        if (date !== undefined && date !== "") {
          if (witaDateKey(new Date(reservation.start)) !== date) {
            return false;
          }
        }
        if (query !== undefined && query !== "") {
          const user = state.users.find(
            (candidate) => candidate.id === reservation.userId,
          );
          const room = state.rooms.find(
            (candidate) => candidate.id === reservation.roomId,
          );
          const haystack = [
            user?.nama ?? "",
            user?.nim ?? "",
            reservation.businessId,
            room?.nama ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const diff =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return diff !== 0 ? diff : a.id - b.id;
      })
      .slice(0, 100)
      .map((reservation) => mapReservation(state, reservation));
  });
}

export async function approveReservation(
  store: MemoryStore,
  id: bigint | number | string,
): Promise<AdminReservation> {
  return store.transact((state) => {
    const reservation = findReservation(state, id);
    if (reservation.status !== "menunggu") {
      throw new DomainError(
        "INVALID_STATE",
        "Pengajuan ini sudah diproses",
        409,
      );
    }

    const blocked = state.blocks.some(
      (block) =>
        block.roomId === reservation.roomId &&
        overlaps(block.start, block.end, reservation.start, reservation.end),
    );
    if (blocked) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Ruang diblokir pada waktu tersebut; pengajuan tidak dapat disetujui",
        409,
      );
    }

    const conflict = state.reservations.some(
      (other) =>
        other.id !== reservation.id &&
        other.roomId === reservation.roomId &&
        ACTIVE_STATUSES.includes(other.status) &&
        overlaps(other.start, other.end, reservation.start, reservation.end),
    );
    if (conflict) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Slot sudah dipakai; pengajuan tidak dapat disetujui",
        409,
      );
    }

    reservation.status = "disetujui";
    reservation.updatedAt = new Date().toISOString();
    recordEvent(
      state,
      reservation.id,
      "menunggu",
      "disetujui",
      "Disetujui melalui panel petugas",
      null,
      reservation.updatedAt,
    );

    return mapReservation(state, reservation);
  });
}

export async function rejectReservation(
  store: MemoryStore,
  id: bigint | number | string,
  reason: string,
): Promise<AdminReservation> {
  const alasan = validateReason(reason);

  return store.transact((state) => {
    const reservation = findReservation(state, id);
    if (reservation.status !== "menunggu") {
      throw new DomainError(
        "INVALID_STATE",
        "Pengajuan ini sudah diproses",
        409,
      );
    }

    reservation.status = "ditolak";
    reservation.updatedAt = new Date().toISOString();
    recordEvent(
      state,
      reservation.id,
      "menunggu",
      "ditolak",
      alasan,
      null,
      reservation.updatedAt,
    );

    return mapReservation(state, reservation);
  });
}

export async function cancelReservation(
  store: MemoryStore,
  id: bigint | number | string,
  reason: string,
): Promise<AdminReservation> {
  const alasan = validateReason(reason);

  return store.transact((state) => {
    const reservation = findReservation(state, id);
    if (!["menunggu", "disetujui"].includes(reservation.status)) {
      throw new DomainError(
        "INVALID_STATE",
        "Reservasi ini tidak dapat dibatalkan pada status tersebut",
        409,
      );
    }

    const from = reservation.status;
    reservation.status = "dibatalkan";
    reservation.updatedAt = new Date().toISOString();
    recordEvent(
      state,
      reservation.id,
      from,
      "dibatalkan",
      alasan,
      null,
      reservation.updatedAt,
    );

    return mapReservation(state, reservation);
  });
}

export async function getStats(store: MemoryStore): Promise<AdminStats> {
  const now = new Date();
  const today = witaDateKey(now);

  return store.read((state) => {
    const activeToday = state.reservations.filter(
      (reservation) =>
        ["disetujui", "berlangsung"].includes(reservation.status) &&
        witaDateKey(new Date(reservation.start)) === today,
    );

    return {
      pending: state.reservations.filter(
        (reservation) => reservation.status === "menunggu",
      ).length,
      approvedToday: activeToday.length,
      roomsInUseToday: new Set(
        activeToday.map((reservation) => reservation.roomId),
      ).size,
      totalRooms: state.rooms.filter((room) => room.aktif).length,
    };
  });
}

export async function listAdminRooms(store: MemoryStore): Promise<AdminRoom[]> {
  return store.read((state) =>
    state.rooms
      .filter((room) => room.aktif)
      .sort((a, b) => a.kode.localeCompare(b.kode))
      .map((room) => ({
        id: BigInt(room.id),
        code: room.kode,
        name: room.nama,
        capacity: room.kapasitas,
        policy: room.kebijakan,
      })),
  );
}

function mapBlock(state: StoreState, block: RoomBlockRecord): AdminBlock {
  const room = state.rooms.find((candidate) => candidate.id === block.roomId);
  return {
    id: BigInt(block.id),
    roomId: BigInt(block.roomId),
    roomName: room?.nama ?? "",
    roomCode: room?.kode ?? "",
    start: new Date(block.start),
    end: new Date(block.end),
    reason: block.reason,
    source: block.source,
    createdAt: new Date(block.createdAt),
  };
}

export async function listBlocks(store: MemoryStore): Promise<AdminBlock[]> {
  return store.read((state) =>
    state.blocks
      .filter((block) => new Date(block.end).getTime() >= Date.now())
      .sort((a, b) => {
        const diff = new Date(a.start).getTime() - new Date(b.start).getTime();
        return diff !== 0 ? diff : a.id - b.id;
      })
      .slice(0, 100)
      .map((block) => mapBlock(state, block)),
  );
}

export async function createBlock(
  store: MemoryStore,
  input: CreateBlockInput,
): Promise<{ block: AdminBlock; cancelled: number }> {
  const reason = validateReason(input.reason);
  const start = parseInstant(input.start, "start");
  const end = parseInstant(input.end, "end");
  if (end.getTime() <= start.getTime()) {
    throw validationError("Waktu selesai harus setelah waktu mulai", "end");
  }

  return store.transact((state) => {
    const room = state.rooms.find(
      (candidate) => candidate.id === Number(input.roomId),
    );
    if (room === undefined) {
      throw new DomainError("NOT_FOUND", "Ruang tidak ditemukan", 404);
    }
    if (!room.aktif) {
      throw new DomainError("ROOM_UNAVAILABLE", "Ruang sedang tidak aktif", 409);
    }

    const overlappingBlock = state.blocks.some(
      (block) =>
        block.roomId === room.id && overlaps(block.start, block.end, start, end),
    );
    if (overlappingBlock) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Blokir beririsan dengan blok lain pada ruang tersebut",
        409,
      );
    }

    const timestamp = new Date().toISOString();
    const block: RoomBlockRecord = {
      id: nextId(state, "blocks"),
      roomId: room.id,
      start: start.toISOString(),
      end: end.toISOString(),
      reason,
      source: "petugas",
      createdAt: timestamp,
    };
    state.blocks.push(block);

    const overlappingReservations = state.reservations.filter(
      (reservation) =>
        reservation.roomId === room.id &&
        ["menunggu", "disetujui"].includes(reservation.status) &&
        overlaps(reservation.start, reservation.end, start, end),
    );

    for (const reservation of overlappingReservations) {
      const from = reservation.status;
      reservation.status = "dibatalkan";
      reservation.updatedAt = timestamp;
      recordEvent(
        state,
        reservation.id,
        from,
        "dibatalkan",
        `Ruang diblokir: ${reason}`,
        null,
        timestamp,
      );
    }

    return {
      block: mapBlock(state, block),
      cancelled: overlappingReservations.length,
    };
  });
}

export async function listEvents(
  store: MemoryStore,
  limit = 50,
): Promise<AdminEvent[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  return store.read((state) => {
    const sorted: ReservationEventRecord[] = [...state.events].sort((a, b) => {
      const diff = new Date(b.waktu).getTime() - new Date(a.waktu).getTime();
      return diff !== 0 ? diff : b.id - a.id;
    });

    return sorted.slice(0, safeLimit).map((event) => {
      const reservation = state.reservations.find(
        (candidate) => candidate.id === event.reservationId,
      );
      const room = state.rooms.find(
        (candidate) => candidate.id === reservation?.roomId,
      );
      const actor = state.users.find(
        (candidate) => candidate.id === event.actorId,
      );

      return {
        id: BigInt(event.id),
        businessId: reservation?.businessId ?? "",
        roomName: room?.nama ?? "",
        from: event.from,
        to: event.to,
        reason: event.reason,
        actor:
          actor?.nama ??
          (event.to === "menunggu" ? "Pemohon" : "Petugas"),
        waktu: new Date(event.waktu),
      };
    });
  });
}
