"""Builds the Farm Portfolio icon set.

App icons (shown when the page is installed as an app from Chrome / Android /
iOS) come from the owner's PREMIUM badge, scripts/assets/premium-badge.png,
placed on the app's dark ground. The small favicon and the header logo keep the
HARVEST FARM crest from sysall16.jpg.

Run from anywhere:  python scripts/make_portfolio_icons.py
"""
import collections
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "portfolio", "icons")
BADGE = os.path.join(ROOT, "scripts", "assets", "premium-badge.png")
LOGO = os.path.join(ROOT, "scripts", "assets", "forexcool-logo.png")
CREST = os.path.join(ROOT, "sysall16.jpg")
BG = (13, 17, 23)


def cut_white(path, tolerance=30):
    """Drop the flat background: flood fill from the four corners."""
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = [[False] * h for _ in range(w)]
    q = collections.deque()
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        q.append((x, y))
        seen[x][y] = True
    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        if min(r, g, b) < 255 - tolerance:
            continue
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny]:
                seen[nx][ny] = True
                q.append((nx, ny))
    box = im.split()[3].getbbox()
    return im.crop(box)


def icon_from(art, size, fill, sharpen=True, bg=None):
    canvas = Image.new("RGBA", (size, size), (bg or BG) + (255,))
    inner = max(1, int(size * fill))
    a = art.resize((inner, inner), Image.LANCZOS).convert("RGBA")
    if sharpen and inner > art.size[0]:
        a = a.filter(ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=2))
    canvas.alpha_composite(a, ((size - inner) // 2, (size - inner) // 2))
    return canvas.convert("RGB")


def crest_art():
    im = Image.open(CREST).convert("RGB")
    cx, cy, side = 1436, 545, 600
    return im.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2))


def main():
    os.makedirs(OUT, exist_ok=True)
    # the app icon is the supplied FOREXCOOL badge itself: square it on its own
    # navy plate colour, and keep it inside the maskable safe zone
    plate = Image.open(LOGO).convert("RGB")
    plate_colour = plate.getpixel((6, 160))
    side = max(plate.size)
    squared = Image.new("RGB", (side, side), plate_colour)
    squared.paste(plate, ((side - plate.size[0]) // 2, (side - plate.size[1]) // 2))
    print("app icon from the logo", squared.size, "plate", plate_colour)

    icon_from(squared, 512, 1.0, sharpen=False).save(os.path.join(OUT, "icon-512.png"), optimize=True)
    icon_from(squared, 192, 1.0, sharpen=False).save(os.path.join(OUT, "icon-192.png"), optimize=True)
    icon_from(squared, 512, 0.78, sharpen=False, bg=plate_colour).save(os.path.join(OUT, "icon-maskable-512.png"), optimize=True)
    icon_from(squared, 180, 1.0, sharpen=False).save(os.path.join(OUT, "apple-touch-icon.png"), optimize=True)

    # header mark: the FOREXCOOL lockup (chart + wordmark) with the navy plate
    # flood-filled to transparent; the square badge itself becomes the tab icon
    logo = Image.open(LOGO).convert("RGB")
    lock = logo.crop((32, 80, 304, 212)).convert("RGBA")
    lw, lh = lock.size
    lp = lock.load()

    def navy(r, g, b):
        return b < 130 and r < 80 and g < 105 and b >= g

    seen = [[False] * lh for _ in range(lw)]
    q = collections.deque()
    for x in range(lw):
        for y in (0, lh - 1):
            seen[x][y] = True
            q.append((x, y))
    for y in range(lh):
        for x in (0, lw - 1):
            if not seen[x][y]:
                seen[x][y] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        if not navy(*lp[x, y][:3]):
            continue
        r, g, b, _ = lp[x, y]
        lp[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < lw and 0 <= ny < lh and not seen[nx][ny]:
                seen[nx][ny] = True
                q.append((nx, ny))
    lock = lock.crop(lock.split()[3].getbbox())
    lock.save(os.path.join(OUT, "brand-fc-v2.png"), optimize=True)

    badge_sq = Image.open(LOGO).convert("RGBA")
    for size, name in ((64, "favicon-64.png"), (32, "favicon-32.png")):
        badge_sq.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)

    crest = crest_art()
    rounded = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    inner = crest.resize((88, 88), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (88, 88), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 87, 87], radius=18, fill=255)
    rounded.paste(inner, (4, 4), mask)
    rounded.save(os.path.join(OUT, "logo-96.png"), optimize=True)

    for f in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, f)
        print("%-26s %7d bytes" % (f, os.path.getsize(p)))

    sheet = Image.new("RGB", (4 * 190 + 20, 210), (45, 45, 48))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]):
        ic = Image.open(os.path.join(OUT, f)).convert("RGB").resize((150, 150), Image.LANCZOS)
        sheet.paste(ic, (20 + i * 190, 40))
        d.text((20 + i * 190, 20), f, fill=(225, 225, 225))
    prev = os.path.join(os.environ.get("TEMP", "."), "premium_icons.png")
    sheet.save(prev)
    print(prev)


if __name__ == "__main__":
    main()
