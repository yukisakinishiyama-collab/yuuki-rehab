# SNS自動化ツール（sns-automation）

ゆうき整骨院のSNS・Google集客自動化ツール群。**既存アプリ（`src/`）からは完全に独立**しており、
このディレクトリのスクリプトを実行しても本番アプリ・データには一切影響しない。

## 前提

- Node.js（リポジトリの `node_modules` を使うため `npm install` 済みであること）
- 記事生成には `.env.local` の `ANTHROPIC_API_KEY` を使用（コンプライアンスチェックはAPI不要）

## ツール一覧

### 1. 記事ドラフト生成 — `generate-article.mjs`

テーマを渡すと、院の方針・医療広告ガイドラインに沿った記事ドラフトを生成して `drafts/` に保存する。
保存後にNG表現チェックが自動で走る。

```bash
node tools/sns-automation/generate-article.mjs "足首の捻挫を放置するとどうなる？"
node tools/sns-automation/generate-article.mjs "膝の術後リハビリの流れ" --type blog
node tools/sns-automation/generate-article.mjs "部活で足首を捻った学生さんへ" --type instagram
```

- `--type note`（既定）: note投稿用 2000〜3000字
- `--type blog`: 公式サイトブログ用（地域SEO・Q&A付き）
- `--type instagram`: Instagram投稿文（ハッシュタグ・CTA付き）

### 2. 医療広告ガイドラインチェック — `check-compliance.mjs`

記事から「必ず治る」「No.1」等のNG表現・グレー表現を検出し、言い換え例を提示する。
ローカル処理のみでAPIは使わない。

```bash
node tools/sns-automation/check-compliance.mjs drafts/20260714-note-1.md
node tools/sns-automation/check-compliance.mjs --all   # note-converter/ と drafts/ を一括チェック
```

終了コードで判定できる（NGあり=1）ため、公開前の機械チェックとして他ツールにも組み込める。

### 3. 投稿管理表チェック — `check-posts.mjs`

スプレッドシート「ゆうき整骨院_投稿管理表」をCSVでダウンロードして渡すと、
全投稿のNG表現チェックと、本文未作成の記事枠の洗い出しを一括で行う。

```bash
node tools/sns-automation/check-posts.mjs 投稿管理表.csv
```

### 4. 口コミ返信の下書き生成 — `generate-review-reply.mjs`

Google口コミの本文を渡すと、ガイドラインに配慮した返信案を3案生成する。
低評価にも対応（謝罪→改善姿勢→窓口案内の構成）。

```bash
node tools/sns-automation/generate-review-reply.mjs "口コミの本文" --stars 5
```

### 5. 投稿分析レポート — `report-posts.mjs`

投稿管理表のKPI列（再生数・保存数・LINE登録数・予約数）を集計し、
媒体別サマリー・再生数トップ3・保存率ランキング・集客成果をMarkdownで出力する。
数字はInstagramアプリの「インサイト」画面からスプレッドシートに転記する運用
（投稿48時間後と1週間後の2回が目安）。

```bash
node tools/sns-automation/report-posts.mjs 投稿管理表.csv --save   # reports/ に保存
```

## ワークフロー（note記事の場合）

```
generate-article.mjs でドラフト生成
  → drafts/ のMarkdownを目視確認・修正
  → check-compliance.mjs で最終チェック
  → python tools/note-converter/convert-to-note.py drafts/xxx.md でnote貼り付け用HTMLに変換
  → 投稿管理スプレッドシートにリンク記載 → 院長承認 → 投稿
```

## 今後の拡張予定（フェーズ2以降）

- 投稿管理スプレッドシート（Googleスプレッドシート）との連携: 投稿計画の読み取り・文案の自動生成
- Google口コミ返信の下書き自動生成
- Instagram投稿の分析レポート

## 注意事項

- 生成された記事は必ず**人（院長）が確認してから**公開すること（AIは臨床判断の代替ではない）
- `drafts/` は下書き置き場。公開済み記事の原稿は `tools/note-converter/` に移すこと
- APIキー・トークンをこのディレクトリのファイルにハードコードしない
