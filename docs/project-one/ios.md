# ONE — iOS 展開手順（Capacitor）

Android（TWA）先行リリース後の iOS 展開手順。**本リポジトリには Capacitor の
依存を追加しない**（Web ビルドへの影響ゼロを維持）。ラッパーは別ディレクトリ／
別リポジトリで作る。

## 手順（macOS + Xcode が必要）

```bash
# 1. ラッパープロジェクト作成
mkdir one-ios && cd one-ios
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/ios

# 2. 設定ファイルをコピー
cp <このリポジトリ>/tools/one-capacitor/capacitor.config.ts .

# 3. iOS プロジェクト生成（webDir はダミーで良い: リモートURL方式のため）
mkdir -p www && echo '<html></html>' > www/index.html
npx cap init ONE jp.projectone.one --web-dir www
npx cap add ios
npx cap open ios   # Xcode で署名設定 → 実機確認 → App Store 提出
```

## 方式の判断

- **リモートURL方式**（`server.url` → 本番 `/one`）を採用。
  Web 側の毎月改善がストア審査なしでそのまま反映される。
- App Store 審査ガイドライン 4.2（最小限の機能）対策として、iOS 提出前に
  ネイティブ付加価値を1つ以上入れる:
  - ローカル通知で「今日の行動」リマインダー（@capacitor/local-notifications）
  - オフライン時も SW キャッシュで完全動作（実装済み）を審査ノートに明記
- 買い切りは **App Store の有料アプリ価格**（サブスク・IAPなし）で設定。

## 品質チェック（提出前）

- iPhone SE〜Pro Max で片手操作・セーフエリア（下部ナビの env(safe-area-inset-bottom) 済み）
- 機内モードで起動 → 3画面 + オフライン回答が動くこと
- クラッシュ率: `/api/one-metrics` の crash ÷ app_open を確認
