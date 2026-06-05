const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.patch('/me', (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
    const match = bcrypt.compareSync(currentPassword, user.password);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
  }

  if (email && email !== user.email) {
    const exists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
    if (exists) return res.status(400).json({ error: 'Email already in use' });
  }

  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      email = COALESCE(?, email)
    WHERE id = ?
  `).run(name || null, email || null, req.user.id);

  const updated = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(req.user.id);
  res.json(updated);
});

router.delete('/me', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const match = bcrypt.compareSync(password, user.password);
  if (!match) return res.status(400).json({ error: 'Incorrect password' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.json({ success: true });
});

module.exports = router;
