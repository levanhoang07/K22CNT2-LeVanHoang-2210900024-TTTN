
import os
from flask import Blueprint, Flask, redirect, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import pyodbc
import logging
from datetime import datetime, timedelta
from functools import wraps
from decimal import Decimal
from flask import render_template
from flask import Blueprint, request, jsonify
import requests


tax_api = Blueprint('tax_api', __name__)

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════
app = Flask(__name__)
app.config['SECRET_KEY'] = 'mycay_secret_key_2024'
CORS(app, resources={r"/api/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('mycay_oder.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Database Configuration - THAY ĐỔI CHO PHÙNG HỢP
DB_CONFIG = {
    'server': 'localhost',
    'database': 'MyCay_Oder',
    'driver': '{ODBC Driver 17 for SQL Server}',
    'trusted_connection': 'yes'
}

# ==============================
# 🎯 DANH SÁCH DRIVER ƯU TIÊN
# ==============================
_PREFERRED_DRIVERS = [
    "ODBC Driver 18 for SQL Server",
    "ODBC Driver 17 for SQL Server",
    "ODBC Driver 13 for SQL Server",
    "SQL Server Native Client 11.0",
    "SQL Server"
]

def _find_driver():
    """Tìm driver SQL Server phù hợp nhất."""
    env_driver = os.getenv("MSSQL_DRIVER", "").strip()
    available = pyodbc.drivers()

    if env_driver and env_driver.strip("{}") in available:
        logger.info(f"Using MSSQL_DRIVER from environment: {env_driver}")
        return env_driver.strip("{}")

    for d in _PREFERRED_DRIVERS:
        if d in available:
            logger.info(f"Selected ODBC driver: {d}")
            return d

    logger.error(f"No SQL Server ODBC driver found! Installed drivers: {available}")
    return None

SELECTED_DRIVER = _find_driver()
DRV_STR = f"{{{SELECTED_DRIVER}}}" if SELECTED_DRIVER else ""
# ═══════════════════════════════════════════════════════════════════════════════  
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════
def build_time_filter(type_):
    """
    Trả về (where_sql, params)
    """
    if type_ == 'week':
        return (
            """
            AND ls.ThoiGian >= DATEADD(
                DAY,
                1 - DATEPART(WEEKDAY, GETDATE()),
                CAST(GETDATE() AS DATE)
            )
            """,
            []
        )

    if type_ == 'month':
        return (
            """
            AND MONTH(ls.ThoiGian) = MONTH(GETDATE())
            AND YEAR(ls.ThoiGian) = YEAR(GETDATE())
            """,
            []
        )

    # Mặc định: day (hôm nay)
    return (
        "AND CAST(ls.ThoiGian AS DATE) = CAST(GETDATE() AS DATE)",
        []
    )

# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def get_connection():
    try:
        server = os.getenv("MSSQL_SERVER", r"localhost\SQLEXPRESS")
        database = os.getenv("MSSQL_DATABASE", "MyCay_Oder")

        # BẮT BUỘC dùng SQL Authentication
        uid = os.getenv("MSSQL_UID", "flaskuser")
        pwd = os.getenv("MSSQL_PWD", "Flask@123")

        timeout = int(os.getenv("MSSQL_TIMEOUT", "10"))
        autocommit = os.getenv("MSSQL_AUTOCOMMIT", "false").lower() in ("1", "true", "yes")

        conn_str = (
            f"DRIVER={DRV_STR};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"UID={uid};"
            f"PWD={pwd};"
            f"TrustServerCertificate=yes;"
        )

        return pyodbc.connect(
            conn_str,
            timeout=timeout,
            autocommit=autocommit
        )

    except Exception as e:
        logger.exception("❌ Lỗi kết nối database")
        raise


@app.route("/api/testdb")
def testdb():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM Ban")
        n = cur.fetchone()[0]
        conn.close()
        return {"ok": True, "count": n}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def get_cursor():
    conn = get_connection()
    return conn.cursor(), conn

def test_connection():
    try:
        cursor, conn = get_cursor()
        cursor.execute("SELECT @@VERSION")
        version = cursor.fetchone()
        conn.close()
        logger.info("✅ Kết nối database thành công")
        return True
    except Exception as e:
        logger.error(f"❌ Lỗi test connection: {str(e)}")
        return False

def jsonify_response(success=True, message="", data=None, status_code=200):
    return jsonify({
        "success": success,
        "message": message,
        "data": data,
        "timestamp": datetime.now().isoformat()
    }), status_code

def row_to_dict(cursor, row):
    if row is None:
        return None
    columns = [column[0] for column in cursor.description]
    result = {}
    for i, value in enumerate(row):
        if isinstance(value, Decimal):
            result[columns[i]] = float(value)
        elif isinstance(value, datetime):
            result[columns[i]] = value.isoformat()
        else:
            result[columns[i]] = value
    return result

def rows_to_dict_list(cursor, rows):
    return [row_to_dict(cursor, row) for row in rows]

def handle_exception(e, context=""):
    error_msg = f"{context}: {str(e)}"
    logger.error(f"❌ {error_msg}")
    return jsonify_response(False, error_msg, None, 500)


@app.route("/qr")
def qr_redirect():
    ban = request.args.get("ban", "")

    if request.headers.get("User-Agent") and "Mobile" in request.headers.get("User-Agent"):
        TARGET = "https://unglamorous-lahoma-insolvable.ngrok-free.dev"
    else:
        TARGET = "http://localhost:5000"

    return redirect(f"{TARGET}/?ban={ban}", code=302)

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

@app.route("/bep")
def bep_page():
    return render_template("bep.html")

@app.route("/login")
def login_page():
    return render_template("login.html")


from flask_socketio import join_room

@socketio.on('join_room_ban')
def handle_join_room_ban(data):
    id_ban = data.get('id_ban')
    if id_ban:
        room = f"ban_{id_ban}"
        join_room(room)
        print(f"✅ Client joined {room}")

# ════════════════════════════════════════════════════════════════════════════
# 👤 API KHÁCH HÀNG (QR)
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/ban/<int:id_ban>', methods=['GET'])
def get_ban_info(id_ban):
    try:
        cursor, conn = get_cursor()
        cursor.execute("SELECT IDBan, TenBan, MaQR, TrangThai FROM Ban WHERE IDBan = ?", (id_ban,))
        ban = cursor.fetchone()
        conn.close()
        if not ban:
            return jsonify_response(False, "Bàn không tồn tại", None, 404)
        return jsonify_response(True, "Lấy thông tin bàn thành công", row_to_dict(cursor, ban))
    except Exception as e:
        return handle_exception(e, "Lỗi lấy thông tin bàn")

@app.route('/api/menu', methods=['GET'])
def get_menu():
    try:
        cursor, conn = get_cursor()
        cursor.execute("SELECT * FROM DanhMuc ORDER BY IDDanhMuc")
        danh_muc_list = rows_to_dict_list(cursor, cursor.fetchall())
        for dm in danh_muc_list:
            cursor.execute("""
                SELECT IDMon, TenMon, MoTa, Gia, HinhAnh, TrangThai
                FROM Menu WHERE IDDanhMuc = ? AND TrangThai = 1 ORDER BY TenMon
            """, (dm['IDDanhMuc'],))
            dm['mon_an'] = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy menu thành công", {'danh_muc': danh_muc_list})
    except Exception as e:
        return handle_exception(e, "Lỗi lấy menu")

@app.route('/api/order/add', methods=['POST'])
def add_order():
    try:
        data = request.get_json()
        id_ban = data.get('id_ban')
        id_mon = data.get('id_mon')
        so_luong = data.get('so_luong', 1)
        cap_do_cay = data.get('cap_do_cay', 'Không cay')
        ghi_chu = data.get('ghi_chu', '')
        
        if not id_ban or not id_mon:
            return jsonify_response(False, "Thiếu thông tin bàn hoặc món", None, 400)
        
        cursor, conn = get_cursor()
        cursor.execute("SELECT Gia FROM Menu WHERE IDMon = ? AND TrangThai = 1", (id_mon,))
        mon = cursor.fetchone()
        if not mon:
            conn.close()
            return jsonify_response(False, "Món không tồn tại", None, 404)
        
        don_gia = float(mon[0])
        cursor.execute("""
            SELECT IDDonHang FROM DonHang 
            WHERE IDBan = ? AND TrangThaiThanhToan = 0 ORDER BY NgayTao DESC
        """, (id_ban,))
        
        don_hang = cursor.fetchone()
        
        if don_hang:
            id_don_hang = don_hang[0]
            cursor.execute("""
                SELECT IDChiTiet, SoLuong FROM ChiTietDonHang
                WHERE IDDonHang = ? AND IDMon = ? AND CapDoCay = ? AND GhiChu = ?
            """, (id_don_hang, id_mon, cap_do_cay, ghi_chu))
            chi_tiet = cursor.fetchone()
            
            if chi_tiet:
                new_so_luong = chi_tiet[1] + so_luong
                cursor.execute("UPDATE ChiTietDonHang SET SoLuong = ? WHERE IDChiTiet = ?", 
                             (new_so_luong, chi_tiet[0]))
            else:
                cursor.execute("""
                    INSERT INTO ChiTietDonHang (IDDonHang, IDMon, SoLuong, DonGia, CapDoCay, GhiChu)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (id_don_hang, id_mon, so_luong, don_gia, cap_do_cay, ghi_chu))
        else:
            cursor.execute("""
                INSERT INTO DonHang (IDBan, TongTien, TrangThaiThanhToan)
                OUTPUT INSERTED.IDDonHang VALUES (?, 0, 0)
            """, (id_ban,))
            id_don_hang = cursor.fetchone()[0]
            cursor.execute("""
                INSERT INTO ChiTietDonHang (IDDonHang, IDMon, SoLuong, DonGia, CapDoCay, GhiChu)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (id_don_hang, id_mon, so_luong, don_gia, cap_do_cay, ghi_chu))
            cursor.execute("UPDATE Ban SET TrangThai = N'Đang dùng' WHERE IDBan = ?", (id_ban,))
        
        conn.commit()
        cursor.execute("SELECT TongTien FROM DonHang WHERE IDDonHang = ?", (id_don_hang,))
        tong_tien = float(cursor.fetchone()[0])
        conn.close()
        
        socketio.emit('new_order', {'id_don_hang': id_don_hang, 'id_ban': id_ban, 'tong_tien': tong_tien}, namespace='/')
        return jsonify_response(True, "Thêm món thành công", {'id_don_hang': id_don_hang, 'tong_tien': tong_tien})
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi thêm món")

@app.route('/api/ban/<int:id_ban>/donhang', methods=['GET'])
def get_donhang_cua_ban(id_ban):
    try:
        cursor, conn = get_cursor()

        # 1️⃣ LẤY ĐƠN HÀNG CHƯA THANH TOÁN
        cursor.execute("""
            SELECT d.IDDonHang, d.IDBan, d.TongTien, d.GhiChu, d.NgayTao,
                   d.TrangThai, b.TenBan
            FROM DonHang d
            JOIN Ban b ON d.IDBan = b.IDBan
            WHERE d.IDBan = ?
              AND d.TrangThaiThanhToan = 0
            ORDER BY d.NgayTao DESC
        """, (id_ban,))
        don_hang = cursor.fetchone()

        if not don_hang:
            conn.close()
            return jsonify_response(True, "Bàn chưa có đơn hàng", None)

        don_hang_dict = row_to_dict(cursor, don_hang)
        id_don_hang = don_hang_dict['IDDonHang']

        # 2️⃣ CHI TIẾT MÓN
        cursor.execute("""
            SELECT ct.IDChiTiet, ct.IDMon, m.TenMon, m.HinhAnh,
                   ct.SoLuong, ct.DonGia, ct.ThanhTien,
                   ct.CapDoCay, ct.GhiChu
            FROM ChiTietDonHang ct
            JOIN Menu m ON ct.IDMon = m.IDMon
            WHERE ct.IDDonHang = ?
            ORDER BY ct.IDChiTiet
        """, (id_don_hang,))
        don_hang_dict['chi_tiet'] = rows_to_dict_list(cursor, cursor.fetchall())

        # 3️⃣ 🔥 LỊCH SỬ TRẠNG THÁI (CHAT SYSTEM)
        cursor.execute("""
            SELECT TrangThai, ThoiGian
            FROM LichSuTrangThaiDonHang
            WHERE IDDonHang = ?
            ORDER BY ThoiGian ASC
        """, (id_don_hang,))
        don_hang_dict['lich_su'] = rows_to_dict_list(cursor, cursor.fetchall())

        conn.close()
        return jsonify_response(True, "Lấy đơn hàng thành công", don_hang_dict)

    except Exception as e:
        return handle_exception(e, "Lỗi lấy đơn hàng")


@app.route('/api/ban/donhang/<int:id_don_hang>', methods=['GET'])
def get_chi_tiet_don_hang(id_don_hang):
    try:
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT d.IDDonHang, d.IDBan, d.TongTien, d.GhiChu, d.NgayTao, 
                   d.TrangThaiThanhToan, b.TenBan
            FROM DonHang d JOIN Ban b ON d.IDBan = b.IDBan WHERE d.IDDonHang = ?
        """, (id_don_hang,))
        don_hang = cursor.fetchone()
        if not don_hang:
            conn.close()
            return jsonify_response(False, "Đơn hàng không tồn tại", None, 404)
        
        don_hang_dict = row_to_dict(cursor, don_hang)
        cursor.execute("""
            SELECT ct.IDChiTiet, ct.IDMon, m.TenMon, m.HinhAnh,
                   ct.SoLuong, ct.DonGia, ct.ThanhTien, ct.CapDoCay, ct.GhiChu
            FROM ChiTietDonHang ct JOIN Menu m ON ct.IDMon = m.IDMon WHERE ct.IDDonHang = ?
        """, (id_don_hang,))
        don_hang_dict['chi_tiet'] = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy chi tiết đơn hàng thành công", don_hang_dict)
    except Exception as e:
        return handle_exception(e, "Lỗi lấy chi tiết đơn hàng")

@app.route('/api/ban/<int:id_ban>/call', methods=['POST'])
def goi_nhan_vien(id_ban):
    try:
        data = request.get_json()
        noi_dung = data.get('noi_dung', 'Khách hàng cần hỗ trợ')
        cursor, conn = get_cursor()
        cursor.execute("SELECT TenBan FROM Ban WHERE IDBan = ?", (id_ban,))
        ban = cursor.fetchone()
        if not ban:
            conn.close()
            return jsonify_response(False, "Bàn không tồn tại", None, 404)
        
        ten_ban = ban[0]
        cursor.execute("""
            INSERT INTO ThongBao (IDBan, NoiDung, TrangThai)
            OUTPUT INSERTED.IDThongBao VALUES (?, ?, 0)
        """, (id_ban, f"{ten_ban}: {noi_dung}"))
        id_thong_bao = cursor.fetchone()[0]
        conn.commit()
        conn.close()
        
        socketio.emit('call_staff', {
            'id_thong_bao': id_thong_bao, 'id_ban': id_ban, 'ten_ban': ten_ban,
            'noi_dung': noi_dung, 'thoi_gian': datetime.now().isoformat()
        }, namespace='/')
        return jsonify_response(True, "Đã gọi nhân viên", {'id_thong_bao': id_thong_bao})
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi gọi nhân viên")
    
# đánh giá
@app.route('/api/danhgia', methods=['POST'])
def gui_danh_gia():
    conn = None
    try:
        data = request.get_json(force=True)

        id_ban = data.get('id_ban')
        noi_dung = data.get('noi_dung')
        ten_khach = data.get('ten_khach')

        if not noi_dung or not noi_dung.strip():
            return jsonify_response(
                False,
                "Nội dung đánh giá không được để trống",
                None,
                400
            )

        cursor, conn = get_cursor()
        cursor.execute("""
            INSERT INTO DanhGia (IDBan, TenKhachHang, NoiDung, TrangThai)
            OUTPUT INSERTED.IDDanhGia
            VALUES (?, ?, ?, 1)
        """, (id_ban, ten_khach, noi_dung))

        id_danh_gia = cursor.fetchone()[0]
        conn.commit()

        return jsonify_response(
            True,
            "Cảm ơn bạn đã đánh giá!",
            {"id_danh_gia": id_danh_gia}
        )

    except Exception as e:
        if conn:
            conn.rollback()
        return handle_exception(e, "Lỗi gửi đánh giá")
    finally:
        if conn:
            conn.close()

@app.route('/api/danhgia', methods=['GET'])
def lay_danh_gia():
    conn = None
    try:
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT 
                dg.IDDanhGia,
                dg.TenKhachHang,
                dg.NoiDung,
                dg.NgayDanhGia,
                b.TenBan
            FROM DanhGia dg
            LEFT JOIN Ban b ON dg.IDBan = b.IDBan
            WHERE dg.TrangThai = 1
            ORDER BY dg.NgayDanhGia DESC
        """)

        danh_gia_list = rows_to_dict_list(cursor, cursor.fetchall())

        return jsonify_response(
            True,
            "Lấy danh sách đánh giá thành công",
            {"danh_gia": danh_gia_list}
        )

    except Exception as e:
        return handle_exception(e, "Lỗi lấy danh sách đánh giá")
    finally:
        if conn:
            conn.close()


from flask import request, jsonify
import requests
@app.route('/api/tra-cuu-mst')
def tra_cuu_mst():
    mst = request.args.get('mst', '').strip()

    if not mst:
        logger.warning("❌ Yêu cầu tra cứu MST nhưng MST trống")
        return jsonify(success=False, message="Thiếu MST")

    logger.info(f"🔍 Tra cứu MST: {mst}")

    try:
        # 🔗 Sử dụng API VietQR chính thức
        url = f"https://api.vietqr.io/v2/business/{mst}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

        logger.info(f"📡 Gọi API: {url}")
        res = requests.get(url, headers=headers, timeout=10)

        # ❗ Kiểm tra status code
        if res.status_code != 200:
            logger.error(f"❌ VietQR trả về status {res.status_code}: {res.text}")
            return jsonify(
                success=False,
                message=f"VietQR lỗi ({res.status_code}): {res.text[:100]}"
            )

        # ✅ Parse JSON response
        data = res.json()
        logger.info(f"📦 Response từ VietQR: {data}")

        # ❗ Kiểm tra code trong response
        if data.get("code") != "00":
            error_msg = data.get("message", "Không tìm thấy MST")
            logger.warning(f"❌ VietQR trả về code {data.get('code')}: {error_msg}")
            return jsonify(
                success=False,
                message=f"MST không hợp lệ hoặc không tồn tại: {error_msg}"
            )

        # ✅ Trích xuất dữ liệu
        try:
            business_data = data.get("data", {})
            ten_cong_ty = business_data.get("name", "Không xác định")
            dia_chi = business_data.get("address", "Không xác định")
            
            logger.info(f"✅ Tìm thấy: {ten_cong_ty}")
            return jsonify(success=True, data={
                "ten_cong_ty": ten_cong_ty,
                "dia_chi": dia_chi,
                "mst": mst
            })
        except KeyError as ke:
            logger.error(f"❌ Lỗi parse dữ liệu từ response: {ke}")
            logger.error(f"📦 Full response: {data}")
            return jsonify(
                success=False,
                message=f"API trả về dữ liệu không đúng format"
            )

    except requests.exceptions.Timeout:
        logger.error("❌ Timeout khi gọi VietQR (>10s)")
        return jsonify(success=False, message="Timeout: VietQR không phản hồi")
    
    except requests.exceptions.ConnectionError as e:
        logger.error(f"❌ Lỗi kết nối: {str(e)}")
        return jsonify(success=False, message="Lỗi kết nối: Không thể kết nối đến VietQR")
    
    except Exception as e:
        logger.exception(f"❌ Lỗi tra cứu MST: {str(e)}")
        return jsonify(success=False, message=f"Lỗi: {str(e)}")

# ═══════════════════════════════════════════════════════════════════════════════
# 💼 API THU NGÂN
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/thungan/donhang', methods=['GET'])
def thu_ngan_lay_don_hang():
    try:
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT d.IDDonHang, d.IDBan, d.TongTien, d.NgayTao, b.TenBan,
                   COUNT(ct.IDChiTiet) as SoMon
            FROM DonHang d JOIN Ban b ON d.IDBan = b.IDBan
            LEFT JOIN ChiTietDonHang ct ON d.IDDonHang = ct.IDDonHang
            WHERE d.TrangThaiThanhToan = 0
            GROUP BY d.IDDonHang, d.IDBan, d.TongTien, d.NgayTao, b.TenBan
            ORDER BY d.NgayTao DESC
        """)
        don_hang_list = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy danh sách đơn hàng thành công", {'don_hang': don_hang_list})
    except Exception as e:
        return handle_exception(e, "Lỗi lấy danh sách đơn hàng")

@app.route('/api/thungan/donhang/<int:id_don_hang>/xacnhan', methods=['PUT'])
def xac_nhan_don_gui_bep(id_don_hang):
    conn = None
    try:
        cursor, conn = get_cursor()

        cursor.execute("""
            SELECT d.IDDonHang, d.IDBan, d.TongTien, d.TrangThai, b.TenBan
            FROM DonHang d
            JOIN Ban b ON d.IDBan = b.IDBan
            WHERE d.IDDonHang = ?
              AND d.TrangThaiThanhToan = 0
        """, (id_don_hang,))
        row = cursor.fetchone()

        if not row:
            return jsonify_response(
                False,
                "Đơn hàng không tồn tại hoặc đã thanh toán",
                None,
                404
            )

        don = row_to_dict(cursor, row)

        # ✅ dùng enum hợp lệ
        NEW_STATUS = "DANG_NAU"

        if don["TrangThai"] != NEW_STATUS:

            cursor.execute("""
                UPDATE DonHang
                SET TrangThai = ?
                WHERE IDDonHang = ?
            """, (NEW_STATUS, id_don_hang))

            cursor.execute("""
                INSERT INTO LichSuTrangThaiDonHang (IDDonHang, TrangThai)
                VALUES (?, ?)
            """, (id_don_hang, NEW_STATUS))

            conn.commit()

            # gửi bếp
            socketio.emit(
                "send_to_kitchen",
                {
                    "id_don_hang": id_don_hang,
                    "id_ban": don["IDBan"],
                    "ten_ban": don["TenBan"],
                    "tong_tien": don["TongTien"]
                },
                namespace='/'
            )

            # gửi khách
            socketio.emit(
                "order_status_update",
                {
                    "order_id": id_don_hang,
                    "id_ban": don["IDBan"],
                    "trang_thai": NEW_STATUS
                },
                room=f"ban_{don['IDBan']}",
                namespace='/'
            )

        return jsonify_response(True, "Đã xác nhận đơn hàng và gửi bếp")

    except Exception as e:
        if conn:
            conn.rollback()
        return handle_exception(e, "Lỗi xác nhận đơn hàng")
    finally:
        if conn:
            conn.close()

@app.route('/api/thungan/thanhtoan/<int:id_don_hang>', methods=['POST'])
def thanh_toan_don_hang(id_don_hang):
    try:
        data = request.get_json()
        id_phuong_thuc = data.get('id_phuong_thuc', 1)
        so_tien_nhan = data.get('so_tien_nhan', 0)
        so_dien_thoai = data.get('so_dien_thoai')
        id_khuyen_mai = data.get('id_khuyen_mai')
        
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT d.IDDonHang, d.IDBan, d.TongTien, d.TrangThaiThanhToan, b.TenBan
            FROM DonHang d JOIN Ban b ON d.IDBan = b.IDBan WHERE d.IDDonHang = ?
        """, (id_don_hang,))
        don_hang = cursor.fetchone()
        
        if not don_hang:
            conn.close()
            return jsonify_response(False, "Đơn hàng không tồn tại", None, 404)
        if don_hang[3] == 1:
            conn.close()
            return jsonify_response(False, "Đơn hàng đã được thanh toán", None, 400)
        
        tong_tien = float(don_hang[2])
        id_ban = don_hang[1]
        so_tien_giam = 0
        
                # ================== ÁP DỤNG KHUYẾN MÃI ==================
        so_tien_giam = 0

        if id_khuyen_mai:
            cursor.execute("""
                SELECT LoaiGiamGia, GiaTri
                FROM KhuyenMai
                WHERE IDKhuyenMai = ?
                AND TrangThai = 1
            """, (id_khuyen_mai,))

            khuyen_mai = cursor.fetchone()

            if not khuyen_mai:
                conn.rollback()
                conn.close()
                return jsonify_response(
                    False,
                    "Khuyến mãi không tồn tại hoặc đã bị tắt",
                    None,
                    400
                )

            loai_giam, gia_tri = khuyen_mai
            gia_tri = float(gia_tri)

            if loai_giam == 'PhanTram':
                so_tien_giam = tong_tien * (gia_tri / 100)
            elif loai_giam == 'SoTien':
                so_tien_giam = gia_tri

            # ❗ Không cho giảm vượt tổng tiền
            so_tien_giam = min(so_tien_giam, tong_tien)

            # Lưu lịch sử áp dụng khuyến mãi
            cursor.execute("""
                INSERT INTO DonHang_KhuyenMai (IDDonHang, IDKhuyenMai, SoTienGiam)
                VALUES (?, ?, ?)
            """, (id_don_hang, id_khuyen_mai, so_tien_giam))

        
        so_tien_thanh_toan = tong_tien - so_tien_giam
        tien_thua = 0
        if id_phuong_thuc == 1 and so_tien_nhan > 0:
            tien_thua = so_tien_nhan - so_tien_thanh_toan
        
        # Lưu thanh toán
        cursor.execute("""
            INSERT INTO ThanhToan (IDDonHang, IDPhuongThuc, SoTien)
            VALUES (?, ?, ?)
        """, (id_don_hang, id_phuong_thuc, so_tien_thanh_toan))
        cursor.execute("UPDATE DonHang SET TrangThaiThanhToan = 1 WHERE IDDonHang = ?", (id_don_hang,))
        cursor.execute("UPDATE Ban SET TrangThai = N'Trống' WHERE IDBan = ?", (id_ban,))
        cursor.execute("UPDATE DonHang SET TrangThaiThanhToan = 1 WHERE IDDonHang = ?", (id_don_hang,))

        
        # Tích điểm
        id_khach_hang = None
        diem_tich_luy = 0
        if so_dien_thoai:
            cursor.execute("SELECT IDKhachHang FROM KhachHang WHERE SoDienThoai = ?", (so_dien_thoai,))
            khach_hang = cursor.fetchone()
            if khach_hang:
                id_khach_hang = khach_hang[0]
            else:
                cursor.execute("""
                    INSERT INTO KhachHang (SoDienThoai, DiemTichLuy)
                    OUTPUT INSERTED.IDKhachHang VALUES (?, 0)
                """, (so_dien_thoai,))
                id_khach_hang = cursor.fetchone()[0]
            
            diem_tich_luy = int(so_tien_thanh_toan / 1000)
            cursor.execute("""
                UPDATE KhachHang SET DiemTichLuy = DiemTichLuy + ? WHERE IDKhachHang = ?
            """, (diem_tich_luy, id_khach_hang))
            cursor.execute("""
                INSERT INTO LichSuTichDiem (IDKhachHang, IDDonHang, SoDiem)
                VALUES (?, ?, ?)
            """, (id_khach_hang, id_don_hang, diem_tich_luy))
        
        conn.commit()
        conn.close()
        socketio.emit('order_paid', {
            'id_don_hang': id_don_hang, 'id_ban': id_ban,
            'tong_tien': tong_tien, 'so_tien_giam': so_tien_giam,
            'so_tien_thanh_toan': so_tien_thanh_toan
        }, namespace='/')
        
        return jsonify_response(True, "Thanh toán thành công", {
            'id_don_hang': id_don_hang, 'tong_tien': tong_tien,
            'so_tien_giam': so_tien_giam, 'so_tien_thanh_toan': so_tien_thanh_toan,
            'tien_thua': tien_thua, 'diem_tich_luy': diem_tich_luy
        })
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi thanh toán")
    
# ═════════════════════════════════════════════
# 💳 THU NGÂN - LẤY KHUYẾN MÃI ĐANG ÁP DỤNG
# ═════════════════════════════════════════════
@app.route('/api/thungan/khuyenmai', methods=['GET'])
def thungan_lay_khuyen_mai():
    try:
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT IDKhuyenMai, TenKhuyenMai, LoaiGiamGia, GiaTri
            FROM KhuyenMai
            WHERE TrangThai = 1
            ORDER BY IDKhuyenMai DESC
        """)
        km_list = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()

        return jsonify_response(
            True,
            "Danh sách khuyến mãi đang áp dụng",
            {'khuyen_mai': km_list}
        )
    except Exception as e:
        return handle_exception(e, "Lỗi lấy khuyến mãi thu ngân")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔥 API BẾP 
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/bep/donhang', methods=['GET'])
def bep_lay_don_hang():
    """
    Lấy danh sách đơn hàng cho bếp
    ✅ CHỈ LẤY ĐƠN CHƯA THANH TOÁN (TrangThaiThanhToan = 0)
    - Mỗi món có trạng thái riêng: CHỜ / Đang nấu / Hoàn thành
    """
    try:
        cursor, conn = get_cursor()

        cursor.execute("""
            SELECT 
                d.IDDonHang,
                d.IDBan,
                d.TongTien,
                d.NgayTao,
                d.TrangThaiThanhToan,
                b.TenBan,
                ISNULL(ls.TrangThai, N'CHỜ') AS TrangThaiBep,
                ISNULL(ls.ThoiGian, d.NgayTao) AS ThoiGianCapNhat
            FROM DonHang d
            JOIN Ban b ON d.IDBan = b.IDBan
            OUTER APPLY (
                SELECT TOP 1 TrangThai, ThoiGian
                FROM LichSuTrangThaiDonHang
                WHERE IDDonHang = d.IDDonHang
                ORDER BY ThoiGian DESC
            ) ls
            WHERE d.TrangThaiThanhToan = 0
            ORDER BY 
                CASE WHEN ls.TrangThai = N'Hoàn thành' THEN 1 ELSE 0 END,
                d.NgayTao DESC
        """)

        rows = cursor.fetchall()
        don_hang_list = []

        for row in rows:
            try:
                don = row_to_dict(cursor, row)
            except Exception:
                continue

            # 🔥 LẤY CHI TIẾT MÓN VỚI TRẠNG THÁI TỪNG MÓN
            cursor.execute("""
                SELECT 
                    ct.IDChiTiet,
                    m.TenMon,
                    ct.SoLuong,
                    ct.CapDoCay,
                    ct.GhiChu,
                    ISNULL(ct.TrangThai, N'CHỜ') AS TrangThai
                FROM ChiTietDonHang ct
                JOIN Menu m ON ct.IDMon = m.IDMon
                WHERE ct.IDDonHang = ?
                ORDER BY ct.IDChiTiet ASC
            """, (don["IDDonHang"],))

            don["chi_tiet"] = rows_to_dict_list(cursor, cursor.fetchall())
            don_hang_list.append(don)

        conn.close()
        return jsonify_response(True, "Danh sách đơn bếp", {
            "don_hang": don_hang_list
        })

    except Exception as e:
        logger.exception("❌ Lỗi lấy đơn hàng bếp")
        return jsonify_response(False, "Lỗi lấy đơn hàng bếp", None, 500)


@app.route('/api/bep/donhang/lichsu', methods=['GET'])
def bep_lay_lich_su_hoan_thanh():
    """
    Lấy lịch sử đơn đã hoàn thành
    ✅ CHỈ LẤY ĐƠN ĐÃ HOÀN THÀNH VÀ ĐÃ THANH TOÁN
    """
    try:
        limit = request.args.get('limit', 50, type=int)
        type_ = request.args.get('type', 'day')

        cursor, conn = get_cursor()
        time_where, params = build_time_filter(type_)

        query = f"""
            SELECT 
                d.IDDonHang,
                d.IDBan,
                d.TongTien,
                d.NgayTao,
                d.TrangThaiThanhToan,
                b.TenBan,
                ls.TrangThai,
                ls.ThoiGian
            FROM DonHang d
            JOIN Ban b ON d.IDBan = b.IDBan
            LEFT JOIN (
                SELECT IDDonHang, TrangThai, ThoiGian
                FROM (
                    SELECT *,
                        ROW_NUMBER() OVER (PARTITION BY IDDonHang ORDER BY ThoiGian DESC) rn
                    FROM LichSuTrangThaiDonHang
                ) x WHERE rn = 1
            ) ls ON ls.IDDonHang = d.IDDonHang
            WHERE ls.TrangThai = N'Hoàn thành'
            AND d.TrangThaiThanhToan = 1
            {time_where}
            ORDER BY ls.ThoiGian DESC
            OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY
        """

        params.append(limit)
        cursor.execute(query, tuple(params))

        don_hang_list = []

        for row in cursor.fetchall():
            don = {
                "IDDonHang": row[0],
                "IDBan": row[1],
                "TongTien": row[2],
                "NgayTao": row[3],
                "TrangThaiThanhToan": row[4],
                "TenBan": row[5],
                "TrangThaiBep": row[6] or "Hoàn thành",
                "ThoiGianHoanThanh": row[7] or row[3],
            }

            # Lấy chi tiết món với trạng thái
            cursor.execute("""
                SELECT 
                    ct.IDChiTiet,
                    m.TenMon,
                    ct.SoLuong,
                    ct.CapDoCay,
                    ct.GhiChu,
                    ISNULL(ct.TrangThai, N'Hoàn thành') AS TrangThai
                FROM ChiTietDonHang ct
                JOIN Menu m ON ct.IDMon = m.IDMon
                WHERE ct.IDDonHang = ?
            """, (don["IDDonHang"],))

            don["chi_tiet"] = rows_to_dict_list(cursor, cursor.fetchall())
            don_hang_list.append(don)

        conn.close()

        return jsonify_response(True, "Lịch sử đơn hoàn thành", {
            "don_hang": don_hang_list,
            "total": len(don_hang_list),
            "type": type_
        })

    except Exception as e:
        logger.exception("❌ Lỗi lấy lịch sử bếp")
        return jsonify_response(False, "Lỗi lấy lịch sử bếp", None, 500)
@app.route('/api/bep/chitiet/<int:id_chi_tiet>/trangthai', methods=['PUT'])
def cap_nhat_trang_thai_mon(id_chi_tiet):

    conn = None

    try:
        data = request.get_json(silent=True) or {}
        trang_thai = data.get("trang_thai", "").strip().upper()

        VALID_STATUS = {"DANG_NAU", "HOAN_THANH"}

        if trang_thai not in VALID_STATUS:
            return jsonify_response(False, "Trạng thái không hợp lệ", None, 400)

        cursor, conn = get_cursor()

        cursor.execute("""
            SELECT ct.IDDonHang, m.TenMon, d.IDBan, b.TenBan
            FROM ChiTietDonHang ct
            JOIN Menu m ON ct.IDMon = m.IDMon
            JOIN DonHang d ON ct.IDDonHang = d.IDDonHang
            JOIN Ban b ON d.IDBan = b.IDBan
            WHERE ct.IDChiTiet = ?
        """, (id_chi_tiet,))

        row = cursor.fetchone()

        if not row:
            return jsonify_response(False, "Món không tồn tại", None, 404)

        id_don_hang, ten_mon, id_ban, ten_ban = row

        # update món
        cursor.execute("""
            UPDATE ChiTietDonHang
            SET TrangThai = ?
            WHERE IDChiTiet = ?
        """, (trang_thai, id_chi_tiet))

        # check hoàn thành
        cursor.execute("""
            SELECT 
                COUNT(*),
                SUM(CASE WHEN TrangThai = 'HOAN_THANH' THEN 1 ELSE 0 END)
            FROM ChiTietDonHang
            WHERE IDDonHang = ?
        """, (id_don_hang,))

        tong, done = cursor.fetchone()
        done = done or 0

        if tong == done:
            cursor.execute("""
                UPDATE DonHang SET TrangThai='HOAN_THANH'
                WHERE IDDonHang=?
            """, (id_don_hang,))

            cursor.execute("""
                INSERT INTO LichSuTrangThaiDonHang(IDDonHang, TrangThai, ThoiGian)
                VALUES (?, 'HOAN_THANH', GETDATE())
            """, (id_don_hang,))

        conn.commit()

        socketio.emit("dish_status_update", {
            "id_chi_tiet": id_chi_tiet,
            "id_don_hang": id_don_hang,
            "id_ban": id_ban,
            "ten_mon": ten_mon,
            "trang_thai": trang_thai
        }, room=f"ban_{id_ban}")

        return jsonify_response(True, f"{ten_mon} → {trang_thai}")

    except Exception as e:
        if conn:
            conn.rollback()
        return handle_exception(e, "Lỗi cập nhật món")

    finally:
        if conn:
            conn.close()
@app.route('/api/bep/donhang/<int:id_don_hang>/trangthai', methods=['PUT'])
def cap_nhat_trang_thai_nau(id_don_hang):

    conn = None

    try:
        data = request.get_json(silent=True) or {}
        trang_thai = data.get("trang_thai", "").strip().upper()

        VALID = {"DANG_NAU", "HOAN_THANH"}

        TEXT = {
            "DANG_NAU": "Đang nấu",
            "HOAN_THANH": "Hoàn thành"
        }

        if trang_thai not in VALID:
            return jsonify_response(False, "Trạng thái không hợp lệ", None, 400)

        cursor, conn = get_cursor()

        cursor.execute("""
            SELECT IDBan FROM DonHang WHERE IDDonHang=?
        """, (id_don_hang,))

        row = cursor.fetchone()
        if not row:
            return jsonify_response(False, "Đơn không tồn tại", None, 404)

        id_ban = row[0]

        cursor.execute("UPDATE DonHang SET TrangThai=? WHERE IDDonHang=?", (trang_thai, id_don_hang))
        cursor.execute("UPDATE ChiTietDonHang SET TrangThai=? WHERE IDDonHang=?", (trang_thai, id_don_hang))

        cursor.execute("""
            INSERT INTO LichSuTrangThaiDonHang(IDDonHang, TrangThai, ThoiGian)
            VALUES (?, ?, GETDATE())
        """, (id_don_hang, trang_thai))

        conn.commit()

        payload = {
            "id_don_hang": id_don_hang,
            "id_ban": id_ban,
            "trang_thai": trang_thai,
            "trang_thai_text": TEXT[trang_thai]
        }

        socketio.emit("order_status_update", payload, room="bep")
        socketio.emit("order_status_update", payload, room=f"ban_{id_ban}")

        return jsonify_response(True, TEXT[trang_thai], payload)

    except Exception as e:
        if conn:
            conn.rollback()
        return handle_exception(e, "Lỗi cập nhật đơn")

    finally:
        if conn:
            conn.close()


@app.route('/api/bep/thongke', methods=['GET'])
def bep_thong_ke():
    """
    Thống kê bếp theo ngày/tuần/tháng
    """
    try:
        type_ = request.args.get('type', 'day')

        cursor, conn = get_cursor()

        time_where, params = build_time_filter(type_)

        # 1. Thống kê số đơn theo trạng thái
        cursor.execute(f"""
            SELECT 
                ISNULL(ls.TrangThai, N'CHỜ') AS TrangThai,
                COUNT(*) AS SoLuong
            FROM DonHang d
            OUTER APPLY (
                SELECT TOP 1 TrangThai, ThoiGian
                FROM LichSuTrangThaiDonHang
                WHERE IDDonHang = d.IDDonHang
                ORDER BY ThoiGian DESC
            ) ls
            WHERE 1=1 {time_where}
            GROUP BY ISNULL(ls.TrangThai, N'CHỜ')
        """, tuple(params))

        thong_ke = {row[0]: row[1] for row in cursor.fetchall()}

        # 2. Thời gian nấu trung bình
        cursor.execute(f"""
            SELECT 
                AVG(DATEDIFF(MINUTE, d.NgayTao, ls.ThoiGian)) AS ThoiGianTrungBinh
            FROM DonHang d
            OUTER APPLY (
                SELECT TOP 1 ThoiGian
                FROM LichSuTrangThaiDonHang
                WHERE IDDonHang = d.IDDonHang AND TrangThai = N'Hoàn thành'
                ORDER BY ThoiGian DESC
            ) ls
            WHERE ls.ThoiGian IS NOT NULL {time_where}
        """, tuple(params))

        avg_time = cursor.fetchone()
        thoi_gian_tb = round(avg_time[0], 1) if avg_time and avg_time[0] else 0

        conn.close()

        return jsonify_response(True, "Thống kê bếp", {
            "type": type_,
            "thong_ke": thong_ke,
            "thoi_gian_trung_binh": thoi_gian_tb
        })

    except Exception as e:
        return handle_exception(e, "Lỗi thống kê bếp")
# ═════════════════════════════════════════════════════════════
# 📦 ADMIN - ĐƠN HÀNG ĐÃ HOÀN THÀNH
# ═════════════════════════════════════════════════════════════
@app.route('/api/admin/donhang/hoanthanh', methods=['GET'])
def admin_lay_don_hoan_thanh():
    try:
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT 
                d.IDDonHang,
                b.TenBan,
                d.TongTien,
                d.NgayTao,
                COUNT(ct.IDChiTiet) AS SoMon
            FROM DonHang d
            JOIN Ban b ON d.IDBan = b.IDBan
            LEFT JOIN ChiTietDonHang ct ON d.IDDonHang = ct.IDDonHang
            WHERE d.TrangThaiThanhToan = 1
            GROUP BY d.IDDonHang, b.TenBan, d.TongTien, d.NgayTao
            ORDER BY d.NgayTao DESC
        """)
        rows = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Danh sách đơn đã thanh toán", {
            "don_hang": rows
        })
    except Exception as e:
        return handle_exception(e, "Lỗi lấy đơn đã thanh toán")
@app.route('/api/admin/donhang/<int:id_don_hang>/chitiet', methods=['GET'])
def admin_chi_tiet_don_hang(id_don_hang):
    try:
        cursor, conn = get_cursor()

        # 1. Lấy thông tin đơn hàng (CHỈ đơn đã thanh toán)
        cursor.execute("""
            SELECT 
                d.IDDonHang,
                b.TenBan,
                d.TongTien,
                d.NgayTao
            FROM DonHang d
            JOIN Ban b ON d.IDBan = b.IDBan
            WHERE d.IDDonHang = ?
              AND d.TrangThaiThanhToan = 1
        """, (id_don_hang,))
        don_hang = cursor.fetchone()

        if not don_hang:
            conn.close()
            return jsonify_response(False, "Đơn hàng không tồn tại hoặc chưa thanh toán", None, 404)

        don_hang_dict = row_to_dict(cursor, don_hang)

        # 2. Lấy chi tiết món
        cursor.execute("""
            SELECT 
                m.TenMon,
                ct.SoLuong,
                ct.DonGia,
                ct.ThanhTien,
                ct.CapDoCay,
                ct.GhiChu
            FROM ChiTietDonHang ct
            JOIN Menu m ON ct.IDMon = m.IDMon
            WHERE ct.IDDonHang = ?
        """, (id_don_hang,))

        chi_tiet = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()

        don_hang_dict["chi_tiet"] = chi_tiet

        return jsonify_response(True, "Chi tiết đơn hàng", don_hang_dict)

    except Exception as e:
        return handle_exception(e, "Lỗi lấy chi tiết đơn hàng")


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠 API ADMIN - CRUD BÀN (QR = URL ORDER)
# ═══════════════════════════════════════════════════════════════════════════════

BASE_ORDER_URL = "http://localhost:5000/?ban="

# ==============================
# GET ALL TABLES
# ==============================
@app.route('/api/admin/ban', methods=['GET'])
def admin_lay_ban():
    try:
        cursor, conn = get_cursor()
        cursor.execute("SELECT * FROM Ban ORDER BY IDBan")
        ban_list = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy danh sách bàn thành công", {'ban': ban_list})
    except Exception as e:
        return handle_exception(e, "Lỗi lấy danh sách bàn")


# ==============================
# CREATE TABLE (AUTO QR URL)
# ==============================
@app.route('/api/admin/ban', methods=['POST'])
def admin_them_ban():
    try:
        data = request.get_json()
        ten_ban = data.get('ten_ban')

        if not ten_ban:
            return jsonify_response(False, "Tên bàn không được để trống", None, 400)

        cursor, conn = get_cursor()

        # 1️⃣ Insert trước (chưa có QR)
        cursor.execute("""
            INSERT INTO Ban (TenBan, TrangThai)
            OUTPUT INSERTED.IDBan
            VALUES (?, N'Trống')
        """, (ten_ban,))
        id_ban = cursor.fetchone()[0]

        # 2️⃣ Tạo URL QR
        ma_qr = f"{BASE_ORDER_URL}{id_ban}"

        # 3️⃣ Update QR
        cursor.execute("""
            UPDATE Ban SET MaQR = ? WHERE IDBan = ?
        """, (ma_qr, id_ban))

        conn.commit()
        conn.close()

        return jsonify_response(True, "Thêm bàn thành công", {
            'id_ban': id_ban,
            'ma_qr': ma_qr
        })

    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi thêm bàn")


# ==============================
# UPDATE TABLE (KHÔNG SỬA QR)
# ==============================
@app.route('/api/admin/ban/<int:id_ban>', methods=['PUT'])
def admin_sua_ban(id_ban):
    try:
        data = request.get_json()
        ten_ban = data.get('ten_ban')
        trang_thai = data.get('trang_thai')

        if not ten_ban or not trang_thai:
            return jsonify_response(False, "Thiếu dữ liệu", None, 400)

        cursor, conn = get_cursor()
        cursor.execute("""
            UPDATE Ban 
            SET TenBan = ?, TrangThai = ?
            WHERE IDBan = ?
        """, (ten_ban, trang_thai, id_ban))

        conn.commit()
        conn.close()

        return jsonify_response(True, "Cập nhật bàn thành công")

    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi cập nhật bàn")


# ==============================
# DELETE TABLE
# ==============================
@app.route('/api/admin/ban/<int:id_ban>', methods=['DELETE'])
def admin_xoa_ban(id_ban):
    try:
        cursor, conn = get_cursor()
        cursor.execute("DELETE FROM Ban WHERE IDBan = ?", (id_ban,))
        conn.commit()
        conn.close()
        return jsonify_response(True, "Xóa bàn thành công")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi xóa bàn")


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠 API ADMIN - CRUD DANH MỤC
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/admin/danhmuc', methods=['GET'])
def admin_lay_danh_muc():
    try:
        cursor, conn = get_cursor()
        cursor.execute("SELECT * FROM DanhMuc ORDER BY IDDanhMuc")
        dm_list = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy danh sách danh mục thành công", {'danh_muc': dm_list})
    except Exception as e:
        return handle_exception(e, "Lỗi lấy danh sách danh mục")

@app.route('/api/admin/danhmuc', methods=['POST'])
def admin_them_danh_muc():
    try:
        data = request.get_json()
        ten_danh_muc = data.get('ten_danh_muc')
        if not ten_danh_muc:
            return jsonify_response(False, "Tên danh mục không được để trống", None, 400)
        
        cursor, conn = get_cursor()
        cursor.execute("""
            INSERT INTO DanhMuc (TenDanhMuc) OUTPUT INSERTED.IDDanhMuc VALUES (?)
        """, (ten_danh_muc,))
        id_danh_muc = cursor.fetchone()[0]
        conn.commit()
        conn.close()
        return jsonify_response(True, "Thêm danh mục thành công", {'id_danh_muc': id_danh_muc})
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi thêm danh mục")

@app.route('/api/admin/danhmuc/<int:id_danh_muc>', methods=['PUT'])
def admin_sua_danh_muc(id_danh_muc):
    try:
        data = request.get_json()
        ten_danh_muc = data.get('ten_danh_muc')
        cursor, conn = get_cursor()
        cursor.execute("UPDATE DanhMuc SET TenDanhMuc = ? WHERE IDDanhMuc = ?", 
                      (ten_danh_muc, id_danh_muc))
        conn.commit()
        conn.close()
        return jsonify_response(True, "Cập nhật danh mục thành công")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi cập nhật danh mục")

@app.route('/api/admin/danhmuc/<int:id_danh_muc>', methods=['DELETE'])
def admin_xoa_danh_muc(id_danh_muc):
    try:
        cursor, conn = get_cursor()
        cursor.execute("DELETE FROM DanhMuc WHERE IDDanhMuc = ?", (id_danh_muc,))
        conn.commit()
        conn.close()
        return jsonify_response(True, "Xóa danh mục thành công")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi xóa danh mục")
    
# ═══════════════════════════════════════════════════════════════════════════════
# 🛠 API ADMIN - CRUD MENU
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/admin/menu', methods=['GET'])
def admin_lay_menu():
    try:
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT m.*, dm.TenDanhMuc
            FROM Menu m JOIN DanhMuc dm ON m.IDDanhMuc = dm.IDDanhMuc
            ORDER BY m.IDMon DESC
        """)
        menu_list = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy danh sách menu thành công", {'menu': menu_list})
    except Exception as e:
        return handle_exception(e, "Lỗi lấy danh sách menu")

@app.route('/api/admin/menu', methods=['POST'])
def admin_them_mon():
    try:
        data = request.get_json()
        ten_mon = data.get('ten_mon')
        mo_ta = data.get('mo_ta', '')
        gia = data.get('gia')
        hinh_anh = data.get('hinh_anh', '')
        id_danh_muc = data.get('id_danh_muc')
        trang_thai = data.get('trang_thai', 1)
        
        if not ten_mon or not gia or not id_danh_muc:
            return jsonify_response(False, "Thiếu thông tin món ăn", None, 400)
        
        cursor, conn = get_cursor()
        cursor.execute("""
            INSERT INTO Menu (TenMon, MoTa, Gia, HinhAnh, IDDanhMuc, TrangThai)
            OUTPUT INSERTED.IDMon VALUES (?, ?, ?, ?, ?, ?)
        """, (ten_mon, mo_ta, gia, hinh_anh, id_danh_muc, trang_thai))
        id_mon = cursor.fetchone()[0]
        conn.commit()
        conn.close()
        return jsonify_response(True, "Thêm món thành công", {'id_mon': id_mon})
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi thêm món")

@app.route('/api/admin/menu/<int:id_mon>', methods=['PUT'])
def admin_sua_mon(id_mon):
    try:
        data = request.get_json()
        ten_mon = data.get('ten_mon')
        mo_ta = data.get('mo_ta')
        gia = data.get('gia')
        hinh_anh = data.get('hinh_anh')
        id_danh_muc = data.get('id_danh_muc')
        trang_thai = data.get('trang_thai')
        
        cursor, conn = get_cursor()
        cursor.execute("""
            UPDATE Menu SET TenMon = ?, MoTa = ?, Gia = ?, HinhAnh = ?, 
                   IDDanhMuc = ?, TrangThai = ? WHERE IDMon = ?
        """, (ten_mon, mo_ta, gia, hinh_anh, id_danh_muc, trang_thai, id_mon))
        conn.commit()
        conn.close()
        return jsonify_response(True, "Cập nhật món thành công")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi cập nhật món")

@app.route('/api/admin/menu/<int:id_mon>', methods=['DELETE'])
def admin_xoa_mon(id_mon):
    try:
        cursor, conn = get_cursor()
        cursor.execute("DELETE FROM Menu WHERE IDMon = ?", (id_mon,))
        conn.commit()
        conn.close()
        return jsonify_response(True, "Xóa món thành công")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi xóa món")

# ═══════════════════════════════════════════════════════════════════════════════
# 🛠 API ADMIN - CRUD KHUYẾN MÃI
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/admin/khuyenmai', methods=['GET'])
def admin_lay_khuyen_mai():
    try:
        cursor, conn = get_cursor()
        cursor.execute("SELECT * FROM KhuyenMai ORDER BY IDKhuyenMai DESC")
        km_list = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy danh sách khuyến mãi thành công", {'khuyen_mai': km_list})
    except Exception as e:
        return handle_exception(e, "Lỗi lấy danh sách khuyến mãi")

@app.route('/api/admin/khuyenmai', methods=['POST'])
def admin_them_khuyen_mai():
    try:
        data = request.get_json()
        ten_khuyen_mai = data.get('ten_khuyen_mai')
        loai_giam_gia = data.get('loai_giam_gia', 'PhanTram')
        gia_tri = data.get('gia_tri')
        trang_thai = data.get('trang_thai', 1)
        
        cursor, conn = get_cursor()
        cursor.execute("""
            INSERT INTO KhuyenMai (TenKhuyenMai, LoaiGiamGia, GiaTri, TrangThai)
            OUTPUT INSERTED.IDKhuyenMai VALUES (?, ?, ?, ?)
        """, (ten_khuyen_mai, loai_giam_gia, gia_tri, trang_thai))
        id_khuyen_mai = cursor.fetchone()[0]
        conn.commit()
        conn.close()
        return jsonify_response(True, "Thêm khuyến mãi thành công", {'id_khuyen_mai': id_khuyen_mai})
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi thêm khuyến mãi")

@app.route('/api/admin/khuyenmai/<int:id_khuyen_mai>', methods=['PUT'])
def admin_sua_khuyen_mai(id_khuyen_mai):
    try:
        data = request.get_json()
        ten_khuyen_mai = data.get('ten_khuyen_mai')
        loai_giam_gia = data.get('loai_giam_gia')
        gia_tri = data.get('gia_tri')
        trang_thai = data.get('trang_thai')
        
        cursor, conn = get_cursor()
        cursor.execute("""
            UPDATE KhuyenMai SET TenKhuyenMai = ?, LoaiGiamGia = ?, GiaTri = ?, TrangThai = ?
            WHERE IDKhuyenMai = ?
        """, (ten_khuyen_mai, loai_giam_gia, gia_tri, trang_thai, id_khuyen_mai))
        conn.commit()
        conn.close()
        return jsonify_response(True, "Cập nhật khuyến mãi thành công")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi cập nhật khuyến mãi")

@app.route('/api/admin/khuyenmai/<int:id_khuyen_mai>', methods=['DELETE'])
def admin_xoa_khuyen_mai(id_khuyen_mai):
    try:
        cursor, conn = get_cursor()
        cursor.execute("""
            UPDATE KhuyenMai
            SET TrangThai = 0
            WHERE IDKhuyenMai = ?
        """, (id_khuyen_mai,))
        conn.commit()
        conn.close()
        return jsonify_response(True, "Đã tắt khuyến mãi")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi tắt khuyến mãi")


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠 API ADMIN - CRUD NGƯỜI DÙNG
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/admin/nguoidung', methods=['GET'])
def admin_lay_nguoi_dung():
    try:
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT IDNguoiDung, TenDangNhap, HoTen, VaiTro, TrangThai, NgayTao
            FROM NguoiDung ORDER BY IDNguoiDung DESC
        """)
        user_list = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy danh sách người dùng thành công", {'nguoi_dung': user_list})
    except Exception as e:
        return handle_exception(e, "Lỗi lấy danh sách người dùng")

@app.route('/api/admin/nguoidung', methods=['POST'])
def admin_them_nguoi_dung():
    try:
        data = request.get_json()
        ten_dang_nhap = data.get('ten_dang_nhap')
        mat_khau = data.get('mat_khau')
        ho_ten = data.get('ho_ten')
        vai_tro = data.get('vai_tro')
        
        cursor, conn = get_cursor()
        cursor.execute("""
            INSERT INTO NguoiDung (TenDangNhap, MatKhau, HoTen, VaiTro, TrangThai)
            OUTPUT INSERTED.IDNguoiDung VALUES (?, ?, ?, ?, 1)
        """, (ten_dang_nhap, mat_khau, ho_ten, vai_tro))
        id_nguoi_dung = cursor.fetchone()[0]
        conn.commit()
        conn.close()
        return jsonify_response(True, "Thêm người dùng thành công", {'id_nguoi_dung': id_nguoi_dung})
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi thêm người dùng")

@app.route('/api/admin/nguoidung/<int:id_nguoi_dung>', methods=['PUT'])
def admin_sua_nguoi_dung(id_nguoi_dung):
    try:
        data = request.get_json()
        ten_dang_nhap = data.get('ten_dang_nhap')
        mat_khau = data.get('mat_khau')
        ho_ten = data.get('ho_ten')
        vai_tro = data.get('vai_tro')
        trang_thai = data.get('trang_thai')
        
        cursor, conn = get_cursor()
        if mat_khau:
            cursor.execute("""
                UPDATE NguoiDung SET TenDangNhap = ?, MatKhau = ?, HoTen = ?, 
                       VaiTro = ?, TrangThai = ? WHERE IDNguoiDung = ?
            """, (ten_dang_nhap, mat_khau, ho_ten, vai_tro, trang_thai, id_nguoi_dung))
        else:
            cursor.execute("""
                UPDATE NguoiDung SET TenDangNhap = ?, HoTen = ?, 
                       VaiTro = ?, TrangThai = ? WHERE IDNguoiDung = ?
            """, (ten_dang_nhap, ho_ten, vai_tro, trang_thai, id_nguoi_dung))
        conn.commit()
        conn.close()
        return jsonify_response(True, "Cập nhật người dùng thành công")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi cập nhật người dùng")

@app.route('/api/admin/nguoidung/<int:id_nguoi_dung>', methods=['DELETE'])
def admin_xoa_nguoi_dung(id_nguoi_dung):
    try:
        cursor, conn = get_cursor()
        cursor.execute("DELETE FROM NguoiDung WHERE IDNguoiDung = ?", (id_nguoi_dung,))
        conn.commit()
        conn.close()
        return jsonify_response(True, "Xóa người dùng thành công")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi xóa người dùng")

# ═══════════════════════════════════════════════════════════════════════════════
# 🛠 API ADMIN - BÁO CÁO & THỐNG KÊ
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/admin/baocao/doanhthu', methods=['GET'])
def bao_cao_doanh_thu():
    try:
        tu_ngay = request.args.get('tu_ngay')
        den_ngay = request.args.get('den_ngay')
        
        if not tu_ngay or not den_ngay:
            den_ngay = datetime.now().date()
            tu_ngay = den_ngay - timedelta(days=30)
        
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT 
                CONVERT(DATE, NgayTao) as Ngay,
                COUNT(DISTINCT IDDonHang) as SoDonHang,
                SUM(TongTien) as DoanhThu
            FROM DonHang
            WHERE TrangThaiThanhToan = 1
              AND CONVERT(DATE, NgayTao) BETWEEN ? AND ?
            GROUP BY CONVERT(DATE, NgayTao)
            ORDER BY Ngay DESC
        """, (tu_ngay, den_ngay))
        
        doanh_thu_list = rows_to_dict_list(cursor, cursor.fetchall())
        tong_doanh_thu = sum(item['DoanhThu'] for item in doanh_thu_list)
        tong_don_hang = sum(item['SoDonHang'] for item in doanh_thu_list)
        conn.close()
        
        return jsonify_response(True, "Lấy báo cáo doanh thu thành công", {
            'chi_tiet': doanh_thu_list,
            'tong_doanh_thu': tong_doanh_thu,
            'tong_don_hang': tong_don_hang
        })
    except Exception as e:
        return handle_exception(e, "Lỗi báo cáo doanh thu")

@app.route('/api/admin/baocao/topmon', methods=['GET'])
def top_mon_ban_chay():
    try:
        limit = request.args.get('limit', 10)
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT TOP (?)
                m.IDMon, m.TenMon, m.HinhAnh,
                SUM(ct.SoLuong) as TongSoLuong,
                SUM(ct.ThanhTien) as TongDoanhThu,
                COUNT(DISTINCT ct.IDDonHang) as SoDonHang
            FROM ChiTietDonHang ct
            JOIN Menu m ON ct.IDMon = m.IDMon
            JOIN DonHang d ON ct.IDDonHang = d.IDDonHang
            WHERE d.TrangThaiThanhToan = 1
            GROUP BY m.IDMon, m.TenMon, m.HinhAnh
            ORDER BY TongSoLuong DESC
        """, (limit,))
        top_mon = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy top món bán chạy thành công", {'top_mon': top_mon})
    except Exception as e:
        return handle_exception(e, "Lỗi lấy top món bán chạy")

@app.route('/api/admin/dashboard', methods=['GET'])
def admin_dashboard():
    try:
        cursor, conn = get_cursor()
        
        cursor.execute("""
            SELECT SUM(TongTien) as DoanhThuHomNay
            FROM DonHang
            WHERE TrangThaiThanhToan = 1
              AND CONVERT(DATE, NgayTao) = CONVERT(DATE, GETDATE())
        """)
        doanh_thu_hom_nay = cursor.fetchone()[0] or 0
        
        cursor.execute("""
            SELECT COUNT(*) as SoDonHangHomNay
            FROM DonHang
            WHERE TrangThaiThanhToan = 1
              AND CONVERT(DATE, NgayTao) = CONVERT(DATE, GETDATE())
        """)
        so_don_hang_hom_nay = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) as BanDangDung FROM Ban WHERE TrangThai = N'Đang dùng'")
        ban_dang_dung = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) as TongMon FROM Menu WHERE TrangThai = 1")
        tong_mon = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) as DonChoXuLy FROM DonHang WHERE TrangThaiThanhToan = 0")
        don_cho_xu_ly = cursor.fetchone()[0]
        
        conn.close()
        
        return jsonify_response(True, "Lấy dashboard thành công", {
            'doanh_thu_hom_nay': float(doanh_thu_hom_nay),
            'so_don_hang_hom_nay': so_don_hang_hom_nay,
            'ban_dang_dung': ban_dang_dung,
            'tong_mon': tong_mon,
            'don_cho_xu_ly': don_cho_xu_ly
        })
    except Exception as e:
        return handle_exception(e, "Lỗi lấy dashboard")
    
# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 API LOGIN
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        ten_dang_nhap = data.get('ten_dang_nhap')
        mat_khau = data.get('mat_khau')
        
        if not ten_dang_nhap or not mat_khau:
            return jsonify_response(False, "Thiếu thông tin đăng nhập", None, 400)
        
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT IDNguoiDung, HoTen, VaiTro, TrangThai
            FROM NguoiDung
            WHERE TenDangNhap = ? AND MatKhau = ? AND TrangThai = 1
        """, (ten_dang_nhap, mat_khau))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return jsonify_response(False, "Tên đăng nhập hoặc mật khẩu không đúng", None, 401)
        
        user_dict = row_to_dict(cursor, user)
        token = f"{user_dict['IDNguoiDung']}:{user_dict['VaiTro']}"
        
        return jsonify_response(True, "Đăng nhập thành công", {
            'token': token,
            'user': {
                'id': user_dict['IDNguoiDung'],
                'ho_ten': user_dict['HoTen'],
                'vai_tro': user_dict['VaiTro']
            }
        })
    except Exception as e:
        return handle_exception(e, "Lỗi đăng nhập")

# ═══════════════════════════════════════════════════════════════════════════════
# 📡 SOCKET.IO EVENTS
# ═══════════════════════════════════════════════════════════════════════════════

@socketio.on('connect')
def handle_connect():
    logger.info(f"✅ Client connected: {request.sid}")
    emit('connected', {'message': 'Kết nối thành công'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"❌ Client disconnected: {request.sid}")

@socketio.on('join_room')
def handle_join_room(data):
    room = data.get('room')
    logger.info(f"🚪 Client {request.sid} joined room: {room}")
    emit('room_joined', {'room': room, 'message': f'Đã tham gia room {room}'})

@socketio.on('ping')
def handle_ping():
    emit('pong', {'timestamp': datetime.now().isoformat()})

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 UTILITY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'application': 'MyCay_Oder API',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': {
            'khach_hang': [
                'GET /api/ban/<id>',
                'GET /api/menu',
                'POST /api/order/add',
                'GET /api/ban/<id>/donhang',
                'POST /api/ban/<id>/call',
                'POST /api/danhgia'
            ],
            'thu_ngan': [
                'GET /api/thungan/donhang',
                'PUT /api/thungan/donhang/<id>/xacnhan',
                'POST /api/thungan/thanhtoan/<id>'
            ],
            'bep': [
                'GET /api/bep/donhang',
                'PUT /api/bep/donhang/<id>/trangthai'
            ],
            'admin': [
                'CRUD /api/admin/ban',
                'CRUD /api/admin/danhmuc',
                'CRUD /api/admin/menu',
                'CRUD /api/admin/khuyenmai',
                'CRUD /api/admin/nguoidung',
                'GET /api/admin/baocao/doanhthu',
                'GET /api/admin/baocao/topmon',
                'GET /api/admin/dashboard'
            ]
        },
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    db_status = test_connection()
    return jsonify({
        'status': 'healthy' if db_status else 'unhealthy',
        'database': 'connected' if db_status else 'disconnected',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/info', methods=['GET'])
def system_info():
    try:
        cursor, conn = get_cursor()
        
        cursor.execute("SELECT COUNT(*) FROM Ban")
        tong_ban = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM Menu WHERE TrangThai = 1")
        tong_mon = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM DonHang")
        tong_don_hang = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM NguoiDung WHERE TrangThai = 1")
        tong_nguoi_dung = cursor.fetchone()[0]
        
        conn.close()
        
        return jsonify_response(True, "Lấy thông tin hệ thống thành công", {
            'tong_ban': tong_ban,
            'tong_mon': tong_mon,
            'tong_don_hang': tong_don_hang,
            'tong_nguoi_dung': tong_nguoi_dung
        })
    except Exception as e:
        return handle_exception(e, "Lỗi lấy thông tin hệ thống")

# ═══════════════════════════════════════════════════════════════════════════════
# 🚨 ERROR HANDLERS
# ═══════════════════════════════════════════════════════════════════════════════

@app.errorhandler(404)
def not_found(error):
    return jsonify_response(False, "Endpoint không tồn tại", None, 404)

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify_response(False, "Phương thức không được phép", None, 405)

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal Server Error: {str(error)}")
    return jsonify_response(False, "Lỗi server nội bộ", None, 500)

@app.errorhandler(Exception)
def handle_unexpected_error(error):
    logger.error(f"Unexpected Error: {str(error)}")
    return jsonify_response(False, f"Lỗi không mong muốn: {str(error)}", None, 500)

# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 ADDITIONAL HELPFUL ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/thongbao', methods=['GET'])
def lay_thong_bao():
    try:
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT tb.IDThongBao, tb.IDBan, tb.NoiDung, tb.TrangThai, tb.ThoiGian, b.TenBan
            FROM ThongBao tb JOIN Ban b ON tb.IDBan = b.IDBan
            WHERE tb.TrangThai = 0
            ORDER BY tb.ThoiGian DESC
        """)
        thong_bao_list = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy danh sách thông báo thành công", {'thong_bao': thong_bao_list})
    except Exception as e:
        return handle_exception(e, "Lỗi lấy danh sách thông báo")

@app.route('/api/thongbao/<int:id_thong_bao>/xuly', methods=['PUT'])
def xu_ly_thong_bao(id_thong_bao):
    try:
        cursor, conn = get_cursor()
        cursor.execute("UPDATE ThongBao SET TrangThai = 1 WHERE IDThongBao = ?", (id_thong_bao,))
        conn.commit()
        conn.close()
        return jsonify_response(True, "Đã xử lý thông báo")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return handle_exception(e, "Lỗi xử lý thông báo")

@app.route('/api/khachhang', methods=['GET'])
def lay_danh_sach_khach_hang():
    try:
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT IDKhachHang, TenKhachHang, SoDienThoai, DiemTichLuy
            FROM KhachHang
            ORDER BY DiemTichLuy DESC
        """)
        khach_hang_list = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy danh sách khách hàng thành công", {'khach_hang': khach_hang_list})
    except Exception as e:
        return handle_exception(e, "Lỗi lấy danh sách khách hàng")

@app.route('/api/khachhang/<so_dien_thoai>', methods=['GET'])
def lay_thong_tin_khach_hang(so_dien_thoai):
    try:
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT IDKhachHang, TenKhachHang, SoDienThoai, DiemTichLuy
            FROM KhachHang WHERE SoDienThoai = ?
        """, (so_dien_thoai,))
        khach_hang = cursor.fetchone()
        if not khach_hang:
            conn.close()
            return jsonify_response(False, "Khách hàng không tồn tại", None, 404)
        
        khach_hang_dict = row_to_dict(cursor, khach_hang)
        
        cursor.execute("""
            SELECT ls.SoDiem, ls.ThoiGian, d.TongTien
            FROM LichSuTichDiem ls
            JOIN DonHang d ON ls.IDDonHang = d.IDDonHang
            WHERE ls.IDKhachHang = ?
            ORDER BY ls.ThoiGian DESC
        """, (khach_hang_dict['IDKhachHang'],))
        lich_su = rows_to_dict_list(cursor, cursor.fetchall())
        khach_hang_dict['lich_su_tich_diem'] = lich_su
        
        conn.close()
        return jsonify_response(True, "Lấy thông tin khách hàng thành công", khach_hang_dict)
    except Exception as e:
        return handle_exception(e, "Lỗi lấy thông tin khách hàng")

@app.route('/api/phuongthucthanhtoan', methods=['GET'])
def lay_phuong_thuc_thanh_toan():
    try:
        cursor, conn = get_cursor()
        cursor.execute("SELECT * FROM PhuongThucThanhToan WHERE TrangThai = 1")
        phuong_thuc_list = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy danh sách phương thức thanh toán thành công", 
                              {'phuong_thuc': phuong_thuc_list})
    except Exception as e:
        return handle_exception(e, "Lỗi lấy phương thức thanh toán")

@app.route('/api/lichsu/donhang/<int:id_don_hang>', methods=['GET'])
def lay_lich_su_don_hang(id_don_hang):
    try:
        cursor, conn = get_cursor()
        cursor.execute("""
            SELECT ID, TrangThai, ThoiGian
            FROM LichSuTrangThaiDonHang
            WHERE IDDonHang = ?
            ORDER BY ThoiGian ASC
        """, (id_don_hang,))
        lich_su = rows_to_dict_list(cursor, cursor.fetchall())
        conn.close()
        return jsonify_response(True, "Lấy lịch sử đơn hàng thành công", {'lich_su': lich_su})
    except Exception as e:
        return handle_exception(e, "Lỗi lấy lịch sử đơn hàng")

@app.after_request
def add_header(response):
    response.headers["ngrok-skip-browser-warning"] = "true"
    return response

# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 MAIN - KHỞI ĐỘNG SERVER
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("═" * 80)
    print("🚀 STARTING MYCAY_ODER BACKEND SERVER")
    print("═" * 80)
    print("📦 Application: MyCay_Oder - Hệ thống đặt món QR")
    print("🐍 Python Version: 3.11+")
    print("🌐 Framework: Flask + SocketIO")
    print("💾 Database: SQL Server (MyCay_Oder)")
    print("═" * 80)
    
    # Test database connection
    print("\n🔍 Testing database connection...")
    if test_connection():
        print("✅ Database connection: SUCCESS")
    else:
        print("❌ Database connection: FAILED")
        print("⚠️  Please check your DB_CONFIG settings")
        print("⚠️  Make sure SQL Server is running")
        print("⚠️  Verify database 'MyCay_Oder' exists")
    
    print("\n" + "═" * 80)
    print("📡 Server Configuration:")
    print("   • Host: 0.0.0.0")
    print("   • Port: 5000")
    print("   • URL: http://localhost:5000")
    print("   • SocketIO: ENABLED")
    print("   • CORS: ENABLED")
    print("   • Debug Mode: TRUE")
    print("═" * 80)
    
    print("\n📋 Available Endpoints:")
    print("   👤 Khách hàng:")
    print("      - GET  /api/ban/<id>")
    print("      - GET  /api/menu")
    print("      - POST /api/order/add")
    print("      - POST /api/ban/<id>/call")
    print("      - POST /api/danhgia")
    print("\n   💼 Thu ngân:")
    print("      - GET  /api/thungan/donhang")
    print("      - PUT  /api/thungan/donhang/<id>/xacnhan")
    print("      - POST /api/thungan/thanhtoan/<id>")
    print("\n   🔥 Bếp:")
    print("      - GET  /api/bep/donhang")
    print("      - PUT  /api/bep/donhang/<id>/trangthai")
    print("\n   🛠  Admin:")
    print("      - CRUD /api/admin/ban")
    print("      - CRUD /api/admin/menu")
    print("      - CRUD /api/admin/danhmuc")
    print("      - CRUD /api/admin/khuyenmai")
    print("      - CRUD /api/admin/nguoidung")
    print("      - GET  /api/admin/dashboard")
    print("      - GET  /api/admin/baocao/doanhthu")
    print("      - GET  /api/admin/baocao/topmon")
    print("\n   🔐 Authentication:")
    print("      - POST /api/login")
    print("\n   🔧 Utilities:")
    print("      - GET  /api/health")
    print("      - GET  /api/info")
    print("      - GET  /")
    
    print("\n" + "═" * 80)
    print("📡 SocketIO Events:")
    print("   • new_order           (Khách → Thu ngân)")
    print("   • send_to_kitchen     (Thu ngân → Bếp)")
    print("   • order_status_update (Bếp → All)")
    print("   • order_paid          (Thu ngân → All)")
    print("   • call_staff          (Khách → Staff)")
    print("═" * 80)
    
    print("\n🎯 Quick Test Commands:")
    print("   curl http://localhost:5000/")
    print("   curl http://localhost:5000/api/health")
    print("   curl http://localhost:5000/api/menu")
    
    print("\n" + "═" * 80)
    print("🚀 Server is starting...")
    print("═" * 80 + "\n")
    
    # Run server
    try:
        socketio.run(
            app, 
            host='0.0.0.0', 
            port=5000, 
            debug=True, 
            allow_unsafe_werkzeug=True,
            log_output=True
        )
    except KeyboardInterrupt:
        print("\n\n" + "═" * 80)
        print("⛔ Server stopped by user")
        print("═" * 80)
    except Exception as e:
        print("\n\n" + "═" * 80)
        print(f"❌ Server error: {str(e)}")
        print("═" * 80)
print(app.url_map)
