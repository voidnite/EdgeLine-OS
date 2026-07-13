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

  // Check verification code if one was requested
  const codeInput = document.getElementById("regCode");
  const codeGroup = document.getElementById("verifyCodeGroup");
  if (codeGroup && !codeGroup.hidden && codeInput?.value.trim()) {
    const enteredCode = codeInput.value.trim();
    const expected    = getVerifyCode(email) ?? getVerifyCode(phone);
    if (expected && enteredCode !== expected) {
      setErr("regCodeErr", "Incorrect verification code");
      valid = false;
    }
  }
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

// ── Send verification code ────────────────────────────────────────────────
// Since we don't have a real SMS/email gateway in the demo, we generate
// a 6-digit code and display it right on screen (like a dev preview).
// In production replace this with an actual email/SMS API call.

const _pendingCodes = {}; // email → { code, expires }

document.getElementById("sendCodeBtn")?.addEventListener("click", async () => {
  const email  = document.getElementById("regEmail")?.value.trim();
  const phone  = document.getElementById("regPhone")?.value.trim();
  const method = document.querySelector('input[name="verifyMethod"]:checked')?.value ?? "email";
  const codeErr= document.getElementById("regCodeErr");
  const codeGroup = document.getElementById("verifyCodeGroup");

  if (!email && !phone) {
    if (codeErr) codeErr.textContent = "Enter your email and phone first.";
    return;
  }

  // Generate 6-digit code
  const code    = String(Math.floor(100000 + Math.random() * 900000));
  const expires = Date.now() + 10 * 60 * 1000; // 10 min
  const target  = method === "sms" ? phone : email;
  _pendingCodes[email ?? phone] = { code, expires };

  // Show the code group if hidden
  if (codeGroup) codeGroup.hidden = false;
  if (codeErr) codeErr.textContent = "";

  // Update button state
  const btn = document.getElementById("sendCodeBtn");
  if (btn) {
    btn.textContent = "Sending…";
    btn.disabled    = true;
  }

  // POST to server — server sends real email or returns code if not configured
  try {
    const resp = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, method, code }),
    });
    const data = await resp.json();

    // Remove any previous box
    document.getElementById("codeDemoBox")?.remove();
    const box = document.createElement("div");
    box.id = "codeDemoBox";
    box.style.marginTop = "6px";

    if (data.ok) {
      // Real message sent (email or SMS)
      const channel = data.delivered === "sms" ? "SMS" : "email";
      const hint    = data.delivered === "sms"
        ? "Check your text messages"
        : "Check your inbox (and spam folder)";
      box.className = "glass-success";
      box.innerHTML = `✅ Verification code sent via <strong>${channel}</strong> to <strong>${target}</strong>.
        <br><small>${hint} · Expires in 10 min</small>`;
    } else if (data.reason === "no_credentials" || data.reason === "sms_not_configured") {
      // Twilio/Gmail not yet configured — still show code so user isn't blocked
      // Store the server-returned code so validation works
      _pendingCodes[email ?? phone] = { code: data.code ?? code, expires: Date.now() + 10 * 60 * 1000 };
      box.className = "glass-success";
      box.innerHTML = `Your verification code is
        <strong style="font-size:1.1rem;letter-spacing:.12em">${data.code ?? code}</strong>
        <br><small>Email not configured — showing code here · Expires in 10 min</small>`;
    } else {
      box.className = "glass-error";
      const isNetwork = data.reason?.includes("ENOTFOUND") || data.reason?.includes("network") || data.reason?.includes("fetch");
      if (isNetwork && method === "sms") {
        box.className = "glass-success";
        // Auto-fallback: send via email instead
        box.innerHTML = `⚠️ SMS network unreachable. Sending via <strong>email</strong> to <strong>${email}</strong> instead.
          <br><small>Check your inbox · Expires in 10 min</small>`;
        // Actually send by email
        fetch("/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: email, method: "email", code }),
        }).catch(() => {});
      } else {
        box.innerHTML = `Could not send code: ${data.reason ?? "Unknown error"}. Try again.`;
      }
    }

    document.getElementById("regCode")?.closest(".code-row")?.after(box);
  } catch {
    // Network error fallback
    const box = document.createElement("div");
    box.className = "glass-success";
    box.style.marginTop = "6px";
    box.innerHTML = `Your verification code is
      <strong style="font-size:1.1rem;letter-spacing:.12em">${code}</strong>
      <br><small>Expires in 10 min</small>`;
    document.getElementById("codeDemoBox")?.remove();
    box.id = "codeDemoBox";
    document.getElementById("regCode")?.closest(".code-row")?.after(box);
  } finally {
    // Re-enable button after 30s
    if (btn) {
      btn.textContent = "Code sent ✅";
      setTimeout(() => {
        btn.textContent = "Resend code";
        btn.disabled    = false;
      }, 30000);
    }
  }
});

// Expose pending codes for register form validation
function getVerifyCode(emailOrPhone) {
  const rec = _pendingCodes[emailOrPhone];
  if (!rec) return null;
  if (Date.now() > rec.expires) { delete _pendingCodes[emailOrPhone]; return null; }
  return rec.code;
}

// ── Show/hide verify code group based on radio selection ─────────────────
document.querySelectorAll('input[name="verifyMethod"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const grp = document.getElementById("verifyCodeGroup");
    if (grp) grp.hidden = false;
  });
});

// ── Restore session from localStorage (remember me) ───────────────────────
const stored = localStorage.getItem("el_user");
if (stored) {
  try {
    JSON.parse(stored); // validate it's real JSON before redirecting
    sessionStorage.setItem("el_user", stored);
    window.location.href = "/dashboard.html";
  } catch {
    localStorage.removeItem("el_user");
  }
}
