import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import {
  approveReservation,
  cancelReservation,
  createBlock,
  getStats,
  listAdminRooms,
  listBlocks,
  listEvents,
  listReservations,
  rejectReservation,
  type AdminBlock,
  type AdminEvent,
  type AdminFilterStatus,
  type AdminReservation,
  type AdminRoom,
  type AdminStats,
} from "../application/admin-reservations";
import {
  allocateSlot,
  type AllocatedReservation,
} from "../application/allocate-slot";
import { listCalendar, type CalendarEvent } from "../application/calendar";
import { config } from "../config";
import { DomainError, validationError } from "../domain/errors";
import type { MemoryStore } from "../infrastructure/memory-store";
import { EventHub } from "./event-hub";

export interface AppDependencies {
  store: MemoryStore;
  now?: () => Date;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseId(value: unknown, field: string): string {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    throw validationError(`${field} harus berupa ID angka`, field);
  }
  return raw;
}

function parseString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw validationError(`${field} wajib diisi`, field);
  }
  return value;
}

function parseIntValue(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw validationError(`${field} harus bilangan bulat`, field);
  }
  return value;
}

function parseOptionalString(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw validationError(`${field} wajib diisi`, field);
  }
  return value;
}

function parseOptionalBoolean(value: unknown, field: string): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw validationError(`${field} harus boolean`, field);
  }
  return value;
}

function safeEqual(given: string, expected: string): boolean {
  const givenBuffer = Buffer.from(given);
  const expectedBuffer = Buffer.from(expected);
  return (
    givenBuffer.length === expectedBuffer.length &&
    timingSafeEqual(givenBuffer, expectedBuffer)
  );
}

function requireAdmin(code: string | undefined): void {
  if (code === undefined || code.trim() === "") {
    throw new DomainError("UNAUTHORIZED", "Kode admin diperlukan", 401);
  }

  if (!safeEqual(code, config.adminCode)) {
    throw new DomainError("UNAUTHORIZED", "Kode admin salah", 401);
  }
}

function serializeAdminReservation(reservation: AdminReservation) {
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
    reason: reservation.reason,
  };
}

function serializeBlock(block: AdminBlock) {
  return {
    id: block.id.toString(),
    roomId: block.roomId.toString(),
    roomName: block.roomName,
    roomCode: block.roomCode,
    start: block.start.toISOString(),
    end: block.end.toISOString(),
    reason: block.reason,
    source: block.source,
    createdAt: block.createdAt.toISOString(),
  };
}

function serializeEvent(event: AdminEvent) {
  return {
    id: event.id.toString(),
    businessId: event.businessId,
    roomName: event.roomName,
    from: event.from,
    to: event.to,
    reason: event.reason,
    actor: event.actor,
    waktu: event.waktu.toISOString(),
  };
}

function serializeRoom(room: AdminRoom) {
  return {
    id: room.id.toString(),
    code: room.code,
    name: room.name,
    capacity: room.capacity,
    policy: room.policy,
  };
}

function serializeStats(stats: AdminStats) {
  return {
    pending: stats.pending,
    approvedToday: stats.approvedToday,
    roomsInUseToday: stats.roomsInUseToday,
    totalRooms: stats.totalRooms,
  };
}

function serializeCalendarEvent(event: CalendarEvent) {
  return {
    kind: event.kind,
    id: event.id.toString(),
    roomId: event.roomId.toString(),
    roomCode: event.roomCode,
    roomName: event.roomName,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    title: event.title,
    status: event.status,
  };
}

function parseCalendarInstant(
  value: string | undefined,
  field: string,
): Date {
  if (value === undefined || value.trim() === "") {
    throw validationError(`${field} wajib diisi`, field);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError(`${field} tidak valid`, field);
  }
  return date;
}

function serializeReservation(reservation: AllocatedReservation) {
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
    nim: reservation.nim,
  };
}

export function createApp(deps: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: false });
  const eventHub = new EventHub();
  const sseClients = new Set<{
    raw: import("node:http").ServerResponse;
    cleanup: () => void;
  }>();

  app.addHook("onClose", async () => {
    for (const client of sseClients) {
      client.cleanup();
      if (!client.raw.writableEnded) client.raw.end();
    }
    sseClients.clear();
  });

  app.register(fastifyStatic, {
    root: path.resolve(process.cwd(), "public"),
    prefix: "/",
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/login", async (_request, reply) => {
    return reply.sendFile("login.html");
  });

  app.post("/auth/login", async (request, reply) => {
    const body = request.body;
    if (typeof body !== "object" || body === null) {
      throw validationError("Body wajib berupa objek JSON");
    }
    const input = body as Record<string, unknown>;
    const role = input.role;
    if (role !== "form" && role !== "admin") {
      throw validationError("Role login tidak valid", "role");
    }
    const email = typeof input.email === "string" ? input.email.trim() : "";
    const nim = typeof input.nim === "string" ? input.nim.trim() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const users = await deps.store.read((state) => state.users);

    if (role === "form") {
      if (email === "") {
        throw validationError("Email wajib diisi", "email");
      }
      if (nim === "" && password === "") {
        throw validationError("NIM atau password wajib diisi", "nim");
      }
      const normalizedEmail = email.toLowerCase();
      const expectedEmail = config.formEmail.trim().toLowerCase();
      const acceptedEmails = expectedEmail.includes("@")
        ? [expectedEmail]
        : [expectedEmail, expectedEmail.replace(/gmail\.com$/, "@gmail.com")];
      const legacyEmail = acceptedEmails.some((candidate) =>
        safeEqual(normalizedEmail, candidate),
      );
      const legacyMatch =
        legacyEmail &&
        ((nim !== "" && safeEqual(nim, config.formNim)) ||
          (nim === "" && password !== "" && safeEqual(password, config.formNim)));

      const seeded = users.find(
        (user) =>
          user.email.toLowerCase() === normalizedEmail &&
          user.status === "aktif",
      );
      const seededMatch =
        seeded !== undefined &&
        ((nim !== "" && seeded.nim !== null && safeEqual(nim, seeded.nim)) ||
          (password !== "" &&
            seeded.password !== undefined &&
            safeEqual(password, seeded.password)));

      if (!legacyMatch && !seededMatch) {
        throw new DomainError("UNAUTHORIZED", "Email atau NIM salah", 401);
      }
      return reply.send({ data: { role } });
    }

    if (password === "") {
      throw validationError("Password wajib diisi", "password");
    }
    const normalizedEmail = email.toLowerCase();
    const codeMatch = safeEqual(password, config.adminCode);
    const staffMatch = users.some(
      (user) =>
        ["admin", "petugas"].includes(user.peran) &&
        user.status === "aktif" &&
        user.password !== undefined &&
        safeEqual(password, user.password) &&
        (normalizedEmail === "" ||
          safeEqual(normalizedEmail, user.email.toLowerCase())),
    );
    if (!codeMatch && !staffMatch) {
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
      "x-accel-buffering": "no",
    });
    reply.raw.write("retry: 2500\n\n");

    const unsubscribe = eventHub.subscribe((event) => {
      if (reply.raw.writableEnded) return;
      reply.raw.write(
        `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
      );
    });
    const heartbeat = setInterval(() => {
      if (!reply.raw.writableEnded) reply.raw.write(": ping\n\n");
    }, 15000);
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

    const query = request.query as {
      status?: string;
      q?: string;
      date?: string;
    };
    const status = (query.status ?? "menunggu") as AdminFilterStatus;
    const data = await listReservations(deps.store, status, {
      query: query.q,
      date: query.date,
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
    const input = body as Record<string, unknown>;
    const result = await createBlock(deps.store, {
      roomId: parseId(input.roomId, "roomId"),
      start: parseString(input.start, "start"),
      end: parseString(input.end, "end"),
      reason: parseString(input.reason, "reason"),
    });

    eventHub.publish("schedule-updated", {
      kind: "block",
      roomCode: result.block.roomCode,
      cancelled: result.cancelled,
    });

    return reply
      .status(201)
      .send({ data: serializeBlock(result.block), cancelled: result.cancelled });
  });

  app.get("/admin/events", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));
    const query = request.query as { limit?: string };
    const limit = query.limit === undefined ? 50 : Number(query.limit);
    const data = await listEvents(
      deps.store,
      Number.isFinite(limit) ? limit : 50,
    );
    return reply.send({ data: data.map(serializeEvent) });
  });

  app.post("/admin/reservations/:id/approve", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));

    const params = request.params as { id?: string };
    const id = parseId(params.id, "id");
    const data = await approveReservation(deps.store, id);
    eventHub.publish("reservation-updated", {
      businessId: data.businessId,
      roomCode: data.roomCode,
      status: data.status,
    });

    return reply.send({ data: serializeAdminReservation(data) });
  });

  app.post("/admin/reservations/:id/cancel", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));

    const params = request.params as { id?: string };
    const id = parseId(params.id, "id");
    const body = request.body;
    if (typeof body !== "object" || body === null) {
      throw validationError("Body wajib berupa objek JSON");
    }
    const reason = parseString(
      (body as Record<string, unknown>).reason,
      "reason",
    );
    const data = await cancelReservation(deps.store, id, reason);
    eventHub.publish("reservation-updated", {
      businessId: data.businessId,
      roomCode: data.roomCode,
      status: data.status,
    });

    return reply.send({ data: serializeAdminReservation(data) });
  });

  app.post("/admin/reservations/:id/reject", async (request, reply) => {
    requireAdmin(headerValue(request.headers["x-admin-code"]));

    const params = request.params as { id?: string };
    const id = parseId(params.id, "id");
    const body = request.body;
    if (typeof body !== "object" || body === null) {
      throw validationError("Body wajib berupa objek JSON");
    }
    const reason = parseString(
      (body as Record<string, unknown>).reason,
      "reason",
    );
    const data = await rejectReservation(deps.store, id, reason);
    eventHub.publish("reservation-updated", {
      businessId: data.businessId,
      roomCode: data.roomCode,
      status: data.status,
    });

    return reply.send({ data: serializeAdminReservation(data) });
  });

  app.get("/calendar", async (request, reply) => {
    const query = request.query as {
      from?: string;
      to?: string;
      roomId?: string;
    };
    const from = parseCalendarInstant(query.from, "from");
    const to = parseCalendarInstant(query.to, "to");
    const roomId =
      query.roomId === undefined || query.roomId === ""
        ? undefined
        : BigInt(parseId(query.roomId, "roomId"));
    const data = await listCalendar(
      deps.store,
      roomId === undefined ? { from, to } : { from, to, roomId },
    );
    return reply.send({ data: data.map(serializeCalendarEvent) });
  });

  app.post("/reservations", async (request, reply) => {
    const body = request.body;
    if (typeof body !== "object" || body === null) {
      throw validationError("Body wajib berupa objek JSON");
    }

    const input = body as Record<string, unknown>;
    const idempotencyKey = headerValue(request.headers["idempotency-key"]);
    if (idempotencyKey === undefined || idempotencyKey.trim() === "") {
      throw validationError(
        "Header idempotency-key wajib diisi",
        "idempotencyKey",
      );
    }

    const userIdHeader = headerValue(request.headers["x-user-id"]);
    const pemohonNama = parseOptionalString(input.pemohonNama, "pemohonNama");
    const nim = parseOptionalString(input.nim, "nim");
    if (nim === undefined && userIdHeader === undefined) {
      throw validationError(
        "Nama dan NIM pemohon wajib diisi",
        "pemohonNama",
      );
    }
    const userId =
      userIdHeader === undefined
        ? undefined
        : BigInt(parseId(userIdHeader, "x-user-id"));
    const roomId = BigInt(parseId(input.roomId, "roomId"));
    const start = parseString(input.start, "start");
    const end = parseString(input.end, "end");
    const purpose = parseString(input.purpose, "purpose");
    const participants = parseIntValue(input.participants, "participants");
    const orgId =
      input.orgId === undefined || input.orgId === null
        ? null
        : BigInt(parseId(input.orgId, "orgId"));
    const specialApproval = parseOptionalBoolean(
      input.specialApproval,
      "specialApproval",
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
      now: deps.now?.() ?? new Date(),
    });

    if (!result.replayed) {
      eventHub.publish("reservation-created", {
        businessId: result.reservation.businessId,
        roomId: result.reservation.roomId.toString(),
        status: result.reservation.status,
      });
    }

    return reply
      .status(result.replayed ? 200 : 201)
      .send({ data: serializeReservation(result.reservation), replayed: result.replayed });
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.httpStatus).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.field === undefined ? {} : { field: error.field }),
        },
      });
    }

    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: { code: "VALIDATION_ERROR", message: "Permintaan tidak valid" },
      });
    }

    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan pada server",
      },
    });
  });

  return app;
}
