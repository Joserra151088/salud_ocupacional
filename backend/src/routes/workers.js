const router = require('express').Router();
const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

function computeAge(dateStr) {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function mapWorker(row) {
  return {
    id:            row.id,
    employeeNo:    row.employee_id,
    fullName:      row.name,
    curp:          row.curp || '',
    nss:           row.nss || '',
    rfc:           row.rfc || '',
    birthDate:     row.date_birth ? row.date_birth.toISOString().slice(0, 10) : '',
    age:           computeAge(row.date_birth),
    sex:           row.gender ? row.gender.charAt(0).toUpperCase() + row.gender.slice(1) : '',
    company:       row.department || '',
    worksite:      row.work_center || '',
    jobPosition:   row.position || '',
    riskLevel:     row.risk_level,
    bloodType:     row.blood_type || '',
    allergies:     row.allergies || '',
    chronicConditions: row.chronic_conditions || '',
    emergencyName:  row.emergency_contact_name || '',
    emergencyPhone: row.emergency_contact_phone || '',
    risks:         row.risks ? (typeof row.risks === 'string' ? JSON.parse(row.risks) : row.risks) : [],
    epp:           row.epp   ? (typeof row.epp   === 'string' ? JSON.parse(row.epp)   : row.epp)   : [],
    status:        row.status,
    dateHired:     row.date_hired ? row.date_hired.toISOString().slice(0, 10) : '',
    createdAt:     row.created_at,
  };
}

// GET /api/workers — lista con búsqueda
router.get('/', async (req, res) => {
  const { q = '', status, department, limit = 100, offset = 0 } = req.query;
  try {
    let sql = `SELECT * FROM workers WHERE 1=1`;
    const params = [];
    if (q) {
      sql += ' AND (name LIKE ? OR employee_id LIKE ? OR department LIKE ? OR curp LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (department) { sql += ' AND department = ?'; params.push(department); }
    sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.query(sql, params);
    res.json(rows.map(mapWorker));
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
    res.json(mapWorker(rows[0]));
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
    curp, nss, rfc, work_center, risks, epp,
  } = req.body;
  if (!name || !employee_id) {
    return res.status(400).json({ error: 'Nombre y número de empleado son requeridos' });
  }
  const id = uuidv4();
  try {
    await db.query(
      `INSERT INTO workers (id, employee_id, name, curp, nss, rfc, date_birth, gender,
        department, work_center, position, date_hired, risk_level, blood_type,
        allergies, chronic_conditions, emergency_contact_name, emergency_contact_phone,
        status, risks, epp)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, employee_id, name, curp||null, nss||null, rfc||null,
       date_birth||null, gender||null, department||null, work_center||null,
       position||null, date_hired||null, risk_level||'bajo', blood_type||null,
       allergies||null, chronic_conditions||null,
       emergency_contact_name||null, emergency_contact_phone||null, status,
       risks ? JSON.stringify(risks) : null,
       epp   ? JSON.stringify(epp)   : null]
    );
    const [created] = await db.query('SELECT * FROM workers WHERE id = ?', [id]);
    res.status(201).json(mapWorker(created[0]));
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
    'name','curp','nss','rfc','date_birth','gender','department','work_center',
    'position','date_hired','risk_level','blood_type','allergies','chronic_conditions',
    'emergency_contact_name','emergency_contact_phone','status','risks','epp',
  ];
  const jsonFields = ['risks', 'epp'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => jsonFields.includes(f) ? JSON.stringify(req.body[f]) : req.body[f]);
  try {
    await db.query(`UPDATE workers SET ${sets}, updated_at = NOW() WHERE id = ?`,
      [...values, req.params.id]);
    const [rows] = await db.query('SELECT * FROM workers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Trabajador no encontrado' });
    res.json(mapWorker(rows[0]));
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
