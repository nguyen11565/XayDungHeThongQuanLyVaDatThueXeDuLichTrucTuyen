const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: process.env.DB_INSTANCE ? undefined : Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'QuanLyThueXeDuLich',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    instanceName: process.env.DB_INSTANCE || undefined,
    // Quan trọng: DATETIME2 trong DB lưu giờ địa phương (SYSDATETIME()),
    // nên driver KHÔNG được quy đổi sang UTC.
    useUTC: false,
  },
  pool: { max: 30, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 30000,
};

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

/** Gắn tham số vào request. value có thể là giá trị thường hoặc { type, value } */
function bind(request, params = {}) {
  for (const [name, raw] of Object.entries(params)) {
    if (raw && typeof raw === 'object' && 'type' in raw && 'value' in raw) {
      request.input(name, raw.type, raw.value);
    } else if (raw instanceof Date) {
      request.input(name, sql.DateTime2(0), raw);
    } else if (typeof raw === 'boolean') {
      request.input(name, sql.Bit, raw);
    } else if (typeof raw === 'number') {
      if (Number.isInteger(raw)) request.input(name, sql.BigInt, raw);
      else request.input(name, sql.Decimal(18, 2), raw);
    } else if (raw === undefined || raw === null) {
      request.input(name, raw ?? null);
    } else {
      request.input(name, sql.NVarChar(sql.MAX), String(raw));
    }
  }
  return request;
}

async function query(text, params, tx) {
  const request = tx ? new sql.Request(tx) : (await getPool()).request();
  return bind(request, params).query(text);
}

async function exec(proc, params, tx) {
  const request = tx ? new sql.Request(tx) : (await getPool()).request();
  return bind(request, params).execute(proc);
}

/** Chạy nhiều lệnh trong 1 transaction */
async function withTransaction(fn) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    try { await tx.rollback(); } catch (_) { /* SP đã tự rollback */ }
    throw err;
  }
}

module.exports = { sql, getPool, query, exec, withTransaction };
