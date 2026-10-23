# ゆうき整骨院 — ホームページと院内アプリ

Next.js App Router 製。公開ホームページと、院内アプリ（予約管理・カルテ・経営・集客）を同じ場所で動かします。

## 起動方法

```bash
cd yuuki-rehab
npm install
npm run dev      # localhost:3000（院内のパソコンでは 起動.bat でも開けます）
```

## 本番ビルド

```bash
npm run build
npm run start
```

## 院内アプリの画面

| 画面 | パス | 内容 |
|------|------|------|
| 今日 | `/dashboard` | 今日の予約・キャンセルのカルテ反映・昨日の締め（NOAH）と次の一手・気にかけたい方・承認待ちの投稿 |
| 予約 | `/yoyaku` | 予約システム（GAS）の予約表・空き・受付 |
| カルテ | `/patients` | SOAPカルテ・概要・評価・測定・問診票・簡易メモ・キャンセル・紹介状・復帰基準テスト・アウトカム評価 |
| 経営 | `/marketing/sales`・`/marketing/analytics` | NOAH の売上・来院数のグラフ、集客の効果 |
| 集客 | `/marketing/**` | 自動投稿・投稿づくり・投稿カレンダー・LINE導線・口コミ返信・動画ストック |

院内アプリは院長／スタッフのパスワード（`MARKETING_ADMIN_PASSWORD`・`MARKETING_STAFF_PASSWORD`）で守られています（`src/proxy.ts`）。
以前あった動作解析（動画・姿勢）、プロトコル立案、疾患／文献ライブラリ、イラスト管理、患者さん向けの説明・Web問診・カラダマップは 2026-10 に削除しました（端末やクラウドの控えに残る古いデータは消していません）。

## 免責事項

カルテの AI 機能（問診の分析・紹介状の下書き）は施術者を助けるためのものです。確定診断や治療の指示を代わるものではありません。最終判断は必ず有資格者が行ってください。

## アーキテクチャ

- **カルテ**: 端末の localStorage（`pt_*`）＋ `/api/sync` でクラウドへ控え
- **集客・経営**: Supabase の KV（`src/lib/marketing/kv-store-server.ts`）
- **予約**: GAS の予約システムと連携
- **スタイリング**: Tailwind CSS 4
- 詳細は [CLAUDE.md](CLAUDE.md) / [DECISIONS.md](DECISIONS.md) 参照

## 復旧地点（次世代化プロジェクト）

タグ **`YUUKI_REHAB_STABLE_BASELINE_V1`**（= 2026-08-08 本番）まで戻せば、
現行の YUUKI REHAB へ完全に復元できます。手順・データバックアップの場所は
[ROLLBACK.md](ROLLBACK.md) を参照。次世代化の計画は [docs/NEXTGEN-PLAN.md](docs/NEXTGEN-PLAN.md)。
