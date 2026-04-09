// server.js
// Entry point — Express setup, MongoDB Atlas connection, routes, static files

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const attendanceRoutes = require("./routes/attendance");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Connect to MongoDB Atlas ──────────────────
connectDB();

// ── Middleware ────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "https://employeeattandance.onrender.com",
    credentials: true,
  }),
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "attendance_dev_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // 🔥 FORCE FALSE (VERY IMPORTANT for localhost)
      httpOnly: true,
      sameSite: "none", // 🔥 ADD THIS
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

// ── Static frontend files ─────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── API Routes ────────────────────────────────
app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", attendanceRoutes);

// ── Health check (used by hosting platforms) ──
app.get("/health", (req, res) => {
  const mongoose = require("mongoose");
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

// ── SPA fallback ──────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Global error handler ──────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "An unexpected server error occurred" });
});

// ── Start ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Attendance System → http://localhost:${PORT}`);
  console.log(
    `🍃  MongoDB Atlas: ${process.env.MONGODB_URI ? "URI configured" : "⚠️  MONGODB_URI not set"}\n`,
  );
});
