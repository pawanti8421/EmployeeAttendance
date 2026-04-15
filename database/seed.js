// database/seed.js
// Run once to populate the database with a default admin + sample employees.
// Usage:  node database/seed.js
//    or:  npm run seed

require("dotenv").config();
const mongoose = require("mongoose");
const CompanyUser = require("../models/User");

const MONGODB_URI = process.env.MONGODB_URI;

const seedUsers = [
  {
    name: "System Admin",
    email: "admin@company.com",
    password: "admin123",
    role: "admin",
  },
  {
    name: "Alice Johnson",
    email: "alice@company.com",
    password: "password123",
    role: "user",
  },
  {
    name: "Bob Williams",
    email: "bob@company.com",
    password: "password123",
    role: "user",
  },
  {
    name: "Carol Davis",
    email: "carol@company.com",
    password: "password123",
    role: "user",
  },
];

async function seed() {
  if (!MONGODB_URI) {
    console.error("❌  MONGODB_URI is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("✅  Connected to MongoDB Atlas\n");

  for (const u of seedUsers) {
    const exists = await CompanyUser.findOne({ email: u.email });
    if (exists) {
      console.log(`⏭   Skipped (already exists): ${u.email}`);
      continue;
    }
    // Password is hashed by the pre-save hook in User model
    await CompanyUser.create(u);
    console.log(`✅  Created [${u.role.padEnd(5)}] ${u.name} — ${u.email}`);
  }

  console.log("\n🎉  Seed complete!\n");
  console.log("Default credentials:");
  console.log("  Admin  →  admin@company.com  /  admin123");
  console.log("  User   →  alice@company.com  /  password123\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
