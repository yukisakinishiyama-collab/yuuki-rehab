# 画像づくり用のフォント（サーバーで投稿画像を作るとき）

Instagram・Googleの投稿画像（ストーリーの空き状況・テンプレート画像）は、サーバー（Vercel）で作る。
サーバーには日本語のフォントが入っていないため、ここのフォントを読み込んで描く（`src/lib/marketing/image-template.tsx`）。

- Zen Kaku Gothic New（400・700）日本語＋欧文・数字
- 出どころ：npm の `@fontsource/zen-kaku-gothic-new` 5.3.1 の `files/zen-kaku-gothic-new-japanese-*-normal.woff`
- ライセンス：SIL Open Font License 1.1
- `next.config.ts` の `outputFileTracingIncludes` で、サーバーの処理に同梱する
