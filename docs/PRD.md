# IDB BALI Reservation — PRD 1.0

Dokumen kebutuhan produk untuk sistem reservasi dan peminjaman ruangan kampus
Institut Desain dan Bisnis Bali (IDB Bali).

- Versi: 1.0 (draft untuk review)
- Tanggal: 19 Oktober 2026
- Sumber: `PRD_IDB_Ruang_v1.0.pdf`
- Status: mengikat sampai ada revisi resmi dari pemilik produk

> Catatan: dokumen ini diturunkan dari draf PDF. Angka yang ditandai
> **(usulan)** belum disepakati pemilik produk. Bila `docs/` dan PDF berbeda,
> PDF terbaru yang disepakati menjadi acuan.

---

## 1. Produk, masalah, dan tujuan

Civitas akademika membutuhkan satu tempat untuk mengetahui ruang mana yang
kosong, mengajukan peminjaman, dan mendapat kepastian status tanpa chat
berantai atau surat manual.

**Pernyataan nilai:** IDB BALI Reservation membantu civitas akademika IDB Bali
menemukan ruang yang tersedia dan memastikan peminjamannya tercatat, disetujui,
dan tidak bentrok.

Tujuan rilis inti:

1. Tidak ada jadwal bentrok (target: 0 bentrok).
2. Pengajuan mudah (target: >= 85% selesai tanpa bantuan).
3. Kepastian status lebih cepat (median <= 1 hari kerja untuk ruang persetujuan).
4. Pengajuan singkat (median <= 3 menit).

**Guardrail utama:** satu ruang tidak boleh dipesan dua pihak pada waktu yang
sama. Ketersediaan diputuskan server saat reservasi dibuat, bukan oleh tampilan.

---

## 2. Pengguna dan hak akses

Peran: mahasiswa, dosen/tendik, pengurus organisasi (ormawa), petugas Sarana
Prasarana/BAAK, admin sistem (IT).

| Aksi | Mahasiswa | Pengurus ormawa | Dosen/tendik | Petugas | Admin |
|---|---|---|---|---|---|
| Lihat ketersediaan | Ya | Ya | Ya | Ya | Ya |
| Ajukan untuk diri sendiri | Ya | Ya | Ya | Ya | Ya |
| Ajukan atas nama organisasi | - | Organisasinya | - | - | - |
| Setujui/tolak | - | - | - | Ya | Ya |
| Blokir jadwal ruang | - | - | - | Ya | Ya |
| Kelola data ruang | - | - | - | Ya | Ya |
| Batalkan | Milik sendiri | Milik sendiri/org | Milik sendiri | Semua + alasan | - |
| Kelola akun/peran | - | - | - | - | Ya (audit) |
| Laporan & audit | - | - | - | Ya | Ya |

Tidak ada registrasi publik. Akun mengikuti identitas institusi. Pengurus
organisasi ditetapkan petugas/admin, bukan memilih sendiri.

---

## 3. Ruang lingkup

**In scope (rilis inti):** login akun institusi, katalog ruang dan fasilitas,
ketersediaan harian/mingguan, pengajuan pribadi dan organisasi, persetujuan
petugas, pembatalan, check-in, status tidak hadir, notifikasi email, dashboard
petugas dan laporan pemakaian, web responsif/PWA.

**Out of scope:** aplikasi native terpisah, pembayaran/biaya sewa, peminjaman
oleh pihak luar kampus, peminjaman peralatan terpisah, penjadwalan kuliah
otomatis penuh, rekomendasi AI, peta interaktif, notifikasi WhatsApp.

**Prioritas:** must-have = alokasi tanpa bentrok; login, katalog, ketersediaan;
pengajuan/persetujuan/status; pembatalan dan riwayat.

---

## 4. Alur utama

1. **Masuk** — akun institusi; akun non-institusi ditolak.
2. **Cari ruang** — tanggal, jam, kapasitas, fasilitas; status per slot.
3. **Pilih slot** — server mengecek ulang ketersediaan.
4. **Isi detail** — keperluan, peserta, lampiran bila acara.
5. **Kirim** — slot dialokasikan atomik; ID dan status tampil.
6. **Menunggu/disetujui** — notifikasi email setiap perubahan status.
7. **Pakai** — check-in; setelah selesai status menjadi Selesai.

Slot berstatus Menunggu tetap **ditahan** agar tidak diambil pihak lain.

---

## 5. Status reservasi

| Status | Arti | Slot | Aksi pengguna |
|---|---|---|---|
| Menunggu | Menunggu keputusan petugas | Ditahan | Batalkan |
| Disetujui | Reservasi sah | Terkunci | Batalkan, Check-in |
| Berlangsung | Sudah check-in | Terkunci | Lihat detail |
| Selesai | Waktu berakhir | Dilepas | Lihat riwayat |
| Ditolak | Ditolak petugas + alasan | Dilepas | Ajukan ulang |
| Kedaluwarsa | Tanpa keputusan hingga 2 jam sebelum mulai (usulan) | Dilepas | Ajukan ulang |
| Tidak hadir | Tanpa check-in 15 menit setelah mulai (usulan) | Dilepas | Lihat riwayat |
| Dibatalkan | Oleh pemohon/petugas + alasan | Dilepas | Ajukan ulang |

Ruang **Terbuka** langsung masuk **Disetujui**. Pemohon dapat membatalkan
pengajuan yang masih Menunggu.

---

## 6. Kebutuhan fungsional

### 6.1 Akses (AK)

- **AK-01** Login memakai akun `@idbbali.ac.id`; domain lain ditolak.
- **AK-02** Peran ditentukan data akun, bukan dipilih pengguna.
- **AK-03** Sesi dicabut saat Keluar; berakhir otomatis setelah 8 jam tidak aktif (usulan).
- **AK-04** Pengurus organisasi ditetapkan petugas/admin per organisasi/periode.
- **AK-05** Pengguna anonim ditolak di semua endpoint privat.

### 6.2 Katalog ruang (RS)

- **RS-01** Ruang memiliki kode, nama, tipe, gedung/lantai, kapasitas, fasilitas, foto, aturan pakai, status aktif.
- **RS-02** Kebijakan akses: **Terbuka** (otomatis disetujui), **Perlu persetujuan**, **Khusus** (hanya peran tertentu).
- **RS-03** Petugas dapat memblokir ruang pada rentang waktu dengan alasan; blokir mengalahkan reservasi.
- **RS-04** Jam operasional default mengikuti jam kantor; di luar jam perlu persetujuan khusus petugas.
- **RS-05** Jadwal kuliah dimasukkan petugas sebagai blok terisi (input/impor CSV).

### 6.3 Pencarian dan ketersediaan (CR)

- **CR-01** Filter tanggal, jam mulai–selesai, kapasitas minimal, tipe ruang, fasilitas.
- **CR-02** Status per slot: Tersedia, Menunggu persetujuan, Terisi, Diblokir.
- **CR-03** Slot Menunggu tampil berbeda dari Terisi.
- **CR-04** Server mengecek ulang ketersediaan saat slot dipilih dan saat kirim.
- **CR-05** Bila kosong, tawarkan ruang serupa/jam terdekat; filter tetap terlihat.

### 6.4 Reservasi (RV)

- **RV-01** Pengajuan berisi ruang, tanggal, jam mulai/selesai, keperluan (belajar kelompok, rapat, latihan, kelas pengganti, acara, lainnya), jumlah peserta, jenis pemohon (pribadi/organisasi), kontak penanggung jawab.
- **RV-02** Acara organisasi pada ruang Perlu persetujuan/Khusus wajib melampirkan surat/proposal (PDF/JPG/PNG, maks 5 MB; usulan).
- **RV-03** **Alokasi slot bersifat atomik:** bila dua pengajuan valid masuk bersamaan untuk slot yang sama, tepat satu berhasil dan yang lain ditolak dengan alasan konflik.
- **RV-04** Setelah berhasil, tampilkan ID reservasi, ruang, waktu, status. ID unik dan dapat dicari petugas (contoh `RSV-20261020-0042`).
- **RV-05** **Mengulang atau menekan dua kali permintaan yang sama tidak membuat reservasi ganda** (kunci idempoten per pengajuan).
- **RV-06** High-want: reservasi berulang mingguan sampai akhir semester; konflik pada satu tanggal ditandai tanpa menggagalkan tanggal lain.
- **RV-07** Halaman Reservasi saya memuat reservasi mendatang dan riwayat beserta status, filter, dan tindakan sesuai status.

### 6.5 Persetujuan (AP)

- **AP-01** Antrean pengajuan dengan filter ruang, tanggal, jenis pemohon, mendesak (mulai dalam 24 jam).
- **AP-02** Petugas menyetujui/menolak; penolakan wajib beralasan dan diteruskan ke pemohon.
- **AP-03** Saat menyetujui, sistem mengecek ulang konflik; bila terisi, persetujuan gagal dengan alasan.
- **AP-04** Pengajuan tanpa keputusan diingatkan setelah 12 jam dan menjadi Kedaluwarsa 2 jam sebelum mulai (usulan).
- **AP-05** Petugas dapat membatalkan/memindahkan reservasi karena kebutuhan akademik; alasan wajib dan pemohon diberi tahu.

### 6.6 Pembatalan, check-in, notifikasi, laporan

- **PB-01** Pemohon dapat membatalkan sampai 2 jam sebelum mulai (usulan); slot kembali tersedia seketika.
- **PB-02** Setiap pembatalan mencatat siapa, kapan, alasan; pembatalan oleh akun lain tanpa kewenangan ditolak.
- **PB-03** Setelah batas waktu, tombol Batalkan diganti arahan menghubungi petugas.
- **CI-01** Check-in lewat tombol pada jendela 15 menit sebelum sampai 15 menit sesudah mulai (usulan).
- **CI-02** Tanpa check-in 15 menit setelah mulai, status menjadi Tidak hadir dan slot dilepas. Tiga kali tidak hadir dalam 30 hari membatasi pengajuan 14 hari (usulan).
- **NT-01** Email institusi saat pengajuan diterima, disetujui, ditolak, dibatalkan, dipindahkan.
- **NT-02** Pengingat email 1 jam sebelum mulai.
- **NT-03** Kegagalan kirim notifikasi tidak membatalkan reservasi; dicatat untuk dicoba ulang.
- **NT-04** Petugas menerima ringkasan pengajuan baru yang belum diputuskan.
- **LP-01** Dashboard petugas: reservasi hari ini, ruang terpakai, pengajuan menunggu.
- **LP-02** Laporan pemakaian per ruang/periode; ekspor CSV.
- **LP-03** Audit log mencatat perubahan status, pengaturan ruang, peran: pelaku, waktu, aksi, objek.

---

## 7. Aturan bisnis

Angka bertanda **(usulan)** perlu disepakati pemilik produk dan petugas.

| ID | Aturan |
|---|---|
| **BR-01** | Waktu mulai harus sebelum selesai. Durasi minimal 30 menit, kelipatan 30 menit (usulan). |
| **BR-02** | Reservasi aktif (Menunggu, Disetujui, Berlangsung) pada ruang yang sama tidak boleh beririsan waktu. |
| **BR-03** | Jumlah peserta tidak boleh melebihi kapasitas ruang. |
| **BR-04** | Jam operasional default: Senin–Jumat 08.30–17.30, Sabtu 08.30–14.00; Minggu tanpa persetujuan khusus ditolak; di luar jam perlu persetujuan khusus. |
| **BR-05** | Pemohon pribadi: maksimal 2 reservasi aktif bersamaan dan maksimal 3 jam per reservasi pada ruang diskusi/kelas (usulan). |
| **BR-06** | Batas pengajuan: ruang terbuka min. 1 jam sebelum mulai; ruang perlu persetujuan min. 1 hari kerja; Aula dan acara min. 3 hari kerja (usulan). |
| **BR-07** | Blok jadwal kuliah dan blokir petugas mengalahkan reservasi; reservasi terdampak dibatalkan dengan alasan dan notifikasi. |
| **BR-08** | Pemohon hanya dapat membatalkan reservasinya sendiri sebelum batas waktu. |
| **BR-09** | Setiap perubahan status dicatat: siapa, kapan, dari status mana ke mana, alasan. |
| **BR-10** | Semua waktu ditampilkan WITA (UTC+8) dan disimpan dengan zona waktu jelas. |
| **BR-11** | Pengajuan atas nama organisasi hanya oleh pengurus terdaftar organisasi tersebut. |

Uji penting: mulai = selesai ditolak; peserta = kapasitas diterima, kapasitas + 1
ditolak; reservasi ketiga ditolak; blokir baru membatalkan reservasi terdampak;
log tersimpan setiap transisi; non-pengurus tidak melihat opsi organisasi.

---

## 8. Spesifikasi data (ringkas)

Entitas: `users`, `organizations`, `org_members`, `reservations`,
`reservation_events`, `attachments`, `rooms`, `room_facilities`, `room_blocks`.

Detail skema, invariant, dan constraint ada di `docs/DATA.md`.

Syarat teknis wajib: **pencegahan irisan waktu dijamin pada lapisan penyimpanan
data (transaksi atau constraint), bukan hanya validasi di layar.**

---

## 9. Validasi dan perilaku gagal

| Kondisi | Perilaku |
|---|---|
| Input tidak valid | Tolak, tandai kolom, jelaskan alasan yang bisa diperbaiki |
| Jaringan putus saat kirim | Pengguna memeriksa Reservasi saya tanpa mengajukan ulang |
| Ruang dinonaktifkan/diblokir | Reservasi terdampak dibatalkan + alasan + notifikasi |
| Lampiran gagal | Pengajuan tidak terkirim setengah jadi |
| Klik Kirim dua kali | Hanya satu reservasi (kunci idempoten) |
| Slot diambil saat memilih | Cek ulang saat kirim; gagal dengan penjelasan + tawaran slot lain |
| Sesi habis | Login ulang; isian dipulihkan bila memungkinkan |
| Email gagal | Reservasi tetap berlaku; dicoba ulang dan dicatat |

Pesan kunci:

- Slot sudah diambil: "Slot ini baru saja dipesan. Pilih jam lain atau lihat ruang serupa."
- Peserta melebihi kapasitas: "Kapasitas ruang ini maksimal {N} orang. Kurangi peserta atau pilih ruang lebih besar."
- Perlu persetujuan: "Pengajuan diterima. Ruang ini perlu persetujuan petugas. Slot ditahan untuk Anda."
- Ditolak: "Pengajuan ditolak. Alasan: {alasan}. Anda dapat mengajukan ulang."
- Sesi berakhir: "Silakan masuk untuk melanjutkan."
- Batas pembatalan lewat: "Batas pembatalan sudah lewat. Hubungi petugas Sarana Prasarana."

Pesan berhasil hanya muncul setelah operasi benar-benar berhasil. Kesalahan
server tidak menampilkan detail internal.

---

## 10. Kriteria penerimaan

| ID | Given | When | Then | Uji untuk |
|---|---|---|---|---|
| AC-01 | Slot tersedia, akun valid | Pengguna mengirim pengajuan | Satu reservasi valid dengan ID dan status | RV-03/04 |
| AC-02 | Slot tersedia, dua akun valid | Dua pengajuan dikirim bersamaan | Tepat satu berhasil, satu ditolak karena konflik | RV-03, BR-02 |
| AC-03 | Pengajuan sudah berhasil | Request yang sama diulang | Tidak ada reservasi ganda | RV-05 |
| AC-04 | Reservasi milik A | B mencoba membatalkan | Akses ditolak, data tidak berubah | PB-02, SEC-03 |
| AC-05 | Peserta melebihi kapasitas | Pengguna mengirim | Ditolak dengan alasan, kolom ditandai | BR-03 |
| AC-06 | Ruang Perlu persetujuan | Pengguna mengirim | Status Menunggu; slot ditahan; pengguna lain tidak dapat memesan | RS-02, CR-03 |
| AC-07 | Pengajuan menunggu | Petugas menolak tanpa alasan | Ditolak oleh sistem; alasan wajib | AP-02 |
| AC-08 | Reservasi Disetujui | Pemohon membatalkan sebelum batas | Status Dibatalkan, slot kembali tersedia, log tercatat | PB-01/02 |
| AC-09 | Reservasi Disetujui | Petugas membuat blokir pada slot itu | Reservasi dibatalkan, pemohon diberi notifikasi | BR-07 |
| AC-10 | Reservasi Disetujui, waktu mulai +15 menit | Pemohon belum check-in | Status Tidak hadir, slot dilepas | CI-02 |
| AC-11 | Pengguna anonim | Mengakses endpoint reservasi | Ditolak | AK-05 |
| AC-12 | Layanan email mati | Reservasi disetujui | Reservasi tetap sah; email dicoba ulang | NT-03 |

Jenis uji: unit dan integrasi untuk aturan bisnis, uji konkurensi untuk alokasi
slot, uji keamanan akses, usability test, UAT dengan petugas.

---

## 11. Nonfungsional dan keamanan (ringkas)

- 95% pencarian ketersediaan <= 2 detik pada data uji representatif (40 ruang, 10.000 reservasi).
- Tidak ada reservasi ganda pada uji konkurensi (mis. 100 request serentak ke satu slot).
- Restart tidak menghilangkan reservasi/status/jadwal; cadangan dapat dipulihkan.
- Hak akses diperiksa server pada setiap permintaan.
- Lampiran dibatasi tipe/ukuran, disimpan di luar folder publik.
- Rahasia konfigurasi tidak disimpan di kode/prompt/log; pengujian memakai identitas sintetis.
- Audit log tanpa data berlebih.
- WCAG 2.1 AA untuk kontras; status tidak hanya dibedakan lewat warna.

---

## 12. Keputusan terbuka

1. Siapa pemilik produk dan penanggung jawab operasional (Sarana Prasarana, BAAK, atau Kemahasiswaan)?
2. Daftar resmi ruang, kapasitas, fasilitas, dan kebijakan akses tiap ruang.
3. Apakah Perpustakaan dan Creative Gallery dapat dipinjam, dan oleh siapa?
4. Apakah Microsoft 365 (SSO) dapat dipakai; apakah jadwal dari SINERGY dapat diakses?
5. Batas pemakaian: durasi, jumlah reservasi aktif, hari/jam operasional, hari libur.
6. Apakah pihak luar kampus atau acara berbayar dilayani pada rilis berikutnya?
7. Lama retensi data reservasi/lampiran dan penanggung jawab insiden.
8. Definisi hari kerja/libur dan kalender yang dipakai untuk BR-06.
9. Peran yang termasuk "Khusus" (RS-02).
10. Apakah panitia dihitung dalam kapasitas (BR-03).
11. Apakah batas 3 jam per reservasi (BR-05) tetap berlaku; apakah Menunggu dihitung aktif; apakah organisasi dikecualikan.
12. Apakah jam mulai wajib kelipatan 30 menit; apakah lintas hari diperbolehkan; apakah ada buffer antar-reservasi.
13. Masa simpan idempotency key (RV-05).

Keputusan implementasi sementara (default aman) dicatat di `AGENTS.md`.

---

## 13. Ketertelusuran

| Tujuan | Requirement | Uji | Metrik |
|---|---|---|---|
| Tanpa bentrok | RV-03, RV-05, BR-02 | AC-02, AC-03, uji konkurensi | Jumlah konflik = 0 |
| Mudah diajukan | CR-01–CR-05, RV-01, RV-04 | Usability test, AC-01 | Tanpa bantuan >= 85% |
| Status jelas | AP-02, NT-01, status | AC-06, AC-07 | Kesalahan memahami status |
| Bisa dibatalkan | PB-01–PB-03, BR-08 | AC-04, AC-08 | Slot kembali tersedia |
| Ruang terpakai efektif | CI-01, CI-02, LP-02 | AC-10 | Tingkat tidak hadir, pemanfaatan |
| Data aman | AK-01–AK-05, SEC-01–SEC-07 | AC-04, AC-11 | Akses tidak sah = 0 |

Urutan tugas AI coding (usulan):

1. Struktur data: entitas, validasi waktu, status dengan data sintetis.
2. Alokasi slot: RV-03, RV-05, BR-01–BR-03; tanpa fitur baru; uji sukses, konflik, input tidak valid, request berulang.
3. Persetujuan dan pembatalan: AP-01–AP-03, PB-01–PB-02, BR-08.
4. Antarmuka status: layar Reservasi saya dan pesan kegagalan.
