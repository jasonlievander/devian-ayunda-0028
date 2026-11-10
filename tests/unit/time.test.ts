import { describe, expect, it } from "vitest";
import { DomainError } from "../../src/domain/errors";
import { parseTimeRange, witaDateKey } from "../../src/domain/time";

const wita = (local: string) => `${local}+08:00`;

function expectValidationError(fn: () => unknown): DomainError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    const domainError = error as DomainError;
    expect(domainError.code).toBe("VALIDATION_ERROR");
    return domainError;
  }
  throw new Error("Diharapkan DomainError, tetapi tidak ada error");
}

describe("parseTimeRange", () => {
  it("menerima rentang 30 menit pada kelipatan jam", () => {
    const range = parseTimeRange(wita("2026-10-20T09:00:00"), wita("2026-10-20T09:30:00"));

    expect(range.start.toISOString()).toBe("2026-10-20T01:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-20T01:30:00.000Z");
  });

  it("menolak mulai sama dengan selesai", () => {
    const error = expectValidationError(() =>
      parseTimeRange(wita("2026-10-20T09:00:00"), wita("2026-10-20T09:00:00")),
    );
    expect(error.message).toContain("lebih awal");
  });

  it("menolak selesai sebelum mulai", () => {
    expectValidationError(() =>
      parseTimeRange(wita("2026-10-20T10:00:00"), wita("2026-10-20T09:00:00")),
    );
  });

  it("menolak durasi 29 menit", () => {
    expectValidationError(() =>
      parseTimeRange(wita("2026-10-20T09:00:00"), wita("2026-10-20T09:29:00")),
    );
  });

  it("menolak durasi 31 menit", () => {
    expectValidationError(() =>
      parseTimeRange(wita("2026-10-20T09:00:00"), wita("2026-10-20T09:31:00")),
    );
  });

  it("menolak durasi 45 menit", () => {
    expectValidationError(() =>
      parseTimeRange(wita("2026-10-20T09:00:00"), wita("2026-10-20T09:45:00")),
    );
  });

  it("menolak jam mulai yang tidak kelipatan 30 menit", () => {
    const error = expectValidationError(() =>
      parseTimeRange(wita("2026-10-20T09:15:00"), wita("2026-10-20T09:45:00")),
    );
    expect(error.message).toContain("30 menit");
  });

  it("mengizinkan jam mulai tidak sejajar bila aturan dimatikan", () => {
    const range = parseTimeRange(
      wita("2026-10-20T09:15:00"),
      wita("2026-10-20T09:45:00"),
      { requireStartAlignment: false },
    );
    expect(range.start.toISOString()).toBe("2026-10-20T01:15:00.000Z");
  });

  it("menolak reservasi lintas hari", () => {
    expectValidationError(() =>
      parseTimeRange(wita("2026-10-20T23:30:00"), wita("2026-10-21T00:30:00")),
    );
  });

  it("menolak input tanpa zona waktu eksplisit", () => {
    expectValidationError(() =>
      parseTimeRange("2026-10-20T09:00:00", "2026-10-20T10:00:00"),
    );
  });

  it("menganggap offset berbeda sebagai instan yang sama", () => {
    const fromWita = parseTimeRange(
      "2026-10-20T09:00:00+08:00",
      "2026-10-20T10:00:00+08:00",
    );
    const fromUtc = parseTimeRange(
      "2026-10-20T01:00:00Z",
      "2026-10-20T02:00:00Z",
    );

    expect(fromWita.start.getTime()).toBe(fromUtc.start.getTime());
    expect(fromWita.end.getTime()).toBe(fromUtc.end.getTime());
  });
});

describe("witaDateKey", () => {
  it("memakai tanggal WITA, bukan UTC", () => {
    const instant = new Date("2026-10-20T18:00:00Z");
    expect(witaDateKey(instant)).toBe("2026-10-21");
  });
});
