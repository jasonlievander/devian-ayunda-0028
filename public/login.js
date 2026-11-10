(() => {
  const COPY = {
    form: {
      kicker: "Akses mahasiswa",
      title: "Masuk ke formulir",
      lede: "Gunakan email dan NIM akun mahasiswa untuk mengajukan peminjaman ruang.",
      hint: "Gunakan akun demo yang diberikan petugas.",
      submit: "Masuk ke formulir",
      visualLede:
        "Ajukan slot, cek kalender, dan kelola peminjaman ruang kampus dalam satu alur.",
      photo: "/assets/login-campus.webp",
      photoAlt: "Gedung kampus IDB Bali dengan papan nama IDB Bali",
      credit: "Gedung kampus IDB Bali · dokumentasi kampus",
      demo: "Akses demo internal. Gunakan akun mahasiswa yang diberikan petugas.",
    },
    admin: {
      kicker: "Akses petugas",
      title: "Masuk ke panel petugas",
      lede: "Kelola antrean, setujui peminjaman, dan blokir ruang.",
      hint: "Khusus petugas Sarana Prasarana.",
      submit: "Masuk ke panel",
      visualLede:
        "Antrean real-time, persetujuan, dan kontrol ruang dalam satu panel.",
      photo: "/assets/login-campus.webp",
      photoAlt: "Gedung kampus IDB Bali dengan papan nama IDB Bali",
      credit: "Gedung kampus IDB Bali · dokumentasi kampus",
      demo: "Akses demo internal. Hubungi admin sistem bila kode akses tidak berlaku.",
    },
  };

  const roleButtons = [...document.querySelectorAll("[data-role]")];
  const form = document.querySelector("#login-form");
  const formCredentials = document.querySelector("#form-credentials");
  const adminCredentials = document.querySelector("#admin-credentials");
  const emailInput = document.querySelector("#login-email");
  const nimInput = document.querySelector("#login-nim");
  const passwordInput = document.querySelector("#login-password");
  const toggleButton = document.querySelector("#login-toggle");
  const submitButton = document.querySelector("#login-submit");
  const submitLabel = document.querySelector("#login-submit-label");
  const errorBox = document.querySelector("#login-error");
  const kicker = document.querySelector("#login-kicker");
  const title = document.querySelector("#login-title");
  const lede = document.querySelector("#login-lede");
  const hint = document.querySelector("#login-hint");
  const visualLede = document.querySelector("#login-visual-lede");
  const photo = document.querySelector("#login-photo");
  const credit = document.querySelector("#login-credit");
  const iconForm = document.querySelector("#login-icon-form");
  const iconAdmin = document.querySelector("#login-icon-admin");
  const demo = document.querySelector("#login-demo");
  const status = document.querySelector("#login-status");

  const state = { role: "form", busy: false };

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
    for (const field of [emailInput, nimInput, passwordInput]) {
      field.removeAttribute("aria-invalid");
    }
  }

  function markInvalid(fields, message, focusField) {
    for (const field of fields) {
      field.setAttribute("aria-invalid", "true");
    }
    errorBox.textContent = message;
    errorBox.hidden = false;
    focusField?.focus();
  }

  function setBusy(value) {
    state.busy = value;
    submitButton.setAttribute("aria-disabled", value ? "true" : "false");
    submitButton.setAttribute("aria-busy", value ? "true" : "false");
    submitLabel.textContent = value
      ? "Memeriksa…"
      : COPY[state.role].submit;
    status.textContent = value ? "Memeriksa akun…" : "";
  }

  function setRole(role, moveFocus = false) {
    state.role = role;
    const copy = COPY[role];
    for (const button of roleButtons) {
      button.setAttribute(
        "aria-pressed",
        button.dataset.role === role ? "true" : "false",
      );
    }
    kicker.textContent = copy.kicker;
    title.textContent = copy.title;
    lede.textContent = copy.lede;
    hint.textContent = copy.hint;
    submitLabel.textContent = copy.submit;
    visualLede.textContent = copy.visualLede;
    demo.textContent = copy.demo;
    photo.src = copy.photo;
    photo.alt = copy.photoAlt;
    credit.textContent = copy.credit;
    iconForm.hidden = role !== "form";
    iconAdmin.hidden = role !== "admin";
    formCredentials.hidden = role !== "form";
    adminCredentials.hidden = role !== "admin";
    clearError();
    emailInput.value = "";
    nimInput.value = "";
    passwordInput.value = "";
    passwordInput.type = "password";
    toggleButton.textContent = "Lihat";
    toggleButton.setAttribute("aria-pressed", "false");
    if (moveFocus) {
      if (role === "form") emailInput.focus();
      else passwordInput.focus();
    }
  }

  roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (state.busy || state.role === button.dataset.role) return;
      setRole(button.dataset.role, true);
    });
  });

  toggleButton.addEventListener("click", () => {
    const reveal = passwordInput.type === "password";
    passwordInput.type = reveal ? "text" : "password";
    toggleButton.textContent = reveal ? "Sembunyikan" : "Lihat";
    toggleButton.setAttribute("aria-pressed", reveal ? "true" : "false");
    passwordInput.focus();
  });

  for (const field of [emailInput, nimInput, passwordInput]) {
    field.addEventListener("input", clearError);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.busy) return;
    clearError();

    let payload;
    if (state.role === "form") {
      const email = emailInput.value.trim();
      const nim = nimInput.value.trim();
      if (!email) {
        markInvalid([emailInput], "Email wajib diisi.", emailInput);
        return;
      }
      if (!nim) {
        markInvalid([nimInput], "NIM wajib diisi.", nimInput);
        return;
      }
      payload = { role: "form", email, nim };
    } else {
      const password = passwordInput.value;
      if (!password) {
        markInvalid([passwordInput], "Password wajib diisi.", passwordInput);
        return;
      }
      payload = { role: "admin", password };
    }

    setBusy(true);
    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (!response.ok) {
        if (state.role === "form") {
          markInvalid(
            [emailInput, nimInput],
            body?.error?.message ?? "Email atau NIM salah. Coba lagi.",
            emailInput,
          );
        } else {
          markInvalid(
            [passwordInput],
            body?.error?.message ?? "Password salah. Coba lagi.",
            passwordInput,
          );
        }
        setBusy(false);
        return;
      }

      sessionStorage.setItem("idb-role", state.role);
      if (state.role === "form") {
        sessionStorage.setItem("idb-form-email", payload.email);
        sessionStorage.setItem("idb-form-nim", payload.nim);
        sessionStorage.removeItem("idb-admin-code");
      } else {
        sessionStorage.setItem("idb-admin-code", payload.password);
        sessionStorage.removeItem("idb-form-email");
        sessionStorage.removeItem("idb-form-nim");
      }
      location.assign(
        state.role === "admin" ? "/#admin" : "/#reservation",
      );
    } catch {
      markInvalid(
        state.role === "form" ? [emailInput, nimInput] : [passwordInput],
        "Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.",
        state.role === "form" ? emailInput : passwordInput,
      );
      setBusy(false);
    }
  });

  const requestedRole = new URLSearchParams(location.search).get("role");
  setRole(requestedRole === "admin" ? "admin" : "form");
})();
