#!/usr/bin/env python3
"""Markdown記事をnote貼り付け用HTMLに変換するツール。

使い方:
    python tools/note-converter/convert-to-note.py 記事.md

入力ファイルと同じディレクトリに「<ファイル名>.note.html」を出力する。
"""

import argparse
import base64
import html
import mimetypes
import re
import sys
from pathlib import Path

# **text** を <strong>text</strong> に変換する正規表現
BOLD_PATTERN = re.compile(r"\*\*(.+?)\*\*")

# ![alt](path) を画像行として認識する正規表現（行全体が画像記法のみの場合）
IMAGE_PATTERN = re.compile(r"^!\[([^\]]*)\]\(([^)]+)\)$")


def inline(text: str) -> str:
    """行内のHTMLエスケープと太字変換をおこなう。"""
    escaped = html.escape(text, quote=False)
    return BOLD_PATTERN.sub(r"<strong>\1</strong>", escaped)


def render_image(alt: str, rel_path: str, base_dir: Path) -> str | None:
    """画像ファイルをbase64エンコードし、埋め込み用の<p><img>タグを返す。

    画像ファイルが見つからない場合は警告を表示してNoneを返す（呼び出し側で行をスキップする）。
    """
    img_path = (base_dir / rel_path).resolve()
    if not img_path.is_file():
        print(f"警告: 画像ファイルが見つかりません（スキップします）: {rel_path}", file=sys.stderr)
        return None

    mime_type = mimetypes.guess_type(img_path.name)[0] or "image/png"
    encoded = base64.b64encode(img_path.read_bytes()).decode("ascii")
    alt_escaped = html.escape(alt, quote=True)
    return f'<p><img src="data:{mime_type};base64,{encoded}" alt="{alt_escaped}"></p>'


def convert(markdown_text: str, base_dir: Path) -> str:
    """Markdownテキストをnote用HTMLフラグメントに変換する。"""
    lines = markdown_text.split("\n")
    blocks: list[str] = []
    i = 0
    n = len(lines)

    while i < n:
        stripped = lines[i].strip()

        if stripped == "":
            i += 1
            continue

        image_match = IMAGE_PATTERN.match(stripped)
        if image_match:
            alt_text, rel_path = image_match.group(1), image_match.group(2)
            image_tag = render_image(alt_text, rel_path, base_dir)
            if image_tag:
                blocks.append(image_tag)
            i += 1
            continue

        if stripped.startswith("### "):
            blocks.append(f"<h3>{inline(stripped[4:].strip())}</h3>")
            i += 1
            continue

        if stripped.startswith("## "):
            blocks.append(f"<h2>{inline(stripped[3:].strip())}</h2>")
            i += 1
            continue

        if stripped.startswith("# "):
            blocks.append(f"<h2>{inline(stripped[2:].strip())}</h2>")
            i += 1
            continue

        if stripped.startswith("- "):
            items = []
            while i < n and lines[i].strip().startswith("- "):
                items.append(lines[i].strip()[2:].strip())
                i += 1
            li_html = "".join(f"<li>{inline(item)}</li>" for item in items)
            blocks.append(f"<ul>{li_html}</ul>")
            continue

        if stripped.startswith("> "):
            quote_lines = []
            while i < n and lines[i].strip().startswith("> "):
                quote_lines.append(lines[i].strip()[2:].strip())
                i += 1
            quote_text = " ".join(quote_lines)
            blocks.append(f"<blockquote><p>{inline(quote_text)}</p></blockquote>")
            continue

        # 通常の段落（見出し/箇条書き/引用でない行が続く限り1つの段落として結合）
        para_lines = []
        while i < n:
            current = lines[i].strip()
            if current == "" or current.startswith(("#", "- ", "> ")) or IMAGE_PATTERN.match(current):
                break
            para_lines.append(current)
            i += 1
        para_text = " ".join(para_lines)
        blocks.append(f"<p>{inline(para_text)}</p>")

    return "\n".join(blocks) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Markdown記事をnote貼り付け用HTMLに変換する")
    parser.add_argument("input", help="変換元のMarkdownファイル（例: 記事.md）")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.is_file():
        print(f"エラー: ファイルが見つかりません: {input_path}", file=sys.stderr)
        sys.exit(1)

    markdown_text = input_path.read_text(encoding="utf-8")
    html_output = convert(markdown_text, base_dir=input_path.parent)

    output_path = input_path.with_suffix("").with_suffix(".note.html")
    output_path.write_text(html_output, encoding="utf-8")

    print(f"変換完了: {output_path}")


if __name__ == "__main__":
    main()
