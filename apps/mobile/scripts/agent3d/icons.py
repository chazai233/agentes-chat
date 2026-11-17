"""Baiyu Bot's launcher icons: the white 3D agent on a soft ground, in five colourways."""
import sys
from PIL import Image
ROOT, HERO, NOTIF = sys.argv[1:4]
S = 1024
GROUNDS = {  # top, bottom
    "night": ((255, 236, 226), (250, 204, 192)),      # the mark's own warm tile (the icon the app ships with)
    "moon": ((240, 236, 252), (214, 206, 244)),
    "sky": ((214, 234, 255), (160, 200, 250)),
    "peekNight": ((52, 60, 96), (24, 28, 52)),
    "peekSky": ((216, 244, 232), (168, 222, 204)),
}
def ground(top, bottom):
    im = Image.new("RGB", (S, S)); px = im.load()
    for y in range(S):
        t = y / (S - 1); c = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(S): px[x, y] = c
    return im
hero = Image.open(HERO).convert("RGBA")
hero = hero.crop(hero.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox())
def placed(width, dy=0):
    w = int(S * width); h = int(hero.height * w / hero.width)
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    layer.alpha_composite(hero.resize((w, h), Image.LANCZOS), ((S - w) // 2, (S - h) // 2 + dy))
    return layer
def mono(layer):
    """The figure alone in white: its solid part, with the eyes cut out."""
    out = Image.new("RGBA", layer.size, (0, 0, 0, 0)); src = layer.load(); dst = out.load()
    for y in range(layer.height):
        for x in range(layer.width):
            r, g, b, a = src[x, y]
            if a > 200 and (r + g + b) / 3 > 120: dst[x, y] = (255, 255, 255, 255)
    return out
fg = placed(0.44, 10)          # inside the adaptive icon's safe zone
big = placed(0.62, 14)
for name, (top, bottom) in GROUNDS.items():
    out = f"{ROOT}/{name}"
    bg = ground(top, bottom); bg.save(f"{out}/android-background.png")
    fg.save(f"{out}/android-foreground.png")
    mono(fg).save(f"{out}/android-monochrome.png")
    full = bg.convert("RGBA"); full.alpha_composite(big); full = full.convert("RGB"); full.save(f"{out}/ios.png")
    dark = ground((40, 44, 60), (16, 18, 28)).convert("RGBA"); dark.alpha_composite(big); dark = dark.convert("RGB")
    dark.save(f"{out}/ios-dark.png")
    tint = Image.new("RGBA", (S, S), (0, 0, 0, 255)); tint.alpha_composite(big); tint.convert("L").convert("RGB").save(f"{out}/ios-tinted.png")
    full.resize((180, 180), Image.LANCZOS).save(f"{out}/preview.png")
    dark.resize((180, 180), Image.LANCZOS).save(f"{out}/preview-dark.png")
m = mono(placed(0.8))
m.resize((96, 96), Image.LANCZOS).save(NOTIF)
