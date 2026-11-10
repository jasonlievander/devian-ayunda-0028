
const ROOMS = [
  { id: 1, code: "A.1.1", name: "A.1.1 (STUDIO POLA)", group: "Gedung A", floor: 1, policy: "perlu_persetujuan", capacity: null, description: "Studio pola untuk praktik Desain Mode.", image: "/assets/rooms/studio-pola.webp", imageAlt: "Studio pola Desain Mode IDB Bali dengan manekin dan bahan kain." },
  { id: 2, code: "A.1.2", name: "A.1.2 (LECT 1A)", group: "Gedung A", floor: 1, policy: "perlu_persetujuan", capacity: null, description: "Ruang kelas.", image: "/assets/rooms/ruang-kelas.webp", imageAlt: "Ilustrasi ruang kelas IDB Bali dengan meja dan kursi kuliah.", photoLabel: "Ilustrasi kelas" },
  { id: 3, code: "A.1.3", name: "A.1.3 (LAB 1C)", group: "Gedung A", floor: 1, policy: "perlu_persetujuan", capacity: null, description: "Laboratorium komputer.", image: "/assets/rooms/lab-komputer.webp", imageAlt: "Ilustrasi lab komputer IDB Bali dengan deretan komputer.", photoLabel: "Ilustrasi lab" },
  { id: 4, code: "A.2.1", name: "A.2.1 (LAB 2B)", group: "Gedung A", floor: 2, policy: "perlu_persetujuan", capacity: null, description: "Laboratorium komputer.", image: "/assets/rooms/lab-komputer.webp", imageAlt: "Ilustrasi lab komputer IDB Bali dengan deretan komputer.", photoLabel: "Ilustrasi lab" },
  { id: 5, code: "A.2.2", name: "A.2.2 (LAB 2C)", group: "Gedung A", floor: 2, policy: "perlu_persetujuan", capacity: null, description: "Laboratorium komputer.", image: "/assets/rooms/lab-komputer.webp", imageAlt: "Ilustrasi lab komputer IDB Bali dengan deretan komputer.", photoLabel: "Ilustrasi lab" },
  { id: 6, code: "A.2.3", name: "A.2.3 (LECT 2D)", group: "Gedung A", floor: 2, policy: "perlu_persetujuan", capacity: null, description: "Ruang kelas.", image: "/assets/rooms/ruang-kelas.webp", imageAlt: "Ilustrasi ruang kelas IDB Bali dengan meja dan kursi kuliah.", photoLabel: "Ilustrasi kelas" },
  { id: 7, code: "B.2.1", name: "B.2.1 (INTERNATIONAL)", group: "Gedung B", floor: 2, policy: "perlu_persetujuan", capacity: null, description: "Ruang program internasional.", image: "/assets/rooms/ruang-kelas.webp", imageAlt: "Ilustrasi ruang kelas IDB Bali dengan meja dan kursi kuliah.", photoLabel: "Ilustrasi kelas" },
  { id: 8, code: "B.1.3", name: "B.1.3 (STUDIO 3)", group: "Gedung B", floor: 1, policy: "perlu_persetujuan", capacity: null, description: "Studio praktik.", image: "/assets/rooms/studio-gambar.webp", imageAlt: "Ilustrasi studio gambar IDB Bali dengan meja kerja dan kursi.", photoLabel: "Ilustrasi studio" },
  { id: 9, code: "B.1.4", name: "B.1.4 (LAB FASHION)", group: "Gedung B", floor: 1, policy: "perlu_persetujuan", capacity: null, description: "Pengembangan produk fashion secara digital dan manual, termasuk eksplorasi teknik dan pola. Diperuntukkan bagi mahasiswa Desain Mode.", image: "/assets/rooms/lab-fashion.webp", imageAlt: "Lab Fashion Design IDB Bali dengan mesin jahit dan meja kerja." },
  { id: 10, code: "C.1.1", name: "C.1.1 (LAB 1A)", group: "Gedung C", floor: 1, policy: "perlu_persetujuan", capacity: null, description: "Laboratorium komputer.", image: "/assets/rooms/lab-komputer.webp", imageAlt: "Ilustrasi lab komputer IDB Bali dengan deretan komputer.", photoLabel: "Ilustrasi lab" },
  { id: 11, code: "C.1.2", name: "C.1.2 (LAB STI)", group: "Gedung C", floor: 1, policy: "perlu_persetujuan", capacity: null, description: "Laboratorium Sistem & Teknologi Informasi Bisnis.", image: "/assets/rooms/lab-sti.webp", imageAlt: "Lab Software Development IDB Bali dengan komputer dan meja kerja." },
  { id: 12, code: "C.1.3", name: "C.1.3 (LECT 1)", group: "Gedung C", floor: 1, policy: "perlu_persetujuan", capacity: null, description: "Ruang kelas.", image: "/assets/rooms/ruang-kelas.webp", imageAlt: "Ilustrasi ruang kelas IDB Bali dengan meja dan kursi kuliah.", photoLabel: "Ilustrasi kelas" },
  { id: 13, code: "C.2.1", name: "C.2.1 (LECT 2A)", group: "Gedung C", floor: 2, policy: "perlu_persetujuan", capacity: null, description: "Ruang kelas.", image: "/assets/rooms/ruang-kelas.webp", imageAlt: "Ilustrasi ruang kelas IDB Bali dengan meja dan kursi kuliah.", photoLabel: "Ilustrasi kelas" },
  { id: 14, code: "C.2.2", name: "C.2.2 (LECT 2B)", group: "Gedung C", floor: 2, policy: "perlu_persetujuan", capacity: null, description: "Ruang kelas.", image: "/assets/rooms/ruang-kelas.webp", imageAlt: "Ilustrasi ruang kelas IDB Bali dengan meja dan kursi kuliah.", photoLabel: "Ilustrasi kelas" },
  { id: 15, code: "C.2.3", name: "C.2.3 (STUDIO 2C)", group: "Gedung C", floor: 2, policy: "perlu_persetujuan", capacity: null, description: "Studio praktik.", image: "/assets/rooms/studio-maket.webp", imageAlt: "Ilustrasi studio IDB Bali dengan meja kerja dan papan tulis.", photoLabel: "Ilustrasi studio" },
  { id: 16, code: "C.3.1", name: "C.3.1 (STUDIO 3A)", group: "Gedung C", floor: 3, policy: "perlu_persetujuan", capacity: null, description: "Studio praktik.", image: "/assets/rooms/studio-gambar.webp", imageAlt: "Ilustrasi studio gambar IDB Bali dengan meja kerja dan kursi.", photoLabel: "Ilustrasi studio" },
  { id: 17, code: "C.3.2", name: "C.3.2 (STUDIO 3B)", group: "Gedung C", floor: 3, policy: "perlu_persetujuan", capacity: null, description: "Studio praktik.", image: "/assets/rooms/studio-maket.webp", imageAlt: "Ilustrasi studio IDB Bali dengan meja kerja dan papan tulis.", photoLabel: "Ilustrasi studio" },
  { id: 18, code: "C.3.3", name: "C.3.3 (STUDIO 3C)", group: "Gedung C", floor: 3, policy: "perlu_persetujuan", capacity: null, description: "Studio praktik.", image: "/assets/rooms/studio-gambar.webp", imageAlt: "Ilustrasi studio gambar IDB Bali dengan meja kerja dan kursi.", photoLabel: "Ilustrasi studio" },
  { id: 19, code: "AULA", name: "AULA IDB BALI", group: "Aula & area kampus", floor: null, policy: "perlu_persetujuan", capacity: null, description: "Hall/Aula untuk seminar, workshop, pelatihan, dan kegiatan UKM. Fasilitas acara lengkap.", image: "/assets/rooms/aula.webp", imageAlt: "Aula IDB Bali dengan kursi dan panggung." },
  { id: 20, code: "STUDIO-FOTO", name: "STUDIO FOTO IDB BALI", group: "Aula & area kampus", floor: 1, policy: "perlu_persetujuan", capacity: null, description: "Studio fotografi dan videografi dengan background serta properti penunjang.", image: "/assets/rooms/studio-foto.webp", imageAlt: "Studio foto IDB Bali dengan green screen dan lampu." },
  { id: 21, code: "ROOFTOP", name: "ROOFTOP IDB BALI", group: "Aula & area kampus", floor: null, policy: "perlu_persetujuan", capacity: null, description: "Area rooftop kampus.", image: "/assets/rooms/rooftop-kampus.webp", imageAlt: "Rooftop IDB Bali saat pameran karya.", photoLabel: "Foto kegiatan" },
  { id: 22, code: "INBIS", name: "INBIS IDB BALI", group: "Aula & area kampus", floor: null, policy: "perlu_persetujuan", capacity: null, description: "Ruang Inkubator Bisnis IDB Bali.", image: "/assets/rooms/inbis.webp", imageAlt: "Ruang diskusi Inkubator Bisnis (INBIS) IDB Bali." },
  { id: 23, code: "HALAMAN-A", name: "HALAMAN IDB BALI GEDUNG A", group: "Aula & area kampus", floor: null, policy: "perlu_persetujuan", capacity: null, description: "Area halaman Gedung A.", image: "/assets/rooms/halaman-kampus.webp", imageAlt: "Ilustrasi halaman dan gedung kampus IDB Bali.", photoLabel: "Ilustrasi halaman" },
  { id: 24, code: "HALAMAN-B", name: "HALAMAN IDB BALI GEDUNG B", group: "Aula & area kampus", floor: null, policy: "perlu_persetujuan", capacity: null, description: "Area halaman Gedung B.", image: "/assets/rooms/halaman-kampus.webp", imageAlt: "Ilustrasi halaman dan gedung kampus IDB Bali.", photoLabel: "Ilustrasi halaman" },
  { id: 25, code: "HALAMAN-C", name: "HALAMAN IDB BALI GEDUNG C", group: "Aula & area kampus", floor: null, policy: "perlu_persetujuan", capacity: null, description: "Area halaman Gedung C.", image: "/assets/rooms/halaman-kampus.webp", imageAlt: "Ilustrasi halaman dan gedung kampus IDB Bali.", photoLabel: "Ilustrasi halaman" },
  { id: 26, code: "GSG-LT1", name: "GEDUNG SERBA GUNA IDB BALI - Lt.1", group: "Gedung Serba Guna", floor: 1, policy: "perlu_persetujuan", capacity: null, description: "Gedung Serba Guna lantai 1 untuk kegiatan luas, olahraga, atau ekstrakurikuler.", image: "/assets/rooms/gsg.webp", imageAlt: "Gedung Serba Guna IDB Bali.", photoLabel: "Foto bangunan" },
  { id: 27, code: "GSG-LT2", name: "GEDUNG SERBA GUNA IDB BALI - Lt.2", group: "Gedung Serba Guna", floor: 2, policy: "perlu_persetujuan", capacity: null, description: "Gedung Serba Guna lantai 2.", image: "/assets/rooms/gsg.webp", imageAlt: "Gedung Serba Guna IDB Bali.", photoLabel: "Foto bangunan" },
  { id: 28, code: "GSG-LT3", name: "GEDUNG SERBA GUNA IDB BALI - Lt.3", group: "Gedung Serba Guna", floor: 3, policy: "perlu_persetujuan", capacity: null, description: "Gedung Serba Guna lantai 3.", image: "/assets/rooms/gsg.webp", imageAlt: "Gedung Serba Guna IDB Bali.", photoLabel: "Foto bangunan" },
  { id: 29, code: "GEDUNG-B-GEAR", name: "GEDUNG B (Gear inc)", group: "Gedung B (Gear inc)", floor: null, policy: "perlu_persetujuan", capacity: null, description: "Ruang di Gedung B (Gear inc).", image: "/assets/rooms/gedung-b-gear.webp", imageAlt: "Gedung kampus IDB Bali (ilustrasi Gedung B).", photoLabel: "Ilustrasi gedung" },
  { id: 30, code: "LAB-KOMPUTER", name: "Lab Komputer", group: "Fasilitas kampus", floor: 1, policy: "perlu_persetujuan", capacity: 36, description: "Komputer 12th Gen Intel dan NVIDIA, terhubung Local Area Network. Untuk kelas maksimum 24–36 mahasiswa; dapat digunakan semua program studi.", image: "/assets/rooms/lab-komputer.webp", imageAlt: "Lab komputer IDB Bali dengan deretan komputer." },
  { id: 31, code: "LAB-IMAC", name: "Lab iMac", group: "Fasilitas kampus", floor: 1, policy: "perlu_persetujuan", capacity: null, description: "iMac dengan chip M1 untuk praktik desain. Dapat digunakan semua program studi.", image: "/assets/rooms/lab-imac.webp", imageAlt: "Lab iMac IDB Bali dengan komputer iMac." },
  { id: 32, code: "PERPUSTAKAAN", name: "Perpustakaan", group: "Fasilitas kampus", floor: 3, policy: "perlu_persetujuan", capacity: null, description: "Koleksi buku internasional dan domestik, jurnal cetak dan online, serta majalah penunjang perkuliahan.", image: "/assets/rooms/perpustakaan.webp", imageAlt: "Perpustakaan IDB Bali dengan rak buku dan meja baca." },
  { id: 33, code: "CREATIVE-GALLERY", name: "Creative Gallery", group: "Fasilitas kampus", floor: 1, policy: "perlu_persetujuan", capacity: null, description: "Galeri karya mahasiswa dari berbagai program studi di IDB Bali.", image: "/assets/rooms/creative-gallery.webp", imageAlt: "Creative Gallery IDB Bali dengan display karya mahasiswa." },
];

window.IDB_ROOMS = ROOMS;

const WITA = "Asia/Makassar";
const witaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: WITA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const form = document.querySelector("#reservation-form");
const roomSelect = document.querySelector("#room");
const namaInput = document.querySelector("#nama");
const nimInput = document.querySelector("#nim");
if (
  sessionStorage.getItem("idb-role") === "form" &&
  sessionStorage.getItem("idb-form-nim") !== null &&
  nimInput.value === ""
) {
  nimInput.value = sessionStorage.getItem("idb-form-nim") ?? "";
}
const dateInput = document.querySelector("#date");
const startSelect = document.querySelector("#start");
const endSelect = document.querySelector("#end");
const purposeSelect = document.querySelector("#purpose");
const participantsInput = document.querySelector("#participants");
const submitButton = document.querySelector("#submit");
const formStatus = document.querySelector("#form-status");
const errorSummary = document.querySelector("#error-summary");
const timeError = document.querySelector("#time-error");
const dateError = document.querySelector("#date-error");
const namaError = document.querySelector("#nama-error");
const nimError = document.querySelector("#nim-error");
const participantsError = document.querySelector("#participants-error");
const conflictAction = document.querySelector("#conflict-action");
const roomHint = document.querySelector("#room-hint");
const roomDesc = document.querySelector("#room-desc");
const capacityHint = document.querySelector("#capacity-hint");
const timeHint = document.querySelector("#time-hint");
const idleState = document.querySelector("#idle-state");
const result = document.querySelector("#result");
const announcer = document.querySelector("#announcer");
const resetButton = document.querySelector("#reset");
const logoutSession = document.querySelector("#logout-session");

const siteHeader = document.querySelector(".site-header");
function syncHeaderHeight() {
  if (!siteHeader) return;
  document.documentElement.style.setProperty(
    "--header-height",
    `${siteHeader.offsetHeight}px`,
  );
}
if (siteHeader) {
  syncHeaderHeight();
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(syncHeaderHeight).observe(siteHeader);
  }
  window.addEventListener("resize", syncHeaderHeight);
}

let idempotencyKey = createKey();
let submitting = false;
let completed = false;

function createKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayWita() {
  return witaDate.format(new Date());
}

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function defaultDate() {
  let candidate = addDays(todayWita(), 1);
  const day = new Date(`${candidate}T00:00:00Z`).getUTCDay();
  if (day === 6) candidate = addDays(candidate, 2);
  if (day === 0) candidate = addDays(candidate, 1);
  return candidate;
}

function addMinutesToTime(value, minutes) {
  const [hours, mins] = value.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function timeOptions(startMinutes, endMinutes, step) {
  const options = [];
  for (let minute = startMinutes; minute <= endMinutes; minute += step) {
    const hours = String(Math.floor(minute / 60)).padStart(2, "0");
    const minutes = String(minute % 60).padStart(2, "0");
    options.push(`${hours}:${minutes}`);
  }
  return options;
}

function fillSelect(select, values, selected) {
  select.replaceChildren();
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value.replace(":", ".");
    if (value === selected) option.selected = true;
    select.append(option);
  }
}

function selectedRoom() {
  return ROOMS.find((room) => String(room.id) === roomSelect.value) ?? ROOMS[0];
}

function syncRoom() {
  const room = selectedRoom();
  const policyText =
    room.policy === "terbuka"
      ? "otomatis disetujui"
      : "menunggu persetujuan petugas";
  const capacityLabel =
    room.capacity === null
      ? "belum dipublikasikan"
      : `${room.capacity} orang`;
  const floorLabel = room.floor === null ? "" : `Lantai ${room.floor}`;
  const parts = [room.group, floorLabel, `Kapasitas ${capacityLabel}`, policyText];

  roomHint.textContent = parts.filter(Boolean).join(" · ");
  capacityHint.textContent =
    room.capacity === null
      ? "Kapasitas belum dipublikasikan; petugas akan memverifikasi."
      : `Maksimal ${room.capacity} orang.`;
  roomDesc.textContent = room.description;

  if (room.capacity === null) {
    participantsInput.removeAttribute("max");
  } else {
    participantsInput.max = String(room.capacity);
    if (Number(participantsInput.value) > room.capacity) {
      participantsInput.value = String(room.capacity);
    }
  }
}

function renderCatalog() {
  const list = document.querySelector("#catalog-list");
  list.replaceChildren();

  for (const room of ROOMS) {
    const item = document.createElement("li");
    item.className = "catalog-item";

    const media = document.createElement("div");
    media.className = "catalog-media";

    const image = document.createElement("img");
    image.src = room.image;
    image.alt = room.imageAlt;
    image.width = 800;
    image.height = 600;
    image.loading = "lazy";
    image.decoding = "async";

    media.append(image);

    if (room.photoLabel) {
      const label = document.createElement("span");
      label.className = "catalog-photo-label";
      label.textContent = room.photoLabel;
      media.append(label);
    }

    const body = document.createElement("div");
    body.className = "catalog-body";

    const main = document.createElement("div");
    main.className = "catalog-main";

    const name = document.createElement("span");
    name.className = "catalog-name";
    name.textContent = room.name;

    const meta = document.createElement("span");
    meta.className = "catalog-meta";
    const floor = room.floor === null ? "" : `Lt. ${room.floor}`;
    const capacity =
      room.capacity === null
        ? "Kapasitas belum dipublikasikan"
        : `${room.capacity} orang (resmi)`;
    meta.textContent = [room.group, floor, capacity].filter(Boolean).join(" · ");

    const description = document.createElement("p");
    description.textContent = room.description;

    main.append(name, meta);
    body.append(main, description);
    item.append(media, body);
    list.append(item);
  }
}

function witaNowMinutes() {
  const value = new Intl.DateTimeFormat("en-GB", {
    timeZone: WITA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function syncDay() {
  const value = dateInput.value;
  if (!value) return;
  const room = selectedRoom();
  const day = new Date(`${value}T00:00:00Z`).getUTCDay();
  const isToday = value === todayWita();
  const startLimit = day === 6 ? "13:30" : "17:00";
  const endLimit = day === 6 ? "14:00" : "17:30";
  const leadMinutes = room.policy === "terbuka" ? 60 : 24 * 60;
  const minToday = isToday
    ? Math.ceil((witaNowMinutes() + leadMinutes) / 30) * 30
    : 0;

  for (const option of startSelect.options) {
    const [hours, minutes] = option.value.split(":").map(Number);
    const tooSoon = isToday && hours * 60 + minutes < minToday;
    option.disabled = option.value > startLimit || tooSoon;
  }
  for (const option of endSelect.options) {
    option.disabled = option.value > endLimit;
  }

  const firstEnabled = [...startSelect.options].find(
    (option) => !option.disabled,
  );
  if (startSelect.selectedOptions[0]?.disabled && firstEnabled) {
    startSelect.value = firstEnabled.value;
  }
  if (endSelect.value > endLimit) endSelect.value = endLimit;

  if (startSelect.value >= endSelect.value) {
    const next = [...startSelect.options].find(
      (option) => !option.disabled && option.value > startSelect.value,
    );
    endSelect.value = next ? next.value : endLimit;
  }

  if (isToday && room.policy !== "terbuka") {
    timeHint.textContent =
      "Ruang ini perlu diajukan minimal 1 hari kerja. Pilih tanggal lain.";
  } else if (isToday && !firstEnabled) {
    timeHint.textContent = "Tidak ada slot tersisa hari ini. Pilih tanggal lain.";
  } else if (isToday && room.policy === "terbuka") {
    const dayNote =
      day === 0
        ? " Hari Minggu perlu persetujuan petugas."
        : day === 6
          ? " Sabtu tutup pukul 14.00 WITA."
          : "";
    timeHint.textContent = `Slot 30 menit. Hari ini minimal 1 jam dari sekarang; slot paling awal ${firstEnabled.value.replace(":", ".")} WITA.${dayNote}`;
  } else if (day === 0) {
    timeHint.textContent =
      "Hari Minggu hanya dapat diajukan dengan persetujuan petugas.";
  } else if (day === 6) {
    timeHint.textContent =
      "Sabtu tutup pukul 14.00 WITA. Slot 30 menit, mulai 08.30.";
  } else {
    timeHint.textContent = "Slot 30 menit, 08.30–17.30 WITA.";
  }
}

function clearErrors() {
  for (const element of [
    namaInput,
    nimInput,
    dateInput,
    startSelect,
    endSelect,
    participantsInput,
  ]) {
    element.removeAttribute("aria-invalid");
  }
  namaError.hidden = true;
  namaError.textContent = "";
  nimError.hidden = true;
  nimError.textContent = "";
  timeError.hidden = true;
  timeError.textContent = "";
  participantsError.hidden = true;
  participantsError.textContent = "";
  conflictAction.hidden = true;
  errorSummary.hidden = true;
  errorSummary.textContent = "";
}

function clearFieldError(kind) {
  if (kind === "nama") {
    namaError.hidden = true;
    namaError.textContent = "";
    namaInput.removeAttribute("aria-invalid");
  }
  if (kind === "nim") {
    nimError.hidden = true;
    nimError.textContent = "";
    nimInput.removeAttribute("aria-invalid");
  }
  if (kind === "date") {
    dateError.hidden = true;
    dateError.textContent = "";
    dateInput.removeAttribute("aria-invalid");
  }
  if (kind === "time") {
    timeError.hidden = true;
    timeError.textContent = "";
    conflictAction.hidden = true;
    startSelect.removeAttribute("aria-invalid");
    endSelect.removeAttribute("aria-invalid");
  }
  if (kind === "participants") {
    participantsError.hidden = true;
    participantsError.textContent = "";
    participantsInput.removeAttribute("aria-invalid");
  }
}

function showFieldError(kind, message, options = {}) {
  if (kind === "nama") {
    namaError.textContent = message;
    namaError.hidden = false;
    namaInput.setAttribute("aria-invalid", "true");
    namaInput.focus();
  } else if (kind === "nim") {
    nimError.textContent = message;
    nimError.hidden = false;
    nimInput.setAttribute("aria-invalid", "true");
    nimInput.focus();
  } else if (kind === "date") {
    dateError.textContent = message;
    dateError.hidden = false;
    dateInput.setAttribute("aria-invalid", "true");
    dateInput.focus();
  } else if (kind === "participants") {
    participantsError.textContent = message;
    participantsError.hidden = false;
    participantsInput.setAttribute("aria-invalid", "true");
    participantsInput.focus();
  } else {
    timeError.textContent = message;
    timeError.hidden = false;
    startSelect.setAttribute("aria-invalid", "true");
    endSelect.setAttribute("aria-invalid", "true");
    if (options.conflict) conflictAction.hidden = false;
    startSelect.focus();
  }
  announcer.textContent = message;
}

function showSummary(message) {
  errorSummary.textContent = message;
  errorSummary.hidden = false;
  errorSummary.focus();
}

function setBusy(busy) {
  submitting = busy;
  submitButton.disabled = busy || completed;
  if (busy) {
    submitButton.setAttribute("aria-busy", "true");
    formStatus.textContent = "Mengalokasikan slot…";
  } else {
    submitButton.removeAttribute("aria-busy");
    if (!completed) formStatus.textContent = "";
  }
}

function formatDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: WITA,
  }).format(date);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderSlip(data, replayed, submitted) {
  const statusText =
    data.status === "disetujui"
      ? "Disetujui"
      : data.status === "menunggu"
        ? "Menunggu"
        : capitalize(data.status);

  document.querySelector("#slip-status").textContent = statusText;
  document.querySelector("#slip-status").classList.toggle(
    "is-pending",
    data.status === "menunggu",
  );
  document.querySelector("#slip-id").textContent = data.businessId;
  document.querySelector("#slip-room").textContent = submitted.room.name;
  document.querySelector("#slip-date").textContent = formatDate(
    submitted.date,
  );
  document.querySelector("#slip-time").textContent =
    `${submitted.start.replace(":", ".")}–${submitted.end.replace(":", ".")} WITA`;
  document.querySelector("#slip-participants").textContent =
    `${data.participants} orang`;
  document.querySelector("#slip-purpose").textContent = capitalize(
    submitted.purpose,
  );
  document.querySelector("#slip-name").textContent = submitted.nama;
  document.querySelector("#slip-nim").textContent = submitted.nim;

  const note = document.querySelector("#slip-note");
  if (replayed) {
    note.textContent =
      "Permintaan ini sudah tercatat sebelumnya. Tidak ada reservasi baru.";
  } else if (data.status === "menunggu") {
    note.textContent = "Slot ditahan untuk Anda sampai petugas memutuskan.";
  } else {
    note.textContent = "Slot terkunci untuk Anda pada waktu tersebut.";
  }

  idleState.hidden = true;
  result.hidden = false;
  completed = true;
  submitButton.disabled = true;
  formStatus.textContent =
    "Reservasi tercatat. Gunakan “Ajukan lagi” untuk pengajuan baru.";
  document.querySelector("#result .slip").focus();
}

function handleApiError(error, status) {
  const message =
    error && typeof error.message === "string"
      ? error.message
      : "Pengajuan tidak dapat diproses. Coba lagi.";

  if (error && error.field === "pemohonNama") {
    showFieldError("nama", message);
    return;
  }
  if (error && error.field === "nim") {
    showFieldError("nim", message);
    return;
  }
  if (error && error.field === "peserta") {
    showFieldError("participants", message);
    return;
  }
  if (error && (error.field === "mulai" || error.field === "selesai")) {
    showFieldError("time", message, {
      conflict: error.code === "SLOT_CONFLICT",
    });
    return;
  }
  if (status === 403) {
    showSummary(message);
    return;
  }
  showSummary(message);
}

function validate() {
  const room = selectedRoom();
  const participants = Number(participantsInput.value);
  const nama = namaInput.value.trim();
  const nim = nimInput.value.trim();

  if (nama.length < 2) {
    showFieldError("nama", "Nama pemohon minimal 2 karakter.");
    return false;
  }
  if (!/^\d{5,20}$/.test(nim)) {
    showFieldError("nim", "NIM harus 5–20 digit angka.");
    return false;
  }
  if (!dateInput.value) {
    showFieldError("date", "Pilih tanggal reservasi terlebih dahulu.");
    return false;
  }
  if (!startSelect.value || !endSelect.value) {
    showFieldError("time", "Pilih jam mulai dan jam selesai.");
    return false;
  }
  if (!startSelect.selectedOptions[0] || startSelect.selectedOptions[0].disabled) {
    showFieldError(
      "date",
      room.policy === "terbuka"
        ? "Tidak ada slot tersisa hari ini. Pilih tanggal lain."
        : "Ruang ini perlu diajukan minimal 1 hari kerja. Pilih tanggal lain.",
    );
    return false;
  }
  if (startSelect.value >= endSelect.value) {
    showFieldError("time", "Waktu selesai harus setelah waktu mulai.");
    return false;
  }

  const day = new Date(`${dateInput.value}T00:00:00Z`).getUTCDay();
  if (day === 6 && endSelect.value > "14:00") {
    showFieldError("time", "Sabtu hanya sampai pukul 14.00 WITA.");
    return false;
  }
  if (!Number.isInteger(participants) || participants < 1) {
    showFieldError("participants", "Jumlah peserta minimal 1 orang.");
    return false;
  }
  if (room.capacity !== null && participants > room.capacity) {
    showFieldError(
      "participants",
      `Jumlah peserta harus 1–${room.capacity} orang.`,
    );
    return false;
  }

  return true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting || completed) return;

  clearErrors();
  if (!validate()) return;

  const room = selectedRoom();
  const submitted = {
    date: dateInput.value,
    start: startSelect.value,
    end: endSelect.value,
    room,
    purpose: purposeSelect.value,
    nama: namaInput.value.trim(),
    nim: nimInput.value.trim(),
  };
  const payload = {
    roomId: String(room.id),
    pemohonNama: submitted.nama,
    nim: submitted.nim,
    start: `${submitted.date}T${submitted.start}:00+08:00`,
    end: `${submitted.date}T${submitted.end}:00+08:00`,
    purpose: submitted.purpose,
    participants: Number(participantsInput.value),
  };

  setBusy(true);
  try {
    const response = await fetch("/reservations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      handleApiError(body && body.error, response.status);
      return;
    }

    renderSlip(body.data, body.replayed, submitted);
    window.dispatchEvent(
      new CustomEvent("reservation-created", {
        detail: { businessId: body.data.businessId },
      }),
    );
  } catch {
    showSummary(
      "Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.",
    );
  } finally {
    setBusy(false);
  }
});

resetButton.addEventListener("click", () => {
  const previousEnd = endSelect.value;
  completed = false;
  result.hidden = true;
  idleState.hidden = false;
  form.reset();
  nimInput.value = sessionStorage.getItem("idb-form-nim") ?? "";
  roomSelect.selectedIndex = 0;
  purposeSelect.value = "belajar kelompok";
  participantsInput.value = "6";
  dateInput.value = defaultDate();

  const nextStart = previousEnd;
  const nextEnd = addMinutesToTime(nextStart, 60);
  if (nextStart <= "17:00" && nextEnd <= "17:30") {
    startSelect.value = nextStart;
    endSelect.value = nextEnd;
  } else {
    startSelect.value = "10:00";
    endSelect.value = "11:00";
  }
  idempotencyKey = createKey();
  clearErrors();
  syncRoom();
  syncDay();
  setBusy(false);
  formStatus.textContent = "";
  roomSelect.focus();
});

conflictAction.addEventListener("click", () => {
  roomSelect.focus();
});

roomSelect.addEventListener("change", () => {
  syncRoom();
  syncDay();
  clearFieldError("time");
  clearFieldError("participants");
  if (dateInput.value) clearFieldError("date");
});
namaInput.addEventListener("input", () => {
  clearFieldError("nama");
});
nimInput.addEventListener("input", () => {
  clearFieldError("nim");
});
dateInput.addEventListener("change", () => {
  syncDay();
  clearFieldError("date");
});
startSelect.addEventListener("change", () => {
  syncDay();
  clearFieldError("time");
});
endSelect.addEventListener("change", () => {
  clearFieldError("time");
});
participantsInput.addEventListener("input", () => {
  clearFieldError("participants");
});


const groups = new Map();
for (const room of ROOMS) {
  let parent = roomSelect;
  if (room.group) {
    let group = groups.get(room.group);
    if (!group) {
      group = document.createElement("optgroup");
      group.label = room.group;
      roomSelect.append(group);
      groups.set(room.group, group);
    }
    parent = group;
  }
  const option = document.createElement("option");
  option.value = String(room.id);
  option.textContent = room.name;
  parent.append(option);
}

fillSelect(startSelect, timeOptions(8 * 60 + 30, 17 * 60, 30), "10:00");
fillSelect(endSelect, timeOptions(9 * 60, 17 * 60 + 30, 30), "11:00");

dateInput.min = todayWita();
dateInput.value = defaultDate();

syncRoom();
syncDay();
renderCatalog();

const viewReservation = document.querySelector("#view-reservation");
const viewAdmin = document.querySelector("#view-admin");
const navLinks = [...document.querySelectorAll(".site-nav a")];
function renderShellView(moveFocus = false) {
  const showAdmin = location.hash === "#admin";
  viewReservation.hidden = showAdmin;
  viewAdmin.hidden = !showAdmin;

  const activeHash = showAdmin
    ? "#admin"
    : location.hash === "#kalender"
      ? "#kalender"
      : "#reservation";
  for (const link of navLinks) {
    const active = link.getAttribute("href") === activeHash;
    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }

  if (showAdmin) {
    window.scrollTo(0, 0);
  }

  if (!moveFocus) return;

  if (showAdmin) {
    window.refreshAdminPanel?.();
    const target = document.querySelector("#gate").hidden
      ? document.querySelector(".tabs [data-tab='approval']")
      : document.querySelector("#admin-code");
    target?.focus();
  } else if (location.hash === "#kalender") {
    document.querySelector("#calendar-title")?.focus();
  } else {
    document.querySelector("#room")?.focus();
  }
}

logoutSession?.addEventListener("click", () => {
  sessionStorage.removeItem("idb-role");
  sessionStorage.removeItem("idb-admin-code");
  sessionStorage.removeItem("idb-form-email");
  sessionStorage.removeItem("idb-form-nim");
  location.assign("/login");
});

window.addEventListener("hashchange", () => renderShellView(true));
renderShellView(false);
