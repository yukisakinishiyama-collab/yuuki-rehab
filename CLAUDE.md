# CLAUDE.md

このファイルは、リポジトリで作業する Claude Code (claude.ai/code) へのガイダンスを提供します。

@AGENTS.md

## コマンド

```bash
npm run dev      # 開発サーバー起動 (localhost:3000)
npm run build    # 本番ビルド
npm run lint     # ESLint
```

テストスイートは未設定。

## アーキテクチャ

ゆうき整骨院の院内アプリで、同一の Next.js App Router 上に二つの独立した領域がある。

**公開サイト** — `src/app/(website)/` — 症状別ページ（ACL、半月板など）、ブログ、FAQ、料金。コンポーネントは `src/components/site/`。

**スタッフ用リハビリアプリ** — `src/app/(app)/` — ケース管理・動画アノテーション・AI 分析。コンポーネントは `src/components/rehab/`。

### データ層

バックエンド DB は存在しない。ケース・コメント・評価の状態はすべて `src/lib/rehab-store.ts` 経由で `localStorage` に永続化される。初期モックデータは `src/lib/rehab-data.ts`。実サーバー処理は `src/app/api/` の三本のルートのみ：

- `/api/ai-summary` — Anthropic SDK を呼び出し、専門家パネル（整形外科医・トレーナー・PT）の意見を取得
- `/api/upload` — Vercel Blob への動画アップロード（最大 500 MB）用トークンを発行
- `/api/submit` — 公開用受付フォームの送信処理

### 動画・姿勢解析

`src/lib/pose-analyzer.ts` が `@mediapipe/tasks-vision` をラップし、動画フレームから関節角度（膝・股関節・肩・足首・体幹など）を算出する。`@mediapipe/tasks-vision` は `next.config.ts` の `serverExternalPackages` に登録済みで、バンドルしてはならない。

Canvas ベースのアノテーション（線・角度・矢印・円・フリーハンド・テキスト）は `src/components/rehab/VideoAnnotation*` にある。

### スタイリング

Tailwind CSS 4（`@tailwindcss/postcss` 経由）。カスタムトークン（`--color-navy`、`--color-line`）と `.hero-h1` のレスポンシブ見出しは `src/app/globals.css` の `@theme` で定義。CSS Modules は使用しない。日本語フォントスタック（Hiragino Sans → Noto Sans JP）。

### 型定義

ドメイン型は `src/types/rehab.ts`（Case、Video、User、Annotation、Evaluation など）。`src/types/index.ts` には旧型セット（DiseaseType、Exercise、Patient）があり、`src/lib/data.ts` のリハビリメニュー・運動データで使用される。

### パスエイリアス

`@/*` は `src/*` に解決される。
