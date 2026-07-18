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
| 今日の行動 | ホーム上部カード + AI回答ごとの行動提案（端末内で決定・オフライン動作） |

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
src/components/one/                  # OneNav（下部ナビ）/ ConsultationCard
src/lib/one-store.ts                 # localStorage ストア + オフライン回答 + 今日の行動
src/app/api/one-chat/route.ts        # AI回答 API（Anthropic Haiku）
```

## 今後（毎月改善サイクルの候補）

1. PWA 化（Service Worker で完全オフラインシェル）→ TWA で Google Play 配信
2. クラッシュ・利用率・レビューの計測基盤（クラッシュ率0.5%目標の実測）
3. 今日の行動の「できた！」記録と連続日数表示（継続率向上）
4. iOS 展開（同一コードベースの Capacitor ラップ）
