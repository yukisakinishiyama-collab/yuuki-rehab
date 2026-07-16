# ゆうき整骨院 統合マーケティングハブ 開発計画

作成日: 2026-07-15 ／ ブランチ: `feature/marketing-hub`

## 1. リポジトリ調査結果（インベントリ）

### 技術スタック（yuuki-rehab）
- Next.js 16.2.6（App Router）/ React 19 / TypeScript / Tailwind CSS 4
- zod v4・@anthropic-ai/sdk・openai・sharp・recharts・nodemailer 導入済み
- @supabase/supabase-js 導入済み（使用は api/sync のみ・本格DBは未使用）
- データ永続化は localStorage 中心（src/lib/rehab-store.ts のパターン）

### 既存資産と仕分け

| 資産 | 場所 | 仕分け |
|---|---|---|
| 医療広告NG表現ルール | tools/sns-automation/lib/rules.mjs | **移植**（TS化して src/lib/marketing/compliance.ts へ。CLIは残置） |
| 記事生成プロンプト（院情報・執筆方針） | tools/sns-automation/generate-article.mjs | **移植**（システムプロンプトを共通化） |
| 画像生成一式（OpenAI・媒体別サイズ・チェック） | tools/sns-automation/image-gen/*.mts | **修正して再利用**（Phase 1後半でAPI Route化。OPENAI_API_KEY未設定のためモック優先） |
| 口コミ返信生成 | tools/sns-automation/generate-review-reply.mjs | **再利用**（Phase 5でUI化） |
| 投稿管理表チェック/分析 | check-posts.mjs / report-posts.mjs | **段階的に廃止**（アプリ内カレンダー・分析に置換。移行期間は併存） |
| LINE Webhook（署名検証・セッション・返信） | src/app/api/karada-line/webhook/route.ts | **修正して再利用**（Phase 2の友だち追加導線の土台。チャネル未設定のため現在休眠） |
| 認証 | src/app/(auth)/login | **暫定利用**（Phase 1は簡易ログインのまま。RBACはPhase 2以降でSupabase Auth検討） |
| Instagramコンテンツ生成（yuuki-app / Vite） | C:\Users\PC\yuuki-app | **参考のみ**（プロンプト資産は本アプリへ集約。二重管理を解消） |

### 外部API接続状況
- Anthropic: ✅ ANTHROPIC_API_KEY設定済み
- OpenAI(画像): ⛔ キー未設定 → モックで進行
- LINE Messaging API: ⛔ チャネル未作成（Webhookコードは有り）
- Instagram Graph API: ⛔ 未接続
- Google Business Profile API: ⛔ 未申請 → **代替機能（本文生成＋手動投稿チェック）で先行**

### セキュリティ所見
- APIキーはサーバー側(.env.local)のみ。gitignore済み ✅
- LINE Webhookは署名検証実装済み（SECRET未設定時スキップ＝本番前に必須化） ⚠️
- 監査ログ・RBACは未実装 → 本アプリで追加

## 2. アーキテクチャ方針

- **既存のNext.js App Routerに統合**（新規プロジェクトは作らない）
- ルートグループ `(marketing)` を新設。公開サイト・リハビリアプリと完全分離
- 永続化はまず**localStorageストア**（リポジトリの確立パターン・即動作）。
  Phase 3の投稿ジョブ実行までに Supabase(Postgres) へ移行（storeのインターフェースを固定しておき差し替え可能に）
- AI生成は**API Route + 構造化出力（zod検証）**。フロントにキーを出さない
- **mockモード**: `MARKETING_MODE=mock`（既定）では外部投稿は一切実行せず模擬レスポンス

## 3. データモデル（Phase 1）

types.ts に定義: ClinicProfile / ContentProject / ContentVariant(媒体別) /
ComplianceResult(pass|review|blocked) / PostStatus(11状態) / AuditLogEntry。
指示書19章のフルモデルはDB移行時に拡張（キー設計は互換を維持）。

## 4. 実装フェーズ

- **Phase 1（今回）**: ダッシュボード / 基本設定 / 投稿作成→AI生成（IGフィード・カルーセル・リール・GBP・LINE・note）→媒体別プレビュー→表現チェック→承認→カレンダー。全てmockモードで完結
- Phase 2: LINE（Webhook復活・友だち追加シナリオ・顧客管理・リッチメニュー管理）
- Phase 3: Instagram/GBP接続・予約投稿ジョブ（Vercel Cron + idempotency key）・DB移行
- Phase 4: 効果測定（UTM・コンバージョン・ダッシュボード）
- Phase 5: 論文ライブラリ・チェック強化・画像テンプレート・口コミ返信UI

## 5. 絶対条件の担保

- 既存コード削除なし（tools/・src/既存領域は無変更）
- 外部投稿は実装されるまで存在しない＝無断投稿は構造的に不可能
- 承認なし公開は不可（ステータス遷移で強制）
- 監査ログは承認・公開系操作で必須記録
