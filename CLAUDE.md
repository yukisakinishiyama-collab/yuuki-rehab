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

ゆうき整骨院のサイトと院内アプリで、同一の Next.js App Router 上に二つの領域がある。

**公開サイト** — `src/app/(website)/` — 症状別ページ（ACL、半月板など）、ブログ、FAQ、料金、競技復帰ドリル。コンポーネントは `src/components/site/`。患者さん向けの LINE 予約の入口 `src/app/liff/` と `/api/liff` も公開。

**院内アプリ** — `src/app/(app)/` — 予約管理・カルテ・経営（売上・来院）・集客の4つに絞った院内専用アプリ。共通の枠は `src/components/rehab/AppShell.tsx` → `src/components/clinic/ClinicShell.tsx`（メニューは `src/components/clinic/nav.ts`。PCは左、スマホは下の5タブ）。

- 今日（ホーム）: `/dashboard` → `src/components/clinic/TodayDashboard.tsx`
- 予約: `/yoyaku`（GAS の予約管理画面を常駐 iframe で表示。`src/components/rehab/YoyakuFrame.tsx`）
- カルテ: `/patients/**`（`src/components/rehab-management/`。SOAP・評価・問診・メモ・キャンセル・紹介状）
- 経営: `/marketing/sales`（NOAH の売上・来院）、`/marketing/analytics`（集客の効果）
- 集客: `/marketing/**`（自動投稿・投稿づくり・LINE導線・口コミ返信など。`src/lib/marketing/`）

院内アプリと院内用のAPIは `src/proxy.ts` の Basic 認証（院長／スタッフのパスワード）で守る。以前あった動作解析（動画・姿勢）、プロトコル立案・疾患/文献ライブラリ、患者さん向けの説明・問診・カラダマップの画面は削除済み。

### データ層

- カルテ: `src/lib/patient-store.ts` 経由で端末の `localStorage`（`pt_*`）に保存。`/api/sync` でクラウド（Supabase の KV）へ控えを保存・取り込み
- 端末ログイン: `src/lib/rehab-store.ts`（院内専用のため未ログインなら自動ログイン）
- 集客・経営: `src/lib/marketing/kv-store-server.ts`（Supabase 設定時は KV テーブル）
- 予約: GAS の予約システム（`?api=feed` / `?api=hubstats` / `?api=noahstats`）と連携

主な API: `/api/marketing/**`、`/api/sync`、`/api/yoyaku/feed`、`/api/intake-analysis`・`/api/referral-generate`（Anthropic SDK）、`/api/upload`（動画ストックの Vercel Blob 保存）、`/api/liff/verify`。

### スタイリング

Tailwind CSS 4（`@tailwindcss/postcss` 経由）。カスタムトークン（`--color-navy`、`--color-line`）と `.hero-h1` のレスポンシブ見出しは `src/app/globals.css` の `@theme` で定義。CSS Modules は使用しない。日本語フォントスタック（Hiragino Sans → Noto Sans JP）。

### 型定義

カルテの型は `src/types/patient.ts`（Patient、SOAPNote、Evaluation、ROMRecord など）。復帰基準・アウトカム評価は `src/types/return-criteria.ts`・`src/types/outcome-scores.ts`。端末ログインのユーザーは `src/types/rehab.ts`。

### パスエイリアス

`@/*` は `src/*` に解決される。
