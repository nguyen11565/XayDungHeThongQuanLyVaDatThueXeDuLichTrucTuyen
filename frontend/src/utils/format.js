export function formatVND(val) {
  const n = Number(val || 0);
  return `${n.toLocaleString('vi-VN')} đ`;
}

export function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('vi-VN');
}

export function toInputDateTime(date = new Date()) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function defaultBookingDates() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 2);
  return { tuNgay: toInputDateTime(start), denNgay: toInputDateTime(end) };
}

export const CAR_STATUS = {
  AVAILABLE: { label: 'Trống (Sẵn sàng)', badge: 'badge-success' },
  RESERVED: { label: 'Đã đặt lịch', badge: 'badge-info' },
  RENTING: { label: 'Đang cho thuê', badge: 'badge-primary' },
  MAINTENANCE: { label: 'Đang bảo trì', badge: 'badge-warning' },
  INACTIVE: { label: 'Tạm ngưng', badge: 'badge-secondary' },
};

export const ORDER_STATUS = {
  PENDING: { label: 'Chờ xác nhận', badge: 'badge-warning', step: 1 },
  CONFIRMED: { label: 'Đã xác nhận', badge: 'badge-info', step: 2 },
  RENTING: { label: 'Đang thuê', badge: 'badge-primary', step: 3 },
  RETURNED: { label: 'Đã trả xe', badge: 'badge-purple', step: 4 },
  COMPLETED: { label: 'Hoàn tất', badge: 'badge-success', step: 5 },
  REJECTED: { label: 'Đã từ chối', badge: 'badge-danger', step: -1 },
  CANCELLED: { label: 'Đã huỷ', badge: 'badge-secondary', step: -1 },
};

export const PAYMENT_STATUS = {
  UNPAID: { label: 'Chưa thanh toán', badge: 'badge-warning' },
  PARTIAL: { label: 'Đã cọc / Trả 1 phần', badge: 'badge-info' },
  PAID: { label: 'Đã thanh toán đủ', badge: 'badge-success' },
  REFUNDED: { label: 'Đã hoàn tiền', badge: 'badge-purple' },
};

export const TX_STATUS = {
  PENDING: { label: 'Đang chờ xử lý', badge: 'badge-warning' },
  SUCCESS: { label: 'Thành công', badge: 'badge-success' },
  FAILED: { label: 'Thất bại', badge: 'badge-danger' },
  REFUNDED: { label: 'Hoàn tiền', badge: 'badge-purple' },
  CANCELLED: { label: 'Đã huỷ', badge: 'badge-secondary' },
};

export const FEE_TYPES = {
  LATE: 'Phí trả xe trễ',
  DAMAGE: 'Phí hư hỏng / trầy xước',
  FUEL: 'Phí bù nhiên liệu',
  CLEANING: 'Phí vệ sinh xe',
  CANCELLATION: 'Phí huỷ đơn sau xác nhận',
  OTHER: 'Phụ phí khác',
};
