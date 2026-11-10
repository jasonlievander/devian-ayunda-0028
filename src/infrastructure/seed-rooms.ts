import type { RoomPolicy } from "../domain/policy";

export interface SeedRoom {
  kode: string;
  nama: string;
  tipe: string;
  kapasitas: number | null;
  kebijakan: RoomPolicy;
}

export const DEFAULT_ROOMS: readonly SeedRoom[] = [
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
  { kode: "CREATIVE-GALLERY", nama: "Creative Gallery", tipe: "galeri", kapasitas: null, kebijakan: "perlu_persetujuan" },
];
