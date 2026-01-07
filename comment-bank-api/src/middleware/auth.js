export function isAuthenticated(req, res, next) {
  if (req.session?.user) {
    next();
    return;
  }
  res.status(401).json({ message: 'Unauthorized' });
}

export function isAdmin(req, res, next) {
  if (req.session?.user?.isAdmin) {
    next();
    return;
  }
  res.status(403).json({ message: 'Forbidden' });
}
