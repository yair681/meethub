const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, generateMeetCode } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Public — no auth needed to look up a meeting by code (guests can join via link)
router.get('/join/:code', (req, res) => {
  const meeting = db.prepare('SELECT * FROM meetings WHERE code = ?').get(req.params.code);
  if (!meeting) return res.status(404).json({ error: 'הפגישה לא נמצאה' });
  if (meeting.status === 'ended') return res.status(410).json({ error: 'הפגישה הסתיימה' });
  const host = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(meeting.host_id);
  const { password, ...safeFields } = meeting;
  res.json({ ...safeFields, hasPassword: !!password, host });
});

// Public — verify meeting password
router.post('/check-password/:code', (req, res) => {
  const meeting = db.prepare('SELECT password FROM meetings WHERE code = ?').get(req.params.code);
  if (!meeting) return res.status(404).json({ error: 'הפגישה לא נמצאה' });
  if (!meeting.password) return res.json({ ok: true });
  if (req.body.password === meeting.password) return res.json({ ok: true });
  return res.status(401).json({ error: 'סיסמה שגויה' });
});

router.use(authMiddleware);

router.post('/', (req, res) => {
  const { title, type, scheduledAt, password, settings } = req.body;
  if (!type || !['instant', 'scheduled', 'permanent'].includes(type)) {
    return res.status(400).json({ error: 'Invalid meeting type' });
  }

  const setting = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('can_create_meetings');
  if (setting?.value === 'false' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Meeting creation is currently disabled' });
  }

  const id = uuidv4();
  const code = generateMeetCode();
  const meetTitle = title || (type === 'instant' ? 'Instant Meeting' : type === 'permanent' ? 'My Room' : 'Scheduled Meeting');

  db.prepare(`
    INSERT INTO meetings (id, code, title, host_id, type, status, scheduled_at, password, settings)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, code, meetTitle, req.user.id, type,
    type === 'scheduled' ? 'scheduled' : 'active',
    scheduledAt || null,
    password || null,
    JSON.stringify(settings || {})
  );

  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
  res.json(meeting);
});

router.get('/my', (req, res) => {
  const meetings = db.prepare(`
    SELECT * FROM meetings WHERE host_id = ? AND status != 'ended'
    ORDER BY created_at DESC
  `).all(req.user.id);
  res.json(meetings);
});

router.delete('/:id', (req, res) => {
  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Not found' });
  if (meeting.host_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM meetings WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.patch('/:id', (req, res) => {
  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Not found' });
  if (meeting.host_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { title, scheduledAt, password, settings, status } = req.body;
  db.prepare(`
    UPDATE meetings SET
      title = COALESCE(?, title),
      scheduled_at = COALESCE(?, scheduled_at),
      password = COALESCE(?, password),
      settings = COALESCE(?, settings),
      status = COALESCE(?, status)
    WHERE id = ?
  `).run(title, scheduledAt, password, settings ? JSON.stringify(settings) : null, status, req.params.id);
  res.json(db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id));
});

module.exports = router;
