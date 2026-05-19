const router = require('express').Router();
const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

// GET /api/workers/:workerId/evaluations
router.get('/workers/:workerId/evaluations', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, u.name AS doctor_name
       FROM evaluations e
       LEFT JOIN users u ON u.id = e.doctor_id
       WHERE e.worker_id = ?
       ORDER BY e.date DESC`,
      [req.params.workerId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/workers/:workerId/evaluations
router.post('/workers/:workerId/evaluations', async (req, res) => {
  const {
    type, date, weight, height, blood_pressure_sys, blood_pressure_dia,
    heart_rate, glucose, visual_acuity_right, visual_acuity_left,
    audiometry_right, audiometry_left, spirometry_fvc, spirometry_fev1,
    diagnosis, recommendations, restrictions, fitness_status, notes,
  } = req.body;
  if (!type || !date) {
    return res.status(400).json({ error: 'Tipo y fecha son requeridos' });
  }
  const id = uuidv4();
  try {
    await db.query(
      `INSERT INTO evaluations (
        id, worker_id, doctor_id, type, date,
        weight, height, blood_pressure_sys, blood_pressure_dia,
        heart_rate, glucose, visual_acuity_right, visual_acuity_left,
        audiometry_right, audiometry_left, spirometry_fvc, spirometry_fev1,
        diagnosis, recommendations, restrictions, fitness_status, notes
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, req.params.workerId, req.user.id, type, date,
       weight||null, height||null, blood_pressure_sys||null, blood_pressure_dia||null,
       heart_rate||null, glucose||null, visual_acuity_right||null, visual_acuity_left||null,
       audiometry_right||null, audiometry_left||null, spirometry_fvc||null, spirometry_fev1||null,
       diagnosis||null, recommendations||null, restrictions||null,
       fitness_status||'apto', notes||null]
    );
    const [created] = await db.query(
      `SELECT e.*, u.name AS doctor_name FROM evaluations e
       LEFT JOIN users u ON u.id = e.doctor_id WHERE e.id = ?`,
      [id]
    );
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/evaluations/:id
router.get('/evaluations/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, u.name AS doctor_name FROM evaluations e
       LEFT JOIN users u ON u.id = e.doctor_id WHERE e.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Evaluación no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// PUT /api/evaluations/:id
router.put('/evaluations/:id', async (req, res) => {
  const allowed = [
    'type','date','weight','height','blood_pressure_sys','blood_pressure_dia',
    'heart_rate','glucose','visual_acuity_right','visual_acuity_left',
    'audiometry_right','audiometry_left','spirometry_fvc','spirometry_fev1',
    'diagnosis','recommendations','restrictions','fitness_status','notes',
  ];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => req.body[f]);
  try {
    await db.query(`UPDATE evaluations SET ${sets}, updated_at = NOW() WHERE id = ?`,
      [...values, req.params.id]);
    const [rows] = await db.query(
      `SELECT e.*, u.name AS doctor_name FROM evaluations e
       LEFT JOIN users u ON u.id = e.doctor_id WHERE e.id = ?`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
