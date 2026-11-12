"""Генератор пиксельных подарков для адвент-календаря Bzik.

Каждая коробка рисуется попиксельно в родном разрешении (изометрия 2:1,
чёрный контур 1px), затем в приложении увеличивается без сглаживания.

Запуск:  python gen_boxes.py ../web/assets/boxes
Результат: box-NN-closed.png, box-NN-open.png (родной размер) + art/boxes-preview.png
"""
import sys
from pathlib import Path
from PIL import Image

BLACK = (20, 20, 20, 255)
WHITE = (255, 255, 255, 255)
GOLD = (250, 205, 60, 255)


def mix(c, t, k):
    return tuple(round(c[i] + (t[i] - c[i]) * k) for i in range(3)) + (255,)


def light(c, k=0.35):
    return mix(c, (255, 255, 255), k)


def dark(c, k=0.3):
    return mix(c, (0, 0, 0), k)


# ---------- узоры бумаги (в локальных координатах грани u,v) ----------
def pat_none(u, v):
    return False


def pat_dots(u, v):
    return v % 4 == 1 and (u + (v // 4) % 2 * 2) % 4 == 1


def pat_stripes(u, v):
    return (u + v) % 6 < 2


def pat_check(u, v):
    return ((u // 3) + (v // 3)) % 2 == 0


def pat_snow(u, v):
    # маленькие «плюсики»-снежинки по разреженной сетке
    cu, cv = (u + (v // 6) % 2 * 3) % 6, v % 6
    return (cu == 2 and 1 <= cv <= 3) or (cv == 2 and 1 <= cu <= 3)


def pat_stars(u, v):
    cu, cv = (u + (v // 7) % 2 * 3) % 7, v % 7
    return (cu == 3 and 2 <= cv <= 4) or (cv == 3 and 2 <= cu <= 4)


def pat_trees(u, v):
    cu, cv = (u + (v // 7) % 2 * 3) % 7, v % 7
    # ёлочка: треугольник 1-3-5 по ширине
    return (cv == 1 and cu == 3) or (cv == 2 and 2 <= cu <= 4) or (cv == 3 and 1 <= cu <= 5) or (cv == 4 and cu == 3)


# (функция, пространство): "face" — по осям грани, "screen" — прямо на экране
PATTERNS = {
    "none": (pat_none, "face"), "dots": (pat_dots, "screen"), "stripes": (pat_stripes, "face"),
    "check": (pat_check, "face"), "snow": (pat_snow, "screen"), "stars": (pat_stars, "screen"),
    "trees": (pat_trees, "screen"),
}

# ---------- банты (o контур, h блик, r лента, d тень) ----------
BOWS = {
    "loops": [
        "..ooo.....ooo..",
        ".ohhro...orhho.",
        "ohrrrro.orrrrdo",
        "ordrrrrorrrrddo",
        ".oddrrooorrddo.",
        "..ooodrrrdooo..",
        "....orddddo....",
        "...odo...odo...",
        "...oo.....oo...",
    ],
    "rosette": [
        "...oo.o.oo...",
        "..ohroohrho..",
        ".ohrrrhrrrro.",
        "ohrrdrrrdrrro",
        "orrdrrhrrdrdo",
        ".orrrrdrrrdo.",
        "..oodddddoo..",
        "....ooooo....",
    ],
    "flat": [
        ".oooo.....oooo.",
        "ohhhro...orhhho",
        "ohrrrro.orrrrdo",
        "ohrrrrdorrrrrdo",
        ".ordddrorddddo.",
        "..ooorrrrrooo..",
        "....odrrrdo....",
        ".....ooooo.....",
    ],
}

# ---------- 14 коробок ----------
# paper, ribbon, pattern, pattern color, bow, a (полуширина), h (высота стенки)
BOXES = [
    ((125, 205, 235), (220, 55, 55), "none", None, "loops", 14, 13),
    ((210, 45, 45), (70, 170, 60), "dots", (255, 255, 255), "rosette", 14, 14),
    ((240, 115, 45), (250, 195, 45), "none", None, "flat", 14, 15),
    ((65, 165, 85), (215, 45, 45), "stripes", (110, 200, 120), "loops", 12, 16),
    ((135, 85, 195), (250, 200, 60), "stars", (250, 210, 80), "rosette", 16, 12),
    ((242, 242, 248), (60, 110, 220), "snow", (150, 190, 240), "loops", 14, 14),
    ((245, 150, 190), (195, 35, 80), "dots", (255, 255, 255), "flat", 12, 13),
    ((248, 212, 70), (55, 95, 205), "stripes", (255, 238, 150), "loops", 14, 16),
    ((45, 65, 140), (250, 200, 60), "stars", (250, 210, 80), "flat", 16, 14),
    ((55, 195, 185), (215, 45, 45), "check", (120, 225, 215), "loops", 12, 15),
    ((250, 250, 250), (60, 165, 70), "stripes", (225, 45, 45), "rosette", 14, 15),
    ((185, 135, 85), (210, 45, 45), "none", None, "loops", 14, 12),
    ((235, 185, 55), (215, 45, 45), "none", None, "rosette", 14, 14),
    ((35, 115, 65), (250, 200, 60), "trees", (150, 220, 150), "flat", 16, 13),
]

LID = 4          # высота бортика крышки
CANVAS_CLOSED = (40, 48)
CANVAS_OPEN = (60, 48)


class Canvas:
    def __init__(self, w, h):
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.w, self.h = w, h

    def put(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.im.putpixel((x, y), c)


def draw_box(cv, cx, bottom, a, h, paper, ribbon, pattern, pcol, bow, opened):
    """Рисует коробку. bottom — y нижней вершины переднего ребра."""
    b = a // 2
    y0 = bottom - (2 * b + h)          # верхняя вершина крышки
    pat, space = PATTERNS[pattern]
    rw = 2 if a <= 12 else 3            # полуширина ленты в пикселях
    p_top, p_left, p_right = light(paper, 0.25), paper, dark(paper, 0.22)
    r_top, r_left, r_right = light(ribbon, 0.2), ribbon, dark(ribbon, 0.2)

    if opened:                          # без крышки стенки ниже на LID
        y0 += LID
        h -= LID

    def face_color(base_p, base_r, is_ribbon, u, v, lid_zone, x=0, y=0):
        if space == "screen":
            u, v = x + 1, y + 2
        if is_ribbon:
            c = base_r
        elif pcol and pat(u, v):
            c = pcol + (255,) if len(pcol) == 3 else pcol
            if base_p is p_right:
                c = dark(c, 0.15)
        else:
            c = base_p
        if lid_zone and not opened:
            c = light(c, 0.08)
        return c

    for dx in range(-a, a + 1):
        x = cx + dx
        upper = y0 + abs(dx) // 2
        mid = y0 + 2 * b - abs(dx) // 2
        low = mid + h
        # --- верхняя грань ---
        for y in range(upper, mid + 1):
            dy = y - (y0 + b)
            if opened:
                # внутренность: задние стенки + дно
                c = dark(paper, 0.35) if y <= upper + 3 else dark(paper, 0.6)
            else:
                s = (y - y0) + (dx // 2)   # постоянна вдоль ребра (2,-1)
                t = (y - y0) - (dx // 2)   # постоянна вдоль ребра (2, 1)
                band = abs(s - b) <= rw // 2 or abs(t - b) <= rw // 2
                c = face_color(p_top, r_top, band, s, t, False, x, y)
            cv.put(x, y, c)
        # --- боковые грани ---
        for y in range(mid + 1, low + 1):
            v = y - mid
            if dx < 0:
                band = abs(dx + a // 2) < rw
                c = face_color(p_left, r_left, band, dx + a, v, v <= LID, x, y)
            else:
                band = abs(dx - a // 2) < rw
                c = face_color(p_right, r_right, band, dx, v, v <= LID, x, y)
            cv.put(x, y, c)
        # --- контур ---
        cv.put(x, upper, BLACK)
        cv.put(x, mid, BLACK)
        cv.put(x, low, BLACK)
        if not opened:
            sy = mid + LID                     # шов крышки: затемняем то, что под ним
            if sy < cv.h:
                cv.put(x, sy, dark(cv.im.getpixel((x, sy)), 0.45))
        if abs(dx) == a or dx == 0:
            for y in range(upper if abs(dx) == a else mid, low + 1):
                cv.put(x, y, BLACK)

    if opened:
        # искорки над открытой коробкой
        for sx, sy, col in ((cx - 4, y0 - 6, GOLD), (cx + 5, y0 - 9, WHITE), (cx + 1, y0 - 13, GOLD)):
            for ox, oy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                cv.put(sx + ox, sy + oy, col)
            for ox, oy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                cv.put(sx + ox, sy + oy, BLACK if col == WHITE else dark(GOLD, 0.25))
    else:
        draw_bow(cv, cx, y0 + b, bow, ribbon)


def draw_bow(cv, cx, cy, kind, ribbon):
    rows = BOWS[kind]
    bw, bh = len(rows[0]), len(rows)
    left = cx - bw // 2
    top = cy - bh + 1
    cmap = {"o": BLACK, "h": light(ribbon, 0.45), "r": ribbon + (255,) if len(ribbon) == 3 else ribbon,
            "d": dark(ribbon, 0.3)}
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in cmap:
                cv.put(left + i, top + j, cmap[ch])


def draw_lid(cv, cx, bottom, a, paper, ribbon, pattern, pcol, bow):
    """Крышка, стоящая на земле рядом: плоская коробка высотой LID."""
    draw_box(cv, cx, bottom, a, LID, paper, ribbon, pattern, pcol, bow, opened=False)


def render(spec, opened):
    paper, ribbon, pattern, pcol, bow, a, h = spec
    if opened:
        cv = Canvas(*CANVAS_OPEN)
        cx = 20
        draw_box(cv, cx, cv.h - 4, a, h, paper, ribbon, pattern, pcol, bow, opened=True)
        draw_lid(cv, cx + a + 6, cv.h - 2, a + 1, paper, ribbon, pattern, pcol, bow)
    else:
        cv = Canvas(*CANVAS_CLOSED)
        draw_box(cv, cv.w // 2, cv.h - 3, a, h, paper, ribbon, pattern, pcol, bow, opened=False)
    return cv.im


def main(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    tiles = []
    for i, spec in enumerate(BOXES, 1):
        c = render(spec, False)
        o = render(spec, True)
        c.save(out / f"box-{i:02d}-closed.png")
        o.save(out / f"box-{i:02d}-open.png")
        tiles.append((c, o))
    # лист превью: 2 колонки (закрытая | открытая) x 7 рядов, на белом фоне, x4
    S = 4
    cw, ow, th = CANVAS_CLOSED[0], CANVAS_OPEN[0], CANVAS_OPEN[1]
    pair_w = cw + ow + 8
    cols, rows = 2, 7
    sheet = Image.new("RGBA", ((pair_w * cols + 16) * S, (th * rows + 8) * S), WHITE)
    for k, (c, o) in enumerate(tiles):
        col, row = k // rows, k % rows
        x = (8 + col * pair_w) * S
        y = (4 + row * th) * S
        sheet.alpha_composite(c.resize((cw * S, th * S), Image.NEAREST), (x, y))
        sheet.alpha_composite(o.resize((ow * S, th * S), Image.NEAREST), (x + (cw + 2) * S, y))
    sheet.save(Path(__file__).with_name("boxes-preview.png"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "out")
