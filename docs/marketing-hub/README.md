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

## 今後のフェーズ

- Phase 2: LINE友だち追加シナリオ・顧客管理・リッチメニュー管理（既存Webhook基盤を再利用）
- Phase 3: Instagram / Google Business Profile 接続・予約投稿ジョブ・DB移行（Supabase）
- Phase 4: 効果測定（UTM・コンバージョン）／ Phase 5: 論文ライブラリ・口コミ返信UI

詳細な調査結果と方針は [PLAN.md](./PLAN.md) を参照。

## 既知の制限（Phase 1）

- データはブラウザのlocalStorage保存（同一PC・同一ブラウザでのみ共有。Phase 3でDB化）
- 外部への自動投稿は未実装（本文コピー→手動投稿の運用）
- 画像生成は未接続（OPENAI_API_KEY設定後、Phase 1後半で有効化）
- `react-hooks/set-state-in-effect` のlint指摘はリポジトリ全体の既知事項（既存ページと同パターン）
