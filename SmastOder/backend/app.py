import os
import logging
import pyodbc
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
from db import get_cursor, test_connection

# --- Cấu hình logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [FLASK] - %(message)s')
logger = logging.getLogger(__name__)

# --- Flask ---
app = Flask(__name__, static_folder='static')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# --- Hàm tiện ích ---
def fetch_all_as_dict(cursor):
    if not cursor.description:
        return []
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]

# --- Phục vụ ảnh ---
@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(os.path.join(app.static_folder, 'images'), filename)

# --- API: /api/menu ---
@app.route('/api/menu', methods=['GET'])
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
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- API: /api/donhang (POST) ---
@app.route('/api/donhang', methods=['POST'])
def api_create_donhang():
    try:
        data = request.get_json(force=True)
        idban = data.get('IDBan') or data.get('table')
        items = data.get('Items') or data.get('items') or []

        if not idban or not items:
            return jsonify({'status': 'error', 'message': 'Thiếu IDBan hoặc danh sách món'}), 400

        normalized_items = []
        for it in items:
            idmon = it.get('IDMon') or it.get('id') or it.get('ID')
            soluong = it.get('SoLuong') or it.get('qty') or 1
            if not idmon:
                continue
            normalized_items.append({'IDMon': int(idmon), 'SoLuong': int(soluong)})

        if not normalized_items:
            return jsonify({'status': 'error', 'message': 'Danh sách món không hợp lệ'}), 400

        with get_cursor(commit=True) as cur:
            # 1️⃣ Insert đơn hàng
            cur.execute("""
                INSERT INTO DonHang (IDBan, IDNguoiDung, TrangThaiBep, TrangThaiThanhToan, NgayTao)
                VALUES (?, NULL, N'Đang xử lý', 0, GETDATE())
            """, (idban,))
            cur.execute("SELECT SCOPE_IDENTITY()")
            iddon = int(cur.fetchone()[0])

            # 2️⃣ Lấy giá từ Menu
            id_list = [it['IDMon'] for it in normalized_items]
            q = f"SELECT IDMon, Gia FROM Menu WHERE IDMon IN ({','.join('?'*len(id_list))})"
            cur.execute(q, tuple(id_list))
            prices = {int(r[0]): float(r[1]) for r in cur.fetchall()}

            # 3️⃣ Insert chi tiết đơn hàng
            for it in normalized_items:
                gia = prices.get(it['IDMon'])
                if gia is None:
                    continue
                cur.execute("""
                    INSERT INTO ChiTietDonHang (IDDonHang, IDMon, SoLuong, DonGia)
                    VALUES (?, ?, ?, ?)
                """, (iddon, it['IDMon'], it['SoLuong'], gia))

        socketio.emit('new_order', {'IDDonHang': iddon, 'IDBan': idban}, broadcast=True)
        logger.info(f"✅ Đã tạo đơn hàng mới ID {iddon} cho bàn {idban}")
        return jsonify({'status': 'ok', 'IDDonHang': iddon}), 201

    except Exception as e:
        logger.exception("Lỗi tạo đơn hàng: %s", e)
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- API cập nhật trạng thái Bếp ---
@app.route('/api/bep/cap-nhat-trang-thai/<int:iddon>', methods=['PUT'])
def api_bep_update(iddon):
    try:
        body = request.get_json() or {}
        trang = body.get('TrangThai') or body.get('status')
        if not trang:
            return jsonify({'status': 'error', 'message': 'Thiếu trạng thái'}), 400

        with get_cursor(commit=True) as cur:
            cur.execute("UPDATE DonHang SET TrangThaiBep=? WHERE IDDonHang=?", (trang, iddon))
            cur.execute("SELECT IDDonHang, IDBan, TrangThaiBep FROM DonHang WHERE IDDonHang=?", (iddon,))
            r = cur.fetchone()
            if not r:
                return jsonify({'status': 'error', 'message': 'Không tìm thấy đơn'}), 404
            payload = {'IDDonHang': int(r[0]), 'IDBan': r[1], 'TrangThaiBep': r[2]}

        socketio.emit('bep_status_update', payload, broadcast=True)
        return jsonify({'status': 'ok', 'payload': payload}), 200
    except Exception as e:
        logger.exception("Lỗi cập nhật trạng thái: %s", e)
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- API Thanh toán ---
@app.route('/api/donhang/thanh-toan/<int:iddon>', methods=['PUT'])
def api_thanh_toan(iddon):
    try:
        with get_cursor(commit=True) as cur:
            cur.execute("SELECT SUM(SoLuong * DonGia) FROM ChiTietDonHang WHERE IDDonHang=?", (iddon,))
            tong = float(cur.fetchone()[0] or 0)
            cur.execute("UPDATE DonHang SET TrangThaiThanhToan=1, TongTien=? WHERE IDDonHang=?", (tong, iddon))
            cur.execute("SELECT IDBan FROM DonHang WHERE IDDonHang=?", (iddon,))
            idban = cur.fetchone()[0]
        socketio.emit('payment_done', {'IDDonHang': iddon, 'TongTien': tong, 'IDBan': idban}, broadcast=True)
        return jsonify({'status': 'ok', 'TongTien': tong}), 200
    except Exception as e:
        logger.exception("Lỗi thanh toán: %s", e)
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- Chạy ---
if __name__ == '__main__':
    try:
        test_connection()
        logger.info("✅ Kết nối DB thành công. Khởi động Flask...")
    except Exception as e:
        logger.critical("❌ Kết nối DB thất bại: %s", e)
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=False)
