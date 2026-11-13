# Genera los íconos de la extensión: python3 icons/make_icons.py
from PIL import Image, ImageDraw
import os
here = os.path.dirname(os.path.abspath(__file__))
for size in (16, 48, 128):
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s // 4, fill=(37, 211, 102, 255))
    # rayo
    w = s
    pts = [(0.58*w, 0.12*w), (0.26*w, 0.56*w), (0.47*w, 0.56*w), (0.40*w, 0.88*w), (0.74*w, 0.42*w), (0.53*w, 0.42*w)]
    d.polygon(pts, fill=(255, 255, 255, 255))
    img.resize((size, size), Image.LANCZOS).save(os.path.join(here, f"icon{size}.png"))
print("ok")
