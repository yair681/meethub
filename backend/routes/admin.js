const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { adminMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(adminMiddleware);

router.post('/verify-password', (req, res) => {
  const { password } = req.body;
  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'סיסמה שגויה' });
  res.json({ ok: true });
});

router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

router.patch('/users/:id', (req, res) => {
  const { name, email, role } = req.body;
  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'admin' && target.id !== req.user.id) {
    return res.status(403).json({ error: 'אין אפשרות לערוך מנהל אחר' });
  }

  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      role = COALESCE(?, role)
    WHERE id = ?
  `).run(name, email, role, req.params.id);

  res.json(db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(req.params.id));
});

router.patch('/users/:id/password', (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'סיסמה חייבת להכיל לפחות 6 תווים' });
  }
  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'admin' && target.id !== req.user.id) {
    return res.status(403).json({ error: 'אין אפשרות לשנות סיסמת מנהל אחר' });
  }
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.params.id);
  res.json({ ok: true });
});

router.delete('/users/:id', (req, res) => {
  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  if (target.role === 'admin') return res.status(403).json({ error: 'אין אפשרות למחוק מנהל' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/meetings', (req, res) => {
  const meetings = db.prepare(`
    SELECT m.*, u.name as host_name, u.email as host_email
    FROM meetings m
    LEFT JOIN users u ON m.host_id = u.id
    ORDER BY m.created_at DESC
  `).all();
  res.json(meetings);
});

router.get('/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM system_settings').all();
  const obj = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json(obj);
});

router.patch('/settings', (req, res) => {
  const { can_create_meetings } = req.body;
  if (can_create_meetings !== undefined) {
    db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run(
      'can_create_meetings', String(can_create_meetings)
    );
  }
  const settings = db.prepare('SELECT * FROM system_settings').all();
  const obj = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json(obj);
});

router.get('/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalMeetings = db.prepare('SELECT COUNT(*) as count FROM meetings').get().count;
  const activeMeetings = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'active'").get().count;
  const scheduledMeetings = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'scheduled'").get().count;
  res.json({ totalUsers, totalMeetings, activeMeetings, scheduledMeetings });
});

module.exports = router;
