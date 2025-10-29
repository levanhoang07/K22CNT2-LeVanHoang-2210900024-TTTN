#!/usr/bin/env python3
# app.py - Flask + SocketIO (eventlet)
from flask_cors import CORS
import eventlet
eventlet.monkey_patch()  # cần gọi càng sớm càng tốt

import os
import logging
import qrcode
from datetime import datetime, timezone, timedelta

from io import BytesIO

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from db import get_cursor, test_connection


from flask import Flask, render_template, request, jsonify
import qrcode
from datetime import datetime, timedelta
import os
# ==============================
# 🔧 LOGGING  
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - [FLASK] - %(message)s"
)
logger = logging.getLogger(__name__)
now_vn = datetime.now(timezone(timedelta(hours=7)))
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

# ==============================
# 🖼️ PHỤC VỤ ẢNH STATIC
# ==============================
@app.route("/images/<path:filename>")
def serve_image(filename):
    static_images = os.path.join(app.static_folder, "images")
    return send_from_directory(static_images, filename)

# ==============================
# 🍜 PUBLIC - LẤY DANH SÁCH MENU (khách)
# ==============================
@app.route("/api/menu", methods=["GET"])
def api_menu():
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT IDMon, TenMon, MoTa, Gia, HinhAnh, ISNULL(DanhMuc, N'') AS DanhMuc
                FROM Menu WHERE TrangThai=1 ORDER BY TenMon
            """)
            rows = fetch_all_as_dict(cur)
        return jsonify(rows), 200
    except Exception as e:
        logger.exception("Lỗi lấy menu: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500

# ==============================
# 📋 LẤY TẤT CẢ ĐƠN HÀNG
# ==============================
@app.route("/api/donhang", methods=["GET"])
def api_get_all_donhang():
    """Lấy danh sách tất cả đơn hàng"""
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT 
                    IDDonHang, 
                    IDBan, 
                    IDNguoiDung, 
                    TrangThaiBep, 
                    TrangThaiThanhToan, 
                    TongTien, 
                    NgayTao
                FROM DonHang 
                ORDER BY NgayTao DESC
            """)
            orders = fetch_all_as_dict(cur)
        return jsonify(orders), 200
    except Exception as e:
        logger.exception("Lỗi lấy danh sách đơn hàng: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500

# ==============================
# 🔍 LẤY CHI TIẾT MỘT ĐƠN HÀNG
# ==============================
@app.route("/api/donhang/<int:iddon>", methods=["GET"])
def api_get_donhang_detail(iddon):
    """Lấy thông tin chi tiết đơn hàng cùng danh sách món"""
    try:
        with get_cursor() as cur:
            # Lấy thông tin đơn hàng
            cur.execute("""
                SELECT 
                    IDDonHang, 
                    IDBan, 
                    IDNguoiDung, 
                    TrangThaiBep, 
                    TrangThaiThanhToan, 
                    TongTien, 
                    NgayTao
                FROM DonHang 
                WHERE IDDonHang = ?
            """, (iddon,))
            order = cur.fetchone()
            
            if not order:
                return jsonify({"status": "error", "message": "Không tìm thấy đơn hàng"}), 404
            
            cols = [c[0] for c in cur.description]
            order_dict = dict(zip(cols, order))
            
            # Lấy chi tiết món ăn
            cur.execute("""
                SELECT 
                    ct.IDChiTiet,
                    ct.IDMon,
                    m.TenMon,
                    m.HinhAnh,
                    ct.SoLuong,
                    ct.DonGia,
                    ct.GhiChu,
                    (ct.SoLuong * ct.DonGia) AS ThanhTien
                FROM ChiTietDonHang ct
                JOIN Menu m ON ct.IDMon = m.IDMon
                WHERE ct.IDDonHang = ?
            """, (iddon,))
            items = fetch_all_as_dict(cur)

            
            order_dict['Items'] = items
            
        return jsonify(order_dict), 200
    except Exception as e:
        logger.exception("Lỗi lấy chi tiết đơn hàng: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500

# ==============================
# 🔍 LẤY ĐƠN HÀNG THEO BÀN
# ==============================
@app.route("/api/donhang/ban/<int:idban>", methods=["GET"])
def api_get_donhang_by_table(idban):
    """Lấy tất cả đơn hàng của một bàn"""
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT 
                    IDDonHang, 
                    IDBan, 
                    IDNguoiDung, 
                    TrangThaiBep, 
                    TrangThaiThanhToan, 
                    TongTien, 
                    NgayTao
                FROM DonHang 
                WHERE IDBan = ?
                ORDER BY NgayTao DESC
            """, (idban,))
            orders = fetch_all_as_dict(cur)
        return jsonify(orders), 200
    except Exception as e:
        logger.exception("Lỗi lấy đơn hàng theo bàn: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500

# ==============================
# 🔍 LẤY ĐƠN HÀNG THEO TRẠNG THÁI
# ==============================
@app.route("/api/donhang/trang-thai/<trang_thai>", methods=["GET"])
def api_get_donhang_by_status(trang_thai):
    """Lấy đơn hàng theo trạng thái bếp (Đang xử lý, Hoàn tất)"""
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT 
                    IDDonHang, 
                    IDBan, 
                    IDNguoiDung, 
                    TrangThaiBep, 
                    TrangThaiThanhToan, 
                    TongTien, 
                    NgayTao
                FROM DonHang 
                WHERE TrangThaiBep = ?
                ORDER BY NgayTao DESC
            """, (trang_thai,))
            orders = fetch_all_as_dict(cur)
        return jsonify(orders), 200
    except Exception as e:
        logger.exception("Lỗi lấy đơn hàng theo trạng thái: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


# ==============================
# 🧾 API TẠO ĐƠN HÀNG (Fix giờ VN + ghi chú)
# ==============================
@app.route("/api/donhang", methods=["POST"])
def api_create_donhang():
    try:
        data = request.get_json(force=True)
        idban = data.get("IDBan") or data.get("table")
        items = data.get("Items") or data.get("items") or []

        # 🧩 Kiểm tra dữ liệu đầu vào
        if not idban or not items:
            return jsonify({"status": "error", "message": "Thiếu IDBan hoặc danh sách món"}), 400

        # 🔧 Chuẩn hóa danh sách món và nhận GhiChu
        normalized_items = []
        for it in items:
            idmon = it.get("IDMon") or it.get("id") or it.get("ID")
            soluong = it.get("SoLuong") or it.get("qty") or 1
            ghichu = it.get("GhiChu") or it.get("note") or ""
            if not idmon:
                continue
            normalized_items.append({
                "IDMon": int(idmon),
                "SoLuong": int(soluong),
                "GhiChu": str(ghichu)
            })

        if not normalized_items:
            return jsonify({"status": "error", "message": "Danh sách món không hợp lệ"}), 400

        # 🕒 Lấy thời gian hiện tại ở Việt Nam (UTC+7)
        now_vn = datetime.now(timezone(timedelta(hours=7)))
        now_vn_naive = now_vn.replace(tzinfo=None)  # SQL Server datetime không lưu timezone

        with get_cursor() as cur:
            # 1️⃣ Tạo đơn mới và lấy IDDonHang
            cur.execute("""
                INSERT INTO DonHang (IDBan, IDNguoiDung, TrangThaiBep, TrangThaiThanhToan, NgayTao)
                OUTPUT INSERTED.IDDonHang
                VALUES (?, NULL, N'Đang xử lý', 0, ?)
            """, (idban, now_vn_naive))
            res = cur.fetchone()
            if not res or res[0] is None:
                raise ValueError("Không thể lấy IDDonHang mới từ SQL Server")
            iddon = int(res[0])

            # 2️⃣ Lấy giá các món
            id_list = [it["IDMon"] for it in normalized_items]
            placeholders = ",".join("?" * len(id_list))
            cur.execute(f"SELECT IDMon, Gia FROM Menu WHERE IDMon IN ({placeholders})", tuple(id_list))
            prices = {int(r[0]): float(r[1]) for r in cur.fetchall()}

            # 3️⃣ Thêm chi tiết đơn hàng + tính tổng
            tong = 0.0
            for it in normalized_items:
                gia = prices.get(it["IDMon"])
                if gia is None:
                    logger.warning(f"⚠️ Món ID {it['IDMon']} không tồn tại trong Menu")
                    continue
                cur.execute(
                    "INSERT INTO ChiTietDonHang (IDDonHang, IDMon, SoLuong, DonGia, GhiChu) VALUES (?, ?, ?, ?, ?)",
                    (iddon, it["IDMon"], it["SoLuong"], gia, it["GhiChu"])
                )
                tong += gia * it["SoLuong"]

            # 4️⃣ Cập nhật tổng tiền
            cur.execute("UPDATE DonHang SET TongTien=? WHERE IDDonHang=?", (tong, iddon))

        # 5️⃣ Phát sự kiện SocketIO cho tất cả client
        payload = {
            "IDDonHang": iddon,
            "IDBan": idban,
            "TrangThaiBep": "Đang xử lý",
            "TongTien": tong,
            "ThoiGianTao": now_vn.strftime("%Y-%m-%d %H:%M:%S")  # string giờ VN
        }
        socketio.emit("new_order", payload)
        logger.info(f"🔔 Đã phát new_order đến client: {payload}")

        return jsonify({"status": "ok", "IDDonHang": iddon}), 201

    except Exception as e:
        logger.exception("❌ Lỗi tạo đơn hàng: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500

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
            if not r:
                return jsonify({"status": "error", "message": "Không tìm thấy đơn"}), 404
            payload = {"IDDonHang": int(r[0]), "IDBan": r[1], "TrangThaiBep": r[2]}

        socketio.emit("bep_status_update", payload, namespace="/", to=None)
        logger.info(f"👨‍🍳 Phát cập nhật trạng thái bếp: {payload}")
        return jsonify({"status": "ok", "payload": payload}), 200

    except Exception as e:
        logger.exception("Lỗi cập nhật trạng thái: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500

# ==============================
# 🔌 SOCKET.IO EVENTS
# ==============================
@socketio.on("connect")
def on_connect():
    logger.info(f"Socket connected: {request.sid}")
    emit("connected", {"msg": "Kết nối socket thành công"})

@socketio.on("disconnect")
def on_disconnect():
    logger.info(f"Socket disconnected: {request.sid}")

# ==========================
# Helper: save QR image
# ==========================
def save_qr_image(img, filename):
    qrcode_dir = os.path.join(app.static_folder, "images", "qrcodes")
    os.makedirs(qrcode_dir, exist_ok=True)
    filepath = os.path.join(qrcode_dir, filename)
    img.save(filepath)
    return f"qrcodes/{filename}" 

# ==========================
# MENU CRUD API
# ==========================
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
        mota = data.get("MoTa", "")
        gia = float(data.get("Gia", 0))
        hinhanh = data.get("HinhAnh", "")
        danh_muc = data.get("DanhMuc", "")
        
        if not ten:
            return jsonify({"status":"error","message":"TenMon required"}), 400
            
        with get_cursor() as cur:
            cur.execute("""
                INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, DanhMuc, TrangThai)
                VALUES (?, ?, ?, ?, ?, 1);
                SELECT SCOPE_IDENTITY();
            """, (ten, mota, gia, hinhanh, danh_muc))
            r = cur.fetchone()
            new_id = int(r[0]) if r else None
            
            cur.execute("""
                SELECT IDMon, TenMon, MoTa, Gia, HinhAnh, 
                       ISNULL(DanhMuc,'') AS DanhMuc, TrangThai 
                FROM Menu WHERE IDMon=?
            """, (new_id,))
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
        
        for field in ["TenMon", "MoTa", "Gia", "HinhAnh", "DanhMuc", "TrangThai"]:
            if field in data:
                sets.append(f"{field}=?")
                val = data[field]
                if field == "Gia": 
                    val = float(val)
                if field == "TrangThai": 
                    val = int(val)
                params.append(val)
                
        if not sets:
            return jsonify({"status":"error","message":"No fields to update"}), 400
            
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
# ==========================
# TABLE + QR CRUD API
# ==========================
from flask import Flask, request, jsonify
from datetime import datetime
import qrcode
from db import get_cursor  # giả sử bạn có hàm get_cursor()
import os
import logging

logger = logging.getLogger(__name__)

# Helper lưu QR image vào thư mục static/images/qrcodes
def save_qr_image(img, filename):
    folder = os.path.join("static", "images", "qrcodes")
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, filename)
    img.save(path)
    return f"/static/images/qrcodes/{filename}"  # đường dẫn relative trả về frontend

# ==========================
# Lấy danh sách bàn
# ==========================
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

# ==========================
# Tạo bàn mới + QR
# ==========================
@app.route("/api/admin/table", methods=["POST"])
def admin_create_table():
    try:
        data = request.get_json(force=True)
        tenban = data.get("TenBan") or f"Ban-{int(datetime.utcnow().timestamp())}"
        base_url = data.get("base_url") or request.host_url.rstrip('/')

        with get_cursor() as cur:
            cur.execute("INSERT INTO Ban (TenBan) VALUES (?); SELECT SCOPE_IDENTITY()", (tenban,))
            r = cur.fetchone()
            idban = int(r[0]) if r else None

            # Tạo QR code
            qr_link = f"{base_url}/khach?table={idban}"
            qr = qrcode.QRCode(box_size=8, border=2)
            qr.add_data(qr_link)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")

            filename = f"qr_table_{idban}.png"
            saved_rel = save_qr_image(img, filename)

            # Lưu QR vào cột MaQR
            cur.execute("UPDATE Ban SET MaQR=? WHERE IDBan=?", (saved_rel, idban))

        return jsonify({
            "status":"ok",
            "table":{
                "IDBan": idban,
                "TenBan": tenban,
                "MaQR": saved_rel,
                "qr_link": qr_link
            }
        }), 201
    except Exception as e:
        logger.exception("Lỗi admin_create_table: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

# ==========================
# Xóa bàn
# ==========================
@app.route("/api/admin/table/<int:idban>", methods=["DELETE"])
def admin_delete_table(idban):
    try:
        with get_cursor() as cur:
            cur.execute("DELETE FROM Ban WHERE IDBan=?", (idban,))
        return jsonify({"status":"ok"}), 200
    except Exception as e:
        logger.exception("Lỗi admin_delete_table: %s", e)
        return jsonify({"status":"error","message":str(e)}), 500

# ==========================
# REPORT API
# ==========================
@app.route("/api/report", methods=["GET"])
def get_report():
    try:
        period = request.args.get("period", "day")
        
        # Xác định khoảng thời gian
        now = datetime.now()
        if period == "day":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "month":
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        with get_cursor() as cur:
            # Đếm tổng đơn hàng đã thanh toán
            cur.execute("""
                SELECT COUNT(*) as total_orders, ISNULL(SUM(TongTien), 0) as total_revenue
                FROM DonHang
                WHERE TrangThai = 'paid' AND ThoiGianTao >= ?
            """, (start_date,))
            
            row = cur.fetchone()
            total_orders = row[0] if row else 0
            total_revenue = row[1] if row else 0
        
        return jsonify({
            "totalOrders": total_orders,
            "totalRevenue": float(total_revenue),
            "period": period,
            "startDate": start_date.isoformat()
        }), 200
        
    except Exception as e:
        logger.exception("Lỗi get_report: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


# ==========================
# ADMIN PAGE ROUTE
# ==========================
@app.route("/admin")
def admin_page():
    return render_template("admin.html")


# ==============================
# 📞 API GỌI NHÂN VIÊN
# ==============================
@app.route("/api/call_staff", methods=["POST"])
def call_staff():
    data = request.get_json()
    table = data.get("table")
    if not table:
        return jsonify({"error": "Thiếu số bàn"}), 400

    # Gửi thông báo real-time qua SocketIO
    socketio.emit("staff_call", {"table": table})

    return jsonify({"message": f"Bàn {table} đã gọi nhân viên"}), 200

# ==============================
# ⚙️ CHẠY SERVER
# ==============================
if __name__ == "__main__":
    try:
        test_connection()
        logger.info("✅ Kết nối DB thành công.")
    except Exception as e:
        logger.critical("❌ Kết nối DB thất bại: %s", e)

    # ✅ Cho phép auto reload code khi sửa (như React)
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
