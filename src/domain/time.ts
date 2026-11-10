import { config } from "../config";
import { DomainError, validationError } from "./errors";

const ISO_WITH_ZONE = /(?:Z|[+-]\d{2}:\d{2})$/;
const MINUTE_MS = 60_000;
const SLOT_MS = config.time.slotMinutes * MINUTE_MS;

export interface WitaParts {
  dateKey: string;
  minutesOfDay: number;
  dayOfWeek: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
  startWita: WitaParts;
  endWita: WitaParts;
}

export interface TimeRangeOptions {
  requireStartAlignment?: boolean;
  allowCrossDay?: boolean;
}

function parseInstant(value: string, field: string): Date {
  if (typeof value !== "string" || !ISO_WITH_ZONE.test(value)) {
    throw validationError(
      `${field} wajib berupa waktu ISO-8601 dengan zona waktu`,
      field,
    );
  }

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw validationError(`${field} bukan waktu yang valid`, field);
  }

  return instant;
}

function shiftToWita(instant: Date): Date {
  return new Date(instant.getTime() + config.time.witaOffsetMinutes * MINUTE_MS);
}

export function witaDateKey(instant: Date): string {
  const wita = shiftToWita(instant);
  const year = wita.getUTCFullYear();
  const month = String(wita.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wita.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function witaParts(instant: Date): WitaParts {
  const wita = shiftToWita(instant);
  return {
    dateKey: witaDateKey(instant),
    minutesOfDay: wita.getUTCHours() * 60 + wita.getUTCMinutes(),
    dayOfWeek: wita.getUTCDay(),
  };
}

export function parseTimeRange(
  startValue: string,
  endValue: string,
  options: TimeRangeOptions = {},
): TimeRange {
  const requireStartAlignment =
    options.requireStartAlignment ?? config.time.requireStartAlignment;
  const allowCrossDay = options.allowCrossDay ?? config.time.allowCrossDay;

  const start = parseInstant(startValue, "mulai");
  const end = parseInstant(endValue, "selesai");

  if (end.getTime() <= start.getTime()) {
    throw validationError(
      "Waktu mulai harus lebih awal dari waktu selesai",
      "selesai",
    );
  }

  const durationMs = end.getTime() - start.getTime();
  const minimumMs = config.time.minDurationMinutes * MINUTE_MS;

  if (durationMs < minimumMs) {
    throw validationError(
      `Durasi minimal ${config.time.minDurationMinutes} menit`,
      "selesai",
    );
  }

  if (durationMs % SLOT_MS !== 0) {
    throw validationError(
      `Durasi harus kelipatan ${config.time.slotMinutes} menit`,
      "selesai",
    );
  }

  const startWita = witaParts(start);
  const endWita = witaParts(end);

  if (requireStartAlignment && startWita.minutesOfDay % config.time.slotMinutes !== 0) {
    throw validationError(
      `Jam mulai harus kelipatan ${config.time.slotMinutes} menit`,
      "mulai",
    );
  }

  if (
    start.getTime() % MINUTE_MS !== 0 ||
    end.getTime() % MINUTE_MS !== 0
  ) {
    throw validationError(
      `Waktu harus berada pada kelipatan ${config.time.slotMinutes} menit`,
      "mulai",
    );
  }

  if (!allowCrossDay && startWita.dateKey !== endWita.dateKey) {
    throw validationError(
      "Reservasi tidak boleh melewati batas hari",
      "selesai",
    );
  }

  return { start, end, startWita, endWita };
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
