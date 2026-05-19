const router = require('express').Router();
const db = require('../db/connection');

// GET /api/reports/dashboard — KPIs principales
router.get('/dashboard', async (req, res) => {
  try {
    const [[{ total_workers }]] = await db.query(
      "SELECT COUNT(*) AS total_workers FROM workers WHERE status = 'active'"
    );
    const [[{ evals_this_month }]] = await db.query(
      "SELECT COUNT(*) AS evals_this_month FROM evaluations WHERE MONTH(date)=MONTH(NOW()) AND YEAR(date)=YEAR(NOW())"
    );
    const [[{ accidents_this_year }]] = await db.query(
      "SELECT COUNT(*) AS accidents_this_year FROM accidents WHERE YEAR(date)=YEAR(NOW())"
    );
    const [[{ pending_followups }]] = await db.query(
      "SELECT COUNT(*) AS pending_followups FROM evaluations WHERE fitness_status='apto_con_restricciones' AND date >= DATE_SUB(NOW(), INTERVAL 3 MONTH)"
    );
    const [by_department] = await db.query(
      "SELECT department, COUNT(*) AS total FROM workers WHERE status='active' GROUP BY department ORDER BY total DESC LIMIT 10"
    );
    const [by_risk] = await db.query(
      "SELECT risk_level, COUNT(*) AS total FROM workers WHERE status='active' GROUP BY risk_level"
    );
    const [recent_accidents] = await db.query(
      `SELECT a.date, a.type, a.severity, w.name AS worker_name, w.department
       FROM accidents a JOIN workers w ON w.id = a.worker_id
       ORDER BY a.date DESC LIMIT 5`
    );
    const [eval_trend] = await db.query(
      `SELECT DATE_FORMAT(date,'%Y-%m') AS month, COUNT(*) AS total
       FROM evaluations
       WHERE date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`
    );
    res.json({
      total_workers, evals_this_month, accidents_this_year, pending_followups,
      by_department, by_risk, recent_accidents, eval_trend,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/reports/fitness — distribución de aptitud
router.get('/fitness', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT fitness_status, COUNT(*) AS total
       FROM evaluations
       WHERE date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY fitness_status`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/reports/users — admin: lista de usuarios
router.get('/users', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
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

module.exports = router;
