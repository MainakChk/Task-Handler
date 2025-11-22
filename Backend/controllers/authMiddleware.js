module.exports = (req, res, next) => {
  // Example: allow access only if a special header is present
  const adminKey = req.headers['x-admin-key'];
  if (adminKey === process.env.ADMIN_KEY) {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden' });
  }
};
