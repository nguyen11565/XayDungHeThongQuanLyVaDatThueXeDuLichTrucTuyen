const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { asyncHandler: h } = require('../utils/http');
const { authenticate, optionalAuth, requirePerm } = require('../middlewares/auth');

const auth = require('../controllers/auth.controller');
const car = require('../controllers/car.controller');
const order = require('../controllers/order.controller');
const pay = require('../controllers/payment.controller');
const noti = require('../controllers/notification.controller');
const contract = require('../controllers/contract.controller');
const user = require('../controllers/user.controller');
const admin = require('../controllers/admin.controller');

/* Upload ảnh xe */
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'cars');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `xe${req.params.id}_${Date.now()}_${Math.round(Math.random() * 1e4)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});

/* ---------- Xác thực ---------- */
router.post('/auth/register', h(auth.register));
router.post('/auth/login', h(auth.login));
router.get('/auth/me', authenticate, h(auth.me));
router.put('/auth/profile', authenticate, requirePerm('PROFILE_UPDATE'), h(auth.updateProfile));
router.put('/auth/password', authenticate, h(auth.changePassword));

/* ---------- Xe & loại xe (xem công khai) ---------- */
router.get('/car-types', h(car.listTypes));
router.post('/car-types', authenticate, requirePerm('CAR_MANAGE'), h(car.saveType));
router.put('/car-types/:id', authenticate, requirePerm('CAR_MANAGE'), h(car.saveType));
router.delete('/car-types/:id', authenticate, requirePerm('CAR_MANAGE'), h(car.removeType));

router.get('/cars', optionalAuth, h(car.list));
router.get('/cars/:id', optionalAuth, h(car.detail));
router.get('/cars/:id/availability', h(car.availability));
router.post('/cars', authenticate, requirePerm('CAR_MANAGE'), h(car.create));
router.put('/cars/:id', authenticate, requirePerm('CAR_MANAGE'), h(car.update));
router.patch('/cars/:id/status', authenticate, requirePerm('CAR_MANAGE'), h(car.changeStatus));
router.delete('/cars/:id', authenticate, requirePerm('CAR_MANAGE'), h(car.remove));
router.post('/cars/:id/images', authenticate, requirePerm('CAR_MANAGE'), upload.array('images', 10), h(car.addImages));
router.delete('/cars/images/:imageId', authenticate, requirePerm('CAR_MANAGE'), h(car.removeImage));

/* ---------- Đơn thuê ---------- */
router.post('/orders', authenticate, requirePerm('ORDER_CREATE'), h(order.create));
router.get('/orders', authenticate, requirePerm('ORDER_VIEW_OWN', 'ORDER_PROCESS'), h(order.list));
router.get('/orders/:id', authenticate, requirePerm('ORDER_VIEW_OWN', 'ORDER_PROCESS'), h(order.detail));
router.get('/orders/:id/check-conflict', authenticate, requirePerm('ORDER_PROCESS'), h(order.checkConflict));
router.post('/orders/:id/confirm', authenticate, requirePerm('ORDER_CONFIRM'), h(order.confirm));
router.post('/orders/:id/reject', authenticate, requirePerm('ORDER_CONFIRM'), h(order.reject));
router.post('/orders/:id/cancel', authenticate, requirePerm('ORDER_CANCEL_OWN', 'ORDER_CONFIRM'), h(order.cancel));
router.post('/orders/:id/handover', authenticate, requirePerm('CAR_HANDOVER'), h(order.handover));
router.post('/orders/:id/return', authenticate, requirePerm('CAR_RETURN'), h(order.returnCar));
router.post('/orders/:id/fees', authenticate, requirePerm('EXTRA_FEE_MANAGE'), h(order.addFee));
router.post('/orders/:id/complete', authenticate, requirePerm('PAYMENT_PROCESS'), h(order.complete));

/* ---------- Thanh toán ---------- */
router.post('/payments', authenticate, requirePerm('PAYMENT_CREATE'), h(pay.create));
router.get('/payments', authenticate, requirePerm('PAYMENT_PROCESS'), h(pay.list));
router.post('/payments/counter', authenticate, requirePerm('PAYMENT_PROCESS'), h(pay.counter));
router.get('/payments/:id', authenticate, h(pay.getOne));
router.post('/payments/:id/sandbox', authenticate, requirePerm('PAYMENT_CREATE'), h(pay.sandboxResult));
router.post('/payments/:id/verify', authenticate, requirePerm('PAYMENT_PROCESS'), h(pay.verify));

/* ---------- Thông báo ---------- */
router.get('/notifications', authenticate, requirePerm('NOTIFICATION_VIEW'), h(noti.list));
router.get('/notifications/unread-count', authenticate, h(noti.unreadCount));
router.patch('/notifications/read-all', authenticate, h(noti.markAllRead));
router.patch('/notifications/:id/read', authenticate, h(noti.markRead));
router.post('/jobs/pickup-reminder', authenticate, requirePerm('ORDER_PROCESS'), h(noti.runReminder));

/* ---------- Hợp đồng ---------- */
router.get('/contracts', authenticate, requirePerm('CONTRACT_MANAGE'), h(contract.list));
router.get('/contracts/order/:orderId', authenticate, h(contract.byOrder));
router.put('/contracts/:id', authenticate, requirePerm('CONTRACT_MANAGE'), h(contract.update));

/* ---------- Người dùng & phân quyền ---------- */
router.get('/users', authenticate, requirePerm('USER_MANAGE'), h(user.list));
router.post('/users', authenticate, requirePerm('USER_MANAGE'), h(user.create));
router.put('/users/:id', authenticate, requirePerm('USER_MANAGE'), h(user.update));
router.patch('/users/:id/status', authenticate, requirePerm('USER_MANAGE'), h(user.changeStatus));
router.patch('/users/:id/role', authenticate, requirePerm('PERMISSION_MANAGE'), h(user.changeRole));
router.get('/roles', authenticate, requirePerm('PERMISSION_MANAGE', 'USER_MANAGE'), h(user.roles));
router.put('/roles/:id/permissions', authenticate, requirePerm('PERMISSION_MANAGE'), h(user.setRolePermissions));

/* ---------- Audit, báo cáo, quy tắc phí ---------- */
router.get('/audit-logs', authenticate, requirePerm('AUDIT_VIEW'), h(admin.auditList));
router.get('/reports/summary', authenticate, requirePerm('REPORT_VIEW'), h(admin.summary));
router.get('/reports/staff-dashboard', authenticate, requirePerm('ORDER_PROCESS'), h(admin.staffDashboard));
router.get('/fee-rules', h(admin.feeRules));
router.post('/fee-rules', authenticate, requirePerm('CAR_MANAGE'), h(admin.saveFeeRule));
router.put('/fee-rules/:id', authenticate, requirePerm('CAR_MANAGE'), h(admin.saveFeeRule));

module.exports = router;
