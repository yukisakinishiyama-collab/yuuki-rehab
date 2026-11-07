# 腰部・股関節の層つき解剖図（2026-11-07）

腰部2方向・股関節3方向を、骨・靭帯・筋の3層で追加した。全19部位IDを網羅し、座標検査・TypeScript検査・層の合成一致検査を通過。Git管理領域への書き込みが拒否されたため、変更を作業ツリーに残している。コミット・PR作成はClaudeへ引き継ぐ。

## 納品物

- 腰部：`public/anatomy/lumbar/{posterior,lateral}{,-bone,-ligament,-muscle}.webp`（8枚）。
- 股関節：`public/anatomy/hip/{anterior,posterior,lateral}{,-bone,-ligament,-muscle}.webp`（12枚）。
- 座標：`src/lib/anatomy/zones/lumbar.json`、`src/lib/anatomy/zones/hip.json`。
- 登録：`src/lib/anatomy/index.ts` に両部位のimport・登録を追加。
- 検査：`tools/review-anatomy-layers.mjs` を、納品済みJSONの自動検出・筋層を含む全透過層・体幹の非反転に対応させた。既存の画素一致・容量・寸法・押せる領域の検査は維持した。
- [生成指示全文](anatomy-review/lumbar-hip/generation-prompts.json)、[検査数値](anatomy-review/lumbar-hip/metrics.json)、下記の確認画像。

全20枚が1000×1300px。グレースケール、文字・番号・引き出し線・矢印なし。骨層は白背景・全画素不透明、靭帯層と筋層はalpha付きで輪郭外を透明にした。最大342,806 bytesで、400,000 bytes以下に収まる。

| 部位 | 向き | 1枚絵 | bone | ligament | muscle |
|---|---|---:|---:|---:|---:|
| 腰部 | posterior | 340,796 | 106,166 | 38,816 | 190,114 |
| 腰部 | lateral | 224,140 | 75,290 | 29,190 | 134,510 |
| 股関節 | anterior | 294,246 | 91,116 | 85,450 | 131,484 |
| 股関節 | posterior | 342,806 | 123,006 | 107,704 | 227,136 |
| 股関節 | lateral | 256,148 | 90,266 | 89,976 | 138,470 |

容量の単位はbytes。

## 作り方

前便と同じ、独立した原画から層を組み立てる方法を使用した。組み込みの`image_gen`で生成し、CLI/APIには切り替えていない。実在の解剖図や`public/joints`の旧図は入力・流用・模写していない。

1. 各方向の骨だけの原画を新規生成。腰部はL1～L5の5高位・仙骨・骨盤、股関節は右寛骨・近位大腿骨と薄い関節唇を描いた。
2. Sharpで白い紙面のノイズを抑え、グレースケール化。骨の描画範囲を基準に上下余白と縮尺を調整し、1000×1300pxのWebP品質88で骨層を保存した。
3. 保存した骨層を位置の参照として、靭帯だけ、筋・神経だけの独立した透過原画を生成した。骨や別の層の組織を透過原画に含めないよう指示した。完成した1枚絵の分解は行っていない。
4. 元のalphaを保ち、輪郭外の白い粒と小さな孤立画素を除去。薄い重ね描きになるよう透明度を調整した。生成時に生じた位置・縮尺のずれは、組織ごとの切り出しと配置で補正した。特に股関節前面の腸腰筋下端を小転子付近へ、内転筋起始部を恥骨付近へ、外側の殿筋下端を大転子上部へ合わせた。
5. 靭帯・筋層をlossless WebPで保存。**納品する3層のWebPをデコードして合成**し、lossless WebPの互換用1枚絵を保存した。1枚絵だけに追加の画質調整は行っていない。
6. 最終画像に選択領域を重ねて座標を設定し、ID・label・typeを正本`JointDetailMap.tsx`と照合した。

原画コピーと加工スクリプトは、この作業環境の`.post-images/lumbar-hip/`に保存している（Git対象外）。`raw/`が生成原画、`bone-placements.json`が骨の余白・縮尺、`placements.json`が組織の配置、`prepare-bones.mjs`・`prepare-overlays.mjs`が画像処理、`write-zones.mjs`が座標書き出し。納品画像はすべて`public/anatomy`内にあり、この作業用ディレクトリには依存しない。

文章資料で位置関係を照合した。腰椎5高位は[AAOSの脊柱の説明](https://www.orthoinfo.org/diseases--conditions/spine-basics/)、関節唇と大転子・腸脛靭帯の関係は[HSSの股関節解説](https://www.hss.edu/health-library/conditions-and-treatments/hip-pain-faqs)、梨状筋の起始・停止は[Washington大学の筋解剖](https://www.rad.washington.edu/muscle-atlas/piriformis)、梨状筋と坐骨神経の位置関係は[解剖研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC9649478/)を参照。これらの画像は使用していない。

## 向き・左右・層と部位

腰部は`mirrorForLeft: false`。後面の**向かって右が患者さんの左**で、`lum_para_l`・`lum_si_l`・`lum_glut_l`はすべて画像の右半分、対応する`_r`は左半分に置いた。L1からL5は上から順に配置している。側面は右側から見た図（前方が向かって左）とし、右傍脊柱筋・右仙腸関節・右殿部のみを置いた。左の部位は後面から選択する。

| 腰部の部位 | 層 | 選択できる向き |
|---|---|---|
| `lum_l1`～`lum_l5` | bone | posterior・lateral |
| `lum_para_l`・`lum_glut_l` | muscle | posterior |
| `lum_para_r`・`lum_glut_r` | muscle | posterior・lateral |
| `lum_si_l` | ligament | posterior |
| `lum_si_r` | ligament | posterior・lateral |

腰部は後面11領域、側面8領域で、指定の11 IDを網羅する。

股関節は右股関節、`mirrorForLeft: true`。前面は大転子が向かって左、後面は右、外側は前方が向かって左。左股関節は既存の画面処理で画像と多角形を一緒に反転する。

| 股関節の部位ID | label / type | 層 | 選択できる向き |
|---|---|---|---|
| hip_groin | 鼠径部・腸腰筋 / muscle | muscle | anterior |
| hip_gt | 大転子 / bone | bone | anterior・posterior・lateral |
| hip_glut | 殿部・後方 / muscle | muscle | posterior・lateral |
| hip_add | 内転筋群 / muscle | muscle | anterior |
| hip_lab | 関節唇 / cartilage | bone | anterior・lateral |
| hip_piri | 梨状筋 / muscle | muscle | posterior |
| hip_itb | 腸脛靭帯・外側 / ligament | ligament | anterior・posterior・lateral |
| hip_sci | 坐骨神経走行 / nerve | muscle | posterior・lateral |

股関節は各方向5領域で、指定の8 IDを網羅する。筋・神経はともに`muscle`層に属する。既存の`ZONE_LAYER`によって層を非表示にすると、該当部位の選択領域も非表示になる。ID・label・typeの追加・変更は行っていない。

## 確認結果

```powershell
node tools/compose-anatomy-layers.mjs lumbar hip
node tools/test-anatomy-zones.mjs
npx.cmd tsc --noEmit
node tools/review-anatomy-layers.mjs docs/anatomy-review/lumbar-hip
```

- 座標検査：**問題なし**。腰部11 ID・股関節8 IDを全件含む。
- `npx.cmd tsc --noEmit`：**終了コード0**。Windowsでの`npx tsc --noEmit`相当。
- 層の検査：**終了コード0**。新規5方向すべて、最大チャンネル差0・平均差0・完全一致true。既存の膝・足・肩11方向も一致を確認した。
- 全20枚のWebP形式・実寸・容量、骨層の全画素不透明・白い四隅、両透過層のalpha・透明な四隅・空でない描画範囲を検査。
- 全領域の外接幅・高さ60px以上、重なりを考慮しても押せる点が存在すること、左選択時に股関節だけが反転し同じIDに対応することを検査。腰部後面の左右IDが正しい半分に収まることも検査。
- 層単体、合成比較、領域重ね合わせと反転図を目視確認。確認画像の見出し・部位ID・色はQA専用で、納品画像には含まれない。
- `npm.cmd run lint`：終了コード1、16エラー・31警告。既存のReact Hooksなどのエラーが残るため、全体lintは未通過。今回の画像作成に伴うアプリ既存処理の修正は行っていない。
- 変更した`index.ts`・`review-anatomy-layers.mjs`と今回の作業用スクリプトを指定したeslint検査は終了コード0。

[腰部：合成差分](anatomy-review/lumbar-hip/lumbar-comparison.webp) · [3層単体](anatomy-review/lumbar-hip/lumbar-isolated.webp) · [領域・非反転](anatomy-review/lumbar-hip/lumbar-zones.webp)

[股関節：合成差分](anatomy-review/lumbar-hip/hip-comparison.webp) · [3層単体](anatomy-review/lumbar-hip/hip-isolated.webp) · [領域・左右反転](anatomy-review/lumbar-hip/hip-zones.webp)

比較画像は左から1枚絵／層の合成／50%重ね合わせ／絶対差分5倍。差分列は全面黒。検査数値には既存3関節の結果も含め、今回の確認画像は腰部・股関節のみ保存した。

## 残課題・引き継ぎ

- 院長・Claudeによる解剖学的な最終確認：骨形状、筋・靭帯の付着位置、各方向と部位名の対応。腰部側面はL5と仙骨上部を見せるため腸骨上部を一部切り欠いている。股関節後面・外側は、梨状筋・坐骨神経を示すため表層の殿筋を一部省略し、関節唇は骨層側で薄く描く説明用の表現。個体差を再現した診断用画像ではない。
- ログインしたカルテ画面でのスマホ幅、方向切替、左右切替、層の表示・非表示、選択・解除の操作確認は未実施。今回の確認は画像・データ・幾何検査まで。
- 開始時HEADは`8baf048`（detached HEAD）。`git switch -c codex/lumbar-hip-layers`は`C:/Users/PC/yuuki-rehab/.git/refs/heads/codex/lumbar-hip-layers.lock: Permission denied`で失敗した。依頼どおり変更を残し、Claudeへコミット・PR作成を引き継ぐ。今回の本番反映は未実施。
