# 読影プログラム（yuuki-dicom-reader）

院内アプリのカルテ「画像レポート」タブから呼ばれて、**院のパソコンの中で** 次のことをする小さな常駐プログラムです。

1. 患者さんのCD（DICOM）を読む（単純X線・MRI・CT）
2. このパソコンの Claude Code（院長の Claude のプラン）に、原画像を全スライス読ませる
3. 画像所見レポート（参考意見・A4のPDF）を作る → カルテの画面で下書きを確かめて「カルテに提出する」

以前の「症例アシスト」（別のアプリ）は 2026-11-18 に削除し、読影だけをカルテの中に移しました。

## 入れ方・更新（院のパソコンで）

```
powershell -ExecutionPolicy Bypass -File tools\dicom-reader\install.ps1
```

- 要るもの：Python 3.11 以上、Claude Code（`claude` でログイン済み）、Chrome か Edge
- プログラムは `%USERPROFILE%\yuuki-dicom-reader`、設定と下書きは `%LOCALAPPDATA%\yuuki-dicom-reader`
- パソコンにログインすると自動で起動します。止まっているときは、デスクトップの「読影プログラムを起動」
- 動いているかは、ブラウザで <http://127.0.0.1:8791/health>

## 決まり（大事）

- **氏名・患者ID・生年月日・施設名・撮影日はAIに渡さない。** AIの作業フォルダには、画素の配列と撮像条件（TR/TE・厚さ・向き）、
  年齢・性別、主訴だけを置く。氏名などは、PDFの見出しにプログラムが入れる（`reader/render.py`）
- 画像に焼きこまれた文字（氏名など）は自動では消せない。カルテの画面で、見本の画像を見て確かめてから始める
- 呼べるのは院内アプリのページだけ（`Origin` を確かめる。既定は本番の2つのアドレス）。127.0.0.1 でだけ待つ
- 読めるのは CD・USB と、設定の `folders` に書いたフォルダだけ
- 読影は同時に1件。下書き（PDF・図）はこのパソコンに置き、カルテに提出したら消す。提出しないままの下書きは7日で消す
- Claude Code には、作業フォルダの中だけを読み書きさせ、`python rt.py …` だけを実行させる
  （`--restricted --strict-mcp-config --disable-slash-commands`。コネクタやスキルを読み込ませない＝使用枠を無駄にしない）
- AIが書くのは `out/report.json`（決まった形）と図の指定だけ。HTML・PDF は書かせない（`reader/reportschema.py` で形を確かめる）
- 免責の文（参考意見であり確定診断ではない）と「見積もりは主観的」の注記は、プログラムが必ず入れる

## 設定（`%LOCALAPPDATA%\yuuki-dicom-reader\config.json`。無ければ既定）

```json
{
  "origins": ["https://yuuki-rehab.vercel.app", "https://shimonoseki-yuuki.com", "https://www.shimonoseki-yuuki.com"],
  "folders": [],
  "model": null,
  "effort": null,
  "timeout_min": 45,
  "keep_days": 7
}
```

- `origins`：呼んでよいページ。プレビュー（Vercel の一時的なアドレス）で試すときは、そのアドレスを足す
- `folders`：CD のほかに読んでよいフォルダ（例：CDを写したフォルダ）
- `model`・`effort`：Claude Code に渡す指定（空なら Claude Code の既定）

## 中身

| ファイル | 役目 |
|---|---|
| `reader/server.py` | 127.0.0.1:8791 で待つ。読影の進行（1件ずつ）・下書きの置き場 |
| `reader/dicomio.py` | CDを探す・検査の一覧と見本・氏名などを除いて作業フォルダへ読み込む |
| `reader/agent.py` | Claude Code を動かす（途中経過を拾う・使用枠やログイン切れを日本語で伝える） |
| `reader/workspace/INSTRUCTIONS.md` | AIへの読影の手順（左右の確定・連続評価・直接所見を先に・過剰読影の防止・図・書き方） |
| `reader/workspace/rt.py` | AIが使う道具（一覧・連続表示・拡大・信号の測定・距離・断面の対応・図・点検） |
| `reader/imaging.py` | 画像の共通処理（rt.py と共用） |
| `reader/reportschema.py` | `report.json` の形を確かめる |
| `reader/render.py` | 見出し・免責を入れて HTML → PDF（Chrome／Edge） |

## テスト（架空の画像・Claude Code の代わりを使う。外には送らない）

```
pip install numpy pydicom pillow pytest playwright
python -m pytest tools/dicom-reader/tests -q
```
