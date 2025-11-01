export const authorizeRole = (roles = []) => {
  return (req, res, next) => {
    if (!roles.length) return next(); // Public route
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
};