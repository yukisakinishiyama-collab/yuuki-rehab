"""確かめ済みのレポート内容（reportschema.validate の結果）を A4 の HTML → PDF にする。

見出し（氏名・患者ID・撮影日・施設・装置）と免責の文はここで入れる。AIには書かせない。
PDF はパソコンの Chrome／Edge（画面なし）で作る。
"""
from __future__ import annotations

import base64
import html
import io
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

from . import dicomio

DISCLAIMER = ("本書は柔道整復師の施術方針決定を補助する目的で作成した参考意見であり、確定診断ではありません。"
              "画像診断は医師（放射線科専門医・整形外科医）の読影をもって確定されます。"
              "症状が持続・増悪する場合は必ず医師の診察を受けてください。")
ESTIMATE_NOTE = "上記は統計値ではなく、読影者（AI）による主観的な見積もりです。圧痛点の正確な位置や診察所見で順位は大きく変わります。"

CSS = """
@page { size: A4; margin: 15mm 14mm 14mm 14mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Yu Gothic UI", "Yu Gothic", "Meiryo", "Hiragino Sans", "Noto Sans CJK JP", "Noto Sans JP", sans-serif;
  font-size: 9.6pt; line-height: 1.62; color: #1c2430; margin: 0; }
h1 { font-size: 15.5pt; margin: 0 0 3pt; line-height: 1.35; }
h1 small { font-weight: 600; font-size: 13pt; }
.sub { font-size: 8.4pt; color: #4b5563; border-bottom: 1.2pt solid #1f3a5f; padding-bottom: 5pt; margin-bottom: 7pt; }
.meta { display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 2pt 14pt; font-size: 8.8pt; margin-bottom: 8pt; }
.meta div span { color: #5b6573; margin-right: 5pt; }
.complaint { background: #fdf6dc; border-left: 3pt solid #e0b93a; padding: 6pt 9pt; margin: 0 0 9pt; font-size: 9.2pt; }
.summary { border: 1.1pt solid #7fa3d1; background: #f3f7fc; border-radius: 6pt; padding: 8pt 11pt 6pt; margin: 0 0 10pt; }
.summary h2 { font-size: 11pt; margin: 0 0 3pt; background: none; padding: 0; border: 0; }
.summary ul { margin: 0; padding-left: 14pt; }
.summary li { margin: 0 0 4pt; }
h2 { font-size: 11.2pt; background: #e9eff6; border-left: 3.2pt solid #1f3a5f; padding: 4pt 8pt; margin: 13pt 0 7pt;
  break-after: avoid; page-break-after: avoid; }
h3 { font-size: 10pt; margin: 9pt 0 3pt; color: #1f3a5f; break-after: avoid; page-break-after: avoid; }
p { margin: 0 0 6pt; }
.note { font-size: 8.4pt; color: #4b5563; }
.box { border: 1pt solid #c9d3df; background: #fafbfc; border-radius: 5pt; padding: 7pt 10pt; margin: 0 0 8pt;
  break-inside: avoid; page-break-inside: avoid; }
.box .t { font-weight: 700; margin-bottom: 2pt; }
ul, ol { margin: 0 0 7pt; padding-left: 16pt; }
li { margin: 0 0 2.5pt; }
table { border-collapse: collapse; width: 100%; margin: 0 0 8pt; font-size: 8.8pt; }
th { background: #eef2f6; text-align: left; font-weight: 700; }
th, td { border-top: 0.6pt solid #b8c2ce; border-bottom: 0.6pt solid #b8c2ce; padding: 3.5pt 6pt; vertical-align: top; }
tr { break-inside: avoid; page-break-inside: avoid; }
td.num { white-space: nowrap; text-align: right; font-weight: 700; }
figure { margin: 4pt auto 8pt; break-inside: avoid; page-break-inside: avoid; text-align: center; }
figure img { max-width: 100%; display: block; margin: 0 auto; }
figcaption { font-size: 8.2pt; color: #374151; text-align: left; margin-top: 3pt; line-height: 1.5; }
.refs { font-size: 7.8pt; color: #374151; padding-left: 14pt; }
.refs li { margin-bottom: 1.5pt; }
.disclaimer { margin-top: 10pt; border-top: 0.8pt solid #9aa5b1; padding-top: 5pt; font-size: 8pt; color: #4b5563; }
"""


def esc(s) -> str:
    return html.escape(str(s or ""), quote=True)


def rich(s) -> str:
    """**…** を太字に。それ以外はそのままの文字（HTMLとしては解釈しない）。"""
    t = esc(s)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    return t.replace("\n", "<br>")


def _img_data(path: Path, max_bytes: int) -> str:
    raw = path.read_bytes()
    if len(raw) > max_bytes:
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        q = 80
        while True:
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=q, optimize=True)
            if buf.tell() <= max_bytes or q <= 45:
                if buf.tell() > max_bytes:
                    im = im.resize((int(im.width * 0.8), int(im.height * 0.8)), Image.LANCZOS)
                    q = 70
                    continue
                raw = buf.getvalue()
                break
            q -= 8
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


def _blocks(blocks: list[dict], ctx: dict) -> str:
    out = []
    for b in blocks:
        t = b["type"]
        if t == "p":
            out.append(f"<p>{rich(b['text'])}</p>")
        elif t == "note":
            out.append(f"<p class='note'>{rich(b['text'])}</p>")
        elif t == "h3":
            out.append(f"<h3>{esc(b['text'])}</h3>")
        elif t == "box":
            title = f"<div class='t'>{esc(b['title'])}</div>" if b.get("title") else ""
            out.append(f"<div class='box'>{title}{rich(b['text'])}</div>")
        elif t == "list":
            tag = "ol" if b.get("ordered") else "ul"
            out.append(f"<{tag}>" + "".join(f"<li>{rich(x)}</li>" for x in b["items"]) + f"</{tag}>")
        elif t == "figure":
            f = Path(ctx["work"]) / b["file"]
            if f.is_file():
                out.append(f"<figure><img style='width:{int(b.get('width', 100))}%' src='{_img_data(f, ctx['fig_bytes'])}'>"
                           f"<figcaption>{rich(b['caption'])}</figcaption></figure>")
        elif t == "table":
            widths = b.get("widths")
            col = "".join(f"<col style='width:{w}%'>" for w in widths) if widths else ""
            head = "".join(f"<th>{esc(c)}</th>" for c in b["columns"])
            rows = "".join("<tr>" + "".join(f"<td>{rich(c)}</td>" for c in r) + "</tr>" for r in b["rows"])
            out.append(f"<table><colgroup>{col}</colgroup><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>")
        elif t == "series_table":
            rows = dicomio.series_rows(ctx["series"])
            if rows:
                head = "".join(f"<th>{c}</th>" for c in ("シリーズ", "条件（TR/TE/TI ms）", "厚さ／間隔", "枚数", "画素"))
                body = "".join("<tr>" + (f"<td>{esc(r[0])}</td><td colspan='4'>{esc(r[1])}</td>" if len(r) == 2
                                         else "".join(f"<td>{esc(c)}</td>" for c in r)) + "</tr>" for r in rows)
                out.append(f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>")
        elif t == "estimates" and ctx["estimates"]:
            body = "".join(f"<tr><td>{rich(e['condition'])}</td><td class='num'>約{e['percent']}%</td><td>{rich(e['basis'])}</td></tr>"
                           for e in ctx["estimates"])
            out.append("<table><colgroup><col style='width:38%'><col style='width:11%'><col style='width:51%'></colgroup>"
                       "<thead><tr><th>考えられる状態</th><th>見積もり</th><th>根拠</th></tr></thead>"
                       f"<tbody>{body}</tbody></table><p class='note'>{ESTIMATE_NOTE}</p>")
    return "\n".join(out)


def build_html(report: dict, header: dict, series: list[dict], work: Path, fig_bytes: int = 520_000) -> str:
    """header: name, patient_id, age_text, sex_ja, study_date, times, institution, weight_kg, equipment, counts,
    complaint, created, author"""
    counts = header.get("counts") or {}
    mods = "・".join(counts.keys())
    count_text = "・".join(f"{k} {v}枚" for k, v in counts.items())
    times = header.get("times") or {}
    when = header.get("study_date") or ""
    tparts = [f"{k} {v[1]}" for k, v in times.items() if v and v[1]]
    if tparts:
        when += f"（{'／'.join(tparts)}）"
    meta = [("氏名", f"{header.get('name') or '（未記入）'} 様"), ("患者ID", header.get("patient_id") or "—"),
            ("年齢・性別", "・".join(x for x in (header.get("age_text"), header.get("sex_ja")) if x) or "—"),
            ("撮影日", when or "—"), ("撮影施設", header.get("institution") or "—")]
    if header.get("weight_kg"):
        try:
            meta.append(("体重（DICOM）", f"{float(header['weight_kg']):g} kg"))
        except ValueError:
            pass
    for k, v in (header.get("equipment") or {}).items():
        meta.append((f"{k}装置", v))
    meta.append(("作成", f"{header.get('created') or ''} {header.get('author') or 'Claude（AI）'}".strip()))
    ctx = {"work": work, "series": series, "estimates": report.get("estimates") or [], "fig_bytes": fig_bytes}
    parts = [
        "<!doctype html><html lang='ja'><head><meta charset='utf-8'>",
        f"<title>画像所見レポート {esc(report.get('title_region'))}</title><style>{CSS}</style></head><body>",
        f"<h1>画像所見レポート（参考意見）<small>— {esc(report.get('title_region'))} {esc(mods)}</small></h1>",
        f"<div class='sub'>柔道整復師の施術方針決定を補助するための二次読影。患者CDのDICOM原画像（{esc(count_text)}）を全スライス読んで作成。</div>",
        "<div class='meta'>" + "".join(f"<div><span>{esc(k)}</span>{esc(v)}</div>" for k, v in meta) + "</div>",
    ]
    if header.get("complaint"):
        parts.append(f"<div class='complaint'><b>主訴（ご提供情報）</b>：{rich(header['complaint'])}</div>")
    parts.append("<div class='summary'><h2>総括</h2><ul>" + "".join(f"<li>{rich(s)}</li>" for s in report.get("summary") or []) + "</ul></div>")
    for sec in report.get("sections") or []:
        parts.append(f"<h2>{esc(sec['heading'])}</h2>")
        parts.append(_blocks(sec["blocks"], ctx))
    if report.get("references"):
        parts.append("<h2>文献</h2><ol class='refs'>" + "".join(f"<li>{esc(r)}</li>" for r in report["references"]) + "</ol>")
    parts.append(f"<div class='disclaimer'>{esc(DISCLAIMER)}</div></body></html>")
    return "\n".join(parts)


BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def find_browser(configured: str | None = None) -> str | None:
    for c in [configured, os.environ.get("YDR_BROWSER"), *BROWSERS]:
        if c and Path(c).is_file():
            return c
    for name in ("chromium", "chromium-browser", "google-chrome", "chrome", "msedge"):
        p = shutil.which(name)
        if p:
            return p
    try:  # テスト環境（Playwright の Chromium）
        from playwright.sync_api import sync_playwright  # type: ignore
        with sync_playwright() as pw:
            p = pw.chromium.executable_path
            if p and Path(p).is_file():
                return p
    except Exception:  # noqa: BLE001
        pass
    return None


def html_to_pdf(html_path: Path, pdf_path: Path, browser: str | None = None, timeout: int = 120) -> None:
    exe = find_browser(browser)
    if not exe:
        raise RuntimeError("PDFを作るための Chrome／Edge が見つかりません")
    pdf_path.unlink(missing_ok=True)
    with tempfile.TemporaryDirectory(prefix="ydr-chrome-") as prof:  # ふだんのブラウザの設定とは別にする
        cmd = [exe, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
               f"--user-data-dir={prof}", "--no-pdf-header-footer", f"--print-to-pdf={pdf_path}", html_path.resolve().as_uri()]
        if os.name != "nt":
            cmd.insert(1, "--no-sandbox")
        kw = {"creationflags": 0x08000000} if os.name == "nt" else {}
        r = subprocess.run(cmd, capture_output=True, timeout=timeout, **kw)
    if not pdf_path.is_file() or pdf_path.stat().st_size < 1000:
        raise RuntimeError(f"PDFを作れませんでした：{(r.stderr or b'').decode('utf-8', 'replace')[-300:]}")


def make_pdf(report: dict, header: dict, series: list[dict], work: Path, out_dir: Path, max_bytes: int,
             browser: str | None = None) -> tuple[Path, Path]:
    """大きすぎたら図を圧縮し直して、max_bytes に収める。"""
    out_dir.mkdir(parents=True, exist_ok=True)
    html_path, pdf_path = out_dir / "report.html", out_dir / "report.pdf"
    for fig_bytes in (520_000, 300_000, 180_000, 110_000):
        html_path.write_text(build_html(report, header, series, work, fig_bytes), encoding="utf-8")
        html_to_pdf(html_path, pdf_path, browser)
        if pdf_path.stat().st_size <= max_bytes:
            return html_path, pdf_path
    raise RuntimeError("PDFが大きすぎます（図を減らしてください）")
