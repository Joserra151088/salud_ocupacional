const router = require('express').Router();
const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

// GET /api/accidents
router.get('/', async (req, res) => {
  const { worker_id, status, limit = 50, offset = 0 } = req.query;
  try {
    let sql = `SELECT a.*, w.name AS worker_name, w.department,
                      u.name AS reported_by_name
               FROM accidents a
               LEFT JOIN workers w ON w.id = a.worker_id
               LEFT JOIN users u ON u.id = a.reported_by
               WHERE 1=1`;
    const params = [];
    if (worker_id) { sql += ' AND a.worker_id = ?'; params.push(worker_id); }
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    sql += ' ORDER BY a.date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/accidents
router.post('/', async (req, res) => {
  const {
    worker_id, date, type, description, body_part,
    days_lost, severity, investigation_notes, status = 'abierto',
  } = req.body;
  if (!worker_id || !date || !type) {
    return res.status(400).json({ error: 'Trabajador, fecha y tipo son requeridos' });
  }
  const id = uuidv4();
  try {
    await db.query(
      `INSERT INTO accidents (id, worker_id, reported_by, date, type, description,
        body_part, days_lost, severity, investigation_notes, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, worker_id, req.user.id, date, type, description||null,
       body_part||null, days_lost||0, severity||'leve',
       investigation_notes||null, status]
    );
    const [created] = await db.query(
      `SELECT a.*, w.name AS worker_name, u.name AS reported_by_name
       FROM accidents a
       LEFT JOIN workers w ON w.id = a.worker_id
       LEFT JOIN users u ON u.id = a.reported_by
       WHERE a.id = ?`,
      [id]
    );
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// PUT /api/accidents/:id
router.put('/:id', async (req, res) => {
  const allowed = ['date','type','description','body_part','days_lost',
                   'severity','investigation_notes','status'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => req.body[f]);
  try {
    await db.query(`UPDATE accidents SET ${sets}, updated_at = NOW() WHERE id = ?`,
      [...values, req.params.id]);
    const [rows] = await db.query('SELECT * FROM accidents WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
