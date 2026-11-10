import type pg from "pg";
import { validationError } from "../domain/errors";

export type CalendarEventKind = "reservasi" | "blokir";
export type CalendarEventStatus =
  | "menunggu"
  | "disetujui"
  | "berlangsung"
  | "blokir";

export interface CalendarEvent {
  kind: CalendarEventKind;
  id: bigint;
  roomId: bigint;
  roomCode: string;
  roomName: string;
  start: Date;
  end: Date;
  title: string;
  status: CalendarEventStatus;
}

export interface CalendarQuery {
  from: Date;
  to: Date;
  roomId?: bigint;
}

const MAX_RANGE_MS = 92 * 24 * 60 * 60 * 1000;

interface CalendarRow {
  kind: CalendarEventKind;
  id: string;
  room_id: string;
  room_code: string;
  room_name: string;
  mulai: Date;
  selesai: Date;
  title: string;
  status: CalendarEventStatus;
}

export async function listCalendar(
  pool: pg.Pool,
  query: CalendarQuery,
): Promise<CalendarEvent[]> {
  const from = query.from.getTime();
  const to = query.to.getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    throw validationError(
      "Rentang kalender harus memiliki waktu selesai setelah waktu mulai",
      "to",
    );
  }
  if (to - from > MAX_RANGE_MS) {
    throw validationError("Rentang kalender maksimal 92 hari", "to");
  }

  const params: Array<string> = [
    new Date(from).toISOString(),
    new Date(to).toISOString(),
  ];
  const roomFilter =
    query.roomId === undefined ? "" : "AND room_id = $3";
  if (query.roomId !== undefined) {
    params.push(query.roomId.toString());
  }

  const result = await pool.query<CalendarRow>(
    `SELECT 'reservasi' AS kind, r.id AS id, r.room_id AS room_id,
            rm.kode AS room_code, rm.nama AS room_name,
            r.mulai AS mulai, r.selesai AS selesai,
            r.keperluan AS title, r.status::text AS status
     FROM reservations r
     JOIN rooms rm ON rm.id = r.room_id AND rm.aktif
     WHERE r.status IN ('menunggu', 'disetujui', 'berlangsung')
       AND tstzrange(r.mulai, r.selesai, '[)') && tstzrange($1::timestamptz, $2::timestamptz, '[)')
       ${roomFilter}
     UNION ALL
     SELECT 'blokir' AS kind, b.id AS id, b.room_id AS room_id,
            rm.kode AS room_code, rm.nama AS room_name,
            b.mulai AS mulai, b.selesai AS selesai,
            'Ruang diblokir' AS title, 'blokir' AS status
     FROM room_blocks b
     JOIN rooms rm ON rm.id = b.room_id AND rm.aktif
     WHERE tstzrange(b.mulai, b.selesai, '[)') && tstzrange($1::timestamptz, $2::timestamptz, '[)')
       ${roomFilter}
     ORDER BY mulai ASC, kind ASC, id ASC`,
    params,
  );

  return result.rows.map((row) => ({
    kind: row.kind,
    id: BigInt(row.id),
    roomId: BigInt(row.room_id),
    roomCode: row.room_code,
    roomName: row.room_name,
    start: new Date(row.mulai),
    end: new Date(row.selesai),
    title: row.title,
    status: row.status,
  }));
}
