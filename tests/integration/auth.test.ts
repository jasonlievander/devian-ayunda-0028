import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MemoryStore } from "../../src/infrastructure/memory-store";
import { createApp } from "../../src/http/app";

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  app = createApp({ store: await MemoryStore.open() });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

function login(payload: Record<string, string>) {
  return app.inject({
    method: "POST",
    url: "/auth/login",
    payload,
  });
}

describe("login formulir dan petugas", () => {
  it("menerima email dan NIM formulir", async () => {
    const response = await login({
      role: "form",
      email: "akumahasiswa2gmail.com",
      nim: "123456",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { role: "form" } });
  });

  it("menerima bentuk email valid untuk akun demo yang sama", async () => {
    const response = await login({
      role: "form",
      email: "akumahasiswa2@gmail.com",
      nim: "123456",
    });
    expect(response.statusCode).toBe(200);
  });

  it("menerima password petugas dan mengembalikan role admin", async () => {
    const response = await login({ role: "admin", password: "idbbali" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { role: "admin" } });
  });

  it("menerima akun mahasiswa demo tanpa seed di penyimpanan", async () => {
    const response = await login({
      role: "form",
      email: "  Mahasiswa@IDBBali.ac.id  ",
      nim: " 123456 ",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { role: "form" } });
  });

  it("menerima akun admin demo tanpa seed di penyimpanan", async () => {
    const response = await login({
      role: "admin",
      email: " Admin@IDBBali.ac.id ",
      password: "idbbali",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { role: "admin" } });
  });

  it("menolak email atau NIM yang salah", async () => {
    const wrongEmail = await login({
      role: "form",
      email: "salah@example.com",
      nim: "123456",
    });
    const wrongNim = await login({
      role: "form",
      email: "akumahasiswa2gmail.com",
      nim: "000000",
    });
    expect(wrongEmail.statusCode).toBe(401);
    expect(wrongNim.statusCode).toBe(401);
  });

  it("menolak password petugas yang salah", async () => {
    const response = await login({ role: "admin", password: "123456" });
    expect(response.statusCode).toBe(401);
  });

  it("menolak role yang tidak dikenal", async () => {
    const response = await login({ role: "guru" });
    expect(response.statusCode).toBe(422);
  });
});
