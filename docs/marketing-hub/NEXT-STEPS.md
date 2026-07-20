# マーケハブ 次のステップ・ナビゲーション（2026-07-20 時点）

このファイル1つで、次のセッション／拡張機能が続きを引き継げます。上から順に実行してください。

---

## 現在地（済／未のサマリ）

| # | 項目 | 状態 |
|---|------|------|
| §0 | LINE「人対応中でもボタン応答」修正 | ✅ 完了・本番稼働中（commit `dcfe817`。`storageOk:true` 確認済み） |
| ① | 動画ストックを使えるようにする | ⏳ コード完成・**Supabaseの SQL 実行だけ未了**（院長操作） |
| ② | 院長/スタッフの権限分け | ⏳ 実装・検証完了。**commit `2042cd9`（ローカル）・未push**（自動モード分類器にブロックされた） |
| ③ | SEO/GEO（構造化データ・FAQ） | ⏳ 実装・検証完了。**commit `99f24f3`・`beafbb2`（ローカル）・未push**。院長入力不要 |
| ④ | Instagram 接続の再挑戦 | ⬜ 中断中（Facebookパスワード再入力エラー。手順書 `INSTAGRAM-SETUP.md`） |

デプロイは `git push origin main` で Vercel 自動デプロイ。環境変数を変えたら反映漏れ防止に空コミット（`git commit --allow-empty`）を push。

---

## ステップ1：②権限管理を本番反映（院長操作）

1. push（コミット `2042cd9` は作成済み）:
   ```
   cd C:\Users\PC\yuuki-rehab
   git push origin main
   ```
2. スタッフ権限を有効化：Vercel の環境変数に `MARKETING_STAFF_PASSWORD`（スタッフ用の新しいパスワード）を追加。
3. 反映確定のため空コミット：
   ```
   git commit --allow-empty -m "chore: STAFF_PASSWORD反映" && git push origin main
   ```

**動作：** ブラウザのBasic認証で
- 管理者パスワード → 院長（全操作）
- スタッフパスワード → スタッフ（閲覧・下書き・動画登録まで。承認/予約/公開/削除は不可）

`MARKETING_STAFF_PASSWORD` 未設定なら従来通り（管理者のみ）＝完全後方互換。詳細は memory `project_marketing_roles.md`。

---

## ステップ2：①動画ストックを使えるようにする（院長操作）

Supabase ダッシュボード（プロジェクト **yuuki-marketing** = `azkxheahlbnxwfggcpsm`）→ SQL Editor で下記を実行（冪等・安全）:

```sql
create table if not exists marketing_videos (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table marketing_videos enable row level security;
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
drop trigger if exists trg_marketing_videos_updated on marketing_videos;
create trigger trg_marketing_videos_updated
  before update on marketing_videos
  for each row execute function set_updated_at();
```

実行後、`https://yuuki-rehab.vercel.app/marketing/videos` を再読込 → 「テーブル未作成」が消え、登録・一覧・検索が使える。
（SQLの正本：`supabase/migrations/20260720_marketing_videos.sql`）

---

## ステップ3：③SEO/GEO — ✅実装済み（commit `99f24f3`・`beafbb2`、要push）

実装済み:
- `src/lib/site/seo.ts` — `MedicalClinic`（住所・電話+81・診療時間・sameAs・地図）と `FAQPage` のJSON-LDビルダー。NAPは `marketing/clinic.ts` を正本に統一
- `src/components/site/JsonLd.tsx` — Next公式方式で `<script type="application/ld+json">` を安全描画
- `(website)/layout.tsx` — `metadataBase` 設定＋全公開ページに医院JSON-LD
- `(website)/faq/page.tsx` — 12問のFAQPage構造化データ
- `robots.ts` — 内部スタッフアプリ経路をdisallow／`sitemap.ts` — 公開 `/drills` 追加

検証済み（dev）: 両JSON-LDのHTML出力・電話 `+81-83-265-4545`・FAQ12件・robots.txt/sitemap.xml反映・コンソールエラー無し。

**未実装（任意・低優先）:** 各症状ページのBreadcrumbList／canonical、blog個別記事のArticle（現状blogは一覧のみで記事ページ無し）。
**※検索順位・AI引用は保証しない**旨を院長に明示すること。

---

## ステップ4：④Instagram 接続（院長操作が必要）

Metaアプリ作成が「Facebookのパスワード再入力エラー」で中断中。手順書 `docs/marketing-hub/INSTAGRAM-SETUP.md`。
接続コードは完成済み（commit `cc8fe8f`/`84a5167`）なので、接続さえ通れば承認→IG自動投稿が動く。

---

## 触ってはいけない／注意（引き継ぎ必須）

- **予約システム(GAS)**：本番の予約ウェブアプリはスタンドアロンGAS。触らない。通知は予約管理表スプレッドシートのバインドスクリプト側トリガーで実現済み。
- **LINE応答設定**：チャットモードONのままでボット・メニュー動作する。応答モードは変更不要。本番アカウント @432amljv。
- **医療広告コンプラ**：「完全治癒」「必ず治る」「地域No.1」「ビフォーアフター」等NG（`src/lib/marketing/compliance.ts`）。AI自動公開は不採用・人の承認必須・患者情報を外部AIに送らない。
- **ローカル検証**：`.env.local` の `SUPABASE_SERVICE_ROLE_KEY` は無効。検証時のみ `SUPABASE_URL` を `#` でコメントアウトしファイル保存フォールバックで確認→必ず戻す。本番Vercelのキーは有効。
- **スタンドアロン化 = PWA方式**（実装済み・commit `4eee47d`）。別リポ/別デプロイへの分離ではない。残：院長スマホでの「ホーム画面に追加」実機確認、localStorage→Supabase段階移行。

---

## 参照

- memory: `project_marketing_hub` / `project_marketing_roles` / `project_pwa_video_stock` / `project_yoyaku_gas` / `feedback_deployment` / `feedback_secret_transfer` / `reference_clinic_info`
- 手順書: `docs/marketing-hub/`（INSTAGRAM-SETUP / RESERVATION-LINE-NOTIFY-SETUP / GOOGLE-BUSINESS-SETUP など）
- 院基本情報：電話 083-265-4545／緊急直通 090-5702-7731／住所 山口県下関市彦島江の浦町9丁目1-14／LINE @432amljv
