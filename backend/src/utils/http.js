class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Chuyển chuỗi 'YYYY-MM-DDTHH:mm' (giờ địa phương) thành Date, báo lỗi nếu sai */
function toDate(value, fieldName) {
  if (!value) throw new AppError(400, `Thiếu ${fieldName}.`);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AppError(400, `${fieldName} không hợp lệ.`);
  d.setSeconds(0, 0);
  return d;
}

function toNumber(value, fieldName, { min, integer = false, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new AppError(400, `Thiếu ${fieldName}.`);
    return null;
  }
  const n = Number(value);
  if (Number.isNaN(n)) throw new AppError(400, `${fieldName} phải là số.`);
  if (integer && !Number.isInteger(n)) throw new AppError(400, `${fieldName} phải là số nguyên.`);
  if (min !== undefined && n < min) throw new AppError(400, `${fieldName} phải >= ${min}.`);
  return n;
}

function requireText(value, fieldName, max = 1000) {
  const s = (value ?? '').toString().trim();
  if (!s) throw new AppError(400, `Thiếu ${fieldName}.`);
  if (s.length > max) throw new AppError(400, `${fieldName} tối đa ${max} ký tự.`);
  return s;
}

const optText = (v) => {
  const s = (v ?? '').toString().trim();
  return s ? s : null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^0\d{9,10}$/;

module.exports = { AppError, asyncHandler, toDate, toNumber, requireText, optText, EMAIL_RE, PHONE_RE };
