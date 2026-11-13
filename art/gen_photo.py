"""Фото для слайдов в пиксельном стиле бзика: уменьшаем, сокращаем палитру без дизеринга,
в приложении картинка увеличивается без сглаживания — получается «пиксельная фотография».
Запуск: python gen_photo.py reference/oldspice-ad.jpg ../web/assets/photos/oldspice.png [ширина] [цветов]
"""
import sys
from PIL import Image, ImageEnhance

src, out = sys.argv[1], sys.argv[2]
width = int(sys.argv[3]) if len(sys.argv) > 3 else 160
colors = int(sys.argv[4]) if len(sys.argv) > 4 else 40
im = Image.open(src).convert("RGB")
im = ImageEnhance.Contrast(im).enhance(1.12)
im = ImageEnhance.Color(im).enhance(1.15)
h = round(im.height * width / im.width)
small = im.resize((width, h), Image.LANCZOS)
small = small.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
small.save(out)
print(out, small.size)
