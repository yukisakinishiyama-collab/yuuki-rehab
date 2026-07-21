# 作業記録（2026年7月20〜21日セッション）

このファイルは、当該セッションで行った作業を最初から通して記録したものです。
後から見返して状況を把握するためのものです。

---

## 全体サマリ

大きく4つの塊で作業しました。

1. **マーケハブの権限分け（②）** — 院長=管理者／スタッフ=編集
2. **SEO/GEO（③）** — 構造化データ・robots/sitemap・パンくず
3. **ブログ記事ページの新設** — 一覧だけで読めなかった記事に本文を追加
4. **SNSリール6本の作成と予約投稿** — Meta Business Suiteで8月分を予約完了

コード変更は yuuki-rehab リポジトリに **13コミット（すべてローカル・未push）**。
リール予約は Meta 上で完了済み（本番反映済み）。

---

## 1. マーケハブの権限分け（②）

**目的**：院長は全操作、スタッフは閲覧・下書き・動画登録までに制限。

- commit `2042cd9`
- `src/proxy.ts` が2つのパスワードで役割判定（`MARKETING_ADMIN_PASSWORD`=admin、
  `MARKETING_STAFF_PASSWORD`=staff）。役割を権威的にヘッダー注入。
- 管理者限定：予約公開・公開制御・動画削除。UIでも該当ボタンをスタッフに非表示。
- **後方互換**：`MARKETING_STAFF_PASSWORD` を設定するまで従来通り（管理者のみ）。
- 詳細メモリ：`project_marketing_roles`

**有効化に必要な院長操作**：`git push` 後、Vercelに `MARKETING_STAFF_PASSWORD` を追加。

---

## 2. SEO/GEO（③）

検索エンジン・AIに院情報を正しく伝えるための構造化データを整備。

- commit `99f24f3` — `MedicalClinic`＋`FAQPage` のJSON-LD、`metadataBase`
- commit `beafbb2` — robotsで内部スタッフアプリを検索除外、sitemapに `/drills` 追加
- commit `519aae2` — 症状14ページに `BreadcrumbList`（パンくず）

- 新規：`src/lib/site/seo.ts`、`src/components/site/JsonLd.tsx`、
  `src/components/site/SymptomBreadcrumbJsonLd.tsx`
- NAP（院名・住所・電話）は `src/lib/marketing/clinic.ts` を唯一の正本として統一。
- dev環境で全JSON-LDのHTML出力・電話 `+81-83-265-4545`・コンソールエラー無しを検証。
- ※検索順位・AI引用そのものは保証されるものではない。

---

## 3. ブログ記事ページの新設

**発見した問題**：ブログ一覧に6件のカードが並ぶのに記事ページが無く、本文も無かった
（訪問者が記事を読めない状態）。

- commit `a972948`
- 新規：`src/lib/site/blog.ts`（記事データ＋本文）、
  `src/app/(website)/blog/[slug]/page.tsx`（詳細ページ）
- 6記事すべて本文を執筆（各 約1,000〜1,400字）。`BlogPosting` 構造化データ・canonical・
  パンくず・関連記事・LINE導線つき。一覧カードを記事へリンク。sitemapに6URL追加。
- 医療広告チェッカーで6/6記事 pass を確認。

---

## 4. LINE友だち追加URLの修正

**発見した問題**：`clinic.ts` の `lineUrl` が `lin.ee/432amljv`（404・無効）だった。

- commit `5bf0b82`
- リダイレクト追跡で判明：`lin.ee/uaGKbfk` と `lin.ee/uEQfCw1` は
  **どちらも本番アカウント `page.line.me/432amljv` に着地**（同一アカウントの別名URL）。
  一方 `lin.ee/432amljv`（@IDから組み立てたURL）は404。
- 公開サイト全30箇所はもともと正しい `lin.ee/uaGKbfk` を使用。`clinic.ts` の1箇所だけ
  誤っていたので修正。これでJSON-LDのsameAsとAI生成のLINE URLも同時に正常化。
- 詳細メモリ：`reference_clinic_info`

---

## 5. マーケティング素材の作成（ドキュメント）

- commit `e6536ac` — [POST-DRAFTS-2026-07.md](POST-DRAFTS-2026-07.md)：7〜8月のSNS投稿案6本
- commit `3dd4b2a`／`eb5331a` — 拡張機能・外部エージェント向けの依頼文
- commit `af7db29`／`d2d0998` — [CAPTIONS-2026-08.md](CAPTIONS-2026-08.md)：リール6本のキャプション
- commit `7cae443`／`b6efc96` — [NEXT-STEPS.md](NEXT-STEPS.md)：次のステップ引き継ぎ書
- すべて医療広告チェッカー（`checkContent()`）で pass 確認済み。

---

## 6. リール動画6本の作成と予約投稿 ★本番反映済み★

### 動画の作り方（次回のために）
1. アプリ内蔵の画像生成（`src/lib/marketing/image-template.ts`）を応用し、既存リール
   `IG_股関節.mp4` の様式（シアン＋白カード・院ロゴ・吹き出し・CTAボタン）をSVG→PNGで再現。
   日本語は Yu Gothic で描画するため文字化けしない（※Canva AI生成は日本語が文字化けするため不採用）。
2. ffmpegでPNG→**1080×1080・5秒・音声なし**のmp4に変換（参考動画と同仕様）。
3. 出力：`C:\Users\PC\Downloads\` の `1-ankle.mp4`〜`6-return.mp4`（PNGは `.post-images/`）。

### 予約した6本（Meta Business Suite・FB＋Instagram両方）
| # | 予定日時 | テーマ |
|---|---------|--------|
| ① | 2026-07-31(金) 19:00 | 足首ねんざの48時間 |
| ② | 2026-08-04(火) 19:00 | オスグッド |
| ③ | 2026-08-07(金) 19:00 | シンスプリント |
| ④ | 2026-08-11(火) 19:00 | 野球肘・肩 |
| ⑤ | 2026-08-14(金) 19:00 | 夏のコンディショニング |
| ⑥ | 2026-08-18(火) 19:00 | 復帰の判断基準 |

- 全12予約（6本×FB/IG）が正しい日時・キャプションで登録済み。既存3本（7/21・7/24・7/28）は無傷。
- 途中オスグッドが二重登録されたが、重複1組を削除して復旧済み。

### 予約作業で確立した手順（重要）
- **リモートデスクトップではコピペが日本語を文字化けさせる** → キャプションはAIが直接タイプ入力。
- **作りかけの投稿はセッション切れで消える** → 1本ずつ最後まで確定する。
- **最終の「公開日時を指定」ボタンは院長が押す**（AIが押すとセッション切れで二重登録が起きた）。
- 各本の確定後、日時指定済み一覧で FB1件＋IG1件・重複無しを確認してから次へ。
- 動画ファイルの選択はAI不可＝院長がアップロード。
- デスクトップに投稿画面ショートカット `Meta投稿作成.url` を設置済み。
- 詳細メモリ：`feedback_meta_reel_scheduling`

---

## 現在の状態と、院長に残っている操作

### ⚠️ コード変更13コミットはすべてローカル・未push
`git push origin main` で本番（Vercel）に反映されます。push はこのセッションのAIが
自動モード分類器にブロックされたため実行できませんでした。院長が手動でpushしてください。

未pushコミット（新しい順）：
```
eb5331a docs(marketing): 拡張機能へ渡す予約投稿の指示文を追加
d2d0998 docs(marketing): 6本目の見出しを短縮
af7db29 docs(marketing): 8月リール6本のキャプションを追加
3dd4b2a docs(marketing): 予約投稿を外部エージェントへ依頼する引き継ぎ書を追加
a972948 feat(website): ブログ記事ページを新設し本文6記事を公開
e6536ac docs(marketing): 2026年7-8月のSNS投稿案6本を追加
5bf0b82 fix(marketing): 院プロフィールのLINE友だち追加URLを修正
b6efc96 docs(marketing): ③にパンくず追加を反映
519aae2 feat(seo): 症状14ページにパンくず構造化データを追加
7cae443 docs(marketing): 次のステップ引き継ぎ書を追加・③完了を反映
beafbb2 feat(seo): robotsで内部アプリを除外・sitemapに/drills追加
99f24f3 feat(seo): 構造化データ(JSON-LD)とmetadataBaseを追加
2042cd9 feat(marketing): 院長/スタッフの権限分け
```

### 院長に残っている操作（優先順）
1. **デプロイ**：`git push origin main`（②③④ブログ・LINE修正がまとめて本番反映）
2. **②権限を有効化**：Vercelに `MARKETING_STAFF_PASSWORD` を追加＋空コミットpush
3. **動画ストック①**：Supabaseで `marketing_videos` テーブル作成SQLを実行（[NEXT-STEPS.md](NEXT-STEPS.md) 参照）
4. **Instagram API接続④**：Meta連携の再開（`INSTAGRAM-SETUP.md`）
   ※今回のリール予約は Meta Business Suite の手動予約なので、API接続が無くても8月分は投稿される。

### リール予約はすでに本番反映済み（追加操作不要）
8月分6本は Meta 上で予約完了しているため、7/31〜8/18の火・金19:00に自動投稿されます。

---

## 関連ファイル・メモリ

- ドキュメント：`docs/marketing-hub/`（POST-DRAFTS / CAPTIONS / NEXT-STEPS /
  拡張機能への依頼文 / 本ファイル）
- キャプション個別ファイル：`C:\Users\PC\Downloads\投稿キャプション\`
- 動画：`C:\Users\PC\Downloads\1-ankle.mp4`〜`6-return.mp4`
- メモリ：`project_marketing_hub` / `project_marketing_roles` /
  `reference_clinic_info` / `feedback_meta_reel_scheduling` / `feedback_deployment`

作成：2026-07-21
