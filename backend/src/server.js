require('dotenv').config();
const app = require('./app');
const { getPool, exec } = require('./config/db');

const PORT = Number(process.env.PORT || 5000);

/** Job nhắc lịch nhận xe trong 24h tới (sự kiện "sắp nhận xe") */
async function pickupReminderJob() {
  try {
    const r = await exec('sp_TaoThongBaoSapNhanXe');
    const n = r.recordset?.[0]?.SoThongBao || 0;
    if (n) console.log(`[JOB] Đã tạo ${n} thông báo nhắc lịch nhận xe.`);
  } catch (e) {
    console.error('[JOB] Lỗi nhắc lịch:', e.message);
  }
}

app.listen(PORT, async () => {
  console.log(`API đang chạy tại http://localhost:${PORT}/api`);
  try {
    await getPool();
    console.log(`Đã kết nối SQL Server: ${process.env.DB_SERVER}${process.env.DB_INSTANCE ? '\\' + process.env.DB_INSTANCE : ''} / ${process.env.DB_NAME}`);
    pickupReminderJob();
    setInterval(pickupReminderJob, 10 * 60 * 1000);
  } catch (e) {
    console.error('Không kết nối được SQL Server:', e.message);
    console.error('=> Kiểm tra file backend/.env (DB_SERVER, DB_USER, DB_PASSWORD, DB_INSTANCE/DB_PORT)');
  }
});
