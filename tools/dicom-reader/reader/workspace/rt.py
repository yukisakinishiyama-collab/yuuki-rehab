"""読影の道具（AIが `python rt.py <コマンド>` で使う）。画像は views/ と figures/ に書く。

  python rt.py list                                   シリーズの一覧（条件・向き・番号の向き）
  python rt.py montage S [--k 1-27] [--box y0,y1,x0,x1] [--cols 6] [--tile 256] [--sharpen 0.8]
                                                      スライスの一覧（全スライスを見る基本）
  python rt.py strip S 6-10 --box y0,y1,x0,x1 [--tile 300]
                                                      同じ枠・同じ拡大率・同じ濃淡で連続スライスを並べる
  python rt.py view S K [--box y0,y1,x0,x1] [--size 900]
                                                      1枚を大きく（画素の目盛りつき。枠や点の位置決めに）
  python rt.py roi S K --rect y0,y1,x0,x1 [--rect ...] [--circle r,c,半径 ...]
                                                      信号の中央値・平均・SD・面積（同じ撮像内の相対値）
  python rt.py dist S K r1,c1 r2,c2                   2点の距離（mm）
  python rt.py xref S K r,c T                         S の点が T のどのスライス・画素にあたるか
  python rt.py figure out/figN.json                   レポートの図を作る（figures/ に JPEG）
  python rt.py check                                  out/report.json（見直しのときは out/consult.json）を確かめる（OK と出るまで直す）

S はシリーズ名（list の key。先頭の s02 だけでも可）。K はスライス番号（1から）。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import rtcheck  # noqa: E402
import rtlib as L  # noqa: E402

VIEWS = HERE / "views"
_counter = {"n": 0}


def _ks(text: str | None, n: int) -> list[int]:
    if not text:
        return list(range(1, n + 1))
    out: list[int] = []
    for part in str(text).split(","):
        if "-" in part:
            a, b = part.split("-", 1)
            out += list(range(int(a), int(b) + 1))
        elif part.strip():
            out.append(int(part))
    bad = [k for k in out if not 1 <= k <= n]
    if bad:
        raise ValueError(f"スライス番号 {bad} は範囲外です（1〜{n}）")
    return out


def _save(img, stem: str) -> Path:
    VIEWS.mkdir(exist_ok=True)
    i = 1
    while (VIEWS / f"{stem}_{i:02d}.png").exists():
        i += 1
    p = VIEWS / f"{stem}_{i:02d}.png"
    img.save(p)
    print(f"→ {p.relative_to(HERE).as_posix()}（{img.width}×{img.height}px）を Read で開いてください")
    return p


def _pt(text: str) -> tuple[float, float]:
    r, c = [float(x) for x in text.split(",")]
    return r, c


def cmd_list(series, a):
    for key, s in series.items():
        inf = s.info
        if s.is_volume:
            o = s.orientation()
            n = L.normal_of(s.geom["iop"])
            kdir = L.direction_label(n, s.side)
            print(f"{key}: {inf.get('modality')} {inf.get('plane')} {s.n}枚 厚さ{inf.get('slice_thickness')}mm "
                  f"間隔{round(float(inf.get('spacing') or 0), 2)}mm 画素{s.pixel_spacing()[0]:.3f}mm "
                  f"{s.image(1).shape[0]}×{s.image(1).shape[1]} TR/TE/TI={inf.get('tr')}/{inf.get('te')}/{inf.get('ti') or '-'} "
                  f"左右(名前から)={inf.get('side') or '不明'}")
            print(f"   画面: 左={o['left']} 右={o['right']} 上={o['up']} 下={o['down']}／番号が増えると {kdir} へ")
        else:
            for k in range(1, s.n + 1):
                im = s.geom["images"][k - 1]
                print(f"{key} #{k}: {inf.get('modality')} {im.get('view') or ''} {im.get('laterality') or ''} "
                      f"{im['rows']}×{im['cols']} 画素{im['pixel_spacing'][0]:.3f}mm（{im.get('spacing_source')}） "
                      f"{inf.get('description') or ''}")


def cmd_montage(series, a, strip=False):
    s = L.find_series(series, a.series)
    ks = _ks(a.k, s.n)
    box = L.parse_box(a.box)
    if strip and not box:
        raise ValueError("strip には --box が要ります（同じ枠で並べるため）")
    if s.is_volume is False and len(ks) > 1 and box is None:
        pass
    tile = a.tile or (300 if strip else (256 if s.n > 12 else 320))
    img = L.montage(s, ks, box, cols=a.cols, tile=tile, local=bool(box), usm=a.sharpen)
    _save(img, f"{s.key.split('_')[0]}_{'strip' if strip else 'montage'}")


def cmd_view(series, a):
    s = L.find_series(series, a.series)
    img = L.view(s, int(a.k), L.parse_box(a.box), size=a.size, usm=a.sharpen)
    _save(img, f"{s.key.split('_')[0]}_k{int(a.k):02d}")


def cmd_roi(series, a):
    s = L.find_series(series, a.series)
    res = [L.roi_stats(s, int(a.k), rect=L.parse_box(r)) for r in (a.rect or [])]
    res += [L.roi_stats(s, int(a.k), circle=[float(x) for x in c.split(",")]) for c in (a.circle or [])]
    if not res:
        raise ValueError("--rect か --circle を1つ以上")
    base = res[0]["median"] or 1
    for r in res:
        print(f"{r['roi']}: 中央値 {r['median']} 平均 {r['mean']} SD {r['sd']} 画素 {r['n_px']} 面積 {r['area_mm2']}mm² "
              f"（最初のROIとの比 {r['median'] / base:.2f}）")


def cmd_dist(series, a):
    s = L.find_series(series, a.series)
    d = L.distance_mm(s, int(a.k), _pt(a.p1), _pt(a.p2))
    ps = s.pixel_spacing(int(a.k))
    print(f"{d:.1f} mm（画素の大きさ {ps[0]:.3f}×{ps[1]:.3f} mm）")


def cmd_xref(series, a):
    sa, sb = L.find_series(series, a.series), L.find_series(series, a.target)
    r, c = _pt(a.point)
    x = L.xref(sa, int(a.k), r, c, sb)
    print(f"{sa.key} #{a.k} ({r:g},{c:g}) → {x['series']} #{x['k']} (row {x['row']}, col {x['col']})、断面からのずれ {x['off_plane_mm']} mm")


def cmd_figure(series, a):
    spec_path = (HERE / a.spec).resolve()
    if HERE not in spec_path.parents:
        raise ValueError("図の指定ファイルは作業フォルダの中（out/）に置いてください")
    spec = json.loads(spec_path.read_text(encoding="utf-8-sig"))
    p = L.compose_figure(series, spec, HERE / "figures")
    from PIL import Image
    with Image.open(p) as im:
        print(f"→ {p.relative_to(HERE).as_posix()}（{im.width}×{im.height}px）。Read で仕上がりを確かめてください")


def cmd_check(series, a):
    data, problems = rtcheck.check_work(HERE)
    if problems:
        print("直してください:")
        for x in problems:
            print(" -", x)
        sys.exit(1)
    unused = data.get("unused_figures") or []
    print("OK" + (f"（使っていない図: {', '.join(unused)}）" if unused else ""))


def main(argv=None):
    ap = argparse.ArgumentParser(prog="rt.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    for name in ("montage", "strip"):
        m = sub.add_parser(name)
        m.add_argument("series")
        if name == "strip":
            m.add_argument("k")
        else:
            m.add_argument("--k")
        m.add_argument("--box")
        m.add_argument("--cols", type=int, default=6)
        m.add_argument("--tile", type=int)
        m.add_argument("--sharpen", type=float, default=0.0)
    v = sub.add_parser("view")
    v.add_argument("series")
    v.add_argument("k")
    v.add_argument("--box")
    v.add_argument("--size", type=int, default=900)
    v.add_argument("--sharpen", type=float, default=0.0)
    r = sub.add_parser("roi")
    r.add_argument("series")
    r.add_argument("k")
    r.add_argument("--rect", action="append")
    r.add_argument("--circle", action="append")
    d = sub.add_parser("dist")
    d.add_argument("series")
    d.add_argument("k")
    d.add_argument("p1")
    d.add_argument("p2")
    x = sub.add_parser("xref")
    x.add_argument("series")
    x.add_argument("k")
    x.add_argument("point")
    x.add_argument("target")
    f = sub.add_parser("figure")
    f.add_argument("spec")
    sub.add_parser("check")
    a = ap.parse_args(argv)
    series = L.load_series(HERE)
    try:
        {"list": cmd_list, "montage": cmd_montage, "strip": lambda s, a: cmd_montage(s, a, strip=True),
         "view": cmd_view, "roi": cmd_roi, "dist": cmd_dist, "xref": cmd_xref, "figure": cmd_figure,
         "check": cmd_check}[a.cmd](series, a)
    except (ValueError, KeyError, FileNotFoundError, json.JSONDecodeError) as e:
        print(f"エラー: {e}")
        sys.exit(2)


if __name__ == "__main__":
    main()
