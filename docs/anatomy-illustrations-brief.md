# 解剖図イラストの依頼書（Codex 向け）

ゆうき整骨院の院内アプリ（カルテ）で、関節の「どこが痛いか・どこを施術したか」を図の上で押して選ぶための解剖図を作ってください。
この依頼書どおりに納品すると、アプリ側（Claude が作った土台）がそのまま読み込んで表示します。

- ルール: `AGENTS.md` のとおり（`main` へ直接コミットせず PR、`.env*` は触らない）
- 完成の確認: `node tools/test-anatomy-zones.mjs` が「問題なし」になること。これが受け入れ条件です
- 画面での確認: `npm run dev` → カルテ → 問診票 または 評価・測定 → 関節を選ぶ → 図が出る

## 1. 納品物

関節ごとに次の2つ。

| 何 | 置き場所 | 形式 |
|---|---|---|
| イラスト（向きごとに1枚） | `public/anatomy/<key>/<view>.webp` | WebP、**1000×1300px**（縦長）、1枚 **400KB 以下** |
| 押せる部位の座標 | `src/lib/anatomy/zones/<key>.json` | 下の「3. JSON の形」 |

`<key>` と関節名の対応（`joint` は画面で使う日本語名。**変えない**）:

| key | joint | 用意する向き（view） | 左右反転（mirrorForLeft） |
|---|---|---|---|
| knee | 膝関節 | anterior, posterior, medial, lateral | true |
| shoulder | 肩関節 | anterior, posterior, lateral | true |
| hip | 股関節 | anterior, posterior, lateral | true |
| ankle | 足関節 | anterior, posterior, medial, lateral | true |
| elbow | 肘関節 | anterior, posterior, medial, lateral | true |
| wrist | 手関節・手指 | palmar, dorsal | true |
| cervical | 頚部 | posterior, lateral | false |
| lumbar | 腰部 | posterior, lateral | false |

**右側の関節として描いてください**（左はアプリが左右反転します）。頚部・腰部は体幹なので反転しません（左右の部位IDがそれぞれあります）。

納品の順番は **膝 → 足 → 肩 → 腰 → 股 → 肘 → 手 → 頚** でお願いします（1関節ずつ PR で構いません。`src/lib/anatomy/index.ts` の import に1行足してください）。

## 1.5 層（軟部組織を押して外せるように）— 2026-11-07 追加

院長の希望で、**骨 → 靭帯・腱 → 筋** を層にして、画面で「筋」「靭帯・腱」を押して外し、下の構造を見られるようにします。

向きごとに次の画像を用意してください（`public/anatomy/<key>/<view>-<layer>.webp`）:

| 層 key | ファイル | 中身 | 透過 |
|---|---|---|---|
| bone | `<view>-bone.webp` | 骨・軟骨・半月板・関節裂隙だけ。白背景 | 不透過でよい |
| ligament | `<view>-ligament.webp` | 靭帯・腱・滑液包だけ（骨は描かない） | **透過**（骨の上に重ねる） |
| muscle | `<view>-muscle.webp` | 筋・神経だけ（骨・靭帯は描かない） | **透過** |

- 3枚は**同じ構図・同じ縮尺・同じ位置**で描く（重ねたときにずれないこと）。1枚絵をまず作り、そこから層を分けると揃えやすい
- 透過は WebP の alpha を使う。輪郭の外は完全透明に。半透明の陰影は可
- `image`（1枚絵）も引き続き用意する（層をすべて重ねた見た目と同じもの。古い画面・印刷の下絵）
- 部位の多角形は、その部位の種類（type）で層が決まる（bone/cartilage/meniscus → bone、ligament/tendon/bursa → ligament、muscle/nerve → muscle）。層を外すと、その層の部位は押せなくなる

JSON には `layers` を足します:

```json
{
  "view": "anterior",
  "image": "/anatomy/knee/anterior.webp",
  "width": 1000, "height": 1300,
  "layers": [
    { "key": "bone",     "image": "/anatomy/knee/anterior-bone.webp" },
    { "key": "ligament", "image": "/anatomy/knee/anterior-ligament.webp" },
    { "key": "muscle",   "image": "/anatomy/knee/anterior-muscle.webp" }
  ],
  "zones": [ ... ]
}
```

膝は、まず1枚絵と座標で納品してから、層の3枚を追加してください（膝で形が固まったら、他の関節は最初から層つきで）。筋が主題でない関節（例: 足関節の靭帯図）は muscle 層を省略してよい（bone と ligament の2層）。

## 2. 画風（必ず揃える）

- 医学書のような**線画＋薄い陰影**のイラスト。骨を主体に、靭帯・腱・筋は半透明に重ねて位置が分かる程度に描く
- **白背景**（透過不要）。**文字・引き出し線・矢印・番号を入れない**（部位名はアプリが出します）
- 線は黒〜濃いグレー、陰影は薄いグレーかごく薄いベージュ。色は使わない（部位の色付けはアプリがします）
- 関節が画面の中央、上下に少し余白。向きごとに縮尺を揃える（前面と後面で大きさが変わらないように）
- 実在の解剖図・教科書・サイトの図を**写さない**（著作権）。自分で描いた一般的な解剖の形にすること
- 既存の `public/joints/*.webp`（4面が1枚に入った旧図）は参考の画風として見てよいが、流用しない

## 3. JSON の形

```json
{
  "joint": "膝関節",
  "key": "knee",
  "mirrorForLeft": true,
  "credit": "Codex 2026-11-xx",
  "views": [
    {
      "view": "anterior",
      "image": "/anatomy/knee/anterior.webp",
      "width": 1000,
      "height": 1300,
      "zones": [
        { "id": "knee_patella", "label": "膝蓋骨", "type": "bone",
          "polygon": [[470,520],[530,520],[560,600],[500,660],[440,600]] },
        { "id": "knee_mcl", "label": "MCL内側", "type": "ligament",
          "polygon": [[...]], "labelAt": [380, 640] }
      ]
    }
  ]
}
```

- `polygon` は画像の px 座標（左上が 0,0）。**3点以上**、画像の中に収める。部位どうしは重なってよいが、押しやすいよう指で押せる大きさ（最短辺 60px 以上の目安）
- `labelAt` は省略可（省略時は多角形の中心に名札が出る）
- `type` は `ligament | tendon | meniscus | muscle | nerve | bursa | cartilage | bone`
- 同じ部位を複数の向きに置いてよい（例: 膝蓋骨は前面と内側・外側）。**既存の部位IDをすべて、どこかの向きで押せる**ようにする（検査で確認します）

## 4. 部位ID（カルテの保存値なので、この ID と label を使う。増減しない）

### 膝関節（knee）
`knee_qt` 大腿四頭筋腱(tendon) / `knee_patella` 膝蓋骨(bone) / `knee_pt` 膝蓋腱(tendon) / `knee_mcl` MCL内側(ligament) / `knee_lcl` LCL外側(ligament) / `knee_mm` 内側半月板(meniscus) / `knee_lm` 外側半月板(meniscus) / `knee_acl` ACL/PCL(ligament) / `knee_pes` 鵞足部(tendon) / `knee_itb` ITB付着部(tendon) / `knee_tt` 脛骨粗面(bone)

### 肩関節（shoulder）
`sh_bursa` 肩峰下滑液包(bursa) / `sh_ac` AC関節(ligament) / `sh_sup` 棘上筋腱(tendon) / `sh_sub` 肩甲下筋腱(tendon) / `sh_inf` 棘下筋・小円筋腱(tendon) / `sh_lhb` 上腕二頭筋長頭腱(tendon) / `sh_ant_lab` 関節唇前方(cartilage) / `sh_post_lab` 関節唇後方(cartilage) / `sh_slap` 上方関節唇SLAP(cartilage)

### 股関節（hip）
`hip_groin` 鼠径部・腸腰筋(muscle) / `hip_gt` 大転子(bone) / `hip_glut` 殿部・後方(muscle) / `hip_add` 内転筋群(muscle) / `hip_lab` 関節唇(cartilage) / `hip_piri` 梨状筋(muscle) / `hip_itb` 腸脛靭帯・外側(ligament) / `hip_sci` 坐骨神経走行(nerve)

### 足関節（ankle）
`ank_achilles` アキレス腱(tendon) / `ank_lat_mall` 外果(bone) / `ank_med_mall` 内果(bone) / `ank_atfl` ATFL前距腓靭帯(ligament) / `ank_cfl` CFL踵腓靭帯(ligament) / `ank_ptfl` PTFL後距腓靭帯(ligament) / `ank_deltoid` 三角靭帯内側(ligament) / `ank_peroneal` 腓骨筋腱(tendon) / `ank_sinus` 足根洞(cartilage) / `ank_plantar` 足底腱膜(tendon) / `ank_calcaneus` 踵骨付着部(bone)

### 腰部（lumbar）
`lum_para_l` 左傍脊柱筋(muscle) / `lum_para_r` 右傍脊柱筋(muscle) / `lum_l1`〜`lum_l5` L1〜L5高位(bone) / `lum_si_l` 左仙腸関節(ligament) / `lum_si_r` 右仙腸関節(ligament) / `lum_glut_l` 左殿部(muscle) / `lum_glut_r` 右殿部(muscle)

### 頚部（cervical）
`cerv_sub_l` 左後頭下筋(muscle) / `cerv_sub_r` 右後頭下筋(muscle) / `cerv_c12` C1-C2(bone) / `cerv_c34` C3-C4(bone) / `cerv_c56` C5-C6(bone) / `cerv_c7t1` C7-T1(bone) / `cerv_facet_l` 左後関節(bone) / `cerv_facet_r` 右後関節(bone) / `cerv_trap_l` 左僧帽筋上部(muscle) / `cerv_trap_r` 右僧帽筋上部(muscle) / `cerv_scale_l` 左斜角筋(muscle) / `cerv_scale_r` 右斜角筋(muscle)

### 肘関節（elbow）
`elb_lat_epi` 外側上顆（テニス肘）(tendon) / `elb_med_epi` 内側上顆（ゴルフ肘）(tendon) / `elb_olecranon` 肘頭(bone) / `elb_ucl` UCL内側側副靭帯(ligament) / `elb_lcl` LCL外側側副靭帯(ligament) / `elb_cubital` 肘部管・尺骨神経(nerve) / `elb_biceps_t` 上腕二頭筋腱(tendon) / `elb_triceps_t` 上腕三頭筋腱(tendon) / `elb_comm_ext` 総指伸筋起始部(muscle) / `elb_comm_flex` 総指屈筋起始部(muscle)

### 手関節・手指（wrist）
`wrist_rad_styloid` 橈骨茎状突起・de Quervain(tendon) / `wrist_uln_styloid` 尺骨茎状突起(bone) / `wrist_tfcc` TFCC尺側(cartilage) / `wrist_carpal_tunnel` 手根管掌側(nerve) / `wrist_scaphoid` 舟状骨(bone) / `wrist_lunate` 月状骨(bone) / `wrist_1cm` 第1CM関節（母指基底部）(cartilage) / `wrist_mcp_index` 示指MCP(cartilage) / `wrist_mcp_middle` 中指MCP(cartilage) / `wrist_mcp_ring` 環指MCP(cartilage) / `wrist_mcp_little` 小指MCP(cartilage)

（正本は `src/components/rehab-management/JointDetailMap.tsx` の `JOINT_ZONES`。食い違ったらそちらが正）

## 5. 作り方のヒント

- 画像生成を使う場合: 「medical textbook style line drawing of the right knee joint, anterior view, bones with faint ligaments, white background, no text, no labels, no arrows」のように、**向き・右側・文字なし**を必ず指定し、出力後に文字が混ざっていないか確認する。1000×1300 に切り抜き・リサイズして WebP（品質 80 程度）で保存
- 座標は、画像を 1000×1300 で開いて多角形の頂点を読み取る（SVG エディタで下絵に重ねて描き、頂点座標を書き出すのが早い）
- 納品前に `node tools/test-anatomy-zones.mjs` と `npm run lint` を通す

## 6. 受け入れの確認（Claude が行う）

1. `node tools/test-anatomy-zones.mjs` が「問題なし」
2. スマホ幅で、各向きの図が崩れず、部位が指で押せる
3. 左右反転したとき（左膝など）に図と部位が一致している
4. 文字・引き出し線が図に入っていない。既存の図の流用・実在図の模写がない
