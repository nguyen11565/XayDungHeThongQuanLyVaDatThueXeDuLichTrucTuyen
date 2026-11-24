/* ============================================================================
   03_TestNghiepVu.sql - Kiểm thử Nghiệp vụ (TC01 -> TC25)
   (Có thể chạy tự động qua API bằng lệnh: cd backend && npm run test:business)
   ============================================================================ */
USE QuanLyThueXeDuLich;
GO

/* TC01 - Ngày trả <= ngày nhận: Từ chối tạo đơn (Lỗi 52101) */
-- EXEC sp_TaoDonThue 3, 1, '2026-12-10 10:00', '2026-12-10 09:00', NULL;

/* TC02 - Ngày nhận ở quá khứ: Từ chối tạo đơn (Lỗi 52107) */
-- EXEC sp_TaoDonThue 3, 1, '2025-01-01 08:00', '2025-01-02 08:00', NULL;

/* TC03 - Đặt xe đang bảo trì (MAINTENANCE, MaXe = 4 - Honda City): Từ chối tạo đơn (Lỗi 52105) */
-- EXEC sp_TaoDonThue 3, 4, '2026-12-10 08:00', '2026-12-11 08:00', NULL;

/* TC04 - Tạo đơn hợp lệ 3 ngày & Snapshot giá/cọc (Vios 900.000đ/ngày x 3 ngày = 2.700.000đ, cọc 2.000.000đ) */
-- EXEC sp_TaoDonThue 3, 1, '2026-12-10 08:00', '2026-12-13 08:00', N'Đơn kiểm thử TC04';

/* TC05 - Kiểm tra trùng lịch với đơn PENDING (Lớp 1 - fn_XeCoTheDat / API availability): Trả về khaDung = 0 */
-- SELECT dbo.fn_XeCoTheDat(1, '2026-12-11 08:00', '2026-12-12 08:00', NULL) AS KhaDung;

/* TC06 - Khách 2 cố tình đặt chồng lấn / bao trùm khung giờ của Đơn #6 (PENDING): Từ chối (Lỗi 52106) */
-- EXEC sp_TaoDonThue 4, 1, '2026-12-11 08:00', '2026-12-14 08:00', N'Khách 2 đặt chồng lịch';

/* TC07 - Đặt nối tiếp sát biên [A,B) và [B,C) sau thời gian đệm: Thành công (PENDING) */
-- EXEC sp_TaoDonThue 4, 1, '2026-12-13 10:00', '2026-12-14 10:00', N'Khách 2 đặt nối tiếp';

/* TC08 - Đặt xe đồng thời (Race Condition 10 luồng):
   sp_getapplock kết hợp UPDLOCK, HOLDLOCK tuần tự hóa: chỉ đúng 1 luồng thành công, 9 luồng báo lỗi 52106. */
-- Cửa sổ A: EXEC sp_TaoDonThue 3, 2, '2026-12-20 08:00', '2026-12-22 08:00', N'Luồng A';
-- Cửa sổ B: EXEC sp_TaoDonThue 4, 2, '2026-12-20 08:00', '2026-12-22 08:00', N'Luồng B';

/* TC09 - Phân quyền RBAC: Khách hàng tự gọi xác nhận đơn -> Chặn HTTP 403 (Thiếu quyền ORDER_CONFIRM) */
/* TC10 - Phân quyền RBAC: Khách 2 xem / hủy đơn của Khách 1 -> Chặn HTTP 403 (Lỗi 52402) */
-- EXEC sp_HuyDon @MaDonThue = 6, @MaNguoiThucHien = 4, @LaNhanVien = 0, @LyDoHuy = N'Hủy trái phép';

/* TC11 - Phân quyền RBAC: Nhân viên truy cập Audit Log của Admin -> Chặn HTTP 403 (Thiếu quyền AUDIT_VIEW) */

/* TC12 - Nhân viên xác nhận đơn & tự động sinh Hợp đồng DRAFT (Đơn -> CONFIRMED, Xe -> RESERVED, HĐ -> DRAFT) */
-- EXEC sp_XacNhanDon @MaDonThue = 6, @MaNhanVien = 2;

/* TC13 - Chặn giao xe khi khách chưa đặt cọc (TrangThaiThanhToan = UNPAID): Từ chối (Lỗi 52503) */
-- EXEC sp_GiaoXe @MaDonThue = 6, @MaNhanVien = 2, @ThoiGianGiao = '2026-12-10 08:00', @SoKm = 12000, @MucNhienLieu = 100, @TinhTrangXe = N'Tốt', @GhiChu = NULL;

/* TC14 - Thanh toán tiền cọc Sandbox THẤT BẠI (FAILED): Giao dịch lưu FAILED, đơn giữ nguyên UNPAID, phát thông báo PAYMENT_FAILED */
-- EXEC sp_TaoGiaoDichThanhToan @MaDonThue = 6, @MaNguoiDung = 3, @LoaiThanhToan = 'DEPOSIT', @PhuongThuc = 'SANDBOX';
-- EXEC sp_XuLyKetQuaThanhToan @MaThanhToan = 10, @KetQua = 'FAILED', @MaNguoiXuLy = 3, @LaNhanVien = 0;

/* TC15 - Thanh toán tiền cọc Sandbox THÀNH CÔNG (SUCCESS 2.000.000đ): Đơn chuyển sang PARTIAL (2,0tr / 2,7tr) */
-- EXEC sp_TaoGiaoDichThanhToan @MaDonThue = 6, @MaNguoiDung = 3, @LoaiThanhToan = 'DEPOSIT', @PhuongThuc = 'SANDBOX';
-- EXEC sp_XuLyKetQuaThanhToan @MaThanhToan = 11, @KetQua = 'SUCCESS', @MaNguoiXuLy = 3, @LaNhanVien = 0;

/* TC16 - Chống thanh toán lặp (Duplicate Callback): Gọi lại sp_XuLyKetQuaThanhToan lần 2 cho GD đã SUCCESS -> Từ chối (Lỗi 52813) */
-- EXEC sp_XuLyKetQuaThanhToan @MaThanhToan = 11, @KetQua = 'SUCCESS', @MaNguoiXuLy = 3, @LaNhanVien = 0;

/* TC17 - Bàn giao xe hợp lệ sau khi đã đủ cọc (Lưu PhieuGiaoXe, Đơn -> RENTING, Xe -> RENTING, Hợp đồng -> ACTIVE) */
-- EXEC sp_GiaoXe @MaDonThue = 6, @MaNhanVien = 2, @ThoiGianGiao = '2026-12-10 08:00', @SoKm = 12000, @MucNhienLieu = 100, @TinhTrangXe = N'Xe tốt, đủ nhiên liệu', @GhiChu = NULL;

/* TC18 - Chặn hủy đơn khi đang thuê (RENTING): Từ chối hủy đơn (Lỗi 52401) */
-- EXEC sp_HuyDon @MaDonThue = 6, @MaNguoiThucHien = 3, @LaNhanVien = 0, @LyDoHuy = N'Muốn hủy khi đang thuê';

/* TC19 - Chặn hoàn tất đơn khi chưa trả xe (đơn vẫn đang RENTING): Từ chối hoàn tất (Lỗi 52901) */
-- EXEC sp_HoanTatDon @MaDonThue = 6, @MaNhanVien = 2;

/* TC20 - Trả xe trễ 3 giờ 10 phút (190 phút -> CEILING(190/60) = 4 giờ x 50.000 = 200.000đ) + Phụ phí vệ sinh 200.000đ
   -> TongPhiPhatSinh = 400.000đ, TongTienPhaiTra = 3.100.000đ, Đơn -> RETURNED, Xe -> AVAILABLE */
-- EXEC sp_NhanTraXe @MaDonThue = 6, @MaNhanVien = 2, @ThoiGianTra = '2026-12-13 11:10', @SoKm = 12450, @MucNhienLieu = 80, @TinhTrangXe = N'Bình thường, cần vệ sinh', @CanBaoTri = 0, @GhiChu = NULL;
-- EXEC sp_ThemPhiPhatSinh @MaDonThue = 6, @MaQuyTac = 3, @LoaiPhi = 'CLEANING', @TenKhoanPhi = N'Phụ phí vệ sinh nội thất', @SoLuong = 1, @DonGia = 200000, @GhiChu = NULL, @MaNhanVien = 2;

/* TC21 - Chặn hoàn tất khi còn nợ phí phát sinh (mới trả 2.000.000đ / 3.100.000đ - PARTIAL): Từ chối (Lỗi 52902) */
-- EXEC sp_HoanTatDon @MaDonThue = 6, @MaNhanVien = 2;

/* TC22 - Chặn thu tiền vượt quá số còn nợ (nhập thu 1.101.000đ > số còn nợ 1.100.000đ): Từ chối (Lỗi 52905) */
-- EXEC sp_GhiNhanThanhToan @MaDonThue = 6, @SoTien = 1101000, @LoaiThanhToan = 'FULL', @PhuongThuc = 'CASH', @TrangThai = 'SUCCESS', @MaGiaoDich = 'CASH-OVER', @MaNhanVienXacNhan = 2, @GhiChu = NULL;

/* TC23 - Tất toán số còn lại (1.100.000đ -> PAID) & Hoàn tất đơn thuê (Đơn -> COMPLETED, Hợp đồng -> COMPLETED, đủ vết AuditLog) */
-- EXEC sp_GhiNhanThanhToan @MaDonThue = 6, @SoTien = 1100000, @LoaiThanhToan = 'FULL', @PhuongThuc = 'CASH', @TrangThai = 'SUCCESS', @MaGiaoDich = 'CASH-FINAL-6', @MaNhanVienXacNhan = 2, @GhiChu = N'Tất toán đơn #6';
-- EXEC sp_HoanTatDon @MaDonThue = 6, @MaNhanVien = 2;

/* TC24 - Hủy đơn SAU KHI ĐÃ XÁC NHẬN & ĐẶT CỌC (Đơn xe Accent 800k/ngày x 3 ngày = 2.400.000đ, đã cọc 1.500.000đ):
   -> Khấu trừ phí hủy 10% (240.000đ) vào PhiPhatSinh, tự động tạo GD REFUND hoàn lại 1.260.000đ, Đơn -> CANCELLED/REFUNDED, HĐ -> CANCELLED */
-- EXEC sp_HuyDon @MaDonThue = 9, @MaNguoiThucHien = 3, @LaNhanVien = 0, @LyDoHuy = N'Thay đổi lịch trình cá nhân';

/* TC25 - Chặn ngưng xe đang có đơn hiệu lực (Trigger TR_Xe_KhongNgungKhiCoDonHieuLuc) & chặn đăng nhập tài khoản LOCKED */
-- UPDATE Xe SET TrangThai = 'INACTIVE' WHERE MaXe = 1;

/* Truy vấn đối chiếu thống kê & nhật ký kiểm toán */
SELECT * FROM vw_ThongKeDonTheoTrangThai;
SELECT * FROM vw_ThongKeDoanhThuTheoNgay;
SELECT * FROM vw_ThongKeHieuSuatXe;
SELECT TOP 50 * FROM AuditLog ORDER BY ThoiGian DESC;
SELECT TOP 50 * FROM ThongBao ORDER BY ThoiGianTao DESC;
GO
