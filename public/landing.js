/* ═══════════════════════════════════════════════════════════
   EdgeLine OS — Landing page logic
   ═══════════════════════════════════════════════════════════ */

// ── Guard: if already logged in, send straight to dashboard ──────────────
if (sessionStorage.getItem("el_user")) {
  window.location.href = "/dashboard.html";
}

// ── Tab switching ─────────────────────────────────────────────────────────
const loginTab    = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm   = document.getElementById("loginForm");
const registerForm= document.getElementById("registerForm");
const forgotForm  = document.getElementById("forgotForm");

function showTab(tab) {
  loginForm.classList.toggle("hidden",    tab !== "login");
  registerForm.classList.toggle("hidden", tab !== "register");
  forgotForm.classList.toggle("hidden",   tab !== "forgot");
  loginTab.classList.toggle("active",     tab === "login");
  registerTab.classList.toggle("active",  tab === "register");
}

loginTab.addEventListener("click",    () => showTab("login"));
registerTab.addEventListener("click", () => showTab("register"));
document.getElementById("toRegister").addEventListener("click", () => { showTab("register"); scrollToAuth(); });
document.getElementById("toLogin").addEventListener("click",    () => { showTab("login");    scrollToAuth(); });
document.getElementById("forgotBtn").addEventListener("click",  () => showTab("forgot"));
document.getElementById("backToLogin").addEventListener("click",() => showTab("login"));
document.getElementById("heroLogin").addEventListener("click",  () => scrollToAuth());

function scrollToAuth() {
  document.getElementById("auth").scrollIntoView({ behavior: "smooth" });
}

// ── Eye toggle ────────────────────────────────────────────────────────────
document.querySelectorAll(".eye-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    target.type = target.type === "password" ? "text" : "password";
  });
});

// ── Password strength ─────────────────────────────────────────────────────
const regPasswordInput = document.getElementById("regPassword");
const strengthFill     = document.getElementById("strengthFill");
const strengthLabel    = document.getElementById("strengthLabel");

regPasswordInput?.addEventListener("input", () => {
  const v = regPasswordInput.value;
  let score = 0;
  if (v.length >= 6)  score++;
  if (v.length >= 10) score++;
  if (/[A-Z]/.test(v)) score++;
  if (/[0-9]/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;

  const widths = ["0%","25%","50%","75%","100%"];
  const colors = ["transparent","#ef4444","#f59e0b","#14b8a6","#22c55e"];
  const labels = ["","Weak","Fair","Good","Strong"];
  strengthFill.style.width      = widths[score];
  strengthFill.style.background = colors[score];
  strengthLabel.textContent     = labels[score] || "";
});

// ── Validation helpers ────────────────────────────────────────────────────
function setErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}
function clearErrs(...ids) {
  ids.forEach(id => setErr(id, ""));
}
function isGmail(email) {
  return /^[^\s@]+@gmail\.com$/i.test(email);
}
function isStrongPassword(pw) {
  return pw.length >= 6 && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

// ── REGISTER ─────────────────────────────────────────────────────────────
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrs("regNameErr","regEmailErr","regPhoneErr","regPasswordErr","regConfirmErr","regCountryErr","registerError");

  const name     = document.getElementById("regName").value.trim();
  const email    = document.getElementById("regEmail").value.trim();
  const phone    = document.getElementById("regPhone").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm  = document.getElementById("regConfirm").value;
  const country  = document.getElementById("regCountry").value;
  let valid = true;

  if (!name)               { setErr("regNameErr",     "Full name is required");         valid = false; }
  if (!country)            { setErr("regCountryErr",  "Please select your country");    valid = false; }
  if (!isGmail(email))     { setErr("regEmailErr",    "Must be a Gmail address");       valid = false; }
  if (!phone || phone.length < 7) { setErr("regPhoneErr","Valid phone number required"); valid = false; }
  if (!isStrongPassword(password)) {
    setErr("regPasswordErr", "Min 6 chars with at least 1 number and 1 symbol");
    valid = false;
  }
  if (password !== confirm){ setErr("regConfirmErr",  "Passwords do not match");        valid = false; }
  if (!valid) return;

  setLoading("registerSubmit", true);

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password, country }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    saveSession(data.user);
    window.location.href = "/dashboard.html";
  } catch (err) {
    showFormError("registerError", err.message);
  } finally {
    setLoading("registerSubmit", false);
  }
});

// ── LOGIN ─────────────────────────────────────────────────────────────────
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrs("loginEmailErr","loginPasswordErr","loginError");

  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  let valid = true;

  if (!isGmail(email))  { setErr("loginEmailErr",    "Must be a Gmail address"); valid = false; }
  if (password.length < 6) { setErr("loginPasswordErr","Minimum 6 characters");  valid = false; }
  if (!valid) return;

  setLoading("loginSubmit", true);

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    saveSession(data.user);
    window.location.href = "/dashboard.html";
  } catch (err) {
    showFormError("loginError", err.message);
  } finally {
    setLoading("loginSubmit", false);
  }
});

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────
forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrs("forgotEmailErr","forgotError");
  const email = document.getElementById("forgotEmail").value.trim();
  if (!isGmail(email)) { setErr("forgotEmailErr","Must be a Gmail address"); return; }

  try {
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const el = document.getElementById("forgotSuccess");
    el.textContent = `Reset link sent to ${email}. Check your inbox.`;
    el.hidden = false;
  } catch {
    showFormError("forgotError", "Could not send reset email. Try again.");
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────
function saveSession(user) {
  sessionStorage.setItem("el_user", JSON.stringify(user));
  if (document.getElementById("loginRemember")?.checked) {
    localStorage.setItem("el_user", JSON.stringify(user));
  }
}

function showFormError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.querySelector(".btn-text").hidden  = loading;
  btn.querySelector(".btn-spinner").hidden = !loading;
}

// ── Restore session from localStorage (remember me) ───────────────────────
const stored = localStorage.getItem("el_user");
if (stored) {
  try {
    JSON.parse(stored);
    sessionStorage.setItem("el_user", stored);
    window.location.href = "/dashboard.html";
  } catch {
    localStorage.removeItem("el_user");
  }
}
