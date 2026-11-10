import { DomainError } from "../domain/errors";
import type { RoomPolicy } from "../domain/policy";
import { seedDemoState, DEFAULT_ROOMS } from "./demo-seed";

export type StoredStatus =
  | "menunggu"
  | "disetujui"
  | "berlangsung"
  | "selesai"
  | "ditolak"
  | "dibatalkan"
  | "kedaluwarsa"
  | "tidak_hadir";

export interface UserRecord {
  id: number;
  nama: string;
  email: string;
  peran: string;
  status: string;
  nim: string | null;
  password?: string;
}

export interface RoomRecord {
  id: number;
  kode: string;
  nama: string;
  tipe: string;
  kapasitas: number | null;
  kebijakan: RoomPolicy;
  aktif: boolean;
  allowedRoles: string[];
}

export interface OrganizationRecord {
  id: number;
  nama: string;
  jenis: string;
}

export interface OrgMemberRecord {
  id: number;
  userId: number;
  orgId: number;
  jabatan: string;
  periode: string;
}

export interface ReservationRecord {
  id: number;
  businessId: string;
  roomId: number;
  userId: number;
  orgId: number | null;
  start: string;
  end: string;
  purpose: string;
  participants: number;
  status: StoredStatus;
  idempotencyKey: string;
  requestHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationEventRecord {
  id: number;
  reservationId: number;
  from: StoredStatus | null;
  to: StoredStatus;
  actorId: number | null;
  reason: string | null;
  waktu: string;
}

export interface RoomBlockRecord {
  id: number;
  roomId: number;
  start: string;
  end: string;
  reason: string;
  source: string;
  createdAt: string;
}

export interface StoreState {
  nextId: Record<string, number>;
  dailySeq: Record<string, number>;
  users: UserRecord[];
  rooms: RoomRecord[];
  organizations: OrganizationRecord[];
  orgMembers: OrgMemberRecord[];
  reservations: ReservationRecord[];
  events: ReservationEventRecord[];
  blocks: RoomBlockRecord[];
}

export interface MemoryStoreOptions {
  seed?: boolean;
}

const ACTIVE_STATUSES: readonly StoredStatus[] = [
  "menunggu",
  "disetujui",
  "berlangsung",
];

export function emptyState(): StoreState {
  return {
    nextId: {},
    dailySeq: {},
    users: [],
    rooms: [],
    organizations: [],
    orgMembers: [],
    reservations: [],
    events: [],
    blocks: [],
  };
}

function overlaps(
  aStart: string | Date | number,
  aEnd: string | Date | number,
  bStart: string | Date | number,
  bEnd: string | Date | number,
): boolean {
  const toMs = (value: string | Date | number): number =>
    typeof value === "number" ? value : new Date(value).getTime();
  const a0 = toMs(aStart);
  const a1 = toMs(aEnd);
  const b0 = toMs(bStart);
  const b1 = toMs(bEnd);
  return a0 < b1 && b0 < a1;
}

function nextId(state: StoreState, key: string): number {
  const value = (state.nextId[key] ?? 0) + 1;
  state.nextId[key] = value;
  return value;
}

export class MemoryStore {
  private constructor(private state: StoreState) {}

  private queue: Promise<void> = Promise.resolve();

  static async open(options: MemoryStoreOptions = {}): Promise<MemoryStore> {
    const state = emptyState();
    if (options.seed === true) {
      seedDemoState(state);
    }
    return new MemoryStore(state);
  }

  async read<T>(reader: (state: StoreState) => T): Promise<T> {
    await this.queue;
    return reader(this.state);
  }

  async transact<T>(
    mutator: (state: StoreState) => T | Promise<T>,
  ): Promise<T> {
    const task = this.queue.then(async () => {
      const draft = structuredClone(this.state);
      const result = await mutator(draft);
      this.validate(draft);
      this.state = draft;
      return result;
    });

    this.queue = task.then(
      () => undefined,
      () => undefined,
    );

    return task;
  }

  async reset(): Promise<void> {
    await this.transact((state) => {
      Object.assign(state, emptyState());
    });
  }

  async seedRooms(): Promise<void> {
    await this.transact((state) => {
      for (const seed of DEFAULT_ROOMS) {
        const existing = state.rooms.find((room) => room.kode === seed.kode);
        if (existing !== undefined) {
          continue;
        }
        state.rooms.push({
          id: nextId(state, "rooms"),
          kode: seed.kode,
          nama: seed.nama,
          tipe: seed.tipe,
          kapasitas: seed.kapasitas,
          kebijakan: seed.kebijakan,
          aktif: true,
          allowedRoles: [],
        });
      }
    });
  }

  private validate(state: StoreState): void {
    const active = state.reservations.filter((reservation) =>
      ACTIVE_STATUSES.includes(reservation.status),
    );

    for (let i = 0; i < active.length; i += 1) {
      const current = active[i]!;
      for (let j = i + 1; j < active.length; j += 1) {
        const other = active[j]!;
        if (
          current.roomId === other.roomId &&
          overlaps(current.start, current.end, other.start, other.end)
        ) {
          throw new DomainError(
            "SLOT_CONFLICT",
            "Slot ini beririsan dengan reservasi aktif lain pada ruang yang sama",
            409,
            "mulai",
          );
        }
      }
    }

    const idempotency = new Set<string>();
    for (const reservation of state.reservations) {
      const key = `${reservation.userId}:${reservation.idempotencyKey}`;
      if (idempotency.has(key)) {
        throw new DomainError(
          "IDEMPOTENCY_MISMATCH",
          "Kunci idempoten sudah dipakai untuk pengajuan yang berbeda",
          409,
          "idempotencyKey",
        );
      }
      idempotency.add(key);
    }

    for (let i = 0; i < state.blocks.length; i += 1) {
      const current = state.blocks[i]!;
      for (let j = i + 1; j < state.blocks.length; j += 1) {
        const other = state.blocks[j]!;
        if (
          current.roomId === other.roomId &&
          overlaps(current.start, current.end, other.start, other.end)
        ) {
          throw new DomainError(
            "SLOT_CONFLICT",
            "Blokir beririsan dengan blok lain pada ruang tersebut",
            409,
          );
        }
      }
    }
  }
}

export { nextId, overlaps, ACTIVE_STATUSES };
