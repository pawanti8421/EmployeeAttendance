// routes/network.js
// Admin control panel for office IP whitelist.
// Also exposes GET /api/my-ip so users can see their detected IP.

const express = require("express");
const OfficeIP = require("../models/OfficeIP");
const {
  requireAdmin,
  requireAuth,
  getClientIP,
} = require("../middleware/auth");

const router = express.Router();

// ─────────────────────────────────────────────
//  GET /api/my-ip
//  Returns the detected IP of the requesting client.
//  Used in the admin panel to show "your current IP"
//  so the admin can copy-paste it into the whitelist.
// ─────────────────────────────────────────────
router.get("/my-ip", requireAuth, (req, res) => {
  res.json({ ip: getClientIP(req) });
});

// ─────────────────────────────────────────────
//  GET /api/office-ips  (admin only)
//  Returns all whitelisted IPs.
// ─────────────────────────────────────────────
router.get("/office-ips", requireAdmin, async (req, res) => {
  try {
    const ips = await OfficeIP.find({})
      .populate("addedBy", "name")
      .sort({ createdAt: -1 });
    res.json({ ips });
  } catch (err) {
    console.error("List IPs error:", err);
    res.status(500).json({ error: "Failed to fetch office IPs" });
  }
});

// ─────────────────────────────────────────────
//  POST /api/office-ips  (admin only)
//  Body: { ip, label }
//  Adds a new allowed IP to the whitelist.
// ─────────────────────────────────────────────
router.post("/office-ips", requireAdmin, async (req, res) => {
  const { ip, label } = req.body;

  if (!ip || !ip.trim()) {
    return res.status(400).json({ error: "IP address is required" });
  }

  // Basic IP format check (v4 and v6 allowed)
  const ipTrimmed = ip.trim();
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  if (!ipv4Regex.test(ipTrimmed) && !ipv6Regex.test(ipTrimmed)) {
    return res.status(400).json({ error: "Invalid IP address format" });
  }

  try {
    const entry = await OfficeIP.create({
      ip: ipTrimmed,
      label: label?.trim() || "Office Network",
      addedBy: req.user.id,
    });

    res.status(201).json({
      message: `IP ${entry.ip} added to whitelist`,
      entry: { id: entry._id, ip: entry.ip, label: entry.label },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: "This IP is already in the whitelist" });
    }
    console.error("Add IP error:", err);
    res.status(500).json({ error: "Failed to add IP" });
  }
});

// ─────────────────────────────────────────────
//  DELETE /api/office-ips/:id  (admin only)
//  Removes an IP from the whitelist.
// ─────────────────────────────────────────────
router.delete("/office-ips/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await OfficeIP.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "IP entry not found" });
    }
    res.json({ message: `IP ${deleted.ip} removed from whitelist` });
  } catch (err) {
    console.error("Delete IP error:", err);
    res.status(500).json({ error: "Failed to remove IP" });
  }
});

module.exports = router;
