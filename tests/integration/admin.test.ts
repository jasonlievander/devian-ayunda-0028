import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  approveReservation,
  listReservations,
  rejectReservation,
} from "../../src/application/admin-reservations";
import { allocateSlot } from "../../src/application/allocate-slot";
import { config } from "../../src/config";
import { DomainError } from "../../src/domain/errors";
import { createApp } from "../../src/http/app";
import {
  resetDb,
  seedBlock,
  seedRoom,
  seedUser,
  startTestDb,
  type TestDb,
} from "../helpers/db";

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

async function createPending(
  roomId: bigint,
  overrides: {
    nama?: string;
    nim?: string;
    start?: string;
    end?: string;
    key?: string;
  } = {},
): Promise<bigint> {
  const result = await allocateSlot(db.pool, {
    roomId,
    pemohonNama: overrides.nama ?? "Rina Kusuma",
    nim: overrides.nim ?? "20260001",
    start: overrides.start ?? wita("2026-10-20T09:00:00"),
    end: overrides.end ?? wita("2026-10-20T10:00:00"),
    purpose: "rapat",
    participants: 5,
    idempotencyKey: overrides.key ?? `admin-${Math.random()}`,
    now: NOW,
  });
  return result.reservation.id;
}

describe("admin reservations", () => {
  it("menampilkan pengajuan menunggu beserta pemohon dan ruang", async () => {
    const room = await seedRoom(db.pool, {
      code: "A.1.2",
      name: "A.1.2 (LECT 1A)",
      type: "kelas",
      capacity: 20,
      policy: "perlu_persetujuan",
    });
    await createPending(room, {
      nama: "Rina Kusuma",
      nim: "20260001",
    });

    const pending = await listReservations(db.pool, "menunggu");

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      roomName: "A.1.2 (LECT 1A)",
      pemohonNama: "Rina Kusuma",
      nim: "20260001",
      status: "menunggu",
    });
  });

  it("menyetujui pengajuan dan mencatat audit", async () => {
    const room = await seedRoom(db.pool, { policy: "perlu_persetujuan" });
    const id = await createPending(room);

    const approved = await approveReservation(db.pool, id);

    expect(approved.status).toBe("disetujui");

    const approvedList = await listReservations(db.pool, "disetujui");
    expect(approvedList).toHaveLength(1);

    const event = await db.pool.query(
      "SELECT dari, ke, alasan FROM reservation_events WHERE reservation_id = $1 ORDER BY id DESC LIMIT 1",
      [id.toString()],
    );
    expect(event.rows[0]).toMatchObject({
      dari: "menunggu",
      ke: "disetujui",
    });
  });

  it("menolak pengajuan dengan alasan wajib", async () => {
    const room = await seedRoom(db.pool, { policy: "perlu_persetujuan" });
    const id = await createPending(room);

    const rejected = await rejectReservation(
      db.pool,
      id,
      "Ruang dipakai untuk ujian.",
    );

    expect(rejected.status).toBe("ditolak");
    expect(rejected.reason).toBe("Ruang dipakai untuk ujian.");

    const rejectedList = await listReservations(db.pool, "ditolak");
    expect(rejectedList[0]?.reason).toBe("Ruang dipakai untuk ujian.");
  });

  it("menolak penolakan tanpa alasan", async () => {
    const room = await seedRoom(db.pool, { policy: "perlu_persetujuan" });
    const id = await createPending(room);

    await expect(rejectReservation(db.pool, id, "   ")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("menolak persetujuan kedua untuk pengajuan yang sudah diproses", async () => {
    const room = await seedRoom(db.pool, { policy: "perlu_persetujuan" });
    const id = await createPending(room);

    await approveReservation(db.pool, id);

    await expect(approveReservation(db.pool, id)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
  });

  it("menolak persetujuan bila ruang diblokir setelah pengajuan", async () => {
    const room = await seedRoom(db.pool, { policy: "perlu_persetujuan" });
    const id = await createPending(room);
    await seedBlock(
      db.pool,
      room,
      wita("2026-10-20T09:00:00"),
      wita("2026-10-20T11:00:00"),
    );

    await expect(approveReservation(db.pool, id)).rejects.toMatchObject({
      code: "SLOT_CONFLICT",
    });
  });
});

describe("admin HTTP", () => {
  it("mengarahkan /admin ke panel dalam satu halaman", async () => {
    const response = await app.inject({ method: "GET", url: "/admin" });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/#admin");
  });


  it("menolak akses tanpa kode admin", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin/reservations",
    });

    expect(response.statusCode).toBe(401);
  });

  it("menampilkan antrean dengan kode admin", async () => {
    const room = await seedRoom(db.pool, { policy: "perlu_persetujuan" });
    await createPending(room);

    const response = await app.inject({
      method: "GET",
      url: "/admin/reservations?status=menunggu",
      headers: { "x-admin-code": config.adminCode },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(1);
    expect(response.json().data[0].pemohonNama).toBe("Rina Kusuma");
  });

  it("menyetujui lewat HTTP", async () => {
    const room = await seedRoom(db.pool, { policy: "perlu_persetujuan" });
    const id = await createPending(room);

    const response = await app.inject({
      method: "POST",
      url: `/admin/reservations/${id}/approve`,
      headers: { "x-admin-code": config.adminCode },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe("disetujui");
  });

  it("menolak lewat HTTP dengan alasan", async () => {
    const room = await seedRoom(db.pool, { policy: "perlu_persetujuan" });
    const id = await createPending(room);

    const response = await app.inject({
      method: "POST",
      url: `/admin/reservations/${id}/reject`,
      headers: { "x-admin-code": config.adminCode },
      payload: { reason: "Jadwal bentrok dengan kelas." },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe("ditolak");
    expect(response.json().data.reason).toBe("Jadwal bentrok dengan kelas.");
  });

  it("menolak kode admin yang salah", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin/reservations",
      headers: { "x-admin-code": "salah" },
    });

    expect(response.statusCode).toBe(401);
  });
});
