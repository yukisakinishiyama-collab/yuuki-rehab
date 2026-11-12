# フォント（サイト・院内アプリ共通）

ビルドのたびに Google Fonts から取りに行くと、Vercel のビルドで取得に失敗してビルドが止まることがあった（2026-10-23 に2回）。
そのため、Google Fonts から取りに行くのをやめて、同じフォントをこのリポジトリ（と npm パッケージ）から読み込む。
見た目はこれまでと同じ（同じフォント・同じ太さ）。

| フォント | 太さ | 読み込み方 | ライセンス |
|---|---|---|---|
| Sora | 400 / 500 / 600 / 700 / 800 | このフォルダの woff2（欧文）を `next/font/local` で | SIL Open Font License 1.1 |
| IBM Plex Sans | 400 / 500 / 600 | 同上 | SIL Open Font License 1.1 |
| IBM Plex Mono | 400 / 500 | 同上 | SIL Open Font License 1.1 |
| Zen Kaku Gothic New | 400 / 500 / 700 | npm の `@fontsource/zen-kaku-gothic-new`（日本語を含む。文字の範囲ごとに分かれていて、使う文字の分だけ読み込まれる） | SIL Open Font License 1.1 |

このフォルダのファイルは npm の @fontsource（sora 5.3.0／ibm-plex-sans 5.3.0／ibm-plex-mono 5.3.0）の `files/*-latin-*-normal.woff2`。
