// middleware/auth.js
// v2: session guards + office-network IP check

const OfficeIP = require("../models/OfficeIP");

// ─────────────────────────────────────────────
//  Helper: extract real client IP
//  Works behind proxies (Render, Heroku, nginx).
//  trust proxy must be set to 1 in server.js.
// ─────────────────────────────────────────────
function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  let ip = forwarded
    ? forwarded.split(",")[0].trim()
    : req.ip || req.connection?.remoteAddress || "0.0.0.0";

  // 🔥 Normalize localhost
  if (ip === "::1") ip = "127.0.0.1";

  return ip;
}

// ─────────────────────────────────────────────
//  requireAuth — any logged-in user
// ─────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Unauthorized — please log in" });
  }
  req.user = req.session.user;
  next();
}

// ─────────────────────────────────────────────
//  requireAdmin — admin role only
// ─────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Unauthorized — please log in" });
  }
  if (req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden — admin access required" });
  }
  req.user = req.session.user;
  next();
}

// ─────────────────────────────────────────────
//  checkOfficeNetwork — IP whitelist guard
//
//  If no IPs are configured in the DB, the check
//  is SKIPPED (open mode). This lets the system
//  work out-of-the-box without configuration.
//
//  Apply to mark-in / mark-out only.
// ─────────────────────────────────────────────
async function checkOfficeNetwork(req, res, next) {
  try {
    const allowedIPs = await OfficeIP.find({}).lean();

    // ── No rules configured → allow everyone ──
    if (allowedIPs.length === 0) return next();

    const clientIP = getClientIP(req);
    const ipList = allowedIPs.map((e) => e.ip);
    const isAllowed = ipList.includes(clientIP);

    if (!isAllowed) {
      console.warn(
        `[IP BLOCK] ${clientIP} not in whitelist [${ipList.join(", ")}]`,
      );
      return res.status(403).json({
        error: "Connect to office WiFi to mark attendance",
        clientIP, // useful for debugging / showing user their IP
      });
    }

    // Attach for logging
    req.clientIP = clientIP;
    next();
  } catch (err) {
    console.error("checkOfficeNetwork error:", err);
    // Fail open — don't block attendance on DB error
    next();
  }
}

// Expose the IP extractor so routes can use it (e.g. /api/my-ip)
module.exports = { requireAuth, requireAdmin, checkOfficeNetwork, getClientIP };
