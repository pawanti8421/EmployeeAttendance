// models/User.js
// Mongoose schema + model for employees/admins

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type:     String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    role: {
      type:    String,
      enum:    ['admin', 'user'],
      default: 'user',
    },
  },
  { timestamps: true }   // adds createdAt, updatedAt
);

// ── Hash password before saving ──────────────────────────
userSchema.pre('save', async function (next) {
  // Only hash if password field was modified
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ── Instance method: compare plain vs hashed password ────
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// ── Never return password in JSON responses ───────────────
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
