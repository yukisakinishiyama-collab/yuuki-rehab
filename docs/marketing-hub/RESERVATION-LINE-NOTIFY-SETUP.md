# 予約が入ったら院長のLINEに通知する設定

患者さんがネット予約・キャンセルをすると、院長のLINEにお知らせが届くようにする設定です。
（今まで通りメール通知も届きます。LINE通知はそれに追加されます）

所要10分・費用無料。値の貼り付けは院長ご自身で行います。

## 設定の全体像

1. Vercelに3つの値を設定 → 再デプロイ
2. 公式LINEに合言葉を送って「院長のuserId」を取得
3. Vercelにその userId を設定 → 再デプロイ
4. GAS予約システムに2つの値を設定 → デプロイ

---

## Step 1: Vercelに設定（3項目）

Vercel → yuuki-rehab → Settings → Environment Variables で、以下を追加（Environmentは全部にチェック）:

| Name | Value |
|---|---|
| `RESERVATION_NOTIFY_SECRET` | デスクトップ「予約通知シークレット.txt」の32文字（メモ帳でCtrl+A→Ctrl+Cでコピー） |
| `LINE_WHOAMI_KEYWORD` | `通知先とうろく` （院長のuserId取得用の一時的な合言葉。あとで削除OK） |

※ `RESERVATION_NOTIFY_LINE_USER_ID` はStep 2で取得してからStep 3で設定します。

保存したら **Deployments → 最新の…メニュー → Redeploy** で再デプロイ。

## Step 2: 院長のuserIdを取得

1. 院長のスマホで、ゆうき整骨院の公式LINE（@432amljv）のトーク画面を開く
2. `通知先とうろく` とだけ送信する
3. ボットが「あなたのLINE userIdはこちらです：Uxxxxxxxx...」と返信します
4. その `Uxxxxxxxx...`（Uで始まる文字列）を長押しでコピー

## Step 3: userIdをVercelに設定

Vercelの Environment Variables にもう1つ追加:

| Name | Value |
|---|---|
| `RESERVATION_NOTIFY_LINE_USER_ID` | Step 2でコピーした `Uxxxxxxxx...` |

保存 → 再デプロイ。
（安全のため、`LINE_WHOAMI_KEYWORD` はここで削除しても構いません。合言葉を無効化できます）

## Step 4: GAS予約システムに設定

予約管理表のスプレッドシート → 拡張機能 → Apps Script → 左メニューの⚙️プロジェクトの設定
→ 「スクリプト プロパティ」で以下2つを追加:

| プロパティ | 値 |
|---|---|
| `NOTIFY_LINE_URL` | `https://yuuki-rehab.vercel.app/api/marketing/reservation-notify` |
| `NOTIFY_LINE_SECRET` | Step 1と同じ32文字（予約通知シークレット.txt） |

保存後、予約システムを**デプロイ（新バージョンとして再デプロイ）**して反映。

## 動作確認

テスト予約を1件入れてみて、院長のLINEに「🗓 新規予約が入りました」と届けば成功です。
（届かなくても予約自体は成功します。設定漏れがあると通知だけスキップされる安全設計です）

## 仕組みと安全性

- 通知は院長の userId 宛の1通のみ。友だち全員には送りません
- エンドポイントは `RESERVATION_NOTIFY_SECRET` で保護（合言葉がないと拒否）
- LINEトークンはVercelにのみ保持（GASにはトークンを置かない設計）
- 使い終わったらデスクトップの「予約通知シークレット.txt」は削除してください
