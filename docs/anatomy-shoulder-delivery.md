# 肩関節の層つき解剖図・膝関節の作り直し（2026-11-07）

肩3方向・膝4方向を、骨原画と透過軟部組織原画から新規作成した。全方向で最終WebPの層合成と1枚絵が画素単位で完全一致し、座標検査・TypeScript検査を通過した。Git管理領域への書き込みが拒否されたため、コミット・push・PRは未実施。変更は作業ツリーに残している。

## 納品物

- 肩：`public/anatomy/shoulder/{anterior,posterior,lateral}{,-bone,-ligament}.webp`（9枚）。
- 膝：`public/anatomy/knee/{anterior,posterior,medial,lateral}{,-bone,-ligament}.webp`（12枚）。旧1枚絵の分解をやめ、1枚絵も作り直した。
- `src/lib/anatomy/zones/shoulder.json`：前面5・後面4・外側7領域、指定の9 IDを網羅。
- `src/lib/anatomy/zones/knee.json`：前面6・後面5・内側7・外側7領域、新しい図に合わせて座標を再設定。既存11 ID・label・typeを維持。
- `src/lib/anatomy/index.ts`：膝・足関節と同じimport・登録方法でshoulderを追加。
- [生成指示全文](anatomy-review/knee-shoulder-generation-prompts.json)、[検査数値](anatomy-review/metrics.json)、下記の確認画像。

すべて1000×1300px、右側の関節、グレースケール、文字・番号・引き出し線なし。骨層は白背景・不透明、靭帯・腱層はWebPのalpha付き。左右反転は既存の `mirrorForLeft: true` を使用する。

容量はbytesで記載。最も大きい画像も308,544 bytesで、厳しめの400,000 bytes以下に収まる。

| 関節 | 向き | 1枚絵 | bone | ligament |
|---|---|---:|---:|---:|
| 膝 | anterior | 207,978 | 77,218 | 69,478 |
| 膝 | posterior | 176,032 | 45,108 | 14,688 |
| 膝 | medial | 296,256 | 77,768 | 48,120 |
| 膝 | lateral | 272,052 | 75,240 | 74,486 |
| 肩 | anterior | 308,292 | 79,606 | 64,236 |
| 肩 | posterior | 308,544 | 96,130 | 69,348 |
| 肩 | lateral | 218,414 | 64,560 | 27,394 |

## 作り方

組み込みの `image_gen` を使用した。CLI/APIへの切替は行っていない。外部の図や `public/joints` の旧図を入力・模写せず、方向ごとに独立した骨原画を生成した。

1. 骨・軟骨・関節裂隙を主体に原画を作成した。膝の半月板とACL/PCL、肩の関節唇は骨層側に薄く含めた。
2. Sharpでグレースケール化・縮小・白い余白の調整を行い、1000×1300px、WebP品質90で骨層を保存した。膝後面は前面との顆部の大きさを揃えるため縮小しており、描かれている骨幹の範囲は前面より短い。
3. 保存した骨層を位置の参照として、靭帯・腱・滑液包だけを真の透過背景で生成した。骨は透過原画に描かせていない。
4. 生成時の余白・位置のずれを、組織ごとの切り出し・縮尺・配置で調整した。元のalphaを使い、輪郭外の白い粒や孤立した画素を除去し、薄い描画になるよう透明度を調整した。膝前面のMCL下端は脛骨内側の骨面に合わせた。外側のITBはGerdy結節で止め、脛骨粗面に付く膝蓋腱から分けた。膝後面の配置調整は両層に同じ変換を適用した。
5. 透過層をlossless WebPで保存し、**納品する骨WebP＋透過WebPをデコードして合成**した結果を、lossless WebPの1枚絵として保存した。合成後の1枚絵だけに別の画像調整は加えていない。
6. 完成画像に選択領域を重ね、部位ID・label・typeを正本 `JointDetailMap.tsx` と照合した。左右反転した画像と領域も確認した。

原画・配置調整スクリプトはこの作業環境の `.post-images/anatomy-rebuild/` に保存（Git対象外）。原画のコピーは同ディレクトリの `raw/`、配置と切り出し座標は `placements.json`。納品画像はすべて `public/anatomy` に置いてあり、原画のローカルパスには依存しない。

今後の作成方法も [依頼書の「1.5 層」](anatomy-illustrations-brief.md) に統一した。確定した層から1枚絵を再生成する [compose-anatomy-layers.mjs](../tools/compose-anatomy-layers.mjs) を追加した。

```powershell
node tools/compose-anatomy-layers.mjs knee shoulder
node tools/test-anatomy-zones.mjs
npx.cmd tsc --noEmit
node tools/review-anatomy-layers.mjs docs/anatomy-review
```

## 層・向き・選択部位

膝は前面の腓骨・LCLが向かって左、後面では右。内側図の前方は向かって右、外側図の前方は左。筋層は設けず、鵞足部・ITB周辺の筋腱移行部も靭帯・腱層に含めた。

**ACL/PCLの描画は骨層に残るが、`knee_acl` の保存typeは従来どおり `ligament`。** 既存のアプリ仕様に従い、靭帯・腱層を非表示にするとACL/PCLの選択領域も非表示になる。半月板は `meniscus` のままで、骨層に対応する。

肩は前面の上腕骨が向かって左、後面では右。外側図は前方が向かって左。腱板・上腕二頭筋長頭腱・肩峰下滑液包・AC関節の靭帯は靭帯・腱層、関節唇は骨層に置いた。外側図は上腕骨頭を薄く透かして関節唇を見せた説明図で、深部の前方・後方・上方を同じ図で選べる。

| 肩の部位ID | label / type | 選択できる向き |
|---|---|---|
| sh_bursa | 肩峰下滑液包 / bursa | anterior・posterior・lateral |
| sh_ac | AC関節 / ligament | anterior・posterior・lateral |
| sh_sup | 棘上筋腱 / tendon | anterior・posterior・lateral |
| sh_sub | 肩甲下筋腱 / tendon | anterior |
| sh_inf | 棘下筋・小円筋腱 / tendon | posterior |
| sh_lhb | 上腕二頭筋長頭腱 / tendon | anterior・lateral |
| sh_ant_lab | 関節唇前方 / cartilage | lateral |
| sh_post_lab | 関節唇後方 / cartilage | lateral |
| sh_slap | 上方関節唇SLAP / cartilage | lateral |

構造の関係は文章資料で照合した。MCLの大腿骨―脛骨、LCLの大腿骨―腓骨の接続は [AAOS](https://www.orthoinfo.org/diseases--conditions/collateral-ligament-injuries/)、肩の骨・AC関節・腱板・関節唇は [Washington Universityの肩解剖](https://www.ortho.wustl.edu/content/Patient-Care/3138/Services/Shoulder-Elbow/Overview/Shoulder-Instability-Information/The-Anatomy-of-the-Shoulder.aspx)、上方関節唇と長頭腱の関係は [AAOSのSLAP解説](https://www.orthoinfo.org/diseases--conditions/slap-tears/) を参照した。各資料の画像は使用していない。

## 確認結果

- `node tools/test-anatomy-zones.mjs`：**問題なし**。肩9 ID、膝11 IDを全件含む。
- `npx.cmd tsc --noEmit`：**終了コード0**。Windowsでの `npx tsc --noEmit` 相当。
- `node tools/review-anatomy-layers.mjs docs/anatomy-review`：**終了コード0**。
- 膝4方向・肩3方向に加え、受け入れ済み足関節4方向も **最大チャンネル差0・平均差0・完全一致true**。足関節の納品ファイルは変更していない。
- 全21枚の実寸・形式・容量、骨層の全画素の不透明、白い四隅、透過層のalpha・透明な四隅・空でない組織を検査。
- 全領域の外接幅・高さ60px以上、重なりの描画順を考慮して各領域に押せる点があること、その点の左右反転でも同じIDを選べることを検査。
- 比較画像・層単体・右図と左反転図の領域重ね合わせを目視確認。確認画像内の見出し・IDはQA専用で、納品画像には含まれない。
- 既存lint16件は依頼どおり対象外。

[膝：合成差分](anatomy-review/knee-comparison.webp) · [層単体](anatomy-review/knee-isolated.webp) · [選択領域・反転](anatomy-review/knee-zones.webp)

[肩：合成差分](anatomy-review/shoulder-comparison.webp) · [層単体](anatomy-review/shoulder-isolated.webp) · [選択領域・反転](anatomy-review/shoulder-zones.webp)

比較画像は左から1枚絵／層の合成／50%重ね合わせ／絶対差分5倍。差分列が全面黒であることが一致を示す。以前の膝の「分解した層と旧1枚絵が一致しない」課題は、新規原画からの再構成によって解消した。

## 残課題・引き継ぎ

- 院長・Claudeによる臨床上の最終確認：生成図の骨形状、腱・靭帯の付着位置、方向と部位名の対応。膝の深部構造と肩外側の関節唇は、周囲組織を省略・透視した説明用の表現である。
- ログインしたカルテ画面でのスマホ幅、方向切替、左右切替、層の表示・非表示、部位の選択・解除は未実施。今回の操作確認は画像・座標・幾何検査まで。
- 開始時HEADは `34c041b`（detached HEAD）。`git switch -c codex/knee-rebuild-shoulder-layers` は `C:/Users/PC/yuuki-rehab/.git/refs/heads/codex/knee-rebuild-shoulder-layers.lock: Permission denied` で失敗した。依頼どおり、変更を残してClaudeにコミット・PR作成を引き継ぐ。本番反映は未実施。
