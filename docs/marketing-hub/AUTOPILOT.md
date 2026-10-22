# 自動投稿パイプライン（AI下書き → 1タップ承認 → 自動投稿）

画面: `/marketing/autopilot`（マーケティングハブの「自動投稿」）

## 1週間の流れ

| いつ | だれ | なにが起きるか |
|---|---|---|
| 日曜 18時ごろ | 自動 | 翌週分の投稿案（既定3本：症状の解説・予防・院のご案内）をAIが作成。表現チェック（医療広告・柔整の広告ルール）を通す。週のはじめの「今週の空き状況」（Google）は予約システムの空き枠から定型文で作る |
| 同時 | 自動 | 院長のLINEに「投稿案ができました」＋［内容を確認する］［このまま全部承認］ |
| 日曜〜 | 院長 | 画面で読んで「承認」（1本ずつ／まとめて）。直す・作り直す・見送る・媒体を外すもできる |
| 投稿の前日 | 自動 | 承認していない案があれば1回だけリマインド |
| 予定の時刻 | 自動 | 承認済みだけ投稿。**承認していない案は投稿されず「期限切れ」になる** |
| 予定の時刻 | 院長 | Instagram未連携・Google（API承認待ち）の間は、本文がLINEに届く → コピーして貼る → ［投稿した］を押す |

- 承認は院長（管理者）だけ。スタッフは文章の修正・作り直しまで。
- LINEのボタン（全部承認・投稿した）は、送り主が院長本人（`RESERVATION_NOTIFY_LINE_USER_ID`）のときだけ動く。
- 公式LINEの一斉配信は自動投稿の対象外（友だち281人で無料枠200通を超え、取り消せないため）。
- 患者さんの情報はAIに送らない。テーマはテーマ集（`src/lib/marketing/theme-library.ts`）と院長メモだけ。

## 計測（どの投稿から予約が入ったか）

投稿のリンクはすべて計測リンク `/api/marketing/go?d=reserve&source=…&campaign=…`。
予約システムが「流入元」列に記録し、「効果測定」画面に流入元別・投稿別の予約数が出る。

院長が一度だけ設定するリンク:

| 場所 | 設定するURL |
|---|---|
| Instagramのプロフィールのリンク | `https://yuuki-rehab.vercel.app/api/marketing/go?d=reserve&source=instagram&campaign=profile` |
| Googleビジネスプロフィールの「予約」リンク | `https://yuuki-rehab.vercel.app/api/marketing/go?d=reserve&source=google_profile&campaign=booking_button` |
| チラシ・院内ポスターのQR | `https://yuuki-rehab.vercel.app/api/marketing/go?d=reserve&source=flyer&campaign=qr` |

公式LINE（リッチメニュー）からの予約は自動で「line」になる。

## 動かすための設定（Vercel の環境変数）

| 変数 | 用途 | 状態 |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI下書き | 既存 |
| `LINE_CHANNEL_ACCESS_TOKEN` / `RESERVATION_NOTIFY_LINE_USER_ID` | 院長へのLINE | 既存 |
| `CRON_SECRET`（＝GitHubの `MARKETING_CRON_SECRET`） | 定期実行の保護 | 既存 |
| `RESERVATION_NOTIFY_SECRET` | 予約システムから集計値を受け取る署名（GASの `PATIENT_NOTIFY_SECRET` と同じ値） | 既存 |
| `INSTAGRAM_ACCESS_TOKEN` / `INSTAGRAM_USER_ID` | Instagram自動投稿 | 未（`INSTAGRAM-SETUP.md`） |
| `GBP_CLIENT_ID` / `GBP_CLIENT_SECRET` / `GBP_REFRESH_TOKEN` / `GBP_LOCATION_NAME` | Google投稿の自動化 | API申請の承認後（`GOOGLE-BUSINESS-SETUP.md`） |

定期実行: GitHub Actions（15分ごと・`.github/workflows/marketing-jobs.yml`）が `jobs/run` と `autopilot/run` を呼ぶ。
Vercel Cron は保険（`jobs/run` 毎日・`autopilot/run` 毎週日曜）。

## LINEの通数の目安（無料プラン 月200通）

- 投稿案のお知らせ 週1通＋リマインド 最大1通
- 手動投稿のお知らせ 1本につき1通（Google と Instagram の本文をまとめて1通）。Instagram・Google が自動化されると0通
- ボタンを押したときの返事は無料（返信は通数に数えない）

## 予約システム（GAS）側 v3.2

- 予約シートの最後に「流入元」列（`instagram:ap20261026-1` のように計測名つき）
- 院へのメールに「流入元」、管理画面の予約カードに「経由：Instagram」などの印
- 集計API `?api=hubstats`（署名つき・個人情報なし：受付日・予約日・流入元・初診/再診・状態・8日分の空き枠数）
- 試験: `TZ=Asia/Tokyo node tests/test-source.mjs`

## 試験

- 計画ロジック: `node tools/marketing/test-autopilot-planner.mjs`
