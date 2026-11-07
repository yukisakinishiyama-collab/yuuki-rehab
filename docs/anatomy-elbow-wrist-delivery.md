# 肘関節・手関節／手指の層つき解剖図（2026-11-08）

肘関節4方向、手関節・手指2方向を、bone・ligament・muscleの3層で追加した。右肘・右手として描き、両方とも`mirrorForLeft: true`。既存の肘10 ID・手11 IDを網羅し、指定の座標検査・TypeScript検査・層の合成一致検査はすべて通過した。Gitへの書き込みができないため、変更を作業ツリーに残してClaudeへ引き継ぐ。

## 納品物

- 肘：`public/anatomy/elbow/{anterior,posterior,medial,lateral}{,-bone,-ligament,-muscle}.webp`（16枚）。
- 手：`public/anatomy/wrist/{palmar,dorsal}{,-bone,-ligament,-muscle}.webp`（8枚）。指先まで含む手全体を描き、示指～小指のMCPを両方向から選択できる。
- 座標：`src/lib/anatomy/zones/elbow.json`、`src/lib/anatomy/zones/wrist.json`。
- 登録：`src/lib/anatomy/index.ts`のimportと登録配列に2関節を追加。
- [生成・修正指示](anatomy-review/elbow-wrist/generation-prompts.json)、[配置補正](anatomy-review/elbow-wrist/placements.json)、[検査数値](anatomy-review/elbow-wrist/metrics.json)、下記の確認画像。

全24枚が1000×1300px、グレースケール、文字・番号・引き出し線・矢印なし。boneは白背景の不透明画像、ligamentとmuscleは輪郭外が透明なalpha付きWebP。最大181,316 bytesで、全画像が400,000 bytes以下。

| 関節 | 向き | 1枚絵 | bone | ligament | muscle |
|---|---|---:|---:|---:|---:|
| elbow | anterior | 181,316 | 59,590 | 49,286 | 56,134 |
| elbow | posterior | 172,670 | 51,970 | 37,228 | 61,904 |
| elbow | medial | 175,040 | 54,592 | 47,156 | 47,718 |
| elbow | lateral | 146,092 | 45,486 | 39,948 | 39,874 |
| wrist | palmar | 172,716 | 58,478 | 145,296 | 69,646 |
| wrist | dorsal | 171,596 | 50,700 | 160,722 | 14,912 |

容量の単位はbytes。確認画像に入れた見出し・ID・色・左右反転文字はQA用であり、`public/anatomy`の納品画像には含まれない。

## 作り方

前便と同じ、独立した原画から層を組み立てる方式を使用した。組み込みの`image_gen`で生成・修正し、CLI/APIには切り替えていない。実在の解剖図や`public/joints`の旧図を入力・模写・流用していない。

1. 骨と薄い軟骨表現だけの原画を各方向で新規生成。手は5指すべての末節まで含めた。背側の骨原画に混入したMCP間の軟部組織線は、画像生成の修正指示で除いた。
2. Sharpでグレースケール化と紙面の白点調整を行い、900×1170pxに縮小して左右50px・上下65pxの白余白を追加。1000×1300pxの骨層をWebP品質88で保存した。
3. 保存した骨層を位置参照として、靭帯・腱だけ、筋・神経だけの透過原画をそれぞれ生成。完成した1枚絵から層を分解する方法は使用していない。
4. 生成alphaを保持したRGBAデータ上でグレースケール化し、輪郭外の白い粒と小さな孤立画素を除去。骨を透かして見られるよう、靭帯はalphaを0.65倍、肘の筋は0.42倍、手の筋は0.55倍に調整した。背景を白く塗って透明に見せる処理はしていない。
5. 骨の目印を基準に組織を切り出し、位置・幅・高さを補正した。肘では二頭筋腱を橈骨粗面、三頭筋腱を肘頭、側副靭帯を各上顆と前腕側の付着部に合わせた。手背側の骨間筋は中手骨間へ移動した。肘前面・外側の筋原画に混入した不要な神経線は、画像生成の修正指示で除去した。切り出し残片は層単体の確認で取り除いた。
6. 透過層をlossless WebPで保存した後、**納品する3層のWebPをデコードして合成**し、互換用1枚絵をlossless WebPで保存した。1枚絵だけへの追加加工はしていない。
7. 最終画像に多角形を重ねて座標を設定し、ID・label・typeを正本`JointDetailMap.tsx`と照合した。

原画コピーと加工スクリプトは`.post-images/elbow-wrist/`（Git対象外）に保存した。`raw/`が採用原画、`assets.json`・`overlay-assets.json`が入力一覧、`prepare-bones.mjs`・`prepare-overlays.mjs`が画像処理、`placements.json`が配置補正、`write-zones.mjs`が座標出力。納品物の表示・合成検証は、この作業用ディレクトリに依存しない。

位置関係は文章資料でも照合した。UCLと尺骨神経は[AAOSの肘解説](https://www.orthoinfo.org/diseases--conditions/elbow-injuries-in-the-throwing-athlete/)、三頭筋腱の肘頭付着は[AAOSの三頭筋腱解説](https://www.orthoinfo.org/diseases--conditions/triceps-tendon-tear-at-the-elbow/)、手根骨の関係は[The Hand Societyの関節解説](https://assh.my.site.com/handcare/safety/joints)、手根管と正中神経は[AAOSの手根管解説](https://www.orthoinfo.org/bodypart/hand-wrist/carpal-tunnel-syndrome/)を参照。これらの画像は使用していない。

## 向き・部位・層

右肘の前面は橈骨・外側が向かって左、後面は右。内側図は前方が向かって右、外側図は前方が左で、側面は軽度屈曲した肘としている。右手の掌側は母指が向かって右、背側は左。左側の表示は既存の`AnatomyMap`が画像と多角形を同時に反転する。

| 肘のID | 層 | 選択できる向き |
|---|---|---|
| elb_lat_epi | ligament（tendon） | anterior・posterior・lateral |
| elb_med_epi | ligament（tendon） | anterior・posterior・medial |
| elb_olecranon | bone | posterior・medial・lateral |
| elb_ucl | ligament | anterior・medial |
| elb_lcl | ligament | anterior・lateral |
| elb_cubital | muscle（nerve） | posterior・medial |
| elb_biceps_t | ligament（tendon） | anterior・lateral |
| elb_triceps_t | ligament（tendon） | posterior・medial・lateral |
| elb_comm_ext | muscle | anterior・posterior・lateral |
| elb_comm_flex | muscle | anterior・posterior・medial |

肘は前面7領域・後面7領域・内側6領域・外側6領域。外側上顆・内側上顆は名称に骨の目印が入るが、既存typeが`tendon`なのでligament層に属する。

| 手のID | 層 | 選択できる向き |
|---|---|---|
| wrist_rad_styloid | ligament（tendon） | palmar・dorsal |
| wrist_uln_styloid | bone | palmar・dorsal |
| wrist_tfcc | bone（cartilage） | palmar・dorsal |
| wrist_carpal_tunnel | muscle（nerve） | palmar |
| wrist_scaphoid | bone | palmar・dorsal |
| wrist_lunate | bone | dorsal |
| wrist_1cm | bone（cartilage） | palmar・dorsal |
| wrist_mcp_index / middle / ring / little | bone（cartilage） | palmar・dorsal |

手は掌側10領域・背側10領域で、11 IDを網羅する。月状骨の選択は、掌側の手根管領域との重なりを避けて背側に集約した。橈骨茎状突起・de Quervainは既存typeの`tendon`を維持。背側の筋層には骨間筋を描いたが、新しい部位IDは増やしていない。

既存の`ZONE_LAYER`に従い、bone/cartilageはbone、tendon/ligamentはligament、muscle/nerveはmuscle。ID・label・typeと層の対応を変更していない。既存画面の層フィルターにより、非表示にした層の部位も選択対象から外れる。

## 確認結果

```powershell
node tools/compose-anatomy-layers.mjs elbow wrist
node tools/test-anatomy-zones.mjs
npx.cmd tsc --noEmit
node tools/review-anatomy-layers.mjs .post-images/elbow-wrist/review
npx.cmd eslint src/lib/anatomy/index.ts
```

- 座標検査：**問題なし／終了コード0**。肘10 ID・手11 IDを全件含む。
- TypeScript：**終了コード0**。`npx.cmd`はWindowsでの`npx`相当。
- 層の合成検査：**終了コード0**。新規6方向すべて最大チャンネル差0・平均差0・完全一致true。既存16方向も完全一致し、計22方向で合格。
- 全24枚のWebP形式・1000×1300実寸・400,000 bytes以下を検査。骨層は全画素不透明で四隅が白、両透過層はalpha付き・四隅が透明・描画範囲が空でないことを確認。
- 全領域の外接幅と高さが60px以上で、描画順による重なりを考慮しても各領域に押せる点があること、左右反転した点が同じIDになることを検査。
- 層単体・合成差分・領域重ね合わせ・左右反転を目視確認。5指、MCPの位置、文字の混入がないことを確認した。
- 変更した`index.ts`のeslint：**終了コード0**。`git diff --check`も終了コード0。
- 追加で実行した`npm.cmd run lint`は、既存箇所の**16エラー・30警告、終了コード1**。マーケティング画面や認証画面のReact Hooks等の問題があり、全体lintは未通過。今回の変更は画像・座標・登録に限定した。

[肘：合成差分](anatomy-review/elbow-wrist/elbow-comparison.webp) · [3層単体](anatomy-review/elbow-wrist/elbow-isolated.webp) · [領域・左右反転](anatomy-review/elbow-wrist/elbow-zones.webp)

[手：合成差分](anatomy-review/elbow-wrist/wrist-comparison.webp) · [3層単体](anatomy-review/elbow-wrist/wrist-isolated.webp) · [領域・左右反転](anatomy-review/elbow-wrist/wrist-zones.webp)

比較画像は左から1枚絵／3層の合成／50%重ね合わせ／絶対差分5倍。差分列は全面黒。検査数値には既存関節の結果も含め、確認画像は今回の2関節分を保存した。

## 残課題・引き継ぎ

- 院長・Claudeによる解剖学的な受け入れ確認：上顆・肘頭と腱の付着位置、UCL/LCL・尺骨神経の走行、手根骨・TFCC・第1CM・各MCPの対応。骨を見せるため筋を部分的に省略した模式的な透過図であり、TFCCは複合体の全構造を細密に描き分けたものではない。
- ログインした実際のカルテ画面でのスマホ幅、方向切替、左右切替、層の表示・非表示、選択・解除の操作確認は未実施。今回の確認範囲は画像・データ・幾何検査まで。
- 開始時HEADは`1d3f9da`（PR #68、detached HEAD）。`git switch -c codex/elbow-wrist-layers`はGit管理領域への書き込み時に`cannot lock ref`／`unable to create directory`で失敗した。依頼どおり変更を残しており、コミット・PR作成・本番反映は未実施。Claude側で変更をコミットしてPRを作成し、院長の確認へ進める。
