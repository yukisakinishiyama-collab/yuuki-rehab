# CLAUDE.md

このファイルは、リポジトリで作業する Claude Code (claude.ai/code) へのガイダンスを提供します。

@AGENTS.md

## コマンド

```bash
npm run dev      # 開発サーバー起動 (localhost:3000)
npm run build    # 本番ビルド
npm run lint     # ESLint
```

テストは `npm run test:tools`（`tools/test-*.mjs` と `tools/marketing/test-*.mjs` をまとめて tsx で走らせる。外には送らない・データは架空）。1本だけなら `npx tsx tools/test-◯◯.mjs`（node だけだと `@/` を読めず止まるものがある）。

## アーキテクチャ

ゆうき整骨院のサイトと院内アプリで、同一の Next.js App Router 上に二つの領域がある。

**公開サイト** — `src/app/(website)/` — 症状別ページ（ACL、半月板など）、ブログ、FAQ、料金、競技復帰ドリル。コンポーネントは `src/components/site/`。患者さん向けの LINE 予約の入口 `src/app/liff/` と `/api/liff` も公開。

**院内アプリ** — `src/app/(app)/` — 予約管理・カルテ・経営（売上・来院）・集客の4つに絞った院内専用アプリ。共通の枠は `src/components/rehab/AppShell.tsx` → `src/components/clinic/ClinicShell.tsx`（メニューは `src/components/clinic/nav.ts`。PCは左、スマホは下の5タブ）。

- 今日（ホーム）: `/dashboard` → `src/components/clinic/TodayDashboard.tsx`
- 予約: `/yoyaku`（GAS の予約管理画面を常駐 iframe で表示。`src/components/rehab/YoyakuFrame.tsx`）
- カルテ: `/patients/**`（`src/components/rehab-management/`。SOAP・来院カレンダー・評価・アウトカム・問診・メモ・疑問・AI相談・患部の写真・契約・同意書（指で署名・院保管用と患者様控えの印刷・会員プランの状態）・キャンセル・紹介状）
- 経営: `/marketing/sales`（NOAH の売上・来院）、`/marketing/analytics`（集客の効果）
- 集客: `/marketing/**`（自動投稿・投稿づくり・LINE導線・口コミ返信など。`src/lib/marketing/`）。Google検索向けの投稿（「下関市彦島＋症状」に絞った決まった文＋院の写真の画像。`src/data/gbp-seo-posts.ts`・`src/lib/marketing/gbp-seo*.ts`・写真は `assets/gbp-photos/`。人物が特定されないもの＝`GBP_SAFE_PHOTOS` だけを置く）は、自動投稿の設定でオンにすると毎週（既定は月12時・金18時）承認なしで予約される。投稿ごとの予約ボタンのタップ・予約と、Googleの成果（Business Profile Performance API：表示・電話・ルート・ウェブサイト・「検索された言葉」。`gbp-performance*.ts`・`/api/marketing/google/performance`）は 経営 → 集客の効果 に出る。Search Console（ホームページの検索キーワード・掲載順位。`gsc*.ts`・`/api/marketing/google/search-console`）も同じ「Googleとつなぐ」で webmasters.readonly を一緒にもらって読む。GA4 は未設置（アカウントが無い）。`node tools/test-gbp-seo.mjs`。Google へ出す投稿は、Google の審査で拒否されないように（2026-11-12 に調べた：「予約」ボタンに予約システム＝script.google.com のアドレスを入れた投稿と、本文に電話番号を書いた投稿が拒否されていた）、ボタンのリンクは院のホームページ（shimonoseki-yuuki.com のそのページ＋utm_source=google_post）か公式LINEだけにし、本文から URL・電話番号を取る（`gbp-post-rules.ts`）。出したあと、Google の審査の結果を jobs/run で確かめ、拒否なら「公開失敗（Googleが拒否）」にして院長のLINEへ。Googleの画面から出した投稿の拒否も半日に1回見て、「投稿の予定と結果」に出す（`gbp-posts-server.ts`・`/api/marketing/google/posts`）。`npx tsx tools/test-gbp-post-rules.mjs`。宣伝の短い動画（YouTubeショート・TikTok。同じ18テーマを絵＋文字の縦動画・約16秒に。絵は基本AI＝前半2場面は OpenAI の画像生成で作ったイメージ（場面の説明は英語で `ai` に。院・スタッフ・施術はAIに描かせない。画面に「映像はイメージです」）、後半は人物が特定されない院の写真 `PROMO_SAFE_PHOTOS`（足首とエコー・エコーの機械・器具・外観）だけ。文面は `src/data/promo-videos.ts`、組み立ては `src/lib/marketing/promo-video-render.tsx`（next/og の文字の面＋ffmpeg）、作りおきと毎週の予約は `promo-video-server.ts`、YouTube の連携は `youtube-server.ts`）は、自動投稿の設定でオンにすると毎週（既定は水13:30）同じ動画を両方へ予約する。自動で出すときは Buffer（審査済みの投稿サービス。`src/lib/marketing/buffer*.ts`・`/api/marketing/buffer`。キーは院長が設定画面に貼る＝KV の `buffer:config`、または Vercel の BUFFER_API_KEY）を通し、院長の承認が要る（`src/lib/marketing/promo-approval.ts`）：投稿の前日に見本の動画と「承認して投稿・今回は見送る・別の動画にする」を院長のLINEへ（jobs/run の `requestPromoApprovals`）→ 承認した動画だけ、時間になったら Buffer で公開（承認が無いまま時刻から24時間たったら出さない）→ 出たかを後で確かめ、出せなければ動画と文をLINEへ（`checkBufferPromoPosts`）。Buffer につないでいない媒体は、時間になると動画と貼る文を院長のLINEへ届けて手で投稿。YouTube に直接送るのは「YouTubeとつなぐ」と「審査に通った」の両方がそろったときだけ（審査の前に送ると非公開に固定されるため）。同じ動画は Instagram のリールにも出す（設定の `instagramReels`。Buffer は通さず、ふだんの投稿と同じ Instagram の連携で `publishInstagramReel`＝media_type REELS・フィードにも表示。承認の流れは同じ。連携が無ければLINEへ届けて手で）。`node tools/test-promo-video.mjs`・`node tools/test-promo-approval.mjs`

予約のLINE（LINE連携の方へ。2026-11-05 院長の依頼）: 予約システムから「新しい予約」の通知が来たら、電話＋お名前（無ければカルテのお名前＋生年月日）で LINE 連携を探し、15秒待って予約システムが送っていなければ「確定しました」を1通。予約は KV の `linersv:<予約番号>` に控え、jobs/run から前日の10〜20時に前日のお知らせを送る（予約システムと同じ印で1通だけ・「予約のお知らせ停止」の方には送らない・テストの見本だけだった分は「動かす」にしたらご本人へ）。「今日」の「LINEで予約日時を送る」を開くと、読んだ一覧で控えをそろえる。どれも 集客 → 自動化設定 の「予約確認の LINE」「前日のお知らせ」に従う。`src/lib/marketing/line-reservation-server.ts`・`patient-line-push-server.ts`・`node tools/test-line-reservation.mjs`

院内アプリと院内用のAPIは `src/proxy.ts` の Basic 認証（院長／スタッフのパスワード）で守る。以前あった動作解析（動画・姿勢）、プロトコル立案・疾患/文献ライブラリ、患者さん向けの説明・問診・カラダマップの画面は削除済み。

### データ層

- カルテ: `src/lib/patient-store.ts` 経由で端末の `localStorage`（`pt_*`）に保存。`/api/sync` でクラウド（Supabase の KV）と同期（`src/lib/sync-service.ts`・`sync-merge.ts`。変わった記録だけを id ごとに送って重ねる。カルテの画面では15秒ごとに取り込み、「すぐに反映する」ボタンで今すぐ）
- 契約書・同意書: ひな形は `src/data/contract-templates.ts`（もとはドライブ「ゆうき整骨院_契約書テンプレート」）。署名済みの一覧は `pt_contracts`、署名入りの本文は KV の `kcdoc:<id>`（`/api/karte/contracts`。一度保存したら書きかえない）。記入欄は、署名と □ のチェック以外をカルテ・今日の日付・会員の手続きの欄から自動で埋める（`src/lib/contracts/autofill.ts`。欄は前の文字と表の行の見出しで見分ける。`node tools/test-contracts.mjs`）。会員の日付の決まりは `src/lib/contracts/member.ts`（兄弟・親子プラン＝2名まで月額30,000円は契約者のカルテで手続きし、もう1名のカルテにも `memberStatusForPatient` で状態を出す）。アウトカムは `pt_outcomes`（指標と競技ごとの評価セット＝野球・サッカー・陸上・バスケ/バレー・ACL術後は `src/data/outcome-metrics.ts`、LSI・左右差・GIRD/TRM の計算は `src/lib/outcomes/calc.ts`、患者さんごとの競技は `pt_outcome_settings`。目安の線は論文で使われた値で、出どころを画面に出す。`node tools/test-outcome-sets.mjs`）
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
