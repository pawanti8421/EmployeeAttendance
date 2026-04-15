// models/Attendance.js
// Mongoose schema + model for attendance records

const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyUser",
      required: true,
    },
    // Store date as a plain "YYYY-MM-DD" string for easy daily lookups
    date: {
      type: String,
      required: true,
    },
    inTime: {
      type: Date,
      default: null,
    },
    outTime: {
      type: Date,
      default: null,
    },
    // Calculated and stored when mark-out is called (decimal hours, e.g. 8.50)
    totalHours: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true },
);

// ── One record per user per day ───────────────────────────
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

// ── Virtual: status label ────────────────────────────────
attendanceSchema.virtual("status").get(function () {
  if (!this.inTime) return "pending";
  if (!this.outTime) return "in";
  return "completed";
});

attendanceSchema.set("toJSON", { virtuals: true });
attendanceSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
