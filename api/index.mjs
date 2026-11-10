// src/http/app.ts
import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";

// src/domain/errors.ts
var DomainError = class extends Error {
  code;
  httpStatus;
  field;
  constructor(code, message, httpStatus, field) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.field = field;
  }
};
function validationError(message, field) {
  return new DomainError("VALIDATION_ERROR", message, 422, field);
}

// src/config.ts
var config = {
  adminCode: "idbbali",
  formCode: "12345",
  formEmail: "akumahasiswa2gmail.com",
  formNim: "123456",
  time: {
    timezone: "Asia/Makassar",
    witaOffsetMinutes: 480,
    requireStartAlignment: true,
    allowCrossDay: false,
    slotMinutes: 30,
    minDurationMinutes: 30
  },
  operatingHours: {
    weekday: { open: "08:30", close: "17:30" },
    saturday: { open: "08:30", close: "14:00" },
    sundayOpen: false
  },
  leadTime: {
    openRoomMinutes: 60,
    approvalWorkingDays: 1,
    eventWorkingDays: 3,
    pendingGuardHours: 2
  },
  quota: {
    maxActivePersonal: 2,
    maxHoursPerReservation: 3,
    roomTypes: ["diskusi", "kelas"]
  },
  idempotencyRetentionHours: 24
};

// src/domain/time.ts
var ISO_WITH_ZONE = /(?:Z|[+-]\d{2}:\d{2})$/;
var MINUTE_MS = 6e4;
var SLOT_MS = config.time.slotMinutes * MINUTE_MS;
function parseInstant(value, field) {
  if (typeof value !== "string" || !ISO_WITH_ZONE.test(value)) {
    throw validationError(
      `${field} wajib berupa waktu ISO-8601 dengan zona waktu`,
      field
    );
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw validationError(`${field} bukan waktu yang valid`, field);
  }
  return instant;
}
function shiftToWita(instant) {
  return new Date(instant.getTime() + config.time.witaOffsetMinutes * MINUTE_MS);
}
function witaDateKey(instant) {
  const wita = shiftToWita(instant);
  const year = wita.getUTCFullYear();
  const month = String(wita.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wita.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function witaParts(instant) {
  const wita = shiftToWita(instant);
  return {
    dateKey: witaDateKey(instant),
    minutesOfDay: wita.getUTCHours() * 60 + wita.getUTCMinutes(),
    dayOfWeek: wita.getUTCDay()
  };
}
function parseTimeRange(startValue, endValue, options = {}) {
  const requireStartAlignment = options.requireStartAlignment ?? config.time.requireStartAlignment;
  const allowCrossDay = options.allowCrossDay ?? config.time.allowCrossDay;
  const start = parseInstant(startValue, "mulai");
  const end = parseInstant(endValue, "selesai");
  if (end.getTime() <= start.getTime()) {
    throw validationError(
      "Waktu mulai harus lebih awal dari waktu selesai",
      "selesai"
    );
  }
  const durationMs = end.getTime() - start.getTime();
  const minimumMs = config.time.minDurationMinutes * MINUTE_MS;
  if (durationMs < minimumMs) {
    throw validationError(
      `Durasi minimal ${config.time.minDurationMinutes} menit`,
      "selesai"
    );
  }
  if (durationMs % SLOT_MS !== 0) {
    throw validationError(
      `Durasi harus kelipatan ${config.time.slotMinutes} menit`,
      "selesai"
    );
  }
  const startWita = witaParts(start);
  const endWita = witaParts(end);
  if (requireStartAlignment && startWita.minutesOfDay % config.time.slotMinutes !== 0) {
    throw validationError(
      `Jam mulai harus kelipatan ${config.time.slotMinutes} menit`,
      "mulai"
    );
  }
  if (start.getTime() % MINUTE_MS !== 0 || end.getTime() % MINUTE_MS !== 0) {
    throw validationError(
      `Waktu harus berada pada kelipatan ${config.time.slotMinutes} menit`,
      "mulai"
    );
  }
  if (!allowCrossDay && startWita.dateKey !== endWita.dateKey) {
    throw validationError(
      "Reservasi tidak boleh melewati batas hari",
      "selesai"
    );
  }
  return { start, end, startWita, endWita };
}

// src/infrastructure/seed-rooms.ts
var DEFAULT_ROOMS = [
  { kode: "A.1.1", nama: "A.1.1 (STUDIO POLA)", tipe: "studio", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "A.1.2", nama: "A.1.2 (LECT 1A)", tipe: "kelas", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "A.1.3", nama: "A.1.3 (LAB 1C)", tipe: "lab", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "A.2.1", nama: "A.2.1 (LAB 2B)", tipe: "lab", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "A.2.2", nama: "A.2.2 (LAB 2C)", tipe: "lab", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "A.2.3", nama: "A.2.3 (LECT 2D)", tipe: "kelas", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "B.2.1", nama: "B.2.1 (INTERNATIONAL)", tipe: "internasional", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "B.1.3", nama: "B.1.3 (STUDIO 3)", tipe: "studio", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "B.1.4", nama: "B.1.4 (LAB FASHION)", tipe: "lab", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "C.1.1", nama: "C.1.1 (LAB 1A)", tipe: "lab", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "C.1.2", nama: "C.1.2 (LAB STI)", tipe: "lab", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "C.1.3", nama: "C.1.3 (LECT 1)", tipe: "kelas", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "C.2.1", nama: "C.2.1 (LECT 2A)", tipe: "kelas", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "C.2.2", nama: "C.2.2 (LECT 2B)", tipe: "kelas", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "C.2.3", nama: "C.2.3 (STUDIO 2C)", tipe: "studio", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "C.3.1", nama: "C.3.1 (STUDIO 3A)", tipe: "studio", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "C.3.2", nama: "C.3.2 (STUDIO 3B)", tipe: "studio", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "C.3.3", nama: "C.3.3 (STUDIO 3C)", tipe: "studio", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "AULA", nama: "AULA IDB BALI", tipe: "aula", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "STUDIO-FOTO", nama: "STUDIO FOTO IDB BALI", tipe: "studio", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "ROOFTOP", nama: "ROOFTOP IDB BALI", tipe: "area", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "INBIS", nama: "INBIS IDB BALI", tipe: "ruang", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "HALAMAN-A", nama: "HALAMAN IDB BALI GEDUNG A", tipe: "halaman", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "HALAMAN-B", nama: "HALAMAN IDB BALI GEDUNG B", tipe: "halaman", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "HALAMAN-C", nama: "HALAMAN IDB BALI GEDUNG C", tipe: "halaman", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "GSG-LT1", nama: "GEDUNG SERBA GUNA IDB BALI - Lt.1", tipe: "gsg", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "GSG-LT2", nama: "GEDUNG SERBA GUNA IDB BALI - Lt.2", tipe: "gsg", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "GSG-LT3", nama: "GEDUNG SERBA GUNA IDB BALI - Lt.3", tipe: "gsg", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "GEDUNG-B-GEAR", nama: "GEDUNG B (Gear inc)", tipe: "ruang", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "LAB-KOMPUTER", nama: "Lab Komputer", tipe: "lab", kapasitas: 36, kebijakan: "perlu_persetujuan" },
  { kode: "LAB-IMAC", nama: "Lab iMac", tipe: "lab", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "PERPUSTAKAAN", nama: "Perpustakaan", tipe: "perpustakaan", kapasitas: null, kebijakan: "perlu_persetujuan" },
  { kode: "CREATIVE-GALLERY", nama: "Creative Gallery", tipe: "galeri", kapasitas: null, kebijakan: "perlu_persetujuan" }
];

// src/infrastructure/demo-seed.ts
var DEMO_ADMIN = {
  email: "admin@idbbali.ac.id",
  password: "idbbali"
};
var DEMO_STUDENT = {
  email: "mahasiswa@idbbali.ac.id",
  password: "123456",
  nim: "123456"
};
function witaDateKey2(offsetDays) {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1e3 + offsetDays * 864e5);
  return shifted.toISOString().slice(0, 10);
}
function witaInstant(dateKey, time) {
  return (/* @__PURE__ */ new Date(`${dateKey}T${time}+08:00`)).toISOString();
}
function addId(state, key) {
  const value = (state.nextId[key] ?? 0) + 1;
  state.nextId[key] = value;
  return value;
}
function bumpDailySeq(state, dateKey) {
  const value = (state.dailySeq[dateKey] ?? 0) + 1;
  state.dailySeq[dateKey] = value;
  return value;
}
function seedDemoState(state) {
  const users = [
    {
      id: addId(state, "users"),
      nama: "Petugas Sarana Prasarana",
      email: DEMO_ADMIN.email,
      peran: "admin",
      status: "aktif",
      nim: null,
      password: DEMO_ADMIN.password
    },
    {
      id: addId(state, "users"),
      nama: "Mahasiswa Demo",
      email: DEMO_STUDENT.email,
      peran: "mahasiswa",
      status: "aktif",
      nim: DEMO_STUDENT.nim,
      password: DEMO_STUDENT.password
    }
  ];
  state.users.push(...users);
  for (const seed of DEFAULT_ROOMS) {
    state.rooms.push({
      id: addId(state, "rooms"),
      kode: seed.kode,
      nama: seed.nama,
      tipe: seed.tipe,
      kapasitas: seed.kapasitas,
      kebijakan: seed.kebijakan,
      aktif: true,
      allowedRoles: []
    });
  }
  const student = users[1];
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const seeds = [
    {
      roomIndex: 10,
      userId: student.id,
      dayOffset: 0,
      start: "09:00",
      end: "10:00",
      purpose: "diskusi proyek mata kuliah",
      participants: 6,
      status: "menunggu"
    },
    {
      roomIndex: 0,
      userId: student.id,
      dayOffset: 0,
      start: "13:00",
      end: "15:00",
      purpose: "praktik studio pola",
      participants: 20,
      status: "disetujui"
    },
    {
      roomIndex: 18,
      userId: student.id,
      dayOffset: 1,
      start: "10:00",
      end: "12:00",
      purpose: "seminar desain",
      participants: 120,
      status: "disetujui"
    },
    {
      roomIndex: 29,
      userId: student.id,
      dayOffset: 1,
      start: "15:00",
      end: "16:00",
      purpose: "workshop figma",
      participants: 30,
      status: "menunggu"
    }
  ];
  for (const seed of seeds) {
    const room = state.rooms[seed.roomIndex];
    const dateKey = witaDateKey2(seed.dayOffset);
    const sequence = bumpDailySeq(state, dateKey);
    const reservation = {
      id: addId(state, "reservations"),
      businessId: `RSV-${dateKey.replaceAll("-", "")}-${String(sequence).padStart(4, "0")}`,
      roomId: room.id,
      userId: seed.userId,
      orgId: null,
      start: witaInstant(dateKey, seed.start),
      end: witaInstant(dateKey, seed.end),
      purpose: seed.purpose,
      participants: seed.participants,
      status: seed.status,
      idempotencyKey: `seed-${seed.roomIndex}-${seed.dayOffset}-${seed.start}`,
      requestHash: "seed",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    state.reservations.push(reservation);
    state.events.push({
      id: addId(state, "events"),
      reservationId: reservation.id,
      from: null,
      to: seed.status,
      actorId: seed.userId,
      reason: null,
      waktu: timestamp
    });
  }
  const blockDate = witaDateKey2(1);
  state.blocks.push({
    id: addId(state, "blocks"),
    roomId: state.rooms[11].id,
    start: witaInstant(blockDate, "08:30"),
    end: witaInstant(blockDate, "10:00"),
    reason: "Jadwal kuliah rutin",
    source: "kuliah",
    createdAt: timestamp
  });
}

// src/infrastructure/memory-store.ts
var ACTIVE_STATUSES = [
  "menunggu",
  "disetujui",
  "berlangsung"
];
function emptyState() {
  return {
    nextId: {},
    dailySeq: {},
    users: [],
    rooms: [],
    organizations: [],
    orgMembers: [],
    reservations: [],
    events: [],
    blocks: []
  };
}
function overlaps(aStart, aEnd, bStart, bEnd) {
  const toMs = (value) => typeof value === "number" ? value : new Date(value).getTime();
  const a0 = toMs(aStart);
  const a1 = toMs(aEnd);
  const b0 = toMs(bStart);
  const b1 = toMs(bEnd);
  return a0 < b1 && b0 < a1;
}
function nextId(state, key) {
  const value = (state.nextId[key] ?? 0) + 1;
  state.nextId[key] = value;
  return value;
}
var MemoryStore = class _MemoryStore {
  constructor(state) {
    this.state = state;
  }
  state;
  queue = Promise.resolve();
  static async open(options = {}) {
    const state = emptyState();
    if (options.seed === true) {
      seedDemoState(state);
    }
    return new _MemoryStore(state);
  }
  async read(reader) {
    await this.queue;
    return reader(this.state);
  }
  async transact(mutator) {
    const task = this.queue.then(async () => {
      const draft = structuredClone(this.state);
      const result = await mutator(draft);
      this.validate(draft);
      this.state = draft;
      return result;
    });
    this.queue = task.then(
      () => void 0,
      () => void 0
    );
    return task;
  }
  async reset() {
    await this.transact((state) => {
      Object.assign(state, emptyState());
    });
  }
  async seedRooms() {
    await this.transact((state) => {
      for (const seed of DEFAULT_ROOMS) {
        const existing = state.rooms.find((room) => room.kode === seed.kode);
        if (existing !== void 0) {
          continue;
        }
        state.rooms.push({
          id: nextId(state, "rooms"),
          kode: seed.kode,
          nama: seed.nama,
          tipe: seed.tipe,
          kapasitas: seed.kapasitas,
          kebijakan: seed.kebijakan,
          aktif: true,
          allowedRoles: []
        });
      }
    });
  }
  validate(state) {
    const active = state.reservations.filter(
      (reservation) => ACTIVE_STATUSES.includes(reservation.status)
    );
    for (let i = 0; i < active.length; i += 1) {
      const current = active[i];
      for (let j = i + 1; j < active.length; j += 1) {
        const other = active[j];
        if (current.roomId === other.roomId && overlaps(current.start, current.end, other.start, other.end)) {
          throw new DomainError(
            "SLOT_CONFLICT",
            "Slot ini beririsan dengan reservasi aktif lain pada ruang yang sama",
            409,
            "mulai"
          );
        }
      }
    }
    const idempotency = /* @__PURE__ */ new Set();
    for (const reservation of state.reservations) {
      const key = `${reservation.userId}:${reservation.idempotencyKey}`;
      if (idempotency.has(key)) {
        throw new DomainError(
          "IDEMPOTENCY_MISMATCH",
          "Kunci idempoten sudah dipakai untuk pengajuan yang berbeda",
          409,
          "idempotencyKey"
        );
      }
      idempotency.add(key);
    }
    for (let i = 0; i < state.blocks.length; i += 1) {
      const current = state.blocks[i];
      for (let j = i + 1; j < state.blocks.length; j += 1) {
        const other = state.blocks[j];
        if (current.roomId === other.roomId && overlaps(current.start, current.end, other.start, other.end)) {
          throw new DomainError(
            "SLOT_CONFLICT",
            "Blokir beririsan dengan blok lain pada ruang tersebut",
            409
          );
        }
      }
    }
  }
};

// src/application/admin-reservations.ts
var ALLOWED_STATUSES = [
  "menunggu",
  "disetujui",
  "ditolak",
  "dibatalkan",
  "semua"
];
function latestReason(state, reservationId) {
  const events = state.events.filter(
    (event) => event.reservationId === reservationId && event.reason !== null
  ).sort((a, b) => {
    const diff = new Date(b.waktu).getTime() - new Date(a.waktu).getTime();
    return diff !== 0 ? diff : b.id - a.id;
  });
  return events[0]?.reason ?? null;
}
function mapReservation(state, reservation) {
  const user = state.users.find(
    (candidate) => candidate.id === reservation.userId
  );
  const room = state.rooms.find(
    (candidate) => candidate.id === reservation.roomId
  );
  return {
    id: BigInt(reservation.id),
    businessId: reservation.businessId,
    roomName: room?.nama ?? "",
    roomCode: room?.kode ?? "",
    pemohonNama: user?.nama ?? "",
    nim: user?.nim ?? null,
    start: new Date(reservation.start),
    end: new Date(reservation.end),
    purpose: reservation.purpose,
    participants: reservation.participants,
    status: reservation.status,
    createdAt: new Date(reservation.createdAt),
    reason: latestReason(state, reservation.id)
  };
}
function validateReason(reason) {
  const value = reason.trim();
  if (value.length < 3 || value.length > 500) {
    throw validationError("Alasan wajib diisi (3\u2013500 karakter)", "reason");
  }
  return value;
}
function parseInstant2(value, field) {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw validationError(
      `${field} wajib berupa waktu ISO-8601 dengan zona waktu`,
      field
    );
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError(`${field} bukan waktu yang valid`, field);
  }
  return date;
}
function findReservation(state, id) {
  const reservation = state.reservations.find(
    (candidate) => candidate.id === Number(id)
  );
  if (reservation === void 0) {
    throw new DomainError("NOT_FOUND", "Pengajuan tidak ditemukan", 404);
  }
  return reservation;
}
function recordEvent(state, reservationId, from, to, reason, actorId = null, waktu = (/* @__PURE__ */ new Date()).toISOString()) {
  state.events.push({
    id: nextId(state, "events"),
    reservationId,
    from,
    to,
    actorId,
    reason,
    waktu
  });
}
async function listReservations(store, status, filters = {}) {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw validationError("Status pengajuan tidak valid", "status");
  }
  return store.read((state) => {
    const query = filters.query?.trim().toLowerCase();
    const date = filters.date?.trim();
    return state.reservations.filter((reservation) => {
      if (status !== "semua" && reservation.status !== status) {
        return false;
      }
      if (date !== void 0 && date !== "") {
        if (witaDateKey(new Date(reservation.start)) !== date) {
          return false;
        }
      }
      if (query !== void 0 && query !== "") {
        const user = state.users.find(
          (candidate) => candidate.id === reservation.userId
        );
        const room = state.rooms.find(
          (candidate) => candidate.id === reservation.roomId
        );
        const haystack = [
          user?.nama ?? "",
          user?.nim ?? "",
          reservation.businessId,
          room?.nama ?? ""
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return diff !== 0 ? diff : a.id - b.id;
    }).slice(0, 100).map((reservation) => mapReservation(state, reservation));
  });
}
async function approveReservation(store, id) {
  return store.transact((state) => {
    const reservation = findReservation(state, id);
    if (reservation.status !== "menunggu") {
      throw new DomainError(
        "INVALID_STATE",
        "Pengajuan ini sudah diproses",
        409
      );
    }
    const blocked = state.blocks.some(
      (block) => block.roomId === reservation.roomId && overlaps(block.start, block.end, reservation.start, reservation.end)
    );
    if (blocked) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Ruang diblokir pada waktu tersebut; pengajuan tidak dapat disetujui",
        409
      );
    }
    const conflict = state.reservations.some(
      (other) => other.id !== reservation.id && other.roomId === reservation.roomId && ACTIVE_STATUSES.includes(other.status) && overlaps(other.start, other.end, reservation.start, reservation.end)
    );
    if (conflict) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Slot sudah dipakai; pengajuan tidak dapat disetujui",
        409
      );
    }
    reservation.status = "disetujui";
    reservation.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    recordEvent(
      state,
      reservation.id,
      "menunggu",
      "disetujui",
      "Disetujui melalui panel petugas",
      null,
      reservation.updatedAt
    );
    return mapReservation(state, reservation);
  });
}
async function rejectReservation(store, id, reason) {
  const alasan = validateReason(reason);
  return store.transact((state) => {
    const reservation = findReservation(state, id);
    if (reservation.status !== "menunggu") {
      throw new DomainError(
        "INVALID_STATE",
        "Pengajuan ini sudah diproses",
        409
      );
    }
    reservation.status = "ditolak";
    reservation.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    recordEvent(
      state,
      reservation.id,
      "menunggu",
      "ditolak",
      alasan,
      null,
      reservation.updatedAt
    );
    return mapReservation(state, reservation);
  });
}
async function cancelReservation(store, id, reason) {
  const alasan = validateReason(reason);
  return store.transact((state) => {
    const reservation = findReservation(state, id);
    if (!["menunggu", "disetujui"].includes(reservation.status)) {
      throw new DomainError(
        "INVALID_STATE",
        "Reservasi ini tidak dapat dibatalkan pada status tersebut",
        409
      );
    }
    const from = reservation.status;
    reservation.status = "dibatalkan";
    reservation.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    recordEvent(
      state,
      reservation.id,
      from,
      "dibatalkan",
      alasan,
      null,
      reservation.updatedAt
    );
    return mapReservation(state, reservation);
  });
}
async function getStats(store) {
  const now = /* @__PURE__ */ new Date();
  const today = witaDateKey(now);
  return store.read((state) => {
    const activeToday = state.reservations.filter(
      (reservation) => ["disetujui", "berlangsung"].includes(reservation.status) && witaDateKey(new Date(reservation.start)) === today
    );
    return {
      pending: state.reservations.filter(
        (reservation) => reservation.status === "menunggu"
      ).length,
      approvedToday: activeToday.length,
      roomsInUseToday: new Set(
        activeToday.map((reservation) => reservation.roomId)
      ).size,
      totalRooms: state.rooms.filter((room) => room.aktif).length
    };
  });
}
async function listAdminRooms(store) {
  return store.read(
    (state) => state.rooms.filter((room) => room.aktif).sort((a, b) => a.kode.localeCompare(b.kode)).map((room) => ({
      id: BigInt(room.id),
      code: room.kode,
      name: room.nama,
      capacity: room.kapasitas,
      policy: room.kebijakan
    }))
  );
}
function mapBlock(state, block) {
  const room = state.rooms.find((candidate) => candidate.id === block.roomId);
  return {
    id: BigInt(block.id),
    roomId: BigInt(block.roomId),
    roomName: room?.nama ?? "",
    roomCode: room?.kode ?? "",
    start: new Date(block.start),
    end: new Date(block.end),
    reason: block.reason,
    source: block.source,
    createdAt: new Date(block.createdAt)
  };
}
async function listBlocks(store) {
  return store.read(
    (state) => state.blocks.filter((block) => new Date(block.end).getTime() >= Date.now()).sort((a, b) => {
      const diff = new Date(a.start).getTime() - new Date(b.start).getTime();
      return diff !== 0 ? diff : a.id - b.id;
    }).slice(0, 100).map((block) => mapBlock(state, block))
  );
}
async function createBlock(store, input) {
  const reason = validateReason(input.reason);
  const start = parseInstant2(input.start, "start");
  const end = parseInstant2(input.end, "end");
  if (end.getTime() <= start.getTime()) {
    throw validationError("Waktu selesai harus setelah waktu mulai", "end");
  }
  return store.transact((state) => {
    const room = state.rooms.find(
      (candidate) => candidate.id === Number(input.roomId)
    );
    if (room === void 0) {
      throw new DomainError("NOT_FOUND", "Ruang tidak ditemukan", 404);
    }
    if (!room.aktif) {
      throw new DomainError("ROOM_UNAVAILABLE", "Ruang sedang tidak aktif", 409);
    }
    const overlappingBlock = state.blocks.some(
      (block2) => block2.roomId === room.id && overlaps(block2.start, block2.end, start, end)
    );
    if (overlappingBlock) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Blokir beririsan dengan blok lain pada ruang tersebut",
        409
      );
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const block = {
      id: nextId(state, "blocks"),
      roomId: room.id,
      start: start.toISOString(),
      end: end.toISOString(),
      reason,
      source: "petugas",
      createdAt: timestamp
    };
    state.blocks.push(block);
    const overlappingReservations = state.reservations.filter(
      (reservation) => reservation.roomId === room.id && ["menunggu", "disetujui"].includes(reservation.status) && overlaps(reservation.start, reservation.end, start, end)
    );
    for (const reservation of overlappingReservations) {
      const from = reservation.status;
      reservation.status = "dibatalkan";
      reservation.updatedAt = timestamp;
      recordEvent(
        state,
        reservation.id,
        from,
        "dibatalkan",
        `Ruang diblokir: ${reason}`,
        null,
        timestamp
      );
    }
    return {
      block: mapBlock(state, block),
      cancelled: overlappingReservations.length
    };
  });
}
async function listEvents(store, limit = 50) {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  return store.read((state) => {
    const sorted = [...state.events].sort((a, b) => {
      const diff = new Date(b.waktu).getTime() - new Date(a.waktu).getTime();
      return diff !== 0 ? diff : b.id - a.id;
    });
    return sorted.slice(0, safeLimit).map((event) => {
      const reservation = state.reservations.find(
        (candidate) => candidate.id === event.reservationId
      );
      const room = state.rooms.find(
        (candidate) => candidate.id === reservation?.roomId
      );
      const actor = state.users.find(
        (candidate) => candidate.id === event.actorId
      );
      return {
        id: BigInt(event.id),
        businessId: reservation?.businessId ?? "",
        roomName: room?.nama ?? "",
        from: event.from,
        to: event.to,
        reason: event.reason,
        actor: actor?.nama ?? (event.to === "menunggu" ? "Pemohon" : "Petugas"),
        waktu: new Date(event.waktu)
      };
    });
  });
}

// src/application/allocate-slot.ts
import { createHash } from "node:crypto";

// src/domain/policy.ts
function parseClock(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
function assertCapacity(participants, capacity) {
  if (!Number.isInteger(participants) || participants <= 0) {
    throw validationError(
      "Jumlah peserta harus bilangan bulat lebih dari 0",
      "peserta"
    );
  }
  if (capacity === null) {
    return;
  }
  if (participants > capacity) {
    throw validationError(
      `Kapasitas ruang ini maksimal ${capacity} orang`,
      "peserta"
    );
  }
}
function assertOperatingHours(range, options = {}) {
  if (options.specialApproval === true) {
    return;
  }
  const { dayOfWeek, minutesOfDay: startMinutes } = range.startWita;
  const endMinutes = range.endWita.minutesOfDay;
  if (dayOfWeek === 0) {
    throw validationError(
      "Hari Minggu hanya dapat dipesan dengan persetujuan khusus",
      "mulai"
    );
  }
  const window = dayOfWeek === 6 ? config.operatingHours.saturday : config.operatingHours.weekday;
  const open = parseClock(window.open);
  const close = parseClock(window.close);
  if (startMinutes < open || endMinutes > close) {
    throw validationError(
      `Di luar jam operasional (${window.open}-${window.close} WITA)`,
      "mulai"
    );
  }
}
function countWorkingDays(fromDateKey, toDateKey) {
  const from = Date.parse(`${fromDateKey}T00:00:00Z`);
  const to = Date.parse(`${toDateKey}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) {
    return 0;
  }
  let count = 0;
  for (let cursor = from + 864e5; cursor <= to; cursor += 864e5) {
    const day = new Date(cursor).getUTCDay();
    if (day >= 1 && day <= 5) {
      count += 1;
    }
  }
  return count;
}
function requiredWorkingDays(policy, roomType, purpose) {
  const isEvent = roomType === "aula" || purpose === "acara";
  const approvalDays = policy === "terbuka" ? 0 : config.leadTime.approvalWorkingDays;
  return Math.max(approvalDays, isEvent ? config.leadTime.eventWorkingDays : 0);
}
function assertLeadTime(range, options) {
  const minutesUntilStart = (range.start.getTime() - options.now.getTime()) / 6e4;
  if (minutesUntilStart <= 0) {
    throw validationError(
      "Waktu mulai sudah lewat",
      "mulai"
    );
  }
  const workingDays = requiredWorkingDays(
    options.policy,
    options.roomType,
    options.purpose
  );
  if (workingDays > 0 && countWorkingDays(witaDateKey(options.now), range.startWita.dateKey) < workingDays) {
    throw validationError(
      `Pengajuan minimal ${workingDays} hari kerja sebelum waktu mulai`,
      "mulai"
    );
  }
  if (options.policy === "terbuka" && workingDays === 0 && minutesUntilStart < config.leadTime.openRoomMinutes) {
    throw validationError(
      `Pengajuan minimal ${config.leadTime.openRoomMinutes} menit sebelum waktu mulai`,
      "mulai"
    );
  }
  if (options.policy !== "terbuka" && minutesUntilStart < config.leadTime.pendingGuardHours * 60) {
    throw validationError(
      `Pengajuan ruang persetujuan minimal ${config.leadTime.pendingGuardHours} jam sebelum waktu mulai`,
      "mulai"
    );
  }
}

// src/application/allocate-slot.ts
function requestHash(input) {
  return createHash("sha256").update(
    JSON.stringify({
      roomId: String(input.roomId),
      orgId: input.orgId === void 0 || input.orgId === null ? null : String(input.orgId),
      start: input.start,
      end: input.end,
      purpose: input.purpose,
      participants: input.participants,
      specialApproval: input.specialApproval ?? false,
      pemohonNama: input.pemohonNama?.trim() ?? null,
      nim: input.nim?.trim() ?? null
    })
  ).digest("hex");
}
function mapReservation2(row, identity) {
  return {
    id: BigInt(row.id),
    businessId: row.businessId,
    roomId: BigInt(row.roomId),
    userId: BigInt(row.userId),
    orgId: row.orgId === null ? null : BigInt(row.orgId),
    start: new Date(row.start),
    end: new Date(row.end),
    purpose: row.purpose,
    participants: row.participants,
    status: row.status,
    pemohonNama: identity.pemohonNama,
    nim: identity.nim
  };
}
function nextBusinessId(state, dayKey) {
  const sequence = (state.dailySeq[dayKey] ?? 0) + 1;
  state.dailySeq[dayKey] = sequence;
  return `RSV-${dayKey.replaceAll("-", "")}-${String(sequence).padStart(4, "0")}`;
}
async function allocateSlot(store, input) {
  if (!input.idempotencyKey || input.idempotencyKey.trim() === "") {
    throw validationError("Kunci idempoten wajib diisi", "idempotencyKey");
  }
  const nim = input.nim?.trim();
  const pemohonNama = input.pemohonNama?.trim();
  if (nim !== void 0) {
    if (!/^\d{5,20}$/.test(nim)) {
      throw validationError("NIM harus 5\u201320 digit angka", "nim");
    }
    if (pemohonNama === void 0 || pemohonNama.length < 2) {
      throw validationError("Nama pemohon minimal 2 karakter", "pemohonNama");
    }
  } else if (input.userId === void 0) {
    throw validationError(
      "Nama dan NIM pemohon wajib diisi",
      "pemohonNama"
    );
  }
  const now = input.now ?? /* @__PURE__ */ new Date();
  const orgId = input.orgId === void 0 || input.orgId === null ? null : Number(input.orgId);
  const hash = requestHash(input);
  return store.transact((state) => {
    let resolvedUserId;
    if (nim !== void 0) {
      const existingUser = state.users.find((user2) => user2.nim === nim);
      if (existingUser !== void 0) {
        existingUser.nama = pemohonNama;
        resolvedUserId = existingUser.id;
      } else {
        resolvedUserId = nextId(state, "users");
        state.users.push({
          id: resolvedUserId,
          nama: pemohonNama,
          email: `${nim}@idbbali.ac.id`,
          peran: "mahasiswa",
          status: "aktif",
          nim
        });
      }
    } else {
      resolvedUserId = Number(input.userId);
    }
    const user = state.users.find((candidate) => candidate.id === resolvedUserId);
    if (user === void 0) {
      throw new DomainError("NOT_FOUND", "Pengguna tidak ditemukan", 404);
    }
    if (user.status !== "aktif") {
      throw new DomainError("FORBIDDEN", "Akun tidak aktif", 403);
    }
    const identity = { pemohonNama: user.nama, nim: user.nim };
    const room = state.rooms.find(
      (candidate) => candidate.id === Number(input.roomId)
    );
    if (room === void 0) {
      throw new DomainError("NOT_FOUND", "Ruang tidak ditemukan", 404);
    }
    const existing = state.reservations.find(
      (reservation2) => reservation2.userId === resolvedUserId && reservation2.idempotencyKey === input.idempotencyKey
    );
    if (existing !== void 0) {
      if (existing.requestHash !== hash) {
        throw new DomainError(
          "IDEMPOTENCY_MISMATCH",
          "Kunci idempoten sudah dipakai untuk pengajuan yang berbeda",
          409,
          "idempotencyKey"
        );
      }
      return { reservation: mapReservation2(existing, identity), replayed: true };
    }
    if (input.specialApproval === true && !["petugas", "admin"].includes(user.peran)) {
      throw new DomainError(
        "FORBIDDEN",
        "Persetujuan khusus hanya dapat diberikan petugas atau admin",
        403
      );
    }
    if (!room.aktif) {
      throw new DomainError("ROOM_UNAVAILABLE", "Ruang sedang tidak aktif", 409);
    }
    if (room.kebijakan === "khusus" && !room.allowedRoles.includes(user.peran)) {
      throw new DomainError(
        "FORBIDDEN",
        "Peran Anda tidak diizinkan memakai ruang ini",
        403
      );
    }
    if (orgId !== null) {
      const membership = state.orgMembers.some(
        (member) => member.userId === resolvedUserId && member.orgId === orgId
      );
      if (!membership) {
        throw new DomainError(
          "FORBIDDEN",
          "Anda bukan pengurus organisasi tersebut",
          403
        );
      }
    }
    const range = parseTimeRange(input.start, input.end);
    assertCapacity(input.participants, room.kapasitas);
    assertOperatingHours(range, {
      specialApproval: input.specialApproval ?? false
    });
    assertLeadTime(range, {
      now,
      policy: room.kebijakan,
      roomType: room.tipe,
      purpose: input.purpose
    });
    const blockConflict = state.blocks.some(
      (block) => block.roomId === room.id && overlaps(block.start, block.end, range.start, range.end)
    );
    if (blockConflict) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Slot ini beririsan dengan jadwal kuliah atau blokir petugas",
        409,
        "mulai"
      );
    }
    const conflicting = state.reservations.some(
      (reservation2) => reservation2.roomId === room.id && ACTIVE_STATUSES.includes(reservation2.status) && overlaps(reservation2.start, reservation2.end, range.start, range.end)
    );
    if (conflicting) {
      throw new DomainError(
        "SLOT_CONFLICT",
        "Slot ini baru saja dipesan. Pilih jam lain atau ruang lain.",
        409,
        "mulai"
      );
    }
    const isPersonalQuotaRoom = orgId === null && config.quota.roomTypes.includes(room.tipe);
    if (isPersonalQuotaRoom) {
      const durationMinutes = (range.end.getTime() - range.start.getTime()) / 6e4;
      if (durationMinutes > config.quota.maxHoursPerReservation * 60) {
        throw validationError(
          `Reservasi pribadi pada ruang ini maksimal ${config.quota.maxHoursPerReservation} jam`,
          "selesai"
        );
      }
      const activeCount = state.reservations.filter(
        (reservation2) => reservation2.userId === resolvedUserId && ACTIVE_STATUSES.includes(reservation2.status)
      ).length;
      if (activeCount >= config.quota.maxActivePersonal) {
        throw new DomainError(
          "QUOTA_EXCEEDED",
          `Maksimal ${config.quota.maxActivePersonal} reservasi aktif pribadi. Selesaikan atau batalkan salah satu sebelum mengajukan lagi.`,
          422
        );
      }
    }
    const status = room.kebijakan === "terbuka" ? "disetujui" : "menunggu";
    const businessId = nextBusinessId(state, range.startWita.dateKey);
    const timestamp = now.toISOString();
    const reservation = {
      id: nextId(state, "reservations"),
      businessId,
      roomId: room.id,
      userId: resolvedUserId,
      orgId,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      purpose: input.purpose,
      participants: input.participants,
      status,
      idempotencyKey: input.idempotencyKey,
      requestHash: hash,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    state.reservations.push(reservation);
    state.events.push({
      id: nextId(state, "events"),
      reservationId: reservation.id,
      from: null,
      to: status,
      actorId: resolvedUserId,
      reason: null,
      waktu: timestamp
    });
    return {
      reservation: mapReservation2(reservation, identity),
      replayed: false
    };
  });
}

// src/application/calendar.ts
var MAX_RANGE_MS = 92 * 24 * 60 * 60 * 1e3;
async function listCalendar(store, query) {
  const from = query.from.getTime();
  const to = query.to.getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    throw validationError(
      "Rentang kalender harus memiliki waktu selesai setelah waktu mulai",
      "to"
    );
  }
  if (to - from > MAX_RANGE_MS) {
    throw validationError("Rentang kalender maksimal 92 hari", "to");
  }
  return store.read((state) => {
    const roomFilter = query.roomId === void 0 ? void 0 : Number(query.roomId);
    const reservations = state.reservations.filter((reservation) => {
      if (!ACTIVE_STATUSES.includes(reservation.status)) {
        return false;
      }
      if (roomFilter !== void 0 && reservation.roomId !== roomFilter) {
        return false;
      }
      const room = state.rooms.find(
        (candidate) => candidate.id === reservation.roomId
      );
      if (room === void 0 || !room.aktif) {
        return false;
      }
      return overlaps(reservation.start, reservation.end, from, to);
    }).map((reservation) => {
      const room = state.rooms.find(
        (candidate) => candidate.id === reservation.roomId
      );
      return {
        kind: "reservasi",
        id: BigInt(reservation.id),
        roomId: BigInt(reservation.roomId),
        roomCode: room.kode,
        roomName: room.nama,
        start: new Date(reservation.start),
        end: new Date(reservation.end),
        title: reservation.purpose,
        status: reservation.status
      };
    });
    const blocks = state.blocks.filter((block) => {
      if (roomFilter !== void 0 && block.roomId !== roomFilter) {
        return false;
      }
      const room = state.rooms.find(
        (candidate) => candidate.id === block.roomId
      );
      if (room === void 0 || !room.aktif) {
        return false;
      }
      return overlaps(block.start, block.end, from, to);
    }).map((block) => {
      const room = state.rooms.find(
        (candidate) => candidate.id === block.roomId
      );
      return {
        kind: "blokir",
        id: BigInt(block.id),
        roomId: BigInt(block.roomId),
        roomCode: room.kode,
        roomName: room.nama,
        start: new Date(block.start),
        end: new Date(block.end),
        title: "Ruang diblokir",
        status: "blokir"
      };
    });
    return [...reservations, ...blocks].sort((a, b) => {
      const diff = a.start.getTime() - b.start.getTime();
      if (diff !== 0) return diff;
      if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
      return Number(a.id - b.id);
    });
  });
}

// src/http/event-hub.ts
var EventHub = class {
  listeners = /* @__PURE__ */ new Set();
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  publish(type, data = {}) {
    const event = {
      type,
      data,
      at: (/* @__PURE__ */ new Date()).toISOString()
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
      }
    }
  }
  get size() {
    return this.listeners.size;
  }
};

// src/http/app.ts
function headerValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
function parseId(value, field) {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    throw validationError(`${field} harus berupa ID angka`, field);
  }
  return raw;
}
function parseString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw validationError(`${field} wajib diisi`, field);
  }
  return value;
}
function parseIntValue(value, field) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw validationError(`${field} harus bilangan bulat`, field);
  }
  return value;
}
function parseOptionalString(value, field) {
  if (value === void 0 || value === null) {
    return void 0;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw validationError(`${field} wajib diisi`, field);
  }
  return value;
}
function parseOptionalBoolean(value, field) {
  if (value === void 0) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw validationError(`${field} harus boolean`, field);
  }
  return value;
}
function safeEqual(given, expected) {
  const givenBuffer = Buffer.from(given);
  const expectedBuffer = Buffer.from(expected);
  return givenBuffer.length === expectedBuffer.length && timingSafeEqual(givenBuffer, expectedBuffer);
}
function requireAdmin(code) {
  if (code === void 0 || code.trim() === "") {
    throw new DomainError("UNAUTHORIZED", "Kode admin diperlukan", 401);
  }
  if (!safeEqual(code, config.adminCode)) {
    throw new DomainError("UNAUTHORIZED", "Kode admin salah", 401);
  }
}
function serializeAdminReservation(reservation) {
  return {
    id: reservation.id.toString(),
    businessId: reservation.businessId,
    roomName: reservation.roomName,
    roomCode: reservation.roomCode,
    pemohonNama: reservation.pemohonNama,
    nim: reservation.nim,
    start: reservation.start.toISOString(),
    end: reservation.end.toISOString(),
    purpose: reservation.purpose,
    participants: reservation.participants,
    status: reservation.status,
    createdAt: reservation.createdAt.toISOString(),
    reason: reservation.reason
  };
}
function serializeBlock(block) {
  return {
    id: block.id.toString(),
    roomId: block.roomId.toString(),
    roomName: block.roomName,
    roomCode: block.roomCode,
    start: block.start.toISOString(),
    end: block.end.toISOString(),
    reason: block.reason,
    source: block.source,
    createdAt: block.createdAt.toISOString()
  };
}
function serializeEvent(event) {
  return {
    id: event.id.toString(),
    businessId: event.businessId,
    roomName: event.roomName,
    from: event.from,
    to: event.to,
    reason: event.reason,
    actor: event.actor,
    waktu: event.waktu.toISOString()
  };
}
function serializeRoom(room) {
  return {
    id: room.id.toString(),
    code: room.code,
    name: room.name,
    capacity: room.capacity,
    policy: room.policy
  };
}
function serializeStats(stats) {
  return {
    pending: stats.pending,
    approvedToday: stats.approvedToday,
    roomsInUseToday: stats.roomsInUseToday,
    totalRooms: stats.totalRooms
  };
}
function serializeCalendarEvent(event) {
  return {
    kind: event.kind,
    id: event.id.toString(),
    roomId: event.roomId.toString(),
    roomCode: event.roomCode,
    roomName: event.roomName,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    title: event.title,
    status: event.status
  };
}
function parseCalendarInstant(value, field) {
  if (value === void 0 || value.trim() === "") {
    throw validationError(`${field} wajib diisi`, field);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError(`${field} tidak valid`, field);
  }
  return date;
}
function serializeReservation(reservation) {
  return {
    id: reservation.id.toString(),
    businessId: reservation.businessId,
    roomId: reservation.roomId.toString(),
    userId: reservation.userId.toString(),
    orgId: reservation.orgId === null ? null : reservation.orgId.toString(),
    start: reservation.start.toISOString(),
    end: reservation.end.toISOString(),
    purpose: reservation.purpose,
    participants: reservation.participants,
    status: reservation.status,
    pemohonNama: reservation.pemohonNama,
    nim: reservation.nim
  };
}
function createApp(deps) {
  const app = Fastify({ logger: false });
  const eventHub = new EventHub();
  const sseClients = /* @__PURE__ */ new Set();
  app.addHook("onClose", async () => {
    for (const client of sseClients) {
      client.cleanup();
      if (!client.raw.writableEnded) client.raw.end();
    }
    sseClients.clear();
  });
  const publicRoot = path.resolve(process.cwd(), "public");
  if (existsSync(publicRoot)) {
    app.register(fastifyStatic, {
      root: publicRoot,
      prefix: "/"
    });
  }
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/login", async (_request, reply) => {
    return reply.sendFile("login.html");
  });
  app.post("/auth/login", async (request, reply) => {
    const body = request.body;
    if (typeof body !== "object" || body === null) {
      throw validationError("Body wajib berupa objek JSON");
    }
    const input = body;
    const role = input.role;
    if (role !== "form" && role !== "admin") {
      throw validationError("Role login tidak valid", "role");
    }
    const email = typeof input.email === "string" ? input.email.trim() : "";
    const nim = typeof input.nim === "string" ? input.nim.trim() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const normalizedEmail = email.toLowerCase();
    const users = await deps.store.read((state) => state.users);
    if (role === "form") {
      if (email === "") {
        throw validationError("Email wajib diisi", "email");
      }
      if (nim === "" && password === "") {
        throw validationError("NIM atau password wajib diisi", "nim");
      }
      const expectedEmail = config.formEmail.trim().toLowerCase();
      const acceptedEmails = expectedEmail.includes("@") ? [expectedEmail] : [expectedEmail, expectedEmail.replace(/gmail\.com$/, "@gmail.com")];
      const legacyEmail = acceptedEmails.some(
        (candidate) => candidate === normalizedEmail
      );
      const legacyMatch = legacyEmail && (nim !== "" && nim === config.formNim || nim === "" && password !== "" && password === config.formNim);
      const demoMatch2 = normalizedEmail === DEMO_STUDENT.email.toLowerCase() && (nim !== "" && nim === DEMO_STUDENT.nim || password !== "" && password === DEMO_STUDENT.password);
      const seeded = users.find(
        (user) => user.email.trim().toLowerCase() === normalizedEmail && user.status === "aktif"
      );
      const seededMatch = seeded !== void 0 && (nim !== "" && seeded.nim !== null && nim === seeded.nim.trim() || password !== "" && seeded.password !== void 0 && password === seeded.password);
      if (!legacyMatch && !demoMatch2 && !seededMatch) {
        throw new DomainError("UNAUTHORIZED", "Email atau NIM salah", 401);
      }
      return reply.send({ data: { role } });
    }
    if (password === "") {
      throw validationError("Password wajib diisi", "password");
    }
    const codeMatch = password === config.adminCode;
    const demoMatch = password === DEMO_ADMIN.password && (normalizedEmail === "" || normalizedEmail === DEMO_ADMIN.email.toLowerCase());
    const staffMatch = users.some(
      (user) => ["admin", "petugas"].includes(user.peran) && user.status === "aktif" && user.password !== void 0 && password === user.password && (normalizedEmail === "" || normalizedEmail === user.email.trim().toLowerCase())
    );
    if (!codeMatch && !demoMatch && !staffMatch) {
      throw new DomainError("UNAUTHORIZED", "Password salah", 401);
    }
    return reply.send({ data: { role } });
  });
  app.get("/events", (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    });
    reply.raw.write("retry: 2500\n\n");
    const unsubscribe = eventHub.subscribe((event) => {
      if (reply.raw.writableEnded) return;
      reply.raw.write(
        `event: ${event.type}
data: ${JSON.stringify(event)}

`
      );
    });
    const heartbeat = setInterval(() => {
      if (!reply.raw.writableEnded) reply.raw.write(": ping\n\n");
    }, 15e3);
    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      sseClients.delete(client);
    };
    const client = { raw: reply.raw, cleanup };
    sseClients.add(client);
    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);
  });
  app.get("/admin", async (_request, reply) => reply.redirect("/#admin"));
  app.get("/admin/stats", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));
    return reply.send({ data: serializeStats(await getStats(deps.store)) });
  });
  app.get("/admin/rooms", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));
    const data = await listAdminRooms(deps.store);
    return reply.send({ data: data.map(serializeRoom) });
  });
  app.get("/admin/reservations", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));
    const query = request.query;
    const status = query.status ?? "menunggu";
    const data = await listReservations(deps.store, status, {
      query: query.q,
      date: query.date
    });
    return reply.send({ data: data.map(serializeAdminReservation) });
  });
  app.get("/admin/blocks", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));
    const data = await listBlocks(deps.store);
    return reply.send({ data: data.map(serializeBlock) });
  });
  app.post("/admin/blocks", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));
    const body = request.body;
    if (typeof body !== "object" || body === null) {
      throw validationError("Body wajib berupa objek JSON");
    }
    const input = body;
    const result = await createBlock(deps.store, {
      roomId: parseId(input.roomId, "roomId"),
      start: parseString(input.start, "start"),
      end: parseString(input.end, "end"),
      reason: parseString(input.reason, "reason")
    });
    eventHub.publish("schedule-updated", {
      kind: "block",
      roomCode: result.block.roomCode,
      cancelled: result.cancelled
    });
    return reply.status(201).send({ data: serializeBlock(result.block), cancelled: result.cancelled });
  });
  app.get("/admin/events", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));
    const query = request.query;
    const limit = query.limit === void 0 ? 50 : Number(query.limit);
    const data = await listEvents(
      deps.store,
      Number.isFinite(limit) ? limit : 50
    );
    return reply.send({ data: data.map(serializeEvent) });
  });
  app.post("/admin/reservations/:id/approve", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));
    const params = request.params;
    const id = parseId(params.id, "id");
    const data = await approveReservation(deps.store, id);
    eventHub.publish("reservation-updated", {
      businessId: data.businessId,
      roomCode: data.roomCode,
      status: data.status
    });
    return reply.send({ data: serializeAdminReservation(data) });
  });
  app.post("/admin/reservations/:id/cancel", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));
    const params = request.params;
    const id = parseId(params.id, "id");
    const body = request.body;
    if (typeof body !== "object" || body === null) {
      throw validationError("Body wajib berupa objek JSON");
    }
    const reason = parseString(
      body.reason,
      "reason"
    );
    const data = await cancelReservation(deps.store, id, reason);
    eventHub.publish("reservation-updated", {
      businessId: data.businessId,
      roomCode: data.roomCode,
      status: data.status
    });
    return reply.send({ data: serializeAdminReservation(data) });
  });
  app.post("/admin/reservations/:id/reject", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));
    const params = request.params;
    const id = parseId(params.id, "id");
    const body = request.body;
    if (typeof body !== "object" || body === null) {
      throw validationError("Body wajib berupa objek JSON");
    }
    const reason = parseString(
      body.reason,
      "reason"
    );
    const data = await rejectReservation(deps.store, id, reason);
    eventHub.publish("reservation-updated", {
      businessId: data.businessId,
      roomCode: data.roomCode,
      status: data.status
    });
    return reply.send({ data: serializeAdminReservation(data) });
  });
  app.get("/calendar", async (request, reply) => {
    const query = request.query;
    const from = parseCalendarInstant(query.from, "from");
    const to = parseCalendarInstant(query.to, "to");
    const roomId = query.roomId === void 0 || query.roomId === "" ? void 0 : BigInt(parseId(query.roomId, "roomId"));
    const data = await listCalendar(
      deps.store,
      roomId === void 0 ? { from, to } : { from, to, roomId }
    );
    return reply.send({ data: data.map(serializeCalendarEvent) });
  });
  app.post("/reservations", async (request, reply) => {
    const body = request.body;
    if (typeof body !== "object" || body === null) {
      throw validationError("Body wajib berupa objek JSON");
    }
    const input = body;
    const idempotencyKey = headerValue(request.headers["idempotency-key"]);
    if (idempotencyKey === void 0 || idempotencyKey.trim() === "") {
      throw validationError(
        "Header idempotency-key wajib diisi",
        "idempotencyKey"
      );
    }
    const userIdHeader = headerValue(request.headers["x-user-id"]);
    const pemohonNama = parseOptionalString(input.pemohonNama, "pemohonNama");
    const nim = parseOptionalString(input.nim, "nim");
    if (nim === void 0 && userIdHeader === void 0) {
      throw validationError(
        "Nama dan NIM pemohon wajib diisi",
        "pemohonNama"
      );
    }
    const userId = userIdHeader === void 0 ? void 0 : BigInt(parseId(userIdHeader, "x-user-id"));
    const roomId = BigInt(parseId(input.roomId, "roomId"));
    const start = parseString(input.start, "start");
    const end = parseString(input.end, "end");
    const purpose = parseString(input.purpose, "purpose");
    const participants = parseIntValue(input.participants, "participants");
    const orgId = input.orgId === void 0 || input.orgId === null ? null : BigInt(parseId(input.orgId, "orgId"));
    const specialApproval = parseOptionalBoolean(
      input.specialApproval,
      "specialApproval"
    );
    const result = await allocateSlot(deps.store, {
      userId,
      pemohonNama,
      nim,
      roomId,
      orgId,
      start,
      end,
      purpose,
      participants,
      idempotencyKey,
      specialApproval,
      now: deps.now?.() ?? /* @__PURE__ */ new Date()
    });
    if (!result.replayed) {
      eventHub.publish("reservation-created", {
        businessId: result.reservation.businessId,
        roomId: result.reservation.roomId.toString(),
        status: result.reservation.status
      });
    }
    return reply.status(result.replayed ? 200 : 201).send({ data: serializeReservation(result.reservation), replayed: result.replayed });
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.httpStatus).send({
        error: {
          code: error.code,
          message: error.message,
          ...error.field === void 0 ? {} : { field: error.field }
        }
      });
    }
    const statusCode = error.statusCode;
    if (statusCode !== void 0 && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: { code: "VALIDATION_ERROR", message: "Permintaan tidak valid" }
      });
    }
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan pada server"
      }
    });
  });
  return app;
}

// src/serverless.ts
var appPromise = null;
async function getApp() {
  if (appPromise === null) {
    appPromise = (async () => {
      const store = await MemoryStore.open({ seed: true });
      const app = createApp({ store });
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}
async function handler(request, response) {
  response.setHeader("x-idb-runtime", "demo-serverless-v3");
  try {
    const app = await getApp();
    app.server.emit("request", request, response);
  } catch (error) {
    appPromise = null;
    const message = error instanceof Error ? error.message : String(error);
    console.error("FUNCTION_INIT_ERROR", error);
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({
          error: { code: "FUNCTION_INIT_ERROR", message }
        })
      );
    }
  }
}
export {
  handler as default
};
