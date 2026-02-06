# utils.py
import qrcode
from io import BytesIO
from flask import send_file


def generate_qr_bytes(text):
    """Generate a PNG QR code as a BytesIO buffer."""
    img = qrcode.make(text)
    buf = BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf


def generate_qr_response(text, filename='qr.png'):
    """Return a Flask response that sends the QR PNG."""
    buf = generate_qr_bytes(text)
    return send_file(buf, mimetype='image/png', download_name=filename, as_attachment=False)