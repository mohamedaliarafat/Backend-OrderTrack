const { authMiddleware } = require('./authMiddleware');

const authenticate = authMiddleware;

const authorize = (allowedRoles = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Permission denied' });
  }

  next();
};

module.exports = { authenticate, authorize };
