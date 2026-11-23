"""患者さんのCD（DICOM）を読む。

- scan(): ヘッダだけ読んで、検査・シリーズ・CDの方の氏名と生年月日（照合用）・小さな見本画像を返す（このパソコンの中だけ）
- ingest(): 画素を読んで、AIの作業フォルダに「氏名・ID・日付を除いた」配列と、撮像条件だけを書く。
  見出しに使う情報（氏名・ID・施設・装置・撮影日時・体重）は戻り値で返し、作業フォルダには書かない
"""
from __future__ import annotations

import base64
import datetime as dt
import io
import json
import os
import re
from collections import defaultdict
from pathlib import Path

import numpy as np
import pydicom
from PIL import Image

from . import imaging

MAX_FILES = 6000

SIDE_PATTERNS = [
    (re.compile(r"(^|[^a-z])(rt|right|r)([^a-z]|$)", re.I), "right"),
    (re.compile(r"(^|[^a-z])(lt|left|l)([^a-z]|$)", re.I), "left"),
    (re.compile("右"), "right"),
    (re.compile("左"), "left"),
]
MODALITY_JA = {"CR": "単純X線", "DX": "単純X線", "DR": "単純X線", "RF": "X線透視", "MR": "MRI", "CT": "CT", "US": "超音波"}


def _s(ds, name, default=""):
    v = getattr(ds, name, default)
    if v is None:
        return default
    if isinstance(v, pydicom.multival.MultiValue):
        return [x for x in v]
    return v


def side_from_text(*texts) -> str | None:
    found = set()
    for t in texts:
        t = str(t or "")
        if not t:
            continue
        for pat, side in SIDE_PATTERNS:
            if pat.search(t):
                found.add(side)
                break
    return found.pop() if len(found) == 1 else None


def person_name(ds) -> str:
    pn = _s(ds, "PatientName", "")
    try:
        ideo = str(getattr(pn, "ideographic", "") or "")
        if ideo:
            return ideo.replace("^", " ").replace("　", " ").strip()
    except Exception:  # noqa: BLE001
        pass
    return str(pn).split("=")[0].replace("^", " ").strip()


def identifiers_of(ds) -> list[str]:
    """この方を特定できる文字（説明文から消すのに使う）"""
    out = set()
    pn = _s(ds, "PatientName", "")
    for comp in ("alphabetic", "ideographic", "phonetic"):
        try:
            v = str(getattr(pn, comp, "") or "")
        except Exception:  # noqa: BLE001
            v = ""
        for part in re.split(r"[\^=\s　]+", v):
            if len(part) >= 2:
                out.add(part)
        if v:
            out.add(v.replace("^", " ").strip())
            out.add(v.replace("^", "").strip())
    for tag in ("PatientID", "OtherPatientIDs", "PatientBirthDate", "InstitutionName", "ReferringPhysicianName",
                "AccessionNumber", "InstitutionAddress", "StationName", "OperatorsName", "PerformingPhysicianName"):
        v = _s(ds, tag, "")
        for x in (v if isinstance(v, list) else [v]):
            x = str(x or "").replace("^", " ").strip()
            if len(x) >= 2:
                out.add(x)
    return sorted((x for x in out if x and (len(x) >= 3 if x.isascii() else True)), key=len, reverse=True)


def scrub(text, identifiers: list[str]) -> str:
    s = str(text or "")
    for ident in identifiers:
        s = re.sub(re.escape(ident), "■", s, flags=re.I)
    return re.sub(r"\d{6,}", "■", s)


# ───────────── CDを探す ─────────────

def _windows_drives() -> list[dict]:
    import ctypes
    out = []
    mask = ctypes.windll.kernel32.GetLogicalDrives()
    for i in range(26):
        if not mask & (1 << i):
            continue
        root = f"{chr(65 + i)}:\\"
        t = ctypes.windll.kernel32.GetDriveTypeW(ctypes.c_wchar_p(root))
        if t not in (2, 5):  # 2=リムーバブル, 5=CD/DVD
            continue
        name = ctypes.create_unicode_buffer(261)
        ok = ctypes.windll.kernel32.GetVolumeInformationW(ctypes.c_wchar_p(root), name, 261, None, None, None, None, 0)
        if not ok:  # ディスクが入っていない
            continue
        out.append({"path": root, "label": name.value or root, "kind": "cd" if t == 5 else "usb"})
    return out


def is_dicom(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            head = f.read(132)
        if len(head) == 132 and head[128:132] == b"DICM":
            return True
    except OSError:
        return False
    return path.suffix.lower() in ("", ".dcm") and path.name.upper() != "DICOMDIR"


def iter_files(root: Path):
    n = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and d.lower() not in ("viewer", "program", "autorun", "$recycle.bin", "system volume information")]
        for fn in filenames:
            if fn.upper() == "DICOMDIR" or fn.lower().endswith((".exe", ".dll", ".html", ".htm", ".js", ".css", ".txt", ".inf", ".ini", ".pdf", ".xml", ".jar")):
                continue
            p = Path(dirpath) / fn
            n += 1
            if n > MAX_FILES:
                return
            yield p


def list_sources(extra: list[str] | None = None) -> list[dict]:
    out = []
    if os.name == "nt":
        try:
            out = _windows_drives()
        except Exception:  # noqa: BLE001
            out = []
    for e in extra or []:
        if Path(e).is_dir() and not any(o["path"].rstrip("\\/") == e.rstrip("\\/") for o in out):
            out.append({"path": e, "label": Path(e).name or e, "kind": "folder"})
    return out


# ───────────── ヘッダだけ読む ─────────────

def _read_headers(src: Path):
    items = []
    for f in iter_files(src):
        if not is_dicom(f):
            continue
        try:
            ds = pydicom.dcmread(str(f), stop_before_pixels=True)
        except Exception:  # noqa: BLE001
            continue
        if hasattr(ds, "SeriesInstanceUID") and hasattr(ds, "StudyInstanceUID"):
            items.append((f, ds))
    return items


def _pixels(path: Path) -> np.ndarray:
    ds = pydicom.dcmread(str(path))
    try:
        a = ds.pixel_array.astype(np.float32)
    except Exception as e:  # noqa: BLE001
        ts = getattr(getattr(ds, "file_meta", None), "TransferSyntaxUID", None)
        raise RuntimeError(f"画像を展開できません（{getattr(ts, 'name', ts)}）: {e}") from e
    if a.ndim == 3 and int(getattr(ds, "SamplesPerPixel", 1) or 1) == 3:
        a = a.mean(axis=2)
    elif a.ndim == 3:  # 複数フレームは真ん中
        a = a[a.shape[0] // 2]
    a = a * float(getattr(ds, "RescaleSlope", 1) or 1) + float(getattr(ds, "RescaleIntercept", 0) or 0)
    if str(getattr(ds, "PhotometricInterpretation", "")) == "MONOCHROME1":
        a = a.max() - a
    return a


def _thumb(path: Path, size: int = 180) -> str | None:
    try:
        a = _pixels(path)
    except Exception:  # noqa: BLE001
        return None
    lo, hi = imaging.window_of([a], (0.5, 99.6))
    img = Image.fromarray(imaging.to_u8(a, lo, hi), "L")
    img.thumbnail((size, size))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=72)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _date(v) -> str:
    v = str(v or "")
    return f"{v[:4]}-{v[4:6]}-{v[6:8]}" if re.fullmatch(r"\d{8}", v) else ""


def _time(v) -> str:
    v = str(v or "")
    return f"{v[:2]}:{v[2:4]}" if re.match(r"\d{4}", v) else ""


def scan(path: str) -> dict:
    src = Path(path)
    if not src.is_dir():
        raise ValueError(f"フォルダが見つかりません: {path}")
    items = _read_headers(src)
    if not items:
        raise ValueError("DICOM画像が見つかりませんでした（CDの中身・フォルダを確かめてください）")
    studies: dict[str, dict] = {}
    by_series: dict[str, list] = defaultdict(list)
    patients = set()
    for f, ds in items:
        by_series[str(ds.SeriesInstanceUID)].append((f, ds))
        patients.add((str(_s(ds, "PatientID", "")), str(_s(ds, "PatientBirthDate", ""))))
    for uid, files in by_series.items():
        ds0 = files[0][1]
        st = studies.setdefault(str(ds0.StudyInstanceUID), {
            "uid": str(ds0.StudyInstanceUID), "date": _date(_s(ds0, "StudyDate")), "time": _time(_s(ds0, "StudyTime")),
            "description": str(_s(ds0, "StudyDescription", "")), "institution": str(_s(ds0, "InstitutionName", "")),
            "modalities": [], "n_images": 0, "series": []})
        mod = str(_s(ds0, "Modality", "OT"))
        if mod not in st["modalities"]:
            st["modalities"].append(mod)
        st["n_images"] += len(files)
        files_sorted = sorted(files, key=lambda t: int(_s(t[1], "InstanceNumber", 0) or 0))
        if mod in ("MR", "CT") and len(files_sorted) > 2:
            thumbs = [files_sorted[len(files_sorted) // 2][0]]
        else:
            thumbs = [f for f, _ in files_sorted[:6]]
        st["series"].append({
            "uid": uid, "number": int(_s(ds0, "SeriesNumber", 0) or 0), "modality": mod,
            "description": str(_s(ds0, "SeriesDescription", "") or _s(ds0, "ProtocolName", "")), "n": len(files),
            "thumbs": [t for t in (_thumb(p) for p in thumbs) if t],
        })
    for st in studies.values():
        st["series"].sort(key=lambda s: s["number"])
        st["modalities_ja"] = sorted({MODALITY_JA.get(m, m) for m in st["modalities"]})
    ds0 = items[0][1]
    return {
        "path": str(src),
        "patient": {"name": person_name(ds0), "id": str(_s(ds0, "PatientID", "")), "birth_date": _date(_s(ds0, "PatientBirthDate")),
                    "sex": str(_s(ds0, "PatientSex", ""))},
        "several_patients": len({p[0] for p in patients}) > 1,
        "studies": sorted(studies.values(), key=lambda s: (s["date"], s["time"])),
        "n_files": len(items),
    }


# ───────────── 作業フォルダへ読み込む ─────────────

def _slug(text: str) -> str:
    t = re.sub(r"[^0-9A-Za-z]+", "-", str(text)).strip("-")
    return t[:24] or "series"


def _age_text(birth: str, on: str) -> str:
    """'YYYY-MM-DD' 2つから「8歳11か月」"""
    try:
        b = dt.date.fromisoformat(birth)
        d = dt.date.fromisoformat(on)
    except ValueError:
        return ""
    months = (d.year - b.year) * 12 + (d.month - b.month) - (1 if d.day < b.day else 0)
    if months < 0:
        return ""
    y, m = divmod(months, 12)
    return f"{y}歳{m}か月" if y < 20 else f"{y}歳"


def ingest(path: str, study_uids: list[str] | None, work: Path, progress=print) -> dict:
    """戻り値: {"series": [公開してよい情報], "header": {見出し用（氏名などを含む。作業フォルダには書かない）}, "identifiers": [...]}"""
    items = _read_headers(Path(path))
    if study_uids:
        items = [t for t in items if str(t[1].StudyInstanceUID) in set(study_uids)]
    if not items:
        raise ValueError("選んだ検査の画像が見つかりません")
    groups: dict[str, list] = defaultdict(list)
    for f, ds in items:
        groups[str(ds.SeriesInstanceUID)].append((f, ds))
    ds_first = items[0][1]
    idents = identifiers_of(ds_first)
    root = Path(work) / "series"
    root.mkdir(parents=True, exist_ok=True)

    def order(item):
        ds = item[1][0][1]
        return (str(_s(ds, "StudyDate", "")), str(_s(ds, "SeriesTime", "") or _s(ds, "StudyTime", "")), int(_s(ds, "SeriesNumber", 0) or 0))

    series_out, equipment, times = [], {}, {}
    for idx, (uid, files) in enumerate(sorted(groups.items(), key=order), start=1):
        ds0 = files[0][1]
        mod = str(_s(ds0, "Modality", "OT")) or "OT"
        raw_desc = str(_s(ds0, "SeriesDescription", ""))
        raw_proto = str(_s(ds0, "ProtocolName", ""))
        desc = scrub(raw_desc or raw_proto, idents)
        key = f"s{idx:02d}_{_slug(mod)}_{_slug(desc)}"
        progress(f"読み込み中: {desc or mod}（{len(files)}枚）")
        sdir = root / key
        sdir.mkdir(parents=True, exist_ok=True)
        lat = str(_s(ds0, "Laterality", "") or _s(ds0, "ImageLaterality", "")).upper()
        side = {"R": "right", "L": "left"}.get(lat) or side_from_text(raw_desc, raw_proto) or side_from_text(_s(ds0, "StudyDescription", ""))
        mod_ja = MODALITY_JA.get(mod, mod)
        maker = f"{_s(ds0, 'Manufacturer', '')} {_s(ds0, 'ManufacturerModelName', '')}".strip()
        fs = str(_s(ds0, "MagneticFieldStrength", "") or "")
        if mod == "MR" and fs:
            try:
                maker += f" {float(fs):g}T"
            except ValueError:
                pass
        if maker and mod_ja not in equipment:
            equipment[mod_ja] = maker
        t = _time(_s(ds0, "SeriesTime", "") or _s(ds0, "StudyTime", ""))
        d = _date(_s(ds0, "SeriesDate", "") or _s(ds0, "StudyDate", ""))
        if (d or t) and mod_ja not in times:
            times[mod_ja] = (d, t)
        info = {"key": key, "modality": mod, "modality_ja": mod_ja, "description": desc, "side": side,
                "body_part": scrub(_s(ds0, "BodyPartExamined", ""), idents)}
        iop = _s(ds0, "ImageOrientationPatient", None)
        if mod in ("MR", "CT") and iop and len(files) > 1:
            iop = [float(x) for x in iop]
            n = imaging.normal_of(iop)
            rows = []
            for f, ds in files:
                try:
                    ipp = [float(x) for x in ds.ImagePositionPatient]
                except Exception:  # noqa: BLE001
                    continue
                rows.append((float(np.dot(n, ipp)), f, ds, ipp))
            rows.sort(key=lambda r: r[0])
            shapes = defaultdict(int)
            for r in rows:
                shapes[(int(r[2].Rows), int(r[2].Columns))] += 1
            target = max(shapes, key=shapes.get)
            rows = [r for r in rows if (int(r[2].Rows), int(r[2].Columns)) == target]
            vol = np.stack([_pixels(f) for _, f, _, _ in rows]).astype(np.float32)
            np.save(sdir / "volume.npy", vol)
            ps = [float(x) for x in _s(rows[0][2], "PixelSpacing", [1, 1])]
            geom = {"iop": iop, "ipp": [r[3] for r in rows], "pixel_spacing": ps,
                    "instances": [int(_s(r[2], "InstanceNumber", 0) or 0) for r in rows], "rows": target[0], "cols": target[1]}
            info.update({"kind": "volume", "plane": imaging.plane_of(iop), "n": len(rows),
                         "slice_thickness": float(_s(ds0, "SliceThickness", 0) or 0),
                         "spacing": float(np.median(np.diff([r[0] for r in rows]))) if len(rows) > 1 else 0.0,
                         "pixel_spacing": ps, "tr": str(_s(ds0, "RepetitionTime", "")), "te": str(_s(ds0, "EchoTime", "")),
                         "ti": str(_s(ds0, "InversionTime", ""))})
        else:
            files_sorted = sorted(files, key=lambda t: int(_s(t[1], "InstanceNumber", 0) or 0))
            images = []
            for j, (f, ds) in enumerate(files_sorted, start=1):
                np.save(sdir / f"img_{j:03d}.npy", _pixels(f))
                ps = _s(ds, "PixelSpacing", None) or _s(ds, "ImagerPixelSpacing", None) or [0, 0]
                images.append({
                    "index": j, "instance": int(_s(ds, "InstanceNumber", 0) or 0), "rows": int(ds.Rows), "cols": int(ds.Columns),
                    "pixel_spacing": [float(x) for x in ps],
                    "spacing_source": "PixelSpacing" if _s(ds, "PixelSpacing", None) else ("ImagerPixelSpacing（拡大率は未補正）" if _s(ds, "ImagerPixelSpacing", None) else "なし"),
                    "view": scrub(_s(ds, "ViewPosition", ""), idents),
                    "laterality": str(_s(ds, "ImageLaterality", "") or _s(ds, "Laterality", "")),
                    "description": scrub(_s(ds, "ProtocolName", "") or _s(ds, "SeriesDescription", ""), idents),
                    "kvp": str(_s(ds, "KVP", "")),
                })
            geom = {"images": images}
            info.update({"kind": "images", "plane": "projection", "n": len(images),
                         "pixel_spacing": images[0]["pixel_spacing"] if images else None,
                         "kvp": images[0]["kvp"] if images else ""})
        (sdir / "geometry.json").write_text(json.dumps(geom, ensure_ascii=False), encoding="utf-8")
        (sdir / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
        series_out.append(info)

    header = {
        "dicom_name": person_name(ds_first), "patient_id": str(_s(ds_first, "PatientID", "")),
        "birth_date": _date(_s(ds_first, "PatientBirthDate")), "sex": str(_s(ds_first, "PatientSex", "")),
        "weight_kg": str(_s(ds_first, "PatientWeight", "") or ""), "institution": str(_s(ds_first, "InstitutionName", "")),
        "study_date": _date(_s(ds_first, "StudyDate")), "equipment": equipment,
        "times": {k: list(v) for k, v in times.items()},
        "counts": {},
    }
    for s in series_out:
        header["counts"][s["modality_ja"]] = header["counts"].get(s["modality_ja"], 0) + int(s["n"])
    return {"series": series_out, "header": header, "identifiers": idents}


def write_case(work: Path, series: list[dict], age_text: str, sex_ja: str, complaint: str, question: str) -> None:
    """AIに渡す case.md（氏名・ID・日付なし）"""
    lines = ["# 症例", "", f"- 年齢・性別: {age_text or '不明'}・{sex_ja or '不明'}",
             f"- 主訴（ご提供情報）: {complaint or '（記載なし）'}", f"- 確認したいこと: {question or '（特になし。全体を読影）'}", "",
             "# シリーズ（詳しくは python rt.py list）", ""]
    for s in series:
        if s.get("kind") == "volume":
            lines.append(f"- {s['key']}: {s['modality_ja']} {s.get('description') or ''} {s.get('plane')} {s['n']}枚 "
                         f"厚さ{s.get('slice_thickness')}mm 左右(名前から)={s.get('side') or '不明'}")
        else:
            lines.append(f"- {s['key']}: {s['modality_ja']} {s.get('description') or ''} {s['n']}枚 左右(名前から)={s.get('side') or '不明'}")
    (Path(work) / "case.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_consult(work: Path, observation: str, location: str, prior: dict) -> None:
    """見直し（相談）のときに、case.md とならべて置く consult.md（院長の気づき・前回のAIの読影。氏名などは除いたもの）"""
    lines = ["# 院長が気づいたこと（相談）", "", f"- 気づいたこと: {observation or '（記載なし）'}",
             f"- 場所（院長の記載）: {location or '（記載なし。気づいたことの文から部位を決めて探す）'}", "",
             "# 前回のAIの読影（参考。まちがっていることもある）", ""]
    if prior.get("region"):
        lines.append(f"- 部位: {prior['region']}")
    if prior.get("headline"):
        lines.append(f"- 一行: {prior['headline']}")
    if prior.get("summary"):
        lines.append("- 総括:")
        lines += [f"  - {x}" for x in prior["summary"]]
    if prior.get("estimates"):
        lines.append("- 見積もり: " + "／".join(f"{e['condition']} 約{e['percent']}%" for e in prior["estimates"]))
    if len(lines) == 7:
        lines.append("（前回の読影の記録はありません）")
    (Path(work) / "consult.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def series_rows(series: list[dict]) -> list[list[str]]:
    """レポートの「撮像シリーズ」の表（DICOMの値から作る）"""
    rows = []
    side_ja = {"right": "右 ", "left": "左 "}
    plane_ja = {"sagittal": "矢状断", "coronal": "冠状断", "axial": "横断"}
    xr = [s for s in series if s.get("kind") != "volume"]
    for s in series:
        if s.get("kind") != "volume":
            continue
        tr, te, ti = s.get("tr") or "", s.get("te") or "", s.get("ti") or ""

        def num(v):
            try:
                return f"{float(v):g}"
            except (TypeError, ValueError):
                return ""
        cond = " / ".join(x for x in (num(tr), num(te), num(ti)) if x)
        rows.append([f"{side_ja.get(s.get('side'), '')}{plane_ja.get(s.get('plane'), s.get('plane') or '')} {s.get('description') or ''}".strip(),
                     cond, f"{s.get('slice_thickness') or 0:g} / {round(float(s.get('spacing') or 0), 1):g} mm",
                     str(s["n"]), f"{float((s.get('pixel_spacing') or [0])[0]):.2f} mm"])
    if xr:
        n = sum(int(s["n"]) for s in xr)
        kinds = "・".join(sorted({s["modality_ja"] for s in xr}))
        descs = "、".join(sorted({(s.get("description") or "").strip() for s in xr if s.get("description")}))[:80]
        kvp = sorted({str(s.get("kvp") or "").split(".")[0] for s in xr if s.get("kvp")})
        text = f"{n}枚" + (f"（{descs}）" if descs else "") + (f"　{'・'.join(kvp)} kV" if kvp else "")
        rows.append([kinds, text])
    return rows
