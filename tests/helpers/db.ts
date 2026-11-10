import { MemoryStore } from "../../src/infrastructure/memory-store";

export interface TestDb {
  store: MemoryStore;
  dir: string;
  stop: () => Promise<void>;
}

export async function startTestDb(): Promise<TestDb> {
  const store = await MemoryStore.open();

  return {
    store,
    dir: "",
    stop: async () => {},
  };
}

export async function resetDb(store: MemoryStore): Promise<void> {
  await store.reset();
}

export interface SeedUserOptions {
  role?: string;
  email?: string;
}

export async function seedUser(
  store: MemoryStore,
  options: SeedUserOptions = {},
): Promise<bigint> {
  const role = options.role ?? "mahasiswa";
  const email =
    options.email ??
    `${role}-${Date.now()}-${Math.random()}@idbbali.ac.id`;

  return store.transact((state) => {
    const id = (state.nextId.users ?? 0) + 1;
    state.nextId.users = id;
    state.users.push({
      id,
      nama: `Pengguna ${role}`,
      email,
      peran: role,
      status: "aktif",
      nim: null,
    });
    return BigInt(id);
  });
}

export interface SeedRoomOptions {
  code?: string;
  name?: string;
  type?: string;
  capacity?: number | null;
  policy?: "terbuka" | "perlu_persetujuan" | "khusus";
  active?: boolean;
  allowedRoles?: string[];
}

export async function seedRoom(
  store: MemoryStore,
  options: SeedRoomOptions = {},
): Promise<bigint> {
  return store.transact((state) => {
    const id = (state.nextId.rooms ?? 0) + 1;
    state.nextId.rooms = id;
    state.rooms.push({
      id,
      kode: options.code ?? `R-${Date.now()}-${Math.random()}`,
      nama: options.name ?? options.code ?? "Ruang Uji",
      tipe: options.type ?? "diskusi",
      kapasitas:
        options.capacity === undefined ? 10 : options.capacity,
      kebijakan: options.policy ?? "terbuka",
      aktif: options.active ?? true,
      allowedRoles: options.allowedRoles ?? [],
    });
    return BigInt(id);
  });
}

export async function seedBlock(
  store: MemoryStore,
  roomId: bigint,
  start: string,
  end: string,
  reason = "Kuliah",
): Promise<void> {
  await store.transact((state) => {
    const id = (state.nextId.blocks ?? 0) + 1;
    state.nextId.blocks = id;
    state.blocks.push({
      id,
      roomId: Number(roomId),
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      reason,
      source: "kuliah",
      createdAt: new Date().toISOString(),
    });
  });
}

export async function seedOrganization(
  store: MemoryStore,
  name = "BEM IDB",
): Promise<bigint> {
  return store.transact((state) => {
    const id = (state.nextId.organizations ?? 0) + 1;
    state.nextId.organizations = id;
    state.organizations.push({ id, nama: name, jenis: "BEM" });
    return BigInt(id);
  });
}

export async function addOrgMember(
  store: MemoryStore,
  userId: bigint,
  orgId: bigint,
): Promise<void> {
  await store.transact((state) => {
    const id = (state.nextId.orgMembers ?? 0) + 1;
    state.nextId.orgMembers = id;
    state.orgMembers.push({
      id,
      userId: Number(userId),
      orgId: Number(orgId),
      jabatan: "Ketua",
      periode: "2026/2027",
    });
  });
}

export async function insertReservationDirect(
  store: MemoryStore,
  input: {
    businessId: string;
    roomId: bigint;
    userId: bigint;
    start: string;
    end: string;
    idempotencyKey?: string;
    status?: "menunggu" | "disetujui" | "berlangsung";
  },
): Promise<bigint> {
  return store.transact((state) => {
    const id = (state.nextId.reservations ?? 0) + 1;
    state.nextId.reservations = id;
    const timestamp = new Date().toISOString();
    state.reservations.push({
      id,
      businessId: input.businessId,
      roomId: Number(input.roomId),
      userId: Number(input.userId),
      orgId: null,
      start: new Date(input.start).toISOString(),
      end: new Date(input.end).toISOString(),
      purpose: "langsung",
      participants: 5,
      status: input.status ?? "disetujui",
      idempotencyKey: input.idempotencyKey ?? `direct-${id}`,
      requestHash: "hash",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return BigInt(id);
  });
}

export async function countReservations(store: MemoryStore): Promise<number> {
  return store.read((state) => state.reservations.length);
}

export async function findUserByNim(
  store: MemoryStore,
  nim: string,
): Promise<{ nama: string; nim: string | null } | undefined> {
  return store.read((state) => {
    const user = state.users.find((candidate) => candidate.nim === nim);
    return user === undefined
      ? undefined
      : { nama: user.nama, nim: user.nim };
  });
}

export async function listReservationEvents(
  store: MemoryStore,
  reservationId: bigint,
): Promise<Array<{ from: string | null; to: string; reason: string | null }>> {
  return store.read((state) =>
    state.events
      .filter((event) => event.reservationId === Number(reservationId))
      .sort((a, b) => a.id - b.id)
      .map((event) => ({
        from: event.from,
        to: event.to,
        reason: event.reason,
      })),
  );
}
