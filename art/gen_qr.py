"""Настоящий QR-код для слайда «озарение» (день 1).
Ведёт на t.me/xoxo_bzik_bot?startapp=qr — календарь откроется с меткой «qr» и выдаст секретное достижение.
1 модуль = 1 пиксель; в приложении увеличивается без сглаживания.
Запуск: python gen_qr.py ../web/assets/qr-egg.png
"""
import sys
import qrcode
from PIL import Image

URL = "https://t.me/xoxo_bzik_bot?startapp=qr"
q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=1, border=2)
q.add_data(URL)
q.make(fit=True)
img = q.make_image(fill_color=(20, 20, 20), back_color=(255, 255, 255)).convert("RGB")
img.save(sys.argv[1] if len(sys.argv) > 1 else "qr-egg.png")
print("версия", q.version, "размер", img.size)
