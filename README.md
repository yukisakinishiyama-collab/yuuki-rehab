# YUUKI REHAB — ゆうき整骨院 院内アプリ

Next.js App Router 製の院内リハビリ管理アプリ。動画アノテーション・AI 分析・プロトコル立案・可動域管理を一体提供します。

## 起動方法

```bash
cd yuuki-rehab
npm install
npm run dev      # localhost:3000
```

## 本番ビルド

```bash
npm run build
npm run start
```

## 環境変数

`.env.local` を作成し、以下を設定してください：

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
BLOB_READ_WRITE_TOKEN=vercel_blob_xxxxxxxxxxxx   # 動画アップロード用（任意）
```

`ANTHROPIC_API_KEY` が未設定の場合、AI 専門家パネル機能と AI プロトコル生成は使用できません（テンプレートモードは常時利用可能です）。

## 主な機能

| 機能 | パス | 説明 |
|------|------|------|
| ダッシュボード | `/dashboard` | ケース一覧・統計 |
| 案件管理 | `/cases` | ケース登録・動画アノテーション・AI 分析 |
| プロトコル立案 | `/protocols` | フェーズ別リハビリプロトコル生成・進捗管理 |
| 可動域ノート | `/rom` | 関節可動域の記録・トレンドグラフ |
| 関節角度計 | `/gonio` | カメラを使ったリアルタイム角度計測 |

## プロトコル立案機能の使い方

1. `/protocols` → 「新規プロトコル」
2. **テンプレートモード**（AI キー不要）: 診断名・部位を入力 → 自動テンプレート選択
3. **AI モード**（API キー必要）: 患者情報送信の同意後 → Claude がカスタムプロトコルを生成
4. 各フェーズの移行基準チェックボックスを充足すると「次フェーズへ進む」ボタンが有効化
5. 「進捗管理」から評価値を記録 → トレンドグラフで経過確認
6. 「患者ビュー」でやさしい言葉モードに切り替えて患者提示用に使用

## 免責事項

本アプリが生成するプロトコル・AI 分析は**臨床意思決定支援ツール**です。医療行為・確定診断・個別治療の指示を代替するものではありません。最終判断は必ず有資格の医療者（医師・理学療法士等）が行ってください。

## アーキテクチャ

- **データ永続化**: localStorage のみ（バックエンド DB なし）
- **AI**: Anthropic Claude API（`/api/ai-summary`, `/api/protocol-generate`）
- **動画解析**: MediaPipe Tasks Vision（`serverExternalPackages` でバンドル除外）
- **スタイリング**: Tailwind CSS 4
- 詳細は [CLAUDE.md](CLAUDE.md) / [DECISIONS.md](DECISIONS.md) 参照
