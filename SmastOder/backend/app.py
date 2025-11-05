#!/usr/bin/env python3
# app.py - Flask + SocketIO (eventlet)
import os
import logging
from datetime import datetime, timezone, timedelta

import eventlet
eventlet.monkey_patch()

from flask import request
from datetime import datetime, timedelta

import qrcode
from flask import Flask, request, jsonify, session,redirect, url_for, send_from_directory, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from db import get_cursor, test_connection  # giữ nguyên module DB của bạn
import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
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
                SELECT IDMon, TenMon, MoTa, Gia, HinhAnh, ISNULL(DanhMuc,'') AS DanhMuc
                FROM Menu WHERE TrangThai=1 ORDER BY TenMon
            """)
            rows = fetch_all_as_dict(cur)
        for r in rows:
            r["HinhAnh"] = make_full_image_url(r.get("HinhAnh") or "")
        return jsonify(rows), 200
    except Exception as e:
        logger.exception("Lỗi lấy menu: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

# ===== DON HANG =====
@app.route("/api/donhang", methods=["GET"])
def api_get_all_donhang():
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT IDDonHang, IDBan, IDNguoiDung, TrangThaiBep, TrangThaiThanhToan, TongTien, NgayTao
                FROM DonHang ORDER BY NgayTao DESC
            """)
            orders = fetch_all_as_dict(cur)
        return jsonify(orders), 200
    except Exception as e:
        logger.exception("Lỗi lấy danh sách đơn hàng: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

@app.route("/api/donhang/<int:iddon>", methods=["GET"])
def api_get_donhang_detail(iddon):
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT IDDonHang, IDBan, IDNguoiDung, TrangThaiBep, TrangThaiThanhToan, TongTien, NgayTao
                FROM DonHang WHERE IDDonHang=?
            """, (iddon,))
            row = cur.fetchone()
            if not row:
                return jsonify({"status":"error","message":"Không tìm thấy đơn"}), 404
            cols = [c[0] for c in cur.description]
            order_dict = dict(zip(cols, row))
            cur.execute("""
                SELECT ct.IDChiTiet, ct.IDMon, m.TenMon, m.HinhAnh, ct.SoLuong, ct.DonGia, ct.GhiChu,
                       (ct.SoLuong*ct.DonGia) AS ThanhTien
                FROM ChiTietDonHang ct
                JOIN Menu m ON ct.IDMon = m.IDMon
                WHERE ct.IDDonHang=?
            """, (iddon,))
            items = fetch_all_as_dict(cur)
            for it in items:
                it["HinhAnh"] = make_full_image_url(it.get("HinhAnh") or "")
            order_dict['Items'] = items
        return jsonify(order_dict), 200
    except Exception as e:
        logger.exception("Lỗi lấy chi tiết đơn hàng: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

@app.route("/api/donhang", methods=["POST"])
def api_create_donhang():
    try:
        data = request.get_json(force=True)
        idban = data.get("IDBan") or data.get("table")
        items = data.get("Items") or data.get("items") or []
        if not idban or not items:
            return jsonify({"status":"error","message":"Thiếu IDBan hoặc danh sách món"}), 400
        normalized_items = []
        for it in items:
            idmon = it.get("IDMon") or it.get("id") or it.get("ID")
            soluong = it.get("SoLuong") or it.get("qty") or 1
            ghichu = it.get("GhiChu") or it.get("note") or ""
            try:
                idmi = int(idmon)
            except Exception:
                continue
            normalized_items.append({"IDMon": idmi, "SoLuong": int(soluong), "GhiChu": str(ghichu)})
        if not normalized_items:
            return jsonify({"status":"error","message":"Danh sách món không hợp lệ"}), 400
        now_vn_naive = now_vietnam().replace(tzinfo=None)
        with get_cursor() as cur:
            cur.execute("""
                INSERT INTO DonHang (IDBan, IDNguoiDung, TrangThaiBep, TrangThaiThanhToan, NgayTao)
                OUTPUT INSERTED.IDDonHang
                VALUES (?, NULL, N'Đang xử lý', 0, ?)
            """, (idban, now_vn_naive))
            iddon_row = cur.fetchone()
            iddon = int(iddon_row[0])
            ids = [i["IDMon"] for i in normalized_items]
            placeholders = ",".join(["?"] * len(ids))
            cur.execute(f"SELECT IDMon, Gia FROM Menu WHERE IDMon IN ({placeholders})", tuple(ids))
            prices = {int(r[0]): float(r[1]) for r in cur.fetchall()}
            tong = 0.0
            for it in normalized_items:
                gia = prices.get(it["IDMon"])
                if gia is None:
                    logger.warning("Không tìm thấy giá cho IDMon=%s", it["IDMon"])
                    continue
                cur.execute("""
                    INSERT INTO ChiTietDonHang (IDDonHang, IDMon, SoLuong, DonGia, GhiChu)
                    VALUES (?, ?, ?, ?, ?)
                """, (iddon, it["IDMon"], it["SoLuong"], gia, it["GhiChu"]))
                tong += gia * it["SoLuong"]
            cur.execute("UPDATE DonHang SET TongTien=? WHERE IDDonHang=?", (tong, iddon))
        socketio.emit("new_order", {
            "IDDonHang": iddon, "IDBan": idban, "TrangThaiBep": "Đang xử lý",
            "TongTien": tong, "ThoiGianTao": now_vietnam().strftime("%Y-%m-%d %H:%M:%S")
        })
        return jsonify({"status":"ok","IDDonHang":iddon}), 201
    except Exception as e:
        logger.exception("Lỗi tạo đơn hàng: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

# ===== BẾP UPDATE =====
@app.route("/api/bep/cap-nhat-trang-thai/<int:iddon>", methods=["PUT"])
def api_bep_update(iddon):
    try:
        with get_cursor() as cur:
            cur.execute("UPDATE DonHang SET TrangThaiBep=N'Hoàn tất' WHERE IDDonHang=?", (iddon,))
            cur.execute("SELECT IDDonHang, IDBan, TrangThaiBep FROM DonHang WHERE IDDonHang=?", (iddon,))
            r = cur.fetchone()
            payload = {"IDDonHang": int(r[0]), "IDBan": r[1], "TrangThaiBep": r[2]}
        socketio.emit("bep_status_update", payload)
        return jsonify({"status":"ok","payload":payload}), 200
    except Exception as e:
        logger.exception("Lỗi cập nhật trạng thái: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

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
                SELECT IDMon, TenMon, MoTa, Gia, HinhAnh, ISNULL(DanhMuc,'') AS DanhMuc, TrangThai
                FROM Menu ORDER BY IDMon DESC
            """)
            rows = fetch_all_as_dict(cur)
        for r in rows:
            r["HinhAnh"] = make_full_image_url(r.get("HinhAnh") or "")
        return jsonify(rows), 200
    except Exception as e:
        logger.exception("Lỗi admin_list_menu: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/admin/menu", methods=["POST"])
def admin_create_menu():
    try:
        data = request.get_json(force=True)
        ten = data.get("TenMon")
        if not ten:
            return jsonify({"status": "error", "message": "TenMon required"}), 400
        mota = data.get("MoTa", "")
        gia = float(data.get("Gia", 0))
        hinhanh = data.get("HinhAnh", "")
        danh_muc = data.get("DanhMuc", "")
        with get_cursor() as cur:
            cur.execute("""
                INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, DanhMuc, TrangThai)
                VALUES (?, ?, ?, ?, ?, 1)
            """, (ten, mota, gia, hinhanh, danh_muc))
            cur.execute("SELECT MAX(IDMon) FROM Menu")
            new_id = int(cur.fetchone()[0])
            cur.execute("SELECT IDMon, TenMon, MoTa, Gia, HinhAnh, ISNULL(DanhMuc,'') AS DanhMuc, TrangThai FROM Menu WHERE IDMon=?", (new_id,))
            menu = fetch_all_as_dict(cur)[0]
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
        for field in ["TenMon", "MoTa", "Gia", "HinhAnh", "DanhMuc", "TrangThai"]:
            if field in data:
                sets.append(f"{field}=?")
                val = data[field]
                if field=="Gia": val=float(val)
                if field=="TrangThai": val=int(val)
                params.append(val)
        if not sets:
            return jsonify({"status": "error", "message": "No fields to update"}), 400
        params.append(idmon)
        with get_cursor() as cur:
            cur.execute(f"UPDATE Menu SET {', '.join(sets)} WHERE IDMon=?", tuple(params))
            cur.execute("SELECT IDMon, TenMon, MoTa, Gia, HinhAnh, ISNULL(DanhMuc,'') AS DanhMuc, TrangThai FROM Menu WHERE IDMon=?", (idmon,))
            menu = fetch_all_as_dict(cur)[0]
        menu["HinhAnh"] = make_full_image_url(menu.get("HinhAnh") or "")
        return jsonify({"status":"ok","menu":menu}), 200
    except Exception as e:
        logger.exception("Lỗi admin_update_menu: %s", e)
        return jsonify({"status": "error","message": str(e)}), 500

@app.route("/api/admin/menu/<int:idmon>", methods=["DELETE"])
def admin_delete_menu(idmon):
    try:
        with get_cursor() as cur:
            # kiểm tra FK trước
            cur.execute("SELECT COUNT(*) FROM ChiTietDonHang WHERE IDMon=?", (idmon,))
            if cur.fetchone()[0] > 0:
                return jsonify({"status":"error","message":"Không thể xóa món này vì đang có đơn hàng"}), 400

            cur.execute("DELETE FROM Menu WHERE IDMon=?", (idmon,))
        return jsonify({"status":"ok"}), 200
    except Exception as e:
        logger.exception("Lỗi admin_delete_menu: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500

# ===== TABLE / QR CRUD =====
@app.route("/api/admin/table", methods=["GET"])
def admin_list_tables():
    try:
        with get_cursor() as cur:
            cur.execute("SELECT IDBan, TenBan, MaQR, TrangThai, NgayTao FROM Ban ORDER BY IDBan")
            rows = fetch_all_as_dict(cur)
        for r in rows:
            if r.get("MaQR"): 
                r["MaQR"] = make_full_image_url(r["MaQR"])
        return jsonify(rows), 200
    except Exception as e:
        logger.exception("Lỗi admin_list_tables: %s", e)
        return jsonify({"status": "error","message": str(e)}), 500


@app.route("/api/admin/table", methods=["POST"])
def admin_create_table():
    try:
        data = request.get_json(force=True)
        tenban = str(data.get("TenBan") or "").strip()
        base_url = data.get("base_url") or request.host_url.rstrip('/')
        if not tenban:
            return jsonify({"status":"error","message":"Thiếu tên bàn!"}),400
        with get_cursor() as cur:
            # Kiểm tra tên bàn trùng
            cur.execute("SELECT COUNT(*) FROM Ban WHERE TenBan=?", (tenban,))
            if cur.fetchone()[0]>0:
                return jsonify({"status":"error","message":f"Tên bàn '{tenban}' đã tồn tại!"}),400
            # Tìm IDBan trống nhỏ nhất
            cur.execute("""
                SELECT ISNULL(MIN(t.IDBan)+1, 1) 
                FROM Ban t 
                WHERE t.IDBan+1 NOT IN (SELECT IDBan FROM Ban)
            """)
            idban = cur.fetchone()[0]
            # Chèn bàn mới với IDBan cụ thể
            cur.execute("SET IDENTITY_INSERT Ban ON")
            cur.execute("INSERT INTO Ban (IDBan, TenBan) VALUES (?, ?)", (idban, tenban))
            cur.execute("SET IDENTITY_INSERT Ban OFF")
            # Tạo QR
            qr_link = f"{base_url}/khach?table={idban}"
            qr = qrcode.QRCode(box_size=8,border=2)
            qr.add_data(qr_link); qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            saved_rel = save_qr_image(img, f"qr_table_{idban}.png")
            cur.execute("UPDATE Ban SET MaQR=? WHERE IDBan=?", (saved_rel, idban))
        return jsonify({"status":"ok",
                        "table":{"IDBan":idban,"TenBan":tenban,
                                 "MaQR":make_full_image_url(saved_rel),"qr_link":qr_link}}),201
    except Exception as e:
        logger.exception("Lỗi admin_create_table: %s", e)
        return jsonify({"status":"error","message":str(e)}),500

@app.route("/api/admin/table/<int:idban>", methods=["PUT"])
def admin_update_table(idban):
    try:
        data = request.get_json(force=True)
        tenban = str(data.get("TenBan") or "").strip()
        trangthai = str(data.get("TrangThai") or "").strip() or None
        if not tenban:
            return jsonify({"status": "error","message": "Thiếu tên bàn!"}), 400
        with get_cursor() as cur:
            # Kiểm tra bàn tồn tại
            cur.execute("SELECT COUNT(*) FROM Ban WHERE IDBan=?", (idban,))
            if cur.fetchone()[0]==0:
                return jsonify({"status": "error","message": "Bàn không tồn tại!"}),404

            # Kiểm tra tên bàn trùng
            cur.execute("SELECT COUNT(*) FROM Ban WHERE TenBan=? AND IDBan<>?", (tenban,idban))
            if cur.fetchone()[0]>0:
                return jsonify({"status":"error","message":f"Tên bàn '{tenban}' đã được dùng!"}),400

            # Cập nhật bàn
            cur.execute("UPDATE Ban SET TenBan=?, TrangThai=ISNULL(?,TrangThai) WHERE IDBan=?", 
                        (tenban,trangthai,idban))

        return jsonify({"status":"ok"}),200
    except Exception as e:
        logger.exception("Lỗi admin_update_table: %s", e)
        return jsonify({"status":"error","message":str(e)}),500


@app.route("/api/admin/table/<int:idban>", methods=["DELETE"])
def admin_delete_table(idban):
    try:
        with get_cursor() as cur:
            # Xóa tất cả DonHang liên quan
            cur.execute("DELETE FROM DonHang WHERE IDBan=?", (idban,))
            # Xóa bàn
            cur.execute("DELETE FROM Ban WHERE IDBan=?", (idban,))
        return jsonify({"status":"ok"}),200
    except Exception as e:
        logger.exception("Lỗi admin_delete_table: %s", e)
        return jsonify({"status":"error","message":str(e)}),500


# ===== REPORT, CALL STAFF, PAYMENT =====
@app.route("/api/report", methods=["GET"])
def get_report():
    try:
        period = request.args.get("period","day")
        now = now_vietnam().replace(tzinfo=None)
        if period=="day":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period=="week":
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period=="month":
            start_date = now.replace(day=1,hour=0,minute=0,second=0,microsecond=0)
        else:
            start_date = now
        with get_cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) as total_orders, ISNULL(SUM(TongTien),0) as total_revenue
                FROM DonHang
                WHERE TrangThaiThanhToan=1 AND NgayTao>=?
            """,(start_date,))
            row = cur.fetchone()
        total_orders = row[0] if row else 0
        total_revenue = float(row[1]) if row else 0
        return jsonify({"totalOrders":total_orders,"totalRevenue":total_revenue,"period":period,"startDate":start_date.isoformat()}),200
    except Exception as e:
        logger.exception("Lỗi get_report: %s", e)
        return jsonify({"status":"error","message":str(e)}),500

@app.route("/api/call_staff", methods=["POST"])
def call_staff():
    data = request.get_json()
    table = data.get("table")
    if not table:
        return jsonify({"error":"Thiếu số bàn"}), 400
    socketio.emit("staff_call", {"table": table})
    return jsonify({"message": f"Bàn {table} đã gọi nhân viên"}), 200

@app.route("/admin")
def admin_page():
    return render_template("admin.html")

@app.route("/api/donhang/thanh-toan/<int:iddon>", methods=["PUT"])
def api_pay_donhang(iddon):
    try:
        with get_cursor() as cur:
            cur.execute("SELECT TrangThaiThanhToan FROM DonHang WHERE IDDonHang=?", (iddon,))
            row = cur.fetchone()
            if not row:
                return jsonify({"status":"error","message":"Không tìm thấy đơn hàng"}),404
            if row[0]:
                return jsonify({"status":"error","message":"Đơn đã được thanh toán"}),400
            cur.execute("UPDATE DonHang SET TrangThaiThanhToan=1 WHERE IDDonHang=?", (iddon,))
        socketio.emit("order_paid", {"IDDonHang": iddon})
        return jsonify({"status":"ok","IDDonHang": iddon, "message":"Thanh toán thành công"}),200
    except Exception as e:
        logger.exception("Lỗi thanh toán đơn hàng: %s", e)
        return jsonify({"status":"error","message":str(e)}),500

#báo cáo theo biểu đồ
@app.route("/api/report/total-paid-unpaid")
def total_paid_unpaid():
    period = request.args.get("period", "day")
    date_filter = get_date_filter(period, alias="d")
    try:
        with get_cursor() as cur:
            cur.execute(f"""
                SELECT 
                    SUM(CASE WHEN d.TrangThaiThanhToan=1 THEN d.TongTien ELSE 0 END) AS Paid,
                    SUM(CASE WHEN d.TrangThaiThanhToan=0 THEN d.TongTien ELSE 0 END) AS Unpaid
                FROM DonHang d
                WHERE {date_filter}
            """)
            row = cur.fetchone()
            return jsonify({"Paid": float(row.Paid or 0), "Unpaid": float(row.Unpaid or 0)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/report/revenue-by-category")
def revenue_by_category():
    period = request.args.get("period", "day")
    date_filter = get_date_filter(period, alias="d")
    try:
        with get_cursor() as cur:
            cur.execute(f"""
                SELECT 
                    m.DanhMuc,
                    SUM(ct.SoLuong * ct.DonGia) AS DoanhThu
                FROM ChiTietDonHang ct
                JOIN Menu m ON ct.IDMon = m.IDMon
                JOIN DonHang d ON ct.IDDonHang = d.IDDonHang
                WHERE d.TrangThaiThanhToan = 1 AND {date_filter}
                GROUP BY m.DanhMuc
                ORDER BY DoanhThu DESC
            """)
            rows = cur.fetchall()
            result = [{"DanhMuc": r.DanhMuc, "DoanhThu": float(r.DoanhThu)} for r in rows]
            return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# ===== ADMIN STAFF CRUD =====
@app.route("/api/admin/staff", methods=["GET"])
def admin_list_staff():
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT IDNguoiDung, TenDangNhap, HoTen, MatKhau, VaiTro
                FROM NguoiDung ORDER BY IDNguoiDung DESC
            """)
            rows = fetch_all_as_dict(cur)
        return jsonify(rows), 200
    except Exception as e:
        logger.exception("Lỗi admin_list_staff: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/admin/staff", methods=["POST"])
def admin_create_staff():
    try:
        data = request.get_json(force=True)
        username = data.get("TenDangNhap")
        fullname = data.get("HoTen", "")
        role = data.get("VaiTro", "")
        password = data.get("MatKhau") or "123456"  # Nếu không nhập thì dùng mặc định

        if not username or not fullname or not role or not password:
            return jsonify({"status":"error","message":"Thiếu thông tin"}), 400

        with get_cursor() as cur:
            # Kiểm tra trùng username
            cur.execute("SELECT COUNT(*) FROM NguoiDung WHERE TenDangNhap=?", (username,))
            if cur.fetchone()[0] > 0:
                return jsonify({"status":"error","message":"Tên đăng nhập đã tồn tại"}), 400

            cur.execute("""
                INSERT INTO NguoiDung (TenDangNhap, MatKhau, HoTen, VaiTro)
                VALUES (?, ?, ?, ?)
            """, (username, password, fullname, role))

            cur.execute("SELECT MAX(IDNguoiDung) FROM NguoiDung")
            new_id = int(cur.fetchone()[0])

            cur.execute("SELECT IDNguoiDung, TenDangNhap, HoTen, MatKhau, VaiTro FROM NguoiDung WHERE IDNguoiDung=?", (new_id,))
            staff = fetch_all_as_dict(cur)[0]

        return jsonify({"status":"ok","staff":staff}), 201
    except Exception as e:
        logger.exception("Lỗi admin_create_staff: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

@app.route("/api/admin/staff/<int:iduser>", methods=["PUT"])
def admin_update_staff(iduser):
    try:
        data = request.get_json(force=True)
        sets, params = [], []
        for field in ["TenDangNhap", "HoTen", "VaiTro", "MatKhau"]:
            if field in data and data[field]:
                sets.append(f"{field}=?")
                params.append(data[field])

        if not sets:
            return jsonify({"status": "error", "message": "No fields to update"}), 400

        params.append(iduser)

        with get_cursor() as cur:
            # Nếu cập nhật username, kiểm tra trùng
            if "TenDangNhap" in data:
                cur.execute("SELECT COUNT(*) FROM NguoiDung WHERE TenDangNhap=? AND IDNguoiDung<>?", (data["TenDangNhap"], iduser))
                if cur.fetchone()[0] > 0:
                    return jsonify({"status":"error","message":"Tên đăng nhập đã tồn tại"}), 400

            cur.execute(f"UPDATE NguoiDung SET {', '.join(sets)} WHERE IDNguoiDung=?", tuple(params))
            cur.execute("SELECT IDNguoiDung, TenDangNhap, HoTen, MatKhau, VaiTro FROM NguoiDung WHERE IDNguoiDung=?", (iduser,))
            staff = fetch_all_as_dict(cur)[0]

        return jsonify({"status":"ok","staff":staff}), 200
    except Exception as e:
        logger.exception("Lỗi admin_update_staff: %s", e)
        return jsonify({"status":"error","message": str(e)}), 500

@app.route("/api/admin/staff/<int:iduser>", methods=["DELETE"])
def admin_delete_staff(iduser):
    try:
        with get_cursor() as cur:
            # Kiểm tra ràng buộc nếu cần (ví dụ đơn hàng liên quan)
            cur.execute("SELECT COUNT(*) FROM DonHang WHERE IDNguoiDung=?", (iduser,))
            if cur.fetchone()[0] > 0:
                return jsonify({"status":"error","message":"Không thể xóa nhân sự này vì có đơn hàng liên quan"}), 400

            cur.execute("DELETE FROM NguoiDung WHERE IDNguoiDung=?", (iduser,))
        return jsonify({"status":"ok"}), 200
    except Exception as e:
        logger.exception("Lỗi admin_delete_staff: %s", e)
        return jsonify({"status":"error","message": str(e)}), 500


# đăng nhập

# ======= Socket Example =======
@socketio.on("connect")
def handle_connect():
    print("Client connected")

@socketio.on("disconnect")
def handle_disconnect():
    print("Client disconnected")

@socketio.on("call_staff")
def handle_call_staff(data):
    socketio.emit("staff_call", data)
# ===== RUN SERVER =====
if __name__ == "__main__":
    try:
        test_connection()
        logger.info("✅ Kết nối DB thành công.")
    except Exception as e:
        logger.critical("❌ Kết nối DB thất bại: %s", e)
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
