const express = require('express');
const { db } = require('../db');
const { adminMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(adminMiddleware);

router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

router.patch('/users/:id', (req, res) => {
  const { name, email, role } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      role = COALESCE(?, role)
    WHERE id = ?
  `).run(name, email, role, req.params.id);

  res.json(db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(req.params.id));
});

router.delete('/users/:id', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

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
