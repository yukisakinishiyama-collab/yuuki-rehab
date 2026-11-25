"""AIが書く out/report.json（読影）と out/consult.json（院長の気づきの見直し）の形を確かめて整える。
rt.py check と読影プログラムの両方で使う。

AIの作業フォルダには rtcheck.py という名前で写して置く。見直しの作業フォルダには consult.md がある。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

BLOCK_TYPES = ("p", "h3", "figure", "table", "list", "box", "note", "series_table", "estimates")
# 見直し（相談）の答えで使えるブロック（撮像の表・見積もりの表は読影のレポートにだけ入れる）
CONSULT_BLOCK_TYPES = ("p", "h3", "figure", "table", "list", "box", "note")
# 見直しの見立て → 画面・PDFに出す言葉
VERDICTS = {"seen": "気づいた所見を確認", "partly": "一部を確認", "not_seen": "確認できず", "cannot_judge": "この画像では判断できない"}
FIG_RE = re.compile(r"^figures/[A-Za-z0-9_-]{1,40}\.jpg$")
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _text(v, limit: int, where: str, problems: list[str], required: bool = True) -> str:
    if v is None or (isinstance(v, str) and not v.strip()):
        if required:
            problems.append(f"{where} が空です")
        return ""
    if not isinstance(v, (str, int, float)):
        problems.append(f"{where} は文字にしてください")
        return ""
    s = _CTRL.sub("", str(v)).strip()
    if len(s) > limit:
        problems.append(f"{where} が長すぎます（{len(s)}字。{limit}字まで）")
        s = s[:limit]
    return s


def validate(data, work: Path) -> tuple[dict, list[str]]:
    """(整えた内容, 問題のリスト)。問題が空ならそのまま PDF にできる。"""
    p: list[str] = []
    if not isinstance(data, dict):
        return {}, ["report.json の中身がオブジェクト（{...}）ではありません"]
    out: dict = {
        "title_region": _text(data.get("title_region"), 40, "title_region", p),
        "headline": _text(data.get("headline"), 60, "headline", p),
    }
    summ = data.get("summary")
    if not isinstance(summ, list) or not summ:
        p.append("summary（総括の段落のリスト）がありません")
        summ = []
    if len(summ) > 8:
        p.append("summary は8段落までにしてください")
    out["summary"] = [_text(s, 500, f"summary[{i}]", p) for i, s in enumerate(summ[:8])]

    est = data.get("estimates") or []
    if not isinstance(est, list):
        p.append("estimates はリストにしてください")
        est = []
    out_est = []
    for i, e in enumerate(est[:10]):
        if not isinstance(e, dict):
            p.append(f"estimates[{i}] は {{condition, percent, basis}} にしてください")
            continue
        try:
            pct = int(round(float(e.get("percent"))))
        except (TypeError, ValueError):
            p.append(f"estimates[{i}].percent が数字ではありません")
            pct = 0
        if not 0 <= pct <= 100:
            p.append(f"estimates[{i}].percent は 0〜100 にしてください")
            pct = max(0, min(100, pct))
        out_est.append({"condition": _text(e.get("condition"), 80, f"estimates[{i}].condition", p), "percent": pct,
                        "basis": _text(e.get("basis"), 240, f"estimates[{i}].basis", p, required=False)})
    if out_est and sum(e["percent"] for e in out_est) > 110:
        p.append("estimates の合計が100%を大きく超えています（主な候補の見積もりを合計100%前後に）")
    out["estimates"] = out_est

    refs = data.get("references") or []
    out["references"] = [_text(r, 400, f"references[{i}]", p) for i, r in enumerate(refs[:15])] if isinstance(refs, list) else []

    secs = data.get("sections")
    if not isinstance(secs, list) or not secs:
        p.append("sections（本文の章のリスト）がありません")
        secs = []
    used_figs: set[str] = set()
    out_secs, has_series_table, has_est_block = _sections(secs, work, p, used_figs, BLOCK_TYPES)
    if out_secs and not has_series_table:
        out_secs[0]["blocks"].insert(0, {"type": "series_table"})
    if out_est and not has_est_block:
        out_secs.append({"heading": "考えられる状態と、確からしさの見積もり", "blocks": [{"type": "estimates"}]})
    out["sections"] = out_secs
    out["unused_figures"] = _unused(work, used_figs)
    if not used_figs:
        p.append("図が1枚もありません（主な所見は図で示してください）")
    return out, p


def _unused(work: Path, used_figs: set[str]) -> list[str]:
    figs = sorted(str(x.relative_to(work)).replace("\\", "/") for x in (Path(work) / "figures").glob("*.jpg")) \
        if (Path(work) / "figures").exists() else []
    return [f for f in figs if f not in used_figs]


def _sections(secs: list, work: Path, p: list[str], used_figs: set[str], allowed: tuple[str, ...]) -> tuple[list[dict], bool, bool]:
    """本文の章（heading と blocks）を確かめる。(整えた章, 撮像の表があったか, 見積もりの表があったか)"""
    out_secs = []
    has_series_table = has_est_block = False
    for i, s in enumerate(secs[:14]):
        if not isinstance(s, dict):
            p.append(f"sections[{i}] は {{heading, blocks}} にしてください")
            continue
        sec = {"heading": _text(s.get("heading"), 70, f"sections[{i}].heading", p), "blocks": []}
        blocks = s.get("blocks")
        if not isinstance(blocks, list) or not blocks:
            p.append(f"sections[{i}].blocks が空です")
            blocks = []
        for j, b in enumerate(blocks[:40]):
            w = f"sections[{i}].blocks[{j}]"
            if not isinstance(b, dict) or b.get("type") not in allowed:
                p.append(f"{w}.type は {', '.join(allowed)} のどれかにしてください")
                continue
            t = b["type"]
            nb: dict = {"type": t}
            if t in ("p", "note", "h3"):
                nb["text"] = _text(b.get("text"), 1200 if t != "h3" else 80, f"{w}.text", p)
            elif t == "box":
                nb["title"] = _text(b.get("title"), 80, f"{w}.title", p, required=False)
                nb["text"] = _text(b.get("text"), 1200, f"{w}.text", p)
            elif t == "figure":
                f = str(b.get("file") or "")
                if not FIG_RE.match(f):
                    p.append(f"{w}.file は figures/◯◯.jpg（rt.py figure で作った図）にしてください")
                elif not (Path(work) / f).is_file():
                    p.append(f"{w}.file の {f} がありません（先に python rt.py figure で作ってください）")
                elif f in used_figs:
                    p.append(f"{w}.file の {f} が2回使われています")
                used_figs.add(f)
                nb["file"] = f
                nb["caption"] = _text(b.get("caption"), 500, f"{w}.caption", p)
                try:
                    nb["width"] = max(30, min(100, int(b.get("width", 100))))
                except (TypeError, ValueError):
                    nb["width"] = 100
            elif t == "table":
                cols = b.get("columns")
                rows = b.get("rows")
                if not isinstance(cols, list) or not 1 <= len(cols) <= 6:
                    p.append(f"{w}.columns は1〜6個の見出しのリストにしてください")
                    continue
                if not isinstance(rows, list) or not rows:
                    p.append(f"{w}.rows が空です")
                    continue
                nb["columns"] = [_text(c, 60, f"{w}.columns", p) for c in cols]
                nb["rows"] = []
                for r_i, r in enumerate(rows[:40]):
                    if not isinstance(r, list) or len(r) != len(cols):
                        p.append(f"{w}.rows[{r_i}] の数が columns（{len(cols)}個）と合いません")
                        continue
                    nb["rows"].append([_text(c, 700, f"{w}.rows[{r_i}]", p, required=False) for c in r])
                widths = b.get("widths")
                if isinstance(widths, list) and len(widths) == len(cols):
                    try:
                        nb["widths"] = [max(5, min(90, int(x))) for x in widths]
                    except (TypeError, ValueError):
                        pass
            elif t == "list":
                items = b.get("items")
                if not isinstance(items, list) or not items:
                    p.append(f"{w}.items が空です")
                    continue
                nb["items"] = [_text(x, 700, f"{w}.items", p) for x in items[:25]]
                nb["ordered"] = bool(b.get("ordered"))
            elif t == "series_table":
                has_series_table = True
            elif t == "estimates":
                has_est_block = True
            sec["blocks"].append(nb)
        out_secs.append(sec)
    return out_secs, has_series_table, has_est_block


def validate_consult(data, work: Path) -> tuple[dict, list[str]]:
    """院長の気づきの見直し（out/consult.json）を確かめる。(整えた内容, 問題のリスト)"""
    p: list[str] = []
    if not isinstance(data, dict):
        return {}, ["consult.json の中身がオブジェクト（{...}）ではありません"]
    verdict = data.get("verdict")
    if verdict not in VERDICTS:
        p.append(f"verdict は {'・'.join(VERDICTS)} のどれかにしてください")
        verdict = "cannot_judge"
    out: dict = {"verdict": verdict, "verdict_label": VERDICTS[verdict], "headline": _text(data.get("headline"), 60, "headline", p)}
    ans = data.get("answer")
    if not isinstance(ans, list) or not ans:
        p.append("answer（答えの段落のリスト）がありません")
        ans = []
    if len(ans) > 6:
        p.append("answer は6段落までにしてください")
    out["answer"] = [_text(s, 600, f"answer[{i}]", p) for i, s in enumerate(ans[:6])]
    nxt = data.get("next") or []
    if not isinstance(nxt, list):
        p.append("next はリストにしてください")
        nxt = []
    out["next"] = [x for x in (_text(s, 300, f"next[{i}]", p, required=False) for i, s in enumerate(nxt[:8])) if x]
    refs = data.get("references") or []
    out["references"] = [_text(r, 400, f"references[{i}]", p) for i, r in enumerate(refs[:10])] if isinstance(refs, list) else []
    secs = data.get("sections") or []
    if not isinstance(secs, list):
        p.append("sections はリストにしてください")
        secs = []
    used_figs: set[str] = set()
    out["sections"], _, _ = _sections(secs, work, p, used_figs, CONSULT_BLOCK_TYPES)
    out["unused_figures"] = _unused(work, used_figs)
    if verdict != "cannot_judge" and not used_figs:
        p.append("図が1枚もありません（見直した所を図で示してください）")
    return out, p


def _read_json(f: Path) -> tuple[object | None, str | None]:
    try:
        return json.loads(f.read_text(encoding="utf-8-sig")), None
    except Exception as e:  # noqa: BLE001
        return None, f"{f.parent.name}/{f.name} を読めません（JSONの書き方の誤り）: {e}"


def check_consult_file(work: Path) -> tuple[dict, list[str]]:
    f = Path(work) / "out" / "consult.json"
    if not f.exists():
        return {}, ["out/consult.json がまだありません"]
    data, err = _read_json(f)
    return ({}, [err]) if err else validate_consult(data, work)


def check_work(work: Path) -> tuple[dict, list[str]]:
    """rt.py check：見直し（consult.md がある）なら consult.json、読影なら report.json を確かめる"""
    return check_consult_file(work) if (Path(work) / "consult.md").exists() else check_file(work)


def check_file(work: Path) -> tuple[dict, list[str]]:
    f = Path(work) / "out" / "report.json"
    if not f.exists():
        return {}, ["out/report.json がまだありません"]
    try:
        data = json.loads(f.read_text(encoding="utf-8-sig"))
    except Exception as e:  # noqa: BLE001
        return {}, [f"out/report.json を読めません（JSONの書き方の誤り）: {e}"]
    return validate(data, work)
