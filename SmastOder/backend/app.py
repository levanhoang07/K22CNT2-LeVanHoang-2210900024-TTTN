# app.py (Phiên bản đã sửa & cải tiến)
import os
import logging
import pyodbc  # để bắt lỗi pyodbc.Error
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
from db import get_cursor, test_connection  # giả sử bạn có get_cursor() và test_connection()

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [FLASK] - %(message)s')
logger = logging.getLogger(__name__)

# --- Cấu hình Ứng dụng ---
app = Flask(__name__, static_folder='static')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

TIMEZONE = os.getenv('APP_TIMEZONE', 'Asia/Ho_Chi_Minh')

# --- Hàm tiện ích ---
def fetch_all_as_dict(cursor):
    """Lấy tất cả hàng từ cursor và trả về dưới dạng list of dict."""
    if not cursor.description:
        return []
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, r)) for r in cursor.fetchall()]

# --- Route phụ phục vụ ảnh (nếu bạn muốn dùng /images/...) ---
@app.route('/images/<path:filename>')
def serve_image(filename):
    """Phục vụ ảnh từ folder static/images"""
    return send_from_directory(os.path.join(app.static_folder, 'images'), filename)

# --- ROUTE: /api/menu (GET) ---
@app.route('/api/menu', methods=['GET'])
def api_menu():
    """Trả về danh sách thực đơn từ CSDL dưới dạng JSON."""
    try:
        with get_cursor() as cur:
            # Lấy thêm DanhMuc nếu có trong DB
            cur.execute("SELECT IDMon, TenMon, MoTa, Gia, HinhAnh, ISNULL(DanhMuc, N'') AS DanhMuc FROM Menu WHERE TrangThai=1 ORDER BY TenMon")
            rows = fetch_all_as_dict(cur)
        return jsonify(rows), 200
    except pyodbc.Error as e:
        logger.error("Database error in api_menu: %s", e)
        return jsonify({'status': 'error', 'message': f"Lỗi CSDL: {str(e)}"}), 500
    except Exception as e:
        logger.exception("Unexpected error in api_menu.")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- ROUTE: /api/donhang (POST) ---
@app.route('/api/donhang', methods=['POST'])
def api_create_donhang():
    """Tạo đơn hàng mới và chi tiết đơn hàng."""
    try:
        data = request.get_json() or {}
        idban = data.get('IDBan') or data.get('table')  # chấp nhận cả hai khóa
        items = data.get('Items') or data.get('items') or []

        if not idban or not items:
            return jsonify({'status': 'error', 'message': 'Thiếu IDBan hoặc chi tiết món'}), 400

        # Chuyển đổi items về định dạng mong muốn (mỗi item: {IDMon, SoLuong})
        normalized_items = []
        for it in items:
            # chấp nhận nhiều dạng key từ frontend
            idmon = it.get('IDMon') or it.get('id') or it.get('ID') or it.get('Id')
            soluong = it.get('SoLuong') or it.get('qty') or it.get('SoLuong', 1) or it.get('quantity', 1)
            if idmon is None:
                continue
            normalized_items.append({'IDMon': int(idmon), 'SoLuong': int(soluong)})

        if not normalized_items:
            return jsonify({'status': 'error', 'message': 'Danh sách món không hợp lệ'}), 400

        with get_cursor() as cur:
            # 1. Tạo DonHang
            cur.execute(
                "INSERT INTO DonHang (IDBan, IDNguoiDung, TrangThaiBep, TrangThaiThanhToan, NgayTao) "
                "VALUES (?, NULL, N'Đang xử lý', 0, GETDATE())",
                (idban,)
            )
            # Lấy ID vừa insert
            cur.execute("SELECT SCOPE_IDENTITY()")
            row = cur.fetchone()
            if not row:
                raise RuntimeError("Không lấy được IDDonHang mới từ SCOPE_IDENTITY")
            iddon = int(row[0])

            # 2. Lấy giá hiện tại cho các IDMon cần thiết
            item_ids = [it['IDMon'] for it in normalized_items]
            q_placeholders = ','.join('?' for _ in item_ids)
            cur.execute(f"SELECT IDMon, Gia FROM Menu WHERE IDMon IN ({q_placeholders})", tuple(item_ids))
            prices = {int(r[0]): float(r[1]) for r in cur.fetchall()}

            # 3. Insert ChiTietDonHang
            for it in normalized_items:
                idmon = it['IDMon']
                sl = it.get('SoLuong', 1)
                gia = prices.get(idmon)
                if gia is None:
                    logger.warning("IDMon %s không tìm thấy giá. Bỏ qua.", idmon)
                    continue
                cur.execute(
                    "INSERT INTO ChiTietDonHang (IDDonHang, IDMon, SoLuong, DonGia) VALUES (?, ?, ?, ?)",
                    (iddon, idmon, sl, gia)
                )

        # Thông báo qua SocketIO
        socketio.emit('new_order', {'IDDonHang': iddon, 'IDBan': idban}, broadcast=True)
        logger.info("New order created: IDBan=%s, IDDonHang=%s", idban, iddon)
        return jsonify({'status': 'ok', 'IDDonHang': iddon}), 201

    except pyodbc.Error as e:
        logger.error("Database error in api_create_donhang: %s", e)
        return jsonify({'status': 'error', 'message': f"Lỗi CSDL: {str(e)}"}), 500
    except Exception as e:
        logger.exception("Unexpected error in api_create_donhang.")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ----------------- API Bếp update (PUT) -----------------
@app.route('/api/bep/cap-nhat-trang-thai/<int:iddon>', methods=['PUT'])
def api_bep_update(iddon):
    """Cập nhật trạng thái Bếp của đơn hàng và thông báo qua Socket."""
    try:
        body = request.get_json() or {}
        trang = body.get('TrangThai') or body.get('trangthai') or body.get('status')
        if not trang:
            return jsonify({'status': 'error', 'message': 'Thiếu trường TrangThai'}), 400

        with get_cursor() as cur:
            cur.execute("UPDATE DonHang SET TrangThaiBep=? WHERE IDDonHang=?", (trang, iddon))
            cur.execute("SELECT IDDonHang, IDBan, TrangThaiBep FROM DonHang WHERE IDDonHang=?", (iddon,))
            r = cur.fetchone()

            if not r:
                return jsonify({'status': 'error', 'message': 'Đơn hàng không tồn tại'}), 404

            payload = {'IDDonHang': int(r[0]), 'IDBan': r[1], 'TrangThaiBep': r[2]}

        socketio.emit('bep_status_update', payload, broadcast=True)
        logger.info("Order %s status updated to: %s", iddon, trang)
        return jsonify({'status': 'ok', 'payload': payload}), 200
    except pyodbc.Error as e:
        logger.error("Database error in api_bep_update: %s", e)
        return jsonify({'status': 'error', 'message': f"Lỗi CSDL: {str(e)}"}), 500
    except Exception as e:
        logger.exception("Unexpected error in api_bep_update.")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ----------------- API Thanh toán (PUT) -----------------
@app.route('/api/donhang/thanh-toan/<int:iddon>', methods=['PUT'])
def api_thanh_toan(iddon):
    """Xác nhận thanh toán và tính tổng tiền nếu chưa có."""
    try:
        with get_cursor() as cur:
            cur.execute(
                "SELECT SUM(SoLuong * DonGia) FROM ChiTietDonHang WHERE IDDonHang=?",
                (iddon,)
            )
            s = cur.fetchone()
            tong = float(s[0]) if s and s[0] is not None else 0.0

            cur.execute(
                "UPDATE DonHang SET TrangThaiThanhToan=1, TongTien=? WHERE IDDonHang=?",
                (tong, iddon)
            )

            cur.execute("SELECT IDBan FROM DonHang WHERE IDDonHang=?", (iddon,))
            r = cur.fetchone()
            idban = r[0] if r else None

        socketio.emit('payment_done', {'IDDonHang': iddon, 'TongTien': tong, 'IDBan': idban}, broadcast=True)
        logger.info("Order %s paid. Total: %s", iddon, tong)
        return jsonify({'status': 'ok', 'IDDonHang': iddon, 'TongTien': tong}), 200
    except pyodbc.Error as e:
        logger.error("Database error in api_thanh_toan: %s", e)
        return jsonify({'status': 'error', 'message': f"Lỗi CSDL: {str(e)}"}), 500
    except Exception as e:
        logger.exception("Unexpected error in api_thanh_toan.")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ----------------- API Đơn hàng active (GET) -----------------
@app.route('/api/donhang/active', methods=['GET'])
def api_donhang_active():
    """Lấy danh sách các đơn hàng chưa thanh toán (TrangThaiThanhToan=0) HOẶC đang xử lý ở bếp."""
    try:
        query = (
            "SELECT IDDonHang, IDBan, NgayTao, TrangThaiBep, TrangThaiThanhToan, TongTien "
            "FROM DonHang "
            "WHERE TrangThaiThanhToan = 0 OR TrangThaiBep != N'Hoàn thành' "
            "ORDER BY NgayTao DESC"
        )
        with get_cursor() as cur:
            cur.execute(query)
            rows = fetch_all_as_dict(cur)
        return jsonify(rows), 200
    except pyodbc.Error as e:
        logger.error("Database error in api_donhang_active: %s", e)
        return jsonify({'status': 'error', 'message': f"Lỗi CSDL: {str(e)}"}), 500
    except Exception as e:
        logger.exception("Unexpected error in api_donhang_active.")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ----------------- API Báo cáo doanh thu (GET) -----------------
@app.route('/api/baocao/doanhthu', methods=['GET'])
def api_baocao_doanhthu():
    """Trả về báo cáo doanh thu theo Ngày, Tuần, hoặc Tháng."""
    try:
        typ = request.args.get('type', 'ngay').lower()
        dfrom = request.args.get('from')
        dto = request.args.get('to')

        params = []
        where_clauses = ["d.TrangThaiThanhToan = 1"]

        # lọc theo ngày nếu có
        if dfrom:
            where_clauses.append("CONVERT(date, d.NgayTao) >= ?")
            params.append(dfrom)
        if dto:
            where_clauses.append("CONVERT(date, d.NgayTao) <= ?")
            params.append(dto)

        where_sql = " AND ".join(where_clauses)
        if typ == 'ngay':
            select_group = "CONVERT(date, d.NgayTao) AS ThoiGian"
            group_by = "CONVERT(date, d.NgayTao)"
        elif typ == 'tuan':
            select_group = "CONVERT(NVARCHAR, DATEPART(wk, d.NgayTao)) + N'/' + CONVERT(NVARCHAR, DATEPART(yy, d.NgayTao)) AS ThoiGian"
            group_by = "DATEPART(wk, d.NgayTao), DATEPART(yy, d.NgayTao)"
        elif typ == 'thang':
            select_group = "CONVERT(NVARCHAR, DATEPART(mm, d.NgayTao)) + N'/' + CONVERT(NVARCHAR, DATEPART(yy, d.NgayTao)) AS ThoiGian"
            group_by = "DATEPART(mm, d.NgayTao), DATEPART(yy, d.NgayTao)"
        else:
            return jsonify({'status': 'error', 'message': 'Loại báo cáo không hỗ trợ. Sử dụng ngay/tuan/thang'}), 400

        q = (
            f"SELECT {select_group}, "
            "SUM(ct.SoLuong * ct.DonGia) AS TongDoanhThu, "
            "COUNT(DISTINCT d.IDDonHang) AS SoLuongDon "
            "FROM DonHang d JOIN ChiTietDonHang ct ON d.IDDonHang = ct.IDDonHang "
            f"WHERE {where_sql} "
            f"GROUP BY {group_by} "
            "ORDER BY ThoiGian DESC"
        )

        with get_cursor() as cur:
            cur.execute(q, tuple(params))
            rows = fetch_all_as_dict(cur)

        return jsonify(rows), 200
    except pyodbc.Error as e:
        logger.error("Database error in api_baocao_doanhthu: %s", e)
        return jsonify({'status': 'error', 'message': f"Lỗi CSDL: {str(e)}"}), 500
    except Exception as e:
        logger.exception("Unexpected error in api_baocao_doanhthu.")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- Khởi động Ứng dụng ---
if __name__ == '__main__':
    logger.info("Starting database connection test...")
    try:
        test_connection()
        logger.info("Database connection is successful. Starting Flask server...")
    except Exception as e:
        logger.critical("FATAL: Database connection failed. Cannot start application.")
        # Nếu bạn muốn dừng khi DB lỗi, bỏ comment dòng sau
        # raise SystemExit(e)

    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))

    # Chạy SocketIO với Flask instance
    socketio.run(app, host=host, port=port, debug=True, use_reloader=False)
