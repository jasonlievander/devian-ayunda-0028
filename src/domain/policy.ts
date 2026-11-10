import { config } from "../config";
import { validationError } from "./errors";
import { witaDateKey, type TimeRange } from "./time";

export type RoomPolicy = "terbuka" | "perlu_persetujuan" | "khusus";

export interface OperatingHoursOptions {
  specialApproval?: boolean;
}

export interface LeadTimeOptions {
  now: Date;
  policy: RoomPolicy;
  roomType: string;
  purpose: string;
}

function parseClock(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * 60 + minutes!;
}

export function assertCapacity(
  participants: number,
  capacity: number | null,
): void {
  if (!Number.isInteger(participants) || participants <= 0) {
    throw validationError(
      "Jumlah peserta harus bilangan bulat lebih dari 0",
      "peserta",
    );
  }

  if (capacity === null) {
    return;
  }

  if (participants > capacity) {
    throw validationError(
      `Kapasitas ruang ini maksimal ${capacity} orang`,
      "peserta",
    );
  }
}

export function assertOperatingHours(
  range: TimeRange,
  options: OperatingHoursOptions = {},
): void {
  if (options.specialApproval === true) {
    return;
  }

  const { dayOfWeek, minutesOfDay: startMinutes } = range.startWita;
  const endMinutes = range.endWita.minutesOfDay;

  if (dayOfWeek === 0) {
    throw validationError(
      "Hari Minggu hanya dapat dipesan dengan persetujuan khusus",
      "mulai",
    );
  }

  const window =
    dayOfWeek === 6
      ? config.operatingHours.saturday
      : config.operatingHours.weekday;

  const open = parseClock(window.open);
  const close = parseClock(window.close);

  if (startMinutes < open || endMinutes > close) {
    throw validationError(
      `Di luar jam operasional (${window.open}-${window.close} WITA)`,
      "mulai",
    );
  }
}

export function countWorkingDays(fromDateKey: string, toDateKey: string): number {
  const from = Date.parse(`${fromDateKey}T00:00:00Z`);
  const to = Date.parse(`${toDateKey}T00:00:00Z`);

  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) {
    return 0;
  }

  let count = 0;
  for (let cursor = from + 86_400_000; cursor <= to; cursor += 86_400_000) {
    const day = new Date(cursor).getUTCDay();
    if (day >= 1 && day <= 5) {
      count += 1;
    }
  }

  return count;
}

export function requiredWorkingDays(
  policy: RoomPolicy,
  roomType: string,
  purpose: string,
): number {
  const isEvent = roomType === "aula" || purpose === "acara";
  const approvalDays =
    policy === "terbuka" ? 0 : config.leadTime.approvalWorkingDays;

  return Math.max(approvalDays, isEvent ? config.leadTime.eventWorkingDays : 0);
}

export function assertLeadTime(
  range: TimeRange,
  options: LeadTimeOptions,
): void {
  const minutesUntilStart =
    (range.start.getTime() - options.now.getTime()) / 60_000;

  if (minutesUntilStart <= 0) {
    throw validationError(
      "Waktu mulai sudah lewat",
      "mulai",
    );
  }

  const workingDays = requiredWorkingDays(
    options.policy,
    options.roomType,
    options.purpose,
  );

  if (
    workingDays > 0 &&
    countWorkingDays(witaDateKey(options.now), range.startWita.dateKey) <
      workingDays
  ) {
    throw validationError(
      `Pengajuan minimal ${workingDays} hari kerja sebelum waktu mulai`,
      "mulai",
    );
  }

  if (
    options.policy === "terbuka" &&
    workingDays === 0 &&
    minutesUntilStart < config.leadTime.openRoomMinutes
  ) {
    throw validationError(
      `Pengajuan minimal ${config.leadTime.openRoomMinutes} menit sebelum waktu mulai`,
      "mulai",
    );
  }

  if (
    options.policy !== "terbuka" &&
    minutesUntilStart < config.leadTime.pendingGuardHours * 60
  ) {
    throw validationError(
      `Pengajuan ruang persetujuan minimal ${config.leadTime.pendingGuardHours} jam sebelum waktu mulai`,
      "mulai",
    );
  }
}
