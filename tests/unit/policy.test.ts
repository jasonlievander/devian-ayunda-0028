import { describe, expect, it } from "vitest";
import {
  assertCapacity,
  assertLeadTime,
  assertOperatingHours,
  countWorkingDays,
} from "../../src/domain/policy";
import { DomainError } from "../../src/domain/errors";
import { parseTimeRange } from "../../src/domain/time";

const wita = (local: string) => `${local}+08:00`;
const now = new Date("2026-10-19T01:00:00Z");

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`Diharapkan error ${code}, tetapi tidak ada error`);
}

describe("assertCapacity (BR-03)", () => {
  it("menerima peserta sama dengan kapasitas", () => {
    expect(() => assertCapacity(10, 10)).not.toThrow();
  });

  it("menolak peserta kapasitas + 1", () => {
    expectCode(() => assertCapacity(11, 10), "VALIDATION_ERROR");
  });

  it("menolak peserta nol", () => {
    expectCode(() => assertCapacity(0, 10), "VALIDATION_ERROR");
  });

  it("menolak peserta negatif", () => {
    expectCode(() => assertCapacity(-1, 10), "VALIDATION_ERROR");
  });

  it("menerima peserta berapa pun bila kapasitas belum dipublikasikan", () => {
    expect(() => assertCapacity(120, null)).not.toThrow();
  });

  it("tetap menolak peserta nol bila kapasitas belum dipublikasikan", () => {
    expectCode(() => assertCapacity(0, null), "VALIDATION_ERROR");
  });
});

describe("assertOperatingHours (BR-04)", () => {
  it("menerima jam kerja hari Selasa", () => {
    const range = parseTimeRange(
      wita("2026-10-20T09:00:00"),
      wita("2026-10-20T10:00:00"),
    );
    expect(() => assertOperatingHours(range)).not.toThrow();
  });

  it("menerima Sabtu sampai pukul 14.00", () => {
    const range = parseTimeRange(
      wita("2026-10-24T13:00:00"),
      wita("2026-10-24T14:00:00"),
    );
    expect(() => assertOperatingHours(range)).not.toThrow();
  });

  it("menolak sebelum jam buka", () => {
    const range = parseTimeRange(
      wita("2026-10-20T08:00:00"),
      wita("2026-10-20T09:00:00"),
    );
    expectCode(() => assertOperatingHours(range), "VALIDATION_ERROR");
  });

  it("menolak setelah jam tutup", () => {
    const range = parseTimeRange(
      wita("2026-10-20T17:00:00"),
      wita("2026-10-20T18:00:00"),
    );
    expectCode(() => assertOperatingHours(range), "VALIDATION_ERROR");
  });

  it("menolak Sabtu setelah pukul 14.00", () => {
    const range = parseTimeRange(
      wita("2026-10-24T14:30:00"),
      wita("2026-10-24T15:30:00"),
    );
    expectCode(() => assertOperatingHours(range), "VALIDATION_ERROR");
  });

  it("menolak hari Minggu tanpa persetujuan khusus", () => {
    const range = parseTimeRange(
      wita("2026-10-25T09:00:00"),
      wita("2026-10-25T10:00:00"),
    );
    expectCode(() => assertOperatingHours(range), "VALIDATION_ERROR");
  });

  it("menerima hari Minggu dengan persetujuan khusus", () => {
    const range = parseTimeRange(
      wita("2026-10-25T09:00:00"),
      wita("2026-10-25T10:00:00"),
    );
    expect(() =>
      assertOperatingHours(range, { specialApproval: true }),
    ).not.toThrow();
  });

  it("menerima di luar jam dengan persetujuan khusus", () => {
    const range = parseTimeRange(
      wita("2026-10-20T18:00:00"),
      wita("2026-10-20T19:00:00"),
    );
    expect(() =>
      assertOperatingHours(range, { specialApproval: true }),
    ).not.toThrow();
  });
});

describe("countWorkingDays", () => {
  it("menghitung Senin sebagai 1 hari kerja dari Jumat", () => {
    expect(countWorkingDays("2026-10-23", "2026-10-26")).toBe(1);
  });

  it("melewati akhir pekan", () => {
    expect(countWorkingDays("2026-10-24", "2026-10-26")).toBe(1);
  });

  it("mengembalikan 0 untuk hari yang sama", () => {
    expect(countWorkingDays("2026-10-20", "2026-10-20")).toBe(0);
  });

  it("menghitung beberapa hari kerja", () => {
    expect(countWorkingDays("2026-10-19", "2026-10-22")).toBe(3);
  });
});

describe("assertLeadTime (BR-06)", () => {
  it("menerima ruang terbuka 90 menit sebelum mulai", () => {
    const range = parseTimeRange(
      wita("2026-10-19T10:30:00"),
      wita("2026-10-19T11:30:00"),
    );
    expect(() =>
      assertLeadTime(range, {
        now,
        policy: "terbuka",
        roomType: "diskusi",
        purpose: "belajar kelompok",
      }),
    ).not.toThrow();
  });

  it("menolak ruang terbuka kurang dari 1 jam", () => {
    const range = parseTimeRange(
      wita("2026-10-19T09:30:00"),
      wita("2026-10-19T10:30:00"),
    );
    expectCode(
      () =>
        assertLeadTime(range, {
          now,
          policy: "terbuka",
          roomType: "diskusi",
          purpose: "belajar kelompok",
        }),
      "VALIDATION_ERROR",
    );
  });

  it("menerima ruang persetujuan tepat 1 hari kerja", () => {
    const range = parseTimeRange(
      wita("2026-10-20T09:00:00"),
      wita("2026-10-20T10:00:00"),
    );
    expect(() =>
      assertLeadTime(range, {
        now,
        policy: "perlu_persetujuan",
        roomType: "kelas",
        purpose: "rapat",
      }),
    ).not.toThrow();
  });

  it("menolak ruang persetujuan pada hari yang sama", () => {
    const range = parseTimeRange(
      wita("2026-10-19T14:00:00"),
      wita("2026-10-19T15:00:00"),
    );
    expectCode(
      () =>
        assertLeadTime(range, {
          now,
          policy: "perlu_persetujuan",
          roomType: "kelas",
          purpose: "rapat",
        }),
      "VALIDATION_ERROR",
    );
  });

  it("menolak acara kurang dari 3 hari kerja", () => {
    const range = parseTimeRange(
      wita("2026-10-21T09:00:00"),
      wita("2026-10-21T10:00:00"),
    );
    expectCode(
      () =>
        assertLeadTime(range, {
          now,
          policy: "terbuka",
          roomType: "aula",
          purpose: "acara",
        }),
      "VALIDATION_ERROR",
    );
  });

  it("menerima acara tepat 3 hari kerja", () => {
    const range = parseTimeRange(
      wita("2026-10-22T09:00:00"),
      wita("2026-10-22T10:00:00"),
    );
    expect(() =>
      assertLeadTime(range, {
        now,
        policy: "terbuka",
        roomType: "aula",
        purpose: "acara",
      }),
    ).not.toThrow();
  });

  it("menolak pengajuan persetujuan kurang dari 2 jam lagi setelah lead time", () => {
    const late = new Date("2026-10-20T06:00:00Z");
    const range = parseTimeRange(
      wita("2026-10-20T15:00:00"),
      wita("2026-10-20T16:00:00"),
    );
    expectCode(
      () =>
        assertLeadTime(range, {
          now: late,
          policy: "perlu_persetujuan",
          roomType: "kelas",
          purpose: "rapat",
        }),
      "VALIDATION_ERROR",
    );
  });
});
