/* =====================================================
   1. TẠO DATABASE
===================================================== */
CREATE DATABASE MyCay_Oder;
GO
USE MyCay_Oder;
GO
CREATE USER flaskuser FOR LOGIN flaskuser;
GO

SELECT name, is_disabled
FROM sys.server_principals
WHERE name = 'flaskuser';
USE MyCay_Oder;
ALTER ROLE db_owner ADD MEMBER flaskuser;

/* =====================================================
   2. NGƯỜI DÙNG
===================================================== */
CREATE TABLE NguoiDung (
    IDNguoiDung INT IDENTITY PRIMARY KEY,
    TenDangNhap NVARCHAR(50) NOT NULL UNIQUE,
    MatKhau NVARCHAR(255) NOT NULL,
    HoTen NVARCHAR(100),
    VaiTro NVARCHAR(20) CHECK (VaiTro IN (N'Admin', N'Bep', N'ThuNgan')),
    TrangThai BIT DEFAULT 1,
    NgayTao DATETIME DEFAULT GETDATE()
);

/* =====================================================
   3. BÀN
===================================================== */
CREATE TABLE Ban (
    IDBan INT IDENTITY PRIMARY KEY,
    TenBan NVARCHAR(50) NOT NULL UNIQUE,
    MaQR NVARCHAR(255) UNIQUE,
    TrangThai NVARCHAR(20) DEFAULT N'Trống',
    NgayTao DATETIME DEFAULT GETDATE()
);

/* =====================================================
   4. DANH MỤC
===================================================== */
CREATE TABLE DanhMuc (
    IDDanhMuc INT IDENTITY PRIMARY KEY,
    TenDanhMuc NVARCHAR(50) NOT NULL UNIQUE
);
ALTER TABLE DanhMuc
ADD MoTa NVARCHAR(255),
    TrangThai NVARCHAR(50) DEFAULT N'Hoạt động';

/* =====================================================
   5. MENU
===================================================== */
CREATE TABLE Menu (
    IDMon INT IDENTITY PRIMARY KEY,
    TenMon NVARCHAR(100) NOT NULL,
    MoTa NVARCHAR(255),
    Gia DECIMAL(18,2) CHECK (Gia >= 0),
    HinhAnh NVARCHAR(255),
    IDDanhMuc INT NOT NULL,
    TrangThai BIT DEFAULT 1,
    NgayTao DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Menu_DanhMuc
        FOREIGN KEY (IDDanhMuc) REFERENCES DanhMuc(IDDanhMuc)
);

/* =====================================================
   6. ĐƠN HÀNG
===================================================== */
CREATE TABLE DonHang (
    IDDonHang INT IDENTITY PRIMARY KEY,
    IDBan INT NOT NULL,
    IDNguoiDung INT NULL,
    TongTien DECIMAL(18,2) DEFAULT 0,
    TrangThaiThanhToan BIT DEFAULT 0,
    GhiChu NVARCHAR(255),
    NgayTao DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IDBan) REFERENCES Ban(IDBan),
    FOREIGN KEY (IDNguoiDung) REFERENCES NguoiDung(IDNguoiDung)
);
ALTER TABLE DonHang
ADD TrangThai NVARCHAR(30) NOT NULL DEFAULT 'MOI_TAO';

/* =====================================================
   7. CHI TIẾT ĐƠN HÀNG
===================================================== */
CREATE TABLE ChiTietDonHang (
    IDChiTiet INT IDENTITY PRIMARY KEY,
    IDDonHang INT NOT NULL,
    IDMon INT NOT NULL,
    SoLuong INT CHECK (SoLuong > 0),
    DonGia DECIMAL(18,2) CHECK (DonGia >= 0),
    CapDoCay NVARCHAR(10),
    GhiChu NVARCHAR(255),
    ThanhTien AS (SoLuong * DonGia) PERSISTED,
    FOREIGN KEY (IDDonHang) REFERENCES DonHang(IDDonHang) ON DELETE CASCADE,
    FOREIGN KEY (IDMon) REFERENCES Menu(IDMon)
);
ALTER TABLE ChiTietDonHang 
ADD TrangThai NVARCHAR(50) DEFAULT N'CHỜ';
/* =====================================================
   8. TRIGGER CẬP NHẬT TỔNG TIỀN
===================================================== */
GO
CREATE TRIGGER trg_UpdateTongTien
ON ChiTietDonHang
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE DonHang
    SET TongTien = ISNULL((
        SELECT SUM(ThanhTien)
        FROM ChiTietDonHang
        WHERE IDDonHang = DonHang.IDDonHang
    ), 0)
    WHERE IDDonHang IN (
        SELECT IDDonHang FROM inserted
        UNION
        SELECT IDDonHang FROM deleted
    );
END;
GO

/* =====================================================
   9. LỊCH SỬ TRẠNG THÁI ĐƠN
===================================================== */
CREATE TABLE LichSuTrangThaiDonHang (
    ID INT IDENTITY PRIMARY KEY,
    IDDonHang INT NOT NULL,
    TrangThai NVARCHAR(50),
    ThoiGian DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IDDonHang) REFERENCES DonHang(IDDonHang) ON DELETE CASCADE
);



/* =====================================================
   10. PHƯƠNG THỨC THANH TOÁN
===================================================== */
CREATE TABLE PhuongThucThanhToan (
    IDPhuongThuc INT IDENTITY PRIMARY KEY,
    TenPhuongThuc NVARCHAR(50) UNIQUE,
    TrangThai BIT DEFAULT 1
);

/* =====================================================
   11. THANH TOÁN
===================================================== */
CREATE TABLE ThanhToan (
    IDThanhToan INT IDENTITY PRIMARY KEY,
    IDDonHang INT NOT NULL,
    IDPhuongThuc INT NOT NULL,
    SoTien DECIMAL(18,2) CHECK (SoTien >= 0),
    ThoiGian DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IDDonHang) REFERENCES DonHang(IDDonHang),
    FOREIGN KEY (IDPhuongThuc) REFERENCES PhuongThucThanhToan(IDPhuongThuc)
);

/* =====================================================
   12. KHÁCH HÀNG
===================================================== */
CREATE TABLE KhachHang (
    IDKhachHang INT IDENTITY PRIMARY KEY,
    TenKhachHang NVARCHAR(100),
    SoDienThoai NVARCHAR(15) UNIQUE,
    DiemTichLuy INT DEFAULT 0
);
ALTER TABLE KhachHang
ADD Email NVARCHAR(100),
    TrangThai NVARCHAR(50) DEFAULT N'Hoạt động';

/* =====================================================
   13. LỊCH SỬ TÍCH ĐIỂM
===================================================== */
CREATE TABLE LichSuTichDiem (
    ID INT IDENTITY PRIMARY KEY,
    IDKhachHang INT,
    IDDonHang INT,
    SoDiem INT,
    ThoiGian DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IDKhachHang) REFERENCES KhachHang(IDKhachHang),
    FOREIGN KEY (IDDonHang) REFERENCES DonHang(IDDonHang)
);

/* =====================================================
   14. KHUYẾN MÃI
===================================================== */
CREATE TABLE KhuyenMai (
    IDKhuyenMai INT IDENTITY PRIMARY KEY,
    TenKhuyenMai NVARCHAR(100),
    LoaiGiamGia NVARCHAR(20),
    GiaTri DECIMAL(10,2),
    TrangThai BIT DEFAULT 1
);

CREATE TABLE DonHang_KhuyenMai (
    ID INT IDENTITY PRIMARY KEY,
    IDDonHang INT,
    IDKhuyenMai INT,
    SoTienGiam DECIMAL(18,2),
    FOREIGN KEY (IDDonHang) REFERENCES DonHang(IDDonHang),
    FOREIGN KEY (IDKhuyenMai) REFERENCES KhuyenMai(IDKhuyenMai)
);

/* =====================================================
   15. THÔNG BÁO
===================================================== */
CREATE TABLE ThongBao (
    IDThongBao INT IDENTITY PRIMARY KEY,
    IDBan INT,
    NoiDung NVARCHAR(255),
    TrangThai BIT DEFAULT 0,
    ThoiGian DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IDBan) REFERENCES Ban(IDBan)
);
/* =====================================================
   16. VIEW BÁO CÁO DOANH THU
===================================================== */
GO
CREATE VIEW vBaoCaoDoanhThu
AS
SELECT
    CONVERT(DATE, d.NgayTao) AS Ngay,
    dm.TenDanhMuc,
    SUM(ct.ThanhTien) AS DoanhThu
FROM DonHang d
JOIN ChiTietDonHang ct ON d.IDDonHang = ct.IDDonHang
JOIN Menu m ON ct.IDMon = m.IDMon
JOIN DanhMuc dm ON m.IDDanhMuc = dm.IDDanhMuc
WHERE d.TrangThaiThanhToan = 1
GROUP BY CONVERT(DATE, d.NgayTao), dm.TenDanhMuc;
GO
IF OBJECT_ID('vBaoCaoDoanhThu', 'V') IS NOT NULL
    DROP VIEW vBaoCaoDoanhThu;
GO
/* =====================================================
   17. Bảng đánh giá
===================================================== */
CREATE TABLE DanhGia (
    IDDanhGia INT IDENTITY PRIMARY KEY,
    TenKhachHang NVARCHAR(100) NULL,   -- Có thể để trống (ẩn danh)
    NoiDung NVARCHAR(500) NOT NULL,    -- Nội dung đánh giá
    IDBan INT NULL,                    -- Biết đánh giá từ bàn nào (optional)
    NgayDanhGia DATETIME DEFAULT GETDATE(),
    TrangThai BIT DEFAULT 1            -- Admin duyệt / ẩn
);
GO

/* =====================================================
   18. DỮ LIỆU MẪU
===================================================== */

INSERT INTO NguoiDung (TenDangNhap, MatKhau, HoTen, VaiTro)
VALUES
('admin', '123456', N'Quản trị viên', N'Admin'),
('bep01', '123456', N'Nhân viên bếp', N'Bep'),
('cashier01', '123456', N'Thu ngân', N'ThuNgan');

INSERT INTO Ban (TenBan, MaQR)
VALUES
(N'Bàn 1', 'QR_BAN_1'),
(N'Bàn 2', 'QR_BAN_2'),
(N'Bàn 3', 'QR_BAN_3');

INSERT INTO DanhMuc (TenDanhMuc)
VALUES
(N'Mì cay'),
(N'Cơm trộn'),
(N'Đồ uống'),
(N'Topping');

INSERT INTO PhuongThucThanhToan (TenPhuongThuc)
VALUES
(N'Tiền mặt'),
(N'Chuyển khoản'),
(N'Crypto');


INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, IDDanhMuc)
VALUES
(N'Mì Cay Gà', N'Mì cay thịt gà', 55000, '/images/miga.jpg', 1),
(N'Coca Cola', N'Nước ngọt', 15000, '/images/coca.jpg', 3);

INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, IDDanhMuc)
VALUES
(N'Mì Cay Gà',
 N'Mì cay thịt gà mềm thơm, nước dùng cay nhẹ, đậm đà hương vị',
 55000, '/images/miga.jpg', 1),

(N'Mì Cay Rau Củ',
 N'Mì cay thanh đạm với nấm, bắp non, cà rốt và bông cải, thích hợp cho người ăn chay',
 50000, '/images/mirau.jpg', 1),

(N'Mì Cay Thập Cẩm Đặc Biệt',
 N'Mì cay đặc biệt gồm tôm, mực, bò cuộn nấm, trứng và rau nấm tươi. Nước dùng đậm đà, cay nồng chuẩn vị Hàn Quốc.',
 70000, '/images/midb.jpg', 1);
GO


/* ======================================================
   🥤 ĐỒ UỐNG (IDDanhMuc = 3)
====================================================== */
INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, IDDanhMuc)
VALUES
(N'Coca Cola',
 N'Nước ngọt có gas, giải khát tức thì',
 15000, '/images/coca.jpg', 3),

(N'Nước Cam Ép',
 N'Nước cam ép tươi, bổ sung vitamin C',
 20000, '/images/camep.jpg', 3),

(N'Nước Ép Dưa Hấu',
 N'Nước ép dưa hấu mát lạnh, giải nhiệt mùa hè',
 20000, '/images/duaep.jpg', 3),

(N'Chanh Tuyết',
 N'Nước chanh xay đá tuyết, vị chua ngọt dễ uống',
 25000, '/images/chanh.jpg', 3);
GO


/* ======================================================
   🍚 CƠM TRỘN (IDDanhMuc = 2)
====================================================== */
INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, IDDanhMuc)
VALUES
(N'Cơm Trộn Bò',
 N'Cơm trộn kiểu Hàn Quốc với thịt bò và rau củ tươi',
 60000, '/images/combo.jpg', 2),

(N'Cơm Trộn Gà Nấm',
 N'Cơm trộn gà cùng nấm, trứng và rau củ thơm ngon',
 55000, '/images/comga.jpg', 2);
GO
/* ======================================================
   ➕ TOPPING / MÓN THÊM (IDDanhMuc = 4)
====================================================== */
INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, IDDanhMuc)
VALUES
(N'Cơm Thêm',
 N'Suất cơm thêm cho khách có nhu cầu',
 5000, '/images/themcom.jpg', 4),

(N'Thêm Bò',
 N'Thêm phần thịt bò tươi mềm',
 20000, '/images/thembo.jpg', 4),

(N'Thêm Mì',
 N'Thêm phần mì cho món mì cay',
 10000, '/images/themmi.jpg', 4);
GO
INSERT INTO DanhGia (TenKhachHang, NoiDung, IDBan)
VALUES
-- 🔹 Có tên
(N'Nguyễn Văn A', N'Mì cay rất ngon, nước dùng đậm đà, sẽ quay lại lần sau ❤️', 1),
(N'Lê Thị B', N'Không gian quán sạch sẽ, nhân viên phục vụ nhiệt tình 👍', 2),
(N'Trần Minh C', N'Cơm trộn ngon, phần ăn đầy đặn, giá hợp lý.', 3),

-- 🔹 Ẩn danh
(NULL, N'Mì cay cấp 3 vừa ăn, không quá cay. Rất ổn!', 1),
(NULL, N'Đồ uống mát, giải khát tốt. Chanh tuyết rất ngon 🍋', 2),

-- 🔹 Góp ý nhẹ
(N'Hoàng Anh', N'Quán đông nên chờ hơi lâu, nhưng đồ ăn ngon nên chấp nhận được.', 1),
(NULL, N'Nên mở nhạc nhẹ hơn một chút để dễ nói chuyện.', 3);
GO
-- bỏ /images/
UPDATE Menu
SET HinhAnh = REPLACE(HinhAnh, '/images/', '')
WHERE HinhAnh LIKE '%/images/%';

-- bỏ images/
UPDATE Menu
SET HinhAnh = REPLACE(HinhAnh, 'images/', '')
WHERE HinhAnh LIKE '%images/%';

-- bỏ /static/images/
UPDATE Menu
SET HinhAnh = REPLACE(HinhAnh, '/static/images/', '')
WHERE HinhAnh LIKE '%static/images%';
SELECT IDMon, HinhAnh FROM Menu;
SELECT * FROM DonHang

INSERT INTO LichSuTrangThaiDonHang (IDDonHang, TrangThai, ThoiGian)
SELECT d.IDDonHang, N'Hoàn thành', GETDATE()
FROM DonHang d
WHERE NOT EXISTS (
    SELECT 1
    FROM LichSuTrangThaiDonHang ls
    WHERE ls.IDDonHang = d.IDDonHang
      AND ls.TrangThai = N'Hoàn thành'
);

SELECT d.IDDonHang, b.TenBan, ls.TrangThai, ls.ThoiGian
FROM DonHang d
JOIN Ban b ON d.IDBan = b.IDBan
OUTER APPLY (
    SELECT TOP 1 TrangThai, ThoiGian
    FROM LichSuTrangThaiDonHang
    WHERE IDDonHang = d.IDDonHang
    ORDER BY ThoiGian DESC
) ls
ORDER BY d.IDDonHang DESC;

SELECT DISTINCT TrangThai
FROM DonHang
ORDER BY TrangThai;
