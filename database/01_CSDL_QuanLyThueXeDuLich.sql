/* ================================================================
   ĐỀ TÀI: XÂY DỰNG HỆ THỐNG QUẢN LÝ VÀ ĐẶT THUÊ XE DU LỊCH TRỰC TUYẾN
   Hệ quản trị: Microsoft SQL Server
   Frontend: ReactJS  |  Backend: Node.js / ExpressJS

   01_CSDL_QuanLyThueXeDuLich.sql  (bản đã rà soát & sửa lỗi)
   ---------------------------------------------------------------
   Thay đổi so với bản gốc (xem README mục "Nhận xét file SQL"):
   1. Mọi SP đều kiểm tra đơn KHÔNG TỒN TẠI (bản gốc so sánh NULL<>'PENDING'
      => UNKNOWN nên lọt qua kiểm tra, ghi AuditLog/ThongBao rác hoặc lỗi FK).
   2. sp_XacNhanDon lấy applock TRƯỚC khi khoá dòng (cùng thứ tự với
      sp_TaoDonThue) để tránh deadlock khi đặt + xác nhận đồng thời.
   3. Trạng thái xe được đồng bộ bằng sp_DongBoTrangThaiXe: trả xe khi còn
      đơn CONFIRMED khác -> RESERVED (bản gốc luôn set AVAILABLE).
   4. Không cho đặt ngày nhận ở quá khứ; tiền cọc = MIN(cọc xe, tiền thuê).
   5. Giao xe yêu cầu đã thanh toán đủ tiền cọc, xe không bảo trì.
      Trả xe: thời gian trả >= thời gian giao, số km trả >= số km giao.
   6. Hợp đồng: tự tạo DRAFT khi xác nhận, ACTIVE khi giao xe,
      COMPLETED khi hoàn tất, CANCELLED khi huỷ.
   7. Huỷ sau xác nhận: phí huỷ theo QuyTacPhi CANCELLATION (khấu trừ vào số
      đã thanh toán), tự động hoàn tiền phần còn lại. Từ chối đơn: hoàn 100%.
   8. Thanh toán: tạo giao dịch PENDING -> cổng sandbox trả SUCCESS/FAILED;
      không cho trả vượt số còn nợ; ghi AuditLog cho mọi thao tác tiền.
   9. Bổ sung quyền PROFILE_UPDATE, NOTIFICATION_VIEW cho nhân viên.
   ================================================================ */
SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF DB_ID(N'QuanLyThueXeDuLich') IS NULL
    EXEC(N'CREATE DATABASE QuanLyThueXeDuLich');
GO
USE QuanLyThueXeDuLich;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ==================== PHÂN QUYỀN ==================== */
CREATE TABLE VaiTro (
    MaVaiTro INT IDENTITY(1,1) PRIMARY KEY,
    TenVaiTro VARCHAR(30) NOT NULL UNIQUE,
    MoTa NVARCHAR(255) NULL,
    TrangThai BIT NOT NULL CONSTRAINT DF_VaiTro_TrangThai DEFAULT 1
);
GO

CREATE TABLE Quyen (
    MaQuyen INT IDENTITY(1,1) PRIMARY KEY,
    TenQuyen VARCHAR(80) NOT NULL UNIQUE,
    MoTa NVARCHAR(255) NULL,
    TrangThai BIT NOT NULL CONSTRAINT DF_Quyen_TrangThai DEFAULT 1
);
GO

CREATE TABLE VaiTroQuyen (
    MaVaiTro INT NOT NULL,
    MaQuyen INT NOT NULL,
    CONSTRAINT PK_VaiTroQuyen PRIMARY KEY (MaVaiTro, MaQuyen),
    CONSTRAINT FK_VaiTroQuyen_VaiTro FOREIGN KEY (MaVaiTro) REFERENCES VaiTro(MaVaiTro),
    CONSTRAINT FK_VaiTroQuyen_Quyen FOREIGN KEY (MaQuyen) REFERENCES Quyen(MaQuyen)
);
GO

/* ==================== NGƯỜI DÙNG ==================== */
CREATE TABLE NguoiDung (
    MaNguoiDung INT IDENTITY(1,1) PRIMARY KEY,
    MaVaiTro INT NOT NULL,
    HoTen NVARCHAR(100) NOT NULL,
    Email VARCHAR(150) NOT NULL,
    SoDienThoai VARCHAR(20) NULL,
    MatKhau VARCHAR(255) NOT NULL,
    DiaChi NVARCHAR(255) NULL,
    TrangThai VARCHAR(20) NOT NULL CONSTRAINT DF_NguoiDung_TrangThai DEFAULT 'ACTIVE',
    NgayTao DATETIME2(0) NOT NULL CONSTRAINT DF_NguoiDung_NgayTao DEFAULT SYSDATETIME(),
    NgayCapNhat DATETIME2(0) NULL,
    CONSTRAINT UQ_NguoiDung_Email UNIQUE (Email),
    CONSTRAINT FK_NguoiDung_VaiTro FOREIGN KEY (MaVaiTro) REFERENCES VaiTro(MaVaiTro),
    CONSTRAINT CK_NguoiDung_TrangThai CHECK (TrangThai IN ('ACTIVE','LOCKED','INACTIVE'))
);
GO
CREATE UNIQUE INDEX UX_NguoiDung_SoDienThoai ON NguoiDung(SoDienThoai) WHERE SoDienThoai IS NOT NULL;
GO

/* ==================== LOẠI XE / XE / HÌNH ẢNH ==================== */
CREATE TABLE LoaiXe (
    MaLoaiXe INT IDENTITY(1,1) PRIMARY KEY,
    TenLoai NVARCHAR(100) NOT NULL UNIQUE,
    SoCho INT NOT NULL,
    MoTa NVARCHAR(500) NULL,
    TrangThai BIT NOT NULL CONSTRAINT DF_LoaiXe_TrangThai DEFAULT 1,
    CONSTRAINT CK_LoaiXe_SoCho CHECK (SoCho > 0)
);
GO

CREATE TABLE Xe (
    MaXe INT IDENTITY(1,1) PRIMARY KEY,
    MaLoaiXe INT NOT NULL,
    BienSo VARCHAR(20) NOT NULL UNIQUE,
    TenXe NVARCHAR(120) NOT NULL,
    HangXe NVARCHAR(80) NULL,
    NamSanXuat SMALLINT NULL,
    GiaThueNgay DECIMAL(18,2) NOT NULL,
    TienCoc DECIMAL(18,2) NOT NULL CONSTRAINT DF_Xe_TienCoc DEFAULT 0,
    TrangThai VARCHAR(20) NOT NULL CONSTRAINT DF_Xe_TrangThai DEFAULT 'AVAILABLE',
    MoTa NVARCHAR(1000) NULL,
    NgayTao DATETIME2(0) NOT NULL CONSTRAINT DF_Xe_NgayTao DEFAULT SYSDATETIME(),
    NgayCapNhat DATETIME2(0) NULL,
    CONSTRAINT FK_Xe_LoaiXe FOREIGN KEY (MaLoaiXe) REFERENCES LoaiXe(MaLoaiXe),
    CONSTRAINT CK_Xe_Gia CHECK (GiaThueNgay > 0 AND TienCoc >= 0),
    CONSTRAINT CK_Xe_Nam CHECK (NamSanXuat IS NULL OR NamSanXuat BETWEEN 1990 AND 2100),
    CONSTRAINT CK_Xe_TrangThai CHECK (TrangThai IN ('AVAILABLE','RESERVED','RENTING','MAINTENANCE','INACTIVE'))
);
GO

CREATE TABLE HinhAnhXe (
    MaHinhAnh INT IDENTITY(1,1) PRIMARY KEY,
    MaXe INT NOT NULL,
    DuongDan NVARCHAR(500) NOT NULL,
    MoTa NVARCHAR(255) NULL,
    ThuTu INT NOT NULL CONSTRAINT DF_HinhAnhXe_ThuTu DEFAULT 1,
    CONSTRAINT FK_HinhAnhXe_Xe FOREIGN KEY (MaXe) REFERENCES Xe(MaXe) ON DELETE CASCADE,
    CONSTRAINT CK_HinhAnhXe_ThuTu CHECK (ThuTu > 0)
);
GO

/* ==================== ĐƠN THUÊ ==================== */
CREATE TABLE DonThue (
    MaDonThue BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaKhachHang INT NOT NULL,
    MaXe INT NOT NULL,
    MaNhanVienXacNhan INT NULL,
    NgayGioNhan DATETIME2(0) NOT NULL,
    NgayGioTra DATETIME2(0) NOT NULL,
    NgayTao DATETIME2(0) NOT NULL CONSTRAINT DF_DonThue_NgayTao DEFAULT SYSDATETIME(),
    ThoiGianXacNhan DATETIME2(0) NULL,
    SoNgayThue INT NOT NULL CONSTRAINT DF_DonThue_SoNgay DEFAULT 1,
    DonGiaNgay DECIMAL(18,2) NOT NULL CONSTRAINT DF_DonThue_DonGia DEFAULT 0,
    TongTienDuKien DECIMAL(18,2) NOT NULL,
    TienCoc DECIMAL(18,2) NOT NULL CONSTRAINT DF_DonThue_TienCoc DEFAULT 0,
    TongPhiPhatSinh DECIMAL(18,2) NOT NULL CONSTRAINT DF_DonThue_TongPhi DEFAULT 0,
    TongTienPhaiTra AS CAST(TongTienDuKien + TongPhiPhatSinh AS DECIMAL(18,2)) PERSISTED,
    TrangThai VARCHAR(20) NOT NULL CONSTRAINT DF_DonThue_TrangThai DEFAULT 'PENDING',
    TrangThaiThanhToan VARCHAR(20) NOT NULL CONSTRAINT DF_DonThue_TTTT DEFAULT 'UNPAID',
    LyDoTuChoi NVARCHAR(500) NULL,
    LyDoHuy NVARCHAR(500) NULL,
    MaNguoiHuy INT NULL,
    ThoiGianHuy DATETIME2(0) NULL,
    GhiChu NVARCHAR(1000) NULL,
    CONSTRAINT FK_DonThue_KhachHang FOREIGN KEY (MaKhachHang) REFERENCES NguoiDung(MaNguoiDung),
    CONSTRAINT FK_DonThue_Xe FOREIGN KEY (MaXe) REFERENCES Xe(MaXe),
    CONSTRAINT FK_DonThue_NhanVien FOREIGN KEY (MaNhanVienXacNhan) REFERENCES NguoiDung(MaNguoiDung),
    CONSTRAINT FK_DonThue_NguoiHuy FOREIGN KEY (MaNguoiHuy) REFERENCES NguoiDung(MaNguoiDung),
    CONSTRAINT CK_DonThue_ThoiGian CHECK (NgayGioTra > NgayGioNhan),
    CONSTRAINT CK_DonThue_Tien CHECK (TongTienDuKien >= 0 AND TienCoc >= 0 AND TongPhiPhatSinh >= 0),
    CONSTRAINT CK_DonThue_TrangThai CHECK (TrangThai IN ('PENDING','CONFIRMED','REJECTED','RENTING','RETURNED','COMPLETED','CANCELLED')),
    CONSTRAINT CK_DonThue_TTTT CHECK (TrangThaiThanhToan IN ('UNPAID','PARTIAL','PAID','REFUNDED'))
);
GO
CREATE INDEX IX_DonThue_Xe_ThoiGian_TrangThai ON DonThue(MaXe, NgayGioNhan, NgayGioTra, TrangThai);
CREATE INDEX IX_DonThue_KhachHang_NgayTao ON DonThue(MaKhachHang, NgayTao DESC);
GO

/* ==================== HỢP ĐỒNG ==================== */
CREATE TABLE HopDong (
    MaHopDong BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaDonThue BIGINT NOT NULL UNIQUE,
    SoHopDong VARCHAR(50) NOT NULL UNIQUE,
    MaNhanVienLap INT NULL,
    NgayLap DATETIME2(0) NOT NULL CONSTRAINT DF_HopDong_NgayLap DEFAULT SYSDATETIME(),
    NoiDung NVARCHAR(MAX) NOT NULL,
    TrangThai VARCHAR(20) NOT NULL CONSTRAINT DF_HopDong_TrangThai DEFAULT 'DRAFT',
    NgayCapNhat DATETIME2(0) NULL,
    CONSTRAINT FK_HopDong_DonThue FOREIGN KEY (MaDonThue) REFERENCES DonThue(MaDonThue),
    CONSTRAINT FK_HopDong_NhanVien FOREIGN KEY (MaNhanVienLap) REFERENCES NguoiDung(MaNguoiDung),
    CONSTRAINT CK_HopDong_TrangThai CHECK (TrangThai IN ('DRAFT','ACTIVE','COMPLETED','CANCELLED'))
);
GO

/* ==================== PHIẾU GIAO XE ==================== */
CREATE TABLE PhieuGiaoXe (
    MaPhieuGiao BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaDonThue BIGINT NOT NULL UNIQUE,
    MaNhanVien INT NOT NULL,
    ThoiGianGiao DATETIME2(0) NOT NULL,
    SoKm DECIMAL(12,1) NOT NULL,
    MucNhienLieu TINYINT NULL,
    TinhTrangXe NVARCHAR(1000) NOT NULL,
    GhiChu NVARCHAR(1000) NULL,
    NgayTao DATETIME2(0) NOT NULL CONSTRAINT DF_PhieuGiao_NgayTao DEFAULT SYSDATETIME(),
    CONSTRAINT FK_PhieuGiao_Don FOREIGN KEY (MaDonThue) REFERENCES DonThue(MaDonThue),
    CONSTRAINT FK_PhieuGiao_NV FOREIGN KEY (MaNhanVien) REFERENCES NguoiDung(MaNguoiDung),
    CONSTRAINT CK_PhieuGiao_SoKm CHECK (SoKm >= 0),
    CONSTRAINT CK_PhieuGiao_NhienLieu CHECK (MucNhienLieu IS NULL OR MucNhienLieu BETWEEN 0 AND 100)
);
GO

/* ==================== PHIẾU TRẢ XE ==================== */
CREATE TABLE PhieuTraXe (
    MaPhieuTra BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaDonThue BIGINT NOT NULL UNIQUE,
    MaNhanVien INT NOT NULL,
    ThoiGianTra DATETIME2(0) NOT NULL,
    SoKm DECIMAL(12,1) NOT NULL,
    MucNhienLieu TINYINT NULL,
    TinhTrangXe NVARCHAR(1000) NOT NULL,
    CanBaoTri BIT NOT NULL CONSTRAINT DF_PhieuTra_CanBaoTri DEFAULT 0,
    GhiChu NVARCHAR(1000) NULL,
    NgayTao DATETIME2(0) NOT NULL CONSTRAINT DF_PhieuTra_NgayTao DEFAULT SYSDATETIME(),
    CONSTRAINT FK_PhieuTra_Don FOREIGN KEY (MaDonThue) REFERENCES DonThue(MaDonThue),
    CONSTRAINT FK_PhieuTra_NV FOREIGN KEY (MaNhanVien) REFERENCES NguoiDung(MaNguoiDung),
    CONSTRAINT CK_PhieuTra_SoKm CHECK (SoKm >= 0),
    CONSTRAINT CK_PhieuTra_NhienLieu CHECK (MucNhienLieu IS NULL OR MucNhienLieu BETWEEN 0 AND 100)
);
GO

/* ==================== QUY TẮC PHÍ ==================== */
CREATE TABLE QuyTacPhi (
    MaQuyTac INT IDENTITY(1,1) PRIMARY KEY,
    LoaiPhi VARCHAR(30) NOT NULL,
    TenQuyTac NVARCHAR(150) NOT NULL,
    KieuTinh VARCHAR(20) NOT NULL,
    GiaTri DECIMAL(18,2) NOT NULL,
    TrangThai BIT NOT NULL CONSTRAINT DF_QuyTacPhi_TrangThai DEFAULT 1,
    GhiChu NVARCHAR(500) NULL,
    CONSTRAINT CK_QuyTacPhi_Loai CHECK (LoaiPhi IN ('LATE','DAMAGE','FUEL','CLEANING','CANCELLATION','OTHER')),
    CONSTRAINT CK_QuyTacPhi_Kieu CHECK (KieuTinh IN ('FIXED','PER_HOUR','PERCENT')),
    CONSTRAINT CK_QuyTacPhi_GiaTri CHECK (GiaTri >= 0)
);
GO

/* ==================== PHÍ PHÁT SINH ==================== */
CREATE TABLE PhiPhatSinh (
    MaPhi BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaPhieuTra BIGINT NULL,
    MaDonThue BIGINT NOT NULL,
    MaNhanVienTao INT NULL,
    LoaiPhi VARCHAR(30) NOT NULL,
    SoTien DECIMAL(18,2) NOT NULL,
    LyDo NVARCHAR(1000) NOT NULL,
    ThoiGianTao DATETIME2(0) NOT NULL CONSTRAINT DF_Phi_ThoiGian DEFAULT SYSDATETIME(),
    CONSTRAINT FK_Phi_PhieuTra FOREIGN KEY (MaPhieuTra) REFERENCES PhieuTraXe(MaPhieuTra),
    CONSTRAINT FK_Phi_Don FOREIGN KEY (MaDonThue) REFERENCES DonThue(MaDonThue),
    CONSTRAINT FK_Phi_NV FOREIGN KEY (MaNhanVienTao) REFERENCES NguoiDung(MaNguoiDung),
    CONSTRAINT CK_Phi_Loai CHECK (LoaiPhi IN ('LATE','DAMAGE','FUEL','CLEANING','CANCELLATION','OTHER')),
    CONSTRAINT CK_Phi_SoTien CHECK (SoTien >= 0)
);
GO
CREATE INDEX IX_Phi_Don ON PhiPhatSinh(MaDonThue);
GO

/* ==================== THANH TOÁN ==================== */
CREATE TABLE ThanhToan (
    MaThanhToan BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaDonThue BIGINT NOT NULL,
    MaNhanVienXacNhan INT NULL,
    SoTien DECIMAL(18,2) NOT NULL,
    LoaiThanhToan VARCHAR(20) NOT NULL,
    PhuongThuc VARCHAR(20) NOT NULL,
    TrangThai VARCHAR(20) NOT NULL CONSTRAINT DF_ThanhToan_TrangThai DEFAULT 'PENDING',
    MaGiaoDich VARCHAR(100) NULL,
    ThoiGianTao DATETIME2(0) NOT NULL CONSTRAINT DF_ThanhToan_ThoiGianTao DEFAULT SYSDATETIME(),
    ThoiGianXuLy DATETIME2(0) NULL,
    GhiChu NVARCHAR(500) NULL,
    CONSTRAINT FK_ThanhToan_Don FOREIGN KEY (MaDonThue) REFERENCES DonThue(MaDonThue),
    CONSTRAINT FK_ThanhToan_NV FOREIGN KEY (MaNhanVienXacNhan) REFERENCES NguoiDung(MaNguoiDung),
    CONSTRAINT CK_ThanhToan_SoTien CHECK (SoTien > 0),
    CONSTRAINT CK_ThanhToan_Loai CHECK (LoaiThanhToan IN ('DEPOSIT','RENTAL','EXTRA_FEE','FULL','REFUND')),
    CONSTRAINT CK_ThanhToan_PhuongThuc CHECK (PhuongThuc IN ('CASH','BANK_TRANSFER','SANDBOX')),
    CONSTRAINT CK_ThanhToan_TrangThai CHECK (TrangThai IN ('PENDING','SUCCESS','FAILED','REFUNDED','CANCELLED'))
);
GO
CREATE UNIQUE INDEX UX_ThanhToan_MaGiaoDich ON ThanhToan(MaGiaoDich) WHERE MaGiaoDich IS NOT NULL;
CREATE INDEX IX_ThanhToan_Don_TrangThai ON ThanhToan(MaDonThue, TrangThai);
GO

/* ==================== THÔNG BÁO ==================== */
CREATE TABLE ThongBao (
    MaThongBao BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaNguoiDung INT NOT NULL,
    MaDonThue BIGINT NULL,
    TieuDe NVARCHAR(200) NOT NULL,
    NoiDung NVARCHAR(1000) NOT NULL,
    LoaiThongBao VARCHAR(40) NOT NULL,
    DaDoc BIT NOT NULL CONSTRAINT DF_ThongBao_DaDoc DEFAULT 0,
    ThoiGianTao DATETIME2(0) NOT NULL CONSTRAINT DF_ThongBao_ThoiGian DEFAULT SYSDATETIME(),
    CONSTRAINT FK_ThongBao_NguoiDung FOREIGN KEY (MaNguoiDung) REFERENCES NguoiDung(MaNguoiDung),
    CONSTRAINT FK_ThongBao_Don FOREIGN KEY (MaDonThue) REFERENCES DonThue(MaDonThue),
    CONSTRAINT CK_ThongBao_Loai CHECK (LoaiThongBao IN ('ORDER_CREATED','ORDER_CONFIRMED','ORDER_REJECTED','ORDER_CANCELLED','PAYMENT_SUCCESS','PAYMENT_FAILED','PAYMENT_REFUNDED','PICKUP_REMINDER','CAR_HANDED_OVER','CAR_RETURNED','EXTRA_FEE','ORDER_COMPLETED','OTHER'))
);
GO
CREATE INDEX IX_ThongBao_NguoiDung ON ThongBao(MaNguoiDung, DaDoc, ThoiGianTao DESC);
GO

/* ==================== AUDIT LOG ==================== */
CREATE TABLE AuditLog (
    MaLog BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaNguoiDung INT NULL,
    LoaiDoiTuong VARCHAR(50) NOT NULL,
    MaDoiTuong VARCHAR(100) NOT NULL,
    HanhDong VARCHAR(50) NOT NULL,
    GiaTriCu NVARCHAR(MAX) NULL,
    GiaTriMoi NVARCHAR(MAX) NULL,
    ThoiGian DATETIME2(0) NOT NULL CONSTRAINT DF_AuditLog_ThoiGian DEFAULT SYSDATETIME(),
    CONSTRAINT FK_AuditLog_NguoiDung FOREIGN KEY (MaNguoiDung) REFERENCES NguoiDung(MaNguoiDung)
);
GO
CREATE INDEX IX_AuditLog_NguoiDung ON AuditLog(MaNguoiDung, ThoiGian DESC);
CREATE INDEX IX_AuditLog_DoiTuong ON AuditLog(LoaiDoiTuong, MaDoiTuong, ThoiGian DESC);
GO

/* ==================== SEED VAI TRÒ / QUYỀN ==================== */
INSERT INTO VaiTro(TenVaiTro,MoTa) VALUES
('CUSTOMER',N'Khách hàng'),('EMPLOYEE',N'Nhân viên'),('ADMIN',N'Quản trị viên');
GO
INSERT INTO Quyen(TenQuyen,MoTa) VALUES
('PROFILE_UPDATE',N'Cập nhật hồ sơ'),('CAR_VIEW',N'Xem xe'),('ORDER_CREATE',N'Tạo đơn'),
('ORDER_VIEW_OWN',N'Xem đơn cá nhân'),('ORDER_CANCEL_OWN',N'Hủy đơn cá nhân'),
('PAYMENT_CREATE',N'Thanh toán'),('NOTIFICATION_VIEW',N'Xem thông báo'),
('ORDER_PROCESS',N'Xử lý đơn'),('ORDER_CONFIRM',N'Xác nhận / từ chối / hủy đơn'),('CAR_HANDOVER',N'Giao xe'),
('CAR_RETURN',N'Nhận trả xe'),('EXTRA_FEE_MANAGE',N'Quản lý phí phát sinh'),
('PAYMENT_PROCESS',N'Xử lý thanh toán'),('CONTRACT_MANAGE',N'Quản lý hợp đồng'),
('CAR_MANAGE',N'Quản lý xe'),('USER_MANAGE',N'Quản lý người dùng'),
('PERMISSION_MANAGE',N'Phân quyền'),('AUDIT_VIEW',N'Xem audit log'),('REPORT_VIEW',N'Xem báo cáo');
GO
INSERT INTO VaiTroQuyen(MaVaiTro,MaQuyen)
SELECT VT.MaVaiTro,Q.MaQuyen FROM VaiTro VT JOIN Quyen Q ON Q.TenQuyen IN
('PROFILE_UPDATE','CAR_VIEW','ORDER_CREATE','ORDER_VIEW_OWN','ORDER_CANCEL_OWN','PAYMENT_CREATE','NOTIFICATION_VIEW')
WHERE VT.TenVaiTro='CUSTOMER';
INSERT INTO VaiTroQuyen(MaVaiTro,MaQuyen)
SELECT VT.MaVaiTro,Q.MaQuyen FROM VaiTro VT JOIN Quyen Q ON Q.TenQuyen IN
('PROFILE_UPDATE','NOTIFICATION_VIEW','CAR_VIEW','ORDER_PROCESS','ORDER_CONFIRM','CAR_HANDOVER','CAR_RETURN','EXTRA_FEE_MANAGE','PAYMENT_PROCESS','CONTRACT_MANAGE')
WHERE VT.TenVaiTro='EMPLOYEE';
INSERT INTO VaiTroQuyen(MaVaiTro,MaQuyen)
SELECT VT.MaVaiTro,Q.MaQuyen FROM VaiTro VT CROSS JOIN Quyen Q
WHERE VT.TenVaiTro='ADMIN' AND Q.TenQuyen NOT IN ('ORDER_CREATE','ORDER_VIEW_OWN','ORDER_CANCEL_OWN','PAYMENT_CREATE');
GO

/* ==================== HÀM: TỔNG ĐÃ THANH TOÁN (THUẦN) ==================== */
CREATE OR ALTER FUNCTION fn_TongDaThanhToan(@MaDonThue BIGINT)
RETURNS DECIMAL(18,2)
AS
BEGIN
    RETURN ISNULL((
        SELECT SUM(CASE WHEN LoaiThanhToan='REFUND' THEN -SoTien ELSE SoTien END)
        FROM ThanhToan WHERE MaDonThue=@MaDonThue AND TrangThai='SUCCESS'
    ),0);
END;
GO

/* ==================== TRIGGER TỔNG PHÍ / TRẠNG THÁI THANH TOÁN ==================== */
/* Đơn CANCELLED/REJECTED do SP huỷ/từ chối tự chốt trạng thái thanh toán. */
CREATE OR ALTER TRIGGER TR_Phi_CapNhatTongPhi ON PhiPhatSinh
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    ;WITH A AS (SELECT MaDonThue FROM inserted UNION SELECT MaDonThue FROM deleted)
    UPDATE D SET TongPhiPhatSinh = ISNULL((SELECT SUM(P.SoTien) FROM PhiPhatSinh P WHERE P.MaDonThue=D.MaDonThue),0)
    FROM DonThue D JOIN A ON A.MaDonThue=D.MaDonThue;

    ;WITH A AS (SELECT MaDonThue FROM inserted UNION SELECT MaDonThue FROM deleted)
    UPDATE D SET TrangThaiThanhToan = CASE
        WHEN dbo.fn_TongDaThanhToan(D.MaDonThue) >= D.TongTienPhaiTra AND D.TongTienPhaiTra > 0 THEN 'PAID'
        WHEN dbo.fn_TongDaThanhToan(D.MaDonThue) > 0 THEN 'PARTIAL'
        ELSE 'UNPAID' END
    FROM DonThue D JOIN A ON A.MaDonThue=D.MaDonThue
    WHERE D.TrangThai NOT IN ('CANCELLED','REJECTED');
END;
GO

CREATE OR ALTER TRIGGER TR_ThanhToan_CapNhatTrangThai ON ThanhToan
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    ;WITH A AS (SELECT MaDonThue FROM inserted UNION SELECT MaDonThue FROM deleted)
    UPDATE D SET TrangThaiThanhToan = CASE
        WHEN dbo.fn_TongDaThanhToan(D.MaDonThue) >= D.TongTienPhaiTra AND D.TongTienPhaiTra > 0 THEN 'PAID'
        WHEN dbo.fn_TongDaThanhToan(D.MaDonThue) > 0 THEN 'PARTIAL'
        ELSE 'UNPAID' END
    FROM DonThue D JOIN A ON A.MaDonThue=D.MaDonThue
    WHERE D.TrangThai NOT IN ('CANCELLED','REJECTED');
END;
GO

CREATE OR ALTER TRIGGER TR_Xe_KhongNgungKhiCoDonHieuLuc ON Xe
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS(
      SELECT 1 FROM inserted I JOIN deleted D ON I.MaXe=D.MaXe
      WHERE I.TrangThai='INACTIVE' AND D.TrangThai<>'INACTIVE'
      AND EXISTS(SELECT 1 FROM DonThue DT WHERE DT.MaXe=I.MaXe AND DT.TrangThai IN ('PENDING','CONFIRMED','RENTING'))
    )
    BEGIN
      ROLLBACK TRANSACTION;
      THROW 51001,N'Không thể ngưng xe vì còn đơn thuê hiệu lực.',1;
    END
END;
GO

/* ==================== ĐỒNG BỘ TRẠNG THÁI XE ==================== */
/* Ưu tiên: MAINTENANCE/INACTIVE (thủ công) > RENTING > RESERVED > AVAILABLE */
CREATE OR ALTER PROCEDURE sp_DongBoTrangThaiXe @MaXe INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Xe SET TrangThai = CASE
        WHEN TrangThai IN ('MAINTENANCE','INACTIVE') THEN TrangThai
        WHEN EXISTS(SELECT 1 FROM DonThue WHERE MaXe=@MaXe AND TrangThai='RENTING') THEN 'RENTING'
        WHEN EXISTS(SELECT 1 FROM DonThue WHERE MaXe=@MaXe AND TrangThai='CONFIRMED') THEN 'RESERVED'
        ELSE 'AVAILABLE' END,
        NgayCapNhat = SYSDATETIME()
    WHERE MaXe=@MaXe;
END;
GO

/* ==================== KIỂM TRA TRÙNG LỊCH ==================== */
/* Hai khoảng [A1,A2) và [B1,B2) chồng nhau  <=>  A1 < B2 AND A2 > B1 */
CREATE OR ALTER PROCEDURE sp_KiemTraTrungLich
 @MaXe INT,@NgayGioNhan DATETIME2(0),@NgayGioTra DATETIME2(0),@MaDonThueBoQua BIGINT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @NgayGioTra<=@NgayGioNhan THROW 52001,N'Thời gian trả phải lớn hơn thời gian nhận.',1;
 SELECT MaDonThue,NgayGioNhan,NgayGioTra,TrangThai FROM DonThue
 WHERE MaXe=@MaXe AND TrangThai IN ('PENDING','CONFIRMED','RENTING')
   AND (@MaDonThueBoQua IS NULL OR MaDonThue<>@MaDonThueBoQua)
   AND NgayGioNhan<@NgayGioTra AND NgayGioTra>@NgayGioNhan;
END;
GO

/* ==================== TẠO ĐƠN CHỐNG RACE CONDITION ==================== */
/* sp_getapplock theo từng xe => mọi giao dịch đặt/xác nhận cùng 1 xe
   được tuần tự hoá; giao dịch thứ 2 chỉ chạy khi giao dịch 1 đã COMMIT
   nên chắc chắn thấy đơn vừa tạo và bị từ chối (lỗi 52106). */
CREATE OR ALTER PROCEDURE sp_TaoDonThue
 @MaKhachHang INT,@MaXe INT,@NgayGioNhan DATETIME2(0),@NgayGioTra DATETIME2(0),@GhiChu NVARCHAR(1000)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF @NgayGioTra<=@NgayGioNhan THROW 52101,N'Thời gian trả phải lớn hơn thời gian nhận.',1;
 IF @NgayGioNhan<DATEADD(MINUTE,-5,SYSDATETIME()) THROW 52107,N'Thời gian nhận xe không được ở quá khứ.',1;
 IF NOT EXISTS(SELECT 1 FROM NguoiDung WHERE MaNguoiDung=@MaKhachHang AND TrangThai='ACTIVE') THROW 52102,N'Khách hàng không hợp lệ hoặc đã bị khoá.',1;
 DECLARE @Gia DECIMAL(18,2),@Coc DECIMAL(18,2),@TTXe VARCHAR(20),@SoNgay INT,@Tong DECIMAL(18,2),@R INT,@TenXe NVARCHAR(120);
 BEGIN TRAN;
 DECLARE @Res NVARCHAR(100)=CONCAT(N'XE_THUE_',@MaXe);
 EXEC @R=sys.sp_getapplock @Resource=@Res,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
 IF @R<0 BEGIN ROLLBACK; THROW 52103,N'Hệ thống đang bận xử lý lịch xe, vui lòng thử lại.',1; END
 SELECT @Gia=GiaThueNgay,@Coc=TienCoc,@TTXe=TrangThai,@TenXe=TenXe FROM Xe WITH(UPDLOCK,HOLDLOCK) WHERE MaXe=@MaXe;
 IF @Gia IS NULL BEGIN ROLLBACK; THROW 52104,N'Xe không tồn tại.',1; END
 IF @TTXe IN('MAINTENANCE','INACTIVE') BEGIN ROLLBACK; THROW 52105,N'Xe đang bảo trì hoặc ngưng hoạt động.',1; END
 IF EXISTS(SELECT 1 FROM DonThue WITH(UPDLOCK,HOLDLOCK) WHERE MaXe=@MaXe AND TrangThai IN('PENDING','CONFIRMED','RENTING') AND NgayGioNhan<@NgayGioTra AND NgayGioTra>@NgayGioNhan)
 BEGIN ROLLBACK; THROW 52106,N'Xe đã có lịch thuê chồng lấn trong khoảng thời gian này.',1; END
 SET @SoNgay=CEILING(DATEDIFF(MINUTE,@NgayGioNhan,@NgayGioTra)/1440.0); IF @SoNgay<1 SET @SoNgay=1;
 SET @Tong=@SoNgay*@Gia;
 IF @Coc>@Tong SET @Coc=@Tong;
 INSERT INTO DonThue(MaKhachHang,MaXe,NgayGioNhan,NgayGioTra,SoNgayThue,DonGiaNgay,TongTienDuKien,TienCoc,GhiChu)
 VALUES(@MaKhachHang,@MaXe,@NgayGioNhan,@NgayGioTra,@SoNgay,@Gia,@Tong,@Coc,@GhiChu);
 DECLARE @MaDon BIGINT=SCOPE_IDENTITY();
 INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao)
 VALUES(@MaKhachHang,@MaDon,N'Tạo đơn thuê thành công',CONCAT(N'Đơn #',@MaDon,N' (',@TenXe,N') đang chờ nhân viên xác nhận.'),'ORDER_CREATED');
 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriMoi)
 VALUES(@MaKhachHang,'DonThue',CONVERT(VARCHAR(100),@MaDon),'CREATE',
        CONCAT(N'{"TrangThai":"PENDING","MaXe":',@MaXe,N',"SoNgay":',@SoNgay,N',"TongTien":',@Tong,N',"TienCoc":',@Coc,N'}'));
 COMMIT;
 SELECT @MaDon MaDonThue,@SoNgay SoNgayThue,@Tong TongTienDuKien,@Coc TienCoc,'PENDING' TrangThai;
END;
GO

/* ==================== XÁC NHẬN / TỪ CHỐI ==================== */
CREATE OR ALTER PROCEDURE sp_XacNhanDon @MaDonThue BIGINT,@MaNhanVien INT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @MaXe INT,@KH INT,@N DATETIME2(0),@T DATETIME2(0),@TT VARCHAR(20),@R INT;
 SELECT @MaXe=MaXe FROM DonThue WHERE MaDonThue=@MaDonThue;
 IF @MaXe IS NULL THROW 52200,N'Đơn thuê không tồn tại.',1;
 BEGIN TRAN;
 DECLARE @Res NVARCHAR(100)=CONCAT(N'XE_THUE_',@MaXe);
 EXEC @R=sys.sp_getapplock @Resource=@Res,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
 IF @R<0 BEGIN ROLLBACK; THROW 52103,N'Hệ thống đang bận xử lý lịch xe, vui lòng thử lại.',1; END
 SELECT @KH=MaKhachHang,@N=NgayGioNhan,@T=NgayGioTra,@TT=TrangThai FROM DonThue WITH(UPDLOCK,HOLDLOCK) WHERE MaDonThue=@MaDonThue;
 IF @TT<>'PENDING' BEGIN ROLLBACK; THROW 52201,N'Chỉ đơn PENDING mới được xác nhận.',1; END
 IF EXISTS(SELECT 1 FROM Xe WHERE MaXe=@MaXe AND TrangThai IN('MAINTENANCE','INACTIVE')) BEGIN ROLLBACK; THROW 52202,N'Xe đang bảo trì/ngưng hoạt động, không đủ điều kiện cho thuê.',1; END
 IF EXISTS(SELECT 1 FROM DonThue WHERE MaXe=@MaXe AND MaDonThue<>@MaDonThue AND TrangThai IN('CONFIRMED','RENTING') AND NgayGioNhan<@T AND NgayGioTra>@N)
 BEGIN ROLLBACK; THROW 52203,N'Lịch xe phát sinh xung đột với đơn khác đã xác nhận.',1; END

 UPDATE DonThue SET TrangThai='CONFIRMED',MaNhanVienXacNhan=@MaNhanVien,ThoiGianXacNhan=SYSDATETIME() WHERE MaDonThue=@MaDonThue;
 EXEC sp_DongBoTrangThaiXe @MaXe;

 /* Tạo hợp đồng nháp ngay khi xác nhận */
 IF NOT EXISTS(SELECT 1 FROM HopDong WHERE MaDonThue=@MaDonThue)
 BEGIN
   DECLARE @ND NVARCHAR(MAX);
   SELECT @ND = CONCAT(
     N'HỢP ĐỒNG THUÊ XE DU LỊCH', CHAR(10),
     N'Số đơn thuê: #', D.MaDonThue, CHAR(10), CHAR(10),
     N'BÊN CHO THUÊ (Bên A): Công ty dịch vụ thuê xe du lịch', CHAR(10),
     N'BÊN THUÊ (Bên B): ', K.HoTen, N' - Email: ', K.Email, N' - SĐT: ', ISNULL(K.SoDienThoai,N''), CHAR(10), CHAR(10),
     N'Điều 1. Xe cho thuê: ', X.TenXe, N' - Biển số: ', X.BienSo, N' - Loại: ', L.TenLoai, CHAR(10),
     N'Điều 2. Thời gian thuê: từ ', CONVERT(NVARCHAR(16),D.NgayGioNhan,120), N' đến ', CONVERT(NVARCHAR(16),D.NgayGioTra,120),
       N' (', D.SoNgayThue, N' ngày)', CHAR(10),
     N'Điều 3. Giá thuê: ', FORMAT(D.DonGiaNgay,'N0'), N' đ/ngày x ', D.SoNgayThue, N' ngày = ', FORMAT(D.TongTienDuKien,'N0'), N' đ', CHAR(10),
     N'         Tiền cọc (trừ vào tổng tiền): ', FORMAT(D.TienCoc,'N0'), N' đ', CHAR(10),
     N'Điều 4. Phụ phí: trả xe trễ, hư hỏng, nhiên liệu, vệ sinh tính theo quy tắc phí hiện hành và ghi trong phiếu trả xe.', CHAR(10),
     N'Điều 5. Huỷ đơn sau khi xác nhận chịu phí huỷ theo quy định, khấu trừ vào số tiền đã thanh toán.', CHAR(10),
     N'Điều 6. Bên B có trách nhiệm bảo quản xe và hoàn trả đúng hạn, đúng tình trạng như lúc nhận.')
   FROM DonThue D JOIN NguoiDung K ON K.MaNguoiDung=D.MaKhachHang JOIN Xe X ON X.MaXe=D.MaXe JOIN LoaiXe L ON L.MaLoaiXe=X.MaLoaiXe
   WHERE D.MaDonThue=@MaDonThue;
   INSERT INTO HopDong(MaDonThue,SoHopDong,MaNhanVienLap,NoiDung,TrangThai)
   VALUES(@MaDonThue,CONCAT('HD',FORMAT(SYSDATETIME(),'yyyyMMdd'),'-',RIGHT(CONCAT('000000',@MaDonThue),6)),@MaNhanVien,@ND,'DRAFT');
   INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriMoi) VALUES(@MaNhanVien,'HopDong',CONVERT(VARCHAR(100),@MaDonThue),'CREATE',N'DRAFT');
 END

 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriCu,GiaTriMoi) VALUES(@MaNhanVien,'DonThue',CONVERT(VARCHAR(100),@MaDonThue),'CONFIRM',N'PENDING',N'CONFIRMED');
 INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao) VALUES(@KH,@MaDonThue,N'Đơn thuê đã được xác nhận',CONCAT(N'Đơn #',@MaDonThue,N' đã được xác nhận. Vui lòng thanh toán tiền cọc trước khi nhận xe.'),'ORDER_CONFIRMED');
 COMMIT;
END;
GO

/* Hoàn toàn bộ tiền đã thanh toán (dùng nội bộ khi từ chối / huỷ) */
CREATE OR ALTER PROCEDURE sp_HoanTien @MaDonThue BIGINT,@SoTien DECIMAL(18,2),@MaNguoiThucHien INT,@LyDo NVARCHAR(500)
AS
BEGIN
 SET NOCOUNT ON;
 IF @SoTien IS NULL OR @SoTien<=0 RETURN;
 DECLARE @KH INT=(SELECT MaKhachHang FROM DonThue WHERE MaDonThue=@MaDonThue);
 INSERT INTO ThanhToan(MaDonThue,MaNhanVienXacNhan,SoTien,LoaiThanhToan,PhuongThuc,TrangThai,MaGiaoDich,ThoiGianXuLy,GhiChu)
 VALUES(@MaDonThue,@MaNguoiThucHien,@SoTien,'REFUND','SANDBOX','SUCCESS',CONCAT('RF',FORMAT(SYSDATETIME(),'yyyyMMddHHmmss'),'-',LEFT(CONVERT(VARCHAR(36),NEWID()),8)),SYSDATETIME(),@LyDo);
 INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao)
 VALUES(@KH,@MaDonThue,N'Hoàn tiền',CONCAT(N'Đơn #',@MaDonThue,N' được hoàn ',FORMAT(@SoTien,'N0'),N' đ. ',@LyDo),'PAYMENT_REFUNDED');
 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriMoi) VALUES(@MaNguoiThucHien,'ThanhToan',CONVERT(VARCHAR(100),@MaDonThue),'REFUND',CONCAT(N'{"SoTien":',@SoTien,N'}'));
END;
GO

CREATE OR ALTER PROCEDURE sp_TuChoiDon @MaDonThue BIGINT,@MaNhanVien INT,@LyDo NVARCHAR(500)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NULLIF(LTRIM(RTRIM(@LyDo)),N'') IS NULL THROW 52301,N'Phải nhập lý do từ chối.',1;
 DECLARE @KH INT,@TT VARCHAR(20),@DaTra DECIMAL(18,2);
 BEGIN TRAN;
 SELECT @KH=MaKhachHang,@TT=TrangThai FROM DonThue WITH(UPDLOCK,HOLDLOCK) WHERE MaDonThue=@MaDonThue;
 IF @TT IS NULL BEGIN ROLLBACK; THROW 52300,N'Đơn thuê không tồn tại.',1; END
 IF @TT<>'PENDING' BEGIN ROLLBACK; THROW 52302,N'Chỉ đơn PENDING mới được từ chối.',1; END
 UPDATE ThanhToan SET TrangThai='CANCELLED',ThoiGianXuLy=SYSDATETIME() WHERE MaDonThue=@MaDonThue AND TrangThai='PENDING';
 SET @DaTra=dbo.fn_TongDaThanhToan(@MaDonThue);
 UPDATE DonThue SET TrangThai='REJECTED',MaNhanVienXacNhan=@MaNhanVien,ThoiGianXacNhan=SYSDATETIME(),LyDoTuChoi=@LyDo WHERE MaDonThue=@MaDonThue;
 EXEC sp_HoanTien @MaDonThue,@DaTra,@MaNhanVien,N'Hoàn 100% do đơn bị từ chối.';
 UPDATE DonThue SET TrangThaiThanhToan=CASE WHEN @DaTra>0 THEN 'REFUNDED' ELSE 'UNPAID' END WHERE MaDonThue=@MaDonThue;
 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriCu,GiaTriMoi) VALUES(@MaNhanVien,'DonThue',CONVERT(VARCHAR(100),@MaDonThue),'REJECT',N'PENDING',CONCAT(N'REJECTED: ',@LyDo));
 INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao) VALUES(@KH,@MaDonThue,N'Đơn thuê bị từ chối',CONCAT(N'Đơn #',@MaDonThue,N' bị từ chối. Lý do: ',@LyDo),'ORDER_REJECTED');
 COMMIT;
END;
GO

/* ==================== HUỶ ĐƠN ==================== */
/* PENDING  : huỷ miễn phí, hoàn 100%.
   CONFIRMED: phí huỷ theo QuyTacPhi CANCELLATION (PERCENT trên tiền thuê / FIXED),
              tối đa bằng số tiền khách đã thanh toán; phần còn lại hoàn tiền.
   @ChiChuDon=1: người huỷ phải là chủ đơn (khách hàng tự huỷ). */
CREATE OR ALTER PROCEDURE sp_HuyDon @MaDonThue BIGINT,@MaNguoiHuy INT,@LyDo NVARCHAR(500)=NULL,@ChiChuDon BIT=0
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @KH INT,@MaXe INT,@TT VARCHAR(20),@Tong DECIMAL(18,2),@DaTra DECIMAL(18,2),@Phi DECIMAL(18,2)=0,@Kieu VARCHAR(20),@GT DECIMAL(18,2);
 BEGIN TRAN;
 SELECT @KH=MaKhachHang,@MaXe=MaXe,@TT=TrangThai,@Tong=TongTienDuKien FROM DonThue WITH(UPDLOCK,HOLDLOCK) WHERE MaDonThue=@MaDonThue;
 IF @TT IS NULL BEGIN ROLLBACK; THROW 52400,N'Đơn thuê không tồn tại.',1; END
 IF @ChiChuDon=1 AND @KH<>@MaNguoiHuy BEGIN ROLLBACK; THROW 52402,N'Bạn không có quyền huỷ đơn của người khác.',1; END
 IF @TT NOT IN('PENDING','CONFIRMED') BEGIN ROLLBACK; THROW 52401,N'Chỉ huỷ được đơn ở trạng thái PENDING hoặc CONFIRMED.',1; END

 UPDATE ThanhToan SET TrangThai='CANCELLED',ThoiGianXuLy=SYSDATETIME() WHERE MaDonThue=@MaDonThue AND TrangThai='PENDING';
 SET @DaTra=dbo.fn_TongDaThanhToan(@MaDonThue);
 UPDATE DonThue SET TrangThai='CANCELLED',LyDoHuy=@LyDo,MaNguoiHuy=@MaNguoiHuy,ThoiGianHuy=SYSDATETIME() WHERE MaDonThue=@MaDonThue;

 IF @TT='CONFIRMED'
 BEGIN
   SELECT TOP 1 @Kieu=KieuTinh,@GT=GiaTri FROM QuyTacPhi WHERE LoaiPhi='CANCELLATION' AND TrangThai=1 ORDER BY MaQuyTac DESC;
   SET @Phi = CASE WHEN @Kieu='PERCENT' THEN ROUND(@Tong*@GT/100.0,0) WHEN @Kieu='FIXED' THEN @GT ELSE 0 END;
   IF @Phi>@DaTra SET @Phi=@DaTra;
   IF @Phi>0
     INSERT INTO PhiPhatSinh(MaDonThue,MaNhanVienTao,LoaiPhi,SoTien,LyDo)
     VALUES(@MaDonThue,@MaNguoiHuy,'CANCELLATION',@Phi,N'Phí huỷ đơn sau khi đã xác nhận (khấu trừ vào tiền đã thanh toán)');
 END
 DECLARE @Hoan DECIMAL(18,2)=@DaTra-@Phi;
 EXEC sp_HoanTien @MaDonThue,@Hoan,@MaNguoiHuy,N'Hoàn tiền do huỷ đơn.';
 UPDATE DonThue SET TrangThaiThanhToan=CASE WHEN @Hoan>0 THEN 'REFUNDED' WHEN @Phi>0 THEN 'PAID' ELSE 'UNPAID' END WHERE MaDonThue=@MaDonThue;
 UPDATE HopDong SET TrangThai='CANCELLED',NgayCapNhat=SYSDATETIME() WHERE MaDonThue=@MaDonThue;
 EXEC sp_DongBoTrangThaiXe @MaXe;

 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriCu,GiaTriMoi)
 VALUES(@MaNguoiHuy,'DonThue',CONVERT(VARCHAR(100),@MaDonThue),'CANCEL',@TT,CONCAT(N'{"TrangThai":"CANCELLED","PhiHuy":',@Phi,N',"HoanTien":',@DaTra-@Phi,N',"LyDo":"',ISNULL(@LyDo,N''),N'"}'));
 INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao)
 VALUES(@KH,@MaDonThue,N'Đơn thuê đã huỷ',CONCAT(N'Đơn #',@MaDonThue,N' đã huỷ.',CASE WHEN @Phi>0 THEN CONCAT(N' Phí huỷ: ',FORMAT(@Phi,'N0'),N' đ.') ELSE N'' END),'ORDER_CANCELLED');
 COMMIT;
 SELECT @Phi PhiHuy,@DaTra-@Phi SoTienHoan;
END;
GO

/* ==================== GIAO XE ==================== */
CREATE OR ALTER PROCEDURE sp_GiaoXe @MaDonThue BIGINT,@MaNhanVien INT,@ThoiGianGiao DATETIME2(0),@SoKm DECIMAL(12,1),@MucNhienLieu TINYINT=NULL,@TinhTrangXe NVARCHAR(1000),@GhiChu NVARCHAR(1000)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON; DECLARE @MaXe INT,@KH INT,@TT VARCHAR(20),@Coc DECIMAL(18,2);
 IF NULLIF(LTRIM(RTRIM(@TinhTrangXe)),N'') IS NULL THROW 52504,N'Phải nhập tình trạng xe khi bàn giao.',1;
 BEGIN TRAN;
 SELECT @MaXe=MaXe,@KH=MaKhachHang,@TT=TrangThai,@Coc=TienCoc FROM DonThue WITH(UPDLOCK,HOLDLOCK) WHERE MaDonThue=@MaDonThue;
 IF @TT IS NULL BEGIN ROLLBACK; THROW 52500,N'Đơn thuê không tồn tại.',1; END
 IF @TT<>'CONFIRMED' BEGIN ROLLBACK; THROW 52501,N'Chỉ đơn CONFIRMED mới được giao xe.',1; END
 IF EXISTS(SELECT 1 FROM PhieuGiaoXe WHERE MaDonThue=@MaDonThue) BEGIN ROLLBACK; THROW 52502,N'Đơn đã có phiếu giao xe.',1; END
 IF dbo.fn_TongDaThanhToan(@MaDonThue)<@Coc BEGIN ROLLBACK; THROW 52503,N'Khách hàng chưa thanh toán đủ tiền cọc, chưa thể giao xe.',1; END
 IF EXISTS(SELECT 1 FROM Xe WHERE MaXe=@MaXe AND TrangThai IN('MAINTENANCE','INACTIVE')) BEGIN ROLLBACK; THROW 52505,N'Xe đang bảo trì/ngưng hoạt động, không thể giao.',1; END
 IF EXISTS(SELECT 1 FROM DonThue WHERE MaXe=@MaXe AND TrangThai='RENTING') BEGIN ROLLBACK; THROW 52506,N'Xe đang được khách khác thuê, chưa trả.',1; END
 INSERT INTO PhieuGiaoXe(MaDonThue,MaNhanVien,ThoiGianGiao,SoKm,MucNhienLieu,TinhTrangXe,GhiChu) VALUES(@MaDonThue,@MaNhanVien,@ThoiGianGiao,@SoKm,@MucNhienLieu,@TinhTrangXe,@GhiChu);
 UPDATE DonThue SET TrangThai='RENTING' WHERE MaDonThue=@MaDonThue;
 EXEC sp_DongBoTrangThaiXe @MaXe;
 UPDATE HopDong SET TrangThai='ACTIVE',NgayCapNhat=SYSDATETIME() WHERE MaDonThue=@MaDonThue AND TrangThai='DRAFT';
 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriCu,GiaTriMoi)
 VALUES(@MaNhanVien,'DonThue',CONVERT(VARCHAR(100),@MaDonThue),'HANDOVER',N'CONFIRMED',CONCAT(N'{"TrangThai":"RENTING","SoKm":',@SoKm,N',"NhienLieu":',ISNULL(@MucNhienLieu,0),N'}'));
 INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao) VALUES(@KH,@MaDonThue,N'Đã giao xe',CONCAT(N'Đơn #',@MaDonThue,N': hệ thống đã ghi nhận bàn giao xe lúc ',CONVERT(NVARCHAR(16),@ThoiGianGiao,120),N'.'),'CAR_HANDED_OVER');
 COMMIT;
END;
GO

/* ==================== NHẬN TRẢ XE ==================== */
/* Phí trễ (PER_HOUR) = CEILING(số phút trễ / 60) x đơn giá giờ. */
CREATE OR ALTER PROCEDURE sp_NhanTraXe @MaDonThue BIGINT,@MaNhanVien INT,@ThoiGianTra DATETIME2(0),@SoKm DECIMAL(12,1),@MucNhienLieu TINYINT=NULL,@TinhTrangXe NVARCHAR(1000),@CanBaoTri BIT=0,@GhiChu NVARCHAR(1000)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @MaXe INT,@KH INT,@TT VARCHAR(20),@DuKien DATETIME2(0),@MaPhieu BIGINT,@TGGiao DATETIME2(0),@KmGiao DECIMAL(12,1),@PhiTre DECIMAL(18,2)=0,@Gio INT=0;
 IF NULLIF(LTRIM(RTRIM(@TinhTrangXe)),N'') IS NULL THROW 52604,N'Phải nhập tình trạng xe khi nhận trả.',1;
 BEGIN TRAN;
 SELECT @MaXe=MaXe,@KH=MaKhachHang,@TT=TrangThai,@DuKien=NgayGioTra FROM DonThue WITH(UPDLOCK,HOLDLOCK) WHERE MaDonThue=@MaDonThue;
 IF @TT IS NULL BEGIN ROLLBACK; THROW 52600,N'Đơn thuê không tồn tại.',1; END
 IF @TT<>'RENTING' BEGIN ROLLBACK; THROW 52601,N'Chỉ đơn RENTING mới được nhận trả xe.',1; END
 SELECT @TGGiao=ThoiGianGiao,@KmGiao=SoKm FROM PhieuGiaoXe WHERE MaDonThue=@MaDonThue;
 IF @ThoiGianTra<@TGGiao BEGIN ROLLBACK; THROW 52602,N'Thời gian trả không được trước thời gian giao xe.',1; END
 IF @SoKm<@KmGiao BEGIN ROLLBACK; THROW 52603,N'Số km lúc trả không được nhỏ hơn số km lúc giao.',1; END

 INSERT INTO PhieuTraXe(MaDonThue,MaNhanVien,ThoiGianTra,SoKm,MucNhienLieu,TinhTrangXe,CanBaoTri,GhiChu) VALUES(@MaDonThue,@MaNhanVien,@ThoiGianTra,@SoKm,@MucNhienLieu,@TinhTrangXe,@CanBaoTri,@GhiChu);
 SET @MaPhieu=SCOPE_IDENTITY();
 IF @ThoiGianTra>@DuKien AND EXISTS(SELECT 1 FROM QuyTacPhi WHERE LoaiPhi='LATE' AND TrangThai=1)
 BEGIN
   DECLARE @Kieu VARCHAR(20),@Gia DECIMAL(18,2),@Tong DECIMAL(18,2);
   SELECT TOP 1 @Kieu=KieuTinh,@Gia=GiaTri FROM QuyTacPhi WHERE LoaiPhi='LATE' AND TrangThai=1 ORDER BY MaQuyTac DESC;
   SELECT @Tong=TongTienDuKien FROM DonThue WHERE MaDonThue=@MaDonThue;
   SET @Gio=CEILING(DATEDIFF(MINUTE,@DuKien,@ThoiGianTra)/60.0);
   SET @PhiTre=CASE WHEN @Kieu='PER_HOUR' THEN @Gio*@Gia WHEN @Kieu='PERCENT' THEN ROUND(@Tong*@Gia/100.0,0) ELSE @Gia END;
   IF @PhiTre>0
     INSERT INTO PhiPhatSinh(MaPhieuTra,MaDonThue,MaNhanVienTao,LoaiPhi,SoTien,LyDo) VALUES(@MaPhieu,@MaDonThue,@MaNhanVien,'LATE',@PhiTre,CONCAT(N'Trả trễ ',@Gio,N' giờ so với dự kiến ',CONVERT(NVARCHAR(16),@DuKien,120)));
 END
 UPDATE DonThue SET TrangThai='RETURNED' WHERE MaDonThue=@MaDonThue;
 IF @CanBaoTri=1 UPDATE Xe SET TrangThai='MAINTENANCE',NgayCapNhat=SYSDATETIME() WHERE MaXe=@MaXe;
 EXEC sp_DongBoTrangThaiXe @MaXe;
 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriCu,GiaTriMoi)
 VALUES(@MaNhanVien,'DonThue',CONVERT(VARCHAR(100),@MaDonThue),'RETURN',N'RENTING',CONCAT(N'{"TrangThai":"RETURNED","SoKm":',@SoKm,N',"GioTre":',@Gio,N',"PhiTre":',@PhiTre,N',"CanBaoTri":',@CanBaoTri,N'}'));
 INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao)
 VALUES(@KH,@MaDonThue,N'Đã nhận xe trả',CONCAT(N'Đơn #',@MaDonThue,N': đã ghi nhận trả xe.',CASE WHEN @PhiTre>0 THEN CONCAT(N' Phí trả trễ ',@Gio,N' giờ: ',FORMAT(@PhiTre,'N0'),N' đ.') ELSE N'' END,N' Vui lòng thanh toán phần còn lại.'),'CAR_RETURNED');
 COMMIT;
 SELECT @MaPhieu MaPhieuTra,@Gio SoGioTre,@PhiTre PhiTre;
END;
GO

CREATE OR ALTER PROCEDURE sp_ThemPhiPhatSinh @MaDonThue BIGINT,@MaNhanVien INT,@LoaiPhi VARCHAR(30),@SoTien DECIMAL(18,2),@LyDo NVARCHAR(1000)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @TT VARCHAR(20),@KH INT;
 SELECT @TT=TrangThai,@KH=MaKhachHang FROM DonThue WHERE MaDonThue=@MaDonThue;
 IF @TT IS NULL THROW 52700,N'Đơn thuê không tồn tại.',1;
 IF @TT NOT IN('RENTING','RETURNED') THROW 52701,N'Chỉ thêm phí phát sinh cho đơn đang thuê hoặc đã trả xe.',1;
 IF @LoaiPhi NOT IN('DAMAGE','FUEL','CLEANING','LATE','OTHER') THROW 52702,N'Loại phí không hợp lệ.',1;
 IF @SoTien IS NULL OR @SoTien<=0 THROW 52703,N'Số tiền phí phải lớn hơn 0.',1;
 IF NULLIF(LTRIM(RTRIM(@LyDo)),N'') IS NULL THROW 52704,N'Phải nhập lý do phát sinh phí.',1;
 BEGIN TRAN;
 DECLARE @MaPhieu BIGINT=(SELECT MaPhieuTra FROM PhieuTraXe WHERE MaDonThue=@MaDonThue);
 INSERT INTO PhiPhatSinh(MaPhieuTra,MaDonThue,MaNhanVienTao,LoaiPhi,SoTien,LyDo) VALUES(@MaPhieu,@MaDonThue,@MaNhanVien,@LoaiPhi,@SoTien,@LyDo);
 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriMoi) VALUES(@MaNhanVien,'PhiPhatSinh',CONVERT(VARCHAR(100),@MaDonThue),'ADD_FEE',CONCAT(N'{"Loai":"',@LoaiPhi,N'","SoTien":',@SoTien,N',"LyDo":"',@LyDo,N'"}'));
 INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao) VALUES(@KH,@MaDonThue,N'Phát sinh phụ phí',CONCAT(N'Đơn #',@MaDonThue,N' phát sinh phí ',@LoaiPhi,N': ',FORMAT(@SoTien,'N0'),N' đ. Lý do: ',@LyDo),'EXTRA_FEE');
 COMMIT;
END;
GO

/* ==================== THANH TOÁN ==================== */
/* Khách tạo giao dịch: DEPOSIT = cọc còn thiếu; FULL = toàn bộ số còn phải trả.
   Giao dịch ở trạng thái PENDING cho tới khi cổng sandbox / nhân viên trả kết quả. */
CREATE OR ALTER PROCEDURE sp_TaoGiaoDichThanhToan @MaDonThue BIGINT,@MaNguoiDung INT,@LoaiThanhToan VARCHAR(20),@PhuongThuc VARCHAR(20)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @KH INT,@TT VARCHAR(20),@Coc DECIMAL(18,2),@Tong DECIMAL(18,2),@DaTra DECIMAL(18,2),@SoTien DECIMAL(18,2);
 IF @LoaiThanhToan NOT IN('DEPOSIT','FULL') THROW 52800,N'Loại thanh toán không hợp lệ (DEPOSIT/FULL).',1;
 IF @PhuongThuc NOT IN('SANDBOX','BANK_TRANSFER') THROW 52801,N'Phương thức trực tuyến không hợp lệ.',1;
 BEGIN TRAN;
 SELECT @KH=MaKhachHang,@TT=TrangThai,@Coc=TienCoc,@Tong=TongTienPhaiTra FROM DonThue WITH(UPDLOCK,HOLDLOCK) WHERE MaDonThue=@MaDonThue;
 IF @TT IS NULL BEGIN ROLLBACK; THROW 52802,N'Đơn thuê không tồn tại.',1; END
 IF @KH<>@MaNguoiDung BEGIN ROLLBACK; THROW 52803,N'Bạn không có quyền thanh toán đơn này.',1; END
 IF @TT NOT IN('PENDING','CONFIRMED','RENTING','RETURNED') BEGIN ROLLBACK; THROW 52804,N'Đơn ở trạng thái hiện tại không thể thanh toán.',1; END
 SET @DaTra=dbo.fn_TongDaThanhToan(@MaDonThue);
 IF @DaTra>=@Tong BEGIN ROLLBACK; THROW 52805,N'Đơn đã được thanh toán đủ.',1; END
 SET @SoTien = CASE WHEN @LoaiThanhToan='DEPOSIT' THEN @Coc-@DaTra ELSE @Tong-@DaTra END;
 IF @SoTien<=0 BEGIN ROLLBACK; THROW 52806,N'Đơn đã thanh toán đủ tiền cọc, hãy chọn thanh toán phần còn lại.',1; END
 /* Huỷ các giao dịch đang treo để tránh trả trùng */
 UPDATE ThanhToan SET TrangThai='CANCELLED',ThoiGianXuLy=SYSDATETIME(),GhiChu=N'Bị thay thế bởi giao dịch mới' WHERE MaDonThue=@MaDonThue AND TrangThai='PENDING';
 INSERT INTO ThanhToan(MaDonThue,SoTien,LoaiThanhToan,PhuongThuc,TrangThai,MaGiaoDich)
 VALUES(@MaDonThue,@SoTien,@LoaiThanhToan,@PhuongThuc,'PENDING',CONCAT(CASE WHEN @PhuongThuc='SANDBOX' THEN 'SBX' ELSE 'BNK' END,FORMAT(SYSDATETIME(),'yyyyMMddHHmmss'),'-',LEFT(CONVERT(VARCHAR(36),NEWID()),8)));
 DECLARE @Ma BIGINT=SCOPE_IDENTITY();
 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriMoi) VALUES(@MaNguoiDung,'ThanhToan',CONVERT(VARCHAR(100),@Ma),'CREATE',CONCAT(N'{"MaDon":',@MaDonThue,N',"SoTien":',@SoTien,N',"Loai":"',@LoaiThanhToan,N'","TrangThai":"PENDING"}'));
 COMMIT;
 SELECT * FROM ThanhToan WHERE MaThanhToan=@Ma;
END;
GO

/* Kết quả từ cổng sandbox (khách) hoặc nhân viên xác nhận chuyển khoản */
CREATE OR ALTER PROCEDURE sp_XuLyKetQuaThanhToan @MaThanhToan BIGINT,@KetQua VARCHAR(20),@MaNguoiXuLy INT,@LaNhanVien BIT=0,@GhiChu NVARCHAR(500)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @MaDon BIGINT,@TT VARCHAR(20),@SoTien DECIMAL(18,2),@KH INT,@PT VARCHAR(20),@Con DECIMAL(18,2);
 IF @KetQua NOT IN('SUCCESS','FAILED','CANCELLED') THROW 52810,N'Kết quả thanh toán không hợp lệ.',1;
 BEGIN TRAN;
 SELECT @MaDon=T.MaDonThue,@TT=T.TrangThai,@SoTien=T.SoTien,@KH=D.MaKhachHang,@PT=T.PhuongThuc
 FROM ThanhToan T WITH(UPDLOCK,HOLDLOCK) JOIN DonThue D WITH(UPDLOCK) ON D.MaDonThue=T.MaDonThue WHERE T.MaThanhToan=@MaThanhToan;
 IF @MaDon IS NULL BEGIN ROLLBACK; THROW 52811,N'Giao dịch không tồn tại.',1; END
 IF @LaNhanVien=0 AND (@KH<>@MaNguoiXuLy OR @PT<>'SANDBOX') BEGIN ROLLBACK; THROW 52812,N'Bạn không có quyền xử lý giao dịch này.',1; END
 IF @TT<>'PENDING' BEGIN ROLLBACK; THROW 52813,N'Giao dịch đã được xử lý trước đó.',1; END
 SELECT @Con=TongTienPhaiTra-dbo.fn_TongDaThanhToan(@MaDon) FROM DonThue WHERE MaDonThue=@MaDon;
 IF @KetQua='SUCCESS' AND @SoTien>@Con
 BEGIN SET @KetQua='FAILED'; SET @GhiChu=N'Số tiền vượt quá số còn phải trả'; END
 UPDATE ThanhToan SET TrangThai=@KetQua,ThoiGianXuLy=SYSDATETIME(),GhiChu=@GhiChu,
        MaNhanVienXacNhan=CASE WHEN @LaNhanVien=1 THEN @MaNguoiXuLy ELSE NULL END
 WHERE MaThanhToan=@MaThanhToan;
 IF @KetQua='SUCCESS'
   INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao) VALUES(@KH,@MaDon,N'Thanh toán thành công',CONCAT(N'Đơn #',@MaDon,N': giao dịch ',FORMAT(@SoTien,'N0'),N' đ thành công.'),'PAYMENT_SUCCESS');
 IF @KetQua='FAILED'
   INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao) VALUES(@KH,@MaDon,N'Thanh toán thất bại',CONCAT(N'Đơn #',@MaDon,N': giao dịch ',FORMAT(@SoTien,'N0'),N' đ thất bại. ',ISNULL(@GhiChu,N'')),'PAYMENT_FAILED');
 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriCu,GiaTriMoi) VALUES(@MaNguoiXuLy,'ThanhToan',CONVERT(VARCHAR(100),@MaThanhToan),CONCAT('PAYMENT_',@KetQua),N'PENDING',@KetQua);
 COMMIT;
 SELECT * FROM ThanhToan WHERE MaThanhToan=@MaThanhToan;
END;
GO

/* Nhân viên ghi nhận thanh toán tại quầy (CASH / BANK_TRANSFER) */
CREATE OR ALTER PROCEDURE sp_GhiNhanThanhToan @MaDonThue BIGINT,@SoTien DECIMAL(18,2),@LoaiThanhToan VARCHAR(20),@PhuongThuc VARCHAR(20),@TrangThai VARCHAR(20),@MaGiaoDich VARCHAR(100)=NULL,@MaNhanVienXacNhan INT=NULL,@GhiChu NVARCHAR(500)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @TT VARCHAR(20),@KH INT,@Con DECIMAL(18,2);
 IF @SoTien IS NULL OR @SoTien<=0 THROW 52900,N'Số tiền phải lớn hơn 0.',1;
 IF @LoaiThanhToan NOT IN('DEPOSIT','RENTAL','EXTRA_FEE','FULL') THROW 52906,N'Loại thanh toán không hợp lệ.',1;
 IF @TrangThai NOT IN('SUCCESS','FAILED') THROW 52907,N'Trạng thái ghi nhận phải là SUCCESS hoặc FAILED.',1;
 BEGIN TRAN;
 SELECT @TT=TrangThai,@KH=MaKhachHang,@Con=TongTienPhaiTra-dbo.fn_TongDaThanhToan(MaDonThue) FROM DonThue WITH(UPDLOCK,HOLDLOCK) WHERE MaDonThue=@MaDonThue;
 IF @TT IS NULL BEGIN ROLLBACK; THROW 52903,N'Đơn thuê không tồn tại.',1; END
 IF @TT NOT IN('PENDING','CONFIRMED','RENTING','RETURNED') BEGIN ROLLBACK; THROW 52904,N'Đơn ở trạng thái hiện tại không thể thanh toán.',1; END
 IF @TrangThai='SUCCESS' AND @SoTien>@Con BEGIN ROLLBACK; THROW 52905,N'Số tiền vượt quá số còn phải trả của đơn.',1; END
 INSERT INTO ThanhToan(MaDonThue,MaNhanVienXacNhan,SoTien,LoaiThanhToan,PhuongThuc,TrangThai,MaGiaoDich,ThoiGianXuLy,GhiChu)
 VALUES(@MaDonThue,@MaNhanVienXacNhan,@SoTien,@LoaiThanhToan,@PhuongThuc,@TrangThai,@MaGiaoDich,SYSDATETIME(),@GhiChu);
 IF @TrangThai='SUCCESS' INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao) VALUES(@KH,@MaDonThue,N'Thanh toán thành công',CONCAT(N'Đơn #',@MaDonThue,N': đã nhận ',FORMAT(@SoTien,'N0'),N' đ (',@PhuongThuc,N').'),'PAYMENT_SUCCESS');
 IF @TrangThai='FAILED' INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao) VALUES(@KH,@MaDonThue,N'Thanh toán thất bại',CONCAT(N'Đơn #',@MaDonThue,N': giao dịch thất bại.'),'PAYMENT_FAILED');
 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriMoi) VALUES(@MaNhanVienXacNhan,'ThanhToan',CONVERT(VARCHAR(100),@MaDonThue),CONCAT('PAYMENT_',@TrangThai),CONCAT(N'{"SoTien":',@SoTien,N',"Loai":"',@LoaiThanhToan,N'","PhuongThuc":"',@PhuongThuc,N'"}'));
 COMMIT;
END;
GO

/* ==================== HOÀN TẤT ĐƠN ==================== */
CREATE OR ALTER PROCEDURE sp_HoanTatDon @MaDonThue BIGINT,@MaNhanVien INT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @TT VARCHAR(20),@TTTT VARCHAR(20),@KH INT;
 BEGIN TRAN;
 SELECT @TT=TrangThai,@TTTT=TrangThaiThanhToan,@KH=MaKhachHang FROM DonThue WITH(UPDLOCK,HOLDLOCK) WHERE MaDonThue=@MaDonThue;
 IF @TT IS NULL BEGIN ROLLBACK; THROW 52950,N'Đơn thuê không tồn tại.',1; END
 IF @TT<>'RETURNED' BEGIN ROLLBACK; THROW 52901,N'Xe chưa được ghi nhận trả, chưa thể hoàn tất.',1; END
 IF @TTTT<>'PAID' BEGIN ROLLBACK; THROW 52902,N'Đơn chưa thanh toán đủ (bao gồm phí phát sinh).',1; END
 UPDATE DonThue SET TrangThai='COMPLETED' WHERE MaDonThue=@MaDonThue;
 UPDATE HopDong SET TrangThai='COMPLETED',NgayCapNhat=SYSDATETIME() WHERE MaDonThue=@MaDonThue;
 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriCu,GiaTriMoi) VALUES(@MaNhanVien,'DonThue',CONVERT(VARCHAR(100),@MaDonThue),'COMPLETE',N'RETURNED',N'COMPLETED');
 INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao) VALUES(@KH,@MaDonThue,N'Đơn thuê hoàn tất',CONCAT(N'Đơn #',@MaDonThue,N' đã hoàn tất. Cảm ơn bạn đã sử dụng dịch vụ!'),'ORDER_COMPLETED');
 COMMIT;
END;
GO

/* ==================== CẬP NHẬT TRẠNG THÁI XE THỦ CÔNG ==================== */
CREATE OR ALTER PROCEDURE sp_CapNhatTrangThaiXe @MaXe INT,@TrangThaiMoi VARCHAR(20),@MaNguoiDung INT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Cu VARCHAR(20);
 IF @TrangThaiMoi NOT IN('AVAILABLE','MAINTENANCE','INACTIVE') THROW 53001,N'Chỉ được đặt thủ công AVAILABLE / MAINTENANCE / INACTIVE. RESERVED/RENTING do hệ thống tự cập nhật.',1;
 BEGIN TRAN;
 SELECT @Cu=TrangThai FROM Xe WITH(UPDLOCK,HOLDLOCK) WHERE MaXe=@MaXe;
 IF @Cu IS NULL BEGIN ROLLBACK; THROW 53002,N'Xe không tồn tại.',1; END
 IF EXISTS(SELECT 1 FROM DonThue WHERE MaXe=@MaXe AND TrangThai='RENTING') BEGIN ROLLBACK; THROW 53003,N'Xe đang cho thuê, không thể đổi trạng thái thủ công.',1; END
 IF @TrangThaiMoi='MAINTENANCE' AND EXISTS(SELECT 1 FROM DonThue WHERE MaXe=@MaXe AND TrangThai='CONFIRMED')
 BEGIN ROLLBACK; THROW 53004,N'Xe còn đơn đã xác nhận, hãy xử lý/huỷ đơn trước khi đưa vào bảo trì.',1; END
 IF @TrangThaiMoi='AVAILABLE'
 BEGIN
   UPDATE Xe SET TrangThai='AVAILABLE',NgayCapNhat=SYSDATETIME() WHERE MaXe=@MaXe;
   EXEC sp_DongBoTrangThaiXe @MaXe;
 END
 ELSE
   UPDATE Xe SET TrangThai=@TrangThaiMoi,NgayCapNhat=SYSDATETIME() WHERE MaXe=@MaXe;
 DECLARE @Moi VARCHAR(20)=(SELECT TrangThai FROM Xe WHERE MaXe=@MaXe);
 INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriCu,GiaTriMoi) VALUES(@MaNguoiDung,'Xe',CONVERT(VARCHAR(100),@MaXe),'CHANGE_STATUS',@Cu,@Moi);
 COMMIT;
END;
GO

/* ==================== NHẮC LỊCH NHẬN XE ==================== */
CREATE OR ALTER PROCEDURE sp_TaoThongBaoSapNhanXe
AS
BEGIN
 SET NOCOUNT ON;
 INSERT INTO ThongBao(MaNguoiDung,MaDonThue,TieuDe,NoiDung,LoaiThongBao)
 SELECT D.MaKhachHang,D.MaDonThue,N'Sắp đến thời gian nhận xe',CONCAT(N'Đơn #',D.MaDonThue,N': bạn có lịch nhận xe lúc ',CONVERT(NVARCHAR(16),D.NgayGioNhan,120),N'.'), 'PICKUP_REMINDER'
 FROM DonThue D WHERE D.TrangThai='CONFIRMED' AND D.NgayGioNhan>SYSDATETIME() AND D.NgayGioNhan<=DATEADD(HOUR,24,SYSDATETIME())
 AND NOT EXISTS(SELECT 1 FROM ThongBao T WHERE T.MaDonThue=D.MaDonThue AND T.LoaiThongBao='PICKUP_REMINDER');
 SELECT @@ROWCOUNT SoThongBao;
END;
GO

/* ==================== BÁO CÁO ==================== */
CREATE OR ALTER VIEW vw_ThongKeDonTheoTrangThai AS SELECT TrangThai,COUNT_BIG(*) SoLuongDon FROM DonThue GROUP BY TrangThai;
GO
CREATE OR ALTER VIEW vw_ThongKeDoanhThuTheoNgay AS
SELECT CAST(ThoiGianTao AS DATE) Ngay,
       SUM(CASE WHEN TrangThai='SUCCESS' AND LoaiThanhToan<>'REFUND' THEN SoTien WHEN TrangThai='SUCCESS' AND LoaiThanhToan='REFUND' THEN -SoTien ELSE 0 END) DoanhThuThuan,
       COUNT_BIG(*) SoGiaoDich
FROM ThanhToan GROUP BY CAST(ThoiGianTao AS DATE);
GO
CREATE OR ALTER VIEW vw_ThongKeHieuSuatXe AS
SELECT X.MaXe,X.BienSo,X.TenXe,X.TrangThai,COUNT(D.MaDonThue) TongSoDon,
       SUM(CASE WHEN D.TrangThai='COMPLETED' THEN 1 ELSE 0 END) SoDonHoanTat,
       ISNULL(SUM(CASE WHEN D.TrangThai='COMPLETED' THEN D.TongTienPhaiTra ELSE 0 END),0) TongGiaTriDonHoanTat
FROM Xe X LEFT JOIN DonThue D ON D.MaXe=X.MaXe GROUP BY X.MaXe,X.BienSo,X.TenXe,X.TrangThai;
GO

PRINT N'Đã tạo xong CSDL QuanLyThueXeDuLich.';
GO
