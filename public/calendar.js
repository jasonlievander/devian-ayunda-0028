(() => {
  const WITA = "Asia/Makassar";
  const rooms = Array.isArray(window.IDB_ROOMS) ? window.IDB_ROOMS : [];
  const root = document.querySelector("#kalender");
  if (!root) return;

  const roomSelect = root.querySelector("#calendar-room");
  const periodEl = root.querySelector("#calendar-period");
  const stage = root.querySelector("#calendar-stage");
  const statusEl = root.querySelector("#calendar-status");
  const prevButton = root.querySelector("#calendar-prev");
  const nextButton = root.querySelector("#calendar-next");
  const todayButton = root.querySelector("#calendar-today");
  const viewButtons = [...root.querySelectorAll("[data-view]")];

  const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: WITA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const monthFormatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: WITA,
    month: "long",
    year: "numeric",
  });
  const shortDateFormatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: WITA,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const fullDateFormatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: WITA,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const weekdayFormatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: WITA,
    weekday: "short",
  });
  const timeFormatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: WITA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const narrowQuery = window.matchMedia("(max-width: 900px)");
  const defaultView = narrowQuery.matches ? "list" : "month";
  const state = {
    anchor: todayKey(),
    view: defaultView,
    roomId: "",
  };
  let events = [];
  let controller;
  let requestId = 0;
  let focusAfterLoad = null;
  let liveRefreshTimer = null;
  let liveSource = null;

  function dateKey(value) {
    return dateKeyFormatter.format(value instanceof Date ? value : new Date(value));
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function dateFromKey(key) {
    return new Date(`${key}T00:00:00Z`);
  }

  function keyFromDate(value) {
    return value.toISOString().slice(0, 10);
  }

  function addDays(key, amount) {
    const value = dateFromKey(key);
    value.setUTCDate(value.getUTCDate() + amount);
    return keyFromDate(value);
  }

  function startOfMonth(key) {
    return `${key.slice(0, 7)}-01`;
  }

  function endOfMonth(key) {
    const value = dateFromKey(startOfMonth(key));
    value.setUTCMonth(value.getUTCMonth() + 1);
    value.setUTCDate(0);
    return keyFromDate(value);
  }

  function shiftMonth(key, amount) {
    const value = dateFromKey(startOfMonth(key));
    value.setUTCMonth(value.getUTCMonth() + amount);
    return keyFromDate(value);
  }

  function startOfWeek(key) {
    const value = dateFromKey(key);
    const offset = (value.getUTCDay() + 6) % 7;
    return addDays(key, -offset);
  }

  function witaInstant(key, time = "00:00:00") {
    return new Date(`${key}T${time}+08:00`).toISOString();
  }

  function fullDate(key) {
    return fullDateFormatter.format(new Date(`${key}T00:00:00+08:00`));
  }

  function monthLabel(key) {
    return monthFormatter.format(new Date(`${startOfMonth(key)}T00:00:00+08:00`));
  }

  function weekLabel(start, end) {
    const first = shortDateFormatter.format(
      new Date(`${start}T00:00:00+08:00`),
    );
    const last = shortDateFormatter.format(new Date(`${end}T00:00:00+08:00`));
    return `${first} – ${last}`;
  }

  function timeLabel(value) {
    return timeFormatter.format(new Date(value));
  }

  function timeRange(start, end) {
    return `${timeLabel(start)}–${timeLabel(end)}`;
  }

  function rangeForView() {
    if (state.view === "week") {
      const start = startOfWeek(state.anchor);
      const end = addDays(start, 7);
      return {
        start,
        end,
        label: weekLabel(start, addDays(end, -1)),
        monthKey: start.slice(0, 7),
      };
    }
    if (state.view === "day") {
      const start = state.anchor;
      return {
        start,
        end: addDays(start, 1),
        label: fullDate(start),
        monthKey: start.slice(0, 7),
      };
    }
    if (state.view === "list") {
      const start = startOfMonth(state.anchor);
      const end = addDays(endOfMonth(state.anchor), 1);
      return {
        start,
        end,
        label: monthLabel(state.anchor),
        monthKey: state.anchor.slice(0, 7),
      };
    }
    const start = startOfWeek(startOfMonth(state.anchor));
    return {
      start,
      end: addDays(start, 42),
      label: monthLabel(state.anchor),
      monthKey: state.anchor.slice(0, 7),
    };
  }

  function statusLabel(status) {
    if (status === "disetujui") return "Disetujui";
    if (status === "menunggu") return "Menunggu";
    if (status === "berlangsung") return "Berlangsung";
    return "Blokir";
  }

  function updatePeriod(label) {
    periodEl.textContent = label;
  }

  function updateViewButtons() {
    for (const button of viewButtons) {
      button.setAttribute(
        "aria-pressed",
        button.dataset.view === state.view ? "true" : "false",
      );
    }
  }

  function populateRooms() {
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "— Semua ruang —";
    roomSelect.append(all);

    const groups = new Map();
    for (const room of rooms) {
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
  }

  function eventChip(event, showRoom) {
    const item = document.createElement("li");
    item.className = `calendar-event is-${event.status}`;
    item.title = `${timeRange(event.start, event.end)} · ${event.roomCode} ${event.roomName} · ${event.title} · ${statusLabel(event.status)}`;

    const time = document.createElement("span");
    time.className = "calendar-event-time";
    time.textContent = timeLabel(event.start);

    const title = document.createElement("span");
    title.className = "calendar-event-title";
    title.textContent = showRoom
      ? `${event.roomCode} · ${event.title}`
      : event.title;

    const status = document.createElement("span");
    status.className = "visually-hidden";
    status.textContent = `Status ${statusLabel(event.status)}.`;

    item.append(time, title, status);
    return item;
  }

  function goToList(key) {
    state.anchor = key;
    state.view = "list";
    focusAfterLoad = () =>
      document.querySelector(`[data-agenda-date="${key}"]`);
    updateViewButtons();
    load();
  }

  function moreItem(key, count) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-more";
    button.textContent = `+${count} jadwal`;
    button.setAttribute(
      "aria-label",
      `Tampilkan ${count} jadwal lainnya pada ${fullDate(key)}`,
    );
    button.addEventListener("click", () => goToList(key));
    item.append(button);
    return item;
  }

  function dayCell(key, monthKey, dayEvents) {
    const cell = document.createElement("td");
    cell.className = "calendar-day";
    const isOutside = key.slice(0, 7) !== monthKey;
    if (isOutside) cell.classList.add("is-outside");
    if (key === todayKey()) {
      cell.classList.add("is-today");
      cell.setAttribute("aria-current", "date");
    }

    const head = document.createElement("div");
    head.className = "calendar-day-head";
    const number = document.createElement("span");
    number.className = "calendar-day-number";
    number.textContent = String(Number(key.slice(8)));
    number.title = fullDate(key);
    head.append(number);

    const dateLabel = document.createElement("span");
    dateLabel.className = "visually-hidden";
    dateLabel.textContent = `${fullDate(key)}.`;
    head.append(dateLabel);

    if (isOutside) {
      const label = document.createElement("span");
      label.className = "visually-hidden";
      label.textContent = "Bulan lain.";
      head.append(label);
    }
    if (key === todayKey()) {
      const label = document.createElement("span");
      label.className = "visually-hidden";
      label.textContent = "Hari ini.";
      head.append(label);
    }
    cell.append(head);

    const list = document.createElement("ul");
    list.className = "calendar-events";
    const visible = dayEvents.slice(0, 3);
    for (const event of visible) {
      list.append(eventChip(event, true));
    }
    if (dayEvents.length > visible.length) {
      list.append(moreItem(key, dayEvents.length - visible.length));
    }
    cell.append(list);
    return cell;
  }

  function renderMonth(range, grouped) {
    const table = document.createElement("table");
    table.className = "calendar-grid";

    const caption = document.createElement("caption");
    caption.className = "visually-hidden";
    caption.textContent = `Kalender ${range.label}`;
    table.append(caption);

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const name of ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = name;
      headerRow.append(th);
    }
    thead.append(headerRow);
    table.append(thead);

    const tbody = document.createElement("tbody");
    for (let week = 0; week < 6; week += 1) {
      const row = document.createElement("tr");
      for (let day = 0; day < 7; day += 1) {
        const key = addDays(range.start, week * 7 + day);
        row.append(dayCell(key, range.monthKey, grouped.get(key) ?? []));
      }
      tbody.append(row);
    }
    table.append(tbody);
    return table;
  }

  function renderWeek(range, grouped) {
    const container = document.createElement("div");
    container.className = "calendar-week";

    for (let offset = 0; offset < 7; offset += 1) {
      const key = addDays(range.start, offset);
      const dayEvents = grouped.get(key) ?? [];
      const section = document.createElement("section");
      section.className = "calendar-week-day";
      if (key === todayKey()) {
        section.classList.add("is-today");
        section.setAttribute("aria-current", "date");
        section.setAttribute("aria-label", `${fullDate(key)}, hari ini`);
      } else {
        section.setAttribute("aria-label", fullDate(key));
      }

      const head = document.createElement("header");
      head.className = "calendar-week-head";
      const weekday = document.createElement("span");
      weekday.textContent = weekdayFormatter.format(
        new Date(`${key}T00:00:00+08:00`),
      );
      const date = document.createElement("span");
      date.textContent = String(Number(key.slice(8)));
      head.append(weekday, date);
      section.append(head);

      const list = document.createElement("ul");
      list.className = "calendar-events";
      for (const event of dayEvents.slice(0, 6)) {
        list.append(eventChip(event, true));
      }
      if (dayEvents.length > 6) {
        list.append(moreItem(key, dayEvents.length - 6));
      }
      if (dayEvents.length === 0) {
        const empty = document.createElement("p");
        empty.className = "calendar-day-empty";
        empty.textContent = "Tidak ada jadwal";
        section.append(empty);
      } else {
        section.append(list);
      }
      container.append(section);
    }
    return container;
  }

  function agendaEvent(event) {
    const item = document.createElement("li");
    item.className = "agenda-event";

    const time = document.createElement("span");
    time.className = "agenda-time";
    time.textContent = timeRange(event.start, event.end);

    const body = document.createElement("div");
    body.className = "agenda-body";
    const title = document.createElement("strong");
    title.textContent = `${event.roomCode} · ${event.title}`;
    const room = document.createElement("span");
    room.className = "agenda-room";
    room.textContent = event.roomName;
    body.append(title, room);

    const status = document.createElement("span");
    status.className = `status-chip is-${event.status}`;
    status.textContent = statusLabel(event.status);

    item.append(time, body, status);
    return item;
  }

  function emptyPanel(range) {
    const empty = document.createElement("div");
    empty.className = "calendar-empty";
    const message = document.createElement("p");
    const room = rooms.find((item) => String(item.id) === state.roomId);
    message.textContent =
      room === undefined
        ? `Belum ada peminjaman atau blokir pada ${range.label}.`
        : `Tidak ada jadwal untuk ${room.name} pada ${range.label}.`;
    empty.append(message);
    if (room !== undefined) {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "btn-ghost";
      reset.textContent = "Tampilkan semua ruang";
      reset.addEventListener("click", () => {
        state.roomId = "";
        roomSelect.value = "";
        focusAfterLoad = () => roomSelect;
        load();
      });
      empty.append(reset);
    }
    return empty;
  }

  function renderAgenda(range, grouped) {
    const container = document.createElement("div");
    container.className = "calendar-agenda";

    const keys = [...grouped.keys()].sort();
    if (keys.length === 0) {
      container.append(emptyPanel(range));
      return container;
    }

    for (const key of keys) {
      const section = document.createElement("section");
      section.className = "agenda-day";
      const heading = document.createElement("h3");
      heading.tabIndex = -1;
      heading.dataset.agendaDate = key;
      heading.textContent = fullDate(key);
      const list = document.createElement("ul");
      list.className = "agenda-list";
      for (const event of grouped.get(key) ?? []) {
        list.append(agendaEvent(event));
      }
      section.append(heading, list);
      container.append(section);
    }
    return container;
  }

  function groupEvents(items) {
    const grouped = new Map();
    for (const event of items) {
      const key = dateKey(event.start);
      const list = grouped.get(key) ?? [];
      list.push(event);
      grouped.set(key, list);
    }
    return grouped;
  }

  function render(range) {
    const grouped = groupEvents(events);
    stage.replaceChildren();
    if (
      events.length === 0 &&
      (state.view === "month" || state.view === "week")
    ) {
      stage.append(emptyPanel(range));
    }
    if (state.view === "month") {
      stage.append(renderMonth(range, grouped));
    } else if (state.view === "week") {
      stage.append(renderWeek(range, grouped));
    } else if (state.view === "day") {
      stage.append(renderAgenda(range, grouped));
    } else {
      stage.append(renderAgenda(range, grouped));
    }
  }

  function loadingState() {
    const box = document.createElement("div");
    box.className = "calendar-loading";
    for (let index = 0; index < 3; index += 1) {
      const line = document.createElement("span");
      line.setAttribute("aria-hidden", "true");
      box.append(line);
    }
    return box;
  }

  function errorState() {
    const box = document.createElement("div");
    box.className = "calendar-error";
    box.setAttribute("role", "alert");
    const message = document.createElement("p");
    message.textContent = "Jadwal tidak dapat dimuat.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn-ghost";
    retry.textContent = "Coba lagi";
    retry.addEventListener("click", () => {
      focusAfterLoad = () => document.querySelector("#calendar-title");
      load();
    });
    box.append(message, retry);
    return box;
  }

  async function load() {
    if (controller) controller.abort();
    const localController = new AbortController();
    controller = localController;
    const id = ++requestId;
    const range = rangeForView();

    const previousHeight = stage.offsetHeight;
    updatePeriod(range.label);
    statusEl.textContent = "Memuat jadwal…";
    stage.setAttribute("aria-busy", "true");
    if (previousHeight > 0) {
      stage.style.minHeight = `${previousHeight}px`;
    }
    stage.replaceChildren(loadingState());

    try {
      const params = new URLSearchParams({
        from: witaInstant(range.start),
        to: witaInstant(range.end),
      });
      if (state.roomId) params.set("roomId", state.roomId);

      const response = await fetch(`/calendar?${params.toString()}`, {
        signal: localController.signal,
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error("HTTP");
      const body = await response.json();
      if (id !== requestId) return;

      const serverEvents = Array.isArray(body.data) ? body.data : [];
      events = window.IDBDemo?.mergeCalendarEvents(serverEvents) ?? serverEvents;
      render(range);
      statusEl.textContent =
        events.length === 0
          ? "Tidak ada jadwal pada periode ini."
          : `${events.length} jadwal dimuat.`;
      if (focusAfterLoad !== null) {
        const target = focusAfterLoad;
        focusAfterLoad = null;
        requestAnimationFrame(() => target()?.focus());
      }
    } catch (error) {
      if (error.name === "AbortError" || id !== requestId) return;
      events = [];
      stage.replaceChildren(errorState());
      statusEl.textContent = "";
      requestAnimationFrame(() => {
        stage.querySelector(".calendar-error .btn-ghost")?.focus();
      });
    } finally {
      if (id === requestId) {
        stage.removeAttribute("aria-busy");
        stage.style.minHeight = "";
      }
    }
  }

  populateRooms();
  updateViewButtons();
  roomSelect.addEventListener("change", () => {
    state.roomId = roomSelect.value;
    load();
  });
  prevButton.addEventListener("click", () => {
    state.anchor =
      state.view === "week"
        ? addDays(state.anchor, -7)
        : state.view === "day"
          ? addDays(state.anchor, -1)
          : shiftMonth(state.anchor, -1);
    load();
  });
  nextButton.addEventListener("click", () => {
    state.anchor =
      state.view === "week"
        ? addDays(state.anchor, 7)
        : state.view === "day"
          ? addDays(state.anchor, 1)
          : shiftMonth(state.anchor, 1);
    load();
  });
  todayButton.addEventListener("click", () => {
    state.anchor = todayKey();
    load();
  });
  for (const button of viewButtons) {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      updateViewButtons();
      load();
    });
  }
  narrowQuery.addEventListener("change", (event) => {
    if (event.matches && state.view !== "list") {
      state.view = "list";
      updateViewButtons();
      load();
    }
  });
  function calendarVisible() {
    const admin = document.querySelector("#view-admin");
    return admin === null || admin.hidden;
  }

  function scheduleLiveRefresh() {
    if (!calendarVisible() || document.visibilityState !== "visible") return;
    if (liveRefreshTimer !== null) clearTimeout(liveRefreshTimer);
    liveRefreshTimer = window.setTimeout(() => {
      liveRefreshTimer = null;
      if (calendarVisible() && document.visibilityState === "visible") {
        load();
      }
    }, 180);
  }

  function connectLiveUpdates() {
    if (typeof EventSource === "undefined") {
      window.setInterval(() => {
        if (calendarVisible() && document.visibilityState === "visible") {
          load();
        }
      }, 15000);
      return;
    }
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
  window.addEventListener("idb-demo-updated", scheduleLiveRefresh);
  window.addEventListener("hashchange", () => {
    if (location.hash === "#kalender") load();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && calendarVisible()) load();
  });

  connectLiveUpdates();
  load();
})();
