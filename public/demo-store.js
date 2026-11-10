(() => {
  const STORAGE = "idb-demo-reservations";
  const SESSION = "idb-demo-session";
  const MIRROR = {
    role: "idb-role",
    email: "idb-form-email",
    nim: "idb-form-nim",
    password: "idb-admin-code",
  };

  function backend() {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  function readJson(key, fallback) {
    const store = backend();
    if (!store) return fallback;
    try {
      const raw = store.getItem(key);
      if (raw === null) return fallback;
      const value = JSON.parse(raw);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    const store = backend();
    if (!store) return;
    try {
      store.setItem(key, JSON.stringify(value));
    } catch {
      // penyimpanan penuh atau diblokir: abaikan pada mode demo
    }
  }

  function emit() {
    window.dispatchEvent(new CustomEvent("idb-demo-updated"));
  }

  function getSession() {
    const session = readJson(SESSION, null);
    if (session !== null) return session;
    const store = backend();
    if (!store) return null;
    const role = store.getItem(MIRROR.role);
    if (role === null) return null;
    return {
      role,
      email: store.getItem(MIRROR.email),
      nim: store.getItem(MIRROR.nim),
      password: store.getItem(MIRROR.password),
    };
  }

  function setSession(session) {
    writeJson(SESSION, session);
    const store = backend();
    if (!store) return;
    store.setItem(MIRROR.role, session.role);
    if (session.role === "admin") {
      if (session.password) store.setItem(MIRROR.password, session.password);
      store.removeItem(MIRROR.email);
      store.removeItem(MIRROR.nim);
    } else {
      store.setItem(MIRROR.email, session.email ?? "");
      store.setItem(MIRROR.nim, session.nim ?? "");
      store.removeItem(MIRROR.password);
    }
  }

  function sessionField(name) {
    const session = getSession();
    if (session === null) return null;
    return session[name] ?? null;
  }

  function clearSession() {
    const store = backend();
    if (!store) return;
    store.removeItem(SESSION);
    for (const key of Object.values(MIRROR)) store.removeItem(key);
  }

  function listReservations() {
    const list = readJson(STORAGE, []);
    return Array.isArray(list) ? list : [];
  }

  function saveReservation(record) {
    const list = listReservations();
    const index = list.findIndex(
      (item) => item.businessId === record.businessId,
    );
    if (index >= 0) list[index] = { ...list[index], ...record };
    else list.push(record);
    writeJson(STORAGE, list);
    emit();
    return record;
  }

  function updateReservation(identifier, patch) {
    const list = listReservations();
    let changed = false;
    for (const item of list) {
      if (item.localId === identifier || item.businessId === identifier) {
        Object.assign(item, patch);
        changed = true;
      }
    }
    if (changed) {
      writeJson(STORAGE, list);
      emit();
    }
    return changed;
  }

  function isLocal(id) {
    return typeof id === "string" && id.startsWith("local-");
  }

  function activeStatuses() {
    return ["menunggu", "disetujui", "berlangsung"];
  }

  function localCalendarEvents() {
    return listReservations()
      .filter((item) => activeStatuses().includes(item.status))
      .map((item) => ({
        kind: "reservasi",
        id: item.localId,
        roomId: String(item.roomId),
        roomCode: item.roomCode,
        roomName: item.roomName,
        start: item.start,
        end: item.end,
        title: item.purpose,
        status: item.status,
      }));
  }

  function mergeCalendarEvents(serverEvents) {
    const events = Array.isArray(serverEvents) ? [...serverEvents] : [];
    const seen = new Set(
      events.map(
        (event) => `${event.roomId}|${event.start}|${event.end}`,
      ),
    );
    for (const event of localCalendarEvents()) {
      const key = `${event.roomId}|${event.start}|${event.end}`;
      if (!seen.has(key)) {
        seen.add(key);
        events.push(event);
      }
    }
    return events;
  }

  function witaDateKey(value) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  }

  function localAdminReservations(filters = {}) {
    const status = filters.status ?? "semua";
    const query = (filters.query ?? "").trim().toLowerCase();
    const date = (filters.date ?? "").trim();

    return listReservations()
      .filter((item) => {
        if (status !== "semua" && item.status !== status) return false;
        if (date !== "" && witaDateKey(item.start) !== date) return false;
        if (query !== "") {
          const haystack = [
            item.pemohonNama ?? "",
            item.nim ?? "",
            item.businessId,
            item.roomName ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
      .map((item) => ({
        id: item.localId,
        businessId: item.businessId,
        roomName: item.roomName,
        roomCode: item.roomCode,
        pemohonNama: item.pemohonNama ?? "",
        nim: item.nim ?? null,
        start: item.start,
        end: item.end,
        purpose: item.purpose,
        participants: item.participants,
        status: item.status,
        createdAt: item.createdAt,
        reason: item.reason ?? null,
      }));
  }

  function mergeAdminReservations(serverList, filters = {}) {
    const list = Array.isArray(serverList) ? [...serverList] : [];
    const seen = new Set(list.map((item) => item.businessId));
    for (const item of localAdminReservations(filters)) {
      if (!seen.has(item.businessId)) {
        seen.add(item.businessId);
        list.push(item);
      }
    }
    return list;
  }

  window.IDBDemo = {
    getSession,
    setSession,
    sessionField,
    clearSession,
    listReservations,
    saveReservation,
    updateReservation,
    isLocal,
    localCalendarEvents,
    mergeCalendarEvents,
    localAdminReservations,
    mergeAdminReservations,
  };
})();
