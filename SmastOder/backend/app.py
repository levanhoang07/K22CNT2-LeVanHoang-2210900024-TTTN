#!/usr/bin/env python3
# app.py - Flask + SocketIO (eventlet)
import os
import logging
from datetime import datetime, timezone, timedelta
from io import BytesIO

import eventlet
eventlet.monkey_patch()  # cần gọi càng sớm càng tốt

import qrcode
from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from db import get_cursor, test_connection  # giả sử bạn đã có db.py

# ==============================
# 🔧 LOGGING
# ==============================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - [FLASK] - %(message)s"
)
logger = logging.getLogger(__name__)

# ==============================
# 🚀 KHỞI TẠO FLASK + SOCKET
# ==============================
app = Flask(__name__, static_folder="static")
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# ==============================
# 🔹 TIỆN ÍCH CHUNG
# ==============================
def fetch_all_as_dict(cursor):
    """Chuyển cursor.fetchall() → list[dict]"""
    if not cursor.description:
        return []
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]

def now_vietnam():
    """Trả về datetime giờ VN (UTC+7)"""
    return datetime.now(timezone(timedelta(hours=7)))

# ==============================
# 🖼️ PHỤC VỤ ẢNH STATIC
# ==============================
@app.route("/images/<path:filename>")
def serve_image(filename):
    static_images = os.path.join(app.static_folder, "images")
    return send_from_directory(static_images, filename)

# ==============================
# 🧾 HELPER LƯU QR
# ==============================
def save_qr_image(img, filename):
    folder = os.path.join(app.static_folder, "images", "qrcodes")
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, filename)
    img.save(path)
    return f"qrcodes/{filename}"  # relative path trả về frontend

# ==============================
# 🍜 MENU PUBLIC
# ==============================
@app.route("/api/menu", methods=["GET"])
def api_menu():
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT IDMon, TenMon, MoTa, Gia, HinhAnh, ISNULL(DanhMuc,'') AS DanhMuc
                FROM Menu WHERE TrangThai=1 ORDER BY TenMon
            """)
            rows = fetch_all_as_dict(cur)
        return jsonify(rows), 200
    except Exception as e:
        logger.exception("Lỗi lấy menu: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

# ==============================
# 📋 ORDER API
# ==============================
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
            order_dict['Items'] = fetch_all_as_dict(cur)

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
            if not idmon: continue
            normalized_items.append({"IDMon": int(idmon), "SoLuong": int(soluong), "GhiChu": str(ghichu)})

        if not normalized_items:
            return jsonify({"status":"error","message":"Danh sách món không hợp lệ"}), 400

        now_vn_naive = now_vietnam().replace(tzinfo=None)
        with get_cursor() as cur:
            cur.execute("""
                INSERT INTO DonHang (IDBan, IDNguoiDung, TrangThaiBep, TrangThaiThanhToan, NgayTao)
                OUTPUT INSERTED.IDDonHang
                VALUES (?, NULL, N'Đang xử lý', 0, ?)
            """, (idban, now_vn_naive))
            iddon = int(cur.fetchone()[0])

            # Lấy giá món
            ids = [i["IDMon"] for i in normalized_items]
            placeholders = ",".join("?"*len(ids))
            cur.execute(f"SELECT IDMon, Gia FROM Menu WHERE IDMon IN ({placeholders})", tuple(ids))
            prices = {int(r[0]): float(r[1]) for r in cur.fetchall()}

            tong = 0.0
            for it in normalized_items:
                gia = prices.get(it["IDMon"])
                if gia is None: continue
                cur.execute("""
                    INSERT INTO ChiTietDonHang (IDDonHang, IDMon, SoLuong, DonGia, GhiChu)
                    VALUES (?, ?, ?, ?, ?)
                """, (iddon, it["IDMon"], it["SoLuong"], gia, it["GhiChu"]))
                tong += gia * it["SoLuong"]

            cur.execute("UPDATE DonHang SET TongTien=? WHERE IDDonHang=?", (tong, iddon))

        # Emit socket event
        socketio.emit("new_order", {
            "IDDonHang": iddon, "IDBan": idban, "TrangThaiBep": "Đang xử lý",
            "TongTien": tong, "ThoiGianTao": now_vietnam().strftime("%Y-%m-%d %H:%M:%S")
        })
        return jsonify({"status":"ok","IDDonHang":iddon}), 201

    except Exception as e:
        logger.exception("Lỗi tạo đơn hàng: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

# ==============================
# 👨‍🍳 CẬP NHẬT TRẠNG THÁI BẾP
# ==============================
@app.route("/api/bep/cap-nhat-trang-thai/<int:iddon>", methods=["PUT"])
def api_bep_update(iddon):
    try:
        with get_cursor() as cur:
            cur.execute("UPDATE DonHang SET TrangThaiBep=N'Hoàn tất' WHERE IDDonHang=?", (iddon,))
            cur.execute("SELECT IDDonHang, IDBan, TrangThaiBep FROM DonHang WHERE IDDonHang=?", (iddon,))
            r = cur.fetchone()
            if not r: return jsonify({"status":"error","message":"Không tìm thấy đơn"}), 404
            payload = {"IDDonHang": int(r[0]), "IDBan": r[1], "TrangThaiBep": r[2]}

        socketio.emit("bep_status_update", payload)
        return jsonify({"status":"ok","payload":payload}), 200
    except Exception as e:
        logger.exception("Lỗi cập nhật trạng thái: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

# ==============================
# 🔌 SOCKET.IO EVENTS
# ==============================
@socketio.on("connect")
def on_connect():
    logger.info(f"Socket connected: {request.sid}")
    emit("connected", {"msg":"Kết nối socket thành công"})

@socketio.on("disconnect")
def on_disconnect():
    logger.info(f"Socket disconnected: {request.sid}")

# ==============================
# 🍽️ ADMIN MENU CRUD
# ==============================
@app.route("/api/admin/menu", methods=["GET"])
def admin_list_menu():
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT IDMon, TenMon, MoTa, Gia, HinhAnh, ISNULL(DanhMuc,'') AS DanhMuc, TrangThai
                FROM Menu ORDER BY IDMon DESC
            """)
            rows = fetch_all_as_dict(cur)
        return jsonify(rows), 200
    except Exception as e:
        logger.exception("Lỗi admin_list_menu: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

@app.route("/api/admin/menu", methods=["POST"])
def admin_create_menu():
    try:
        data = request.get_json(force=True)
        ten = data.get("TenMon")
        if not ten: return jsonify({"status":"error","message":"TenMon required"}), 400
        mota = data.get("MoTa","")
        gia = float(data.get("Gia",0))
        hinhanh = data.get("HinhAnh","")
        danh_muc = data.get("DanhMuc","")
        with get_cursor() as cur:
            cur.execute("""
                INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, DanhMuc, TrangThai)
                VALUES (?, ?, ?, ?, ?, 1); SELECT SCOPE_IDENTITY()
            """, (ten, mota, gia, hinhanh, danh_muc))
            new_id = int(cur.fetchone()[0])
            cur.execute("SELECT IDMon, TenMon, MoTa, Gia, HinhAnh, ISNULL(DanhMuc,'') AS DanhMuc, TrangThai FROM Menu WHERE IDMon=?", (new_id,))
            menu = fetch_all_as_dict(cur)[0]
        return jsonify({"status":"ok","menu":menu}), 201
    except Exception as e:
        logger.exception("Lỗi admin_create_menu: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

@app.route("/api/admin/menu/<int:idmon>", methods=["PUT"])
def admin_update_menu(idmon):
    try:
        data = request.get_json(force=True)
        sets, params = [], []
        for field in ["TenMon","MoTa","Gia","HinhAnh","DanhMuc","TrangThai"]:
            if field in data:
                sets.append(f"{field}=?")
                val = data[field]
                if field=="Gia": val=float(val)
                if field=="TrangThai": val=int(val)
                params.append(val)
        if not sets: return jsonify({"status":"error","message":"No fields to update"}), 400
        params.append(idmon)
        with get_cursor() as cur:
            cur.execute(f"UPDATE Menu SET {', '.join(sets)} WHERE IDMon=?", tuple(params))
        return jsonify({"status":"ok"}), 200
    except Exception as e:
        logger.exception("Lỗi admin_update_menu: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

@app.route("/api/admin/menu/<int:idmon>", methods=["DELETE"])
def admin_delete_menu(idmon):
    try:
        with get_cursor() as cur:
            cur.execute("DELETE FROM Menu WHERE IDMon=?", (idmon,))
        return jsonify({"status":"ok"}), 200
    except Exception as e:
        logger.exception("Lỗi admin_delete_menu: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

# ==============================
# 🍽️ TABLE + QR CRUD
# ==============================
@app.route("/api/admin/table", methods=["GET"])
def admin_list_tables():
    try:
        with get_cursor() as cur:
            cur.execute("SELECT IDBan, TenBan, MaQR, TrangThai, NgayTao FROM Ban ORDER BY IDBan")
            rows = fetch_all_as_dict(cur)
        return jsonify(rows), 200
    except Exception as e:
        logger.exception("Lỗi admin_list_tables: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

@app.route("/api/admin/table", methods=["POST"])
def admin_create_table():
    try:
        data = request.get_json(force=True)
        tenban = data.get("TenBan") or f"Ban-{int(datetime.utcnow().timestamp())}"
        base_url = data.get("base_url") or request.host_url.rstrip('/')
        with get_cursor() as cur:
            cur.execute("INSERT INTO Ban (TenBan) VALUES (?); SELECT SCOPE_IDENTITY()", (tenban,))
            idban = int(cur.fetchone()[0])
            qr_link = f"{base_url}/khach?table={idban}"
            qr = qrcode.QRCode(box_size=8, border=2)
            qr.add_data(qr_link)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            saved_rel = save_qr_image(img, f"qr_table_{idban}.png")
            cur.execute("UPDATE Ban SET MaQR=? WHERE IDBan=?", (saved_rel, idban))
        return jsonify({"status":"ok","table":{"IDBan":idban,"TenBan":tenban,"MaQR":saved_rel,"qr_link":qr_link}}), 201
    except Exception as e:
        logger.exception("Lỗi admin_create_table: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

@app.route("/api/admin/table/<int:idban>", methods=["DELETE"])
def admin_delete_table(idban):
    try:
        with get_cursor() as cur:
            cur.execute("DELETE FROM Ban WHERE IDBan=?", (idban,))
        return jsonify({"status":"ok"}), 200
    except Exception as e:
        logger.exception("Lỗi admin_delete_table: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

# ==============================
# 📊 REPORT API
# ==============================
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
            """, (start_date,))
            row = cur.fetchone()
            total_orders = row[0] if row else 0
            total_revenue = float(row[1]) if row else 0
        return jsonify({"totalOrders":total_orders,"totalRevenue":total_revenue,"period":period,"startDate":start_date.isoformat()}), 200
    except Exception as e:
        logger.exception("Lỗi get_report: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

# ==============================
# 👥 CALL STAFF
# ==============================
@app.route("/api/call_staff", methods=["POST"])
def call_staff():
    data = request.get_json()
    table = data.get("table")
    if not table: return jsonify({"error":"Thiếu số bàn"}), 400
    socketio.emit("staff_call", {"table": table})
    return jsonify({"message": f"Bàn {table} đã gọi nhân viên"}), 200

# ==============================
# 🏠 ADMIN PAGE
# ==============================
@app.route("/admin")
def admin_page():
    return render_template("admin.html")

@app.route("/api/donhang/thanh-toan/<int:iddon>", methods=["PUT"])
def api_pay_donhang(iddon):
    try:
        with get_cursor() as cur:
            # Kiểm tra đơn hàng
            cur.execute("SELECT TrangThaiThanhToan FROM DonHang WHERE IDDonHang=?", (iddon,))
            row = cur.fetchone()
            if not row:
                return jsonify({"status":"error","message":"Không tìm thấy đơn hàng"}), 404
            if row[0]:  # đã thanh toán
                return jsonify({"status":"error","message":"Đơn đã được thanh toán"}), 400

            # Cập nhật trạng thái thanh toán
            cur.execute("UPDATE DonHang SET TrangThaiThanhToan=1 WHERE IDDonHang=?", (iddon,))
        
        # Gửi sự kiện socket nếu cần
        socketio.emit("order_paid", {"IDDonHang": iddon})

        return jsonify({"status":"ok","IDDonHang": iddon, "message":"Thanh toán thành công"}), 200
    except Exception as e:
        logger.exception("Lỗi thanh toán đơn hàng: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500


# ==============================
# ⚙️ CHẠY SERVER
# ==============================
if __name__ == "__main__":
    try:
        test_connection()
        logger.info("✅ Kết nối DB thành công.")
    except Exception as e:
        logger.critical("❌ Kết nối DB thất bại: %s", e)

    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
