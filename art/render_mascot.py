"""Маскот из ASCII-сетки mascot.txt -> PNG в родном разрешении.
# — чёрный контур, R — красная шапка, . — пусто. Внутренность (не достижимая
снаружи) заливается белым, снаружи — прозрачность.
Запуск: python render_mascot.py ../web/assets/mascot.png [mascot.txt]
        python render_mascot.py ../web/assets/mascot-blink.png mascot-blink.txt
"""
import sys
from pathlib import Path
from PIL import Image

src = sys.argv[2] if len(sys.argv) > 2 else "mascot.txt"
rows = [l.rstrip("\n") for l in open(Path(__file__).with_name(src)) if l.strip()]
W, H = max(map(len, rows)), len(rows)
grid = [r.ljust(W, ".") for r in rows]
outside = set()
stack = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
while stack:
    x, y = stack.pop()
    if (x, y) in outside or not (0 <= x < W and 0 <= y < H) or grid[y][x] != ".":
        continue
    outside.add((x, y))
    stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
COL = {"#": (20, 20, 20, 255), "R": (225, 45, 45, 255)}
im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
for y in range(H):
    for x in range(W):
        ch = grid[y][x]
        if ch in COL:
            im.putpixel((x, y), COL[ch])
        elif (x, y) not in outside:
            im.putpixel((x, y), (255, 255, 255, 255))
im.save(sys.argv[1] if len(sys.argv) > 1 else "mascot.png")
print(im.size)
