import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  approveReservation,
  cancelReservation,
  createBlock,
  getStats,
  listAdminRooms,
  listBlocks,
  listEvents,
  listReservations,
} from "../../src/application/admin-reservations";
import { allocateSlot } from "../../src/application/allocate-slot";
import { config } from "../../src/config";
import { createApp } from "../../src/http/app";
import { resetDb, seedRoom, startTestDb, type TestDb } from "../helpers/db";

const NOW = new Date("2026-10-19T01:00:00Z");
const wita = (local: string) => `${local}+08:00`;

let db: TestDb;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = await startTestDb();
  app = createApp({ store: db.store, now: () => NOW });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await db.stop();
});

beforeEach(async () => {
  await resetDb(db.store);
});

async function seedPending(
  roomId: bigint,
  start: string,
  end: string,
  options: { nama?: string; nim?: string; key?: string } = {},
): Promise<bigint> {
  const result = await allocateSlot(db.store, {
    roomId,
    pemohonNama: options.nama ?? "Rina Kusuma",
    nim: options.nim ?? "20260001",
    start,
    end,
    purpose: "rapat",
    participants: 5,
    idempotencyKey: options.key ?? `extra-${Math.random()}`,
    now: NOW,
  });
  return result.reservation.id;
}

describe("admin extras", () => {
  it("menghitung statistik antrean dan ruang", async () => {
    const room = await seedRoom(db.store, { policy: "perlu_persetujuan" });
    await seedPending(room, wita("2026-10-26T09:00:00"), wita("2026-10-26T10:00:00"));

    const stats = await getStats(db.store);

    expect(stats.pending).toBe(1);
    expect(stats.totalRooms).toBe(1);
  });

  it("mencari pengajuan berdasarkan nama/NIM dan tanggal", async () => {
    const room = await seedRoom(db.store, { policy: "perlu_persetujuan" });
    await seedPending(room, wita("2026-10-26T09:00:00"), wita("2026-10-26T10:00:00"), {
      nama: "Rina Kusuma",
      nim: "20260001",
    });

    const byName = await listReservations(db.store, "menunggu", {
      query: "Rina",
    });
    const byNim = await listReservations(db.store, "menunggu", {
      query: "20260001",
    });
    const byDate = await listReservations(db.store, "menunggu", {
      date: "2026-10-26",
    });
    const empty = await listReservations(db.store, "menunggu", {
      query: "Tidak Ada",
    });

    expect(byName).toHaveLength(1);
    expect(byNim).toHaveLength(1);
    expect(byDate).toHaveLength(1);
    expect(empty).toHaveLength(0);
  });

  it("membatalkan reservasi disetujui dan mencatat alasan", async () => {
    const room = await seedRoom(db.store, { policy: "perlu_persetujuan" });
    const id = await seedPending(
      room,
      wita("2026-10-26T09:00:00"),
      wita("2026-10-26T10:00:00"),
    );
    await approveReservation(db.store, id);

    const cancelled = await cancelReservation(
      db.store,
      id,
      "Kebutuhan akademik mendadak.",
    );

    expect(cancelled.status).toBe("dibatalkan");
    expect(cancelled.reason).toBe("Kebutuhan akademik mendadak.");

    const list = await listReservations(db.store, "dibatalkan");
    expect(list).toHaveLength(1);
  });

  it("membuat blokir dan membatalkan reservasi yang beririsan", async () => {
    const room = await seedRoom(db.store, { policy: "perlu_persetujuan" });
    const first = await seedPending(
      room,
      wita("2099-10-26T09:00:00"),
      wita("2099-10-26T10:00:00"),
    );
    await approveReservation(db.store, first);
    const second = await seedPending(
      room,
      wita("2099-10-26T10:00:00"),
      wita("2099-10-26T11:00:00"),
    );

    const result = await createBlock(db.store, {
      roomId: room,
      start: wita("2099-10-26T08:30:00"),
      end: wita("2099-10-26T11:30:00"),
      reason: "Perawatan ruang.",
    });

    expect(result.cancelled).toBe(2);

    const cancelled = await listReservations(db.store, "dibatalkan");
    expect(cancelled).toHaveLength(2);

    const blocks = await listBlocks(db.store);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.reason).toBe("Perawatan ruang.");

    const events = await listEvents(db.store);
    expect(
      events.some(
        (event) =>
          event.reason === "Ruang diblokir: Perawatan ruang." &&
          event.to === "dibatalkan",
      ),
    ).toBe(true);
  });

  it("menolak blokir yang beririsan dengan blokir lain", async () => {
    const room = await seedRoom(db.store);
    await createBlock(db.store, {
      roomId: room,
      start: wita("2026-10-26T08:00:00"),
      end: wita("2026-10-26T10:00:00"),
      reason: "Ujian.",
    });

    await expect(
      createBlock(db.store, {
        roomId: room,
        start: wita("2026-10-26T09:00:00"),
        end: wita("2026-10-26T11:00:00"),
        reason: "Perawatan.",
      }),
    ).rejects.toMatchObject({ code: "SLOT_CONFLICT" });
  });

  it("menampilkan daftar ruang dan audit", async () => {
    const room = await seedRoom(db.store, {
      code: "A.1.2",
      name: "A.1.2 (LECT 1A)",
      policy: "perlu_persetujuan",
    });
    await seedPending(room, wita("2026-10-26T09:00:00"), wita("2026-10-26T10:00:00"));

    const rooms = await listAdminRooms(db.store);
    const events = await listEvents(db.store);

    expect(rooms[0]).toMatchObject({ code: "A.1.2", name: "A.1.2 (LECT 1A)" });
    expect(events[0]?.to).toBe("menunggu");
  });
});

describe("admin extras HTTP", () => {
  const headers = { "x-admin-code": config.adminCode };

  it("melayani statistik, ruang, blokir, dan audit", async () => {
    const room = await seedRoom(db.store, { policy: "perlu_persetujuan" });
    await seedPending(room, wita("2099-10-26T09:00:00"), wita("2099-10-26T10:00:00"));

    const stats = await app.inject({
      method: "GET",
      url: "/admin/stats",
      headers,
    });
    expect(stats.statusCode).toBe(200);
    expect(stats.json().data.pending).toBe(1);

    const rooms = await app.inject({
      method: "GET",
      url: "/admin/rooms",
      headers,
    });
    expect(rooms.statusCode).toBe(200);
    expect(rooms.json().data).toHaveLength(1);

    const block = await app.inject({
      method: "POST",
      url: "/admin/blocks",
      headers,
      payload: {
        roomId: room.toString(),
        start: wita("2099-10-26T08:30:00"),
        end: wita("2099-10-26T10:30:00"),
        reason: "Ruang dirawat.",
      },
    });
    expect(block.statusCode).toBe(201);
    expect(block.json().cancelled).toBe(1);

    const blocks = await app.inject({
      method: "GET",
      url: "/admin/blocks",
      headers,
    });
    expect(blocks.statusCode).toBe(200);
    expect(blocks.json().data).toHaveLength(1);

    const events = await app.inject({
      method: "GET",
      url: "/admin/events",
      headers,
    });
    expect(events.statusCode).toBe(200);
    expect(events.json().data.length).toBeGreaterThan(0);
  });

  it("membatalkan reservasi lewat HTTP", async () => {
    const room = await seedRoom(db.store, { policy: "perlu_persetujuan" });
    const id = await seedPending(
      room,
      wita("2026-10-26T09:00:00"),
      wita("2026-10-26T10:00:00"),
    );

    const response = await app.inject({
      method: "POST",
      url: `/admin/reservations/${id}/cancel`,
      headers,
      payload: { reason: "Kelas pengganti." },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe("dibatalkan");
  });

  it("menolak statistik tanpa kode admin", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin/stats",
    });
    expect(response.statusCode).toBe(401);
  });
});
