# 膝関節の解剖図（2026-11-07）

## 納品内容

- `public/anatomy/knee/{anterior,posterior,medial,lateral}.webp`
  - 1000 × 1300 px、白背景、不透明、グレースケール、文字・引き出し線なし。
  - 前面 110,008 bytes／後面 89,480 bytes／内側 119,600 bytes／外側 78,192 bytes。
- `src/lib/anatomy/zones/knee.json`
  - 指定の11 ID・label・typeを維持。前面4、後面5、内側7、外側7領域。
  - `mirrorForLeft: true`。既存の `src/lib/anatomy/index.ts` は変更なし。
- `tools/test-anatomy-zones.mjs`
  - WindowsでURLのpathnameが `C:\C:\...` になる問題を `fileURLToPath` で修正。検査条件は変更していない。

## 作成方法と生成指示

組み込みの `imagegen` で各方向を個別に新規生成した。既存の `public/joints` の画像は使用せず、外部の図も入力・模写していない。生成原画をSharpで1000 × 1300に収め、グレースケール化・白背景の調整後、WebP品質85で保存した。座標は最終WebP上で作成し、領域を重ねた画像で確認した。

生成指示の共通部分：

> Original medical textbook line illustration of an adult RIGHT knee joint, fine dark gray graphite/ink contours and very light grayscale hatching, bones dominant with faint semi-transparent tendons and ligaments, white background, portrait 1000:1300, joint cleft near 55% canvas height, matching scale, no text, labels, leader lines, arrows, numbers, captions or watermark. Do not copy any published diagram.

方向ごとの指示：

| 方向 | 追加指示 |
|---|---|
| anterior | True anterior view; fibula and LCL on viewer's left, MCL on viewer's right. Opaque patella with superior base and inferior apex; quadriceps tendon above, patellar tendon to tibial tuberosity below. Faint meniscal rims and medial/lateral soft tissues. |
| posterior | True posterior view; fibula and LCL on viewer's right, MCL on viewer's left. Two posterior femoral condyles and intercondylar notch; no visible patella or patellar tendon. Capsule omitted to reveal broad PCL and deeper crossing ACL; posterior meniscal rims. |
| medial | True medial view; anterior faces viewer's right. Broad flat MCL to medial tibia, medial meniscal edge, three pes anserinus tendons sweeping from posteromedial side toward anteromedial proximal tibial insertion. Fibula occluded by tibia. |
| lateral | True lateral view; anterior faces viewer's left. Fibular head posterolateral and below tibial plateau; cordlike LCL attaches to fibular head. Separate pale ITB ribbon attaches to Gerdy's tubercle on anterolateral proximal tibia; lateral meniscal edge. |

外側図は追加編集で、ITBの付着部が膝蓋腱の付く脛骨粗面と混同されないよう修正した。修正指示は「骨・膝蓋骨・膝蓋腱・腓骨・LCL・縮尺・画風を保ち、ITBの下端だけを関節裂隙直下のGerdy結節へ上げ、脛骨粗面へ伸びる誤った部分を除去」。

解剖学的な位置関係は [AAOSの側副靭帯の説明](https://www.orthoinfo.org/diseases--conditions/collateral-ligament-injuries/) と [NCBIの腸脛靭帯の説明](https://www.ncbi.nlm.nih.gov/books/NBK537097/) の文章で照合した。これらの図は使用していない。

## 確認

- `node tools/test-anatomy-zones.mjs`：問題なし。
- `npm run lint`（Windowsでは `npm.cmd run lint`）：既存の16エラー・30警告で終了コード1。解剖図の変更前にも同じエラーが発生した。今回のデータ・画像とは別のアプリ処理のため修正していない。全体lint通過は未達。
- WebPの実寸、不透明背景、400KB以下、全11 ID、label/typeの一致、座標範囲を確認。
- 全領域の縦横の外接寸法は60px以上。領域同士の重なりを考慮しても、すべてに押せる部分が残ることを確認。
- 左右反転した座標で同じIDが選ばれることを数値検証。4方向の領域重ね合わせも目視確認。

既存lintエラーの引き継ぎ（行番号は納品時点）：

| ファイル（`src/` 以下） | 行 | ルール |
|---|---|---|
| `app/(app)/marketing/analytics/page.tsx` | 156 | react-hooks/set-state-in-effect |
| `app/(app)/marketing/calendar/page.tsx` | 18 | react-hooks/set-state-in-effect |
| `app/(app)/marketing/compose/page.tsx` | 68 / 194 | react-hooks/set-state-in-effect / react-hooks/immutability |
| `app/(app)/marketing/line/page.tsx` | 31 | react-hooks/set-state-in-effect |
| `app/(app)/marketing/references/page.tsx` | 32 | react-hooks/set-state-in-effect |
| `app/(app)/marketing/settings/page.tsx` | 34 | react-hooks/set-state-in-effect |
| `app/(app)/patients/[id]/outcome-scores/page.tsx` | 54 / 62 / 68 / 74 | react-hooks/set-state-in-effect |
| `app/(app)/patients/[id]/page.tsx` | 20 | react-hooks/set-state-in-effect |
| `app/(app)/patients/page.tsx` | 72 | react-hooks/set-state-in-effect |
| `components/rehab/AuthGuard.tsx` | 45 | react-hooks/set-state-in-effect |
| `components/rehab/QRAutoLogin.tsx` | 17 | react-hooks/set-state-in-effect |
| `components/rehab/QRLoginModal.tsx` | 39 | react-hooks/set-state-in-effect |

## Claude・院長の最終確認

- 実際のカルテ画面でスマホ幅の操作、左右切替、選択・解除、ラベルの見え方を確認する。
- 生成図の骨・腱・靭帯の形状と付着位置を臨床担当者が確認する。深部のACL/PCLは位置を選ぶために後面で関節包を省略して描いており、表面から直接見える構造の表現ではない。
