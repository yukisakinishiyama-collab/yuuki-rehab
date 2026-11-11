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
- カルテ: `/patients/**`（`src/components/rehab-management/`。SOAP・来院カレンダー・評価・アウトカム・問診・メモ・疑問・AI相談・患部の写真・契約・同意書（指で署名・院保管用と患者様控えの印刷・会員プランの状態）・キャンセル・紹介状）
- 経営: `/marketing/sales`（NOAH の売上・来院）、`/marketing/analytics`（集客の効果）
- 集客: `/marketing/**`（自動投稿・投稿づくり・LINE導線・口コミ返信など。`src/lib/marketing/`）

院内アプリと院内用のAPIは `src/proxy.ts` の Basic 認証（院長／スタッフのパスワード）で守る。以前あった動作解析（動画・姿勢）、プロトコル立案・疾患/文献ライブラリ、患者さん向けの説明・問診・カラダマップの画面は削除済み。

### データ層

- カルテ: `src/lib/patient-store.ts` 経由で端末の `localStorage`（`pt_*`）に保存。`/api/sync` でクラウド（Supabase の KV）と同期（`src/lib/sync-service.ts`・`sync-merge.ts`。変わった記録だけを id ごとに送って重ねる。カルテの画面では15秒ごとに取り込み、「すぐに反映する」ボタンで今すぐ）
- 契約書・同意書: ひな形は `src/data/contract-templates.ts`（もとはドライブ「ゆうき整骨院_契約書テンプレート」）。署名済みの一覧は `pt_contracts`、署名入りの本文は KV の `kcdoc:<id>`（`/api/karte/contracts`。一度保存したら書きかえない）。会員の日付の決まりは `src/lib/contracts/member.ts`。アウトカムは `pt_outcomes`
- バックアップ: 設定 → バックアップ（`src/components/clinic/BackupPanel.tsx`・`src/lib/backup/`）。クラウドの毎月の控え（KV の `backup:YYYY-MM`、12か月。Cron で毎日確かめて無ければ作る `/api/backup/monthly`）と、院長のパソコンのフォルダへの保存（File System Access。カルテ全部・署名入りの契約書・写真）。`/api/backup` は院長だけ
- 端末ログイン: `src/lib/rehab-store.ts`（院内専用のため未ログインなら自動ログイン）
- 集客・経営: `src/lib/marketing/kv-store-server.ts`（Supabase 設定時は KV テーブル）
- 予約: GAS の予約システム（`?api=feed` / `?api=hubstats` / `?api=noahstats`）と連携

主な API: `/api/marketing/**`、`/api/sync`、`/api/yoyaku/feed`、`/api/intake-analysis`・`/api/referral-generate`（Anthropic SDK）、`/api/voice/transcribe`（カルテの音声入力。録音を OpenAI で文字に）・`/api/voice/organize`（文字起こしから患者さんの情報だけを Claude で S/O/A/P・メモに整理。欄に入れるだけで保存は院長）、`/api/karte/consult`（カルテの「疑問・AI相談」。お名前などを除いた要約と疑問を Claude に送る。`src/lib/karte/`）、`/api/karte/photos`（患部の写真。Supabase Storage の非公開バケット karte-photos に保存。メタデータは `pt_karte_photos`）、`/api/upload`（動画ストックの Vercel Blob 保存）、`/api/liff/verify`。

### 解剖図（関節の部位えらび）

`src/components/rehab-management/AnatomyMap.tsx` が、`src/lib/anatomy/zones/<key>.json`（向きごとの画像 `public/anatomy/<key>/<view>.webp` ＋ 押せる部位の多角形）を読んで表示する。JSON が無い関節は従来の `JointDetailMap.tsx` に戻る。図と座標は Codex が `docs/anatomy-illustrations-brief.md` の仕様で納品し、`node tools/test-anatomy-zones.mjs` で検査する。部位ID（`JOINT_ZONES`）はカルテの保存値なので増減しない。計画全体は `docs/karte-soap-upgrade.md`。

### スタイリング

Tailwind CSS 4（`@tailwindcss/postcss` 経由）。カスタムトークン（`--color-navy`、`--color-line`）と `.hero-h1` のレスポンシブ見出しは `src/app/globals.css` の `@theme` で定義。CSS Modules は使用しない。日本語フォントスタック（Hiragino Sans → Noto Sans JP）。

### 型定義

カルテの型は `src/types/patient.ts`（Patient、SOAPNote、Evaluation、ROMRecord など）。復帰基準・アウトカム評価は `src/types/return-criteria.ts`・`src/types/outcome-scores.ts`。端末ログインのユーザーは `src/types/rehab.ts`。

### パスエイリアス

`@/*` は `src/*` に解決される。
