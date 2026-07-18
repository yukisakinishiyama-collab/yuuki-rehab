# Project ONE — 買い切り型AIライフアシスタント (MVP)

「AIを意識しなくても自然に役立つ、誰もが使える買い切り型アプリを最速で市場に届ける」

プロジェクト指示書 (Version 1.0) に基づく MVP 実装。既存の Next.js リポジトリ内の
独立領域 `src/app/(project-one)/` としてモバイルファースト Web アプリを構築した。
Android 先行リリース時は本アプリを TWA (Trusted Web Activity) / WebView でラップする。

## 画面と機能（指示書の必須5機能のみ）

| 機能 | 実装 |
|---|---|
| 悩み相談 | `/one` — テキスト入力 → 「そうだんする」ボタン |
| AI回答 | `/api/one-chat` (Anthropic Haiku・200字以内 + JSON構造化出力) |
| 履歴 | `/one/history` — 端末内 localStorage |
| お気に入り | `/one/favorites` — ☆トグル |
| 今日の行動 | ホーム上部カード + AI回答ごとの行動提案（端末内で決定・オフライン動作）。「できた！」記録と連続日数表示付き |

不採用機能（SNS・チャット・ランキング・広告・課金等）は実装していない。

## 指示書の要求 → 設計判断

- **買い切り型・課金なし**: サーバー依存は AI 回答 API 1本のみ。履歴・お気に入り・
  今日の行動はすべて端末内 (`src/lib/one-store.ts`) で完結。
- **迷わないUI**: 各画面のボタンは5個以内（ホーム: そうだんする / ☆ / ナビ3）。
  相談は「入力 → タップ → 回答」の3タップ以内。白×青・角丸・大フォント・広い余白。
  下部ナビは片手（親指）操作圏。ひらがな中心のラベルで高齢者・子どもにも対応。
- **通信量最小・オフライン対応**: AI 呼び出しは Haiku 1回・短文出力。圏外や API 障害時は
  端末内の回答ライブラリ (`getOfflineAnswer`) にフォールバックし、主要機能が止まらない。
- **AIは必要最低限**: モデル呼び出しは相談送信時の1回のみ。今日の行動は日付シードで
  端末内決定（AI 不使用・通信ゼロ）。

## ファイル構成

```
src/app/(project-one)/one/           # 画面（layout + 3ページ）
src/components/one/                  # OneNav（下部ナビ）/ ConsultationCard / OneServiceWorker
src/lib/one-store.ts                 # localStorage ストア + オフライン回答 + 今日の行動 + できた！記録
src/app/api/one-chat/route.ts        # AI回答 API（Anthropic Haiku）
public/one.webmanifest               # PWA マニフェスト（scope: /one, standalone）
public/one-sw.js                     # Service Worker（/one 限定オフラインシェル）
public/one-icon-{192,512}.png        # アプリアイコン
```

## v0.2（改善スプリント1）で追加

- **できた！記録 + 連続日数**: 今日の行動カードに「できた！」ボタン。実行日は端末内に
  記録し、連続日数をバッジ表示（継続率向上・グループB提案）。今日未実行でも昨日までの
  連続は維持表示され、0時に突然リセットされて見えない。
- **PWA 化**: マニフェスト + Service Worker（本番のみ登録・scope は /one 限定なので
  既存サイトに影響なし）。ページは network-first / ビルド資産は cache-first で、
  一度開けば圏外でも起動できるオフラインシェルが完成。ホーム画面追加 → TWA での
  Google Play 配信の土台。

## v0.3（改善スプリント2）で追加 — 計測基盤

- **匿名メトリクス** (`src/lib/one-metrics.ts`): app_open / consult_success /
  consult_offline / action_done / crash の5イベントのみ。相談・回答の本文は
  一切送信しない。端末IDはランダム匿名ID。
- **送信は sendBeacon バッチ1回**（バックグラウンド移行時）。圏外なら端末内
  キューに残して次回送信 — 通信量最小の方針を計測でも守る。
- **クラッシュ捕捉**: window error / unhandledrejection + `/one` 専用エラー
  バウンダリ（`error.tsx`、ワンタップ復帰UI）。
- **受信側** (`/api/one-metrics`): DBなし方針のため JSON Lines の構造化ログ
  として出力（Vercel ログ / Log Drain で集計）。クラッシュ率 = crash ÷ app_open。
  本格運用時はここを BigQuery 等への転送に差し替える。

## ストア配信準備（スプリント3・4）

- **Android / Google Play**: [twa.md](./twa.md) — Bubblewrap 用設定
  (`tools/one-twa/twa-manifest.json`) と Digital Asset Links
  (`public/.well-known/assetlinks.json`、要フィンガープリント差し替え) を同梱。
  有料アプリ（980〜1,980円・買い切り）として提出する。
- **iOS / App Store**: [ios.md](./ios.md) — Capacitor リモートURL方式。
  設定テンプレートは `tools/one-capacitor/capacitor.config.ts`。
  本リポジトリには依存を追加しない（Web ビルドへの影響ゼロ）。

## 今後（毎月改善サイクルの候補）

1. 発売後: メトリクス実測値（クラッシュ率・オフライン率・継続率）に基づく改善
2. 「今日の行動」ローカル通知リマインダー（iOS 審査対策のネイティブ付加価値）
