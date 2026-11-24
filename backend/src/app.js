const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/error');
const { getPool } = require('./config/db');

const app = express();

app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','), credentials: true }));
app.use(express.json({ limit: '2mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '7d' }));

app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query('SELECT DB_NAME() db, SYSDATETIME() now');
    res.json({ status: 'ok', database: r.recordset[0].db, serverTime: r.recordset[0].now });
  } catch (e) {
    res.status(503).json({ status: 'db_error', message: e.message });
  }
});

app.use('/api', routes);
app.use('/api', (req, res) => res.status(404).json({ message: 'API không tồn tại.' }));
app.use(errorHandler);

module.exports = app;
