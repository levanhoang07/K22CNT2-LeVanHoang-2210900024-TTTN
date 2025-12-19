#!/usr/bin/env python3
# app.py - Flask + SocketIO (eventlet)
import os
import logging
from datetime import datetime, timezone, timedelta

import eventlet
eventlet.monkey_patch()

from flask import request
from datetime import datetime, timedelta
from db import (
    get_cursor,
    fetch_one_as_dict,
    fetch_all_as_dict
)

import qrcode
from flask import Flask, request, jsonify, session,redirect, url_for, send_from_directory, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from db import get_cursor, test_connection  # giữ nguyên module DB của bạn
import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_socketio import SocketIO
import logging
# ===== LOGGING =====
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - [FLASK] - %(message)s"
)
logger = logging.getLogger(__name__)

# ===== INIT =====
app = Flask(__name__, static_folder="static")
app.secret_key = "hoang@2004"   # ✅ thêm dòng này
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")


# ===== HELPERS =====
def fetch_all_as_dict(cursor):
    if not cursor.description:
        return []
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]

def now_vietnam():
    return datetime.now(timezone(timedelta(hours=7)))

def make_full_image_url(raw_path: str):
    host = request.host_url.rstrip('/')
    if not raw_path:
        return f"{host}/static/images/no-image.jpg"
    path = raw_path.replace("\\", "/").strip()
    if path.lower().startswith("http://") or path.lower().startswith("https://"):
        return path
    path = path.lstrip("/")
    if path.startswith("static/"):
        return f"{host}/{path}"
    if path.startswith("images/") or path.startswith("qrcodes/"):
        return f"{host}/static/{path}"
    return f"{host}/static/images/{path}"

def save_qr_image(img, filename):
    folder = os.path.join(app.static_folder, "images", "qrcodes")
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, filename)
    img.save(path)
    return f"qrcodes/{filename}"

#baos caso
def get_date_filter(period, alias="d"):
    today = datetime.now().date()
    if period == "day":
        return f"CAST({alias}.NgayTao AS DATE) = '{today}'"
    elif period == "week":
        start_week = today - timedelta(days=today.weekday())
        return f"CAST({alias}.NgayTao AS DATE) >= '{start_week}'"
    elif period == "month":
        return f"YEAR({alias}.NgayTao) = {today.year} AND MONTH({alias}.NgayTao) = {today.month}"
    return "1=1"

# ===== SERVE images =====
@app.route("/images/<path:filename>")
def serve_image(filename):
    return send_from_directory(os.path.join(app.static_folder, "images"), filename)

# ===== MENU PUBLIC =====
@app.route("/api/menu", methods=["GET"])
def api_menu():
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT 
                    m.IDMon,
                    m.TenMon,
                    m.MoTa,
                    m.Gia,
                    m.HinhAnh,
                    dm.TenDanhMuc
                FROM Menu m
                JOIN DanhMuc dm ON m.IDDanhMuc = dm.IDDanhMuc
                WHERE m.TrangThai = 1
                ORDER BY m.TenMon
            """)
            rows = fetch_all_as_dict(cur)

        # xử lý đường dẫn ảnh
        for r in rows:
            r["HinhAnh"] = make_full_image_url(r.get("HinhAnh") or "")

        return jsonify({
            "status": "ok",
            "data": rows
        }), 200

    except Exception as e:
        logger.exception("Lỗi lấy menu: %s", e)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# ===== DON HANG - GET ALL =====
@app.route("/api/donhang", methods=["GET"])
def api_get_all_donhang():
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT 
                    d.IDDonHang,
                    d.IDBan,
                    d.IDNguoiDung,
                    d.TrangThaiThanhToan,
                    d.TongTien,
                    d.NgayTao,
                    ls.TrangThai
                FROM DonHang d
                OUTER APPLY (
                    SELECT TOP 1 TrangThai
                    FROM LichSuTrangThaiDonHang
                    WHERE IDDonHang = d.IDDonHang
                    ORDER BY ThoiGian DESC
                ) ls
                ORDER BY d.NgayTao DESC
            """)
            orders = fetch_all_as_dict(cur)

        return jsonify({"status": "ok", "data": orders}), 200

    except Exception as e:
        logger.exception("Lỗi lấy danh sách đơn hàng: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500
# ===== DON HANG - DETAIL =====
@app.route("/api/donhang/<int:iddon>", methods=["GET"])
def api_get_donhang_detail(iddon):
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT 
                    d.IDDonHang,
                    d.IDBan,
                    d.IDNguoiDung,
                    d.TrangThaiThanhToan,
                    d.TongTien,
                    d.NgayTao,
                    ls.TrangThai
                FROM DonHang d
                OUTER APPLY (
                    SELECT TOP 1 TrangThai
                    FROM LichSuTrangThaiDonHang
                    WHERE IDDonHang = d.IDDonHang
                    ORDER BY ThoiGian DESC
                ) ls
                WHERE d.IDDonHang = ?
            """, (iddon,))
            order = fetch_one_as_dict(cur)

            if not order:
                return jsonify({"status": "error", "message": "Không tìm thấy đơn"}), 404

            cur.execute("""
                SELECT 
                    ct.IDChiTiet,
                    ct.IDMon,
                    m.TenMon,
                    m.HinhAnh,
                    ct.SoLuong,
                    ct.DonGia,
                    ct.GhiChu,
                    ct.ThanhTien
                FROM ChiTietDonHang ct
                JOIN Menu m ON ct.IDMon = m.IDMon
                WHERE ct.IDDonHang = ?
            """, (iddon,))
            items = fetch_all_as_dict(cur)

            for it in items:
                it["HinhAnh"] = make_full_image_url(it.get("HinhAnh") or "")

            order["Items"] = items

        return jsonify({"status": "ok", "data": order}), 200

    except Exception as e:
        logger.exception("Lỗi lấy chi tiết đơn hàng: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500
# ===== DON HANG - CREATE =====
@app.route("/api/donhang", methods=["POST"])
def api_create_donhang():
    try:
        data = request.get_json(force=True)
        idban = data.get("IDBan") or data.get("table")
        items = data.get("Items") or data.get("items") or []

        if not idban or not items:
            return jsonify({"status": "error", "message": "Thiếu IDBan hoặc danh sách món"}), 400

        normalized_items = []
        for it in items:
            try:
                normalized_items.append({
                    "IDMon": int(it.get("IDMon") or it.get("id")),
                    "SoLuong": int(it.get("SoLuong") or it.get("qty") or 1),
                    "GhiChu": it.get("GhiChu") or ""
                })
            except Exception:
                continue

        if not normalized_items:
            return jsonify({"status": "error", "message": "Danh sách món không hợp lệ"}), 400

        now_vn = now_vietnam().replace(tzinfo=None)

        with get_cursor() as cur:
            # 1. Tạo đơn hàng
            cur.execute("""
                INSERT INTO DonHang (IDBan, TrangThaiThanhToan, NgayTao)
                OUTPUT INSERTED.IDDonHang
                VALUES (?, 0, ?)
            """, (idban, now_vn))
            iddon = cur.fetchone()[0]

            # 2. Lưu trạng thái ban đầu
            cur.execute("""
                INSERT INTO LichSuTrangThaiDonHang (IDDonHang, TrangThai)
                VALUES (?, N'Đã đặt')
            """, (iddon,))

            # 3. Lấy giá món
            ids = [i["IDMon"] for i in normalized_items]
            placeholders = ",".join("?" * len(ids))
            cur.execute(f"""
                SELECT IDMon, Gia FROM Menu WHERE IDMon IN ({placeholders})
            """, tuple(ids))
            price_map = {r[0]: float(r[1]) for r in cur.fetchall()}

            # 4. Thêm chi tiết đơn (TRIGGER tự cập nhật tổng tiền)
            for it in normalized_items:
                gia = price_map.get(it["IDMon"])
                if gia is None:
                    continue
                cur.execute("""
                    INSERT INTO ChiTietDonHang (IDDonHang, IDMon, SoLuong, DonGia, GhiChu)
                    VALUES (?, ?, ?, ?, ?)
                """, (iddon, it["IDMon"], it["SoLuong"], gia, it["GhiChu"]))

        socketio.emit("new_order", {
            "IDDonHang": iddon,
            "IDBan": idban,
            "TrangThai": "Đã đặt",
            "ThoiGian": now_vn.strftime("%Y-%m-%d %H:%M:%S")
        })

        return jsonify({"status": "ok", "IDDonHang": iddon}), 201

    except Exception as e:
        logger.exception("Lỗi tạo đơn hàng: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500

# ===== BẾP UPDATE TRẠNG THÁI =====
@app.route("/api/bep/cap-nhat-trang-thai/<int:iddon>", methods=["PUT"])
def api_bep_update(iddon):
    try:
        with get_cursor() as cur:
            # 1. Kiểm tra đơn tồn tại
            cur.execute("SELECT IDBan FROM DonHang WHERE IDDonHang=?", (iddon,))
            row = cur.fetchone()
            if not row:
                return jsonify({
                    "status": "error",
                    "message": "Không tìm thấy đơn hàng"
                }), 404

            idban = row[0]

            # 2. Ghi lịch sử trạng thái (KHÔNG UPDATE DonHang)
            cur.execute("""
                INSERT INTO LichSuTrangThaiDonHang (IDDonHang, TrangThai)
                VALUES (?, N'Hoàn tất')
            """, (iddon,))

            # 3. Lấy trạng thái mới nhất
            cur.execute("""
                SELECT TOP 1 TrangThai
                FROM LichSuTrangThaiDonHang
                WHERE IDDonHang=?
                ORDER BY ThoiGian DESC
            """, (iddon,))
            trangthai = cur.fetchone()[0]

        payload = {
            "IDDonHang": iddon,
            "IDBan": idban,
            "TrangThai": trangthai
        }

        # 4. Realtime cho frontend / thu ngân
        socketio.emit("bep_status_update", payload)

        return jsonify({
            "status": "ok",
            "payload": payload
        }), 200

    except Exception as e:
        logger.exception("Lỗi cập nhật trạng thái bếp: %s", e)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# ===== SOCKET EVENTS =====
@socketio.on("connect")
def on_connect():
    logger.info(f"Socket connected: {request.sid}")
    emit("connected", {"msg":"Kết nối socket thành công"})

@socketio.on("disconnect")
def on_disconnect():
    logger.info(f"Socket disconnected: {request.sid}")


# ===== ADMIN MENU CRUD =====
@app.route("/api/admin/menu", methods=["GET"])
def admin_list_menu():
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT 
                    m.IDMon,
                    m.TenMon,
                    m.MoTa,
                    m.Gia,
                    m.HinhAnh,
                    m.IDDanhMuc,
                    dm.TenDanhMuc,
                    m.TrangThai
                FROM Menu m
                JOIN DanhMuc dm ON m.IDDanhMuc = dm.IDDanhMuc
                ORDER BY m.IDMon DESC
            """)
            rows = fetch_all_as_dict(cur)

        for r in rows:
            r["HinhAnh"] = make_full_image_url(r.get("HinhAnh") or "")

        return jsonify({"status": "ok", "data": rows}), 200

    except Exception as e:
        logger.exception("Lỗi admin_list_menu: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500
@app.route("/api/admin/menu", methods=["POST"])
def admin_create_menu():
    try:
        data = request.get_json(force=True)

        ten = data.get("TenMon")
        iddm = data.get("IDDanhMuc")

        if not ten or not iddm:
            return jsonify({
                "status": "error",
                "message": "Thiếu TenMon hoặc IDDanhMuc"
            }), 400

        mota = data.get("MoTa", "")
        gia = float(data.get("Gia", 0))
        hinhanh = data.get("HinhAnh", "")

        with get_cursor() as cur:
            # kiểm tra danh mục tồn tại
            cur.execute("SELECT COUNT(*) FROM DanhMuc WHERE IDDanhMuc=?", (iddm,))
            if cur.fetchone()[0] == 0:
                return jsonify({"status":"error","message":"Danh mục không tồn tại"}),400

            cur.execute("""
                INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, IDDanhMuc, TrangThai)
                OUTPUT INSERTED.IDMon
                VALUES (?, ?, ?, ?, ?, 1)
            """, (ten, mota, gia, hinhanh, iddm))
            new_id = cur.fetchone()[0]

            cur.execute("""
                SELECT 
                    m.IDMon, m.TenMon, m.MoTa, m.Gia, m.HinhAnh,
                    m.IDDanhMuc, dm.TenDanhMuc, m.TrangThai
                FROM Menu m
                JOIN DanhMuc dm ON m.IDDanhMuc = dm.IDDanhMuc
                WHERE m.IDMon=?
            """, (new_id,))
            menu = fetch_one_as_dict(cur)

        menu["HinhAnh"] = make_full_image_url(menu.get("HinhAnh") or "")
        return jsonify({"status":"ok","menu":menu}), 201

    except Exception as e:
        logger.exception("Lỗi admin_create_menu: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500
@app.route("/api/admin/menu/<int:idmon>", methods=["PUT"])
def admin_update_menu(idmon):
    try:
        data = request.get_json(force=True)
        sets, params = [], []

        mapping = {
            "TenMon": "TenMon",
            "MoTa": "MoTa",
            "Gia": "Gia",
            "HinhAnh": "HinhAnh",
            "IDDanhMuc": "IDDanhMuc",
            "TrangThai": "TrangThai"
        }

        for k, col in mapping.items():
            if k in data:
                sets.append(f"{col}=?")
                val = data[k]
                if k == "Gia": val = float(val)
                if k == "TrangThai": val = int(val)
                params.append(val)

        if not sets:
            return jsonify({"status":"error","message":"Không có dữ liệu cập nhật"}),400

        params.append(idmon)

        with get_cursor() as cur:
            cur.execute(
                f"UPDATE Menu SET {', '.join(sets)} WHERE IDMon=?",
                tuple(params)
            )

            cur.execute("""
                SELECT 
                    m.IDMon, m.TenMon, m.MoTa, m.Gia, m.HinhAnh,
                    m.IDDanhMuc, dm.TenDanhMuc, m.TrangThai
                FROM Menu m
                JOIN DanhMuc dm ON m.IDDanhMuc = dm.IDDanhMuc
                WHERE m.IDMon=?
            """, (idmon,))
            menu = fetch_one_as_dict(cur)

        menu["HinhAnh"] = make_full_image_url(menu.get("HinhAnh") or "")
        return jsonify({"status":"ok","menu":menu}), 200

    except Exception as e:
        logger.exception("Lỗi admin_update_menu: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500
@app.route("/api/admin/menu/<int:idmon>", methods=["DELETE"])
def admin_delete_menu(idmon):
    try:
        with get_cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM ChiTietDonHang WHERE IDMon=?",
                (idmon,)
            )
            if cur.fetchone()[0] > 0:
                return jsonify({
                    "status":"error",
                    "message":"Không thể xóa món vì đã có đơn hàng"
                }), 400

            cur.execute("DELETE FROM Menu WHERE IDMon=?", (idmon,))

        return jsonify({"status":"ok"}), 200

    except Exception as e:
        logger.exception("Lỗi admin_delete_menu: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500
    
    

# ===== REPORT =====
@app.route("/api/report", methods=["GET"])
def get_report():
    try:
        period = request.args.get("period", "day")
        now = now_vietnam().replace(tzinfo=None)

        # ===== XÁC ĐỊNH MỐC THỜI GIAN =====
        if period == "day":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            # Thứ 2 đầu tuần
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "month":
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            return jsonify({
                "status": "error",
                "message": "period không hợp lệ (day | week | month)"
            }), 400

        with get_cursor() as cur:
            # ===== TỔNG ĐƠN + DOANH THU =====
            cur.execute("""
                SELECT 
                    COUNT(*) AS TotalOrders,
                    ISNULL(SUM(TongTien), 0) AS TotalRevenue
                FROM DonHang
                WHERE TrangThaiThanhToan = 1
                  AND NgayTao >= ?
            """, (start_date,))
            summary = fetch_one_as_dict(cur)

            # ===== CHI TIẾT DOANH THU THEO DANH MỤC =====
            cur.execute("""
                SELECT 
                    TenDanhMuc,
                    SUM(DoanhThu) AS DoanhThu
                FROM vBaoCaoDoanhThu
                WHERE Ngay >= ?
                GROUP BY TenDanhMuc
                ORDER BY DoanhThu DESC
            """, (start_date,))
            by_category = fetch_all_as_dict(cur)

        return jsonify({
            "status": "ok",
            "period": period,
            "startDate": start_date.isoformat(),
            "summary": {
                "totalOrders": summary["TotalOrders"],
                "totalRevenue": float(summary["TotalRevenue"])
            },
            "byCategory": by_category
        }), 200

    except Exception as e:
        logger.exception("Lỗi get_report: %s", e)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# ===== GỌI NHÂN VIÊN =====
@app.route("/api/call_staff", methods=["POST"])
def call_staff():
    try:
        data = request.get_json(force=True)
        idban = data.get("IDBan") or data.get("table")
        noidung = data.get("message", "Gọi nhân viên")

        if not idban:
            return jsonify({"status":"error","message":"Thiếu IDBan"}), 400

        with get_cursor() as cur:
            # kiểm tra bàn tồn tại
            cur.execute("SELECT COUNT(*) FROM Ban WHERE IDBan=?", (idban,))
            if cur.fetchone()[0] == 0:
                return jsonify({"status":"error","message":"Bàn không tồn tại"}), 404

            # ghi thông báo
            cur.execute("""
                INSERT INTO ThongBao (IDBan, NoiDung)
                VALUES (?, ?)
            """, (idban, noidung))

        payload = {
            "IDBan": idban,
            "NoiDung": noidung
        }

        socketio.emit("staff_call", payload)

        return jsonify({
            "status": "ok",
            "message": f"Bàn {idban} đã gọi nhân viên"
        }), 200

    except Exception as e:
        logger.exception("Lỗi call_staff: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500
# ===== THANH TOÁN =====
@app.route("/api/donhang/thanh-toan/<int:iddon>", methods=["PUT"])
def api_pay_donhang(iddon):
    try:
        data = request.get_json(force=True)
        idphuongthuc = data.get("IDPhuongThuc", 1)  # mặc định tiền mặt
        idnguoidung = data.get("IDNguoiDung")      # thu ngân

        with get_cursor() as cur:
            # kiểm tra đơn
            cur.execute("""
                SELECT TongTien, TrangThaiThanhToan
                FROM DonHang WHERE IDDonHang=?
            """, (iddon,))
            row = cur.fetchone()

            if not row:
                return jsonify({"status":"error","message":"Không tìm thấy đơn"}), 404

            if row[1]:
                return jsonify({"status":"error","message":"Đơn đã thanh toán"}), 400

            tongtien = float(row[0])

            # update đơn hàng
            cur.execute("""
                UPDATE DonHang
                SET TrangThaiThanhToan=1, IDNguoiDung=?
                WHERE IDDonHang=?
            """, (idnguoidung, iddon))

            # ghi thanh toán
            cur.execute("""
                INSERT INTO ThanhToan (IDDonHang, IDPhuongThuc, SoTien)
                VALUES (?, ?, ?)
            """, (iddon, idphuongthuc, tongtien))

        socketio.emit("order_paid", {
            "IDDonHang": iddon,
            "TongTien": tongtien
        })

        return jsonify({
            "status": "ok",
            "IDDonHang": iddon,
            "TongTien": tongtien,
            "message": "Thanh toán thành công"
        }), 200

    except Exception as e:
        logger.exception("Lỗi thanh toán: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500
# ===== REPORT: PAID / UNPAID =====
@app.route("/api/report/total-paid-unpaid")
def total_paid_unpaid():
    try:
        period = request.args.get("period", "day")
        now = now_vietnam().replace(tzinfo=None)

        if period == "day":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "month":
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            return jsonify({"status":"error","message":"period không hợp lệ"}),400

        with get_cursor() as cur:
            cur.execute("""
                SELECT
                    SUM(CASE WHEN TrangThaiThanhToan=1 THEN TongTien ELSE 0 END) AS Paid,
                    SUM(CASE WHEN TrangThaiThanhToan=0 THEN TongTien ELSE 0 END) AS Unpaid
                FROM DonHang
                WHERE NgayTao >= ?
            """, (start,))
            r = cur.fetchone()

        return jsonify({
            "Paid": float(r[0] or 0),
            "Unpaid": float(r[1] or 0)
        })

    except Exception as e:
        return jsonify({"status":"error","message":str(e)}), 500
# ===== REPORT: REVENUE BY CATEGORY =====
@app.route("/api/report/revenue-by-category")
def revenue_by_category():
    try:
        period = request.args.get("period", "day")
        now = now_vietnam().replace(tzinfo=None)

        if period == "day":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "month":
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            return jsonify({"status":"error","message":"period không hợp lệ"}),400

        with get_cursor() as cur:
            cur.execute("""
                SELECT TenDanhMuc, SUM(DoanhThu) AS DoanhThu
                FROM vBaoCaoDoanhThu
                WHERE Ngay >= ?
                GROUP BY TenDanhMuc
                ORDER BY DoanhThu DESC
            """, (start,))
            rows = fetch_all_as_dict(cur)

        return jsonify({"status":"ok","data":rows})

    except Exception as e:
        return jsonify({"status":"error","message":str(e)}), 500

 

# ========== ADMIN STAFF ==========

# ========== GET STAFF ==========
@app.route("/api/admin/staff", methods=["GET"])
def admin_list_staff():
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT 
                    IDNguoiDung,
                    TenDangNhap,
                    HoTen,
                    VaiTro,
                    TrangThai,
                    NgayTao
                FROM NguoiDung
                ORDER BY IDNguoiDung DESC
            """)
            rows = fetch_all_as_dict(cur)

        return jsonify({"status":"ok","data":rows}), 200

    except Exception as e:
        logger.exception("Lỗi admin_list_staff: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500
# ========== CREATE STAFF==========
@app.route("/api/admin/staff", methods=["POST"])
def admin_create_staff():
    try:
        data = request.get_json(force=True)

        username = data.get("TenDangNhap")
        fullname = data.get("HoTen")
        role = data.get("VaiTro")
        password = data.get("MatKhau") or "123456"

        if not username or not fullname or role not in ("Admin","Bep","ThuNgan"):
            return jsonify({"status":"error","message":"Dữ liệu không hợp lệ"}), 400

        with get_cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM NguoiDung WHERE TenDangNhap=?", (username,))
            if cur.fetchone()[0] > 0:
                return jsonify({"status":"error","message":"Tên đăng nhập đã tồn tại"}), 400

            cur.execute("""
                INSERT INTO NguoiDung (TenDangNhap, MatKhau, HoTen, VaiTro)
                OUTPUT INSERTED.IDNguoiDung
                VALUES (?, ?, ?, ?)
            """, (username, password, fullname, role))
            new_id = cur.fetchone()[0]

            cur.execute("""
                SELECT IDNguoiDung, TenDangNhap, HoTen, VaiTro, TrangThai
                FROM NguoiDung WHERE IDNguoiDung=?
            """, (new_id,))
            staff = fetch_one_as_dict(cur)

        return jsonify({"status":"ok","staff":staff}), 201

    except Exception as e:
        logger.exception("Lỗi admin_create_staff: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500
# ========== UPDATE STAFF ==========
@app.route("/api/admin/staff/<int:iduser>", methods=["PUT"])
def admin_update_staff(iduser):
    try:
        data = request.get_json(force=True)
        sets, params = [], []

        for field in ["TenDangNhap","HoTen","VaiTro","MatKhau","TrangThai"]:
            if field in data:
                sets.append(f"{field}=?")
                params.append(data[field])

        if not sets:
            return jsonify({"status":"error","message":"Không có dữ liệu cập nhật"}), 400

        params.append(iduser)

        with get_cursor() as cur:
            if "TenDangNhap" in data:
                cur.execute("""
                    SELECT COUNT(*) FROM NguoiDung
                    WHERE TenDangNhap=? AND IDNguoiDung<>?
                """, (data["TenDangNhap"], iduser))
                if cur.fetchone()[0] > 0:
                    return jsonify({"status":"error","message":"Tên đăng nhập đã tồn tại"}), 400

            cur.execute(f"""
                UPDATE NguoiDung SET {', '.join(sets)}
                WHERE IDNguoiDung=?
            """, tuple(params))

            cur.execute("""
                SELECT IDNguoiDung, TenDangNhap, HoTen, VaiTro, TrangThai
                FROM NguoiDung WHERE IDNguoiDung=?
            """, (iduser,))
            staff = fetch_one_as_dict(cur)

        return jsonify({"status":"ok","staff":staff}), 200

    except Exception as e:
        logger.exception("Lỗi admin_update_staff: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500
# ==========ADMIN GET ĐƠN HÀNG ==========
@app.route("/api/admin/donhang", methods=["GET"])
def admin_donhang_list():
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT 
                    d.IDDonHang,
                    d.IDBan,
                    d.TongTien,
                    d.TrangThaiThanhToan,
                    d.NgayTao,
                    ls.TrangThai
                FROM DonHang d
                OUTER APPLY (
                    SELECT TOP 1 TrangThai
                    FROM LichSuTrangThaiDonHang
                    WHERE IDDonHang=d.IDDonHang
                    ORDER BY ThoiGian DESC
                ) ls
                ORDER BY d.NgayTao DESC
            """)
            orders = fetch_all_as_dict(cur)

        return jsonify({"status":"ok","data":orders}), 200

    except Exception as e:
        logger.exception("Lỗi admin_donhang_list: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500
    
# ========== ADMIN UPDATE ĐƠN HÀNG ==========
@app.route("/api/admin/donhang/<int:iddon>", methods=["PUT"])
def admin_donhang_update(iddon):
    try:
        data = request.get_json(force=True)
        idban = data.get("IDBan")
        ghichu = data.get("GhiChu","")
        items = data.get("Items") or []

        if not idban or not items:
            return jsonify({"status":"error","message":"Thiếu dữ liệu"}), 400

        with get_cursor() as cur:
            cur.execute("""
                UPDATE DonHang SET IDBan=?, GhiChu=?
                WHERE IDDonHang=?
            """, (idban, ghichu, iddon))

            # Xóa & thêm lại chi tiết → TRIGGER tự tính
            cur.execute("DELETE FROM ChiTietDonHang WHERE IDDonHang=?", (iddon,))

            ids = [i["IDMon"] for i in items]
            placeholders = ",".join("?"*len(ids))
            cur.execute(
                f"SELECT IDMon, Gia FROM Menu WHERE IDMon IN ({placeholders})",
                tuple(ids)
            )
            prices = {r[0]: float(r[1]) for r in cur.fetchall()}

            for it in items:
                gia = prices.get(it["IDMon"])
                if gia is None:
                    continue
                cur.execute("""
                    INSERT INTO ChiTietDonHang
                    (IDDonHang, IDMon, SoLuong, DonGia, GhiChu)
                    VALUES (?, ?, ?, ?, ?)
                """, (iddon, it["IDMon"], it["SoLuong"], gia, it.get("GhiChu","")))

        return jsonify({"status":"ok","IDDonHang":iddon}), 200

    except Exception as e:
        logger.exception("Lỗi admin_donhang_update: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500
# ========== ADMIN DELETE ĐƠN HÀNG ==========
@app.route("/api/admin/donhang/<int:iddon>", methods=["DELETE"])
def admin_donhang_delete(iddon):
    try:
        with get_cursor() as cur:
            cur.execute("DELETE FROM DonHang WHERE IDDonHang=?", (iddon,))
        return jsonify({"status":"ok","IDDonHang":iddon}), 200
    except Exception as e:
        logger.exception("Lỗi xóa đơn hàng: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500
from functools import wraps

# ========== API ĐĂNG NHẬP ==========
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True)

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    role     = data.get("role", "").strip()

    if not username or not password or not role:
        return jsonify({
            "status": "error",
            "message": "Thiếu thông tin đăng nhập"
        }), 400

    with get_cursor() as cur:
        cur.execute("""
            SELECT IDNguoiDung, TenDangNhap, MatKhau, VaiTro, TrangThai
            FROM NguoiDung
            WHERE TenDangNhap = ?
              AND MatKhau = ?
              AND VaiTro = ?
        """, (username, password, role))

        user = cur.fetchone()

    if not user:
        return jsonify({
            "status": "error",
            "message": "Sai tài khoản, mật khẩu hoặc vai trò"
        }), 401

    if not user[4]:  # TrangThai = 0
        return jsonify({
            "status": "error",
            "message": "Tài khoản đã bị khóa"
        }), 403

    # ===== LƯU SESSION =====
    session["logged_in"] = True
    session["user_id"] = user[0]
    session["username"] = user[1]
    session["role"] = user[3]

    return jsonify({
        "status": "ok",
        "role": user[3]
    }), 200
# ========== CHẶN TRUY CẬP THEO ROLE ==========
def require_role(expected_role):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not session.get("logged_in"):
                return redirect("/")
            if session.get("role") != expected_role:
                return jsonify({
                    "status": "error",
                    "message": "Không có quyền truy cập"
                }), 403
            return func(*args, **kwargs)
        return wrapper
    return decorator
@app.route("/admin")
@require_role("Admin")
def admin_dashboard():
    return f"<h1>Trang quản trị</h1><p>Xin chào: {session.get('username')}</p>"


@app.route("/bep")
@require_role("Bep")
def bep_page():
    return "<h1>Giao diện Bếp</h1>"


@app.route("/thungan")
@require_role("ThuNgan")
def thu_ngan_page():
    return "<h1>Màn hình Thu Ngân</h1>"
@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")
@socketio.on("connect")
def handle_connect():
    print("Client connected")

@socketio.on("disconnect")
def handle_disconnect():
    print("Client disconnected")

# ===== RUN SERVER =====
if __name__ == "__main__":
    try:
        test_connection()
        logger.info("✅ Kết nối DB thành công.")
    except Exception as e:
        logger.critical("❌ Kết nối DB thất bại: %s", e)
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
