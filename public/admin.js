(() => {
const ADMIN_KEY = "idb-admin-code";

const adminView = document.querySelector("#view-admin");
const gate = document.querySelector("#gate");
const dashboard = document.querySelector("#dashboard");
const gateForm = document.querySelector("#gate-form");
const codeInput = document.querySelector("#admin-code");
const gateError = document.querySelector("#gate-error");
const gateSubmit = document.querySelector("#gate-submit");

const statPending = document.querySelector("#stat-pending");
const statApproved = document.querySelector("#stat-approved");
const statRooms = document.querySelector("#stat-rooms");
const statTotal = document.querySelector("#stat-total");

const tabs = [...document.querySelectorAll(".tabs [data-tab]")];
const panels = {
  approval: document.querySelector("#panel-approval"),
  all: document.querySelector("#panel-all"),
  blocks: document.querySelector("#panel-blocks"),
  audit: document.querySelector("#panel-audit"),
};

const statusLine = document.querySelector("#admin-status");
const errorBox = document.querySelector("#admin-error");
const errorMessage = document.querySelector("#admin-error-message");
const errorRetry = document.querySelector("#admin-error-retry");
const refreshButton = document.querySelector("#refresh");
const lastUpdated = document.querySelector("#last-updated");
const logoutButton = document.querySelector("#logout");
const announcer = document.querySelector("#admin-announcer");

const approvalList = document.querySelector("#approval-list");
const approvalEmpty = document.querySelector("#approval-empty");

const allList = document.querySelector("#all-list");
const allEmpty = document.querySelector("#all-empty");
const filterForm = document.querySelector("#filter-form");
const filterStatus = document.querySelector("#filter-status");
const filterQuery = document.querySelector("#filter-query");
const filterDate = document.querySelector("#filter-date");
const filterReset = document.querySelector("#filter-reset");

const blockForm = document.querySelector("#block-form");
const blockRoom = document.querySelector("#block-room");
const blockDate = document.querySelector("#block-date");
const blockStart = document.querySelector("#block-start");
const blockEnd = document.querySelector("#block-end");
const blockReason = document.querySelector("#block-reason");
const blockError = document.querySelector("#block-error");
const blockSubmit = document.querySelector("#block-submit");
const blockList = document.querySelector("#block-list");
const blockEmpty = document.querySelector("#block-empty");

const eventList = document.querySelector("#event-list");
const eventEmpty = document.querySelector("#event-empty");

const reasonDialog = document.querySelector("#reason-dialog");
const reasonForm = document.querySelector("#reason-form");
const reasonKicker = document.querySelector("#reason-kicker");
const reasonTitle = document.querySelector("#reason-title");
const reasonHint = document.querySelector("#reason-hint");
const reasonLabel = document.querySelector("#reason-label");
const reasonInput = document.querySelector("#reason-input");
const reasonError = document.querySelector("#reason-error");
const reasonCancel = document.querySelector("#reason-cancel");
const reasonSubmit = document.querySelector("#reason-submit");

const STATUS_LABELS = {
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
  berlangsung: "Berlangsung",
  selesai: "Selesai",
};

let liveRefreshTimer = null;
let liveSource = null;

const state = {
  code: sessionStorage.getItem(ADMIN_KEY),
  tab: "approval",
  filters: { status: "semua", query: "", date: "" },
  reasonAction: null,
  roomsLoaded: false,
};

function witaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function setStatus(message) {
  statusLine.textContent = message;
}

function markUpdated() {
  if (!lastUpdated) return;
  const time = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Makassar",
  }).format(new Date());
  lastUpdated.textContent = `Diperbarui ${time.replace(":", ".")} WITA`;
}

function showError(message, retry = true) {
  errorMessage.textContent = message;
  errorRetry.hidden = !retry;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.hidden = true;
  errorMessage.textContent = "";
  errorRetry.hidden = true;
}

function adminVisible() {
  return adminView !== null && !adminView.hidden;
}

function showGate(message) {
  dashboard.hidden = true;
  gate.hidden = false;
  gateError.textContent = message ?? "";
  gateError.hidden = message === undefined;
  codeInput.setAttribute("aria-invalid", message === undefined ? "false" : "true");
  if (adminVisible()) codeInput.focus();
}

function showDashboard() {
  gate.hidden = true;
  dashboard.hidden = false;
}

function focusCurrentTab() {
  const button = document.querySelector(
    `.tabs [data-tab='${state.tab}']`,
  );
  button?.focus();
}

function clearCode() {
  sessionStorage.removeItem(ADMIN_KEY);
  state.code = null;
}

function headers(extra = {}) {
  return {
    ...(state.code ? { "x-admin-code": state.code } : {}),
    ...extra,
  };
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: headers({
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers ?? {}),
    }),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { response, body };
}

function handleUnauthorized() {
  clearCode();
  showGate("Sesi kode berakhir. Masukkan kode kembali.");
}

function formatDateRange(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const date = new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
  }).format(start);
  const time = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Makassar",
  });
  return `${date} · ${time.format(start).replace(":", ".")}–${time
    .format(end)
    .replace(":", ".")} WITA`;
}

function formatDateTime(iso) {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
  }).format(date);
  const time = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Makassar",
  }).format(date);
  return `${day} · ${time.replace(":", ".")} WITA`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function makeCard(item) {
  const card = document.createElement("li");
  card.className = `request-card is-${item.status}`;

  const main = document.createElement("div");
  main.className = "request-main";

  const idLine = document.createElement("p");
  idLine.className = "request-id";
  const code = document.createElement("span");
  code.className = "request-code";
  code.textContent = item.businessId;
  const chip = document.createElement("span");
  chip.className = `status-chip is-${item.status}`;
  chip.textContent = STATUS_LABELS[item.status] ?? capitalize(item.status);
  idLine.append(code, chip);

  const room = document.createElement("h2");
  room.className = "request-room";
  room.textContent = item.roomName;

  const requester = document.createElement("p");
  requester.className = "request-meta";
  requester.textContent = `${item.pemohonNama} · NIM ${item.nim ?? "—"}`;

  main.append(idLine, room, requester);

  const facts = document.createElement("dl");
  facts.className = "request-facts";
  const addFact = (label, value) => {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    wrap.append(dt, dd);
    facts.append(wrap);
  };

  addFact("Waktu", formatDateRange(item.start, item.end));
  addFact("Peserta", `${item.participants} orang`);
  addFact("Keperluan", capitalize(item.purpose));
  if (["ditolak", "dibatalkan"].includes(item.status) && item.reason) {
    addFact("Alasan", item.reason);
  }

  const actions = document.createElement("div");
  actions.className = "request-actions";

  if (item.status === "menunggu") {
    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "btn-primary btn-small";
    approve.textContent = "Setujui";
    approve.setAttribute("aria-label", `Setujui ${item.businessId}`);
    approve.addEventListener("click", () => approveItem(item, approve));

    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "btn-ghost btn-small";
    reject.textContent = "Tolak";
    reject.setAttribute("aria-label", `Tolak ${item.businessId}`);
    reject.addEventListener("click", () => openReason("reject", item));

    actions.append(approve, reject);
  } else if (item.status === "disetujui") {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn-ghost btn-small";
    cancel.textContent = "Batalkan";
    cancel.setAttribute("aria-label", `Batalkan ${item.businessId}`);
    cancel.addEventListener("click", () => openReason("cancel", item));
    actions.append(cancel);
  }

  if (actions.childElementCount > 0) {
    card.append(main, facts, actions);
  } else {
    card.append(main, facts);
  }
  return card;
}

function renderRequests(items, list, empty, emptyMessage) {
  list.replaceChildren();
  empty.hidden = items.length > 0;
  if (items.length === 0) {
    empty.querySelector("p:last-child").textContent = emptyMessage;
  }
  for (const item of items) {
    list.append(makeCard(item));
  }
}

async function loadStats() {
  try {
    const { response, body } = await request("/admin/stats");
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) return;
    statPending.textContent = String(body.data.pending);
    statApproved.textContent = String(body.data.approvedToday);
    statRooms.textContent = String(body.data.roomsInUseToday);
    statTotal.textContent = String(body.data.totalRooms);
  } catch {
    // statistik bersifat pelengkap
  }
}

async function loadApproval() {
  setStatus("Memuat pengajuan…");
  clearError();
  try {
    const { response, body } = await request(
      "/admin/reservations?status=menunggu",
    );
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) {
      showError(body?.error?.message ?? "Tidak dapat memuat pengajuan.");
      return;
    }
    showDashboard();
    renderRequests(
      body.data,
      approvalList,
      approvalEmpty,
      "Tidak ada pengajuan menunggu.",
    );
    setStatus("");
    markUpdated();
  } catch {
    showError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
  }
}

function filterParams() {
  const params = new URLSearchParams({ status: state.filters.status });
  if (state.filters.query) params.set("q", state.filters.query);
  if (state.filters.date) params.set("date", state.filters.date);
  return params.toString();
}

async function loadAll() {
  setStatus("Memuat reservasi…");
  clearError();
  try {
    const { response, body } = await request(
      `/admin/reservations?${filterParams()}`,
    );
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) {
      showError(body?.error?.message ?? "Tidak dapat memuat reservasi.");
      return;
    }
    renderRequests(
      body.data,
      allList,
      allEmpty,
      "Tidak ada reservasi yang cocok dengan filter.",
    );
    setStatus("");
    markUpdated();
  } catch {
    showError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
  }
}

async function loadRooms() {
  if (state.roomsLoaded) return;
  const { response, body } = await request("/admin/rooms");
  if (response.status === 401) {
    handleUnauthorized();
    return;
  }
  if (!response.ok) {
    showError(body?.error?.message ?? "Tidak dapat memuat daftar ruang.");
    return;
  }
  blockRoom.replaceChildren();
  for (const room of body.data) {
    const option = document.createElement("option");
    option.value = room.id;
    option.textContent = room.name;
    blockRoom.append(option);
  }
  state.roomsLoaded = true;
}

async function loadBlocks() {
  setStatus("Memuat blokir…");
  clearError();
  try {
    await loadRooms();
    const { response, body } = await request("/admin/blocks");
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) {
      showError(body?.error?.message ?? "Tidak dapat memuat blokir.");
      return;
    }
    blockList.replaceChildren();
    blockEmpty.hidden = body.data.length > 0;
    for (const block of body.data) {
      const item = document.createElement("li");
      item.className = "block-item";
      const title = document.createElement("p");
      title.className = "block-title";
      title.textContent = block.roomName;
      const meta = document.createElement("p");
      meta.className = "block-meta";
      meta.textContent = formatDateRange(block.start, block.end);
      const reason = document.createElement("p");
      reason.className = "block-reason";
      reason.textContent = block.reason;
      item.append(title, meta, reason);
      blockList.append(item);
    }
    setStatus("");
    markUpdated();
  } catch {
    showError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
  }
}

async function loadEvents() {
  setStatus("Memuat audit…");
  clearError();
  try {
    const { response, body } = await request("/admin/events?limit=50");
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) {
      showError(body?.error?.message ?? "Tidak dapat memuat audit.");
      return;
    }
    eventList.replaceChildren();
    eventEmpty.hidden = body.data.length > 0;
    for (const event of body.data) {
      const item = document.createElement("li");
      item.className = "event-item";

      const main = document.createElement("div");
      const title = document.createElement("p");
      title.className = "event-title";
      title.textContent = `${event.businessId} · ${event.roomName}`;
      const meta = document.createElement("p");
      meta.className = "event-meta";
      const from = event.from ? STATUS_LABELS[event.from] ?? event.from : "Baru";
      meta.textContent = `${from} → ${STATUS_LABELS[event.to] ?? event.to} · ${event.actor} · ${formatDateTime(event.waktu)}`;
      main.append(title, meta);

      item.append(main);
      if (event.reason) {
        const reason = document.createElement("p");
        reason.className = "event-reason";
        reason.textContent = event.reason;
        item.append(reason);
      }
      eventList.append(item);
    }
    setStatus("");
    markUpdated();
  } catch {
    showError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
  }
}

function loadCurrentTab() {
  if (state.tab === "approval") return loadApproval();
  if (state.tab === "all") return loadAll();
  if (state.tab === "blocks") return loadBlocks();
  return loadEvents();
}

function refreshAll() {
  loadStats();
  loadCurrentTab();
}

async function approveItem(item, button) {
  button.disabled = true;
  setStatus(`Menyetujui ${item.businessId}…`);
  try {
    const { response, body } = await request(
      `/admin/reservations/${item.id}/approve`,
      { method: "POST" },
    );
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) {
      showError(body?.error?.message ?? "Pengajuan gagal disetujui.");
      return;
    }
    announcer.textContent = `Pengajuan ${item.businessId} disetujui.`;
    await loadStats();
    await loadCurrentTab();
    focusCurrentTab();
  } catch {
    showError("Tidak dapat menghubungi server. Coba lagi.");
  } finally {
    button.disabled = false;
  }
}

function openReason(mode, item) {
  state.reasonAction = { mode, item };
  const isReject = mode === "reject";

  reasonKicker.textContent = isReject ? "Tolak pengajuan" : "Batalkan reservasi";
  reasonTitle.textContent = `${isReject ? "Tolak" : "Batalkan"} ${item.businessId}?`;
  reasonHint.textContent = isReject
    ? "Alasan akan diteruskan ke pemohon."
    : "Reservasi akan dibatalkan dan alasan dicatat di audit.";
  reasonLabel.textContent = isReject ? "Alasan penolakan" : "Alasan pembatalan";
  reasonSubmit.textContent = isReject ? "Tolak pengajuan" : "Batalkan reservasi";
  reasonInput.value = "";
  reasonError.hidden = true;
  reasonError.textContent = "";
  reasonInput.removeAttribute("aria-invalid");
  reasonSubmit.disabled = false;
  reasonDialog.showModal();
  reasonInput.focus();
}

async function submitReason(event) {
  event.preventDefault();
  const reason = reasonInput.value.trim();
  if (reason.length < 3) {
    reasonError.textContent = "Alasan minimal 3 karakter.";
    reasonError.hidden = false;
    reasonInput.setAttribute("aria-invalid", "true");
    reasonInput.focus();
    return;
  }

  const action = state.reasonAction;
  if (!action) return;

  reasonSubmit.disabled = true;
  try {
    const path =
      action.mode === "reject"
        ? `/admin/reservations/${action.item.id}/reject`
        : `/admin/reservations/${action.item.id}/cancel`;
    const { response, body } = await request(path, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });

    if (response.status === 401) {
      reasonDialog.close();
      handleUnauthorized();
      return;
    }
    if (!response.ok) {
      reasonError.textContent =
        body?.error?.message ?? "Tindakan gagal diproses.";
      reasonError.hidden = false;
      return;
    }

    reasonDialog.close();
    announcer.textContent =
      action.mode === "reject"
        ? `Pengajuan ${action.item.businessId} ditolak.`
        : `Reservasi ${action.item.businessId} dibatalkan.`;
    await loadStats();
    await loadCurrentTab();
    focusCurrentTab();
  } catch {
    reasonError.textContent =
      "Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.";
    reasonError.hidden = false;
  } finally {
    reasonSubmit.disabled = false;
  }
}

async function submitBlock(event) {
  event.preventDefault();
  blockError.hidden = true;

  const roomId = blockRoom.value;
  const date = blockDate.value;
  const start = blockStart.value;
  const end = blockEnd.value;
  const reason = blockReason.value.trim();

  if (!roomId || !date || !start || !end) {
    blockError.textContent = "Lengkapi ruang, tanggal, dan waktu blokir.";
    blockError.hidden = false;
    return;
  }
  if (start >= end) {
    blockError.textContent = "Waktu selesai harus setelah waktu mulai.";
    blockError.hidden = false;
    blockStart.focus();
    return;
  }
  if (reason.length < 3) {
    blockError.textContent = "Alasan blokir minimal 3 karakter.";
    blockError.hidden = false;
    blockReason.focus();
    return;
  }

  blockSubmit.disabled = true;
  try {
    const { response, body } = await request("/admin/blocks", {
      method: "POST",
      body: JSON.stringify({
        roomId,
        start: `${date}T${start}:00+08:00`,
        end: `${date}T${end}:00+08:00`,
        reason,
      }),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) {
      blockError.textContent =
        body?.error?.message ?? "Blokir gagal dibuat.";
      blockError.hidden = false;
      return;
    }

    blockReason.value = "";
    setStatus(
      `Blokir dibuat. ${body.cancelled} reservasi beririsan dibatalkan.`,
    );
    announcer.textContent = `Blokir dibuat. ${body.cancelled} reservasi dibatalkan.`;
    await loadStats();
    await loadBlocks();
    setStatus(
      `Blokir dibuat. ${body.cancelled} reservasi beririsan dibatalkan.`,
    );
  } catch {
    blockError.textContent =
      "Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.";
    blockError.hidden = false;
  } finally {
    blockSubmit.disabled = false;
  }
}

function switchTab(tab) {
  state.tab = tab;
  for (const button of tabs) {
    button.setAttribute(
      "aria-pressed",
      button.dataset.tab === tab ? "true" : "false",
    );
  }
  for (const [name, panel] of Object.entries(panels)) {
    panel.hidden = name !== tab;
  }
  loadCurrentTab();
}

gateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = codeInput.value.trim();
  if (!code) {
    gateError.textContent = "Kode akses wajib diisi.";
    gateError.hidden = false;
    codeInput.setAttribute("aria-invalid", "true");
    codeInput.focus();
    return;
  }

  gateSubmit.disabled = true;
  state.code = code;
  sessionStorage.setItem(ADMIN_KEY, code);
  await loadStats();
  await loadApproval();
  if (dashboard.hidden) {
    clearCode();
  } else {
    focusCurrentTab();
  }
  gateSubmit.disabled = false;
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

filterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.filters = {
    status: filterStatus.value,
    query: filterQuery.value.trim(),
    date: filterDate.value,
  };
  loadAll();
});

filterReset.addEventListener("click", () => {
  filterStatus.value = "semua";
  filterQuery.value = "";
  filterDate.value = "";
  state.filters = { status: "semua", query: "", date: "" };
  loadAll();
});

blockForm.addEventListener("submit", submitBlock);
reasonForm.addEventListener("submit", submitReason);
reasonCancel.addEventListener("click", () => reasonDialog.close());

reasonDialog.addEventListener("close", () => {
  state.reasonAction = null;
  reasonInput.removeAttribute("aria-invalid");
});

refreshButton.addEventListener("click", refreshAll);
errorRetry.addEventListener("click", refreshAll);

logoutButton.addEventListener("click", () => {
  clearCode();
  approvalList.replaceChildren();
  allList.replaceChildren();
  blockList.replaceChildren();
  eventList.replaceChildren();
  state.roomsLoaded = false;
  showGate();
  announcer.textContent = "Kode akses dihapus.";
});

blockDate.min = witaToday();
blockDate.value = witaToday();
blockStart.value = "08:30";
blockEnd.value = "10:00";

window.refreshAdminPanel = () => {
  if (!state.code) return;
  loadStats();
  loadCurrentTab();
};

function scheduleLiveRefresh() {
  if (!state.code || !adminVisible()) return;
  if (reasonDialog.open) return;
  if (liveRefreshTimer !== null) clearTimeout(liveRefreshTimer);
  liveRefreshTimer = window.setTimeout(() => {
    liveRefreshTimer = null;
    if (!state.code || !adminVisible() || reasonDialog.open) return;
    refreshAll();
  }, 180);
}

function connectLiveUpdates() {
  if (typeof EventSource === "undefined") return;
  liveSource = new EventSource("/events");
  liveSource.addEventListener("open", scheduleLiveRefresh);
  for (const type of [
    "reservation-created",
    "reservation-updated",
    "schedule-updated",
  ]) {
    liveSource.addEventListener(type, scheduleLiveRefresh);
  }
}

window.addEventListener("reservation-created", scheduleLiveRefresh);

window.setInterval(() => {
  if (!state.code || !adminVisible()) return;
  if (document.visibilityState !== "visible") return;
  if (state.loading || reasonDialog.open) return;
  const active = document.activeElement;
  if (
    active &&
    typeof active.closest === "function" &&
    active.closest(".request-card, .block-form, .admin-filters")
  ) {
    return;
  }
  loadStats();
  if (state.tab === "approval") loadApproval();
}, 20000);

connectLiveUpdates();

if (state.code) {
  showDashboard();
  loadStats();
  loadApproval();
  if (adminVisible()) focusCurrentTab();
} else {
  showGate();
}
})();
