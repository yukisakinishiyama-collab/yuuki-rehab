# ROLLBACK — 現行YUUKI REHABへの復旧手順

作成: 2026-08-08（次世代化プロジェクト PHASE 0）

**このタグまで戻せば、2026-08-08時点で正常稼働しているYUUKI REHABへ完全に復元できます。**

| 対象 | 復旧地点 |
|---|---|
| アプリ（本リポジトリ） | タグ `YUUKI_REHAB_STABLE_BASELINE_V1`（= commit `e2c0f01`・当日の本番デプロイと同一） |
| 予約システム（GAS） | `C:\Users\PC\Documents\予約管理表` のタグ `YOYAKU_STABLE_BASELINE_V1`（= `fb885c1`・本番反映済み） |
| 患者データ | `C:\Users\PC\Documents\yuuki-rehab-backups\localStorage-snapshot-2026-08-08.json`（クラウド同期の全キー34件・患者82名・約1.3MB） |
| 主要画面の記録 | 同フォルダの `screen-*-2026-08-08.png`（ダッシュボード・患者一覧・リハビリ管理・プロトコル・ROM） |

## 1. アプリコードの復旧（Vercel）

本番は `main` ブランチへの push で自動デプロイされる。

```bash
cd C:\Users\PC\yuuki-rehab
git checkout main
git reset --hard YUUKI_REHAB_STABLE_BASELINE_V1
git push --force-with-lease origin main
```

※ 次世代化の作業は `develop-nextgen` / `feature/*` ブランチで行い、`main` へは
　確認済みのものだけを入れる運用のため、通常はこの操作は不要のはず。
※ 機能単位で止めたい場合は、まず該当機能のFeature Flag（実装後に一覧化）をOFFにする。

## 2. 患者データの復旧

データの実体は「各端末の localStorage」と「クラウド（Supabase・/api/sync 経由の全キー同期）」。
クラウドが壊れた・消えた場合：

1. アプリをブラウザで開く
2. F12 → コンソールで、スナップショットJSONの内容を localStorage に書き戻す
   （Claudeに「バックアップから復元して」と依頼すれば、スクリプトを用意して実行まで行う）
3. 画面の「クラウドに同期」を押す（localStorage → クラウドへ push される）

⚠ 本番の同期は「起動時にクラウドの内容で localStorage を全上書き」する仕様のため、
　復元時は必ず【書き戻し → 即プッシュ】の順で行うこと（先にリロードすると再び消える）。

## 3. 予約システム（GAS）の復旧

```bash
cd C:\Users\PC\Documents\予約管理表
git checkout YOYAKU_STABLE_BASELINE_V1
```

その後、Code.gs / index.html / Admin.html / JavaScript.html / Style.html を
Apps Script エディタへ貼り替え → 「デプロイを管理」→ 既存デプロイを新バージョンで更新。
（貼り替えは localhost コピーページ方式を使うこと。手順の詳細は
`_管理画面からの予約を患者LINEへ通知_作業手順.md` と同じ）

## 4. ベースライン動作確認（復旧後に確認する項目）

- https://yuuki-rehab.vercel.app/patients … 患者一覧が表示される（82名前後）
- /patients/dashboard … リハビリ管理＋今日の予約ウィジェット
- /protocols … プロトコル一覧（34件前後）
- 予約ページ（GAS exec URL）… タイトル「ゆうき整骨院 ネット予約」で開く
- 公式LINEリッチメニュー「ネット予約」→ 予約ページが開く

## 5. ベースライン時点の localStorage キー一覧（データスキーマ）

クラウド同期対象＝localStorage 全キー（rehabStore_session / pt_initialized を除く）。
2026-08-08 スナップショット時点：

pt_patients(82) / pt_soap_notes(37) / pt_quick_memos(221) / pt_rehab_plans(118) /
pt_intakes(16) / pt_special_tests(29) / pt_evaluations(7) / pt_rom_records(5) /
pt_exercises(10) / pt_pinned / pt_recent_views / pt_version /
protocolList(34) / protocolPatients(40) / protocolMilestones(72) / protocolAssessments(2) /
rehabCases(80) / rehabAISummaries(45) / rehabDiscussions(7) / rehabChat(2) /
rehabExercisePrograms(4) / rehabMarkers(5) / rehabAnnotations / rehabComments / rehabEvals /
rehabUser / rehabInitialized / rehabVersion /
outcomeScores_v1(8) / returnCriteria(1) / yoyaku_feed_key ほか

※ 2026-08-07以降に追加された pt_cancellations / onedaySessions / disease_reviews 等は
　スナップショット時点でクラウド未送信だった（同期修正 dcaab0e により以後は送信される）。
