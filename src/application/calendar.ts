import { validationError } from "../domain/errors";
import {
  ACTIVE_STATUSES,
  overlaps,
  type MemoryStore,
} from "../infrastructure/memory-store";

export type CalendarEventKind = "reservasi" | "blokir";
export type CalendarEventStatus =
  | "menunggu"
  | "disetujui"
  | "berlangsung"
  | "blokir";

export interface CalendarEvent {
  kind: CalendarEventKind;
  id: bigint;
  roomId: bigint;
  roomCode: string;
  roomName: string;
  start: Date;
  end: Date;
  title: string;
  status: CalendarEventStatus;
}

export interface CalendarQuery {
  from: Date;
  to: Date;
  roomId?: bigint;
}

const MAX_RANGE_MS = 92 * 24 * 60 * 60 * 1000;

export async function listCalendar(
  store: MemoryStore,
  query: CalendarQuery,
): Promise<CalendarEvent[]> {
  const from = query.from.getTime();
  const to = query.to.getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    throw validationError(
      "Rentang kalender harus memiliki waktu selesai setelah waktu mulai",
      "to",
    );
  }
  if (to - from > MAX_RANGE_MS) {
    throw validationError("Rentang kalender maksimal 92 hari", "to");
  }

  return store.read((state) => {
    const roomFilter =
      query.roomId === undefined ? undefined : Number(query.roomId);

    const reservations: CalendarEvent[] = state.reservations
      .filter((reservation) => {
        if (!ACTIVE_STATUSES.includes(reservation.status)) {
          return false;
        }
        if (
          roomFilter !== undefined &&
          reservation.roomId !== roomFilter
        ) {
          return false;
        }
        const room = state.rooms.find(
          (candidate) => candidate.id === reservation.roomId,
        );
        if (room === undefined || !room.aktif) {
          return false;
        }
        return overlaps(reservation.start, reservation.end, from, to);
      })
      .map((reservation) => {
        const room = state.rooms.find(
          (candidate) => candidate.id === reservation.roomId,
        )!;
        return {
          kind: "reservasi" as const,
          id: BigInt(reservation.id),
          roomId: BigInt(reservation.roomId),
          roomCode: room.kode,
          roomName: room.nama,
          start: new Date(reservation.start),
          end: new Date(reservation.end),
          title: reservation.purpose,
          status: reservation.status as CalendarEventStatus,
        };
      });

    const blocks: CalendarEvent[] = state.blocks
      .filter((block) => {
        if (roomFilter !== undefined && block.roomId !== roomFilter) {
          return false;
        }
        const room = state.rooms.find(
          (candidate) => candidate.id === block.roomId,
        );
        if (room === undefined || !room.aktif) {
          return false;
        }
        return overlaps(block.start, block.end, from, to);
      })
      .map((block) => {
        const room = state.rooms.find(
          (candidate) => candidate.id === block.roomId,
        )!;
        return {
          kind: "blokir" as const,
          id: BigInt(block.id),
          roomId: BigInt(block.roomId),
          roomCode: room.kode,
          roomName: room.nama,
          start: new Date(block.start),
          end: new Date(block.end),
          title: "Ruang diblokir",
          status: "blokir" as const,
        };
      });

    return [...reservations, ...blocks].sort((a, b) => {
      const diff = a.start.getTime() - b.start.getTime();
      if (diff !== 0) return diff;
      if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
      return Number(a.id - b.id);
    });
  });
}
