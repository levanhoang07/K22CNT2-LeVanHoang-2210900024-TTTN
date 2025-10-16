# app.py (Phiên bản nâng cấp)
import os
import logging
import pyodbc # Import pyodbc để có thể bắt lỗi pyodbc.Error
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from db import get_cursor, test_connection # Import test_connection

# Cấu hình logging cho ứng dụng
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [FLASK] - %(message)s')
logger = logging.getLogger(__name__)

# --- Cấu hình Ứng dụng ---
app = Flask(__name__)
# Cho phép CORS từ mọi nguồn (quan trọng cho môi trường dev)
CORS(app) 
# Chú ý: Cấu hình SocketIO nên khớp với config của Flask
# Sử dụng async_mode='threading' để tránh vấn đề trên Windows/một số môi trường
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Thiết lập múi giờ mặc định cho ứng dụng (Ví dụ: Giờ Việt Nam)
# Lưu ý: Nên cố gắng sử dụng thời gian TIMESTAMP mặc định của SQL Server (GETDATE() hoặc SYSUTCDATETIME())
# Tuy nhiên, nếu cần tính toán thời gian Python, ta đặt múi giờ:
TIMEZONE = os.getenv('APP_TIMEZONE', 'Asia/Ho_Chi_Minh')


# --- Hàm tiện ích ---
def fetch_all_as_dict(cursor):
    """Lấy tất cả hàng từ cursor và trả về dưới dạng list of dict."""
    if not cursor.description:
        return []
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, r)) for r in cursor.fetchall()]

# --- ROUTE: /api/menu (GET) ---
@app.route('/api/menu', methods=['GET'])
def api_menu():
    """Trả về danh sách thực đơn từ CSDL dưới dạng JSON."""
    try:
        with get_cursor() as cur:
            # Chỉ lấy món đang bán (ví dụ: TrangThai=1)
            cur.execute("SELECT IDMon, TenMon, MoTa, Gia, HinhAnh FROM Menu WHERE TrangThai=1 ORDER BY TenMon")
            rows = fetch_all_as_dict(cur)
        return jsonify(rows)
    except pyodbc.Error as e:
        logger.error("Database error in api_menu: %s", e)
        return jsonify({'status': 'error', 'message': f"Lỗi CSDL: {str(e)}"}, 500)
    except Exception as e:
        logger.exception("Unexpected error in api_menu.")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- ROUTE: /api/donhang (POST) ---
@app.route('/api/donhang', methods=['POST'])
def api_create_donhang():
    """Tạo đơn hàng mới và chi tiết đơn hàng."""
    try:
        data = request.get_json() or {}
        idban = data.get('IDBan')
        items = data.get('Items') or []
        
        if not idban or not items:
            return jsonify({'status': 'error', 'message': 'Thiếu IDBan hoặc chi tiết món'}), 400

        with get_cursor() as cur:
            # 1. Tạo đơn hàng chính
            # Sử dụng GETDATE() của SQL Server cho thời gian chính xác và nhất quán
            cur.execute(
                "INSERT INTO DonHang (IDBan, IDNguoiDung, TrangThaiBep, TrangThaiThanhToan, NgayTao) "
                "VALUES (?, NULL, N'Đang xử lý', 0, GETDATE())",
                (idban,)
            )
            cur.execute("SELECT SCOPE_IDENTITY()")
            iddon = cur.fetchone()[0]
            if iddon is None:
                raise RuntimeError("Không lấy được IDDonHang mới từ SCOPE_IDENTITY")

            # 2. Lấy thông tin giá món ăn (đảm bảo giá là giá tại thời điểm đặt hàng)
            item_ids = [int(it.get('IDMon')) for it in items]
            
            # Sử dụng truy vấn SQL parameter-safe để lấy giá
            q_placeholders = ','.join('?' for _ in item_ids)
            cur.execute(f"SELECT IDMon, Gia FROM Menu WHERE IDMon IN ({q_placeholders})", tuple(item_ids))
            prices = {row[0]: float(row[1]) for row in cur.fetchall()}

            # 3. Chèn chi tiết đơn hàng
            for it in items:
                idmon = int(it.get('IDMon'))
                sl = int(it.get('SoLuong', 1))
                gia = prices.get(idmon)
                
                if gia is None:
                    logger.warning("IDMon %s không tìm thấy giá. Bỏ qua.", idmon)
                    continue

                cur.execute(
                    "INSERT INTO ChiTietDonHang (IDDonHang, IDMon, SoLuong, DonGia) VALUES (?, ?, ?, ?)",
                    (iddon, idmon, sl, gia)
                )

        # Thông báo qua SocketIO
        socketio.emit('new_order', {'IDDonHang': int(iddon), 'IDBan': idban}, broadcast=True)
        logger.info("New order created: IDBan=%s, IDDonHang=%s", idban, int(iddon))
        return jsonify({'status': 'ok', 'IDDonHang': int(iddon)})
    except pyodbc.Error as e:
        logger.error("Database error in api_create_donhang: %s", e)
        return jsonify({'status': 'error', 'message': f"Lỗi CSDL: {str(e)}"}, 500)
    except Exception as e:
        logger.exception("Unexpected error in api_create_donhang.")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ----------------- API Bep update (PUT) -----------------
@app.route('/api/bep/cap-nhat-trang-thai/<int:iddon>', methods=['PUT'])
def api_bep_update(iddon):
    """Cập nhật trạng thái Bếp của đơn hàng và thông báo qua Socket."""
    try:
        trang = request.get_json().get('TrangThai')
        if not trang:
            return jsonify({'status': 'error', 'message': 'Thiếu trường TrangThai'}), 400

        with get_cursor() as cur:
            cur.execute("UPDATE DonHang SET TrangThaiBep=? WHERE IDDonHang=?", (trang, iddon))
            # Lấy thông tin cập nhật (IDBan và TrangThaiBep)
            cur.execute("SELECT IDDonHang, IDBan, TrangThaiBep FROM DonHang WHERE IDDonHang=?", (iddon,))
            r = cur.fetchone()
            
            if not r:
                return jsonify({'status': 'error', 'message': 'Đơn hàng không tồn tại'}), 404
            
            payload = {'IDDonHang': r[0], 'IDBan': r[1], 'TrangThaiBep': r[2]}

        socketio.emit('bep_status_update', payload, broadcast=True)
        logger.info("Order %s status updated to: %s", iddon, trang)
        return jsonify({'status': 'ok', 'payload': payload})
    except pyodbc.Error as e:
        logger.error("Database error in api_bep_update: %s", e)
        return jsonify({'status': 'error', 'message': f"Lỗi CSDL: {str(e)}"}, 500)
    except Exception as e:
        logger.exception("Unexpected error in api_bep_update.")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ----------------- API Thanh toan (PUT) -----------------
@app.route('/api/donhang/thanh-toan/<int:iddon>', methods=['PUT'])
def api_thanh_toan(iddon):
    """Xác nhận thanh toán và tính tổng tiền nếu chưa có."""
    try:
        with get_cursor() as cur:
            # 1. Tính toán tổng tiền trước khi xác nhận thanh toán (đảm bảo TongTien được lưu)
            cur.execute(
                "SELECT SUM(SoLuong * DonGia) FROM ChiTietDonHang WHERE IDDonHang=?", 
                (iddon,)
            )
            s = cur.fetchone()
            tong = float(s[0]) if s and s[0] is not None else 0.0

            # 2. Cập nhật trạng thái và lưu TongTien
            cur.execute(
                "UPDATE DonHang SET TrangThaiThanhToan=1, TongTien=? WHERE IDDonHang=?", 
                (tong, iddon)
            )

            # 3. Lấy IDBan để thông báo
            cur.execute("SELECT IDBan FROM DonHang WHERE IDDonHang=?", (iddon,))
            r = cur.fetchone()
            idban = r[0] if r else None

        socketio.emit('payment_done', {'IDDonHang': iddon, 'TongTien': tong, 'IDBan': idban}, broadcast=True)
        logger.info("Order %s paid. Total: %s", iddon, tong)
        return jsonify({'status': 'ok', 'IDDonHang': iddon, 'TongTien': tong})
    except pyodbc.Error as e:
        logger.error("Database error in api_thanh_toan: %s", e)
        return jsonify({'status': 'error', 'message': f"Lỗi CSDL: {str(e)}"}, 500)
    except Exception as e:
        logger.exception("Unexpected error in api_thanh_toan.")
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ----------------- API Don hang active (GET) -----------------
@app.route('/api/donhang/active', methods=['GET'])
def api_donhang_active():
    """Lấy danh sách các đơn hàng chưa thanh toán (TrangThaiThanhToan=0) HOẶC đang xử lý ở bếp."""
    try:
        # Lọc theo trạng thái thanh toán (ví dụ: TrangThaiThanhToan=0) hoặc trạng thái bếp khác "Hoàn thành"
        query = (
            "SELECT IDDonHang, IDBan, NgayTao, TrangThaiBep, TrangThaiThanhToan, TongTien "
            "FROM DonHang "
            "WHERE TrangThaiThanhToan = 0 OR TrangThaiBep != N'Hoàn thành' "
            "ORDER BY NgayTao DESC"
        )
        with get_cursor() as cur:
            cur.execute(query)
            rows = fetch_all_as_dict(cur)
        return jsonify(rows)
    except pyodbc.Error as e:
        logger.error("Database error in api_donhang_active: %s", e)
        return jsonify({'status': 'error', 'message': f"Lỗi CSDL: {str(e)}"}, 500)
    except Exception as e:
        logger.exception("Unexpected error in api_donhang_active.")
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ----------------- API Bao cao doanh thu (GET) -----------------
@app.route('/api/baocao/doanhthu', methods=['GET'])
def api_baocao_doanhthu():
    """Trả về báo cáo doanh thu theo Ngày, Tuần, hoặc Tháng."""
    try:
        typ = request.args.get('type', 'ngay').lower()
        dfrom = request.args.get('from')
        dto = request.args.get('to')
        
        # Base query: Lấy tổng tiền từ ChiTietDonHang (đáng tin cậy hơn DonHang.TongTien)
        q_base = (
            "SELECT SUM(ct.SoLuong * ct.DonGia) AS TongDoanhThu, "
            "COUNT(DISTINCT d.IDDonHang) AS SoLuongDon "
            "FROM DonHang d JOIN ChiTietDonHang ct ON d.IDDonHang = ct.IDDonHang "
            "WHERE d.TrangThaiThanhToan = 1"
        )
        
        if typ == 'ngay':
            group_by = "CONVERT(date, d.NgayTao)"
            select_group = "CONVERT(date, d.NgayTao) AS ThoiGian"
        elif typ == 'tuan':
            # GROUP BY tuần và năm
            group_by = "DATEPART(wk, d.NgayTao), DATEPART(yy, d.NgayTao)"
            select_group = "CONVERT(NVARCHAR, DATEPART(wk, d.NgayTao)) + N'/' + CONVERT(NVARCHAR, DATEPART(yy, d.NgayTao)) AS ThoiGian"
        elif typ == 'thang':
            # GROUP BY tháng và năm
            group_by = "DATEPART(mm, d.NgayTao), DATEPART(yy, d.NgayTao)"
            select_group = "CONVERT(NVARCHAR, DATEPART(mm, d.NgayTao)) + N'/' + CONVERT(NVARCHAR, DATEPART(yy, d.NgayTao)) AS ThoiGian"
        else:
            return jsonify({'status': 'error', 'message': 'Loại báo cáo không hỗ trợ. Sử dụng ngay/tuan/thang'}), 400

        # Xây dựng truy vấn cuối cùng
        q = f"SELECT {select_group}, {q_base} GROUP BY {group_by} ORDER BY ThoiGian DESC"
        
        params = []
        if dfrom:
            q += f" AND CONVERT(date, d.NgayTao) >= ?"
            params.append(dfrom)
        if dto:
            q += f" AND CONVERT(date, d.NgayTao) <= ?"
            params.append(dto)
            
        with get_cursor() as cur:
            cur.execute(q, tuple(params))
            rows = fetch_all_as_dict(cur)
        
        return jsonify(rows)
    except pyodbc.Error as e:
        logger.error("Database error in api_baocao_doanhthu: %s", e)
        return jsonify({'status': 'error', 'message': f"Lỗi CSDL: {str(e)}"}, 500)
    except Exception as e:
        logger.exception("Unexpected error in api_baocao_doanhthu.")
        return jsonify({'status': 'error', 'message': str(e)}), 500


# --- Khởi động Ứng dụng ---
if __name__ == '__main__':
    # Kiểm tra kết nối CSDL trước khi chạy Flask
    logger.info("Starting database connection test...")
    try:
        test_connection()
        logger.info("Database connection is successful. Starting Flask server...")
    except Exception as e:
        logger.critical("FATAL: Database connection failed. Cannot start application.")
        # Nếu test thất bại, thoát ứng dụng
        # raise SystemExit(e) # Dùng SystemExit nếu muốn thoát ngay lập tức
        
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    
    # Chạy SocketIO với Flask instance
    socketio.run(app, host=host, port=port, debug=True, use_reloader=False)