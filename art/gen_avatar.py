"""Аватарки бота 640x640 из спрайта маскота.
Запуск: python gen_avatar.py   ->  avatar.png (крупный план), avatar-full.png (в полный рост)
"""
import random
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
MASCOT = HERE.parent / "web" / "assets" / "mascot.png"
STAR = ["...y...", "...y...", "yyywyyy", "...y...", "...y..."]


def background(S, P, seed, stars):
    bg = Image.new("RGBA", (S, S), (226, 236, 248, 255))
    d = ImageDraw.Draw(bg)
    random.seed(seed)
    for _ in range(75):
        x, y = random.randrange(0, S // P) * P, random.randrange(0, S // P) * P
        d.rectangle([x, y, x + P - 1, y + P - 1], fill=random.choice([(255, 255, 255, 255), (196, 213, 234, 255)]))
    for ox, oy, col in stars:
        for j, row in enumerate(STAR):
            for i, ch in enumerate(row):
                if ch != ".":
                    d.rectangle([ox + i * P, oy + j * P, ox + i * P + P - 1, oy + j * P + P - 1],
                                fill=(255, 255, 255, 255) if ch == "w" else col)
    return bg


S = 640
m = Image.open(MASCOT)

bust = background(S, 8, 11, [(70, 120, (245, 195, 59, 255)), (520, 90, (245, 195, 59, 255)),
                             (40, 330, (224, 45, 45, 255)), (555, 300, (79, 143, 240, 255))])
b = m.crop((0, 0, 37, 44))
b = b.resize((b.width * 13, b.height * 13), Image.NEAREST)
bust.alpha_composite(b, ((S - b.width) // 2 - 6, S - b.height + 20))
bust.convert("RGB").save(HERE / "avatar.png")

full = background(S, 7, 5, [(95, 150, (245, 195, 59, 255)), (490, 120, (245, 195, 59, 255)),
                            (500, 330, (79, 143, 240, 255)), (70, 360, (224, 45, 45, 255))])
f = m.resize((m.width * 7, m.height * 7), Image.NEAREST)
full.alpha_composite(f, ((S - f.width) // 2, (S - f.height) // 2 + 20))
full.convert("RGB").save(HERE / "avatar-full.png")
print("ok")
