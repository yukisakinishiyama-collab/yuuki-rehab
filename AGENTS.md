<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## 画像アセットの追加ルール（ChatGPT / Codex 等の外部AIエージェント向け）

このリポジトリにイラスト画像を追加する場合は、以下に従うこと:

1. 画像は `public/illustrations/` に **PNG** で追加する
2. ファイル名は `src/lib/illustrations.ts` の `ILLUSTRATION_SLOTS` に定義された
   スロット名に一致させる（例: `fracture-cast-forearm.png`）。
   一致すればコード変更なしで該当画面に自動表示される
3. **画像追加のためにコード（.ts/.tsx）を変更しないこと**。新しいスロットが必要な場合のみ
   `ILLUSTRATION_SLOTS` への追記を提案する
4. `main` へ直接コミットせず **Pull Request を作成**する（最終確認は院長が行う）
5. `.env*` ファイルは読まない・変更しない
6. 医療広告ガイドラインに配慮し、治癒を保証するような誇張表現の画像は追加しない

※ 再デプロイなしで反映したい場合は、アプリ内の「イラスト管理」画面（/illustrations）から
アップロードする方法もある（Vercel Blob 保存・コミット不要）。
<!-- END:nextjs-agent-rules -->
