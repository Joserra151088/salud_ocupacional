const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

// GET /api/users — solo admin
router.get('/', adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, active, last_login, created_at FROM users ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/users — crear usuario (admin)
router.post('/', adminOnly, async (req, res) => {
  const { name, email, password, role = 'doctor' } = req.body;
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Nombre, email y contraseña (min 8 chars) son requeridos' });
  }
  const id = uuidv4();
  const hash = await bcrypt.hash(password, 12);
  try {
    await db.query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,?)',
      [id, name, email.toLowerCase().trim(), hash, role]
    );
    res.status(201).json({ id, name, email, role, active: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// PUT /api/users/:id — actualizar usuario (admin)
router.put('/:id', adminOnly, async (req, res) => {
  const { name, email, role, active, password } = req.body;
  const updates = [];
  const values = [];
  if (name) { updates.push('name = ?'); values.push(name); }
  if (email) { updates.push('email = ?'); values.push(email.toLowerCase().trim()); }
  if (role) { updates.push('role = ?'); values.push(role); }
  if (active !== undefined) { updates.push('active = ?'); values.push(active ? 1 : 0); }
  if (password && password.length >= 8) {
    const hash = await bcrypt.hash(password, 12);
    updates.push('password_hash = ?');
    values.push(hash);
  }
  if (!updates.length) return res.status(400).json({ error: 'Sin campos para actualizar' });
  try {
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...values, req.params.id]);
    const [rows] = await db.query(
      'SELECT id, name, email, role, active, last_login FROM users WHERE id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
