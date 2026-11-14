"""Анимации маскота в шапке из покадровых png (960x960, пиксель-арт ×~12.9).

  python gen_mascot_seq.py "~/Desktop/привет" "~/Desktop/танец 2"

Пишет в web/assets/mascot/:
  idle.png, blink.png — стоит / моргнул (кадр 0 «привета»), обрезано ровно по фигуре FIG
  hello.png, dance.png — листы кадров (палитра 16 цветов, NEAREST — края чёткие) (каждый 2-й кадр → 12.5 к/с), COLS в строке
Кадры анимаций обрезаны рамкой BOX; в app.js лист кладётся поверх idle со сдвигом
(BOX относительно FIG) — если меняешь рамки, поправь SEQ_BOX в app.js.
"""
import sys, os
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).parent.parent / "web/assets/mascot"
BOX = (23, -4, 925, 956)        # общая рамка обеих анимаций (+поля)
FIG = (254, 12, 706, 946)       # фигура в позе «руки скрещены»
SCALE = 4.3                      # 12.9 / 3 → в 3 раза крупнее «родного» пикселя
STEP, COLS = 2, 10
CW, CH = round((BOX[2] - BOX[0]) / SCALE), round((BOX[3] - BOX[1]) / SCALE)

def frame(im):
    return im.crop(BOX).resize((CW, CH), Image.NEAREST)

def blink(im):
    im = im.copy(); d = ImageDraw.Draw(im)
    for x0, x1 in ((448, 459), (499, 511)):          # глаза: 1 клетка шириной, 2 высотой
        d.rectangle((x0 - 2, 168, x1 + 2, 197), fill=(255, 255, 255, 255))
        d.rectangle((x0 - 7, 184, x1 + 7, 196), fill=(20, 20, 20, 255))
    return im

def load(folder, i):
    folder = Path(os.path.expanduser(folder))
    prefix = min((p.name for p in folder.glob("*00.png")), key=len)[:-6]
    return Image.open(folder / f"{prefix}{i:02d}.png").convert("RGBA")

def main(hello_dir, dance_dir):
    OUT.mkdir(parents=True, exist_ok=True)
    first = load(hello_dir, 0)
    fw, fh = round((FIG[2] - FIG[0]) / SCALE), round((FIG[3] - FIG[1]) / SCALE)
    for name, im in (("idle", first), ("blink", blink(first))):
        im.crop(FIG).resize((fw, fh), Image.NEAREST).quantize(16, method=Image.FASTOCTREE).save(OUT / f"{name}.png", optimize=True)
    for name, folder in (("hello", hello_dir), ("dance", dance_dir)):
        idx = list(range(0, 150, STEP))
        rows = (len(idx) + COLS - 1) // COLS
        sheet = Image.new("RGBA", (CW * COLS, CH * rows))
        for k, i in enumerate(idx):
            sheet.paste(frame(load(folder, i)), ((k % COLS) * CW, (k // COLS) * CH))
        sheet.quantize(16, method=Image.FASTOCTREE).save(OUT / f"{name}.png", optimize=True)
        print(name, len(idx), "кадров", sheet.size, (OUT / f"{name}.png").stat().st_size // 1024, "КБ")
    print("кадр", CW, "x", CH)

if __name__ == "__main__":
    main(*sys.argv[1:3])
