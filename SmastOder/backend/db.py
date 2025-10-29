#!/usr/bin/env python3
# db.py - Kết nối SQL Server với pyodbc, hỗ trợ get_cursor() và get_connection()

import os
import logging
import pyodbc
from contextlib import contextmanager

# ==============================
# 🔧 CẤU HÌNH LOGGING
# ==============================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

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
    """Tìm và trả về driver SQL Server phù hợp nhất."""
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

# ==============================
# ⚙️ CẤU HÌNH KẾT NỐI
# ==============================
DB_CONFIG = {
    "DRIVER": DRV_STR,
    "SERVER": os.getenv("MSSQL_SERVER", r"LEVANHOANG\SQLEXPRESS"),
    "DATABASE": os.getenv("MSSQL_DATABASE", "MyCay_Oder"),
    "UID": os.getenv("MSSQL_UID", ""),
    "PWD": os.getenv("MSSQL_PWD", ""),
    "ENCRYPT": os.getenv("MSSQL_ENCRYPT", "yes"),
    "TRUST_SERVER_CERT": os.getenv("MSSQL_TRUST_CERT", "yes"),
    "AUTOCOMMIT": os.getenv("MSSQL_AUTOCOMMIT", "false").lower() in ("1", "true", "yes"),
    "TIMEOUT": int(os.getenv("MSSQL_TIMEOUT", "10"))
}

def build_conn_str(cfg: dict) -> str:
    """Tạo chuỗi kết nối SQL Server."""
    if not cfg["DRIVER"]:
        raise RuntimeError("❌ Không tìm thấy driver hợp lệ cho SQL Server.")

    base = [
        f"DRIVER={cfg['DRIVER']}",
        f"SERVER={cfg['SERVER']}",
        f"DATABASE={cfg['DATABASE']}",
        f"Encrypt={cfg['ENCRYPT']}",
        f"TrustServerCertificate={cfg['TRUST_SERVER_CERT']}"
    ]
    auth = [f"UID={cfg['UID']}", f"PWD={cfg['PWD']}"] if cfg["UID"] else ["Trusted_Connection=yes"]
    return ";".join(base + auth)

try:
    CONN_STR = build_conn_str(DB_CONFIG)
    logger.info("✅ Database connection string built successfully.")
except Exception as e:
    logger.critical(f"❌ Failed to build connection string: {e}")
    CONN_STR = None

# ==============================
# 🔌 KẾT NỐI DATABASE
# ==============================
def connect() -> pyodbc.Connection:
    """Tạo kết nối mới tới SQL Server."""
    if not CONN_STR:
        raise RuntimeError("Không thể kết nối: chuỗi kết nối chưa được tạo.")
    try:
        conn = pyodbc.connect(CONN_STR, timeout=DB_CONFIG["TIMEOUT"])
        conn.autocommit = DB_CONFIG["AUTOCOMMIT"]
        return conn
    except pyodbc.Error as e:
        msg = str(e)
        if "IM002" in msg:
            raise RuntimeError("❌ Lỗi ODBC Driver: chưa cài hoặc sai tên driver.") from e
        elif "08001" in msg:
            raise RuntimeError("❌ Lỗi kết nối SQL Server: không tìm thấy server hoặc instance.") from e
        raise

# Alias để app.py còn dùng get_connection()
get_connection = connect

# ==============================
# 🧠 QUẢN LÝ CURSOR
# ==============================
@contextmanager
def get_cursor():
    """
    Context manager an toàn cho giao dịch DB.
    Tự động commit nếu thành công, rollback nếu lỗi.
    """
    conn = None
    cur = None
    try:
        conn = connect()
        cur = conn.cursor()
        yield cur
        if not conn.autocommit:
            conn.commit()
    except pyodbc.Error as e:
        if conn and not conn.autocommit:
            conn.rollback()
        logger.error(f"❌ Database error: {e}")
        raise
    except Exception as e:
        if conn and not conn.autocommit:
            conn.rollback()
        logger.error(f"⚠️ Application error in get_cursor(): {e}")
        raise
    finally:
        try:
            if cur:
                cur.close()
        except Exception:
            pass
        if conn:
            conn.close()

# ==============================
# 🧪 KIỂM TRA KẾT NỐI
# ==============================
def test_connection():
    """Kiểm tra kết nối CSDL."""
    try:
        with get_cursor() as cur:
            cur.execute("SELECT 1 AS Test")
            row = cur.fetchone()
            logger.info(f"✅ Database connected successfully. Test result: {row[0]}")
            return True
    except Exception as e:
        logger.critical(f"❌ Lỗi kết nối database: {e}")
        raise

# ==============================
# 🔧 MAIN
# ==============================
if __name__ == "__main__":
    test_connection()
