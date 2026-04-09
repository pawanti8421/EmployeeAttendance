// middleware/auth.js
// Session-based guards — attach to any route that needs protection

function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Unauthorized — please log in' });
  }
  req.user = req.session.user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Unauthorized — please log in' });
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden — admin access required' });
  }
  req.user = req.session.user;
  next();
}

module.exports = { requireAuth, requireAdmin };
