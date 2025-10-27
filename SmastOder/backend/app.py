#!/usr/bin/env python3
# app.py - Flask + SocketIO (eventlet)

import eventlet
eventlet.monkey_patch()  # cần gọi càng sớm càng tốt

import os
import logging
import qrcode
from datetime import datetime
from io import BytesIO

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from db import get_cursor, test_connection

# ==============================
# 🔧 LOGGING  
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
# 🧾 API TẠO ĐƠN HÀNG
# ==============================
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
            idmon = it.get("IDMon") or it.get("id") or it.get("ID")
            soluong = it.get("SoLuong") or it.get("qty") or 1
            if not idmon:
                continue
            normalized_items.append({"IDMon": int(idmon), "SoLuong": int(soluong)})

        if not normalized_items:
            return jsonify({"status": "error", "message": "Danh sách món không hợp lệ"}), 400

        with get_cursor() as cur:
            # 1️⃣ Tạo đơn mới & lấy IDDonHang ngay khi chèn
            cur.execute("""
                INSERT INTO DonHang (IDBan, IDNguoiDung, TrangThaiBep, TrangThaiThanhToan, NgayTao)
                OUTPUT INSERTED.IDDonHang
                VALUES (?, NULL, N'Đang xử lý', 0, GETDATE())
            """, (idban,))
            res = cur.fetchone()
            if not res or res[0] is None:
                raise ValueError("Không thể lấy IDDonHang mới từ SQL Server")
            iddon = int(res[0])

            # 2️⃣ Lấy giá món ăn
            id_list = [it["IDMon"] for it in normalized_items]
            placeholders = ",".join("?" * len(id_list))
            cur.execute(f"SELECT IDMon, Gia FROM Menu WHERE IDMon IN ({placeholders})", tuple(id_list))
            prices = {int(r[0]): float(r[1]) for r in cur.fetchall()}

            # 3️⃣ Thêm chi tiết + tính tổng
            tong = 0.0
            for it in normalized_items:
                gia = prices.get(it["IDMon"])
                if gia is None:
                    continue
                cur.execute(
                    "INSERT INTO ChiTietDonHang (IDDonHang, IDMon, SoLuong, DonGia) VALUES (?, ?, ?, ?)",
                    (iddon, it["IDMon"], it["SoLuong"], gia),
                )
                tong += gia * it["SoLuong"]

            # 4️⃣ Cập nhật tổng tiền
            cur.execute("UPDATE DonHang SET TongTien=? WHERE IDDonHang=?", (tong, iddon))

        payload = {"IDDonHang": iddon, "IDBan": idban, "TrangThaiBep": "Đang xử lý", "TongTien": tong}
        socketio.emit("new_order", payload, namespace="/", to=None)
        
        logger.info(f"🔔 Phát new_order đến client: {payload}")

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

# ==============================
# 🔐 ADMIN - CRUD MENU & QR BÀN
# ==============================

# Helper: save PIL image to static/images/qrcodes and return filename/path
def save_qr_image(img, filename):
    qrcode_dir = os.path.join(app.static_folder, "images", "qrcodes")
    os.makedirs(qrcode_dir, exist_ok=True)
    filepath = os.path.join(qrcode_dir, filename)
    img.save(filepath)
    # return relative path under /images/
    return f"qrcodes/{filename}"

# ---------- MENU CRUD ----------
@app.route("/api/admin/menu", methods=["GET"])
def admin_list_menu():
    """Lấy toàn bộ món (admin)"""
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT IDMon, TenMon, MoTa, Gia, HinhAnh, ISNULL(DanhMuc, N'') AS DanhMuc, TrangThai
                FROM Menu
                ORDER BY IDMon DESC
            """)
            rows = fetch_all_as_dict(cur)
        return jsonify(rows), 200
    except Exception as e:
        logger.exception("Lỗi admin_list_menu: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/admin/menu", methods=["POST"])
def admin_create_menu():
    """
    Body JSON: { "TenMon": "...", "MoTa": "...", "Gia": 12000, "HinhAnh": "path/original.png", "DanhMuc": "DoAn" }
    """
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
            # Insert and return new ID using SCOPE_IDENTITY
            cur.execute("""
                INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, DanhMuc, TrangThai)
                VALUES (?, ?, ?, ?, ?, 1);
                SELECT SCOPE_IDENTITY();
            """, (ten, mota, gia, hinhanh, danh_muc))
            row = cur.fetchone()
            new_id = int(row[0]) if row else None

        return jsonify({"status":"ok", "IDMon": new_id}), 201

    except Exception as e:
        logger.exception("Lỗi admin_create_menu: %s", e)
        return jsonify({"status":"error","message": str(e)}), 500

@app.route("/api/admin/menu/<int:idmon>", methods=["PUT"])
def admin_update_menu(idmon):
    try:
        data = request.get_json(force=True)
        ten = data.get("TenMon")
        mota = data.get("MoTa")
        gia = data.get("Gia")
        hinhanh = data.get("HinhAnh")
        danh_muc = data.get("DanhMuc")
        trangthai = data.get("TrangThai")  # optional

        sets = []
        params = []
        if ten is not None:
            sets.append("TenMon=?"); params.append(ten)
        if mota is not None:
            sets.append("MoTa=?"); params.append(mota)
        if gia is not None:
            sets.append("Gia=?"); params.append(float(gia))
        if hinhanh is not None:
            sets.append("HinhAnh=?"); params.append(hinhanh)
        if danh_muc is not None:
            sets.append("DanhMuc=?"); params.append(danh_muc)
        if trangthai is not None:
            sets.append("TrangThai=?"); params.append(int(trangthai))

        if not sets:
            return jsonify({"status":"error","message":"No fields to update"}), 400

        params.append(idmon)
        with get_cursor() as cur:
            cur.execute(f"UPDATE Menu SET {', '.join(sets)} WHERE IDMon=?", tuple(params))

        return jsonify({"status":"ok"}), 200

    except Exception as e:
        logger.exception("Lỗi admin_update_menu: %s", e)
        return jsonify({"status":"error","message": str(e)}), 500

@app.route("/api/admin/menu/<int:idmon>", methods=["DELETE"])
def admin_delete_menu(idmon):
    try:
        with get_cursor() as cur:
            # Nếu muốn soft-delete: UPDATE Menu SET TrangThai=0 WHERE IDMon=?
            cur.execute("DELETE FROM Menu WHERE IDMon=?", (idmon,))
        return jsonify({"status":"ok"}), 200
    except Exception as e:
        logger.exception("Lỗi admin_delete_menu: %s", e)
        return jsonify({"status":"error","message": str(e)}), 500

# ---------- TABLE CRUD + QR ----------
@app.route("/api/admin/table", methods=["POST"])
def admin_create_table():
    """
    Tạo bàn và sinh QR.
    Body JSON: { "TenBan": "Bàn 1", "base_url": "https://site.com/khach" }
    base_url: url khách sẽ quét (mình sẽ append ?table=<id>)
    """
    try:
        data = request.get_json(force=True)
        tenban = data.get("TenBan") or f"Ban-{int(datetime.utcnow().timestamp())}"
        base_url = data.get("base_url") or None

        with get_cursor() as cur:
            cur.execute("INSERT INTO Ban (TenBan) VALUES (?) ; SELECT SCOPE_IDENTITY()", (tenban,))
            r = cur.fetchone()
            idban = int(r[0]) if r else None

            # Prepare QR content (link)
            if base_url:
                qr_link = f"{base_url}?table={idban}"
            else:
                # Fallback to localhost (adjust when deploy)
                qr_link = f"http://127.0.0.1:5000/khach?table={idban}"

            # Generate QR image (PIL)
            qr = qrcode.QRCode(box_size=8, border=2)
            qr.add_data(qr_link)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")

            filename = f"qr_table_{idban}.png"
            saved_rel = save_qr_image(img, filename)  # returns "qrcodes/qr_table_123.png"

            # Save QR path into DB (optional)
            cur.execute("UPDATE Ban SET QRPath=? WHERE IDBan=?", (saved_rel, idban))

        return jsonify({"status":"ok", "IDBan": idban, "QRPath": saved_rel, "qr_link": qr_link}), 201

    except Exception as e:
        logger.exception("Lỗi admin_create_table: %s", e)
        return jsonify({"status":"error","message": str(e)}), 500

@app.route("/api/admin/table", methods=["GET"])
def admin_list_tables():
    try:
        with get_cursor() as cur:
            cur.execute("SELECT IDBan, TenBan, QRPath FROM Ban ORDER BY IDBan")
            rows = fetch_all_as_dict(cur)
        return jsonify(rows), 200
    except Exception as e:
        logger.exception("Lỗi admin_list_tables: %s", e)
        return jsonify({"status":"error","message": str(e)}), 500

# alias: /api/admin/ban (để frontend cũ dễ dùng)
@app.route("/api/admin/ban", methods=["GET"])
def admin_list_ban_alias():
    return admin_list_tables()

@app.route("/api/admin/table/<int:idban>", methods=["DELETE"])
def admin_delete_table(idban):
    try:
        with get_cursor() as cur:
            cur.execute("DELETE FROM Ban WHERE IDBan=?", (idban,))
        # Optionally remove QR file from filesystem if you want:
        # try:
        #     filepath = os.path.join(app.static_folder, "images", saved_rel_from_db)
        #     os.remove(filepath)
        # except Exception:
        #     pass
        return jsonify({"status":"ok"}), 200
    except Exception as e:
        logger.exception("Lỗi admin_delete_table: %s", e)
        return jsonify({"status":"error","message": str(e)}), 500

# ==============================
# ⚙️ CHẠY SERVER
# ==============================
if __name__ == "__main__":
    try:
        test_connection()
        logger.info("✅ Kết nối DB thành công.")
    except Exception as e:
        logger.critical("❌ Kết nối DB thất bại: %s", e)

    socketio.run(app, host="127.0.0.1", port=5000, debug=True, use_reloader=False)
