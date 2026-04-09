// routes/auth.js
// POST /api/login   POST /api/logout   GET /api/me

const express = require('express');
const User    = require('../models/User');
const router  = express.Router();

// ─────────────────────────────────────────────
//  POST /api/login
// ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Find user by email (include password for comparison)
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare password using the model instance method
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Save slim user info to session (no password)
    req.session.user = {
      id:    user._id.toString(),
      name:  user.name,
      email: user.email,
      role:  user.role,
    };

    res.json({ message: 'Login successful', user: req.session.user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ─────────────────────────────────────────────
//  POST /api/logout
// ─────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully' });
  });
});

// ─────────────────────────────────────────────
//  GET /api/me  — return current session user
// ─────────────────────────────────────────────
router.get('/me', (req, res) => {
  if (req.session?.user) {
    return res.json({ user: req.session.user });
  }
  res.status(401).json({ error: 'Not authenticated' });
});

module.exports = router;
