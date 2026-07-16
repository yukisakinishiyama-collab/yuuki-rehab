# LINE本番接続手順（公式アカウントにシナリオを実装する）

対象: ゆうき整骨院 公式LINE。所要45〜60分。**すべて無料**（Supabase無料枠・Messaging API無料）。
コード側の準備（Supabase対応・二重返信対策）は完了済み。残りは外部サービスの設定のみ。

## 全体像

```
[LINE友だち] → LINEサーバー → Webhook → yuuki-rehab(Vercel) → シナリオエンジン
                                              ↕ Supabase（会話状態・顧客データ）
```

## Step 1: Supabaseプロジェクト作成（約5分・要ユーザー操作）

1. https://supabase.com → 「Start your project」→ GitHubまたはGoogleでサインアップ
2. 「New project」→ 名前: `yuuki-marketing` / リージョン: Northeast Asia (Tokyo) / DBパスワードは生成された強いものを保存
3. プロジェクトが起動したら **SQL Editor** を開き、`supabase/migrations/20260716_marketing_line_contacts.sql` の内容を貼り付けて実行
4. **Settings → API** から次の2つをコピー:
   - Project URL → `SUPABASE_URL`
   - service_role キー（secret） → `SUPABASE_SERVICE_ROLE_KEY` ※絶対に公開しない

## Step 2: Messaging APIチャネル開設（約10分・要ユーザー操作）

⚠️ 推奨: まず未使用の重複アカウント（@959kyrwh）でテストし、動作確認後に本番（@432amljv）へ同じ設定をする。

1. https://developers.line.biz/console/ にLINEビジネスIDでログイン
2. プロバイダーを作成（例: ゆうき整骨院）→ 対象の公式アカウントで「Messaging APIチャネル」を有効化
   （LINE Official Account Manager → 設定 → Messaging API からでも可）
3. チャネル基本設定から **Channel Secret** をコピー → `LINE_CHANNEL_SECRET`
4. Messaging API設定タブで **チャネルアクセストークン（長期）を発行** → `LINE_CHANNEL_ACCESS_TOKEN`

## Step 3: デプロイと環境変数（約10分）

1. Vercelのプロジェクト設定 → Environment Variables に以下を追加:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`（Step 1）
   - `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN`（Step 2）
   - `APP_URL` = デプロイURL（例 https://yuuki-rehab.vercel.app ）→ 予約リンクのクリック計測が有効化
   - `LINE_TEXT_FALLBACK` = `off` → 既存の応答メッセージ（料金・初めての方へ等）と共存
   - `CRON_SECRET` = ランダム文字列（投稿ジョブの保護）
   - `ANTHROPIC_API_KEY`（AI生成を本番で使う場合）
2. `feature/marketing-hub` ブランチをpush（プレビューURLで運用可。mainマージは院長判断）

## Step 4: Webhook登録（約5分）

1. LINE Developers → Messaging API設定 → Webhook URL に登録:
   `https://<デプロイURL>/api/marketing/line/webhook`
2. 「検証」ボタン → 成功を確認 → 「Webhookの利用」をオン
3. LINE Official Account Manager → 設定 → 応答設定:
   - チャット: オン（手動対応を続ける）
   - あいさつメッセージ: **オフ**（Webhookの選択メニューに置き換わるため。残すと二重になる）
   - Webhook: オン
   - 応答メッセージ: オン（キーワード応答は残す。`LINE_TEXT_FALLBACK=off` で共存）

## Step 5: リハーサル（テストアカウントで全確認）

- [ ] 友だち追加 → 7つの選択肢メニューが届く
- [ ] 「ケガをした」→ 部位 → 時期 → 来院案内＋予約ボタン
- [ ] 予約ボタン → 予約フォームが開く（URLに source=line が付いている）
- [ ] 「骨折してますか？」→ スタッフ案内が届き、以後自動応答が止まる → 管理画面に要対応表示
- [ ] 「胸が痛くて苦しい」→ 医療機関受診の案内
- [ ] 管理画面（/marketing/line）で会話ログ・タグが見える
- [ ] 「対応終了」で自動応答が再開する

## Step 6: 本番切替

テストアカウントで問題なければ、本番アカウント（@432amljv）でStep 2〜4を繰り返す。

## ロールバック（30秒）

問題が起きたら LINE Official Account Manager → 応答設定 → **Webhookをオフ** にするだけで、
現行の「リッチメニュー＋応答メッセージ＋手動チャット」運用に完全復帰する。

## 注意事項

- Channel Secret / アクセストークン / service_roleキーは絶対にチャットやコードに貼らない（環境変数のみ）
- 月200通の無料枠は「Push配信（一斉配信）」のみ消費。友だちの操作への自動応答（Reply）は無制限・無料
- 友だち追加時のシナリオは既存のあいさつメッセージを置き換えるため、文言を変えたい場合は
  `src/lib/marketing/line-scenario.ts` の `intentMenu()` を編集
