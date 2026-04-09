// routes/attendance.js
// mark-in, mark-out, fetch attendance — all backed by MongoDB Atlas

const express    = require('express');
const Attendance = require('../models/Attendance');
const User       = require('../models/User');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router     = express.Router();

// Helper: today as "YYYY-MM-DD" string
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Helper: format a Date object to "HH:MM:SS"
function fmtTime(d) {
  if (!d) return null;
  return new Date(d).toLocaleTimeString('en-GB', { hour12: false });
}

// ─────────────────────────────────────────────
//  POST /api/mark-in
// ─────────────────────────────────────────────
router.post('/mark-in', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const today  = todayStr();
  const now    = new Date();

  try {
    // Check if already checked in today
    const existing = await Attendance.findOne({ user: userId, date: today });

    if (existing) {
      return res.status(409).json({
        error: `Already marked IN at ${fmtTime(existing.inTime)} today`,
      });
    }

    const record = await Attendance.create({
      user:   userId,
      date:   today,
      inTime: now,
    });

    res.status(201).json({
      message: 'Marked IN successfully',
      record: {
        id:     record._id,
        date:   record.date,
        inTime: fmtTime(record.inTime),
      },
    });
  } catch (err) {
    console.error('Mark-in error:', err);
    res.status(500).json({ error: 'Failed to mark IN' });
  }
});

// ─────────────────────────────────────────────
//  POST /api/mark-out
// ─────────────────────────────────────────────
router.post('/mark-out', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const today  = todayStr();
  const now    = new Date();

  try {
    const record = await Attendance.findOne({ user: userId, date: today });

    if (!record) {
      return res.status(404).json({ error: 'No IN record for today — please mark IN first' });
    }
    if (record.outTime) {
      return res.status(409).json({ error: 'Already marked OUT today' });
    }

    // Calculate total hours
    const diffMs     = now - new Date(record.inTime);
    const totalHours = parseFloat((diffMs / 1000 / 60 / 60).toFixed(2));

    record.outTime    = now;
    record.totalHours = totalHours;
    await record.save();

    res.json({
      message: `Marked OUT — total ${totalHours} hours`,
      record: {
        id:         record._id,
        date:       record.date,
        inTime:     fmtTime(record.inTime),
        outTime:    fmtTime(record.outTime),
        totalHours: record.totalHours,
      },
    });
  } catch (err) {
    console.error('Mark-out error:', err);
    res.status(500).json({ error: 'Failed to mark OUT' });
  }
});

// ─────────────────────────────────────────────
//  GET /api/attendance/:user_id
//  User sees own; admin sees any
// ─────────────────────────────────────────────
router.get('/attendance/:user_id', requireAuth, async (req, res) => {
  const requestedId = req.params.user_id;
  const currentUser = req.user;

  // Regular users may only fetch their own records
  if (currentUser.role !== 'admin' && currentUser.id !== requestedId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const records = await Attendance.find({ user: requestedId })
      .populate('user', 'name email')
      .sort({ date: -1 });

    const attendance = records.map(r => ({
      id:            r._id,
      employee_name: r.user?.name  || '—',
      email:         r.user?.email || '—',
      date:          r.date,
      in_time:       fmtTime(r.inTime),
      out_time:      fmtTime(r.outTime),
      total_hours:   r.totalHours,
      status:        r.status,
    }));

    res.json({ attendance });
  } catch (err) {
    console.error('Fetch attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// ─────────────────────────────────────────────
//  GET /api/all-attendance  (admin only)
// ─────────────────────────────────────────────
router.get('/all-attendance', requireAdmin, async (req, res) => {
  try {
    const records = await Attendance.find({})
      .populate('user', 'name email')
      .sort({ date: -1, 'user.name': 1 });

    const attendance = records.map(r => ({
      id:            r._id,
      employee_name: r.user?.name  || '—',
      email:         r.user?.email || '—',
      date:          r.date,
      in_time:       fmtTime(r.inTime),
      out_time:      fmtTime(r.outTime),
      total_hours:   r.totalHours,
      status:        r.status,
    }));

    res.json({ attendance });
  } catch (err) {
    console.error('All attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch all attendance records' });
  }
});

// ─────────────────────────────────────────────
//  GET /api/today-status
// ─────────────────────────────────────────────
router.get('/today-status', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const today  = todayStr();

  try {
    const record = await Attendance.findOne({ user: userId, date: today });

    if (!record) return res.json({ status: 'none' });

    res.json({
      status:      record.status,
      in_time:     fmtTime(record.inTime),
      out_time:    fmtTime(record.outTime),
      total_hours: record.totalHours,
    });
  } catch (err) {
    console.error('Today status error:', err);
    res.status(500).json({ error: 'Failed to fetch today status' });
  }
});

module.exports = router;
