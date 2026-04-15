// models/OfficeIP.js
// Stores the list of approved office network IPs.
// Admin can add/remove IPs via the control panel.

const mongoose = require("mongoose");

const officeIPSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: [true, "IP address is required"],
      unique: true,
      trim: true,
    },
    // Human-readable label, e.g. "Main Office", "Branch 2"
    label: {
      type: String,
      trim: true,
      default: "Office Network",
    },
    // Who added this IP
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyUser",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("OfficeIP", officeIPSchema);
