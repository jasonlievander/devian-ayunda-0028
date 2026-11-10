# AGENTS.md — IDB BALI Reservation

Panduan kerja untuk agen AI dan pengembang di repositori ini.

## Tujuan proyek

Sistem reservasi ruang kampus IDB Bali. Rilis inti: login institusi, katalog,
pengajuan, persetujuan, pembatalan, check-in, notifikasi email. Fokus
implementasi saat ini: **struktur data dan alokasi slot tanpa bentrok**.

Sumber kebenaran:

1. `docs/PRD.md` — kebutuhan produk dan aturan bisnis.
2. `docs/DATA.md` — model data, invariant, dan constraint.
3. `PRD_IDB_Ruang_v1.0.pdf` — draf asli; bila berbeda, PDF terbaru yang
   disepakati pemilik produk menang.

## Stack

- TypeScript (strict), Node.js 20+
- PostgreSQL 17 (ekstensi `btree_gist` untuk exclusion constraint)
- `pg` untuk akses database
- Fastify untuk HTTP
- Vitest untuk unit/integration test
- `embedded-postgres` untuk test database (tanpa Docker)

## Perintah

```bash
npm install
npm run typecheck          # tsc --noEmit
npm test                   # semua test (unit + integration, embedded PostgreSQL)
npm run test:unit          # hanya unit
npm run test:integration   # hanya integration (butuh/embedded PostgreSQL)
npm run test:watch         # watch mode
npm run db:migrate         # jalankan migrasi ke DATABASE_URL
npm run dev                # jalankan HTTP server
```

Test integration memakai `embedded-postgres`; tidak perlu database eksternal.
Untuk menjalankan aplikasi/dev, sediakan `DATABASE_URL` (lihat `.env.example`).

## Struktur

```
docs/                  PRD, spesifikasi data
db/migrations/         SQL migrasi (urutan 001, 002, ...)
src/config.ts          konfigurasi & policy default
src/domain/            aturan murni (waktu, validasi, error)
src/application/       use case (alokasi slot) + port
src/infrastructure/    repository PostgreSQL
src/http/              Fastify app & error mapping
tests/unit/            test domain tanpa DB
tests/integration/     test repository/constraint dengan PostgreSQL
tests/helpers/         startup embedded PostgreSQL, seed, reset
```

## Aturan bisnis yang tidak boleh dilanggar

- **RV-03:** dua pengajuan valid bersamaan untuk slot sama -> tepat satu
  berhasil; lainnya `409` alasan konflik.
- **RV-05:** retry/klik ganda dengan kunci idempoten sama -> tidak ada reservasi
  ganda.
- **BR-01:** `mulai < selesai`; durasi minimal 30 menit; kelipatan 30 menit.
- **BR-02:** status `menunggu`, `disetujui`, `berlangsung` tidak boleh beririsan
  pada ruang yang sama.
- **BR-03:** `peserta <= kapasitas`; batas diterima, `+1` ditolak.
- **BR-07:** blok jadwal kuliah/blokir petugas mengalahkan reservasi.
- Jaminan anti-bentrok wajib di level database, bukan hanya validasi aplikasi.

## Default keputusan yang dipakai sementara

Keputusan terbuka dari PRD dimodelkan sebagai konfigurasi di `src/config.ts`.
Default aman:

| Hal | Default |
|---|---|
| Interval | Half-open `[mulai, selesai)` |
| Zona waktu | Input WITA (UTC+8), simpan `timestamptz` |
| Jam mulai | Wajib kelipatan 30 menit (dapat dimatikan) |
| Lintas hari | Tidak diizinkan |
| Buffer antar-reservasi | Tidak ada |
| Jam operasional | Sen–Jum 08.30–17.30; Sab 08.30–14.00; Minggu tutup |
| Persetujuan khusus | Hanya jalur petugas/admin (`specialApproval`) |
| Hari kerja | Senin–Jumat; libur belum dihitung |
| Lead time | Terbuka 1 jam; persetujuan 1 hari kerja; Aula/acara 3 hari kerja |
| Status Menunggu | Menahan slot; kedaluwarsa T-2 jam (guard saat submit) |
| Kuota pribadi | Maks 2 aktif; maks 3 jam/reservasi pada ruang diskusi/kelas |
| Idempotency | Per user, 24 jam setelah status terminal |
| Kapasitas | Peserta termasuk panitia |
| Ruang Khusus | Berdasarkan daftar peran pada `rooms.allowed_roles` |

Bila pemilik produk memberi keputusan berbeda, ubah konfigurasi + test +
`docs/`, jangan menyebar angka ke banyak tempat.

## Desain UI

- Warna mengikuti logo resmi IDB Bali: teal `#006684`, oranye `#F5821F`,
  abu `#404041`. Jangan mengganti aksen tanpa memperbarui token di
  `public/styles.css`.
- Font di-self-host di `public/fonts/`: Archivo (display), Public Sans (body),
  IBM Plex Mono (label/ID). Jangan memakai CDN font eksternal.
- Aset logo: `public/assets/idb-mark.png`.
- Semua warna dan spacing memakai token di `:root`; jangan menambah hex baru
  di komponen.
- UI harus tetap lolos axe (`agent-browser a11y http://127.0.0.1:3000`) dan
  diperiksa pada 1440px serta 390px.

## Konvensi kode

- TypeScript strict; hindari `any` di domain.
- Aturan bisnis murni di `src/domain` (tanpa I/O) agar mudah diuji.
- Waktu selalu dinormalisasi ke UTC; konversi WITA hanya di boundary.
- Semua mutasi reservasi dalam transaksi.
- Petakan error database: `23P01` -> `SLOT_CONFLICT`, `23505` idempotency ->
  replay/mismatch.
- Jangan menambah fitur di luar scope tugas (mis. notifikasi, UI) tanpa
  persetujuan.
- Jangan menambah komentar kecuali diminta.

## TDD

Gunakan siklus red-green-refactor:

1. Tulis satu test yang gagal.
2. Jalankan dan pastikan gagal karena alasan yang benar.
3. Tulis kode minimal agar lulus.
4. Jalankan seluruh test; pastikan tetap hijau.
5. Refactor tanpa mengubah perilaku.

Jangan menulis kode produksi sebelum ada test yang gagal.

## Status implementasi

- Fase alokasi slot sudah ada: domain, migrasi, service, `POST /reservations`,
  dan UI pengajuan di `public/` (disajikan di `/`).
- Formulir dan panel petugas berada di satu halaman: `#reservation` untuk
  formulir, `#admin` untuk panel. `/admin` diarahkan ke `/#admin`.
- Server mempublikasikan event SSE di `GET /events` setelah pengajuan baru,
  persetujuan/penolakan/pembatalan, dan blokir ruang. Panel admin dan kalender
  berlangganan event tersebut dan menyegarkan tampilan otomatis; polling 20
  detik pada panel admin tetap menjadi fallback. Pengajuan mahasiswa langsung
  masuk antrean `menunggu`.
- Panel petugas: statistik, antrean `menunggu`, semua reservasi dengan
  filter/cari, setujui, tolak, batalkan, blokir ruang (otomatis membatalkan
  reservasi yang beririsan + audit), dan audit log. Kalender publik di
  `#kalender` memakai filter 33 ruang, tampilan bulan/minggu/hari/daftar, dan
  endpoint publik `GET /calendar?from&to&roomId` tanpa nama/NIM pemohon.
  Akses panel memakai login demo dan header `x-admin-code` yang dicocokkan
  dengan `ADMIN_CODE` (default `idbbali`); ini pembatas demo, bukan auth
  produksi.
- UI hanya mencakup pengajuan + hasil alokasi. Data user masih demo sintetis.
- Katalog di UI memakai daftar ruang dari form peminjaman IDB Bali
  (A.1.1–C.3.3, Aula, Studio Foto, Rooftop, INBIS, Halaman, GSG, Gedung B
  Gear inc) ditambah fasilitas kampus dari
  `idbbali.ac.id/fasilitas-kampus` (arsip 17 Okt 2026).
- Kapasitas yang tidak dipublikasikan disimpan `NULL` dan diverifikasi
  petugas; jangan mengarang angka. Hanya Lab Komputer yang punya kapasitas
  resmi (maks. 36). Katalog belum terhubung ke database.
- Login demo ada di `/login`: formulir memakai email
  `akumahasiswa2gmail.com` dan NIM `123456` (`FORM_EMAIL`, `FORM_NIM`);
  panel petugas memakai password `idbbali` (`ADMIN_CODE`). Keduanya
  divalidasi server lewat `POST /auth/login`. Sesi disimpan di
  `sessionStorage`; ini gerbang demo, bukan auth produksi. Form tetap meminta **nama + NIM** yang diketik; server
  membuat/menemukan user sintetis berdasarkan NIM
  (`{nim}@idbbali.ac.id`, peran mahasiswa). Header `x-user-id` masih diterima
  untuk kompatibilitas test/API, tetapi jangan dipakai di produksi.
- BR-07 arah sebaliknya sudah ada: blok baru dari panel membatalkan reservasi
  terdampak dan menulis audit. Notifikasi email untuk pembatalan belum ada.
- Belum ada: katalog dinamis, pembatalan mandiri pemohon, check-in,
  job kedaluwarsa, notifikasi, dan ekspor CSV laporan.

## Larangan

- Jangan memakai data nyata (mahasiswa, ruang, jadwal). Gunakan fixture sintetis.
- Jangan melakukan deployment atau menyentuh layanan produksi.
- Jangan menyimpan rahasia di kode, prompt, atau log.
- Jangan memakai `MAX(id)+1` untuk ID bisnis.
- Jangan mengandalkan validasi UI untuk mencegah bentrok.
- Jangan mengubah `docs/` tanpa menandai keputusan pemilik produk.

## Definisi selesai (fase alokasi)

- Migrasi berjalan di PostgreSQL bersih.
- Test unit: BR-01, BR-03.
- Test integration: sukses, konflik, konkurensi, idempotensi (termasuk retry
  bersamaan), kapasitas, lead time, jam operasional, status Menunggu.
- `npm test` dan `npm run typecheck` hijau.
- Tidak ada reservasi ganda pada uji konkurensi.
- Perilaku yang belum terverifikasi dilaporkan jujur.

## Keputusan yang masih terbuka

Lihat `docs/PRD.md` bagian 12 dan `docs/DATA.md` bagian 10. Jangan
mengasumsikan keputusan final untuk hal-hal tersebut; gunakan default di atas
dan tandai bila relevan.
