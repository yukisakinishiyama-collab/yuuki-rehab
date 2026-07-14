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

```bash
# Instagramフィード画像（縦長4:5・1080x1350）
node tools/sns-automation/image-gen/generate-post-image.mts "足首の捻挫、応急処置のポイント"

# リール/ストーリーズ（縦長9:16・1080x1920）
node tools/sns-automation/image-gen/generate-post-image.mts "運動療法という選択肢" --use instagram_reel_cover

# Google投稿用（縦長4:5）
node tools/sns-automation/image-gen/generate-post-image.mts "物理療法の役割" --use google_post

# 細かい図解を含む場合のみ高品質
node tools/sns-automation/image-gen/generate-post-image.mts "RICE処置の手順" --quality high

# APIを呼ばず全工程を検証（課金なし・レイアウト確認用）
node tools/sns-automation/image-gen/generate-post-image.mts "テーマ" --mock
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

```
content/YYYY-MM-DD-topic/
  image-spec.json          … 画像の設計図（検証済み）
  image-prompt.txt         … gpt-image-2 へ渡したプロンプト
  generated-original.png   … 生成された原画
  instagram-1080x1350.png  … 完成画像（文字合成済み。リールは-1920）
  caption.md               … 投稿本文＋患者向け要点
  references.md            … 医学的根拠・出典
  approval-checklist.md     … 自動チェック結果＋院長の最終確認欄
```

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
