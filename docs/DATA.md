# IDB BALI Reservation — Spesifikasi Data

Turunan dari `docs/PRD.md` bagian 08/10/21. Dokumen ini mengikat model logis,
invariant, dan aturan konsistensi. Pilihan teknologi: **PostgreSQL**.

---

## 1. Model logis

```
users 1 ── n org_members n ── 1 organizations
  │                                  │
  │ 1                                │ 1
  └──────────────┐     ┌─────────────┘
                 ▼     ▼
              reservations ── 1 ── n reservation_events
                 │ 1
                 ├── n attachments
                 │
                 n
                 │
                 ▼
rooms ── 1 ── n room_facilities
  └──── 1 ── n room_blocks
```

| Entitas | Kolom wajib | Catatan |
|---|---|---|
| `users` | `id`, `nama`, `email`, `peran`, `status`, `nim` | Email institusi unik; `nim` unik bila diisi; peran: mahasiswa, dosen, tendik, petugas, admin |
| `organizations` | `id`, `nama`, `jenis` | BEM / HIMA / UKM |
| `org_members` | `user_id`, `org_id`, `jabatan`, `periode` | Menentukan hak "atas nama organisasi" (BR-11) |
| `reservations` | `id`, `room_id`, `user_id`, `org_id`, `mulai`, `selesai`, `keperluan`, `peserta`, `status`, `kunci_idempoten` | Lihat detail di bawah |
| `reservation_events` | `reservation_id`, `dari`, `ke`, `pelaku`, `waktu`, `alasan` | Audit transisi status (BR-09) |
| `attachments` | `reservation_id`, `berkas`, `ukuran` | Maks 5 MB; PDF/JPG/PNG (usulan) |
| `rooms` | `id`, `kode`, `nama`, `tipe`, `lantai`, `kapasitas`, `kebijakan`, `aktif` | Kebijakan: `terbuka`, `perlu_persetujuan`, `khusus`. `kapasitas` boleh `NULL` bila belum dipublikasikan. |
| `room_facilities` | `room_id`, `fasilitas` | Untuk filter CR-01 |
| `room_blocks` | `room_id`, `mulai`, `selesai`, `alasan`, `sumber` | `sumber`: `kuliah`, `petugas`, `perawatan`, `ujian`, `acara_kampus` |

---

## 2. Status reservasi

Nilai yang diizinkan:

```
menunggu | disetujui | berlangsung | selesai
ditolak  | dibatalkan | kedaluwarsa | tidak_hadir
```

Status yang **menahan/mengunci slot** (ikut aturan anti-irisan BR-02):
`menunggu`, `disetujui`, `berlangsung`.

Status yang **melepas slot**: `selesai`, `ditolak`, `dibatalkan`,
`kedaluwarsa`, `tidak_hadir`.

Transisi yang sah:

```
menunggu    -> disetujui | ditolak | dibatalkan | kedaluwarsa
disetujui   -> berlangsung | dibatalkan | tidak_hadir | selesai
berlangsung -> selesai | tidak_hadir
```

Ruang `terbuka` langsung membuat status `disetujui`. Ruang
`perlu_persetujuan`/`khusus` membuat status `menunggu`.

---

## 3. BR-01 — validasi waktu

Berlaku untuk setiap pengajuan:

1. `mulai` dan `selesai` wajib ada, format ISO-8601 dengan offset.
2. `mulai < selesai`.
3. Durasi `selesai - mulai` **minimal 30 menit**.
4. Durasi **kelipatan 30 menit**.
5. Default implementasi: **jam mulai juga kelipatan 30 menit** dan reservasi
   tidak boleh melewati tengah malam WITA. Ini asumsi yang dapat diubah lewat
   konfigurasi; lihat `AGENTS.md`.
6. Zona waktu: input WITA (UTC+8), simpan `timestamptz` (UTC), tampilkan WITA.
7. Interval diperlakukan **half-open** `[mulai, selesai)` sehingga
   09.00–10.00 dan 10.00–11.00 tidak dianggap beririsan.

Contoh ditolak: `mulai = selesai`, durasi 0/29/31/45 menit, `selesai < mulai`,
reservasi 23.30–00.30.

---

## 4. BR-02 — anti-irisan

**Invariant:** untuk `room_id` yang sama, dua reservasi dengan status aktif
tidak boleh memiliki irisan interval.

Syarat teknis wajib (PRD bagian 10): jaminan harus ada di lapisan penyimpanan.
Implementasi PostgreSQL:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_no_overlap
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(mulai, selesai, '[)') WITH &&
  )
  WHERE (status IN ('menunggu', 'disetujui', 'berlangsung'));
```

Konsekuensi:

- Dua insert bersamaan: satu commit, satu gagal `23P01`
  (`exclusion_violation`) dan dipetakan ke `409 SLOT_CONFLICT`.
- Update status dari status pelepas ke status aktif juga harus lolos
  constraint (mis. reaktivasi tidak boleh menabrak).
- Perubahan `mulai`/`selesai` pada reservasi aktif juga dilindungi constraint.

**Blok dan jadwal kuliah (BR-07):**

- `room_blocks` adalah konflik keras.
- Reservasi baru yang beririsan dengan blok aktif ditolak.
- Blok baru yang menabrak reservasi aktif memicu pembatalan reservasi
  terdampak + alasan + event audit + notifikasi.
- Blok tidak boleh beririsan dengan blok lain pada ruang yang sama (constraint
  serupa pada `room_blocks`).

---

## 5. BR-03 — kapasitas

1. `peserta` wajib bilangan bulat positif.
2. Bila `rooms.kapasitas` diketahui: `peserta <= kapasitas`. Batas diterima:
   `peserta = kapasitas`; `kapasitas + 1` ditolak.
3. Bila `rooms.kapasitas` **NULL** (belum dipublikasikan): hanya validasi
   `peserta > 0`; pengajuan masuk jalur persetujuan dan petugas memverifikasi
   kapasitas. Ini perilaku sementara sampai data resmi tersedia.
4. Kapasitas adalah kapasitas resmi ruang. Apakah panitia dihitung masih
   keputusan terbuka; default sementara: **ya, dihitung**.
5. Perubahan kapasitas ruang tidak membatalkan reservasi lama secara otomatis;
   hanya memengaruhi pengajuan baru.

---

## 6. Aturan tambahan untuk alokasi

### 6.1 Kuota pribadi (BR-05)

Default sementara:

- Pemohon pribadi maksimal **2 reservasi aktif** pada ruang diskusi/kelas.
- "Aktif" = `menunggu`, `disetujui`, `berlangsung`.
- Batas **3 jam per reservasi** pada ruang diskusi/kelas tetap diterapkan
  (usulan PRD).
- Pengajuan organisasi tidak terkena kuota pribadi.
- Perhitungan kuota harus aman terhadap konkurensi: kunci baris `users`
  (`SELECT ... FOR UPDATE`) sebelum menghitung, atau gunakan isolasi
  `SERIALIZABLE` + retry.

### 6.2 Jam operasional (BR-04)

Default:

| Hari | Jam |
|---|---|
| Senin–Jumat | 08.30–17.30 WITA |
| Sabtu | 08.30–14.00 WITA |
| Minggu | Tutup; hanya boleh dengan persetujuan khusus |

- Pengajuan Minggu tanpa override ditolak.
- Pengajuan di luar jam operasional tanpa override ditolak.
- Override adalah jalur petugas/admin, bukan flag yang boleh dikirim pemohon
  biasa.

### 6.3 Batas pengajuan (BR-06)

Default:

- Ruang `terbuka`: minimal **1 jam** sebelum mulai.
- Ruang `perlu_persetujuan`: minimal **1 hari kerja** sebelum mulai.
- Aula atau keperluan `acara`: minimal **3 hari kerja** sebelum mulai.
- Hari kerja default: Senin–Jumat, belum memperhitungkan libur nasional/kampus
  (keputusan terbuka).
- Guard AP-04: pengajuan `menunggu` yang masuk kurang dari 2 jam sebelum mulai
  ditolak.

### 6.4 Kebijakan ruang (RS-02)

- `terbuka`: siapapun yang memenuhi syarat boleh memesan; status `disetujui`.
- `perlu_persetujuan`: status `menunggu`, slot ditahan, menunggu petugas.
- `khusus`: hanya peran yang terdaftar pada ruang; peran lain `403`.
  Daftar peran/ruang masih keputusan terbuka.

### 6.4a Identitas pemohon (sementara)

- Form meminta nama lengkap dan NIM yang diketik, bukan memilih dari daftar.
- Server melakukan upsert user berdasarkan `nim` (5–20 digit), dengan email
  sintetis `{nim}@idbbali.ac.id` dan peran `mahasiswa`.
- Nama pada user diperbarui mengikuti nama yang diketik terakhir.
- Ini pengganti login sementara; produksi harus memakai identitas institusi.
- `x-user-id` masih didukung untuk test/API lama.

### 6.5 Idempotensi (RV-05)

- Klien mengirim `Idempotency-Key` (default: UUID) per pengajuan.
- Kunci berlaku per `user_id`.
- Unique `(user_id, kunci_idempoten)`.
- Simpan `request_hash` (hash kanonik payload). Bila kunci sama:
  - hash sama -> kembalikan reservasi yang sudah ada (replay, bukan duplikat);
  - hash berbeda -> `409 IDEMPOTENCY_MISMATCH`.
- Retry bersamaan dengan kunci sama: satu insert menang, yang lain membaca
  baris yang sudah ada.
- Masa simpan default: 24 jam setelah reservasi mencapai status terminal;
  dapat diubah lewat konfigurasi.

### 6.5a Persetujuan petugas (AP-01–AP-03)

- Daftar antrean diambil dari status `menunggu`; panel menampilkan pemohon,
  NIM, ruang, waktu, peserta, dan keperluan.
- Setujui: transaksi mengunci baris, memastikan status masih `menunggu`,
  memeriksa `room_blocks`, lalu mengubah status ke `disetujui` dan menulis
  event audit. Bila ruang diblokir, persetujuan ditolak `409`.
- Tolak: alasan wajib 3–500 karakter, status menjadi `ditolak`, event audit
  menyimpan alasan.
- Pengajuan yang sudah diproses tidak dapat diproses ulang (`409`).
- Petugas dapat membatalkan reservasi `menunggu`/`disetujui` dengan alasan;
  status menjadi `dibatalkan` dan alasan masuk audit (AP-05).
- Petugas dapat membuat blokir ruang (RS-03). Blokir mengalahkan reservasi:
  reservasi aktif yang beririsan dibatalkan otomatis dengan alasan
  "Ruang diblokir: {alasan}" dan dicatat di audit (BR-07).
- Panel menampilkan statistik ringkas, daftar semua reservasi dengan filter
  status/tanggal/pencarian, blokir mendatang, dan audit terbaru.
- Akses panel memakai kode demo `ADMIN_CODE`, bukan autentikasi produksi.

### 6.6 ID reservasi (RV-04)

Format: `RSV-YYYYMMDD-NNNN` (contoh `RSV-20261020-0042`).

- Tanggal memakai WITA.
- `NNNN` adalah urutan harian, minimal 4 digit.
- Pembuatan harus race-safe: counter harian di dalam transaksi
  (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`) atau sequence + advisory
  lock. Jangan memakai `MAX(id)+1`.
- ID bisnis unik; ID internal (UUID/bigint) tidak dipakai sebagai satu-satunya
  bukti kewenangan.

### 6.7 Audit (BR-09)

Setiap perubahan status menulis satu baris `reservation_events`:

- `reservation_id`, `dari`, `ke`, `pelaku`, `waktu`, `alasan`.
- Termasuk pembuatan (`dari = null`, `ke = status awal`), penolakan konflik
  tidak membuat reservasi sehingga cukup dicatat di log aplikasi.
- Perubahan pengaturan ruang dan peran juga masuk audit (LP-03).

---

## 7. Constraint dan indeks minimum

| Objek | Definisi |
|---|---|
| `reservations_no_overlap` | Exclusion constraint `room_id =`, `tstzrange &&`, status aktif |
| `reservations_idempotency` | `UNIQUE (user_id, kunci_idempoten)` |
| `reservations_business_id` | `UNIQUE (business_id)` |
| `reservations_room_time_idx` | `(room_id, mulai, selesai)` untuk pencarian |
| `reservations_user_status_idx` | `(user_id, status)` untuk kuota dan riwayat |
| `room_blocks_no_overlap` | Exclusion constraint pada `room_blocks` |
| `rooms_kapasitas_check` | `kapasitas IS NULL OR kapasitas > 0` |
| `reservations_peserta_check` | `peserta > 0` |
| `reservations_time_check` | `selesai > mulai` |

Catatan: `EXCLUDE` membutuhkan `btree_gist`. Bila ekstensi tidak tersedia,
gunakan `SERIALIZABLE` + `SELECT ... FOR UPDATE` pada baris ruang; namun
constraint tetap lebih disarankan karena menjamin invariant di level data.

---

## 8. Alur alokasi (transaksi)

```
BEGIN
  1. Validasi input bentuk & waktu (BR-01)
  2. Kunci konteks yang diperlukan
     - SELECT user FOR UPDATE (kuota BR-05)
     - SELECT room (kapasitas, kebijakan, aktif)
  3. Cek idempotency key
     - ada + hash sama  -> COMMIT, kembalikan reservasi lama
     - ada + hash beda  -> ROLLBACK, 409 IDEMPOTENCY_MISMATCH
  4. Validasi kebijakan (kapasitas BR-03, jam BR-04, lead time BR-06,
     peran RS-02)
  5. Cek konflik terhadap room_blocks (BR-07)
  6. INSERT reservations (status awal sesuai kebijakan)
     - exclusion violation 23P01 -> 409 SLOT_CONFLICT
     - unique violation 23505 pada idempotency -> baca baris yang ada
  7. INSERT reservation_events (dibuat)
  8. COMMIT
```

`READ COMMITTED` cukup karena exclusion constraint menangani race utama.
Bila kuota dihitung dengan `COUNT`, kunci baris user mencegah dua transaksi
melewati batas secara bersamaan.

Kode kesalahan yang disarankan:

| Kode | HTTP | Kapan |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Input tidak valid (BR-01/BR-03) |
| `SLOT_CONFLICT` | 409 | Slot sudah dipakai (RV-03/BR-02/BR-07) |
| `IDEMPOTENCY_MISMATCH` | 409 | Kunci sama, payload berbeda |
| `ROOM_UNAVAILABLE` | 409/422 | Ruang nonaktif atau di luar jam/lead time |
| `FORBIDDEN` | 403 | Peran tidak berhak (RS-02) |
| `QUOTA_EXCEEDED` | 429/422 | Melebihi BR-05 |

---

## 9. Retensi dan privasi

- Lama simpan reservasi/audit: usulan 2 tahun akademik; keputusan terbuka.
- Lampiran disimpan di luar folder publik; hanya pemohon dan petugas.
- Log tidak memuat kata sandi, token, atau isi lampiran.
- Data uji wajib sintetis; jangan memakai data nyata.

---

## 10. Katalog ruang

Daftar ruang yang dapat dipinjam mengikuti form peminjaman IDB Bali:
A.1.1–A.2.3, B.2.1, B.1.3–B.1.4, C.1.1–C.3.3, AULA IDB BALI,
STUDIO FOTO, ROOFTOP, INBIS, HALAMAN A/B/C, GEDUNG SERBA GUNA Lt.1–3,
GEDUNG B (Gear inc), serta fasilitas kampus (Lab Komputer, Lab iMac,
Perpustakaan, Creative Gallery). Opsi "Yang lain" bukan ruang dan tidak
dimasukkan.

- Kapasitas resmi hanya tersedia untuk Lab Komputer (maks. 24–36 mahasiswa).
- Ruang lain memakai `kapasitas = NULL` sampai Sarana Prasarana mengonfirmasi.
- Kebijakan akses default `perlu_persetujuan` sampai dikonfirmasi.

## 11. Pertanyaan data yang masih terbuka

1. Definisi dan sumber kalender hari kerja/libur.
2. Peran dan ruang untuk kebijakan `khusus`.
3. Apakah Perpustakaan dan Creative Gallery dapat dipinjam.
4. Apakah panitia dihitung dalam `peserta`.
5. Apakah batas 3 jam (BR-05) dan cakupan kuota organisasi.
6. Apakah jam mulai wajib kelipatan 30 menit; lintas hari; buffer.
7. Masa simpan idempotency key.
8. Retensi data dan penanggung jawab insiden.
