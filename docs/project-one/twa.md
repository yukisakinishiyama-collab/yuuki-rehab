# ONE — Google Play 配信手順（TWA / Bubblewrap）

PWA（`/one`）を Trusted Web Activity で Android アプリ化し、Google Play で
**買い切り（有料アプリ・980〜1,980円）** として配信するための手順。
アプリ内課金・サブスクは使わない（指示書の方針どおり）。

## 前提

- Node.js / JDK 17 / Android SDK（Bubblewrap が自動セットアップ可能）
- Google Play デベロッパーアカウント
- 本番 URL: `https://yuuki-rehab.vercel.app/one`（独自ドメインに移す場合は
  `tools/one-twa/twa-manifest.json` の `host` と各 URL を変更）

## 手順

```bash
# 1. Bubblewrap CLI
npm i -g @bubblewrap/cli

# 2. プロジェクト生成（リポジトリの設定ファイルを使用）
mkdir one-android && cd one-android
cp ../tools/one-twa/twa-manifest.json .
bubblewrap init --manifest ./twa-manifest.json

# 3. ビルド（初回に署名鍵 android.keystore を生成）
bubblewrap build
# => app-release-bundle.aab（Play 提出用）と app-release-signed.apk（実機確認用）
```

## Digital Asset Links（アドレスバー非表示に必須）

```bash
# 4. 署名鍵の SHA256 フィンガープリントを取得
keytool -list -v -keystore android.keystore -alias one-release | grep SHA256
```

取得した値で `public/.well-known/assetlinks.json` の
`REPLACE_WITH_RELEASE_KEY_SHA256_FINGERPRINT` を置き換えてデプロイする。

> Play アプリ署名（Google 管理鍵）を使う場合は、Play Console →
> 設定 → アプリの完全性 に表示される SHA256 も配列に追加すること。

確認: https://developers.google.com/digital-asset-links/tools/generator

## Play Console 提出

1. 「アプリを作成」→ アプリ or ゲーム: アプリ / 有料
2. 価格: 980〜1,980円の範囲で設定（指示書の心理的購入障壁ライン）
3. `app-release-bundle.aab` をアップロード
4. ストア掲載情報にはアイコン（`public/one-icon-512.png`）を流用可能
5. データセーフティ: 収集データは「匿名の利用統計・クラッシュログのみ、
   個人と紐づけない」（docs/project-one/README.md v0.3 参照）

## 品質基準との対応

- 起動3秒以内: TWA はプリレンダー済み静的ページ + SW キャッシュで达成見込み。
  実機で Lighthouse / vitals を計測して確認する
- オフライン動作: SW（one-sw.js）でシェルをキャッシュ済み
- クラッシュ率0.5%以下: `/api/one-metrics` の crash ÷ app_open を発売後に監視
