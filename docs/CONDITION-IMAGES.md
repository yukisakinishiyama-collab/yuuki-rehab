# 疾患別 実写画像の追加・差し替え手順

患者説明モードに表示する実写写真の運用手順。
（元指示: `YUUKI_REHAB_画像統合_AI指示書.md`）

## 仕組み

画像パスはコードに散在させず、`src/lib/condition-images.ts` のマニフェスト一箇所で管理する。
画像の実体は既存のイラスト基盤が解決する。

```
イラスト管理画面でアップロードした画像（Vercel Blob / KV）
  ↓ 無ければ
public/illustrations/<スロット名>.png
  ↓ 無ければ
表示しない（枠ごと出ないので画面は崩れない）
```

このため **画像を追加・差し替えるだけならコード変更もデプロイも不要**。

## 画像を入れる（いちばん簡単な方法）

1. アプリの「イラスト管理」画面（`/illustrations`）を開く
2. 下記のスロットにファイルをアップロードする
3. 患者説明モードを開くと反映されている（再デプロイ不要）

| スロット名 | 用途 | 初期ファイル名（指示書§10） |
| --- | --- | --- |
| `condition-acl-knee` | 膝・ACL | 01_ACL_knee_rehab.png |
| `condition-ankle-instability` | 足関節・不安定症 | 02_ankle_instability_rehab.png |
| `condition-hip` | 股関節 | 03_hip_rehab.png |
| `condition-shoulder-cuff` | 肩・腱板 | 04_shoulder_rotator_cuff_rehab.png |
| `condition-lumbar` | 腰部 | 05_lumbar_low_back_rehab.png |
| `condition-return-to-sport` | スポーツ復帰 | 06_return_to_sport_rehab.png |

リポジトリに直接入れる場合は `public/illustrations/<スロット名>.png` に置く
（ファイル名をスロット名に合わせること）。

## 画像の仕様

- 縦横比 **4:3**（表示は `object-fit: cover`。重要部位は中央〜やや左に）
- 推奨 1440×1080 以上、PNG / JPEG / WebP
- アップロードは **4MB以下**（Vercelのリクエスト上限）。
  指示書の目安 300KB〜1.2MB に最適化しておくと表示も速い
- 画像内に文字・ロゴ・ウォーターマークを入れない
- 強い赤や恐怖を感じさせる表現は避ける（患者に見せる画面のため）

## どの写真が出るか

1. カルテ「目標と課題」カードの **「説明モードに出す写真」** で施術者が選んだもの（最優先）
2. 「おまかせ」の場合は診断名・プロトコル名・部位・現在フェーズから自動推定
   （復帰期のフェーズは「スポーツ復帰」を優先）
3. 「写真を表示しない」を選べば非表示

自動推定はあくまで候補で、**最終的にどれを見せるかは施術者が決める**（指示書§9）。

## 疾患を追加するとき

`src/lib/condition-images.ts` の `CONDITION_IMAGES` に1件追記し、
`src/lib/illustrations.ts` の `ILLUSTRATION_SLOTS` に同じスロット名を追加する。

```ts
{
  conditionId: 'achilles',
  title: 'アキレス腱のリハビリ',
  slot: 'condition-achilles',
  alt: 'ふくらはぎのリハビリテーションを行う様子',
  version: '1.0',
  bodyRegions: ['ankle'],
  match: /(アキレス|achilles|下腿三頭筋)/i,
  patientCaption: 'ふくらはぎの力を戻していく練習です。段階に合わせて負荷を上げていきます。',
}
```

`patientCaption` は患者さんが読む文章。治癒を保証する表現（必ず治る・完治など）は使わない。

## 差し替え時の注意

- 旧画像は削除せず退避しておく（比較・巻き戻しのため）
- 大きく内容を変えたときは `version` を上げる
- 機能を止めたいときは Feature Flag `conditionImages` を `false` にする
  （`src/lib/feature-flags.ts` の既定値を変更してデプロイすれば全端末で止まる）
