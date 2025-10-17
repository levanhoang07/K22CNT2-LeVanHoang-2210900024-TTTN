# db.py
import os
import logging
import pyodbc
from contextlib import contextmanager

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Cấu Hình Driver ---
# Các driver ưu tiên (sẽ thử theo thứ tự)
_PREFERRED_DRIVERS = [
    'ODBC Driver 18 for SQL Server',
    'ODBC Driver 17 for SQL Server',
    'ODBC Driver 13 for SQL Server',
    'SQL Server Native Client 11.0',
    'SQL Server'
]

def _find_driver():
    """Tìm và trả về tên driver phù hợp nhất đã cài đặt."""
    env_driver = os.getenv('MSSQL_DRIVER', '').strip()
    available_drivers = pyodbc.drivers()
    logger.debug("Available ODBC drivers: %s", available_drivers)

    # 1. Ưu tiên driver được chỉ định qua biến môi trường
    if env_driver:
        candidate = env_driver.strip('{}')
        if candidate in available_drivers:
            logger.info("Using driver from MSSQL_DRIVER environment variable: %s", candidate)
            return candidate
        else:
            logger.warning("Requested MSSQL_DRIVER '%s' not found among installed drivers. Searching preferred list.", env_driver)
    
    # 2. Tìm trong danh sách ưu tiên
    for preferred_driver in _PREFERRED_DRIVERS:
        if preferred_driver in available_drivers:
            logger.info("Found and selected preferred ODBC driver: %s", preferred_driver)
            return preferred_driver

    # 3. Không tìm thấy
    logger.error("No suitable ODBC driver found. Please install Microsoft ODBC Driver for SQL Server (17/18).")
    logger.error("Installed drivers: %s", available_drivers)
    return None

# Tìm driver và lưu lại dưới dạng chuỗi ODBC
SELECTED_DRIVER = _find_driver()
DRV_STR = f"{{{SELECTED_DRIVER}}}" if SELECTED_DRIVER else ''


# --- Cấu Hình Kết Nối ---
DB_CONFIG = {
    'DRIVER': DRV_STR,
    'SERVER': os.getenv('MSSQL_SERVER', r'LEVANHOANG\SQLEXPRESS'),
    'DATABASE': os.getenv('MSSQL_DATABASE', 'MyCay_Oder'),
    'UID': os.getenv('MSSQL_UID', ''),
    'PWD': os.getenv('MSSQL_PWD', ''),
    # Thiết lập bảo mật cho kết nối hiện đại
    'ENCRYPT': os.getenv('MSSQL_ENCRYPT', 'yes'),
    'TRUST_SERVER_CERT': os.getenv('MSSQL_TRUST_CERT', 'yes'),
    # Cài đặt kết nối
    'AUTOCOMMIT': os.getenv('MSSQL_AUTOCOMMIT', 'false').lower() in ('1', 'true', 'yes'),
    'TIMEOUT': int(os.getenv('MSSQL_TIMEOUT', '10')), # Tăng timeout lên 10s cho an toàn
}

def build_conn_str(config: dict) -> str:
    """Tạo chuỗi kết nối ODBC DSN-less từ cấu hình."""
    if not config['DRIVER']:
        raise RuntimeError(
            "Không tìm thấy ODBC driver hợp lệ. "
            "Cài đặt Microsoft ODBC Driver for SQL Server hoặc set môi trường MSSQL_DRIVER. "
            f"Installed drivers: {pyodbc.drivers()}"
        )
    
    # Các phần chung
    common_parts = [
        f"DRIVER={config['DRIVER']}",
        f"SERVER={config['SERVER']}",
        f"DATABASE={config['DATABASE']}",
        f"Encrypt={config['ENCRYPT']}",
        f"TrustServerCertificate={config['TRUST_SERVER_CERT']}",
        "ApplicationIntent=ReadOnly" if os.getenv('MSSQL_READONLY') else "", # Thêm tùy chọn ReadOnly nếu cần
    ]

    # Xác thực (SQL Server Auth vs. Windows Auth)
    if config['UID']:
        auth_parts = [f"UID={config['UID']}", f"PWD={config['PWD']}"]
    else:
        auth_parts = ["Trusted_Connection=yes"]

    # Lọc bỏ các chuỗi rỗng và nối lại
    return ";".join(filter(None, common_parts + auth_parts))


# Khởi tạo chuỗi kết nối toàn cục
try:
    CONN_STR = build_conn_str(DB_CONFIG)
except RuntimeError as e:
    CONN_STR = None
    logger.critical(e)
    
if CONN_STR:
    logger.info("Connection string built successfully.")


def connect() -> pyodbc.Connection:
    """Trả về một kết nối pyodbc mới."""
    if not CONN_STR:
        raise RuntimeError("Không thể kết nối: Chuỗi kết nối chưa được tạo do thiếu Driver.")
    
    try:
        conn = pyodbc.connect(CONN_STR, timeout=DB_CONFIG['TIMEOUT'])
        conn.autocommit = DB_CONFIG['AUTOCOMMIT']
        return conn
    except pyodbc.Error as e:
        # Xử lý lỗi kết nối thất bại (ví dụ: IM002 - Driver, 08001 - Server/Port)
        msg = str(e)
        if 'IM002' in msg or 'driver' in msg.lower() or 'ODBC Driver Manager' in msg:
            raise RuntimeError(
                f"""Kết nối ODBC thất bại: Driver chưa được cài hoặc tên driver sai.
Hãy cài Microsoft ODBC Driver for SQL Server (17/18).
Thông báo gốc: {msg}"""
            ) from e
        elif '08001' in msg or 'server' in msg.lower():
            raise RuntimeError(
                f"""Kết nối SQL Server thất bại: Không tìm thấy SERVER ({DB_CONFIG['SERVER']})
Kiểm tra tên server, instance name, hoặc port.
Thông báo gốc: {msg}"""
            ) from e
        raise


@contextmanager
def get_cursor():
    """
    Context manager trả về một cursor. Commit khi thành công, Rollback khi có lỗi.
    Đảm bảo đóng connection và cursor.
    """
    conn = None
    try:
        conn = connect()
        # Sử dụng with cho cursor để đảm bảo đóng tự động
        with conn.cursor() as cur:
            yield cur
        
        # Chỉ commit/rollback khi autocommit=False
        if not conn.autocommit:
            conn.commit()
            
    except pyodbc.Error as e:
        if conn and not conn.autocommit:
            logger.warning("Transaction rolled back due to error: %s", str(e).split('\n')[0])
            try:
                conn.rollback()
            except Exception as rb_e:
                logger.error("Error during rollback: %s", rb_e)
        raise
    except Exception:
        # Bắt các exception không phải pyodbc (ví dụ: lỗi code Python)
        if conn and not conn.autocommit:
            logger.warning("Transaction rolled back due to non-database error.")
            try:
                conn.rollback()
            except Exception as rb_e:
                logger.error("Error during rollback: %s", rb_e)
        raise
        
    finally:
        if conn:
            try:
                conn.close()
            except Exception as e:
                logger.error("Error closing connection: %s", e)


def test_connection():
    """Kiểm tra kết nối nhanh. Nâng exception nếu thất bại."""
    try:
        with get_cursor() as cur:
            # Dùng câu lệnh SELECT nhẹ nhàng nhất
            cur.execute("SELECT 1 AS ConnectionTest")
            _ = cur.fetchone()
        logger.info("Database connection test succeeded. SmartOrder DB is ready.")
        return True
    except Exception as e:
        logger.critical("Database connection test failed. Check logs for details.")
        raise

if __name__ == '__main__':
    """
    Nếu chạy db.py độc lập, thực hiện kiểm tra kết nối ngay lập tức.
    """
    try:
        test_connection()
    except Exception:
        # Lỗi đã được logger.critical ghi lại, chỉ cần thoát.
        pass