#!/usr/bin/env python3
# =====================================================
# MyCay_Oder – Flask + SocketIO (FULL)
# =====================================================

import os
import logging
from datetime import datetime, timezone, timedelta

import eventlet
eventlet.monkey_patch()

from flask import (
    Flask, request, jsonify,
    render_template, send_from_directory
)
from flask_cors import CORS
from flask_socketio import SocketIO, emit

from db import (
    get_cursor,
    fetch_all_as_dict,
    fetch_one_as_dict,
    test_connection
)

# =====================================================
# CONFIG
# =====================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - [FLASK] - %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = "mycay_secret"

CORS(app, resources={r"/*": {"origins": "*"}})

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet"
)

# =====================================================
# HELPERS
# =====================================================
def now_vn():
    return datetime.now(timezone(timedelta(hours=7)))

def make_full_image_url(path):
    if not path:
        return "/static/images/no-image.jpg"

    path = path.replace("\\", "/").strip()

    # đã là url đầy đủ
    if path.startswith("http://") or path.startswith("https://"):
        return path

    # đã là đường dẫn static đầy đủ
    if path.startswith("/static/"):
        return path

    # đã bắt đầu bằng images/
    if path.startswith("images/"):
        return f"/static/{path}"

    # đã bắt đầu bằng static/
    if path.startswith("static/"):
        return "/" + path

    # chỉ là tên file: combo.jpg
    return f"/static/images/{path}"

# =====================================================
# SERVE PAGES
# =====================================================
@app.route("/")
def index_page():
    return render_template("index.html")

@app.route("/admin")
def admin_page():
    return render_template("admin.html")

@app.route("/thungan")
def thungan_page():
    return render_template("thungan.html")
# =====================================================
# PUBLIC API – MENU (CLIENT)
# =====================================================
@app.route("/api/menu", methods=["GET"])
def api_menu():
    with get_cursor() as cur:
        cur.execute("""
            SELECT
                m.IDMon, m.TenMon, m.MoTa, m.Gia,
                m.HinhAnh, m.IDDanhMuc, dm.TenDanhMuc
            FROM Menu m
            JOIN DanhMuc dm ON m.IDDanhMuc = dm.IDDanhMuc
            WHERE m.TrangThai = 1
            ORDER BY dm.TenDanhMuc, m.TenMon
        """)
        rows = fetch_all_as_dict(cur)

    for r in rows:
        r["HinhAnh"] = make_full_image_url(r["HinhAnh"])
# =====================================================
# PUBLIC API – BÀn (CLIENT)
# =====================================================
    return jsonify({"status": "ok", "data": rows})
@app.route("/api/ban", methods=["GET"])
def api_get_tables():
    with get_cursor() as cur:
        cur.execute("""
            SELECT IDBan, TenBan, TrangThai, MaQR, NgayTao
            FROM Ban
            ORDER BY IDBan
        """)
        rows = fetch_all_as_dict(cur)
    return jsonify({
        "status": "ok",
        "data": rows
    })
    # =====================================================
# Kiêm tra abn tồn tại (CLIENT)
# =====================================================
@app.route("/api/ban/<int:idban>", methods=["GET"])
def api_get_table(idban):
    with get_cursor() as cur:
        cur.execute("SELECT * FROM Ban WHERE IDBan = ?", (idban,))
        row = fetch_one_as_dict(cur)

    if not row:
        return jsonify({
            "status": "error",
            "message": "Bàn không tồn tại"
        }), 404

    return jsonify({
        "status": "ok",
        "data": row
    })

@app.route("/api/order/add", methods=["POST"])
def add_or_merge_order_item():
    try:
        data = request.get_json(force=True)

        IDBan = data.get("IDBan")
        IDMon = data.get("IDMon")
        SoLuong = int(data.get("SoLuong", 1))
        CapDoCay = data.get("CapDoCay")
        GhiChu = data.get("GhiChu")

        if not IDBan or not IDMon:
            return jsonify({"status": "error", "message": "Thiếu IDBan hoặc IDMon"}), 400

        with get_cursor() as cur:
            # 1️⃣ TÌM ĐƠN CHƯA THANH TOÁN
            cur.execute("""
                SELECT TOP 1 IDDonHang
                FROM DonHang
                WHERE IDBan = ?
                  AND TrangThaiThanhToan = 0
                ORDER BY IDDonHang DESC
            """, (IDBan,))
            row = cur.fetchone()

            if row:
                IDDonHang = row[0]
            else:
                # 2️⃣ TẠO ĐƠN MỚI
                cur.execute("""
                    INSERT INTO DonHang (IDBan, TrangThaiThanhToan, NgayTao)
                    OUTPUT INSERTED.IDDonHang
                    VALUES (?, 0, GETDATE())
                """, (IDBan,))
                IDDonHang = cur.fetchone()[0]

            # 3️⃣ KIỂM TRA MÓN TRÙNG
            cur.execute("""
                SELECT IDChiTiet, SoLuong
                FROM ChiTietDonHang
                WHERE IDDonHang = ?
                  AND IDMon = ?
                  AND ISNULL(CapDoCay, '') = ISNULL(?, '')
                  AND ISNULL(GhiChu, '') = ISNULL(?, '')
            """, (IDDonHang, IDMon, CapDoCay, GhiChu))
            ct = cur.fetchone()

            if ct:
                # 4️⃣ GỘP MÓN → TĂNG SỐ LƯỢNG
                cur.execute("""
                    UPDATE ChiTietDonHang
                    SET SoLuong = SoLuong + ?
                    WHERE IDChiTiet = ?
                """, (SoLuong, ct[0]))
            else:
                # 5️⃣ LẤY GIÁ MÓN
                cur.execute("SELECT Gia FROM Menu WHERE IDMon = ?", (IDMon,))
                row_gia = cur.fetchone()
                if not row_gia:
                    raise Exception("Món không tồn tại")

                DonGia = row_gia[0]

                # 6️⃣ THÊM MÓN MỚI
                cur.execute("""
                    INSERT INTO ChiTietDonHang
                    (IDDonHang, IDMon, SoLuong, DonGia, ThanhTien, CapDoCay, GhiChu)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    IDDonHang,
                    IDMon,
                    SoLuong,
                    DonGia,
                    DonGia * SoLuong,
                    CapDoCay,
                    GhiChu
                ))

        # 7️⃣ SOCKET REALTIME
        socketio.emit("new_order", {"IDBan": IDBan})

        return jsonify({
            "status": "ok",
            "message": "Đã thêm / gộp món",
            "IDDonHang": IDDonHang
        })

    except Exception as e:
        logger.exception("❌ LỖI ADD ORDER")
        return jsonify({"status": "error", "message": str(e)}), 500

# =====================================================
# lịch suwr đơn cảu bàn
@app.route("/api/ban/<int:IDBan>/lichsu", methods=["GET"])
def api_lich_su_don_hang(IDBan):
    with get_cursor() as cur:
        cur.execute("""
            SELECT
                d.IDDonHang,
                d.NgayTao,
                d.TongTien
            FROM DonHang d
            WHERE d.IDBan = ?
              AND d.TrangThaiThanhToan = 0
            ORDER BY d.IDDonHang DESC
        """, (IDBan,))
        orders = fetch_all_as_dict(cur)

    return jsonify({
        "status": "ok",
        "data": orders
    })
# =====================================================
# chi tiết đơn hàng (khách xem lại món đã đăthj)
@app.route("/api/ban/donhang/<int:IDDonHang>", methods=["GET"])
def api_chi_tiet_don_hang(IDDonHang):
    with get_cursor() as cur:
        cur.execute("""
            SELECT
                m.TenMon,
                ct.SoLuong,
                ct.DonGia,
                ct.CapDoCay,
                ct.GhiChu,
                ct.ThanhTien
            FROM ChiTietDonHang ct
            JOIN Menu m ON ct.IDMon = m.IDMon
            WHERE ct.IDDonHang = ?
        """, (IDDonHang,))
        items = fetch_all_as_dict(cur)

    return jsonify({
        "status": "ok",
        "items": items
    })
# =====================================================
# THU NGÂN – LẤY BÀN ĐANG CÓ ĐƠN
# =====================================================
@app.route("/api/thungan/ban", methods=["GET"])
def cashier_tables():
    with get_cursor() as cur:
        cur.execute("""
            SELECT DISTINCT b.IDBan, b.TenBan
            FROM DonHang d
            JOIN Ban b ON d.IDBan = b.IDBan
            WHERE d.TrangThaiThanhToan = 0
        """)
        rows = fetch_all_as_dict(cur)

    return jsonify({
        "status": "ok",
        "data": rows
    })
    
# =====================================================
# THU NGÂN – LẤY CHI TIẾT ĐƠN HÀNG THEO BÀN
# =====================================================
@app.route("/api/thungan/ban/<int:IDBan>/donhang", methods=["GET"])
def cashier_order_detail(IDBan):
    with get_cursor() as cur:
        # 1️⃣ Lấy đơn CHƯA THANH TOÁN mới nhất của bàn
        cur.execute("""
            SELECT TOP 1 *
            FROM DonHang
            WHERE IDBan = ? AND TrangThaiThanhToan = 0
            ORDER BY NgayTao DESC
        """, (IDBan,))
        donhang = fetch_one_as_dict(cur)

        if not donhang:
            return jsonify({
                "status": "ok",
                "donhang": None,
                "items": []
            })

        IDDonHang = donhang["IDDonHang"]

        # 2️⃣ Lấy chi tiết đơn
        cur.execute("""
            SELECT
                ct.IDChiTiet,
                ct.IDMon,
                m.TenMon,
                ct.SoLuong,
                ct.DonGia,
                ct.CapDoCay,
                ct.GhiChu,
                ct.ThanhTien
            FROM ChiTietDonHang ct
            JOIN Menu m ON ct.IDMon = m.IDMon
            WHERE ct.IDDonHang = ?
        """, (IDDonHang,))
        items = fetch_all_as_dict(cur)

    return jsonify({
        "status": "ok",
        "donhang": donhang,
        "items": items
    })
# =====================================================
# THU NGÂN – THANH TOÁN ĐƠN & RESET BÀN
# =====================================================
@app.route("/api/thungan/thanhtoan/<int:IDDonHang>", methods=["POST"])
def cashier_pay(IDDonHang):
    data = request.get_json()

    IDPhuongThuc = data.get("IDPhuongThuc")   # 1: tiền mặt, 2: chuyển khoản
    SoTien = data.get("SoTien")
    IDKhachHang = data.get("IDKhachHang")     # có thể null

    if not IDPhuongThuc or not SoTien:
        return jsonify({"status": "error", "message": "Thiếu dữ liệu"}), 400

    with get_cursor() as cur:
        # 1️⃣ Lấy bàn của đơn
        cur.execute("""
            SELECT IDBan FROM DonHang WHERE IDDonHang = ?
        """, (IDDonHang,))
        row = cur.fetchone()
        if not row:
            return jsonify({"status": "error", "message": "Không tìm thấy đơn"}), 404

        IDBan = row[0]

        # 2️⃣ Cập nhật đơn → đã thanh toán
        cur.execute("""
            UPDATE DonHang
            SET TrangThaiThanhToan = 1
            WHERE IDDonHang = ?
        """, (IDDonHang,))

        # 3️⃣ Lưu thanh toán
        cur.execute("""
            INSERT INTO ThanhToan (IDDonHang, IDPhuongThuc, SoTien)
            VALUES (?, ?, ?)
        """, (IDDonHang, IDPhuongThuc, SoTien))

        # 4️⃣ Tích điểm khách hàng (nếu có)
        if IDKhachHang:
            diem = int(SoTien / 10000)  # 10k = 1 điểm

            cur.execute("""
                UPDATE KhachHang
                SET DiemTichLuy = DiemTichLuy + ?
                WHERE IDKhachHang = ?
            """, (diem, IDKhachHang))

            cur.execute("""
                INSERT INTO LichSuTichDiem
                (IDKhachHang, IDDonHang, SoDiem)
                VALUES (?, ?, ?)
            """, (IDKhachHang, IDDonHang, diem))

        # 5️⃣ Reset bàn
        cur.execute("""
            UPDATE Ban
            SET TrangThai = N'Trống'
            WHERE IDBan = ?
        """, (IDBan,))

    # 6️⃣ Realtime socket
    socketio.emit("order_paid", {
        "IDDonHang": IDDonHang,
        "IDBan": IDBan
    })

    return jsonify({
        "status": "ok",
        "message": "Thanh toán thành công"
    })

# =====================================================
# KHÁCH HÀNG – TRA CỨU THEO SĐT
# =====================================================
@app.route("/api/khachhang/sdt/<sdt>", methods=["GET"])
def get_customer_by_phone(sdt):
    with get_cursor() as cur:
        cur.execute("""
            SELECT * FROM KhachHang WHERE SoDienThoai = ?
        """, (sdt,))
        kh = fetch_one_as_dict(cur)

    return jsonify({
        "status": "ok",
        "data": kh  # null nếu chưa có
    })

# =====================================================
# CLIENT – CALL STAFF
# =====================================================
@app.route("/api/thongbao", methods=["POST"])
def call_staff():
    data = request.get_json()
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO ThongBao (IDBan, NoiDung, TrangThai, ThoiGian)
            VALUES (?, ?, 0, ?)
        """, (data["IDBan"], data["NoiDung"], now_vn()))

    socketio.emit("call_staff", data)
    return jsonify({"status": "ok"})

# =====================================================
# ADMIN – DASHBOARD
# =====================================================
@app.route("/api/admin/dashboard")
def admin_dashboard():
    with get_cursor() as cur:
        cur.execute("SELECT SUM(TongTien) Tong FROM DonHang WHERE CAST(NgayTao AS DATE)=CAST(GETDATE() AS DATE)")
        revenue = cur.fetchone()[0] or 0

        cur.execute("SELECT COUNT(*) FROM DonHang WHERE CAST(NgayTao AS DATE)=CAST(GETDATE() AS DATE)")
        orders = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM Menu")
        menu = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM Ban")
        tables = cur.fetchone()[0]

        cur.execute("""
            SELECT TOP 5 IDDonHang, IDBan, TongTien, TrangThaiThanhToan
            FROM DonHang ORDER BY NgayTao DESC
        """)
        recent = fetch_all_as_dict(cur)

    return jsonify({
        "revenue": revenue,
        "orders": orders,
        "menu": menu,
        "tables": tables,
        "recentOrders": recent,
        "chart": []
    })

# =====================================================
# ADMIN – MENU
# =====================================================
@app.route("/api/admin/menu")
def admin_menu():
    with get_cursor() as cur:
        cur.execute("""
            SELECT m.*, dm.TenDanhMuc
            FROM Menu m
            JOIN DanhMuc dm ON m.IDDanhMuc = dm.IDDanhMuc
            ORDER BY m.IDMon DESC
        """)
        rows = fetch_all_as_dict(cur)

    for r in rows:
        r["HinhAnh"] = make_full_image_url(r["HinhAnh"])

    return jsonify(rows)

# =====================================================
# ADMIN – DANH MỤC
# =====================================================
@app.route("/api/admin/danhmuc")
def admin_categories():
    with get_cursor() as cur:
        cur.execute("""
            SELECT d.IDDanhMuc, d.TenDanhMuc,
            (SELECT COUNT(*) FROM Menu m WHERE m.IDDanhMuc=d.IDDanhMuc) AS SoMon
            FROM DanhMuc d
        """)
        return jsonify(fetch_all_as_dict(cur))

# =====================================================
# ADMIN – BÀN
# =====================================================
@app.route("/api/admin/ban")
def admin_tables():
    with get_cursor() as cur:
        cur.execute("SELECT * FROM Ban")
        return jsonify(fetch_all_as_dict(cur))
# =====================================================
# ADMIN – TẠO BÀN  
@app.route("/api/admin/ban", methods=["POST"])
def admin_create_table():
    data = request.get_json()
    tenban = data.get("TenBan")

    if not tenban:
        return jsonify({"status": "error"}), 400

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO Ban (TenBan, TrangThai)
            VALUES (?, N'Trống')
        """, (tenban,))

    return jsonify({"status": "ok"})
# =====================================================
# ADMIN – CẬP NHẬT TRẠNG THÁI BÀN   
@app.route("/api/admin/ban/<int:idban>", methods=["PUT"])
def admin_update_table(idban):
    data = request.get_json()
    trangthai = data.get("TrangThai")

    with get_cursor() as cur:
        cur.execute("""
            UPDATE Ban SET TrangThai = ?
            WHERE IDBan = ?
        """, (trangthai, idban))

    return jsonify({"status": "ok"})
# =====================================================
# ADMIN – XÓA BÀN
@app.route("/api/admin/ban/<int:idban>", methods=["DELETE"])
def admin_delete_table(idban):
    with get_cursor() as cur:
        cur.execute("DELETE FROM Ban WHERE IDBan = ?", (idban,))
    return jsonify({"status": "ok"})

# =====================================================
# ADMIN – USERS
# =====================================================
@app.route("/api/admin/users")
def admin_users():
    with get_cursor() as cur:
        cur.execute("SELECT * FROM NguoiDung")
        return jsonify(fetch_all_as_dict(cur))

# =====================================================
# ADMIN – KHÁCH HÀNG
# =====================================================
@app.route("/api/admin/khachhang")
def admin_customers():
    with get_cursor() as cur:
        cur.execute("SELECT * FROM KhachHang")
        return jsonify(fetch_all_as_dict(cur))

# =====================================================
# ADMIN – KHUYẾN MÃI
# =====================================================
@app.route("/api/admin/khuyenmai")
def admin_promotions():
    with get_cursor() as cur:
        cur.execute("SELECT * FROM KhuyenMai")
        return jsonify(fetch_all_as_dict(cur))

# =====================================================
# ADMIN – THANH TOÁN
# =====================================================
@app.route("/api/admin/thanhtoan")
def admin_payments():
    with get_cursor() as cur:
        cur.execute("""
            SELECT t.*, p.TenPhuongThuc
            FROM ThanhToan t
            JOIN PhuongThucThanhToan p ON t.IDPhuongThuc = p.IDPhuongThuc
            ORDER BY t.ThoiGian DESC
        """)
        return jsonify(fetch_all_as_dict(cur))

# =====================================================
# ADMIN – THÔNG BÁO
# =====================================================
@app.route("/api/admin/thongbao")
def admin_notifications():
    with get_cursor() as cur:
        cur.execute("""
            SELECT * FROM ThongBao ORDER BY ThoiGian DESC
        """)
        return jsonify(fetch_all_as_dict(cur))

# =====================================================
# SOCKET
# =====================================================
@socketio.on("connect")
def on_connect():
    logger.info("🔌 Client connected")

@socketio.on("disconnect")
def on_disconnect():
    logger.info("🔌 Client disconnected")

# =====================================================
# RUN
# =====================================================
if __name__ == "__main__":
    test_connection()
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
