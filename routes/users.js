// routes/users.js
// Admin-only: create users, list users

const express = require("express");
const User = require("../models/User");
const { requireAdmin } = require("../middleware/auth");
const router = express.Router();

// ─────────────────────────────────────────────
//  POST /api/add-user  (admin only)
// ─────────────────────────────────────────────
router.post("/add-user", requireAdmin, async (req, res) => {
  let { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Name, email, and password are required" });
  }

  role = ["admin", "user"].includes(role) ? role : "user";
  email = email.trim().toLowerCase();

  try {
    // Check for duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ error: "A user with that email already exists" });
    }

    // Create user — password is hashed automatically by the pre-save hook
    const user = await User.create({
      name: name.trim(),
      email,
      password,
      role,
    });

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    // Mongoose validation error
    if (err.name === "ValidationError") {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(", ");
      return res.status(400).json({ error: msg });
    }
    console.error("Add user error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ─────────────────────────────────────────────
//  GET /api/users  (admin only)
// ─────────────────────────────────────────────
router.get("/users", requireAdmin, async (req, res) => {
  try {
    // toJSON() strips password automatically
    const users = await User.find({}).sort({ name: 1 });
    res.json({ users });
  } catch (err) {
    console.error("List users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ─────────────────────────────────────────────
//  GET /api/user/:id  (admin only)
//  Returns a single user's details by ID.
//  Used by the User Detail Dashboard.
// ─────────────────────────────────────────────
router.get("/user/:id", requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user }); // password stripped by toJSON()
  } catch (err) {
    // Handle invalid ObjectId format gracefully
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid user ID format" });
    }
    console.error("Get user error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

module.exports = router;
