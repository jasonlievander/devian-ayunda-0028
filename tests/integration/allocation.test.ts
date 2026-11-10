import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { allocateSlot } from "../../src/application/allocate-slot";
import { DomainError } from "../../src/domain/errors";
import {
  addOrgMember,
  countReservations,
  insertReservationDirect,
  listReservationEvents,
  resetDb,
  seedBlock,
  seedOrganization,
  seedRoom,
  seedUser,
  startTestDb,
  type TestDb,
} from "../helpers/db";

const NOW = new Date("2026-10-19T01:00:00Z");
const wita = (local: string) => `${local}+08:00`;

let db: TestDb;

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await db.stop();
});

beforeEach(async () => {
  await resetDb(db.store);
});

async function expectDomainError(
  promise: Promise<unknown>,
  code: string,
): Promise<DomainError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return error as DomainError;
  }
  throw new Error(`Diharapkan DomainError ${code}, tetapi berhasil`);
}

function command(overrides: {
  userId: bigint;
  roomId: bigint;
  start: string;
  end: string;
  purpose?: string;
  participants?: number;
  idempotencyKey?: string;
  orgId?: bigint | null;
  specialApproval?: boolean;
}) {
  return {
    userId: overrides.userId,
    roomId: overrides.roomId,
    start: overrides.start,
    end: overrides.end,
    purpose: overrides.purpose ?? "belajar kelompok",
    participants: overrides.participants ?? 5,
    idempotencyKey: overrides.idempotencyKey ?? `key-${Math.random()}`,
    orgId: overrides.orgId ?? null,
    specialApproval: overrides.specialApproval ?? false,
    now: NOW,
  };
}

describe("alokasi slot", () => {
  it("membuat reservasi disetujui untuk ruang terbuka", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store, { capacity: 10, policy: "terbuka" });

    const result = await allocateSlot(
      db.store,
      command({
        userId: user,
        roomId: room,
        start: wita("2026-10-19T10:30:00"),
        end: wita("2026-10-19T11:30:00"),
        participants: 10,
      }),
    );

    expect(result.replayed).toBe(false);
    expect(result.reservation.status).toBe("disetujui");
    expect(result.reservation.businessId).toMatch(/^RSV-20261019-\d{4,}$/);

    const count = await countReservations(db.store);
    expect(count).toBe(1);

    const event = await listReservationEvents(db.store, result.reservation.id);
    expect(event[0]).toMatchObject({ from: null, to: "disetujui" });
  });

  it("menerima peserta bila kapasitas ruang belum dipublikasikan", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store, {
      capacity: null,
      type: "lab",
      policy: "perlu_persetujuan",
    });

    const result = await allocateSlot(
      db.store,
      command({
        userId: user,
        roomId: room,
        start: wita("2026-10-20T09:00:00"),
        end: wita("2026-10-20T10:00:00"),
        participants: 120,
      }),
    );

    expect(result.reservation.status).toBe("menunggu");
    expect(result.reservation.participants).toBe(120);
  });

  it("menolak peserta melebihi kapasitas (BR-03)", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store, { capacity: 10 });

    await expectDomainError(
      allocateSlot(
        db.store,
        command({
          userId: user,
          roomId: room,
          start: wita("2026-10-19T10:30:00"),
          end: wita("2026-10-19T11:30:00"),
          participants: 11,
        }),
      ),
      "VALIDATION_ERROR",
    );
  });

  it("menolak durasi yang bukan kelipatan 30 menit (BR-01)", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store);

    await expectDomainError(
      allocateSlot(
        db.store,
        command({
          userId: user,
          roomId: room,
          start: wita("2026-10-19T10:30:00"),
          end: wita("2026-10-19T11:15:00"),
        }),
      ),
      "VALIDATION_ERROR",
    );
  });

  it("menahan slot untuk ruang yang perlu persetujuan", async () => {
    const userA = await seedUser(db.store);
    const userB = await seedUser(db.store);
    const room = await seedRoom(db.store, { policy: "perlu_persetujuan" });
    const start = wita("2026-10-20T09:00:00");
    const end = wita("2026-10-20T10:00:00");

    const result = await allocateSlot(
      db.store,
      command({ userId: userA, roomId: room, start, end }),
    );
    expect(result.reservation.status).toBe("menunggu");

    await expectDomainError(
      allocateSlot(
        db.store,
        command({ userId: userB, roomId: room, start, end }),
      ),
      "SLOT_CONFLICT",
    );

    const count = await countReservations(db.store);
    expect(count).toBe(1);
  });

  it("mengizinkan slot berdampingan pada interval half-open", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store);

    const first = await allocateSlot(
      db.store,
      command({
        userId: user,
        roomId: room,
        start: wita("2026-10-19T10:30:00"),
        end: wita("2026-10-19T11:30:00"),
      }),
    );
    const second = await allocateSlot(
      db.store,
      command({
        userId: user,
        roomId: room,
        start: wita("2026-10-19T11:30:00"),
        end: wita("2026-10-19T12:30:00"),
      }),
    );

    expect(first.reservation.status).toBe("disetujui");
    expect(second.reservation.status).toBe("disetujui");
  });

  it("mengembalikan reservasi yang sama untuk retry dengan kunci idempoten", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store);
    const cmd = command({
      userId: user,
      roomId: room,
      start: wita("2026-10-19T10:30:00"),
      end: wita("2026-10-19T11:30:00"),
      idempotencyKey: "retry-sama",
    });

    const first = await allocateSlot(db.store, cmd);
    const second = await allocateSlot(db.store, cmd);

    expect(second.replayed).toBe(true);
    expect(second.reservation.businessId).toBe(first.reservation.businessId);

    const count = await countReservations(db.store);
    expect(count).toBe(1);
  });

  it("menolak kunci idempoten yang dipakai dengan payload berbeda", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store);
    const base = {
      userId: user,
      roomId: room,
      start: wita("2026-10-19T10:30:00"),
      end: wita("2026-10-19T11:30:00"),
      idempotencyKey: "kunci-konflik",
    };

    await allocateSlot(db.store, command({ ...base, participants: 5 }));

    await expectDomainError(
      allocateSlot(db.store, command({ ...base, participants: 6 })),
      "IDEMPOTENCY_MISMATCH",
    );
  });

  it("hanya satu yang berhasil pada pengajuan bersamaan untuk slot sama (RV-03)", async () => {
    const userA = await seedUser(db.store);
    const userB = await seedUser(db.store);
    const room = await seedRoom(db.store);
    const start = wita("2026-10-19T10:30:00");
    const end = wita("2026-10-19T11:30:00");

    const results = await Promise.allSettled([
      allocateSlot(db.store, command({ userId: userA, roomId: room, start, end })),
      allocateSlot(db.store, command({ userId: userB, roomId: room, start, end })),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(DomainError);
    expect((rejected[0] as PromiseRejectedResult).reason.code).toBe("SLOT_CONFLICT");

    const count = await countReservations(db.store);
    expect(count).toBe(1);
  });

  it("tidak ada reservasi ganda pada 100 request serentak untuk satu slot (RV-03)", async () => {
    const users = await Promise.all(
      Array.from({ length: 100 }, () => seedUser(db.store)),
    );
    const room = await seedRoom(db.store);
    const start = wita("2026-10-19T10:30:00");
    const end = wita("2026-10-19T11:30:00");

    const results = await Promise.allSettled(
      users.map((userId) =>
        allocateSlot(db.store, command({ userId, roomId: room, start, end })),
      ),
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(99);
    for (const result of rejected) {
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(DomainError);
      expect((result as PromiseRejectedResult).reason.code).toBe("SLOT_CONFLICT");
    }

    const count = await countReservations(db.store);
    expect(count).toBe(1);
  });

  it("tidak membuat reservasi ganda saat retry bersamaan dengan kunci sama (RV-05)", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store);
    const cmd = command({
      userId: user,
      roomId: room,
      start: wita("2026-10-19T10:30:00"),
      end: wita("2026-10-19T11:30:00"),
      idempotencyKey: "retry-bersamaan",
    });

    const results = await Promise.all([allocateSlot(db.store, cmd), allocateSlot(db.store, cmd)]);

    expect(results[0].reservation.businessId).toBe(results[1].reservation.businessId);

    const count = await countReservations(db.store);
    expect(count).toBe(1);
  });

  it("menolak reservasi yang menabrak blok jadwal kuliah (BR-07)", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store);
    await seedBlock(
      db.store,
      room,
      wita("2026-10-19T10:00:00"),
      wita("2026-10-19T12:00:00"),
    );

    await expectDomainError(
      allocateSlot(
        db.store,
        command({
          userId: user,
          roomId: room,
          start: wita("2026-10-19T10:30:00"),
          end: wita("2026-10-19T11:30:00"),
        }),
      ),
      "SLOT_CONFLICT",
    );
  });

  it("membatasi kuota pribadi menjadi 2 reservasi aktif (BR-05)", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store, { type: "diskusi" });

    await allocateSlot(
      db.store,
      command({
        userId: user,
        roomId: room,
        start: wita("2026-10-20T09:00:00"),
        end: wita("2026-10-20T10:00:00"),
      }),
    );
    await allocateSlot(
      db.store,
      command({
        userId: user,
        roomId: room,
        start: wita("2026-10-21T09:00:00"),
        end: wita("2026-10-21T10:00:00"),
      }),
    );

    await expectDomainError(
      allocateSlot(
        db.store,
        command({
          userId: user,
          roomId: room,
          start: wita("2026-10-22T09:00:00"),
          end: wita("2026-10-22T10:00:00"),
        }),
      ),
      "QUOTA_EXCEEDED",
    );
  });

  it("menolak reservasi pribadi lebih dari 3 jam pada ruang diskusi (BR-05)", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store, { type: "diskusi" });

    await expectDomainError(
      allocateSlot(
        db.store,
        command({
          userId: user,
          roomId: room,
          start: wita("2026-10-20T09:00:00"),
          end: wita("2026-10-20T13:00:00"),
        }),
      ),
      "VALIDATION_ERROR",
    );
  });

  it("membatasi ruang khusus berdasarkan peran (RS-02)", async () => {
    const mahasiswa = await seedUser(db.store, { role: "mahasiswa" });
    const dosen = await seedUser(db.store, { role: "dosen" });
    const room = await seedRoom(db.store, {
      policy: "khusus",
      allowedRoles: ["dosen"],
    });
    const start = wita("2026-10-20T09:00:00");
    const end = wita("2026-10-20T10:00:00");

    await expectDomainError(
      allocateSlot(
        db.store,
        command({ userId: mahasiswa, roomId: room, start, end }),
      ),
      "FORBIDDEN",
    );

    const result = await allocateSlot(
      db.store,
      command({ userId: dosen, roomId: room, start, end }),
    );
    expect(result.reservation.status).toBe("menunggu");
  });

  it("menolak ruang nonaktif", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store, { active: false });

    await expectDomainError(
      allocateSlot(
        db.store,
        command({
          userId: user,
          roomId: room,
          start: wita("2026-10-19T10:30:00"),
          end: wita("2026-10-19T11:30:00"),
        }),
      ),
      "ROOM_UNAVAILABLE",
    );
  });

  it("menolak hari Minggu tanpa persetujuan khusus (BR-04)", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store);

    await expectDomainError(
      allocateSlot(
        db.store,
        command({
          userId: user,
          roomId: room,
          start: wita("2026-10-25T09:00:00"),
          end: wita("2026-10-25T10:00:00"),
        }),
      ),
      "VALIDATION_ERROR",
    );
  });

  it("mengizinkan hari Minggu dengan persetujuan petugas", async () => {
    const petugas = await seedUser(db.store, { role: "petugas" });
    const room = await seedRoom(db.store);

    const result = await allocateSlot(
      db.store,
      command({
        userId: petugas,
        roomId: room,
        start: wita("2026-10-25T09:00:00"),
        end: wita("2026-10-25T10:00:00"),
        specialApproval: true,
      }),
    );

    expect(result.reservation.status).toBe("disetujui");
  });

  it("menolak persetujuan khusus dari peran non-petugas", async () => {
    const mahasiswa = await seedUser(db.store);
    const room = await seedRoom(db.store);

    await expectDomainError(
      allocateSlot(
        db.store,
        command({
          userId: mahasiswa,
          roomId: room,
          start: wita("2026-10-25T09:00:00"),
          end: wita("2026-10-25T10:00:00"),
          specialApproval: true,
        }),
      ),
      "FORBIDDEN",
    );
  });

  it("menolak ruang persetujuan tanpa lead time 1 hari kerja (BR-06)", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store, { policy: "perlu_persetujuan" });

    await expectDomainError(
      allocateSlot(
        db.store,
        command({
          userId: user,
          roomId: room,
          start: wita("2026-10-19T14:00:00"),
          end: wita("2026-10-19T15:00:00"),
        }),
      ),
      "VALIDATION_ERROR",
    );
  });

  it("menerapkan lead time 3 hari kerja untuk acara", async () => {
    const user = await seedUser(db.store);

    const tooSoon = await seedRoom(db.store, { code: "AULA-1", type: "aula" });
    await expectDomainError(
      allocateSlot(
        db.store,
        command({
          userId: user,
          roomId: tooSoon,
          start: wita("2026-10-21T09:00:00"),
          end: wita("2026-10-21T10:00:00"),
          purpose: "acara",
        }),
      ),
      "VALIDATION_ERROR",
    );

    const onTime = await seedRoom(db.store, { code: "AULA-2", type: "aula" });
    const result = await allocateSlot(
      db.store,
      command({
        userId: user,
        roomId: onTime,
        start: wita("2026-10-22T09:00:00"),
        end: wita("2026-10-22T10:00:00"),
        purpose: "acara",
      }),
    );
    expect(result.reservation.status).toBe("disetujui");
  });

  it("mengizinkan reservasi organisasi melewati kuota pribadi", async () => {
    const user = await seedUser(db.store);
    const org = await seedOrganization(db.store);
    await addOrgMember(db.store, user, org);
    const room = await seedRoom(db.store, { type: "diskusi" });

    for (const day of ["20", "21", "22"]) {
      const result = await allocateSlot(
        db.store,
        command({
          userId: user,
          roomId: room,
          orgId: org,
          start: wita(`2026-10-${day}T09:00:00`),
          end: wita(`2026-10-${day}T10:00:00`),
        }),
      );
      expect(result.reservation.status).toBe("disetujui");
    }
  });
});

describe("jaminan level penyimpanan", () => {
  it("menolak irisan walau insert dilakukan langsung tanpa service", async () => {
    const user = await seedUser(db.store);
    const room = await seedRoom(db.store);

    await insertReservationDirect(db.store, {
      businessId: "RSV-TEST-0001",
      roomId: room,
      userId: user,
      start: wita("2026-10-19T10:00:00"),
      end: wita("2026-10-19T11:00:00"),
      idempotencyKey: "langsung-1",
    });

    await expect(
      insertReservationDirect(db.store, {
        businessId: "RSV-TEST-0002",
        roomId: room,
        userId: user,
        start: wita("2026-10-19T10:30:00"),
        end: wita("2026-10-19T11:30:00"),
        idempotencyKey: "langsung-2",
      }),
    ).rejects.toMatchObject({ code: "SLOT_CONFLICT" });
  });
});
