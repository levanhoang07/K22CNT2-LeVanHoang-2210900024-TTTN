-- =============================================
-- 1. TẠO DATABASE
-- =============================================
CREATE DATABASE MyCay_Oder;
GO
USE MyCay_Oder;
GO

-- =============================================
-- 2. BẢNG NGƯỜI DÙNG (User)
-- =============================================
CREATE TABLE NguoiDung (
    IDNguoiDung INT IDENTITY(1,1) PRIMARY KEY,
    TenDangNhap NVARCHAR(50) NOT NULL UNIQUE,
    MatKhau NVARCHAR(255) NOT NULL,
    HoTen NVARCHAR(100),
    VaiTro NVARCHAR(20) CHECK (VaiTro IN ('Bep', 'ThuNgan', 'Admin')),
    NgayTao DATETIME DEFAULT GETDATE()
);

-- =============================================
-- 3. BẢNG BÀN (Ban)
-- =============================================
CREATE TABLE Ban (
    IDBan INT IDENTITY(1,1) PRIMARY KEY,
    TenBan NVARCHAR(50) NOT NULL UNIQUE, -- Tên bàn không trùng
    MaQR NVARCHAR(255) UNIQUE,
    TrangThai NVARCHAR(20) DEFAULT N'Trống',
    NgayTao DATETIME DEFAULT GETDATE()
);

-- =============================================
-- 4. BẢNG MENU (Món ăn / thức uống)
-- =============================================
CREATE TABLE Menu (
    IDMon INT IDENTITY(1,1) PRIMARY KEY,
    TenMon NVARCHAR(100) NOT NULL,
    MoTa NVARCHAR(255),
    Gia DECIMAL(18,2) NOT NULL,
    HinhAnh NVARCHAR(255),
    DanhMuc NVARCHAR(50) NOT NULL, --  Thêm DanhMuc
    TrangThai BIT DEFAULT 1,  -- 1: đang bán, 0: ngừng bán
    NgayTao DATETIME DEFAULT GETDATE()
);

-- =============================================
-- 5. BẢNG ĐƠN HÀNG (DonHang)
-- =============================================
CREATE TABLE DonHang (
    IDDonHang INT IDENTITY(1,1) PRIMARY KEY,
    IDBan INT FOREIGN KEY REFERENCES Ban(IDBan),
    IDNguoiDung INT NULL FOREIGN KEY REFERENCES NguoiDung(IDNguoiDung),
    TongTien DECIMAL(18,2) DEFAULT 0,
    TrangThaiBep NVARCHAR(30) DEFAULT N'Đang xử lý', 
    TrangThaiThanhToan BIT DEFAULT 0, 
    GhiChu NVARCHAR(255),
    NgayTao DATETIME DEFAULT GETDATE()
);

-- =============================================
-- 6. BẢNG CHI TIẾT ĐƠN HÀNG
-- =============================================
CREATE TABLE ChiTietDonHang (
    IDChiTiet INT IDENTITY(1,1) PRIMARY KEY,
    IDDonHang INT FOREIGN KEY REFERENCES DonHang(IDDonHang) ON DELETE CASCADE,
    IDMon INT FOREIGN KEY REFERENCES Menu(IDMon),
    SoLuong INT NOT NULL,
    DonGia DECIMAL(18,2) NOT NULL,
    GhiChu NVARCHAR(255),
    CapDoCay NVARCHAR(10),
    ThanhTien AS (SoLuong * DonGia) PERSISTED
);

-- =============================================
-- 7. TRIGGER TỰ ĐỘNG CẬP NHẬT TỔNG TIỀN
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
-- 8. VIEW: BÁO CÁO DOANH THU
-- =============================================
CREATE VIEW vBaoCaoDoanhThuTongHop AS
SELECT
    CONVERT(DATE, d.NgayTao) AS Ngay,
    DATEPART(WEEK, d.NgayTao) AS Tuan,
    DATEPART(MONTH, d.NgayTao) AS Thang,
    SUM(CASE WHEN m.DanhMuc = 'Mì cay' THEN ct.SoLuong * ct.DonGia ELSE 0 END) AS DoanhThu_MiCay,
    SUM(CASE WHEN m.DanhMuc = 'Cơm trộn' THEN ct.SoLuong * ct.DonGia ELSE 0 END) AS DoanhThu_ComTron,
    SUM(CASE WHEN m.DanhMuc = 'Topping' THEN ct.SoLuong * ct.DonGia ELSE 0 END) AS DoanhThu_Topping,
    SUM(CASE WHEN m.DanhMuc = 'Đồ uống' THEN ct.SoLuong * ct.DonGia ELSE 0 END) AS DoanhThu_DoUong
FROM DonHang d
JOIN ChiTietDonHang ct ON d.IDDonHang = ct.IDDonHang
JOIN Menu m ON ct.IDMon = m.IDMon
WHERE d.TrangThaiThanhToan = 1
GROUP BY
    CONVERT(DATE, d.NgayTao),
    DATEPART(WEEK, d.NgayTao),
    DATEPART(MONTH, d.NgayTao);
GO
SELECT * 
FROM vBaoCaoDoanhThuTongHop
ORDER BY Thang;


ALTER TABLE DonHang ALTER COLUMN IDBan NVARCHAR(10)
-- =============================================
-- 9. DỮ LIỆU MẪU
-- =============================================
-- Người dùng
INSERT INTO NguoiDung (TenDangNhap, MatKhau, HoTen, VaiTro)
VALUES 
('admin', '123456', N'Quản trị viên', 'Admin'),
('bep1', '123456', N'Nhân viên bếp', 'Bep'),
('cashier', '123456', N'Thu ngân', 'ThuNgan');

-- Bàn
INSERT INTO Ban (TenBan, MaQR)
VALUES 
(N'Bàn 1', 'QR_BAN_1'),
(N'Bàn 2', 'QR_BAN_2'),
(N'Bàn 3', 'QR_BAN_3');

-- Menu với Danh mục
INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, DanhMuc)
VALUES
(N'Mì Cay Hải Sản Tươi Sống', N'Mì cay hải sản tươi ngon, nước dùng đậm đà', 55000, '/images/mi1.jpg', N'Mì cay'),
(N'Mỳ Cay Bò Cuộn Nấm Kim', N'Mì cay bò cuộn nấm thơm ngon, nước dùng cay nồng.', 50000, '/images/mi2.jpg', N'Mì cay'),
(N'Trà Tắc', N'Trà tắc giải khát', 20000, '/images/tra.jpg', N'Đồ uống'),
(N'Topping Phô Mai', N'Phô mai béo ngậy', 10000, '/images/top1.jpg', N'Topping');



DROP TABLE IF EXISTS ChiTietDonHang;
DROP TABLE IF EXISTS DonHang;
DROP TABLE IF EXISTS Menu;
DROP TABLE IF EXISTS Ban;
DROP TABLE IF EXISTS NguoiDung;

select*from ban

-- 🌶️ Các món Mì Cay
INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, DanhMuc)
VALUES
(N'Mì Cay Gà', N'Mì cay thịt gà mềm thơm, nước dùng cay nhẹ, đậm đà hương vị', 55000, '/images/miga.jpg', N'Mì cay'),
(N'Mì Cay Rau Củ', N'Mì cay thanh đạm với nấm, bắp non, cà rốt và bông cải, thích hợp cho người ăn chay', 50000, '/images/mirau.jpg', N'Mì cay'),
(N'Mì Cay Thập Cẩm Đặc Biệt', N'Mì cay đặc biệt gồm tôm, mực, bò cuộn nấm, trứng và rau nấm tươi. Nước dùng đậm đà, cay nồng chuẩn vị Hàn Quốc.', 70000, '/images/midb.jpg', N'Mì cay');

-- 🥤 Các loại Đồ Uống
INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, DanhMuc)
VALUES
(N'Coca Cola', N'Nước ngọt có gas, giải khát tức thì', 15000, '/images/coca.jpg', N'Đồ uống'),
(N'Nước Cam Ép', N'Nước cam ép tươi, bổ sung vitamin C', 20000, '/images/camep.jpg', N'Đồ uống'),
(N'Nước Ép Dưa Hấu', N'Nước ép dưa hấu mát lạnh, giải nhiệt mùa hè', 20000, '/images/duaep.jpg', N'Đồ uống'),
(N'Chanh Tuyết', N'Nước chanh xay đá tuyết, vị chua ngọt dễ uống', 25000, '/images/chanh.jpg', N'Đồ uống');

-- 🍚 Các món Cơm
INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, DanhMuc)
VALUES
(N'Cơm Trộn Bò', N'Cơm trộn kiểu Hàn Quốc với thịt bò và rau củ tươi', 60000, '/images/combo.jpg', N'Cơm trộn'),
(N'Cơm Trộn Gà Nấm', N'Cơm trộn gà cùng nấm, trứng và rau củ thơm ngon', 55000, '/images/comga.jpg', N'Cơm trộn');

-- ➕ Món thêm / topping
INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, DanhMuc)
VALUES
(N'Cơm Thêm', N'Suất cơm thêm cho khách có nhu cầu', 5000, '/images/themcom.jpg', N'Topping'),
(N'Thêm Bò', N'Thêm phần thịt bò tươi mềm', 20000, '/images/thembo.jpg', N'Topping'),
(N'Thêm Mì', N'Thêm phần mì cho món mì cay', 10000, '/images/themmi.jpg', N'Topping');



select *from menu