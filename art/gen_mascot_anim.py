"""Анимация маскота: лист кадров (sprite sheet) в родном пиксельном разрешении.

Маскот собирается из частей (голова+туловище, две ноги, две руки), части
поворачиваются вокруг суставов БЕЗ сглаживания — кадры остаются чёткими
пиксель-артом. Поза «руки скрещены» берётся из исходного mascot.txt.

Кадры (каждый FRAME x FRAME):
  0 idle (руки скрещены)   1 idle, моргнул
  2 стоит, руки опущены    3-4 машет рукой
  5-8 шаги                  9 прыжок «ура», руки вверх
  10 стоит, моргнул

Запуск: python gen_mascot_anim.py ../web/assets/mascot-sheet.png
"""
import sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).parent
FRAME = 80
OX, OY = 21, 4           # где в кадре левый верхний угол фигуры 37x73
INK = (20, 20, 20, 255)
RED = (225, 45, 45, 255)
WHITE = (255, 255, 255, 255)

orig = [l.rstrip("\n") for l in open(HERE / "mascot.txt") if l.strip()]
blink = [l.rstrip("\n") for l in open(HERE / "mascot-blink.txt") if l.strip()]
W = len(orig[0])

TORSO = [  # строки 24..38 — туловище с опущенными руками и воротником-«V», ширина как у ног
    ".......######..........######........",
    "......##....##........##....##.......",
    ".....##......##......##......##......",
    ".....##.......##....##.......##......",
    ".....##........##..##........##......",
    ".....##.........####.........##......",
] + [".....##......................##......"] * 9

ARM = [
    ".######.",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "########",
    "##....##",
    "##....##",
    "##....##",
    ".##..##.",
    "..####..",
]


def grid_to_img(rows):
    """ASCII -> RGBA: # чёрный, R красный, внутренность белая, снаружи прозрачно."""
    h, w = len(rows), max(map(len, rows))
    g = [r.ljust(w, ".") for r in rows]
    outside, stack = set(), [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in outside or not (0 <= x < w and 0 <= y < h) or g[y][x] != ".":
            continue
        outside.add((x, y))
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            ch = g[y][x]
            if ch == "#":
                im.putpixel((x, y), INK)
            elif ch == "R":
                im.putpixel((x, y), RED)
            elif (x, y) not in outside:
                im.putpixel((x, y), WHITE)
    return im


def free_body(head_rows):
    legs = list(orig[39:])
    legs[0] = ".....##......................##......"
    # у каждой ноги свой внутренний контур на всю длину — при шаге они расходятся
    legs = [r[:17] + "##" + r[19:] if i < len(legs) - 1 else r for i, r in enumerate(legs)]
    rows = head_rows[:24] + [r.ljust(W, ".")[:W] for r in TORSO] + legs
    full = grid_to_img(rows)
    upper = full.crop((0, 0, W, 39))
    left_leg = full.crop((0, 39, 18, full.height))
    right_leg = full.crop((18, 39, W, full.height))
    return upper, left_leg, right_leg


ARM_IMG = grid_to_img(ARM)
UP_OPEN, LL, RL = free_body(orig)
UP_BLINK, _, _ = free_body(blink)


def layer(part, x, y, angle=0.0, pivot=None):
    """Кладёт часть в кадр и поворачивает вокруг сустава (без сглаживания)."""
    c = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    c.alpha_composite(part, (x, y))
    if angle:
        c = c.rotate(angle, resample=Image.NEAREST, center=pivot)
    return c


def free_frame(arm_l=0, arm_r=0, leg_l=0, leg_r=0, dy=0, upper=None):
    upper = upper or UP_OPEN
    f = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    hip_y = OY + dy + 39
    f.alpha_composite(layer(LL, OX, hip_y, leg_l, (OX + 11, hip_y + 1)))
    f.alpha_composite(layer(RL, OX + 18, hip_y, leg_r, (OX + 24, hip_y + 1)))
    # «таз»: закрывает щели в контуре, когда ноги повёрнуты
    hip = Image.new("RGBA", (22, 3), WHITE)
    f.alpha_composite(hip, (OX + 7, hip_y - 1))
    f.alpha_composite(layer(upper, OX, OY + dy))
    sh_y = OY + dy + 25
    f.alpha_composite(layer(ARM_IMG, OX - 3, sh_y, arm_l, (OX + 1, sh_y + 2)))
    f.alpha_composite(layer(ARM_IMG, OX + 31, sh_y, arm_r, (OX + 35, sh_y + 2)))
    return f


def crossed(rows):
    f = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    f.alpha_composite(grid_to_img(rows), (OX, OY))
    return f


frames = [
    crossed(orig),                                   # 0 idle
    crossed(blink),                                  # 1 idle blink
    free_frame(-6, 6),                               # 2 стоит
    free_frame(-6, 150),                             # 3 машет
    free_frame(-6, 118),                             # 4 машет
    free_frame(-16, 16, 10, -10, 0),                 # 5 шаг
    free_frame(-4, 4, 0, 0, -1),                     # 6
    free_frame(16, -16, -10, 10, 0),                 # 7 шаг
    free_frame(-4, 4, 0, 0, -1),                     # 8
    free_frame(-155, 155, -6, 6, -2),                # 9 ура
    free_frame(-6, 6, upper=UP_BLINK),               # 10 стоит, моргнул
]

sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
for i, fr in enumerate(frames):
    sheet.alpha_composite(fr, (i * FRAME, 0))
out = sys.argv[1] if len(sys.argv) > 1 else "mascot-sheet.png"
sheet.save(out)
prev = Image.new("RGBA", sheet.size, (225, 235, 245, 255))
prev.alpha_composite(sheet)
prev.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(HERE / "mascot-sheet-preview.png")
print(sheet.size, len(frames), "frames")
