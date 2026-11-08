"""Video arah lokasi ke GLASS HALL by Lugar de la Boda (1080x1920, 30fps).

Guna: python3 buat_video.py  -> hasilkan glass-hall-lokasi.mp4
"""
import math
import os
import subprocess

import qrcode
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FOTO = os.path.join(HERE, "foto")
OUT = os.path.join(HERE, "glass-hall-lokasi.mp4")
W, H, FPS = 1080, 1920, 30

MAPS_URL = (
    "https://maps.google.com/?q=GLASS+HALL+by+LUGAR+DE+LA+BODA,"
    "+Taman+Puchong+Prima,+Puchong,+Selangor"
    "&ftid=0x31cdb3b19541cae5:0x11e81b78db69fa82"
)

# Palet
NAVY = (13, 24, 41)
NAVY2 = (24, 40, 66)
GOLD = (245, 184, 46)
WHITE = (255, 255, 255)
MUTED = (178, 192, 214)
RED = (232, 72, 72)

FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
_fc = {}


def font(size, bold=True):
    k = (size, bold)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(FB if bold else FR, size)
    return _fc[k]


def ease(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def text_c(d, cx, y, s, f, fill):
    w = d.textlength(s, font=f)
    d.text((cx - w / 2, y), s, font=f, fill=fill)


def wrap(d, s, f, maxw):
    lines, cur = [], ""
    for word in s.split():
        t = (cur + " " + word).strip()
        if d.textlength(t, font=f) <= maxw:
            cur = t
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def pin(d, cx, cy, r, color=GOLD, hole=NAVY):
    """Ikon pin lokasi."""
    d.polygon([(cx - r * 0.82, cy + r * 0.45), (cx + r * 0.82, cy + r * 0.45), (cx, cy + r * 2.0)], fill=color)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    d.ellipse([cx - r * 0.42, cy - r * 0.42, cx + r * 0.42, cy + r * 0.42], fill=hole)


def check_icon(d, x, y, s=40):
    d.ellipse([x, y, x + s, y + s], fill=GOLD)
    d.line([(x + s * 0.27, y + s * 0.52), (x + s * 0.44, y + s * 0.7), (x + s * 0.75, y + s * 0.32)], fill=NAVY, width=5)


def overlay_alpha(base, layer, a):
    """Tampal 'layer' (RGBA) ke atas 'base' dengan kelegapan a."""
    if a <= 0:
        return
    if a < 1:
        al = layer.getchannel("A").point(lambda v: int(v * a))
        layer = layer.copy()
        layer.putalpha(al)
    base.alpha_composite(layer)


# ---------------------------------------------------------------- Langkah
STEPS = [
    {
        "img": "1-jalan-utama.jpg",
        "title": "Ikut jalan utama Taman Puchong Prima",
        "sub": "Cari deretan pokok besar & menara telco putih",
        "target": (0.388, 0.553),
        "label": "Papan Glass Hall di sini",
        "tips": ["Lokasi di tepi jalan utama, sebelah kanan foto", "Papan kuning-hitam CAR WASH jadi penanda"],
    },
    {
        "img": "2-simpang-blok-a.jpg",
        "title": "Mercu tanda: simpang Flat Blok A",
        "sub": "Glass Hall di sebelah kiri simpang masuk flat",
        "target": (0.82, 0.32),
        "label": "Flat Blok A",
        "target2": (0.27, 0.47),
        "label2": "Glass Hall di sini",
        "tips": ["Ada palang & pondok pengawal di simpang", "Jangan masuk simpang flat — berhenti sebelumnya"],
    },
    {
        "img": "3-carwash.jpg",
        "title": "Nampak D'Tapak Car Wash",
        "sub": "Banner biru 'CAR WASH DIBUKA' di tepi jalan",
        "target": (0.47, 0.49),
        "label": "D'Tapak Car Wash",
        "target2": (0.17, 0.57),
        "label2": "Papan Glass Hall",
        "tips": ["Gerai Ayu Western & Jelita Seafood bersebelahan", "Glass Hall terletak di sebelah kiri car wash"],
    },
    {
        "img": "4-papan-tanda.jpg",
        "title": "Ikut papan tanda GLASS HALL",
        "sub": "Papan putih 'Lugar de la Boda' dengan anak panah merah",
        "target": (0.345, 0.66),
        "label": "Masuk ikut anak panah",
        "tips": ["Wedding Hall · Event Space · Corporate Event", "Parkir di tepi jalan berhampiran"],
    },
]

PH_Y, PH_H = 470, 810  # panel foto


def load_photo(name):
    im = Image.open(os.path.join(FOTO, name)).convert("RGB")
    # Seragamkan saiz kepada 4:3 2016x1512 untuk kelajuan
    return im.resize((2016, 1512), Image.LANCZOS)


def kenburns(im, t, target, zmax=1.28):
    """Pulangkan (panel 1080x810, fungsi map koordinat normal -> panel)."""
    iw, ih = im.size
    z = 1 + (zmax - 1) * ease(t)
    cw, ch = iw / z, ih / z
    tx, ty = target[0] * iw, target[1] * ih
    # Gerak pusat dari tengah ke sasaran
    k = ease(t)
    cx = iw / 2 + (tx - iw / 2) * k
    cy = ih / 2 + (ty - ih / 2) * k
    x0 = min(max(cx - cw / 2, 0), iw - cw)
    y0 = min(max(cy - ch / 2, 0), ih - ch)
    crop = im.resize((W, PH_H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))

    def mp(p):
        return ((p[0] * iw - x0) / cw * W, (p[1] * ih - y0) / ch * PH_H)

    return crop, mp


def callout(d, x, y, label, t, color=GOLD, below=False):
    """Cincin berdenyut + label."""
    a = ease(t * 2.5)
    if a <= 0:
        return
    pulse = (t * 2.2) % 1
    r = 58
    rr = r + 50 * pulse
    alpha = int(255 * (1 - pulse) * a)
    d.ellipse([x - rr, y - rr, x + rr, y + rr], outline=color + (alpha,), width=6)
    d.ellipse([x - r, y - r, x + r, y + r], outline=color + (int(255 * a),), width=8)
    f = font(34)
    tw = d.textlength(label, font=f)
    bw, bh = tw + 44, 64
    ly = y + 95 if below else y - 95 - bh
    lx = min(max(x - bw / 2, 20), W - bw - 20)
    ly = min(max(ly, PH_Y + 15), PH_Y + PH_H - bh - 15)
    lyc = ly + (0 if below else bh)
    d.line([(x, y + (r if below else -r)), (x, lyc)], fill=color + (int(255 * a),), width=5)
    d.rounded_rectangle([lx, ly, lx + bw, ly + bh], radius=18, fill=color + (int(240 * a),))
    d.text((lx + 22, ly + 13), label, font=f, fill=NAVY + (int(255 * a),))


def progress(d, cur, a=1.0):
    y = 1800
    xs = [190 + i * 233 for i in range(4)]
    d.line([(xs[0], y), (xs[-1], y)], fill=NAVY2, width=8)
    if cur > 0:
        d.line([(xs[0], y), (xs[cur - 1], y)], fill=GOLD, width=8)
    for i, x in enumerate(xs):
        done = i < cur
        r = 30 if i == cur - 1 else 22
        d.ellipse([x - r, y - r, x + r, y + r], fill=GOLD if done else NAVY2, outline=GOLD, width=4)
        f = font(26 if i == cur - 1 else 22)
        text_c(d, x, y - 15 if i == cur - 1 else y - 13, str(i + 1), f, NAVY if done else MUTED)
    # Pin destinasi di hujung
    pin(d, xs[-1] + 110, y - 40, 22, RED, NAVY)


def header(d):
    d.rectangle([0, 0, W, 110], fill=NAVY2)
    pin(d, 70, 38, 20)
    d.text((110, 30), "GLASS HALL", font=font(40), fill=WHITE)
    d.text((400, 42), "by Lugar de la Boda", font=font(28, False), fill=MUTED)


def step_frame(i, step, im, t, dur):
    p = t / dur
    base = Image.new("RGBA", (W, H), NAVY + (255,))
    d = ImageDraw.Draw(base)
    header(d)

    # Tajuk langkah
    a = ease(t / 0.6)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    off = int((1 - a) * 40)
    ld.ellipse([50, 160 + off, 160, 270 + off], fill=GOLD)
    text_c(ld, 105, 177 + off, str(i + 1), font(64), NAVY)
    ld.text((190, 150 + off), f"LANGKAH {i + 1} / 4", font=font(30), fill=GOLD)
    y = 192 + off
    for line in wrap(ld, step["title"], font(48), W - 230):
        ld.text((190, y), line, font=font(48), fill=WHITE)
        y += 60
    for line in wrap(ld, step["sub"], font(32, False), W - 230):
        ld.text((190, y + 8), line, font=font(32, False), fill=MUTED)
        y += 42
    overlay_alpha(base, lay, a)

    # Foto + Ken Burns
    panel, mp = kenburns(im, p, step["target"])
    base.paste(panel, (0, PH_Y))
    d.rectangle([0, PH_Y - 6, W, PH_Y - 1], fill=GOLD)
    d.rectangle([0, PH_Y + PH_H, W, PH_Y + PH_H + 5], fill=GOLD)

    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    x, yy = mp(step["target"])
    callout(od, x, PH_Y + yy, step["label"], max(0, t - 0.5) / dur * 2.2)
    if "target2" in step:
        x2, y2 = mp(step["target2"])
        callout(od, x2, PH_Y + y2, step["label2"], max(0, t - 1.6) / dur * 2.2, WHITE, below=True)
    base.alpha_composite(ov)

    # Kad tip
    for k, tip in enumerate(step["tips"]):
        ta = ease((t - 0.8 - k * 0.35) / 0.5)
        if ta <= 0:
            continue
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        cy = 1345 + k * 165
        dx = int((1 - ta) * 80)
        ld.rounded_rectangle([40 + dx, cy, W - 40 + dx, cy + 140], radius=26, fill=NAVY2)
        check_icon(ld, 75 + dx, cy + 48, 46)
        lines = wrap(ld, tip, font(34, False), W - 220)
        ty = cy + 70 - len(lines) * 21
        for line in lines:
            ld.text((145 + dx, ty), line, font=font(34, False), fill=WHITE)
            ty += 42
        overlay_alpha(base, lay, ta)

    progress(d, i + 1)
    return base


# ---------------------------------------------------------------- Intro
def intro_frame(bg, t, dur):
    z = 1 + 0.08 * (t / dur)
    bw, bh = bg.size
    cw, ch = bw / z, bh / z
    frame = bg.resize((W, H), Image.BILINEAR, box=((bw - cw) / 2, (bh - ch) / 2, (bw + cw) / 2, (bh + ch) / 2)).convert("RGBA")
    d = ImageDraw.Draw(frame)

    a1 = ease(t / 0.7)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    py = 430 - int((1 - a1) * 120)
    pin(ld, W // 2, py, 85)
    text_c(ld, W // 2, 690, "PANDUAN ARAH KE", font(44), GOLD)
    text_c(ld, W // 2, 760, "GLASS HALL", font(118), WHITE)
    text_c(ld, W // 2, 905, "by Lugar de la Boda", font(50, False), WHITE)
    overlay_alpha(frame, lay, a1)

    a2 = ease((t - 0.6) / 0.6)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    ld.rounded_rectangle([110, 1020, W - 110, 1110], radius=45, fill=GOLD)
    text_c(ld, W // 2, 1043, "Taman Puchong Prima, Puchong", font(38), NAVY)
    text_c(ld, W // 2, 1135, "Selangor", font(36, False), MUTED)
    overlay_alpha(frame, lay, a2)

    a3 = ease((t - 1.2) / 0.6)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    chips = ["Wedding Hall", "Event Space", "Corporate Event"]
    f = font(30)
    ws = [ld.textlength(c, font=f) + 50 for c in chips]
    x = (W - sum(ws) - 20 * (len(ws) - 1)) / 2
    for c, cw_ in zip(chips, ws):
        ld.rounded_rectangle([x, 1270, x + cw_, 1335], radius=32, outline=WHITE, width=3)
        ld.text((x + 25, 1285), c, font=f, fill=WHITE)
        x += cw_ + 20
    text_c(ld, W // 2, 1560, "4 langkah mudah  •  ikut mercu tanda", font(34), GOLD)
    overlay_alpha(frame, lay, a3)
    return frame


# ---------------------------------------------------------------- Penutup
def outro_frame(qr_img, t, dur):
    base = Image.new("RGBA", (W, H), NAVY + (255,))
    d = ImageDraw.Draw(base)
    header(d)
    a = ease(t / 0.6)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    text_c(ld, W // 2, 160, "ANDA DAH SAMPAI!", font(72), GOLD)
    text_c(ld, W // 2, 255, "Peta ringkas kawasan", font(34, False), MUTED)
    overlay_alpha(base, lay, a)

    # Peta skematik
    m = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    md = ImageDraw.Draw(m)
    md.rounded_rectangle([40, 320, W - 40, 1060], radius=30, fill=NAVY2)
    # Jalan utama
    md.rectangle([40, 860, W - 40, 980], fill=(70, 80, 96))
    for x in range(70, W - 40, 90):
        md.rectangle([x, 916, x + 45, 924], fill=WHITE)
    text_c(md, W // 2, 990, "JALAN UTAMA TAMAN PUCHONG PRIMA", font(26), MUTED)
    # Jalan masuk flat
    md.rectangle([700, 340, 790, 860], fill=(70, 80, 96))
    for yy in range(800, 860, 14):
        md.rectangle([705, yy, 785, yy + 7], fill=WHITE)
    # Flat Blok A
    md.rounded_rectangle([820, 400, 1010, 770], radius=12, fill=(214, 168, 130))
    for r_ in range(5):
        for c_ in range(3):
            md.rectangle([845 + c_ * 55, 425 + r_ * 65, 875 + c_ * 55, 460 + r_ * 65], fill=(150, 110, 85))
    text_c(md, 915, 785, "Flat Blok A", font(30), WHITE)
    # Car wash
    md.rounded_rectangle([430, 620, 660, 800], radius=12, fill=(30, 30, 30), outline=GOLD, width=4)
    text_c(md, 545, 670, "D'TAPAK", font(30), WHITE)
    text_c(md, 545, 712, "CAR WASH", font(32), GOLD)
    # Menara telco
    md.rectangle([300, 420, 316, 800], fill=WHITE)
    md.rectangle([292, 420, 324, 470], fill=(200, 205, 215))
    text_c(md, 308, 380, "Menara telco", font(24, False), MUTED)
    # Glass Hall (destinasi)
    pa = ease((t - 0.5) / 0.6)
    bounce = abs(math.sin(t * 4)) * 14 * pa
    pin(md, 170, 560 - bounce, 58, RED, WHITE)
    md.rounded_rectangle([60, 700, 285, 800], radius=16, fill=WHITE)
    text_c(md, 172, 712, "GLASS", font(34), NAVY)
    text_c(md, 172, 752, "HALL", font(34), NAVY)
    # Anak panah laluan
    md.line([(1000, 945), (220, 945)], fill=GOLD, width=10)
    md.polygon([(200, 945), (235, 925), (235, 965)], fill=GOLD)
    md.line([(172, 935), (172, 815)], fill=GOLD, width=10)
    md.polygon([(172, 805), (152, 840), (192, 840)], fill=GOLD)
    text_c(md, W // 2, 1028, "* Ilustrasi sahaja, bukan mengikut skala", font(22, False), MUTED)
    overlay_alpha(base, m, ease((t - 0.2) / 0.6))

    # QR
    qa = ease((t - 0.9) / 0.6)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    ld.rounded_rectangle([40, 1110, W - 40, 1700], radius=30, fill=WHITE)
    lay.paste(qr_img, (80, 1150))
    ld.text((610, 1170), "IMBAS UNTUK", font=font(36), fill=NAVY)
    ld.text((610, 1215), "GOOGLE MAPS", font=font(44), fill=RED)
    yy = 1300
    for s in ["Cari di Maps:", "“GLASS HALL by", "LUGAR DE LA BODA”", "Taman Puchong Prima"]:
        ld.text((610, yy), s, font=font(28, s.startswith("Cari") is False), fill=NAVY)
        yy += 44
    ld.text((610, 1500), "Mercu tanda:", font=font(28), fill=RED)
    ld.text((610, 1540), "Flat Blok A • Car Wash", font=font(26, False), fill=NAVY)
    overlay_alpha(base, lay, qa)

    a4 = ease((t - 1.5) / 0.6)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    text_c(ld, W // 2, 1760, "Jumpa anda di sana!", font(52), GOLD)
    overlay_alpha(base, lay, a4)
    return base


def fade(frame, t, dur, fin=0.3, fout=0.3):
    a = min(1, t / fin, (dur - t) / fout)
    if a >= 1:
        return frame
    black = Image.new("RGBA", frame.size, NAVY + (255,))
    return Image.blend(black, frame, max(0, a))


def main():
    intro_bg = load_photo("4-papan-tanda.jpg").resize((1440, 1080))
    # Latar intro: potong menegak, kabur & gelapkan
    intro_bg = intro_bg.crop((180, 0, 180 + 608, 1080)).resize((W, H), Image.LANCZOS)
    intro_bg = intro_bg.filter(ImageFilter.GaussianBlur(14))
    intro_bg = Image.blend(intro_bg, Image.new("RGB", (W, H), NAVY), 0.62)

    q = qrcode.QRCode(border=1, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(MAPS_URL)
    q.make(fit=True)
    qr_img = q.make_image(fill_color=(13, 24, 41), back_color="white").convert("RGBA").resize((500, 500), Image.NEAREST)

    scenes = [("intro", 4.0, None)]
    scenes += [("step", 5.5, (i, s, load_photo(s["img"]))) for i, s in enumerate(STEPS)]
    scenes += [("outro", 6.5, None)]
    total = sum(s[1] for s in scenes)

    subprocess.run(["python3", os.path.join(HERE, "muzik.py"), str(total), os.path.join(HERE, "muzik.wav")], check=True)

    ff = subprocess.Popen(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
            "-i", os.path.join(HERE, "muzik.wav"),
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
            OUT,
        ],
        stdin=subprocess.PIPE,
    )
    for kind, dur, data in scenes:
        nf = int(dur * FPS)
        for f in range(nf):
            t = f / FPS
            if kind == "intro":
                fr = intro_frame(intro_bg, t, dur)
            elif kind == "outro":
                fr = outro_frame(qr_img, t, dur)
            else:
                fr = step_frame(*data, t, dur)
            fr = fade(fr, t, dur, fout=0.3 if kind != "outro" else 1.0)
            ff.stdin.write(fr.convert("RGB").tobytes())
        print("siap:", kind, flush=True)
    ff.stdin.close()
    ff.wait()
    print("Video:", OUT, f"({total:.1f}s)")


if __name__ == "__main__":
    main()
