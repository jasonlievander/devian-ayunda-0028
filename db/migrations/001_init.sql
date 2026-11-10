CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE reservation_status AS ENUM (
  'menunggu',
  'disetujui',
  'berlangsung',
  'selesai',
  'ditolak',
  'dibatalkan',
  'kedaluwarsa',
  'tidak_hadir'
);

CREATE TYPE room_policy AS ENUM ('terbuka', 'perlu_persetujuan', 'khusus');

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  peran TEXT NOT NULL CHECK (peran IN ('mahasiswa', 'dosen', 'tendik', 'petugas', 'admin')),
  status TEXT NOT NULL DEFAULT 'aktif'
);

CREATE TABLE organizations (
  id BIGSERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('BEM', 'HIMA', 'UKM'))
);

CREATE TABLE org_members (
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  org_id BIGINT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  jabatan TEXT NOT NULL,
  periode TEXT NOT NULL,
  PRIMARY KEY (user_id, org_id, periode)
);

CREATE TABLE rooms (
  id BIGSERIAL PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  tipe TEXT NOT NULL,
  lantai TEXT,
  kapasitas INTEGER CHECK (kapasitas IS NULL OR kapasitas > 0),
  kebijakan room_policy NOT NULL DEFAULT 'terbuka',
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_roles TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE room_facilities (
  room_id BIGINT NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  fasilitas TEXT NOT NULL,
  PRIMARY KEY (room_id, fasilitas)
);

CREATE TABLE room_blocks (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  mulai TIMESTAMPTZ NOT NULL,
  selesai TIMESTAMPTZ NOT NULL,
  alasan TEXT NOT NULL,
  sumber TEXT NOT NULL DEFAULT 'petugas'
    CHECK (sumber IN ('kuliah', 'petugas', 'perawatan', 'ujian', 'acara_kampus')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT room_blocks_time_check CHECK (selesai > mulai),
  CONSTRAINT room_blocks_no_overlap EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(mulai, selesai, '[)') WITH &&
  )
);

CREATE TABLE reservations (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT NOT NULL UNIQUE,
  room_id BIGINT NOT NULL REFERENCES rooms (id),
  user_id BIGINT NOT NULL REFERENCES users (id),
  org_id BIGINT REFERENCES organizations (id),
  mulai TIMESTAMPTZ NOT NULL,
  selesai TIMESTAMPTZ NOT NULL,
  keperluan TEXT NOT NULL,
  peserta INTEGER NOT NULL CHECK (peserta > 0),
  status reservation_status NOT NULL,
  kunci_idempoten TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reservations_time_check CHECK (selesai > mulai),
  CONSTRAINT reservations_idempotency UNIQUE (user_id, kunci_idempoten),
  CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(mulai, selesai, '[)') WITH &&
  ) WHERE (status IN ('menunggu', 'disetujui', 'berlangsung'))
);

CREATE INDEX reservations_room_time_idx ON reservations (room_id, mulai, selesai);
CREATE INDEX reservations_user_status_idx ON reservations (user_id, status);

CREATE TABLE reservation_events (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES reservations (id) ON DELETE CASCADE,
  dari reservation_status,
  ke reservation_status NOT NULL,
  pelaku BIGINT REFERENCES users (id),
  waktu TIMESTAMPTZ NOT NULL DEFAULT now(),
  alasan TEXT
);

CREATE TABLE reservation_daily_seq (
  day DATE PRIMARY KEY,
  last_value INTEGER NOT NULL CHECK (last_value > 0)
);
