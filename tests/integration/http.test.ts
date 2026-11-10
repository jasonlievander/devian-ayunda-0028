import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/http/app";
import {
  resetDb,
  seedRoom,
  seedUser,
  startTestDb,
  type TestDb,
} from "../helpers/db";

const wita = (local: string) => `${local}+08:00`;

let db: TestDb;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = await startTestDb();
  app = createApp({
    pool: db.pool,
    now: () => new Date("2026-10-19T01:00:00Z"),
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await db.stop();
});

beforeEach(async () => {
  await resetDb(db.pool);
});

function payload(roomId: bigint, overrides: Record<string, unknown> = {}) {
  return {
    roomId: roomId.toString(),
    start: wita("2026-10-19T10:30:00"),
    end: wita("2026-10-19T11:30:00"),
    purpose: "belajar kelompok",
    participants: 5,
    ...overrides,
  };
}

describe("POST /reservations", () => {
  it("mengembalikan 201 untuk pengajuan yang berhasil", async () => {
    const user = await seedUser(db.pool);
    const room = await seedRoom(db.pool);

    const response = await app.inject({
      method: "POST",
      url: "/reservations",
      headers: {
        "x-user-id": user.toString(),
        "idempotency-key": "http-1",
      },
      payload: payload(room),
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.status).toBe("disetujui");
    expect(body.data.businessId).toMatch(/^RSV-20261019-\d{4,}$/);
    expect(body.replayed).toBe(false);
  });

  it("mengembalikan 200 replay untuk kunci idempoten yang sama", async () => {
    const user = await seedUser(db.pool);
    const room = await seedRoom(db.pool);
    const headers = {
      "x-user-id": user.toString(),
      "idempotency-key": "http-replay",
    };

    const first = await app.inject({
      method: "POST",
      url: "/reservations",
      headers,
      payload: payload(room),
    });
    const second = await app.inject({
      method: "POST",
      url: "/reservations",
      headers,
      payload: payload(room),
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().data.id).toBe(first.json().data.id);
    expect(second.json().replayed).toBe(true);
  });

  it("menerima nama dan NIM yang diketik pengguna", async () => {
    const room = await seedRoom(db.pool);

    const response = await app.inject({
      method: "POST",
      url: "/reservations",
      headers: { "idempotency-key": "http-name-nim" },
      payload: payload(room, {
        pemohonNama: "Rina Kusuma",
        nim: "20260001",
      }),
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.pemohonNama).toBe("Rina Kusuma");
    expect(body.data.nim).toBe("20260001");

    const user = await db.pool.query(
      "SELECT nama, nim FROM users WHERE nim = $1",
      ["20260001"],
    );
    expect(user.rows[0]).toMatchObject({ nama: "Rina Kusuma", nim: "20260001" });
  });

  it("menolak NIM yang bukan angka", async () => {
    const room = await seedRoom(db.pool);

    const response = await app.inject({
      method: "POST",
      url: "/reservations",
      headers: { "idempotency-key": "http-bad-nim" },
      payload: payload(room, {
        pemohonNama: "Rina Kusuma",
        nim: "NIM-2026",
      }),
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    expect(response.json().error.field).toBe("nim");
  });

  it("mengembalikan 409 saat slot sudah dipakai", async () => {
    const userA = await seedUser(db.pool);
    const userB = await seedUser(db.pool);
    const room = await seedRoom(db.pool);

    const first = await app.inject({
      method: "POST",
      url: "/reservations",
      headers: { "x-user-id": userA.toString(), "idempotency-key": "http-a" },
      payload: payload(room),
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/reservations",
      headers: { "x-user-id": userB.toString(), "idempotency-key": "http-b" },
      payload: payload(room),
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe("SLOT_CONFLICT");
    expect(second.json().error).not.toHaveProperty("stack");
  });

  it("mengembalikan 422 untuk peserta melebihi kapasitas", async () => {
    const user = await seedUser(db.pool);
    const room = await seedRoom(db.pool, { capacity: 4 });

    const response = await app.inject({
      method: "POST",
      url: "/reservations",
      headers: { "x-user-id": user.toString(), "idempotency-key": "http-c" },
      payload: payload(room, { participants: 5 }),
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    expect(response.json().error.field).toBe("peserta");
  });

  it("mengembalikan 422 bila header idempotency-key tidak ada", async () => {
    const user = await seedUser(db.pool);
    const room = await seedRoom(db.pool);

    const response = await app.inject({
      method: "POST",
      url: "/reservations",
      headers: { "x-user-id": user.toString() },
      payload: payload(room),
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("mengembalikan 422 bila body tidak lengkap", async () => {
    const user = await seedUser(db.pool);

    const response = await app.inject({
      method: "POST",
      url: "/reservations",
      headers: { "x-user-id": user.toString(), "idempotency-key": "http-d" },
      payload: { roomId: "1" },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /health", () => {
  it("mengembalikan status ok", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
