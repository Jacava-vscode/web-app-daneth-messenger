const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, username: user.username, isAdmin: user.isAdmin }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin-only simple user creation protected by ADMIN_KEY header
router.post('/admin/create-user', async (req, res) => {
  const adminKey = req.header('x-admin-key');
  if (!adminKey || adminKey !== (process.env.ADMIN_KEY || 'admin_secret')) return res.status(401).json({ error: 'Unauthorized' });
  const { username, password, isAdmin } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, passwordHash, isAdmin: !!isAdmin });
    await user.save();
    res.json({ ok: true, user: { username: user.username, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

module.exports = router;

// GET /api/me - return current user info (requires Authorization header)
router.get('/me', authenticate, (req, res) => {
  if (!req.user) return res.status(404).json({ error: 'No user' })
  res.json({ id: req.user.id, username: req.user.username, isAdmin: req.user.isAdmin })
})

// GET /api/users - return simple user list (id + username)
router.get('/users', authenticate, async (req, res) => {
  try {
    const User = require('../models/User')
    const users = await User.find({}).select('_id username').limit(200)
    res.json(users.map(u => ({ id: u._id, username: u.username })))
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Admin-only: reset a user's password using admin key header
router.post('/admin/reset-password', async (req, res) => {
  const adminKey = req.header('x-admin-key')
  if (!adminKey || adminKey !== (process.env.ADMIN_KEY || 'admin_secret')) return res.status(401).json({ error: 'Unauthorized' })
  const { username, newPassword } = req.body
  if (!username || !newPassword) return res.status(400).json({ error: 'Missing fields' })
  try {
    const User = require('../models/User')
    const user = await User.findOne({ username })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const bcrypt = require('bcryptjs')
    user.passwordHash = await bcrypt.hash(newPassword, 10)
    await user.save()
    res.json({ ok: true, message: 'Password reset' })
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message })
  }
})
