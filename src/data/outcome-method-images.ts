/**
 * アウトカムの「測り方の図」— ChatGPT（OpenAI の画像生成）に描かせる場面の説明
 *
 * 2026-11-27 院長「検査方法をChat Gptを使用して画像としても載せてください」。
 * - 図は院長が「作る」を押したときだけ作る（1枚ごとに OpenAI の料金）。院長が見て「この図を使う」にしたものだけ、カルテに出す
 * - 図は「イメージ」。測り方は caption と指標の説明（outcome-metrics.ts の hint）・院の手順を優先する
 * - 決まり（METHOD_IMAGE_RULES）：顔の無い人形のような人物・文字や数字を描かない・院の中や施術の場面にしない
 * - 指標の key はカルテの保存値（outcome-metrics.ts）。ここに足すと、管理の画面に並ぶ
 * - scene は英語（画像生成への指示）。姿勢・角度・道具は、指標の説明と参考の論文の測り方に合わせて書く
 */
import type { OutcomeMetricKey } from '@/types/contracts'

export interface MethodImageScene {
  /** 図の下に出す、短い測り方（日本語。指標の説明と同じ内容） */
  caption: string
  /** 画像生成への場面の説明（英語） */
  scene: string
}

/** すべての図に付ける決まり（院の外へ出す広告ではないが、人物が特定されない・文字の無い図にする） */
export const METHOD_IMAGE_RULES = [
  'Style: clean, simple instructional medical illustration, flat vector style with soft colors, on a plain white background.',
  'People: faceless, gender-neutral, mannequin-like figures (no facial features, no hairstyle details) wearing plain athletic clothing. If an examiner is needed, show only a faceless figure or just the hands and forearms.',
  'Accuracy: anatomically plausible body position and joint angles exactly as described. Choose a side or three-quarter view so the measured joint, angle or distance is clearly visible. Show only the equipment described.',
  'Never include: any text, letters, numbers, labels, scales with numbers, logos, watermarks or brand names; a clinic or hospital interior; treatment scenes; blood, injuries or medical images.',
  'Thin plain arrows without text may show the direction of movement.',
].join('\n')

export const METHOD_IMAGE_SCENES: Partial<Record<OutcomeMetricKey, MethodImageScene>> = {
  // ── 痛みを見る動き ──
  decline_squat_nrs: {
    caption: '前が下がった台（約25°）の上で、片脚でゆっくりしゃがむ。膝のお皿の下の痛みを 0〜10 で聞く',
    scene:
      'Single-leg decline squat: a person stands on one leg on a wooden decline board sloped about 25 degrees with the toes pointing down the slope. The trunk stays upright and the person slowly bends the standing knee to about 60 degrees while the other leg is held slightly forward off the board. Side view.',
  },
  hop_nrs: {
    caption: '痛い側の片脚で、その場で軽く数回とぶ。そのときの痛みを 0〜10 で聞く',
    scene:
      'Single-leg hopping in place: a person stands on one leg on a plain floor and performs small, light hops in place, landing softly on the ball of the same foot; the other knee is bent with the foot off the floor, arms relaxed for balance. Show the person in mid-air just above the floor. Side view.',
  },
  tender_length: {
    caption: 'すねの内側のふちを、上から下へ指で押していき、押して痛む範囲の長さをメジャーで測る',
    scene:
      "Palpation of the inner border of the shin: a person sits on the edge of a plain bench with the lower leg relaxed. An examiner's hands (only hands and forearms visible) press with two fingertips along the inner (medial) border of the shin bone, moving from top to bottom, and a soft measuring tape is laid along the inner shin to measure the length of the tender area. Close-up of the lower leg.",
  },
  // ── 腫れ・可動域 ──
  swelling_f8: {
    caption: '足首を直角にして、メジャーを8の字に回す（外くるぶしの前 → 足の甲 → 土踏まず → 足の甲 → 内くるぶしの下 → アキレス腱 → 外くるぶしの下）',
    scene:
      'Figure-of-eight ankle circumference measurement: a person sits with the lower leg extended and supported, ankle at a right angle (neutral). A flexible measuring tape is wrapped around the foot and ankle in a figure-of-eight pattern: starting in front of the outer ankle bone, across the top of the foot, under the arch, back across the top of the foot, around behind the ankle below the inner ankle bone, across the Achilles tendon, and below the outer ankle bone back to the start. Close-up three-quarter view of the foot and ankle.',
  },
  rom_knee_flex: {
    caption: '仰向けで、かかとをお尻のほうへすべらせて膝を曲げる。角度計の中心を膝の外側に当て、太ももとすねに合わせる',
    scene:
      'Knee flexion range of motion: a person lies on their back on a plain mat and bends one knee as far as possible by sliding the heel toward the buttock. A plain goniometer without markings is centered on the outer side of the knee with one arm along the thigh and the other along the lower leg. Side view.',
  },
  rom_knee_ext: {
    caption: '仰向けで、かかとの下に丸めたタオルを入れて膝を伸ばす。角度計を膝の外側に当てる',
    scene:
      'Knee extension range of motion: a person lies on their back on a plain mat with the leg straight and a rolled towel under the heel so the knee can fully straighten. A plain goniometer without markings is centered on the outer side of the knee, aligned with the thigh and the lower leg. Side view.',
  },
  gird: {
    caption: '仰向けで肩を 90° 横に上げ、肘を 90° 曲げる。肩甲骨（肩の前）を押さえて、前腕を前・後ろへ倒した角度を測る',
    scene:
      "Shoulder internal and external rotation range of motion: a person lies on their back on a plain bench with the upper arm out to the side at 90 degrees and the elbow bent at 90 degrees, forearm pointing up. An examiner's hand (only hand and forearm visible) presses gently on the front of the shoulder to stabilize the shoulder blade while the forearm rotates forward toward the floor. A plain goniometer without markings is held at the elbow aligned with the forearm. Three-quarter view from the foot of the bench.",
  },
  wblt: {
    caption: '壁に向かって片足を前に出し、かかとを床につけたまま膝を壁につける。届くいちばん遠いつま先と壁の距離を測る',
    scene:
      'Weight-bearing lunge test (knee-to-wall): a person faces a plain wall in a lunge position. The front foot points straight at the wall with a measuring tape on the floor running from the big toe to the wall. The front heel stays flat on the floor while the front knee bends forward to touch the wall directly in line with the second toe. The back leg is behind for balance and the hands rest lightly on the wall. Side view.',
  },
  aslr: {
    caption: '仰向けで、膝を伸ばしたまま自分の力で片脚を上げる。すねに当てた角度計で、上がった角度を測る',
    scene:
      'Active straight leg raise: a person lies on their back on a plain bench with one leg flat on the bench and raises the other leg straight up by their own effort, knee fully straight and ankle relaxed. A small inclinometer device without markings is placed on the front of the shin of the raised leg. Side view.',
  },
  hbd: {
    caption: 'うつ伏せで膝を曲げ、かかとをお尻に近づける。かかととお尻のあいだの距離を定規で測る',
    scene:
      "Heel-to-buttock distance: a person lies face down on a plain bench. One knee is bent so the heel moves toward the buttock, with an examiner's hand (only hand and forearm visible) gently guiding the ankle. A plain ruler without markings measures the gap between the heel and the buttock. Side view.",
  },
  // ── 筋力（HHD・回数） ──
  lsi_quad: {
    caption: '台に腰かけて膝を 90° に曲げる。足首の少し上の前側に HHD を当て、膝を伸ばす方向に押してもらう。左右とも同じ姿勢で',
    scene:
      'Isometric knee extension strength with a handheld dynamometer: a person sits on the edge of a plain bench with the knee bent at 90 degrees and the hands holding the edge of the bench. A small handheld dynamometer (a palm-sized device with a padded head, no display text) is placed on the front of the lower shin just above the ankle and held still by a strap fixed to the bench leg, while the person pushes the leg forward. Side view.',
  },
  lsi_ham: {
    caption: 'うつ伏せで膝を曲げる。かかとの少し上の後ろ側に HHD を当て、膝を曲げる方向に押してもらう。左右とも同じ姿勢・同じ角度で',
    scene:
      "Isometric knee flexion strength with a handheld dynamometer: a person lies face down on a plain bench with one knee bent at about 90 degrees. An examiner's hand (only hand and forearm visible) holds a small handheld dynamometer (palm-sized device with a padded head, no display text) against the back of the lower leg just above the heel, while the person pulls the heel toward the buttock against it. Side view.",
  },
  lsi_hip_add: {
    caption: '仰向けで脚を伸ばす。内くるぶしの少し上に HHD を当て、脚を内側へ寄せる力を測る。左右とも同じ位置で',
    scene:
      "Hip adduction strength with a handheld dynamometer: a person lies on their back on a plain bench with both legs straight. An examiner's hand (only hand and forearm visible) holds a small handheld dynamometer (palm-sized device with a padded head, no display text) against the inner side of one leg just above the inner ankle bone, while the person squeezes that leg inward toward the midline against it. View from above at the foot end of the bench.",
  },
  lsi_hip_abd: {
    caption: '仰向けで脚を伸ばす。外くるぶしの少し上に HHD を当て、脚を外側へ開く力を測る。左右とも同じ位置で',
    scene:
      "Hip abduction strength with a handheld dynamometer: a person lies on their back on a plain bench with both legs straight. An examiner's hand (only hand and forearm visible) holds a small handheld dynamometer (palm-sized device with a padded head, no display text) against the outer side of one leg just above the outer ankle bone, while the person pushes that leg outward away from the midline against it. View from above at the foot end of the bench.",
  },
  add_squeeze: {
    caption: '仰向けで膝を立て、両膝のあいだに道具（血圧計のカフ・HHD など）をはさんで、押しつぶす。毎回同じ道具・同じ膝の角度で',
    scene:
      'Adductor squeeze test: a person lies on their back on a plain mat with the hips bent about 45 degrees, knees bent and feet flat on the mat. A small soft cuff or palm-sized dynamometer (no display text) is placed between the knees and the person squeezes the knees together. Arms rest at the sides. Three-quarter view.',
  },
  slhb: {
    caption: '仰向けで、片足のかかとを高い台（約60cm）にのせ、膝を少し曲げる。腕を胸の前で組み、お尻の上げ下げを続けられなくなるまでの回数',
    scene:
      'Single-leg hamstring bridge: a person lies on their back on a plain mat with one heel resting on top of a box about 60 cm high, that knee slightly bent (about 20 degrees). The other leg is held straight up toward the ceiling and the arms are crossed over the chest. The person pushes down through the heel to lift the hips off the mat. Show the hips lifted. Side view.',
  },
  lsi_calf: {
    caption: '片脚で立ち、指先を壁に軽く当ててバランスをとる。膝を伸ばしたまま、かかとをできるだけ高く上げ下げし、続けられなくなるまでの回数',
    scene:
      'Single-leg heel raise test: a person stands on one leg on a plain floor facing a wall, fingertips lightly touching the wall for balance only. The standing knee stays straight and the person rises up onto the ball of the foot, lifting the heel as high as possible; the other foot is lifted off the floor behind. Side view.',
  },
  // ── ホップ・バランス ──
  lsi_hop: {
    caption: '片脚で線の後ろに立ち、前へ1回できるだけ遠くへとんで、同じ脚で着地して止まる。線からかかとまでの距離',
    scene:
      'Single-leg hop for distance: a person stands on one leg behind a start line taped on a plain floor, with a measuring tape running forward along the floor. Show the person in mid-flight hopping forward on the same leg, arms swinging forward, with a faint ghosted figure at the landing spot showing a stable one-leg landing. Side view.',
  },
  lsi_hop_triple: {
    caption: '片脚で前へ3回続けてとび、同じ脚で着地して止まる。スタートの線からかかとまでの距離',
    scene:
      'Single-leg triple hop for distance: a person performs three consecutive forward hops on the same leg along a measuring tape on a plain floor, starting behind a taped line. Show three faint ghosted positions of the same figure along the path to convey the three hops, ending in a stable one-leg landing. Side view.',
  },
  lsi_hop_cross: {
    caption: '床の帯（幅約15cm）をまたいで、片脚で前へジグザグに3回とび、同じ脚で着地して止まる。スタートの線からの距離',
    scene:
      'Crossover hop for distance: on a plain floor there is a straight taped strip about 15 cm wide running forward. A person hops forward three times on the same leg, crossing over the strip from side to side with each hop in a zigzag path, ending in a stable one-leg landing. Show faint ghosted positions along the zigzag path. View from above and slightly behind.',
  },
  lsi_hop_timed: {
    caption: '床の 6m を、片脚でできるだけ速くとんで進む時間。スタートとゴールに線を引く',
    scene:
      'Six-meter timed hop: a person hops quickly forward on one leg along a straight 6-meter course marked by start and finish lines taped on a plain floor. Show the person mid-course in a dynamic hop with faint ghosted positions behind, and a simple stopwatch icon without numbers at the side. Side view.',
  },
  side_hop: {
    caption: '床に約30cm 離した2本の線を引き、片脚で左右にとぶ。決めた回数をとぶ時間（毎回同じ幅・同じ回数で）',
    scene:
      'Side hop test: on a plain floor there are two parallel taped lines about 30 cm apart. A person hops sideways on one leg back and forth over both lines, landing outside each line. Show the person mid-hop with a faint ghosted figure on the other side to show the side-to-side movement. Front view.',
  },
  ybal_ant: {
    caption: '片脚で台の中央に立ち、手は腰に。もう一方の足で目印を前へできるだけ遠くへ押し出し、届いた距離（3回のうち一番遠い値）',
    scene:
      'Y-balance test, anterior reach: a person stands on one leg on a small central platform of a Y-shaped balance kit with three plain pipes on the floor (one pointing forward, two pointing diagonally backward). Hands are on the hips. The standing knee bends while the other foot pushes a small sliding block forward along the front pipe as far as possible without touching down. Side view.',
  },
}

export const METHOD_IMAGE_KEYS = Object.keys(METHOD_IMAGE_SCENES) as OutcomeMetricKey[]

/** 画像生成に渡す指示（場面の説明＋決まり） */
export function methodImagePrompt(key: OutcomeMetricKey): string | null {
  const s = METHOD_IMAGE_SCENES[key]
  return s ? `${s.scene}\n\n${METHOD_IMAGE_RULES}` : null
}
