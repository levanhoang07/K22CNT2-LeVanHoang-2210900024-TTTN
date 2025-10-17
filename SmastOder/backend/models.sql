
CREATE DATABASE MyCay_Oder;
GO
USE MyCay_Oder;
GO

-- =============================================
-- 1. BẢNG NGƯỜI DÙNG (User)
-- =============================================
CREATE TABLE NguoiDung (
    IDNguoiDung INT IDENTITY(1,1) PRIMARY KEY,
    TenDangNhap NVARCHAR(50) NOT NULL UNIQUE,
    MatKhau NVARCHAR(255) NOT NULL,
    HoTen NVARCHAR(100),
    VaiTro NVARCHAR(20) CHECK (VaiTro IN ('Khach', 'Bep', 'ThuNgan', 'Admin')),
    NgayTao DATETIME DEFAULT GETDATE()
);

-- =============================================
-- 2. BẢNG BÀN (Ban)
-- =============================================
CREATE TABLE Ban (
    IDBan INT IDENTITY(1,1) PRIMARY KEY,
    TenBan NVARCHAR(50) NOT NULL,
    MaQR NVARCHAR(255) UNIQUE,
    TrangThai NVARCHAR(20) DEFAULT N'Trống',
    NgayTao DATETIME DEFAULT GETDATE()
);

-- =============================================
-- 3. BẢNG MENU (Món ăn / thức uống)
-- =============================================
CREATE TABLE Menu (
    IDMon INT IDENTITY(1,1) PRIMARY KEY,
    TenMon NVARCHAR(100) NOT NULL,
    MoTa NVARCHAR(255),
    Gia DECIMAL(18,2) NOT NULL,
    HinhAnh NVARCHAR(255),
    TrangThai BIT DEFAULT 1,  -- 1: đang bán, 0: ngừng bán
    NgayTao DATETIME DEFAULT GETDATE()
);

-- =============================================
-- 4. BẢNG ĐƠN HÀNG (DonHang)
-- =============================================
CREATE TABLE DonHang (
    IDDonHang INT IDENTITY(1,1) PRIMARY KEY,
    IDBan INT FOREIGN KEY REFERENCES Ban(IDBan),
    IDNguoiDung INT NULL FOREIGN KEY REFERENCES NguoiDung(IDNguoiDung),
    TongTien DECIMAL(18,2) DEFAULT 0,
    TrangThaiBep NVARCHAR(30) DEFAULT N'Đang xử lý', -- Đang xử lý | Hoàn tất
    TrangThaiThanhToan BIT DEFAULT 0, -- 0: chưa thanh toán, 1: đã thanh toán
    GhiChu NVARCHAR(255),
    NgayTao DATETIME DEFAULT GETDATE()
);

-- =============================================
-- 5. BẢNG CHI TIẾT ĐƠN HÀNG
-- =============================================
CREATE TABLE ChiTietDonHang (
    IDChiTiet INT IDENTITY(1,1) PRIMARY KEY,
    IDDonHang INT FOREIGN KEY REFERENCES DonHang(IDDonHang) ON DELETE CASCADE,
    IDMon INT FOREIGN KEY REFERENCES Menu(IDMon),
    SoLuong INT NOT NULL,
    DonGia DECIMAL(18,2) NOT NULL,
    ThanhTien AS (SoLuong * DonGia) PERSISTED
);

-- =============================================
-- 6. TỰ ĐỘNG CẬP NHẬT TỔNG TIỀN ĐƠN HÀNG
-- =============================================
CREATE TRIGGER trg_UpdateTongTien
ON ChiTietDonHang
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE DonHang
    SET TongTien = (
        SELECT SUM(SoLuong * DonGia)
        FROM ChiTietDonHang
        WHERE ChiTietDonHang.IDDonHang = DonHang.IDDonHang
    )
    WHERE IDDonHang IN (
        SELECT DISTINCT IDDonHang FROM inserted
        UNION
        SELECT DISTINCT IDDonHang FROM deleted
    );
END;
GO

-- =============================================
-- 7. VIEW: BÁO CÁO DOANH THU
-- =============================================
CREATE VIEW vBaoCaoDoanhThu AS
SELECT 
    CONVERT(DATE, d.NgayTao) AS Ngay,
    SUM(ct.SoLuong * ct.DonGia) AS TongDoanhThu
FROM DonHang d
JOIN ChiTietDonHang ct ON d.IDDonHang = ct.IDDonHang
WHERE d.TrangThaiThanhToan = 1
GROUP BY CONVERT(DATE, d.NgayTao);
GO

-- =============================================
-- 8. DỮ LIỆU MẪU
-- =============================================

INSERT INTO NguoiDung (TenDangNhap, MatKhau, HoTen, VaiTro)
VALUES 
('admin', '123456', N'Quản trị viên', 'Admin'),
('bep1', '123456', N'Nhân viên bếp', 'Bep'),
('cashier', '123456', N'Thu ngân', 'ThuNgan');

INSERT INTO Ban (TenBan, MaQR)
VALUES 
(N'Bàn 1', 'QR_BAN_1'),
(N'Bàn 2', 'QR_BAN_2'),
(N'Bàn 3', 'QR_BAN_3');

INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh)
VALUES
(N'Mì Cay Cấp 1', N'Mì cay hải sản cấp 1', 45000, '/images/mi1.jpg'),
(N'Mì Cay Cấp 2', N'Mì cay hải sản cấp 2', 50000, '/images/mi2.jpg'),
(N'Trà Tắc', N'Trà tắc giải khát', 20000, '/images/tra.jpg');
GO

-- =============================================
-- 9. TEST DỮ LIỆU ĐƠN HÀNG
-- =============================================
INSERT INTO DonHang (IDBan, IDNguoiDung, TongTien, TrangThaiBep, TrangThaiThanhToan)
VALUES (1, 1, 0, N'Đang xử lý', 1);

INSERT INTO ChiTietDonHang (IDDonHang, IDMon, SoLuong, DonGia)
VALUES (1, 1, 2, 45000),
       (1, 3, 1, 20000);

-- =============================================
-- 10. XEM BÁO CÁO DOANH THU
-- =============================================
SELECT * FROM vBaoCaoDoanhThu;
