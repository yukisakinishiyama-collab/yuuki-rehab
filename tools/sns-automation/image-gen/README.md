# SNS投稿画像 自動生成（image-gen）

投稿テーマから、Instagram/Google投稿用の**画像＋本文＋出典＋承認チェックリスト**を
一括生成する。**外部投稿は一切行わず、承認用フォルダに成果物を保存するまで**が責務。

## 構成技術

- Node.js + TypeScript（`.mts` を Node が直接実行）
- OpenAI SDK（画像生成モデル `gpt-image-2`）
- Sharp（リサイズ・文字合成）
- Zod（ImageSpec検証）
- 本文・ImageSpecの立案は Claude API（`claude-opus-4-8`）

## セットアップ

```bash
# 依存はリポジトリ全体で導入済み（openai, sharp, zod）
# .env または .env.local に追加（.env系はGitにコミットされない）
OPENAI_API_KEY=sk-proj-xxxxxxxx
```

## 使い方

### 媒体別モード（--platform）— 推奨

一つのテーマと共有の医学的根拠から、媒体ごとに最適化した成果物を生成する。

```bash
# Instagramのみ
node tools/sns-automation/image-gen/generate-post-image.mts "足首の捻挫、応急処置のポイント" --platform instagram
# Google投稿のみ
node tools/sns-automation/image-gen/generate-post-image.mts "..." --platform google
# note記事のみ（記事本文＋横長見出し画像＋批判的吟味＋承認チェック）
node tools/sns-automation/image-gen/generate-post-image.mts "..." --platform note
# 全媒体（同じ医学的根拠を共有して個別生成）
node tools/sns-automation/image-gen/generate-post-image.mts "..." --platform all
```

- Instagram本文をそのまま引き延ばしてnote記事にはしない（媒体ごとに再構成）
- 出力は `content/YYYY-MM-DD-topic/{shared,instagram,google,note}/`
- note記事は13セクション構成・2000〜4000字（必要時6000字まで）
- **引用文献は捏造しない**。確認できない引用は `status: needs_confirmation` とし、
  「要確認」が残る記事は承認チェックで**公開不可**と判定する

### 既定モード（--platform 未指定）— 従来動作を維持

```bash
# Instagramフィード画像（縦長4:5・1080x1350）
node tools/sns-automation/image-gen/generate-post-image.mts "足首の捻挫、応急処置のポイント"
# リール/ストーリーズ（縦長9:16・1080x1920）
node tools/sns-automation/image-gen/generate-post-image.mts "運動療法という選択肢" --use instagram_reel_cover
# 細かい図解を含む場合のみ高品質
node tools/sns-automation/image-gen/generate-post-image.mts "RICE処置の手順" --quality high
```

### モックモード（--mock）

APIを呼ばず全工程を検証（課金なし・レイアウト確認用）。--platform と併用可。

```bash
node tools/sns-automation/image-gen/generate-post-image.mts "テーマ" --platform all --mock
```

## 生成フロー

1. テーマ → 投稿本文案・医学的事実・患者向け説明を作成（Claude）
2. ImageSpec(JSON)を生成 → **Zodで検証**（不正なら中断）
3. ImageSpec → 画像生成プロンプト（用途→対象読者→主題→場面→構図→表現→光色→医学的制約→禁止事項の順）
4. `gpt-image-2` で画像生成（縦長4:5は1088×1360、9:16は1152×2048で生成）
5. PNG保存 → **Sharpで最終サイズへ変換**（1080×1350 / 1080×1920）
6. **タイトル・院名・注意書きはSharp+SVGで後から合成**（画像生成AIには文字を描かせない）
7. 品質チェック → `content/YYYY-MM-DD-topic/` に成果物一式を保存

## 出力

### 既定モード（--platform 未指定）

```
content/YYYY-MM-DD-topic/
  image-spec.json / image-prompt.txt / generated-original.png
  instagram-1080x1350.png（リールは-1920）/ caption.md / references.md / approval-checklist.md
```

### 媒体別モード（--platform）

```
content/YYYY-MM-DD-topic/
  shared/     medical-facts.json, source-references.json（全媒体で共有）
  instagram/  image-spec.json, image-prompt.txt, generated-original.png,
              instagram-1080x1350.png, caption.md, approval-checklist.md
  google/     image-spec.json, generated-original.png, google-post-image.png,
              post-text.md, approval-checklist.md
  note/       note-spec.json, note-image-prompt.txt, note-cover-original.png,
              note-cover-1280x670.png, note-cover-1920x1006.png,
              note-article.md, note-summary.txt, note-title-options.md,
              note-hashtags.txt, note-references.md,
              note-critical-appraisal.md, note-approval-checklist.md
```

## note見出し画像

- 標準 1280×670px / 高精細 1920×1006px（約1.91:1）
- 主要要素は中央付近、上下左右に安全余白、タイトルは2行以内で端に寄せない
- Instagram用4:5を切り抜かず、横長用に構図を再設計（別プロンプトで生成）
- 院名は控えめ、長い注意書きは入れない

## noteの投稿運用

noteへの公式投稿APIが確認できないため、自動投稿・自動ログイン・
Puppeteer等による無断公開は実装しない。完成した `note-article.md` と
見出し画像を使い、**note管理画面上で院長が確認して手動投稿・予約投稿**する。

## 安全設計

- **APIキーをコードに直書きしない**（環境変数/.envから読む）。`.env`・`content/` はGit管理外
- **エラーログにキー・患者情報を含めない**（HTTPステータスのみ表示）
- **患者の実名・顔写真・カルテ情報をAPIへ送らない**（テーマ文字列のみ送信）
- **実在患者をモデルにした画像を生成しない**（プロンプトで実在人物への類似を禁止）
- 再試行は **429/5xx のみ最大3回・指数バックオフ**。モデレーション拒否は再試行しない（無限ループ防止）
- 生成物は**承認用**。院長が `approval-checklist.md` を全項目チェックするまで外部投稿しない

## 医療広告ガイドライン対応

画像プロンプトに以下を常時付与:
- 人体を解剖学的に不自然に描かない／病変を確定診断的に描かない
- 痛みを炎・稲妻で誇張しない／治癒・改善・完治を保証する描写をしない
- 医師・他院を否定しない／文字・ロゴ・ウォーターマークを描かない

本文・タイトル・サブタイトルは `spec.mts` の禁止表現リストで自動検査する。
