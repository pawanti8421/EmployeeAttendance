// public/js/app.js
// All frontend logic: auth, navigation, attendance actions, data loading

/* ─────────────────────────────────────────────
   State
───────────────────────────────────────────── */
let currentUser = null; // { id, name, email, role }
let allUsersCache = []; // cache for client-side search filtering

/* ─────────────────────────────────────────────
   Initialise
───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  startClock();
  updateDateDisplay();
  checkSession();

  // Allow "Enter" key on login form
  ["login-email", "login-password"].forEach((id) => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleLogin();
    });
  });
});

/* ─────────────────────────────────────────────
   Session check on page load
───────────────────────────────────────────── */
async function checkSession() {
  try {
    const res = await api("GET", "/api/me");
    if (res.user) {
      currentUser = res.user;
      enterDashboard();
    }
  } catch {
    // Not authenticated — stay on login page
  }
}

/* ─────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────── */
async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btn = document.getElementById("login-btn");
  const btnText = document.getElementById("login-btn-text");

  hideAlert("login-alert");

  if (!email || !password) {
    showAlert("login-alert", "Please enter your email and password.", "error");
    return;
  }

  btn.disabled = true;
  btnText.innerHTML = '<span class="spinner"></span> Signing in...';

  try {
    const res = await api("POST", "/api/login", { email, password });
    currentUser = res.user;
    enterDashboard();
  } catch (err) {
    showAlert(
      "login-alert",
      err.message || "Login failed. Please try again.",
      "error",
    );
    btn.disabled = false;
    btnText.textContent = "Sign In";
  }
}

/* ─────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────── */
async function handleLogout() {
  try {
    await api("POST", "/api/logout");
  } catch {
    /* ignore */
  }
  currentUser = null;
  showPage("login-page");
  document.getElementById("login-email").value = "";
  document.getElementById("login-password").value = "";
}

/* ─────────────────────────────────────────────
   Enter dashboard after login
───────────────────────────────────────────── */
function enterDashboard() {
  // Personalise top nav
  document.getElementById("nav-user-name").textContent = currentUser.name;
  document.getElementById("avatar-initials").textContent = getInitials(
    currentUser.name,
  );

  const roleTag = document.getElementById("nav-role-tag");
  roleTag.textContent = currentUser.role;
  roleTag.className = `role-tag ${currentUser.role}`;

  // Show / hide admin nav
  document.getElementById("admin-nav").style.display =
    currentUser.role === "admin" ? "block" : "none";

  // Load initial dashboard data
  showPage("dashboard-page");
  showSection("dashboard");
}

/* ─────────────────────────────────────────────
   Page / section routing
───────────────────────────────────────────── */
function showPage(pageId) {
  const loginPage = document.getElementById("login-page");
  const dashboardPage = document.getElementById("dashboard-page");

  if (pageId === "dashboard-page") {
    if (loginPage) loginPage.style.display = "none";
    if (dashboardPage) dashboardPage.style.display = "block";
  } else {
    if (loginPage) loginPage.style.display = "block";
    if (dashboardPage) dashboardPage.style.display = "none";
  }
}

function showSection(sectionId) {
  // Deactivate all nav links + sections
  document
    .querySelectorAll(".nav-link")
    .forEach((l) => l.classList.remove("active"));
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.remove("active"));

  // Activate selected nav link
  const link = document.querySelector(`[data-section="${sectionId}"]`);
  if (link) link.classList.add("active");

  // Activate section
  document.getElementById(`section-${sectionId}`).classList.add("active");

  // Lazy-load data when section is opened
  switch (sectionId) {
    case "dashboard":
      loadDashboard();
      break;
    case "my-attendance":
      loadMyAttendance();
      break;
    case "all-attendance":
      loadAllAttendance();
      break;
    case "manage-users":
      loadUsers();
      break;
    case "network-settings":
      loadNetworkSettings();
      break;
    // user-detail is loaded by openUserDetail(), not lazy-loaded here
  }
}

/* ─────────────────────────────────────────────
   Dashboard load
───────────────────────────────────────────── */
async function loadDashboard() {
  // Greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  document.getElementById("welcome-heading").textContent =
    `${greeting}, ${currentUser.name} 👋`;
  document.getElementById("today-date-display").textContent =
    new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // Load today status and recent records concurrently
  await Promise.all([loadTodayStatus(), loadRecentAttendance()]);
}

/* ─────────────────────────────────────────────
   Today status (in / out buttons state)
───────────────────────────────────────────── */
async function loadTodayStatus() {
  try {
    const res = await api("GET", "/api/today-status");
    updateAttendanceButtons(res);
  } catch (err) {
    console.error("Today status error:", err);
  }
}

function updateAttendanceButtons(status) {
  const btnIn = document.getElementById("btn-mark-in");
  const btnOut = document.getElementById("btn-mark-out");
  const badges = document.getElementById("today-status-badges");
  const todayHours = document.getElementById("stat-hours-today");

  badges.innerHTML = "";

  if (status.status === "none") {
    // Not clocked in yet
    btnIn.disabled = false;
    btnOut.disabled = true;
    btnOut.style.opacity = "0.4";
    todayHours.textContent = "—";
  } else if (status.status === "in") {
    // Clocked in, not out yet
    btnIn.disabled = true;
    btnIn.style.opacity = "0.4";
    btnOut.disabled = false;
    btnOut.style.opacity = "1";
    todayHours.textContent = "—";

    badges.innerHTML = `
      <div class="status-badge marked-in">
        <span class="status-dot"></span>
        IN @ ${status.in_time}
      </div>`;
  } else if (status.status === "completed") {
    // Full day done
    btnIn.disabled = true;
    btnIn.style.opacity = "0.4";
    btnOut.disabled = true;
    btnOut.style.opacity = "0.4";
    todayHours.textContent = status.total_hours
      ? `${status.total_hours}h`
      : "—";

    badges.innerHTML = `
      <div class="status-badge marked-in">
        <span class="status-dot"></span>
        IN @ ${status.in_time}
      </div>
      <div class="status-badge marked-out">
        <span class="status-dot"></span>
        OUT @ ${status.out_time}
      </div>`;
  }
}

/* ─────────────────────────────────────────────
   MARK IN
───────────────────────────────────────────── */
async function markIn() {
  const btn = document.getElementById("btn-mark-in");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Marking...';

  try {
    const res = await api("POST", "/api/mark-in");
    showToast("success", "✅ Marked IN successfully!", res.message);
    await loadTodayStatus();
    loadRecentAttendance();
    loadStats();
  } catch (err) {
    showToast("error", "❌ Mark IN failed", err.message);
    btn.disabled = false;
  }
  btn.innerHTML = "⏱ Mark IN";
}

/* ─────────────────────────────────────────────
   MARK OUT
───────────────────────────────────────────── */
async function markOut() {
  const btn = document.getElementById("btn-mark-out");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Marking...';

  try {
    const res = await api("POST", "/api/mark-out");
    showToast("success", "🏁 Marked OUT successfully!", res.message);
    await loadTodayStatus();
    loadRecentAttendance();
    loadStats();
  } catch (err) {
    showToast("error", "❌ Mark OUT failed", err.message);
    btn.disabled = false;
  }
  btn.innerHTML = "🏁 Mark OUT";
}

/* ─────────────────────────────────────────────
   Load recent attendance (dashboard mini-table)
───────────────────────────────────────────── */
async function loadRecentAttendance() {
  const tbody = document.getElementById("recent-attendance-body");
  try {
    const res = await api("GET", `/api/attendance/${currentUser.id}`);
    const records = res.attendance.slice(0, 7); // show last 7 days
    renderAttendanceTable(tbody, records, false);
    computeStats(res.attendance);
  } catch (err) {
    tbody.innerHTML = errorRow(5, err.message);
  }
}

/* ─────────────────────────────────────────────
   Load full attendance (My Attendance section)
───────────────────────────────────────────── */
async function loadMyAttendance() {
  const tbody = document.getElementById("my-attendance-body");
  tbody.innerHTML = loadingRow(6);
  try {
    const res = await api("GET", `/api/attendance/${currentUser.id}`);
    renderAttendanceTable(tbody, res.attendance, true);
  } catch (err) {
    tbody.innerHTML = errorRow(6, err.message);
  }
}

/* ─────────────────────────────────────────────
   Load all attendance (Admin section)
───────────────────────────────────────────── */
async function loadAllAttendance() {
  const tbody = document.getElementById("all-attendance-body");
  tbody.innerHTML = loadingRow(8);
  try {
    const res = await api("GET", "/api/all-attendance");
    renderAllAttendanceTable(tbody, res.attendance);
  } catch (err) {
    tbody.innerHTML = errorRow(8, err.message);
  }
}

/* ─────────────────────────────────────────────
   Load users list (Admin section)
───────────────────────────────────────────── */
async function loadUsers() {
  const tbody = document.getElementById("users-body");
  tbody.innerHTML = loadingRow(5);

  // Clear search box each time section is freshly loaded
  const searchInput = document.getElementById("user-search-input");
  if (searchInput) searchInput.value = "";

  try {
    const res = await api("GET", "/api/users");
    allUsersCache = res.users; // cache for filtering
    renderUsersTable(allUsersCache);
  } catch (err) {
    tbody.innerHTML = errorRow(5, err.message);
  }
}

/* Render users table from an array (used by both loadUsers and filterUsers) */
function renderUsersTable(users) {
  const tbody = document.getElementById("users-body");
  const countEl = document.getElementById("user-search-count");

  if (countEl) {
    countEl.textContent =
      users.length === allUsersCache.length
        ? `${users.length} employee${users.length !== 1 ? "s" : ""}`
        : `${users.length} of ${allUsersCache.length} employees`;
  }

  if (users.length === 0) {
    tbody.innerHTML = emptyRow(5, "No employees match your search");
    return;
  }

  tbody.innerHTML = users
    .map(
      (u, i) => `
    <tr>
      <td class="mono">${i + 1}</td>
      <td><strong>${esc(u.name)}</strong></td>
      <td style="color:var(--text-muted)">${esc(u.email)}</td>
      <td><span class="badge ${u.role === "admin" ? "badge-in" : "badge-complete"}">${u.role}</span></td>
      <td>
        <button class="btn btn-outline btn-sm"
          onclick="openUserDetail('${esc(u._id || u.id)}','${esc(u.name)}','${esc(u.email)}','${u.role}')">
          👁 View Records
        </button>
      </td>
    </tr>`,
    )
    .join("");
}

/* ─────────────────────────────────────────────
   SEARCH — instant client-side filter
───────────────────────────────────────────── */
function filterUsers() {
  const query = document
    .getElementById("user-search-input")
    .value.trim()
    .toLowerCase();

  if (!query) {
    renderUsersTable(allUsersCache);
    return;
  }

  const filtered = allUsersCache.filter(
    (u) =>
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query),
  );

  renderUsersTable(filtered);
}

/* ─────────────────────────────────────────────
   OPEN USER DETAIL DASHBOARD
   Called when admin clicks "View Records"
───────────────────────────────────────────── */
function openUserDetail(userId, userName, userEmail, userRole) {
  // Show the hidden nav link and label it
  const navItem = document.getElementById("nav-user-detail");
  document.getElementById("nav-user-detail-name").textContent = userName;
  navItem.style.display = "flex";

  // Navigate to user-detail section (activates nav + section)
  showSection("user-detail");

  // Populate user info panel
  document.getElementById("detail-heading").textContent = userName;
  document.getElementById("detail-subheading").textContent =
    `${userEmail} · ${userRole}`;
  document.getElementById("detail-avatar").textContent = getInitials(userName);
  document.getElementById("detail-name").textContent = userName;
  document.getElementById("detail-email").textContent = userEmail;
  document.getElementById("detail-role-badge").innerHTML =
    `<span class="badge ${userRole === "admin" ? "badge-in" : "badge-complete"}">${userRole}</span>`;

  // Wire refresh button for this specific user
  document.getElementById("detail-refresh-btn").onclick = () =>
    loadUserDetail(userId);

  // Load attendance records
  loadUserDetail(userId);
}

/* Fetch and render attendance for one user + compute summary stats */
async function loadUserDetail(userId) {
  const tbody = document.getElementById("detail-attendance-body");
  tbody.innerHTML = loadingRow(6);

  // Reset summary
  ["detail-total-days", "detail-total-hours", "detail-avg-hours"].forEach(
    (id) => {
      document.getElementById(id).textContent = "—";
    },
  );

  try {
    const res = await api("GET", `/api/attendance/${userId}`);
    const records = res.attendance;

    // ── Summary stats ──────────────────────────
    const totalDays = records.length;
    const hoursArr = records
      .filter((r) => r.total_hours != null)
      .map((r) => parseFloat(r.total_hours));
    const totalHours = hoursArr.reduce((a, b) => a + b, 0);
    const avgHours = hoursArr.length
      ? (totalHours / hoursArr.length).toFixed(1)
      : 0;

    document.getElementById("detail-total-days").textContent = totalDays;
    document.getElementById("detail-total-hours").textContent =
      totalHours.toFixed(1) + "h";
    document.getElementById("detail-avg-hours").textContent = avgHours + "h";

    // ── Attendance table ───────────────────────
    if (records.length === 0) {
      tbody.innerHTML = emptyRow(
        6,
        "No attendance records found for this employee",
      );
      return;
    }

    tbody.innerHTML = records
      .map((r, i) => {
        const status = !r.in_time
          ? "pending"
          : !r.out_time
            ? "in"
            : "completed";
        const badge =
          status === "completed"
            ? '<span class="badge badge-complete">Complete</span>'
            : status === "in"
              ? '<span class="badge badge-in">Clocked In</span>'
              : '<span class="badge badge-pending">Pending</span>';

        return `
        <tr>
          <td class="mono">${i + 1}</td>
          <td class="mono">${formatDate(r.date)}</td>
          <td class="mono">${r.in_time || "—"}</td>
          <td class="mono">${r.out_time || "—"}</td>
          <td class="mono">${r.total_hours != null ? r.total_hours + "h" : "—"}</td>
          <td>${badge}</td>
        </tr>`;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = errorRow(6, err.message);
  }
}

/* ─────────────────────────────────────────────
   ADD USER (Admin)
───────────────────────────────────────────── */
async function addUser() {
  const name = document.getElementById("new-name").value.trim();
  const email = document.getElementById("new-email").value.trim();
  const password = document.getElementById("new-password").value;
  const role = document.getElementById("new-role").value;
  const btnText = document.getElementById("add-user-btn-text");

  hideAlert("add-user-alert");

  if (!name || !email || !password) {
    showAlert(
      "add-user-alert",
      "Name, email, and password are required.",
      "error",
    );
    return;
  }

  btnText.innerHTML = '<span class="spinner"></span> Creating...';

  try {
    const res = await api("POST", "/api/add-user", {
      name,
      email,
      password,
      role,
    });
    showAlert(
      "add-user-alert",
      `✅ Employee "${res.user.name}" created successfully!`,
      "success",
    );
    // Clear form
    ["new-name", "new-email", "new-password"].forEach((id) => {
      document.getElementById(id).value = "";
    });
    document.getElementById("new-role").value = "user";
    showToast(
      "success",
      "Employee Added",
      `${res.user.name} has been added to the system.`,
    );
  } catch (err) {
    showAlert("add-user-alert", err.message, "error");
  }
  btnText.textContent = "+ Create Employee";
}

/* ─────────────────────────────────────────────
   Compute stats from attendance records
───────────────────────────────────────────── */
function computeStats(records) {
  const totalDays = records.length;
  const now = new Date();
  const thisMonth = records.filter((r) => {
    const d = new Date(r.date);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }).length;

  const hoursArr = records
    .filter((r) => r.total_hours)
    .map((r) => parseFloat(r.total_hours));
  const avgHours = hoursArr.length
    ? (hoursArr.reduce((a, b) => a + b, 0) / hoursArr.length).toFixed(1)
    : "—";

  document.getElementById("stat-total-days").textContent = totalDays;
  document.getElementById("stat-this-month").textContent = thisMonth;
  document.getElementById("stat-avg-hours").textContent =
    avgHours !== "—" ? `${avgHours}h` : "—";
}

function loadStats() {
  // Re-fetch stats when needed
  api("GET", `/api/attendance/${currentUser.id}`)
    .then((res) => computeStats(res.attendance))
    .catch(() => {});
}

/* ─────────────────────────────────────────────
   Table render helpers
───────────────────────────────────────────── */
function renderAttendanceTable(tbody, records, showNumbers) {
  if (!records || records.length === 0) {
    tbody.innerHTML = emptyRow(
      showNumbers ? 6 : 5,
      "No attendance records found",
    );
    return;
  }

  tbody.innerHTML = records
    .map((r, i) => {
      const status = !r.in_time ? "pending" : !r.out_time ? "in" : "completed";
      const badge =
        status === "completed"
          ? '<span class="badge badge-complete">Complete</span>'
          : status === "in"
            ? '<span class="badge badge-in">Clocked In</span>'
            : '<span class="badge badge-pending">Pending</span>';

      return `
      <tr>
        ${showNumbers ? `<td class="mono">${i + 1}</td>` : ""}
        <td class="mono">${formatDate(r.date)}</td>
        <td class="mono">${r.in_time || "—"}</td>
        <td class="mono">${r.out_time || "—"}</td>
        <td class="mono">${r.total_hours ? r.total_hours + "h" : "—"}</td>
        <td>${badge}</td>
      </tr>`;
    })
    .join("");
}

function renderAllAttendanceTable(tbody, records) {
  if (!records || records.length === 0) {
    tbody.innerHTML = emptyRow(8, "No attendance records found");
    return;
  }

  tbody.innerHTML = records
    .map((r, i) => {
      const status = !r.out_time ? "in" : "completed";
      const badge =
        status === "completed"
          ? '<span class="badge badge-complete">Complete</span>'
          : '<span class="badge badge-in">Clocked In</span>';

      return `
      <tr>
        <td class="mono">${i + 1}</td>
        <td><strong>${esc(r.employee_name)}</strong></td>
        <td style="color:var(--text-muted)">${esc(r.email || "")}</td>
        <td class="mono">${formatDate(r.date)}</td>
        <td class="mono">${r.in_time || "—"}</td>
        <td class="mono">${r.out_time || "—"}</td>
        <td class="mono">${r.total_hours ? r.total_hours + "h" : "—"}</td>
        <td>${badge}</td>
      </tr>`;
    })
    .join("");
}

/* ─────────────────────────────────────────────
   Live Clock
───────────────────────────────────────────── */
function startClock() {
  function tick() {
    const now = new Date();
    document.getElementById("live-clock").textContent = now.toLocaleTimeString(
      "en-US",
      { hour12: false },
    );
  }
  tick();
  setInterval(tick, 1000);
}

function updateDateDisplay() {
  const el = document.getElementById("live-date");
  if (el) {
    el.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

/* ─────────────────────────────────────────────
   API helper
───────────────────────────────────────────── */
async function api(method, url, body) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

/* ─────────────────────────────────────────────
   UI utilities
───────────────────────────────────────────── */
function showAlert(id, message, type) {
  const el = document.getElementById(id);
  const icons = { error: "⚠️", success: "✅", warning: "⚠️" };
  el.innerHTML = `<span>${icons[type] || ""}</span><span>${message}</span>`;
  el.className = `alert alert-${type} show`;
}

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.className = "alert";
}

function showToast(type, title, message) {
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const container = document.getElementById("toast-container");

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || "•"}</span>
    <div class="toast-message">
      <strong>${title}</strong><br />
      <span style="color:var(--text-secondary)">${message || ""}</span>
    </div>
    <span class="toast-close" onclick="this.parentElement.remove()">×</span>`;

  container.appendChild(toast);

  // Auto-dismiss after 4s
  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function loadingRow(cols) {
  return `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-icon"><span class="spinner" style="width:20px;height:20px;border-width:3px"></span></div><p>Loading...</p></div></td></tr>`;
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-icon">📋</div><p>${msg}</p></div></td></tr>`;
}

function errorRow(cols, msg) {
  return `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-icon">⚠️</div><p style="color:var(--danger)">${msg}</p></div></td></tr>`;
}

function getInitials(name) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// Safe HTML escape to prevent XSS
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ═══════════════════════════════════════════════════════════
   NETWORK SETTINGS  (Admin — Feature 1 & 5)
   Manage office IP whitelist. All functions are admin-only.
═══════════════════════════════════════════════════════════ */

/**
 * Entry point when admin opens Network Settings section.
 * Detects their IP and loads the current whitelist.
 */
async function loadNetworkSettings() {
  detectMyIP();
  loadOfficeIPs();
}

/**
 * Calls /api/my-ip and displays the result so the admin
 * can easily add their current IP to the whitelist.
 */
async function detectMyIP() {
  const display = document.getElementById("my-ip-display");
  if (!display) return;
  display.textContent = "detecting…";
  try {
    const res = await api("GET", "/api/my-ip");
    display.textContent = res.ip || "Unknown";
  } catch {
    display.textContent = "Could not detect";
  }
}

/**
 * Copies the detected IP into the add-IP input field.
 */
function useMyIP() {
  const ipDisplay = document.getElementById("my-ip-display").textContent;
  const ipInput = document.getElementById("new-ip");
  if (
    ipDisplay &&
    ipDisplay !== "detecting…" &&
    ipDisplay !== "Could not detect"
  ) {
    ipInput.value = ipDisplay;
    ipInput.focus();
  }
}

/**
 * Fetches the current whitelist from the backend and renders
 * it in the office-ips-body table.
 */
async function loadOfficeIPs() {
  const tbody = document.getElementById("office-ips-body");
  if (!tbody) return;
  tbody.innerHTML = loadingRow(6);

  try {
    const res = await api("GET", "/api/office-ips");
    const ips = res.ips;

    if (ips.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">🌐</div>
            <p>No IPs configured — all networks are currently <strong style="color:var(--success)">allowed</strong></p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = ips
      .map(
        (entry, i) => `
      <tr>
        <td class="mono">${i + 1}</td>
        <td>
          <span style="font-family:var(--font-mono); font-size:13px;
                       background:var(--accent-dim); color:var(--accent);
                       padding:2px 8px; border-radius:4px; border:1px solid var(--accent);">
            ${esc(entry.ip)}
          </span>
        </td>
        <td>${esc(entry.label || "—")}</td>
        <td style="color:var(--text-muted)">${esc(entry.addedBy?.name || "—")}</td>
        <td class="mono" style="color:var(--text-muted); font-size:12px;">
          ${formatDate(entry.createdAt)}
        </td>
        <td>
          <button class="btn btn-sm"
            style="background:var(--danger-dim); color:var(--danger);
                   border:1px solid var(--danger); padding:4px 12px;"
            onclick="removeOfficeIP('${esc(entry._id)}', '${esc(entry.ip)}')">
            🗑 Remove
          </button>
        </td>
      </tr>`,
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = errorRow(6, err.message);
  }
}

/**
 * Submits the add-IP form to POST /api/office-ips.
 */
async function addOfficeIP() {
  const ip = document.getElementById("new-ip").value.trim();
  const label = document.getElementById("new-ip-label").value.trim();
  const btnText = document.getElementById("add-ip-btn-text");

  hideAlert("network-alert");

  if (!ip) {
    showAlert("network-alert", "Please enter an IP address.", "error");
    return;
  }

  btnText.innerHTML = '<span class="spinner"></span> Adding…';

  try {
    const res = await api("POST", "/api/office-ips", { ip, label });
    showAlert("network-alert", `✅ ${res.message}`, "success");
    // Clear inputs
    document.getElementById("new-ip").value = "";
    document.getElementById("new-ip-label").value = "";
    showToast("success", "IP Added", `${res.entry.ip} is now whitelisted.`);
    loadOfficeIPs(); // refresh the table
  } catch (err) {
    showAlert("network-alert", err.message, "error");
  }

  btnText.textContent = "+ Add to Whitelist";
}

/**
 * Sends DELETE /api/office-ips/:id after inline confirmation.
 * @param {string} id  — MongoDB _id of the OfficeIP document
 * @param {string} ip  — human-readable IP string for the confirm dialog
 */
async function removeOfficeIP(id, ip) {
  if (
    !confirm(
      `Remove ${ip} from the whitelist?\n\nUsers on this network will no longer be able to mark attendance.`,
    )
  ) {
    return;
  }

  try {
    const res = await api("DELETE", `/api/office-ips/${id}`);
    showToast("info", "IP Removed", res.message);
    loadOfficeIPs(); // refresh the table
  } catch (err) {
    showToast("error", "Remove Failed", err.message);
  }
}
