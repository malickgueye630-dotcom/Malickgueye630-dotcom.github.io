#!/usr/bin/env python3
"""Génère les icônes de l'application (dégradé émeraude, croissant doré, étoile)."""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'nour/icons')
OUT.mkdir(parents=True, exist_ok=True)

S = 1024
GOLD = (222, 186, 84)


def gradient():
    img = Image.new('RGB', (S, S))
    d = ImageDraw.Draw(img)
    c1, c2 = (11, 48, 43), (26, 125, 102)
    for y in range(S):
        t = y / S
        d.line([(0, y), (S, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(c1, c2)))
    d2 = ImageDraw.Draw(img, 'RGBA')
    for cx in range(0, S + 256, 256):
        for cy in range(0, S + 256, 256):
            pts = []
            for i in range(16):
                ang = i * math.pi / 8
                rad = 92 if i % 2 == 0 else 37
                pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
            d2.polygon(pts, outline=(255, 255, 255, 16))
    return img


def star_points(cx, cy, r, n=5, inner=0.42, rot=-math.pi / 2):
    pts = []
    for i in range(n * 2):
        ang = rot + i * math.pi / n
        rad = r if i % 2 == 0 else r * inner
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return pts


img = gradient()

# croissant : cercle plein moins cercle décalé, via masque
mask = Image.new('L', (S, S), 0)
md = ImageDraw.Draw(mask)
cx, cy, R = S * 0.47, S * 0.52, S * 0.285
md.ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
hx, hy, Rh = cx + R * 0.40, cy - R * 0.16, R * 0.88
md.ellipse([hx - Rh, hy - Rh, hx + Rh, hy + Rh], fill=0)

gold_layer = Image.new('RGB', (S, S), GOLD)
img = Image.composite(gold_layer, img, mask)

# étoile à 5 branches dans le creux du croissant
d = ImageDraw.Draw(img)
d.polygon(star_points(S * 0.635, S * 0.40, S * 0.085), fill=GOLD)

img.resize((512, 512), Image.LANCZOS).save(OUT / 'icon-512.png')
img.resize((192, 192), Image.LANCZOS).save(OUT / 'icon-192.png')
img.resize((180, 180), Image.LANCZOS).save(OUT / 'apple-touch-icon.png')
img.resize((512, 512), Image.LANCZOS).save(OUT / 'maskable-512.png')
print('icônes générées dans', OUT)
