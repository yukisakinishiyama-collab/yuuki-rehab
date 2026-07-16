# マーケティングハブ 使い方（Phase 1）

院長が営業担当を雇わずに、投稿作成〜承認〜公開管理を一人で回すためのアプリ。
`/marketing` でアクセスできます（開発: `npm run dev` → http://localhost:3000/marketing ）。

## 環境構築

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY を設定
npm run dev
```

- `MARKETING_MODE=mock` の間は外部APIを呼ばず、モック生成で全フローを試せます（初期設定・推奨）
- 実際のAI生成を使うときは `.env.local` の `MARKETING_MODE=mock` の行を削除（またはliveに変更）

## 画面と流れ

1. **基本設定** … 院名・料金・営業時間・予約URLなどを登録（全AI生成のシングルソース）
2. **投稿を作る** … 目的とテーマを入れて媒体を選ぶ → AIが媒体別下書きを生成
   （IGフィード／カルーセル／リール台本／Google投稿／LINE配信／note）
3. 媒体別プレビューで編集 → **医療広告表現チェック**（公開可能／要確認／公開禁止）
4. 承認 → 予約（日時指定）→ 公開の記録
   - 公開禁止の投稿は、理由を入力して解除しない限り承認・予約できません（監査ログに記録）
5. **投稿カレンダー** … 状態別・日付別に全投稿を管理

## セキュリティ・運用ルール

- APIキーはサーバー側のみ（`.env.local`・Git管理外）
- 患者氏名・診療内容など個人特定情報は入力しない（入力欄にも注意書きあり）
- 承認なしの外部公開は構造的に不可能（Phase 1は自動投稿機能自体が存在しない）
- 承認・公開・設定変更はすべて監査ログ（基本設定画面で閲覧可）

## 実装済みフェーズ（Phase 1〜5）

- **Phase 1**: 投稿作成→AI生成（6媒体）→表現チェック→承認→カレンダー
- **Phase 2**: LINE初回導線（7つの相談入口・緊急判定・人への引き継ぎ）・顧客管理・会話シミュレーター
- **Phase 3**: 予約投稿ジョブ（重複防止・リトライ・履歴）・Vercel Cron・API接続確認・手動投稿の代替運用
- **Phase 4**: 効果測定（計測リンク /api/marketing/go・LINEファネル・フォロー候補の自動抽出）
- **Phase 5**: 論文・根拠ライブラリ（承認制→生成連携）・口コミ返信支援・表現チェック強化（ビフォーアフター/体験談一般化等）・テンプレート画像生成（/api/marketing/image・sharp製でAPIキー不要）

詳細な調査結果と方針は [PLAN.md](./PLAN.md) を参照。

## 本番運用に切り替える手順（概要）

1. `MARKETING_MODE=mock` を削除 → AI生成が実APIに
2. Vercelに環境変数を設定（ANTHROPIC_API_KEY、APP_URL、CRON_SECRET）
3. LINE実接続: LINE DevelopersでMessaging API有効化 → SECRET/TOKEN設定 → Webhook URL登録
4. Instagram: Meta開発者アプリ＋プロアカウント接続 → INSTAGRAM_ACCESS_TOKEN/USER_ID設定（画像連携までは手動投稿モード）
5. Google Business Profile: API利用申請（承認まで手動投稿モードで運用可能）

## 既知の制限

- 投稿・院情報はブラウザのlocalStorage、LINE顧客・ジョブ・計測はサーバーの `.data/` JSON保存
  （Vercel本番ではサーバーデータが永続しないため、実LINE運用前にSupabase移行が必要）
- Instagram自動投稿は公開画像URLの連携（画像ストレージ）が前提。それまでは手動対応待ち→本文コピー運用
- A/Bテスト・AIによる改善提案は未実装（今後の改善候補）
- 自動テスト（Vitest/Playwright）は未整備。現状は手動E2E＋ビルドで担保
- `react-hooks/set-state-in-effect` のlint指摘はリポジトリ全体の既知事項（既存ページと同パターン）
