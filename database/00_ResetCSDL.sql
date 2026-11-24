/* ================================================================
   00_ResetCSDL.sql  (TUỲ CHỌN)
   Xoá CSDL cũ để chạy lại từ đầu 01 -> 02.
   CẢNH BÁO: lệnh này XOÁ TOÀN BỘ dữ liệu của QuanLyThueXeDuLich.
   ================================================================ */
USE master;
GO
IF DB_ID(N'QuanLyThueXeDuLich') IS NOT NULL
BEGIN
    ALTER DATABASE QuanLyThueXeDuLich SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE QuanLyThueXeDuLich;
END
GO
PRINT N'Đã xoá CSDL QuanLyThueXeDuLich (nếu có).';
GO
