"""画像まわりの共通処理（読影プログラム本体と、AIが使う道具 rt.py の両方で使う）。

numpy と Pillow だけで動く。AIの作業フォルダには rtlib.py という名前で写して置く
（rt.py はこのファイルを自分のフォルダから読む）。

座標の決まり
- 画素の位置は (row, col)＝(上からの行, 左からの列)。切り出し枠は [y0, y1, x0, x1]。
- スライス番号 k は 1 から。断面の法線方向の位置で並べた順（ビューアの番号とは違うことがある）。
- 患者座標は DICOM の LPS（+x＝患者の左、+y＝後方、+z＝頭側）。
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ───────────── 文字 ─────────────

FONT_FILES = [
    r"C:\Windows\Fonts\meiryo.ttc", r"C:\Windows\Fonts\YuGothM.ttc", r"C:\Windows\Fonts\msgothic.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc",
]
_fonts: dict[int, ImageFont.FreeTypeFont] = {}


def font(size: int):
    size = max(8, int(size))
    if size not in _fonts:
        f = None
        for p in FONT_FILES:
            if Path(p).exists():
                try:
                    f = ImageFont.truetype(p, size)
                    break
                except OSError:
                    continue
        _fonts[size] = f or ImageFont.load_default(size=size)
    return _fonts[size]


COLORS = {
    "yellow": (255, 221, 0), "red": (255, 60, 60), "cyan": (0, 220, 255), "pink": (255, 110, 200),
    "magenta": (255, 0, 255), "green": (60, 230, 90), "white": (255, 255, 255), "orange": (255, 150, 0),
    "blue": (80, 140, 255), "black": (0, 0, 0),
}


def color(name) -> tuple[int, int, int]:
    if isinstance(name, (list, tuple)) and len(name) == 3:
        return tuple(int(v) for v in name)  # type: ignore[return-value]
    return COLORS.get(str(name or "yellow").lower(), COLORS["yellow"])


# ───────────── 座標 ─────────────

AXIS_LABELS = {(0, +1): "患者の左", (0, -1): "患者の右", (1, +1): "後方", (1, -1): "前方", (2, +1): "頭側", (2, -1): "足側"}
SHORT = {"患者の左": "左", "患者の右": "右", "後方": "後", "前方": "前", "頭側": "上", "足側": "下", "外側": "外", "内側": "内"}


def plane_of(iop) -> str:
    r, c = np.array(iop[:3], float), np.array(iop[3:], float)
    return ["sagittal", "coronal", "axial"][int(np.argmax(np.abs(np.cross(r, c))))]


def normal_of(iop) -> np.ndarray:
    return np.cross(np.array(iop[:3], float), np.array(iop[3:], float))


def direction_label(vec, side: str | None = None) -> str:
    """方向ベクトルの解剖学的な呼び名。手足（side＝right/left）では左右を内側・外側に直す。"""
    v = np.asarray(vec, float)
    ax = int(np.argmax(np.abs(v)))
    sign = 1 if v[ax] > 0 else -1
    if ax == 0 and side in ("right", "left"):
        toward_left = sign > 0
        lateral = toward_left if side == "left" else not toward_left
        return "外側" if lateral else "内側"
    return AXIS_LABELS[(ax, sign)]


def screen_orientation(iop, side: str | None = None) -> dict:
    r, c = np.array(iop[:3], float), np.array(iop[3:], float)
    return {"right": direction_label(r, side), "left": direction_label(-r, side),
            "down": direction_label(c, side), "up": direction_label(-c, side)}


def pix2pat(geom: dict, k: int, row: float, col: float) -> np.ndarray:
    ipp = np.array(geom["ipp"][k - 1], float)
    iop = geom["iop"]
    r, c = np.array(iop[:3], float), np.array(iop[3:], float)
    ps_row, ps_col = geom["pixel_spacing"]
    return ipp + r * col * ps_col + c * row * ps_row


def pat2pix(geom: dict, p) -> tuple[int, float, float, float]:
    p = np.asarray(p, float)
    n = normal_of(geom["iop"])
    ipps = np.array(geom["ipp"], float)
    d = (p - ipps) @ n
    k0 = int(np.argmin(np.abs(d)))
    v = p - ipps[k0]
    iop = geom["iop"]
    r, c = np.array(iop[:3], float), np.array(iop[3:], float)
    ps_row, ps_col = geom["pixel_spacing"]
    return k0 + 1, float(v @ c / ps_row), float(v @ r / ps_col), float(d[k0])


# ───────────── シリーズ ─────────────

class Series:
    def __init__(self, sdir: Path):
        self.dir = Path(sdir)
        self.info = json.loads((self.dir / "info.json").read_text(encoding="utf-8"))
        self.geom = json.loads((self.dir / "geometry.json").read_text(encoding="utf-8"))
        self._vol = None

    @property
    def key(self) -> str:
        return self.info["key"]

    @property
    def is_volume(self) -> bool:
        return self.info.get("kind") == "volume"

    @property
    def n(self) -> int:
        return int(self.info["n"])

    @property
    def side(self) -> str | None:
        return self.info.get("side")

    def image(self, k: int) -> np.ndarray:
        if not 1 <= int(k) <= self.n:
            raise ValueError(f"{self.key} のスライス番号は 1〜{self.n} です（{k} は範囲外）")
        if self.is_volume:
            if self._vol is None:
                self._vol = np.load(self.dir / "volume.npy", mmap_mode="r")
            return np.asarray(self._vol[int(k) - 1], dtype=np.float32)
        return np.load(self.dir / f"img_{int(k):03d}.npy").astype(np.float32)

    def instance(self, k: int) -> int:
        if self.is_volume:
            return int(self.geom["instances"][k - 1])
        return int(self.geom["images"][k - 1]["instance"])

    def pixel_spacing(self, k: int = 1) -> list[float]:
        if self.is_volume:
            return [float(x) for x in self.geom["pixel_spacing"]]
        return [float(x) for x in self.geom["images"][k - 1]["pixel_spacing"]]

    def orientation(self) -> dict | None:
        if not self.is_volume:
            return None
        return screen_orientation(self.geom["iop"], self.side)


def load_series(work_dir: Path) -> dict[str, Series]:
    out: dict[str, Series] = {}
    root = Path(work_dir) / "series"
    if root.exists():
        for d in sorted(root.iterdir()):
            if (d / "info.json").exists():
                s = Series(d)
                out[s.key] = s
    return out


def find_series(series: dict[str, Series], name: str) -> Series:
    if name in series:
        return series[name]
    hits = [s for k, s in series.items() if k.startswith(name) or k.split("_")[0] == name]
    if len(hits) == 1:
        return hits[0]
    raise KeyError(f"シリーズ「{name}」が見つかりません。候補: {', '.join(series)}")


# ───────────── 濃淡 ─────────────

def window_of(arrays, p=(0.5, 99.6)) -> tuple[float, float]:
    flat = np.concatenate([np.asarray(a, np.float32).ravel()[::5] for a in arrays])
    lo, hi = np.percentile(flat, p)
    if hi <= lo:
        hi = lo + 1
    return float(lo), float(hi)


def to_u8(a: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return (np.clip((a - lo) / max(hi - lo, 1e-6), 0, 1) * 255).astype(np.uint8)


def parse_box(text) -> list[int] | None:
    if text is None or text == "":
        return None
    v = [int(round(float(x))) for x in (text if isinstance(text, (list, tuple)) else str(text).split(","))]
    if len(v) != 4 or v[1] <= v[0] or v[3] <= v[2]:
        raise ValueError("枠は y0,y1,x0,x1（上,下,左,右の画素）で、y0<y1・x0<x1 にしてください")
    return v


def clip_box(box, shape) -> list[int]:
    h, w = shape[:2]
    if not box:
        return [0, h, 0, w]
    y0, y1, x0, x1 = box
    y0, y1 = max(0, min(h - 1, y0)), max(1, min(h, y1))
    x0, x1 = max(0, min(w - 1, x0)), max(1, min(w, x1))
    if y1 <= y0 or x1 <= x0:
        raise ValueError(f"枠が画像の外です（画像は {h}×{w} 画素）")
    return [y0, y1, x0, x1]


def gray(s: Series, k: int, box=None, window=(0.5, 99.6), ref=None, usm: float = 0.0) -> Image.Image:
    """スライス k の切り出しを 8bit の画像に。ref（配列のリスト）を渡すとその濃淡範囲にそろえる。"""
    a = s.image(k)
    y0, y1, x0, x1 = clip_box(box, a.shape)
    c = a[y0:y1, x0:x1]
    lo, hi = window_of(ref if ref is not None else [a], window)
    img = Image.fromarray(to_u8(c, lo, hi), "L")
    if usm:
        img = img.filter(ImageFilter.UnsharpMask(radius=12, percent=int(usm * 100), threshold=0))
    return img


def _label(draw: ImageDraw.ImageDraw, xy, text: str, size: int = 14, fill=(255, 221, 0), bg=(0, 0, 0)):
    f = font(size)
    x, y = xy
    l, t, r, b = draw.textbbox((x, y), text, font=f)
    draw.rectangle([l - 2, t - 2, r + 2, b + 2], fill=bg)
    draw.text((x, y), text, font=f, fill=fill)


def scalebar(draw: ImageDraw.ImageDraw, w: int, h: int, px_per_mm: float, mm: float | None = None):
    if not px_per_mm or px_per_mm <= 0:
        return
    if mm is None:
        mm = next((m for m in (50, 20, 10, 5, 2, 1) if m * px_per_mm <= w * 0.3), 1)
    L = int(round(mm * px_per_mm))
    x1, y = w - 12, h - 12
    x0 = x1 - L
    draw.line([(x0, y), (x1, y)], fill=(255, 255, 255), width=4)
    draw.line([(x0, y - 6), (x0, y + 2)], fill=(255, 255, 255), width=2)
    draw.line([(x1, y - 6), (x1, y + 2)], fill=(255, 255, 255), width=2)
    fs = 14 if w < 420 else 20
    _label(draw, (x0, y - fs - 12), f"{mm:g} mm", fs, fill=(255, 255, 255))


def montage(s: Series, ks=None, box=None, cols: int = 6, tile: int = 256, window=(0.5, 99.6),
            local: bool = False, usm: float = 0.0) -> Image.Image:
    """連続スライスの一覧。同じ切り出し枠・同じ拡大率・同じ濃淡で並べる（連続評価の基本）。"""
    ks = list(ks or range(1, s.n + 1))
    arrays = [s.image(k) for k in ks]
    if local and box:
        y0, y1, x0, x1 = clip_box(box, arrays[0].shape)
        ref = [a[y0:y1, x0:x1] for a in arrays]
    else:
        ref = arrays[:: max(1, len(arrays) // 8)]
    tiles = []
    for k in ks:
        g = gray(s, k, box, window, ref=ref, usm=usm)
        sc = tile / g.width
        g = g.resize((tile, max(1, round(g.height * sc))), Image.LANCZOS)
        rgb = g.convert("RGB")
        d = ImageDraw.Draw(rgb)
        _label(d, (4, 3), f"#{k}", 15)
        tiles.append(rgb)
    h = max(t.height for t in tiles)
    cols = max(1, min(cols, len(tiles)))
    rows = math.ceil(len(tiles) / cols)
    M = Image.new("RGB", (cols * tile + (cols - 1) * 2, rows * h + (rows - 1) * 2), (40, 40, 40))
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        M.paste(t, (c * (tile + 2), r * (h + 2)))
    # 縮尺（最初のタイルの拡大率で）
    ps = s.pixel_spacing(ks[0])
    if ps and ps[1]:
        bw = (clip_box(box, arrays[0].shape)[3] - clip_box(box, arrays[0].shape)[2])
        d = ImageDraw.Draw(M)
        scalebar(d, tile, h, (tile / bw) / ps[1])
    return M


def view(s: Series, k: int, box=None, size: int = 900, window=(0.5, 99.6), grid: bool = True, usm: float = 0.0) -> Image.Image:
    """1枚を大きく。目盛り（元画像の画素の位置）つきで、枠や点の位置を決めるのに使う。"""
    a = s.image(k)
    y0, y1, x0, x1 = clip_box(box, a.shape)
    g = gray(s, k, [y0, y1, x0, x1], window, ref=[a[y0:y1, x0:x1]] if box else None, usm=usm)
    sc = size / max(g.width, g.height)
    g = g.resize((max(1, round(g.width * sc)), max(1, round(g.height * sc))), Image.LANCZOS).convert("RGB")
    d = ImageDraw.Draw(g)
    if grid:
        span = max(y1 - y0, x1 - x0)
        step = next((v for v in (10, 20, 25, 50, 100, 200) if span / v <= 12), 200)
        for v in range((x0 // step + 1) * step, x1, step):
            xx = round((v - x0) * sc)
            d.line([(xx, 0), (xx, 10)], fill=COLORS["yellow"], width=1)
            d.text((xx + 2, 10), str(v), font=font(11), fill=COLORS["yellow"])
        for v in range((y0 // step + 1) * step, y1, step):
            yy = round((v - y0) * sc)
            d.line([(0, yy), (10, yy)], fill=COLORS["yellow"], width=1)
            d.text((12, yy - 7), str(v), font=font(11), fill=COLORS["yellow"])
    ps = s.pixel_spacing(k)
    if ps and ps[1]:
        scalebar(d, g.width, g.height, sc / ps[1])
    orient = s.orientation()
    label = f"{s.key} #{k}"
    if orient:
        label += f"  左={SHORT.get(orient['left'], orient['left'])} 右={SHORT.get(orient['right'], orient['right'])}"
        label += f" 上={SHORT.get(orient['up'], orient['up'])} 下={SHORT.get(orient['down'], orient['down'])}"
    _label(d, (4, g.height - 22), label, 13, fill=COLORS["green"])
    return g


# ───────────── 数値 ─────────────

def roi_stats(s: Series, k: int, rect=None, circle=None) -> dict:
    a = s.image(k)
    ps = s.pixel_spacing(k)
    if rect is not None:
        y0, y1, x0, x1 = clip_box(rect, a.shape)
        v = a[y0:y1, x0:x1].ravel()
        shape = f"rect {y0},{y1},{x0},{x1}"
    elif circle is not None:
        r0, c0, rad = [float(x) for x in circle]
        yy, xx = np.ogrid[: a.shape[0], : a.shape[1]]
        m = (yy - r0) ** 2 + (xx - c0) ** 2 <= rad ** 2
        v = a[m]
        shape = f"circle {r0:g},{c0:g},r{rad:g}"
    else:
        raise ValueError("rect か circle を指定してください")
    if v.size == 0:
        raise ValueError("ROI に画素がありません")
    return {"roi": shape, "n_px": int(v.size), "area_mm2": round(float(v.size * ps[0] * ps[1]), 1),
            "median": round(float(np.median(v)), 1), "mean": round(float(v.mean()), 1), "sd": round(float(v.std()), 1)}


def distance_mm(s: Series, k: int, p1, p2) -> float:
    ps = s.pixel_spacing(k)
    dy = (float(p1[0]) - float(p2[0])) * ps[0]
    dx = (float(p1[1]) - float(p2[1])) * ps[1]
    return float(math.hypot(dy, dx))


def xref(sa: Series, k: int, row: float, col: float, sb: Series) -> dict:
    if not (sa.is_volume and sb.is_volume):
        raise ValueError("断面の対応づけはMRI・CTのシリーズどうしだけです")
    p = pix2pat(sa.geom, k, row, col)
    kb, rb, cb, d = pat2pix(sb.geom, p)
    return {"series": sb.key, "k": kb, "row": round(rb, 1), "col": round(cb, 1), "off_plane_mm": round(d, 1)}


# ───────────── 図（レポート用） ─────────────

def _dashed(draw, p0, p1, fill, width, dash=8):
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    if L == 0:
        return
    n = max(1, int(L // dash))
    for i in range(0, n, 2):
        a, b = i / n, min(1, (i + 1) / n)
        draw.line([(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a), (x0 + (x1 - x0) * b, y0 + (y1 - y0) * b)], fill=fill, width=width)


def _arrow(draw, p0, p1, fill, width):
    (x0, y0), (x1, y1) = p0, p1
    ang = math.atan2(y1 - y0, x1 - x0)
    head = max(12, width * 4)
    bx, by = x1 - head * math.cos(ang), y1 - head * math.sin(ang)
    draw.line([(x0, y0), (bx, by)], fill=fill, width=width)
    left = (bx + head * 0.5 * math.sin(ang), by - head * 0.5 * math.cos(ang))
    right = (bx - head * 0.5 * math.sin(ang), by + head * 0.5 * math.cos(ang))
    draw.polygon([(x1, y1), left, right], fill=fill)


def _panel_geom(series: dict[str, Series], p: dict):
    s = find_series(series, str(p["series"]))
    k = int(p.get("k", 1))
    a = s.image(k)
    box = clip_box(parse_box(p.get("box")), a.shape)
    return s, k, a, box


def render_panel(series: dict[str, Series], p: dict, out_w: int, out_h: int, ref=None) -> Image.Image:
    """1コマを仕上がりの大きさ（out_w×out_h 画素）で描く。ref を渡すと、その配列の濃淡範囲にそろえる。"""
    s, k, a, box = _panel_geom(series, p)
    y0, y1, x0, x1 = box
    win = tuple(p.get("window") or (0.5, 99.6))
    if ref is None:
        ref = [a[y0:y1, x0:x1]] if p.get("box") else [a]
    g = gray(s, k, box, win, ref=ref, usm=float(p.get("sharpen", 0) or 0))
    flip = bool(p.get("flip"))
    if flip:
        g = g.transpose(Image.FLIP_LEFT_RIGHT)
    scx, scy = out_w / g.width, out_h / g.height
    g = g.resize((out_w, out_h), Image.LANCZOS).convert("RGB")
    d = ImageDraw.Draw(g)
    lw = max(2, round(out_w / 300))
    small = out_w < 420

    def P(rc):
        r, c = float(rc[0]), float(rc[1])
        x = (c - x0) * scx
        if flip:
            x = out_w - x
        return (x, (r - y0) * scy)

    for m in p.get("marks") or []:
        col = color(m.get("color"))
        t = m.get("type")
        if t == "arrow":
            _arrow(d, P(m["from"]), P(m["to"]), col, lw)
        elif t == "line":
            a0, a1 = P(m["from"]), P(m["to"])
            d.line([a0, a1], fill=col, width=lw)
            for q in (a0, a1):
                d.ellipse([q[0] - lw * 1.5, q[1] - lw * 1.5, q[0] + lw * 1.5, q[1] + lw * 1.5], fill=col)
            if m.get("label"):
                _label(d, ((a0[0] + a1[0]) / 2 + 6, (a0[1] + a1[1]) / 2 - 12), str(m["label"]), 20 if small else 24, fill=col)
        elif t in ("circle", "ellipse"):
            cx, cy = P(m["center"])
            rr = float(m.get("r", 10)) * scx
            ry = float(m.get("ry", m.get("r", 10))) * scy
            if m.get("dashed"):
                pts = [(cx + rr * math.cos(i / 36 * 2 * math.pi), cy + ry * math.sin(i / 36 * 2 * math.pi)) for i in range(37)]
                for i in range(0, 36, 2):
                    d.line([pts[i], pts[i + 1]], fill=col, width=lw)
            else:
                d.ellipse([cx - rr, cy - ry, cx + rr, cy + ry], outline=col, width=lw)
        elif t == "rect":
            by0, by1, bx0, bx1 = parse_box(m["box"])
            q0, q1 = P((by0, bx0)), P((by1, bx1))
            xa, xb = sorted([q0[0], q1[0]])
            pts = [(xa, q0[1]), (xb, q0[1]), (xb, q1[1]), (xa, q1[1]), (xa, q0[1])]
            for i in range(4):
                if m.get("dashed"):
                    _dashed(d, pts[i], pts[i + 1], col, lw)
                else:
                    d.line([pts[i], pts[i + 1]], fill=col, width=lw)
        elif t == "text":
            _label(d, P(m["at"]), str(m.get("text", "")), int(m.get("size", 20 if small else 24)), fill=col)
    if p.get("label"):
        _label(d, (6, 5), str(p["label"]), 20 if small else 26, fill=(255, 255, 255))
    ps = s.pixel_spacing(k)
    if ps and ps[1] and p.get("scalebar_mm", 10):
        scalebar(d, out_w, out_h, scx / ps[1], float(p.get("scalebar_mm") or 10))
    if p.get("orient", True) and s.is_volume:
        o = s.orientation() or {}
        left, right = o.get("left", ""), o.get("right", "")
        if flip:
            left, right = right, left
        f = 16 if small else 20
        if left:
            _label(d, (4, out_h // 2 - f // 2), SHORT.get(left, left), f, fill=COLORS["cyan"])
        if right:
            tw = d.textlength(SHORT.get(right, right), font=font(f))
            _label(d, (out_w - tw - 6, out_h // 2 - f // 2), SHORT.get(right, right), f, fill=COLORS["cyan"])
        if not small:
            up, down = o.get("up", ""), o.get("down", "")
            if up:
                tw = d.textlength(SHORT.get(up, up), font=font(f))
                _label(d, (out_w // 2 - tw / 2, 40), SHORT.get(up, up), f, fill=COLORS["cyan"])
            if down:
                tw = d.textlength(SHORT.get(down, down), font=font(f))
                _label(d, (out_w // 2 - tw / 2, out_h - f - 34), SHORT.get(down, down), f, fill=COLORS["cyan"])
    return g


def compose_figure(series: dict[str, Series], spec: dict, out_dir: Path) -> Path:
    """spec = {"out": "fig1", "width": 1800, "rows": [[panel, ...], ...]}。JPEG で figures/ に書く。
    同じ行に「同じシリーズ・同じ枠」のコマが並ぶときは、濃淡もそろえる（連続スライスを見比べるため）。"""
    name = str(spec.get("out") or "fig")
    if not name.replace("_", "").replace("-", "").isalnum() or len(name) > 40:
        raise ValueError("out は英数字・-・_ だけにしてください（例 fig2）")
    rows = spec.get("rows") or ([spec["panels"]] if spec.get("panels") else None)
    if not rows or not all(isinstance(r, list) and r and all(isinstance(p, dict) for p in r) for r in rows):
        raise ValueError("rows は [[コマ, コマ], [コマ, …]] の形にしてください")
    if sum(len(r) for r in rows) > 16:
        raise ValueError("1枚の図は16コマまでにしてください")
    W = int(min(max(int(spec.get("width", 1800)), 600), 2200))
    gap = 8
    out_rows = []
    for row in rows:
        geoms = [_panel_geom(series, p) for p in row]
        ratios = [(b[3] - b[2]) * (s.pixel_spacing(k)[1] or 1) / ((b[1] - b[0]) * (s.pixel_spacing(k)[0] or 1)) for s, k, _, b in geoms]
        h = int(min((W - gap * (len(row) - 1)) / sum(ratios), W * 0.85))
        groups: dict = {}
        for (s, k, a, b), p in zip(geoms, row):
            if p.get("box"):
                groups.setdefault((s.key, tuple(b)), []).append(a[b[0]:b[1], b[2]:b[3]])
        line_w = sum(max(1, round(h * r)) for r in ratios) + gap * (len(row) - 1)
        line = Image.new("RGB", (line_w, h), (255, 255, 255))
        x = 0
        for (s, k, a, b), p, r in zip(geoms, row, ratios):
            shared = groups.get((s.key, tuple(b))) if p.get("box") else None
            im = render_panel(series, p, max(1, round(h * r)), h, ref=shared if shared and len(shared) > 1 else None)
            line.paste(im, (x, 0))
            x += im.width + gap
        out_rows.append(line)
    H = sum(r.height for r in out_rows) + gap * (len(out_rows) - 1)
    canvas = Image.new("RGB", (max(r.width for r in out_rows), H), (255, 255, 255))
    y = 0
    for r in out_rows:
        canvas.paste(r, ((canvas.width - r.width) // 2, y))
        y += r.height + gap
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{name}.jpg"
    canvas.save(path, "JPEG", quality=86, optimize=True)
    return path
