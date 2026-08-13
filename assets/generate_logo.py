"""Generate an ORIGINAL placeholder logo for EPIC x GEA (temporary).

Design concept (original, not copied from any real EPIC/GEA logo):
  - A rounded navy badge.
  - Two stacked geometric marks: an upward chevron (E/EPIC) and a circle/gear
    accent (GEA), joined by an "x" to represent the EPIC x GEA partnership.
  - Text "EPIC x GEA" rendered below the mark.
This is intentionally generic and meant to be replaced by the official logo.
"""

import os
from PIL import Image, ImageDraw, ImageFont

SIZE = 512
OUT = os.path.join(os.path.dirname(__file__), "logo-epic-gea.png")

NAVY = (15, 42, 67)
NAVY2 = (28, 84, 136)
WHITE = (255, 255, 255)
AMBER = (217, 154, 0)
GREEN = (31, 122, 77)


def load_font(size, bold=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    return ImageFont.load_default()


def rounded_panel(img, box, radius, fill):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=radius, fill=fill)


def main():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded navy badge background.
    pad = 24
    rounded_panel(img, [pad, pad, SIZE - pad, SIZE - pad], radius=64, fill=NAVY)

    cx = SIZE // 2

    # --- Two geometric marks: EPIC (chevron) and GEA (ring) ---
    mark_y = 180
    gap = 70

    # EPIC mark: two upward chevrons forming an "E-ish" upward arrow.
    chev_cx = cx - gap
    chev_w = 70
    chev_h = 36
    for i, y in enumerate([mark_y - chev_h // 2 - 4, mark_y + chev_h // 2 + 4]):
        d.polygon([
            (chev_cx - chev_w // 2, y),
            (chev_cx + chev_w // 2, y),
            (chev_cx, y - chev_h // 2 + (8 if i == 0 else 0)),
        ], fill=WHITE)

    # "x" connector in amber.
    font_x = load_font(64, bold=True)
    d.text((cx - 14, mark_y - 38), "x", font=font_x, fill=AMBER)

    # GEA mark: a ring with inner gear-like dots.
    ring_cx = cx + gap
    ring_r = 42
    d.ellipse([ring_cx - ring_r, mark_y - ring_r, ring_cx + ring_r, mark_y + ring_r],
              outline=WHITE, width=10)
    d.ellipse([ring_cx - 12, mark_y - 12, ring_cx + 12, mark_y + 12], fill=GREEN)
    for ang in range(0, 360, 60):
        import math
        rad = math.radians(ang)
        px = ring_cx + int(math.cos(rad) * (ring_r - 6))
        py = mark_y + int(math.sin(rad) * (ring_r - 6))
        d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=NAVY2)

    # --- Wordmark: EPIC x GEA ---
    font_main = load_font(74, bold=True)
    text = "EPIC x GEA"
    bbox = d.textbbox((0, 0), text, font=font_main)
    tw = bbox[2] - bbox[0]
    d.text(((SIZE - tw) // 2 - bbox[0], 300), text, font=font_main, fill=WHITE)

    # Subline.
    font_sub = load_font(28, bold=False)
    sub = "STOCK OPNAME"
    bbox2 = d.textbbox((0, 0), sub, font=font_sub)
    sw = bbox2[2] - bbox2[0]
    d.text(((SIZE - sw) // 2 - bbox2[0], 392), sub, font=font_sub, fill=AMBER)

    # Thin divider lines beside subline.
    d.line([(SIZE // 2 - sw // 2 - 24, 406), (SIZE // 2 - sw // 2 - 8, 406)], fill=AMBER, width=2)
    d.line([(SIZE // 2 + sw // 2 + 8, 406), (SIZE // 2 + sw // 2 + 24, 406)], fill=AMBER, width=2)

    img.save(OUT, "PNG")
    print("Saved", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
