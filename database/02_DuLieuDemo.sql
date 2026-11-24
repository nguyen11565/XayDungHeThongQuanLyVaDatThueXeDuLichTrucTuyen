/* ================================================================
   02_DuLieuDemo.sql - Dữ liệu 
   Tài khoản demo (mật khẩu đều là: 123456)
     admin@gmail.com      - Quản trị viên
     nhanvien@gmail.com   - Nhân viên
     nguyen01@gmail.com  - Khách hàng
     nguyen02@gmail.com - Khách hàng 2 (dùng test đặt đồng thời)
   ================================================================ */
USE QuanLyThueXeDuLich;
GO
SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

DECLARE @Hash VARCHAR(255)='$2a$10$gZNVIKvXeKu38hJEHbvJ8OGlXa2U1ZXL6vcmjDBj8tlmhqVlbA4bG';
DECLARE @Khach INT=(SELECT MaVaiTro FROM VaiTro WHERE TenVaiTro='CUSTOMER');
DECLARE @NV INT=(SELECT MaVaiTro FROM VaiTro WHERE TenVaiTro='EMPLOYEE');
DECLARE @Admin INT=(SELECT MaVaiTro FROM VaiTro WHERE TenVaiTro='ADMIN');

IF NOT EXISTS(SELECT 1 FROM NguoiDung WHERE Email='admin@gmail.com')
INSERT INTO NguoiDung(MaVaiTro,HoTen,Email,SoDienThoai,MatKhau,DiaChi) VALUES(@Admin,N'Quản trị viên','admin@gmail.com','0123456789',@Hash,N'TP.HCM');
IF NOT EXISTS(SELECT 1 FROM NguoiDung WHERE Email='nhanvien@gmail.com')
INSERT INTO NguoiDung(MaVaiTro,HoTen,Email,SoDienThoai,MatKhau,DiaChi) VALUES(@NV,N'Nhân viên ','nhanvien@gmail.com','0987654321',@Hash,N'TP.HCM');
IF NOT EXISTS(SELECT 1 FROM NguoiDung WHERE Email='nguyen01@gmail.com')
INSERT INTO NguoiDung(MaVaiTro,HoTen,Email,SoDienThoai,MatKhau,DiaChi) VALUES(@Khach,N'Nguyen Nguyên','nguyen01@gmail.com','0955566677',@Hash,N'TP.HCM');
IF NOT EXISTS(SELECT 1 FROM NguoiDung WHERE Email='nguyen02@gmail.com')
INSERT INTO NguoiDung(MaVaiTro,HoTen,Email,SoDienThoai,MatKhau,DiaChi) VALUES(@Khach,N'Hoàng Tuấn Nguyên','nguyen02@gmail.com','0911223344',@Hash,N'Hà Nội');
GO

IF NOT EXISTS(SELECT 1 FROM LoaiXe WHERE TenLoai=N'Sedan 5 chỗ') INSERT INTO LoaiXe(TenLoai,SoCho,MoTa) VALUES(N'Sedan 5 chỗ',5,N'Xe gia đình nhỏ gọn, tiết kiệm nhiên liệu');
IF NOT EXISTS(SELECT 1 FROM LoaiXe WHERE TenLoai=N'SUV / MPV 7 chỗ') INSERT INTO LoaiXe(TenLoai,SoCho,MoTa) VALUES(N'SUV / MPV 7 chỗ',7,N'Rộng rãi, phù hợp đi du lịch nhóm, đường đèo');
IF NOT EXISTS(SELECT 1 FROM LoaiXe WHERE TenLoai=N'Minivan cao cấp') INSERT INTO LoaiXe(TenLoai,SoCho,MoTa) VALUES(N'Minivan cao cấp',8,N'Ghế thương gia, phù hợp đón khách VIP');
IF NOT EXISTS(SELECT 1 FROM LoaiXe WHERE TenLoai=N'Xe khách 16 chỗ') INSERT INTO LoaiXe(TenLoai,SoCho,MoTa) VALUES(N'Xe khách 16 chỗ',16,N'Dành cho đoàn du lịch, công ty');
GO

DECLARE @L5 INT=(SELECT MaLoaiXe FROM LoaiXe WHERE TenLoai=N'Sedan 5 chỗ');
DECLARE @L7 INT=(SELECT MaLoaiXe FROM LoaiXe WHERE TenLoai=N'SUV / MPV 7 chỗ');
DECLARE @L8 INT=(SELECT MaLoaiXe FROM LoaiXe WHERE TenLoai=N'Minivan cao cấp');
DECLARE @L16 INT=(SELECT MaLoaiXe FROM LoaiXe WHERE TenLoai=N'Xe khách 16 chỗ');

/* Thứ tự chèn cố định để MaXe khớp với test case: 1=Vios, 4=Honda City (bảo trì) */
IF NOT EXISTS(SELECT 1 FROM Xe WHERE BienSo='51A-123.45') INSERT INTO Xe(MaLoaiXe,BienSo,TenXe,HangXe,NamSanXuat,GiaThueNgay,TienCoc,MoTa) VALUES(@L5,'51A-123.45',N'Toyota Vios',N'Toyota',2024,900000,2000000,N'Số tự động, camera lùi, màn hình Android, bảo hiểm 2 chiều.');
IF NOT EXISTS(SELECT 1 FROM Xe WHERE BienSo='51H-567.89') INSERT INTO Xe(MaLoaiXe,BienSo,TenXe,HangXe,NamSanXuat,GiaThueNgay,TienCoc,MoTa) VALUES(@L7,'51H-567.89',N'Toyota Fortuner',N'Toyota',2023,1600000,3000000,N'Máy dầu 2.4, gầm cao, phù hợp đường đèo Tây Nguyên, Tây Bắc.');
IF NOT EXISTS(SELECT 1 FROM Xe WHERE BienSo='51B-222.33') INSERT INTO Xe(MaLoaiXe,BienSo,TenXe,HangXe,NamSanXuat,GiaThueNgay,TienCoc,MoTa) VALUES(@L16,'51B-222.33',N'Ford Transit',N'Ford',2022,2500000,5000000,N'16 chỗ, điều hoà 2 dàn lạnh, cốp rộng cho đoàn du lịch.');
IF NOT EXISTS(SELECT 1 FROM Xe WHERE BienSo='51A-999.88') INSERT INTO Xe(MaLoaiXe,BienSo,TenXe,HangXe,NamSanXuat,GiaThueNgay,TienCoc,TrangThai,MoTa) VALUES(@L5,'51A-999.88',N'Honda City',N'Honda',2021,850000,2000000,'MAINTENANCE',N'Đang bảo dưỡng định kỳ.');
IF NOT EXISTS(SELECT 1 FROM Xe WHERE BienSo='30G-456.78') INSERT INTO Xe(MaLoaiXe,BienSo,TenXe,HangXe,NamSanXuat,GiaThueNgay,TienCoc,MoTa) VALUES(@L5,'30G-456.78',N'Hyundai Accent',N'Hyundai',2023,800000,1500000,N'Tiết kiệm xăng, nội thất da, Apple CarPlay.');
IF NOT EXISTS(SELECT 1 FROM Xe WHERE BienSo='43A-777.11') INSERT INTO Xe(MaLoaiXe,BienSo,TenXe,HangXe,NamSanXuat,GiaThueNgay,TienCoc,MoTa) VALUES(@L7,'43A-777.11',N'Mitsubishi Xpander',N'Mitsubishi',2024,1100000,2500000,N'MPV 7 chỗ bán chạy, hàng ghế 3 gập phẳng.');
IF NOT EXISTS(SELECT 1 FROM Xe WHERE BienSo='51K-888.99') INSERT INTO Xe(MaLoaiXe,BienSo,TenXe,HangXe,NamSanXuat,GiaThueNgay,TienCoc,MoTa) VALUES(@L8,'51K-888.99',N'Kia Carnival',N'Kia',2024,2200000,5000000,N'Ghế thương gia chỉnh điện, cửa lùa điện, cửa sổ trời.');
IF NOT EXISTS(SELECT 1 FROM Xe WHERE BienSo='29B-135.79') INSERT INTO Xe(MaLoaiXe,BienSo,TenXe,HangXe,NamSanXuat,GiaThueNgay,TienCoc,MoTa) VALUES(@L16,'29B-135.79',N'Hyundai Solati',N'Hyundai',2023,2700000,5000000,N'Mui cao, 16 ghế ngả, wifi & cổng sạc USB từng ghế.');
GO

/* Hình ảnh (file nằm trong backend/uploads/cars) */
INSERT INTO HinhAnhXe(MaXe,DuongDan,MoTa,ThuTu)
SELECT X.MaXe,V.DuongDan,X.TenXe,1 FROM Xe X JOIN (VALUES
 ('51A-123.45','/uploads/cars/vios.jpg'),('51H-567.89','/uploads/cars/fortuner.jpg'),
 ('51B-222.33','/uploads/cars/transit.jpg'),('51A-999.88','/uploads/cars/city.jpg'),
 ('30G-456.78','/uploads/cars/accent.jpg'),('43A-777.11','/uploads/cars/xpander.jpg'),
 ('51K-888.99','/uploads/cars/carnival.jpg'),('29B-135.79','/uploads/cars/solati.jpg')
) V(BienSo,DuongDan) ON V.BienSo=X.BienSo
WHERE NOT EXISTS(SELECT 1 FROM HinhAnhXe H WHERE H.MaXe=X.MaXe);
GO

/* Quy tắc phí */
IF NOT EXISTS(SELECT 1 FROM QuyTacPhi WHERE LoaiPhi='LATE')
INSERT INTO QuyTacPhi(LoaiPhi,TenQuyTac,KieuTinh,GiaTri,GhiChu) VALUES('LATE',N'Phí trả xe trễ theo giờ','PER_HOUR',50000,N'50.000đ/giờ, làm tròn lên theo giờ');
IF NOT EXISTS(SELECT 1 FROM QuyTacPhi WHERE LoaiPhi='CANCELLATION')
INSERT INTO QuyTacPhi(LoaiPhi,TenQuyTac,KieuTinh,GiaTri,GhiChu) VALUES('CANCELLATION',N'Phí huỷ sau khi xác nhận','PERCENT',10,N'10% tiền thuê, khấu trừ vào số đã thanh toán');
IF NOT EXISTS(SELECT 1 FROM QuyTacPhi WHERE LoaiPhi='CLEANING')
INSERT INTO QuyTacPhi(LoaiPhi,TenQuyTac,KieuTinh,GiaTri,GhiChu) VALUES('CLEANING',N'Phí vệ sinh xe','FIXED',200000,N'Áp dụng khi xe bẩn, có mùi');
IF NOT EXISTS(SELECT 1 FROM QuyTacPhi WHERE LoaiPhi='FUEL')
INSERT INTO QuyTacPhi(LoaiPhi,TenQuyTac,KieuTinh,GiaTri,GhiChu) VALUES('FUEL',N'Phí bù nhiên liệu','FIXED',300000,N'Khi mức nhiên liệu trả thấp hơn lúc nhận');
IF NOT EXISTS(SELECT 1 FROM QuyTacPhi WHERE LoaiPhi='DAMAGE')
INSERT INTO QuyTacPhi(LoaiPhi,TenQuyTac,KieuTinh,GiaTri,GhiChu) VALUES('DAMAGE',N'Phí hư hỏng (tham khảo)','FIXED',500000,N'Nhân viên nhập số tiền thực tế theo biên bản');
GO

/* ================================================================
   Lịch sử đơn đã hoàn tất (tháng 10/2026) để có số liệu báo cáo.
   Chèn trực tiếp vì SP không cho đặt ngày trong quá khứ.
   ================================================================ */
IF NOT EXISTS(SELECT 1 FROM DonThue)
BEGIN
  DECLARE @KH1 INT=(SELECT MaNguoiDung FROM NguoiDung WHERE Email='nguyen01@gmail.com');
  DECLARE @KH2 INT=(SELECT MaNguoiDung FROM NguoiDung WHERE Email='nguyen02@gmail.com');
  DECLARE @NVX INT=(SELECT MaNguoiDung FROM NguoiDung WHERE Email='nhanvien@gmail.com');
  DECLARE @Ls TABLE(STT INT,KH INT,BienSo VARCHAR(20),Nhan DATETIME2(0),Tra DATETIME2(0),TraThucTe DATETIME2(0));
  INSERT INTO @Ls VALUES
   (1,@KH1,'51H-567.89','2026-10-03 08:00','2026-10-06 08:00','2026-10-06 07:30'),
   (2,@KH2,'51B-222.33','2026-10-10 07:00','2026-10-12 07:00','2026-10-12 10:20'),
   (3,@KH1,'43A-777.11','2026-10-18 09:00','2026-10-20 09:00','2026-10-20 08:45'),
   (4,@KH2,'51K-888.99','2026-10-24 08:00','2026-10-25 08:00','2026-10-25 08:00'),
   (5,@KH1,'30G-456.78','2026-10-27 08:00','2026-10-29 08:00','2026-10-29 07:50');
  DECLARE @i INT=1;
  WHILE @i<=5
  BEGIN
    DECLARE @KHi INT,@BS VARCHAR(20),@N DATETIME2(0),@T DATETIME2(0),@TT DATETIME2(0),@MaXe INT,@Gia DECIMAL(18,2),@Coc DECIMAL(18,2),@SoNgay INT,@Tong DECIMAL(18,2),@Don BIGINT,@PT BIGINT;
    SELECT @KHi=KH,@BS=BienSo,@N=Nhan,@T=Tra,@TT=TraThucTe FROM @Ls WHERE STT=@i;
    SELECT @MaXe=MaXe,@Gia=GiaThueNgay,@Coc=TienCoc FROM Xe WHERE BienSo=@BS;
    SET @SoNgay=CEILING(DATEDIFF(MINUTE,@N,@T)/1440.0); SET @Tong=@SoNgay*@Gia; IF @Coc>@Tong SET @Coc=@Tong;
    INSERT INTO DonThue(MaKhachHang,MaXe,MaNhanVienXacNhan,NgayGioNhan,NgayGioTra,NgayTao,ThoiGianXacNhan,SoNgayThue,DonGiaNgay,TongTienDuKien,TienCoc,TrangThai)
    VALUES(@KHi,@MaXe,@NVX,@N,@T,DATEADD(DAY,-3,@N),DATEADD(DAY,-2,@N),@SoNgay,@Gia,@Tong,@Coc,'RETURNED');
    SET @Don=SCOPE_IDENTITY();
    INSERT INTO HopDong(MaDonThue,SoHopDong,MaNhanVienLap,NgayLap,NoiDung,TrangThai)
    VALUES(@Don,CONCAT('HD',FORMAT(DATEADD(DAY,-2,@N),'yyyyMMdd'),'-',RIGHT(CONCAT('000000',@Don),6)),@NVX,DATEADD(DAY,-2,@N),N'Hợp đồng dữ liệu demo lịch sử.','COMPLETED');
    INSERT INTO PhieuGiaoXe(MaDonThue,MaNhanVien,ThoiGianGiao,SoKm,MucNhienLieu,TinhTrangXe) VALUES(@Don,@NVX,@N,10000+@i*1000,100,N'Xe sạch, không trầy xước');
    INSERT INTO PhieuTraXe(MaDonThue,MaNhanVien,ThoiGianTra,SoKm,MucNhienLieu,TinhTrangXe) VALUES(@Don,@NVX,@TT,10000+@i*1000+450,90,N'Bình thường');
    SET @PT=SCOPE_IDENTITY();
    IF @TT>@T INSERT INTO PhiPhatSinh(MaPhieuTra,MaDonThue,MaNhanVienTao,LoaiPhi,SoTien,LyDo,ThoiGianTao)
       VALUES(@PT,@Don,@NVX,'LATE',CEILING(DATEDIFF(MINUTE,@T,@TT)/60.0)*50000,CONCAT(N'Trả trễ ',CEILING(DATEDIFF(MINUTE,@T,@TT)/60.0),N' giờ'),@TT);
    INSERT INTO ThanhToan(MaDonThue,SoTien,LoaiThanhToan,PhuongThuc,TrangThai,MaGiaoDich,ThoiGianTao,ThoiGianXuLy)
    VALUES(@Don,@Coc,'DEPOSIT','SANDBOX','SUCCESS',CONCAT('SBX-DEMO-',@Don,'-1'),DATEADD(DAY,-2,@N),DATEADD(DAY,-2,@N));
    DECLARE @ConLai DECIMAL(18,2)=(SELECT TongTienPhaiTra FROM DonThue WHERE MaDonThue=@Don)-@Coc;
    IF @ConLai>0 INSERT INTO ThanhToan(MaDonThue,MaNhanVienXacNhan,SoTien,LoaiThanhToan,PhuongThuc,TrangThai,MaGiaoDich,ThoiGianTao,ThoiGianXuLy)
       VALUES(@Don,@NVX,@ConLai,'FULL','CASH','SUCCESS',CONCAT('CASH-DEMO-',@Don,'-2'),@TT,@TT);
    UPDATE DonThue SET TrangThai='COMPLETED' WHERE MaDonThue=@Don;
    INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriCu,GiaTriMoi,ThoiGian) VALUES(@NVX,'DonThue',CONVERT(VARCHAR(100),@Don),'COMPLETE',N'RETURNED',N'COMPLETED',@TT);
    SET @i+=1;
  END
END
GO

PRINT N'Đã nạp dữ liệu demo. Mật khẩu tất cả tài khoản demo: 123456';
GO
