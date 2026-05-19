require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('./middleware/auth');

const authRoutes       = require('./routes/auth');
const workerRoutes     = require('./routes/workers');
const evaluationRoutes = require('./routes/evaluations');
const accidentRoutes   = require('./routes/accidents');
const reportRoutes     = require('./routes/reports');
const userRoutes       = require('./routes/users');

const app = express();

// Seguridad base
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '2mb' }));

// Rate limiting global
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

// Rate limiting estricto para login
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

// Rutas públicas
app.use('/api/auth', authRoutes);

// Rutas protegidas con JWT
app.use('/api/workers',                  authMiddleware, workerRoutes);
app.use('/api',                          authMiddleware, evaluationRoutes);
app.use('/api/accidents',                authMiddleware, accidentRoutes);
app.use('/api/reports',                  authMiddleware, reportRoutes);
app.use('/api/users',                    authMiddleware, userRoutes);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// 404
app.use((_, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PREVITA OHP API corriendo en puerto ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
