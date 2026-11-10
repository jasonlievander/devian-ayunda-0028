import type {
  ReservationRecord,
  StoreState,
  UserRecord,
} from "./memory-store";
import { DEFAULT_ROOMS } from "./seed-rooms";

export { DEFAULT_ROOMS };

export const DEMO_ADMIN = {
  email: "admin@idbbali.ac.id",
  password: "idbbali",
};

export const DEMO_STUDENT = {
  email: "mahasiswa@idbbali.ac.id",
  password: "123456",
  nim: "123456",
};

function witaDateKey(offsetDays: number): string {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000 + offsetDays * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

function witaInstant(dateKey: string, time: string): string {
  return new Date(`${dateKey}T${time}+08:00`).toISOString();
}

function addId(state: StoreState, key: string): number {
  const value = (state.nextId[key] ?? 0) + 1;
  state.nextId[key] = value;
  return value;
}

function bumpDailySeq(state: StoreState, dateKey: string): number {
  const value = (state.dailySeq[dateKey] ?? 0) + 1;
  state.dailySeq[dateKey] = value;
  return value;
}

interface SeedReservation {
  roomIndex: number;
  userId: number;
  dayOffset: number;
  start: string;
  end: string;
  purpose: string;
  participants: number;
  status: ReservationRecord["status"];
}

export function seedDemoState(state: StoreState): void {
  const users: UserRecord[] = [
    {
      id: addId(state, "users"),
      nama: "Petugas Sarana Prasarana",
      email: DEMO_ADMIN.email,
      peran: "admin",
      status: "aktif",
      nim: null,
      password: DEMO_ADMIN.password,
    },
    {
      id: addId(state, "users"),
      nama: "Mahasiswa Demo",
      email: DEMO_STUDENT.email,
      peran: "mahasiswa",
      status: "aktif",
      nim: DEMO_STUDENT.nim,
      password: DEMO_STUDENT.password,
    },
  ];
  state.users.push(...users);

  for (const seed of DEFAULT_ROOMS) {
    state.rooms.push({
      id: addId(state, "rooms"),
      kode: seed.kode,
      nama: seed.nama,
      tipe: seed.tipe,
      kapasitas: seed.kapasitas,
      kebijakan: seed.kebijakan,
      aktif: true,
      allowedRoles: [],
    });
  }

  const student = users[1]!;
  const timestamp = new Date().toISOString();
  const seeds: SeedReservation[] = [
    {
      roomIndex: 10,
      userId: student.id,
      dayOffset: 0,
      start: "09:00",
      end: "10:00",
      purpose: "diskusi proyek mata kuliah",
      participants: 6,
      status: "menunggu",
    },
    {
      roomIndex: 0,
      userId: student.id,
      dayOffset: 0,
      start: "13:00",
      end: "15:00",
      purpose: "praktik studio pola",
      participants: 20,
      status: "disetujui",
    },
    {
      roomIndex: 18,
      userId: student.id,
      dayOffset: 1,
      start: "10:00",
      end: "12:00",
      purpose: "seminar desain",
      participants: 120,
      status: "disetujui",
    },
    {
      roomIndex: 29,
      userId: student.id,
      dayOffset: 1,
      start: "15:00",
      end: "16:00",
      purpose: "workshop figma",
      participants: 30,
      status: "menunggu",
    },
  ];

  for (const seed of seeds) {
    const room = state.rooms[seed.roomIndex]!;
    const dateKey = witaDateKey(seed.dayOffset);
    const sequence = bumpDailySeq(state, dateKey);
    const reservation: ReservationRecord = {
      id: addId(state, "reservations"),
      businessId: `RSV-${dateKey.replaceAll("-", "")}-${String(sequence).padStart(4, "0")}`,
      roomId: room.id,
      userId: seed.userId,
      orgId: null,
      start: witaInstant(dateKey, seed.start),
      end: witaInstant(dateKey, seed.end),
      purpose: seed.purpose,
      participants: seed.participants,
      status: seed.status,
      idempotencyKey: `seed-${seed.roomIndex}-${seed.dayOffset}-${seed.start}`,
      requestHash: "seed",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    state.reservations.push(reservation);
    state.events.push({
      id: addId(state, "events"),
      reservationId: reservation.id,
      from: null,
      to: seed.status,
      actorId: seed.userId,
      reason: null,
      waktu: timestamp,
    });
  }

  const blockDate = witaDateKey(1);
  state.blocks.push({
    id: addId(state, "blocks"),
    roomId: state.rooms[11]!.id,
    start: witaInstant(blockDate, "08:30"),
    end: witaInstant(blockDate, "10:00"),
    reason: "Jadwal kuliah rutin",
    source: "kuliah",
    createdAt: timestamp,
  });
}
