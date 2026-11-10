import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listCalendar } from "../../src/application/calendar";
import { allocateSlot } from "../../src/application/allocate-slot";
import {
  approveReservation,
  cancelReservation,
  createBlock,
} from "../../src/application/admin-reservations";
import { createApp } from "../../src/http/app";
import { resetDb, seedRoom, startTestDb, type TestDb } from "../helpers/db";

const NOW = new Date("2026-10-19T01:00:00Z");
const wita = (local: string) => `${local}+08:00`;

let db: TestDb;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = await startTestDb();
  app = createApp({ pool: db.pool, now: () => NOW });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await db.stop();
});

beforeEach(async () => {
  await resetDb(db.pool);
});

async function seedPending(
  roomId: bigint,
  start: string,
  end: string,
  purpose = "rapat",
): Promise<bigint> {
  const result = await allocateSlot(db.pool, {
    roomId,
    pemohonNama: "Rina Kusuma",
    nim: "20260001",
    start,
    end,
    purpose,
    participants: 5,
    idempotencyKey: `calendar-${Math.random()}`,
    now: NOW,
  });
  return result.reservation.id;
}

describe("kalender publik", () => {
  it("mengembalikan reservasi aktif dan blokir sesuai rentang serta filter ruang", async () => {
    const roomA = await seedRoom(db.pool, {
      code: "CAL-A",
      name: "Ruang Kalender A",
      policy: "perlu_persetujuan",
    });
    const roomB = await seedRoom(db.pool, {
      code: "CAL-B",
      name: "Ruang Kalender B",
      policy: "perlu_persetujuan",
    });

    const approvedA = await seedPending(
      roomA,
      wita("2027-10-26T09:00:00"),
      wita("2027-10-26T10:00:00"),
    );
    await approveReservation(db.pool, approvedA);

    await seedPending(
      roomB,
      wita("2027-10-26T11:00:00"),
      wita("2027-10-26T12:00:00"),
      "belajar kelompok",
    );

    await createBlock(db.pool, {
      roomId: roomA,
      start: wita("2027-10-26T13:00:00"),
      end: wita("2027-10-26T14:00:00"),
      reason: "Perawatan ruang.",
    });

    const all = await listCalendar(db.pool, {
      from: new Date(wita("2027-10-26T00:00:00")),
      to: new Date(wita("2027-10-27T00:00:00")),
    });

    expect(all).toHaveLength(3);
    expect(all.map((event) => event.kind)).toEqual([
      "reservasi",
      "reservasi",
      "blokir",
    ]);
    expect(all.map((event) => event.status)).toEqual([
      "disetujui",
      "menunggu",
      "blokir",
    ]);

    const filtered = await listCalendar(db.pool, {
      from: new Date(wita("2027-10-26T00:00:00")),
      to: new Date(wita("2027-10-27T00:00:00")),
      roomId: roomB,
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.roomCode).toBe("CAL-B");
    expect(filtered[0]?.title).toBe("belajar kelompok");
  });

  it("tidak menampilkan reservasi yang dibatalkan atau ditolak", async () => {
    const room = await seedRoom(db.pool, { code: "CAL-C", name: "Ruang C" });
    const cancelled = await seedPending(
      room,
      wita("2027-10-26T09:00:00"),
      wita("2027-10-26T10:00:00"),
    );
    await cancelReservation(db.pool, cancelled, "Batal.");

    const events = await listCalendar(db.pool, {
      from: new Date(wita("2027-10-26T00:00:00")),
      to: new Date(wita("2027-10-27T00:00:00")),
    });

    expect(events).toHaveLength(0);
  });

  it("menyajikan data kalender lewat HTTP tanpa nama atau NIM pemohon", async () => {
    const room = await seedRoom(db.pool, { code: "CAL-D", name: "Ruang D" });
    await seedPending(
      room,
      wita("2027-10-26T09:00:00"),
      wita("2027-10-26T10:00:00"),
    );

    const response = await app.inject({
      method: "GET",
      url: `/calendar?from=${encodeURIComponent(wita("2027-10-26T00:00:00"))}&to=${encodeURIComponent(wita("2027-10-27T00:00:00"))}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Record<string, unknown>[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.roomCode).toBe("CAL-D");
    expect(JSON.stringify(body)).not.toContain("Rina");
    expect(JSON.stringify(body)).not.toContain("20260001");
  });

  it("menolak rentang waktu yang tidak valid lewat HTTP", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/calendar?from=${encodeURIComponent(wita("2027-10-26T10:00:00"))}&to=${encodeURIComponent(wita("2027-10-26T10:00:00"))}`,
    });

    expect(response.statusCode).toBe(422);
  });
});
