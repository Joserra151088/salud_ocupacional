const router = require('express').Router();
const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

// GET /api/workers — lista con búsqueda
router.get('/', async (req, res) => {
  const { q = '', status, department, limit = 100, offset = 0 } = req.query;
  try {
    let sql = `SELECT id, employee_id, name, department, position, status,
                      date_hired, risk_level, blood_type, emergency_contact_name,
                      emergency_contact_phone, created_at
               FROM workers WHERE 1=1`;
    const params = [];
    if (q) {
      sql += ' AND (name LIKE ? OR employee_id LIKE ? OR department LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (department) { sql += ' AND department = ?'; params.push(department); }
    sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/workers/:id — expediente completo
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM workers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Trabajador no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/workers — crear
router.post('/', async (req, res) => {
  const {
    employee_id, name, date_birth, gender, department, position,
    date_hired, risk_level, blood_type, allergies, chronic_conditions,
    emergency_contact_name, emergency_contact_phone, status = 'active',
  } = req.body;
  if (!name || !employee_id) {
    return res.status(400).json({ error: 'Nombre y número de empleado son requeridos' });
  }
  const id = uuidv4();
  try {
    await db.query(
      `INSERT INTO workers (id, employee_id, name, date_birth, gender, department, position,
        date_hired, risk_level, blood_type, allergies, chronic_conditions,
        emergency_contact_name, emergency_contact_phone, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, employee_id, name, date_birth || null, gender || null, department || null,
       position || null, date_hired || null, risk_level || 'bajo', blood_type || null,
       allergies || null, chronic_conditions || null,
       emergency_contact_name || null, emergency_contact_phone || null, status]
    );
    const [created] = await db.query('SELECT * FROM workers WHERE id = ?', [id]);
    res.status(201).json(created[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El número de empleado ya existe' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// PUT /api/workers/:id — actualizar
router.put('/:id', async (req, res) => {
  const allowed = [
    'name','date_birth','gender','department','position','date_hired',
    'risk_level','blood_type','allergies','chronic_conditions',
    'emergency_contact_name','emergency_contact_phone','status',
  ];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => req.body[f]);
  try {
    await db.query(`UPDATE workers SET ${sets}, updated_at = NOW() WHERE id = ?`,
      [...values, req.params.id]);
    const [rows] = await db.query('SELECT * FROM workers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Trabajador no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// DELETE /api/workers/:id — desactivar (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await db.query("UPDATE workers SET status = 'inactive', updated_at = NOW() WHERE id = ?",
      [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
