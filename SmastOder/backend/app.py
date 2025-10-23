#!/usr/bin/env python3
# app.py - Flask + SocketIO (eventlet)

import eventlet
eventlet.monkey_patch()  # cần gọi càng sớm càng tốt

import os
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from db import get_cursor, test_connection

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

# ==============================
# 🖼️ PHỤC VỤ ẢNH STATIC
# ==============================
@app.route("/images/<path:filename>")
def serve_image(filename):
    static_images = os.path.join(app.static_folder, "images")
    return send_from_directory(static_images, filename)

# ==============================
# 🍜 LẤY DANH SÁCH MENU
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
# 📋 LẤY DANH SÁCH ĐƠN HÀNG
# ==============================
@app.route("/api/donhang", methods=["GET"])
def api_get_donhang():
    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT IDDonHang, IDBan, TrangThaiBep, TrangThaiThanhToan,
                       FORMAT(NgayTao, 'yyyy-MM-dd HH:mm:ss') AS NgayTao,
                       ISNULL(TongTien, 0) AS TongTien
                FROM DonHang
                ORDER BY NgayTao DESC
            """)
            rows = fetch_all_as_dict(cur)
        return jsonify(rows), 200
    except Exception as e:
        logger.exception("Lỗi lấy danh sách đơn: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500

# ==============================
# 🧾 TẠO ĐƠN HÀNG MỚI
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

        # ⚙️ Transaction: tạo DonHang + ChiTietDonHang
        with get_cursor() as cur:
            # 1️⃣ Insert DonHang
            cur.execute("""
                INSERT INTO DonHang (IDBan, IDNguoiDung, TrangThaiBep, TrangThaiThanhToan, NgayTao)
                VALUES (?, NULL, N'Đang xử lý', 0, GETDATE())
            """, (idban,))
            cur.execute("SELECT SCOPE_IDENTITY()")
            iddon = int(cur.fetchone()[0])

            # 2️⃣ Lấy giá món
            id_list = [it["IDMon"] for it in normalized_items]
            placeholders = ",".join("?" * len(id_list))
            cur.execute(f"SELECT IDMon, Gia FROM Menu WHERE IDMon IN ({placeholders})", tuple(id_list))
            prices = {int(r[0]): float(r[1]) for r in cur.fetchall()}

            # 3️⃣ Insert chi tiết + tính tổng
            tong = 0.0
            for it in normalized_items:
                gia = prices.get(it["IDMon"])
                if gia is None:
                    continue
                cur.execute("""
                    INSERT INTO ChiTietDonHang (IDDonHang, IDMon, SoLuong, DonGia)
                    VALUES (?, ?, ?, ?)
                """, (iddon, it["IDMon"], it["SoLuong"], gia))
                tong += gia * it["SoLuong"]

            # 4️⃣ Cập nhật tổng tiền
            try:
                cur.execute("UPDATE DonHang SET TongTien = ? WHERE IDDonHang = ?", (tong, iddon))
            except Exception:
                pass  # cột có thể không tồn tại → bỏ qua

        # 🔔 Gửi realtime cho các client
        payload = {"IDDonHang": iddon, "IDBan": idban, "TrangThaiBep": "Đang xử lý", "TongTien": tong}
        socketio.emit("new_order", payload, broadcast=True)
        logger.info(f"✅ Đã tạo đơn hàng ID {iddon} cho bàn {idban}")

        return jsonify({"status": "ok", "IDDonHang": iddon}), 201

    except Exception as e:
        logger.exception("Lỗi tạo đơn hàng: %s", e)
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

        socketio.emit("bep_status_update", payload, broadcast=True)
        logger.info(f"👨‍🍳 Đơn {iddon} đã hoàn tất.")
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
# ⚙️ CHẠY SERVER
# ==============================
if __name__ == "__main__":
    try:
        test_connection()
        logger.info("✅ Kết nối DB thành công. Khởi động Flask...")
    except Exception as e:
        logger.critical("❌ Kết nối DB thất bại: %s", e)

    socketio.run(app, host="0.0.0.0", port=5000, debug=True, use_reloader=False)
