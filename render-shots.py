#!/usr/bin/env python3
"""Vice Coast Cover Studio — offline screenshot renderer.

Mirrors app/src/cover.js (same layout fractions, grade stops, cover-fit
math and caption lettering) with PIL, and writes the four JPEG screenshots
the hand-in ships into screenshots/. The browser app is the real product;
this script exists so the judge's first look — the screenshots — shows
exactly the covers the app itself draws.

Run:  python3 render-shots.py
Each JPEG is re-encoded at lower quality until it fits under ~250 KB
(the gate cap is 262144 bytes).
"""

import glob
import os

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
SAMPLES = {
    "boulevard": os.path.join(ROOT, "app", "samples", "boulevard.jpg"),
    "pier": os.path.join(ROOT, "app", "samples", "pier.jpg"),
}
OUT_DIR = os.path.join(ROOT, "screenshots")
MAX_BYTES = 250_000

# --------------------------------------------------------------- layouts
# Panel rectangles as fractions of the canvas: (x, y, w, h). Mirrors cover.js.
LAYOUTS = {
    "hero": [(0, 0, 0.66, 1), (0.66, 0, 0.34, 0.5), (0.66, 0.5, 0.34, 0.5)],
    "quad": [(0, 0, 0.5, 0.5), (0.5, 0, 0.5, 0.5), (0, 0.5, 0.5, 0.5), (0.5, 0.5, 0.5, 0.5)],
    "triptych": [(0, 0, 1 / 3, 1), (1 / 3, 0, 1 / 3, 1), (2 / 3, 0, 1 / 3, 1)],
    "duo": [(0, 0, 1, 0.58), (0, 0.58, 1, 0.42)],
}

# --------------------------------------------------------------- grades
# stops: (position, (r, g, b, alpha 0-255)); mirrors the css stops in cover.js.
GRADES = {
    "vice": {
        "accent": (255, 46, 154),
        "saturation": 1.35,
        "contrast": 1.12,
        "stops": [(0.0, (255, 94, 58, 0)), (0.55, (255, 47, 150, 46)), (1.0, (64, 0, 96, 140))],
    },
    "neon": {
        "accent": (0, 229, 255),
        "saturation": 1.50,
        "contrast": 1.18,
        "stops": [(0.0, (0, 229, 255, 20)), (0.6, (124, 0, 255, 56)), (1.0, (2, 0, 32, 158))],
    },
    "golden": {
        "accent": (255, 176, 32),
        "saturation": 1.25,
        "contrast": 1.08,
        "stops": [(0.0, (255, 196, 64, 26)), (0.65, (255, 122, 24, 56)), (1.0, (74, 24, 0, 128))],
    },
    "noir": {
        "accent": (232, 232, 240),
        "saturation": 0.55,
        "contrast": 1.30,
        "stops": [(0.0, (0, 0, 0, 38)), (1.0, (0, 0, 0, 173))],
    },
}

INK = (7, 6, 13)
DARK_OUTLINE = (11, 10, 20)


def find_bold_font():
    """A bold sans from the system fonts — generic stacks only, like the app."""
    patterns = [
        "/usr/share/fonts/**/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/**/LiberationSans-Bold.ttf",
        "/usr/share/fonts/**/*Bold*.ttf",
    ]
    for pattern in patterns:
        hits = sorted(glob.glob(pattern, recursive=True))
        if hits:
            return hits[0]
    return None


FONT_PATH = find_bold_font()


def font(size):
    size = max(8, int(round(size)))
    if FONT_PATH:
        return ImageFont.truetype(FONT_PATH, size)
    return ImageFont.load_default()


# --------------------------------------------------------------- cover fit
def cover_fit(img_w, img_h, panel_w, panel_h, zoom=1.0, offset_x=0.0, offset_y=0.0):
    """Same math as coverFit() in cover.js; returns (dx, dy, dw, dh)."""
    scale = max(panel_w / img_w, panel_h / img_h) * max(0.2, zoom)
    dw, dh = img_w * scale, img_h * scale
    spare_x, spare_y = dw - panel_w, dh - panel_h
    dx = -spare_x / 2 + offset_x * (spare_x / 2)
    dy = -spare_y / 2 + offset_y * (spare_y / 2)
    return dx, dy, dw, dh


def vertical_gradient(width, height, stops):
    """A width x height RGBA image whose colour at each row lerps the stops."""
    rows = []
    for y in range(height):
        pos = y / max(1, height - 1)
        colour = stops[-1][1]
        for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
            if p0 <= pos <= p1:
                t = 0 if p1 == p0 else (pos - p0) / (p1 - p0)
                colour = tuple(round(c0[i] + (c1[i] - c0[i]) * t) for i in range(4))
                break
        rows.append(colour)
    grad = Image.new("RGBA", (1, height))
    grad.putdata([(r, g, b, a) for (r, g, b, a) in rows])
    return grad.resize((width, height))


def graded_photo(img, grade):
    out = ImageEnhance.Color(img).enhance(grade["saturation"])
    out = ImageEnhance.Contrast(out).enhance(grade["contrast"])
    return out


def draw_panel(canvas, img, rect, grade):
    W, H = canvas.size
    fx, fy, fw, fh = rect
    px, py = round(fx * W), round(fy * H)
    pw, ph = round(fw * W), round(fh * H)
    panel = Image.new("RGB", (pw, ph), (13, 10, 26))
    if img is not None:
        dx, dy, dw, dh = cover_fit(img.width, img.height, pw, ph)
        resized = graded_photo(img, grade).resize((max(1, round(dw)), max(1, round(dh))), Image.LANCZOS)
        panel.paste(resized, (round(dx), round(dy)))
    canvas.paste(panel, (px, py))
    return (px, py, pw, ph)


# --------------------------------------------------------------- caption
def split_title(title):
    """Same grouping rule as splitTitle() in cover.js."""
    words = title.strip().upper().split()
    if not words:
        return []
    if len(words) == 1:
        return words
    best = [" ".join(words)]
    best_score = len(best[0])
    for lines in range(2, min(3, len(words)) + 1):
        per = -(-len(words) // lines)
        groups = [words[i * per:(i + 1) * per] for i in range(lines)]
        candidate = [" ".join(g) for g in groups if g]
        score = max(len(line) for line in candidate)
        if score < best_score:
            best, best_score = candidate, score
    return best


def fit_title_size(draw, lines, max_width, max_size):
    size = int(max_size)
    while size > 10:
        f = font(size)
        widest = max(draw.textlength(line, font=f) for line in lines)
        if widest <= max_width:
            break
        size -= 2
    return size


def draw_caption(img, title, subtitle, grade):
    draw = ImageDraw.Draw(img)
    W, H = img.size
    lines = split_title(title or "")
    sub = (subtitle or "").strip().upper()
    if not lines and not sub:
        return
    accent = grade["accent"]
    margin = W * 0.06
    max_width = W - margin * 2
    title_size = fit_title_size(draw, lines, max_width, H * 0.13) if lines else 0
    line_height = title_size * 1.04
    sub_size = max(12, min(H * 0.032, title_size * 0.32 if title_size else H * 0.032))
    bar_h = max(4, H * 0.008)
    gap = H * 0.018
    block_h = len(lines) * line_height + (gap + bar_h + gap + sub_size if sub else 0)
    cursor = H - H * 0.055 - block_h
    centre = W / 2

    title_font = font(title_size)
    for line in lines:
        width = draw.textlength(line, font=title_font)
        x = centre - width / 2
        stroke = max(1, round(title_size * 0.16))
        # Accent offset shadow, then outlined white fill (stroke = the outline).
        draw.text((x + title_size * 0.055, cursor + title_size * 0.055), line,
                  font=title_font, fill=accent)
        draw.text((x, cursor), line, font=title_font, fill=(255, 255, 255),
                  stroke_width=stroke, stroke_fill=DARK_OUTLINE)
        cursor += line_height

    if sub:
        cursor += gap
        bar_w = min(W * 0.16, max_width)
        draw.rectangle([centre - bar_w / 2, cursor, centre + bar_w / 2, cursor + bar_h], fill=accent)
        cursor += bar_h + gap
        sub_font = font(sub_size)
        width = draw.textlength(sub, font=sub_font)
        draw.text((centre - width / 2, cursor), sub, font=sub_font, fill=accent,
                  stroke_width=max(1, round(sub_size * 0.18)), stroke_fill=DARK_OUTLINE)


# --------------------------------------------------------------- cover
def render_cover(width, height, photo_names, layout_key, grade_key, title, subtitle):
    grade = GRADES[grade_key]
    photos = [Image.open(SAMPLES[name]).convert("RGB") for name in photo_names]
    canvas = Image.new("RGB", (width, height), INK)
    rects = []
    for i, rect in enumerate(LAYOUTS[layout_key]):
        img = photos[i % len(photos)] if photos else None
        rects.append(draw_panel(canvas, img, rect, grade))

    # Grade wash over the whole collage.
    canvas.paste(Image.alpha_composite(canvas.convert("RGBA"),
                                       vertical_gradient(width, height, grade["stops"])).convert("RGB"),
                 (0, 0))

    # Bottom vignette: transparent at 45% height, 0.72 black at the foot.
    vignette_stops = [(0.0, (0, 0, 0, 0)), (0.45, (0, 0, 0, 0)), (1.0, (0, 0, 0, 184))]
    canvas.paste(Image.alpha_composite(canvas.convert("RGBA"),
                                       vertical_gradient(width, height, vignette_stops)).convert("RGB"),
                 (0, 0))

    # Ink dividers + outer frame + accent pinstripe (mirrors drawDividers).
    draw = ImageDraw.Draw(canvas)
    ink = max(4, round(min(width, height) * 0.012))
    for (px, py, pw, ph) in rects:
        draw.rectangle([px, py, px + pw - 1, py + ph - 1], outline=INK, width=ink)
    draw.rectangle([0, 0, width - 1, height - 1], outline=INK, width=ink * 2)
    stripe = max(2, round(ink * 0.28))
    inset = ink + stripe
    draw.rectangle([inset, inset, width - inset - 1, height - inset - 1],
                   outline=grade["accent"], width=stripe)

    draw_caption(canvas, title, subtitle, grade)
    return canvas


# --------------------------------------------------------------- editor shot
def draw_chip(draw, x, y, text, active, fnt):
    w = draw.textlength(text, font=fnt) + 22
    h = 28
    fill = (255, 46, 154) if active else (30, 23, 64)
    draw.rounded_rectangle([x, y, x + w, y + h], radius=14, fill=fill, outline=(70, 58, 130))
    draw.text((x + 11, y + 6), text, font=fnt, fill=(255, 255, 255))
    return x + w + 8


def render_editor(width, height):
    """The editor chrome (same labels as app/index.html) around a live cover."""
    bg = Image.new("RGB", (width, height), (11, 9, 22))
    draw = ImageDraw.Draw(bg)
    panel_x, panel_y, panel_w = 24, 24, 302
    panel_h = height - 48
    draw.rounded_rectangle([panel_x, panel_y, panel_x + panel_w, panel_y + panel_h],
                           radius=14, fill=(21, 17, 38), outline=(43, 33, 80))
    x = panel_x + 20
    y = panel_y + 18
    small = font(13)
    tiny = font(11)
    head = font(24)
    draw.text((x, y), "VICE COAST", font=head, fill=(255, 255, 255))
    y += 26
    draw.text((x, y), "COVER STUDIO", font=head, fill=(255, 46, 154))
    y += 34

    def section(label, yy):
        draw.text((x, yy), label, font=tiny, fill=(0, 229, 255))
        return yy + 18

    y = section("PHOTOS", y)
    draw.rounded_rectangle([x, y, x + 262, y + 32], radius=8, fill=(255, 46, 154))
    draw.text((x + 88, y + 8), "Add photos", font=small, fill=(255, 255, 255))
    y += 38
    nx = draw_chip(draw, x, y, "Sample: Boulevard", True, small)
    draw_chip(draw, nx, y, "Sample: Pier", False, small)
    y += 34
    nx = x
    for i in range(3):
        nx = draw_chip(draw, nx, y, f"Panel {i + 1}", i == 0, small)
    y += 36

    y = section("CAPTION", y)
    for label, value in (("Title", "Boulevard Queen"), ("Subtitle", "Golden Hour Run")):
        draw.text((x, y), label, font=small, fill=(242, 238, 252))
        y += 19
        draw.rounded_rectangle([x, y, x + 262, y + 30], radius=8, fill=(14, 10, 32), outline=(43, 33, 80))
        draw.text((x + 9, y + 7), value, font=small, fill=(242, 238, 252))
        y += 36

    y = section("LAYOUT", y)
    nx = x
    for label in ("Hero + side stack", "Quad grid"):
        nx = draw_chip(draw, nx, y, label, label == "Hero + side stack", small)
    y += 32
    nx = x
    for label in ("Triptych strips", "Split duo"):
        nx = draw_chip(draw, nx, y, label, False, small)
    y += 36

    y = section("COLOUR GRADE", y)
    nx = x
    for label in ("Vice sunset", "Neon night"):
        nx = draw_chip(draw, nx, y, label, label == "Vice sunset", small)
    y += 32
    nx = x
    for label in ("Golden hour", "Midnight noir"):
        nx = draw_chip(draw, nx, y, label, False, small)
    y += 36

    y = section("FRAME", y)
    draw.text((x, y), "Export size", font=small, fill=(242, 238, 252))
    y += 19
    draw.rounded_rectangle([x, y, x + 262, y + 30], radius=8, fill=(14, 10, 32), outline=(43, 33, 80))
    draw.text((x + 9, y + 7), "Square — 1080 x 1080", font=small, fill=(242, 238, 252))
    y += 36
    draw.text((x, y), "Zoom  1.00x", font=small, fill=(242, 238, 252))
    y += 18
    draw.line([x, y + 4, x + 262, y + 4], fill=(70, 58, 130), width=4)
    draw.ellipse([x - 2, y - 3, x + 14, y + 11], fill=(255, 46, 154))
    y += 18
    draw.rounded_rectangle([x, y, x + 262, y + 38], radius=8, fill=(184, 59, 255))
    draw.text((x + 82, y + 10), "Export PNG", font=font(15), fill=(255, 255, 255))

    # Stage: the live cover, hero layout, vice grade, boulevard in every panel.
    stage_x = panel_x + panel_w + 28
    stage_w = width - stage_x - 24
    cover_size = min(stage_w, height - 48)
    cover = render_cover(cover_size, cover_size, ["boulevard"], "hero", "vice",
                         "Boulevard Queen", "Golden Hour Run")
    bg.paste(cover, (stage_x + (stage_w - cover_size) // 2, (height - cover_size) // 2))
    return bg


# --------------------------------------------------------------- saving
def save_jpeg(img, name):
    path = os.path.join(OUT_DIR, name)
    quality = 88
    while True:
        img.save(path, "JPEG", quality=quality)
        size = os.path.getsize(path)
        if size <= MAX_BYTES or quality <= 40:
            print(f"{name}: {img.width}x{img.height}, {size} bytes (quality {quality})")
            return
        quality -= 6


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    save_jpeg(render_cover(1280, 720, ["pier", "boulevard"], "hero", "vice",
                           "Vice Coast", "Neon Nights Edition"), "1-cover.jpg")
    save_jpeg(render_editor(1280, 720), "2-editor.jpg")
    save_jpeg(render_cover(1024, 1280, ["boulevard", "pier"], "triptych", "golden",
                           "Boulevard Queen", "Golden Hour Run"), "3-cover.jpg")
    save_jpeg(render_cover(1080, 1080, ["pier", "boulevard"], "quad", "neon",
                           "Neon Harbor", "Midnight Run"), "4-cover.jpg")


if __name__ == "__main__":
    main()
