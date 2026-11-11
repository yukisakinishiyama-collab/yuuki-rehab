// ──────────────────────────────────────────────
// 宣伝の短い動画（YouTubeショート・TikTok）の中身
//
// Google検索向けの投稿（gbp-seo-posts.ts の18テーマ）と同じテーマ・同じ写真・同じ言い方で、
// 縦型（1080×1920）・約16秒・5場面の動画にする。1本ごとに「下関市彦島＋症状・相談ごと」を1つに絞る。
//   1. つかみ（地域＋テーマの見出し）  2. こんなときに  3. 当院では（3つ）  4. 院の強み  5. ご予約・ご相談
// 文面は Google検索向けの投稿（院長が確認した決まった文）から短く抜いたもの。AIで毎回書かない。
// 治る・必ず・No.1 などの言葉は入れない（tools/test-promo-video.mjs で表現チェックを通す）。
// 絵は「基本はAI」（2026-11-11 院長の指示）:
//   ・前半（つかみ・こんなときに）は、AI（OpenAI の画像生成）で作ったイメージの絵。場面の説明（英語）は下の ai に書く。
//     院やスタッフ・施術そのものはAIに描かせない（本物でないものを院のように見せないため）。画面に「映像はイメージです」と出す
//   ・後半（当院では・院の強み・ご予約）は、院の本物の写真。ただし人物が特定されそうな写真は使わない。
//     使ってよいのは PROMO_SAFE_PHOTOS（足首とエコー・運動の器具・エコーの機械・外観）だけ
// 音は入れない。
// ──────────────────────────────────────────────
import { GBP_SEO_CHIPS, GBP_SEO_POSTS, GBP_SITE, gbpSeoFooter, type GbpPhoto, type GbpSeoPost } from './gbp-seo-posts'

export interface PromoVideoText {
  /** gbp-seo-posts.ts の id */
  id: string
  /** 1場面めの見出し（1〜2行。切れ目のよいところで分ける。1行は全角12.5文字まで） */
  headline: string[]
  /** 1場面めの小見出しを2行に分けるとき（1行に入らない長さのときだけ。1行は全角22文字まで） */
  subLines?: string[]
  /** 「こんなときに」の2行（1行は15文字まで） */
  worry: [string, string]
  /** 「当院では」の3行（1行は17文字まで） */
  points: [string, string, string]
  /** ハッシュタグ（#は付けない。テーマごとに2〜3個） */
  tags: string[]
  /**
   * AIに作らせる絵の場面（英語）。[1場面め（つかみ）, 2場面め（こんなときに）]。
   * null にした場面は、院の写真（PROMO_SAFE_PHOTOS）を使う（エコーの機械そのものを見せたいテーマなど）
   */
  ai: [string | null, string | null]
}

export const PROMO_VIDEO_TEXTS: PromoVideoText[] = [
  {
    id: 'ankle-sprain',
    headline: ['足首の捻挫のリハビリ'],
    worry: ['足首をひねったあと', '腫れが引いたら終わり？'],
    points: ['エコーで靭帯まわりを確認', 'バランス・筋力を段階的に', '競技への戻り方を一緒に考える'],
    tags: ['足首の捻挫', 'スポーツのケガ', 'リハビリ'],
    ai: ["A junior soccer player seen from the knees down on a grass pitch at dusk, wearing soccer socks and cleats, one foot resting on a ball. Low camera angle, warm evening light.",
      "A student athlete sitting on a wooden gym bench seen from the chest down, gently holding one ankle over a white sports sock with both hands. A pair of sports shoes placed beside the bench."],
  },
  {
    id: 'acl',
    headline: ['ACL（前十字靭帯）', '術後のリハビリ'],
    worry: ['ACLの手術の前とあと', 'リハビリはどう進める？'],
    points: ['主治医の方針を確かめて進める', '筋力の左右差・片脚ホップを確認', '着地・方向転換の動きもチェック'],
    tags: ['前十字靭帯', 'ACL', '術後リハビリ'],
    ai: ["A basketball player seen from the waist down, landing softly on an indoor wooden court, wearing shorts, a simple black knee sleeve and basketball shoes. Side view, soft gym light.",
      "A person in training wear sitting on a gym floor seen from behind, legs stretched forward, hands resting on one knee, a basketball beside them."],
  },
  {
    id: 'meniscus',
    headline: ['半月板のケガ', '術後のリハビリ'],
    worry: ['膝を曲げると痛い', '引っかかる感じがある'],
    points: ['まずは医療機関での検査を', '主治医の方針に合わせて運動療法', 'しゃがむ・踏み込む動きを段階的に'],
    tags: ['半月板', '膝の痛み', '術後リハビリ'],
    ai: ["A person in sportswear crouching slowly on a park path seen from behind and to the side, one hand resting on the knee. Morning light, trees in the background.",
      "Close view of a person sitting on a park bench from the waist down, both hands wrapped around one knee over training pants."],
  },
  {
    id: 'osgood',
    headline: ['成長期の膝の痛み', '（オスグッド）'],
    worry: ['ジャンプやダッシュのあと', '膝のお皿の下が痛い'],
    points: ['エコーで膝の下の状態を確認', '走る・跳ぶときの体の使い方を見る', '練習の量と内容を一緒に調整'],
    tags: ['オスグッド', '成長期', '膝の痛み'],
    ai: ["A junior volleyball player seen from the waist down jumping near the net in a school gym, wearing knee pads and indoor shoes. Motion slightly blurred, bright gym light.",
      "A child athlete in a sports uniform sitting on gym stairs seen from behind, one hand holding the front of the knee just below the kneecap, a sports bag next to them."],
  },
  {
    id: 'severs',
    headline: ['子どものかかとの痛み', '（シーバー病）'],
    worry: ['走るとかかとが痛い', '小学生・中学生に多い痛み'],
    points: ['かかととふくらはぎの状態を確認', '練習量・ストレッチ・靴を見直す', '保護者の方だけの相談もできます'],
    tags: ['シーバー病', 'かかとの痛み', '成長期'],
    ai: ["An elementary school child in a soccer uniform running on a dirt school ground, seen from behind and from the knees down, wearing sports shoes. Afternoon sun, long shadows.",
      "A child sitting on a low step at the edge of a school ground seen from the back, taking off one sports shoe, the heel in a white sock lifted slightly."],
  },
  {
    id: 'baseball',
    headline: ['野球ひじ・野球肩の相談'],
    worry: ['投げたあとにひじが痛い', '肩が重い'],
    points: ['エコーでひじ・肩の状態を確認', '股関節・体幹を含めた投球の動き', '投げる量・休む日を一緒に整理'],
    tags: ['野球肘', '野球肩', '少年野球'],
    ai: ["A youth baseball pitcher seen from behind on the mound of a neighborhood ball field, mid wind-up, wearing a plain white uniform without any numbers or letters. Late afternoon light.",
      "A youth baseball player seen from behind sitting in a dugout, holding the elbow of the throwing arm with the other hand, a glove resting on the bench."],
  },
  {
    id: 'strain',
    headline: ['肉離れのリハビリ'],
    worry: ['ダッシュで太ももの裏に痛み', '肉離れかもしれない'],
    points: ['エコーで筋肉の状態を確認', '伸ばす・縮める・走るを段階的に', '競技に合わせたテーピングも相談'],
    tags: ['肉離れ', 'スポーツのケガ', 'リハビリ'],
    ai: ["A sprinter seen from the waist down exploding out of the starting blocks on a red running track, wearing spikes. Low side angle, bright daylight.",
      "A runner standing on the infield grass of a track seen from behind, one hand pressing the back of the thigh, weight shifted to the other leg."],
  },
  {
    id: 'shin',
    headline: ['すねの内側の痛み', '（シンスプリント）'],
    worry: ['走るとすねの内側が痛い', '陸上部・ランナーに多い痛み'],
    points: ['痛む場所の状態を確認', '足のつき方・走る量をチェック', '練習量の調整を一緒に考える'],
    tags: ['シンスプリント', 'ランナー', '陸上部'],
    ai: ["A group of long-distance runners seen from the knees down running on a riverside path in the early morning, wearing running shoes. Soft light, slight motion blur.",
      "A runner sitting on a riverside bench seen from the chest down, both hands holding the inner side of one shin above a running sock."],
  },
  {
    id: 'groin',
    headline: ['サッカーの', '脚の付け根の痛み'],
    worry: ['キックや切り返しで', '脚の付け根が痛い'],
    points: ['エコーで痛む場所の状態を確認', '股関節の動き・体幹の筋力を見る', '運動療法と練習の調整を段階的に'],
    tags: ['グロインペイン', 'サッカー', '股関節'],
    ai: ["A soccer player seen from the waist down striking a ball on a grass pitch, wearing plain shorts and cleats. Side view, evening light.",
      "A soccer player standing near the touchline seen from behind, one hand resting on the front of the hip, the other holding a ball against the side."],
  },
  {
    id: 'jiko',
    headline: ['交通事故のケガ', 'むち打ちの相談'],
    worry: ['交通事故のあと', '首・肩・腰が痛い'],
    points: ['問診・動き・エコーで状態を確認', '整形外科との併用も相談できます', '手続きの流れもご案内します'],
    tags: ['交通事故', 'むち打ち', '整骨院'],
    ai: ["A quiet Japanese residential street with a compact car stopped at a crosswalk in soft morning light. No people visible, no damage, calm atmosphere.",
      "A person in everyday clothes seen from behind sitting on a sofa at home, one hand gently touching the back of the neck. Soft window light."],
  },
  {
    id: 'echo',
    headline: ['エコーで状態を', '確かめてから施術します'],
    worry: ['どこがどうなっているのか', '分からないままは不安'],
    points: ['エコーで筋肉・腱・靭帯を観察', '画面を一緒に見ながら説明', 'そのうえで施術と運動療法へ'],
    tags: ['エコー', '超音波エコー', '整骨院'],
    ai: [null,
      "A person in sportswear sitting on a bench seen from the chest down, looking down at their own knee with both hands resting around it, as if wondering what is going on inside."],
  },
  {
    id: 'evening',
    headline: ['部活のあとでも', '間に合います'],
    worry: ['部活や仕事のあとでも', '通える整骨院を探している'],
    points: ['平日は20時まで受付', '駐車場あり（3〜4台）', 'ネット予約は24時間・LINE相談も'],
    tags: ['彦島', '整骨院', '部活'],
    ai: ["Students in school sports wear walking home from club practice at dusk, seen from behind, carrying sports bags over their shoulders along a quiet street with warm street lights.",
      "A person in work clothes seen from behind, glancing at a plain analog wristwatch at dusk on a quiet street. The watch face is turned away from the camera."],
  },
  {
    id: 'gikkuri',
    headline: ['ぎっくり腰の相談', '（急な腰の痛み）'],
    worry: ['急に腰が痛くて動けない', 'ぎっくり腰かもしれない'],
    points: ['急な痛みは予約なしで受付', '無理のない姿勢・動き方を確認', 'くり返さないための運動もお伝え'],
    tags: ['ぎっくり腰', '腰の痛み', '整骨院'],
    ai: ["A person in everyday clothes bending forward to lift a cardboard box from the floor of a tidy home entrance, seen from behind.",
      "A person standing in a living room seen from behind, both hands supporting the lower back, a cardboard box left on the floor in front of them."],
  },
  {
    id: 'achilles',
    headline: ['アキレス腱のケガ', '術後のリハビリ'],
    worry: ['アキレス腱が痛い', '手術・固定のあとのリハビリ'],
    points: ['エコーでアキレス腱の状態を確認', '主治医の方針に合わせて進める', '歩く・走る・跳ぶを段階的に'],
    tags: ['アキレス腱', '術後リハビリ', 'スポーツのケガ'],
    ai: ["A recreational runner seen from the knees down jogging on a park path, the camera low behind the heels, running shoes and short socks. Morning light.",
      "A person sitting on a park bench seen from the knees down, one hand gently holding the back of the ankle just above the heel over a short sock."],
  },
  {
    id: 'staff',
    headline: ['柔道整復師3名で', '担当します'],
    worry: ['どんな人が担当するの？', '女性スタッフはいますか？'],
    points: ['3名とも柔道整復師（国家資格）', '女性スタッフも在籍しています', '評価から運動療法まで同じ方針で'],
    tags: ['柔道整復師', '女性スタッフ', '整骨院'],
    ai: [null,
      "A person seen from behind sitting on a sofa at home, holding a smartphone as if looking something up. The phone screen is turned away from the camera and not visible."],
  },
  {
    id: 'hip',
    headline: ['股関節の痛み', '術後のリハビリ'],
    worry: ['走る・しゃがむと', '股関節が痛い'],
    points: ['股関節の動き・お尻の筋力を確認', '主治医の方針に合わせて運動療法', '立つ・歩く・しゃがむを段階的に'],
    tags: ['股関節', '股関節の痛み', '術後リハビリ'],
    ai: ["A person in sportswear doing a slow lunge on a yoga mat in a bright room, seen from the side and from the shoulders down.",
      "A person standing up from a chair seen from behind, one hand resting on the side of the hip."],
  },
  {
    id: 'parents',
    headline: ['部活のケガ', '保護者の方だけの相談もOK'],
    subLines: ['来院前に、LINEで', '写真や動画を送って相談できます'],
    worry: ['子どものケガ、休ませる？', '病院と整骨院、どちら？'],
    points: ['保護者の方だけの相談もOK', '来院前にLINEで写真・動画を相談', '練習をどこまでできるか一緒に'],
    tags: ['部活', '保護者', 'スポーツのケガ'],
    ai: ["A parent and a child in a sports uniform walking side by side away from the camera along a school fence at dusk, the child carrying a sports bag.",
      "A parent seen from behind sitting at a dining table holding a smartphone, the screen turned away from the camera; in the soft-focus background a child sits on a sofa with one leg up on a cushion."],
  },
  {
    id: 'plantar',
    headline: ['かかと・足の裏の痛み'],
    worry: ['朝の一歩目に', 'かかと・足の裏が痛い'],
    points: ['エコーでかかとまわりを確認', '足のつき方・靴・走る量をチェック', 'セルフケアと練習量を一緒に調整'],
    tags: ['足底腱膜炎', 'かかとの痛み', 'ランナー'],
    ai: ["A person stepping out of bed onto a wooden floor in morning light, seen from the knees down, wearing plain socks.",
      "A person sitting on the edge of a bed seen from the knees down, one hand holding the sole of the foot over a plain sock."],
  },
]

/** どの動画にも付けるハッシュタグ */
export const PROMO_BASE_TAGS = ['下関', '彦島', '整骨院', 'ゆうき整骨院']

/** 1行の長さの上限（全角で数えた長さ。画面からはみ出さない長さ） */
export const PROMO_LIMITS = { worry: 15, point: 17, headline: 12.5, subtitle: 22 }

/** 画面での長さ（全角＝1、半角の英数字・記号＝0.6） */
export function promoTextWidth(text: string): number {
  let w = 0
  for (const ch of text) w += /[\x20-\x7e]/.test(ch) ? 0.6 : 1
  return Math.round(w * 10) / 10
}

export interface PromoVideo extends PromoVideoText {
  post: GbpSeoPost
}

export const PROMO_VIDEOS: PromoVideo[] = PROMO_VIDEO_TEXTS.flatMap((t) => {
  const post = GBP_SEO_POSTS.find((p) => p.id === t.id)
  return post ? [{ ...t, post }] : []
})

export function getPromoVideo(id: string): PromoVideo | undefined {
  return PROMO_VIDEOS.find((v) => v.id === id)
}

// ── 場面 ─────────────────────────────────────

/**
 * 動画に使ってよい院の写真（人物が特定されないもの）：足首とエコー・エコーの機械・運動の器具・外観。
 * スタッフ・患者さん・選手・観客が写っている写真は使わない（2026-11-11 院長の指示。体の一部だけの写真も、念のため外している）。
 * Google投稿と同じ置き場（GBP_SAFE_PHOTOS）から、縦の動画に使える大きさのものを選んでいる（横長の外観 clinic は小さいので使わない）
 */
export const PROMO_SAFE_PHOTOS: GbpPhoto[] = ['echo-hero', 'echo-machine', 'exercise-tools', 'exterior']

/** AIに作らせる絵（1場面め＝a、2場面め＝b）。作れないときは photo（院の写真）で代える */
export interface PromoAiVisual {
  slot: 'a' | 'b'
  /** 場面の説明（英語）。共通の決まり（PROMO_AI_RULES）は作るときに足す */
  scene: string
}

interface SceneBase {
  /** 院の写真（AIの絵を使う場面では、作れないときの代わり） */
  photo: GbpPhoto
  position?: string
  /** あれば、この場面はAIで作った絵を使う（画面に「映像はイメージです」と出す） */
  ai?: PromoAiVisual
}

export type PromoScene = SceneBase &
  (
    | { kind: 'hook'; area: string; titleLines: string[]; subtitleLines: string[] }
    | { kind: 'worry'; label: string; lines: string[] }
    | { kind: 'points'; label: string; lines: string[] }
    | { kind: 'strengths'; label: string; chips: string[] }
    | { kind: 'cta'; name: string; address: string; search: string; lines: string[] }
  )

/**
 * どのAIの絵にも足す決まり（英語の方が指示が通りやすい。投稿のAI画像＝post-image-server.ts と同じ考え方）。
 * 効果や結果を思わせる絵・医療行為・顔・文字・実在の人や院を入れない
 */
export const PROMO_AI_RULES = [
  'Photorealistic photograph, square composition, natural light, calm and clean mood, gentle colors, everyday setting in Japan.',
  // 「上は見出しの面・下はボタンが重なる」と伝えると、AIが上下に黒い帯を描いてしまう（2026-11-11 本番で確認）。
  // 枠・帯なしで画面いっぱいに描かせ、主役を真ん中に置かせるだけにする（上下は動画の側でなじませる）
  'The photograph must fill the whole square frame from edge to edge: no borders, no frames, no letterbox, no black or dark bars, no panels, no vignette. Keep the main subject in the central area of the frame.',
  'Absolutely no text, letters, numbers, captions, signs, logos, brand marks, team names or watermarks anywhere in the image.',
  "No face may be visible: show people only from behind, from the neck down, or as hands, arms, legs or feet. No children's faces. Natural, anatomically correct hands and feet.",
  'Do not show: a clinic, a therapist, treatment or massage, medical procedures or devices, taping, bandages, casts, crutches, injections, blood, bruises, swelling, wounds, X-ray or MRI images,',
  'before-and-after comparisons, exaggerated pain, or anything that suggests a guaranteed result or a specific real person, team, school or place.',
].join(' ')

/** OpenAI に渡す指示（場面の説明＋共通の決まり） */
export function promoAiPrompt(ai: PromoAiVisual): string {
  return `${ai.scene.trim()}\n\n${PROMO_AI_RULES}`
}

const FOOT_THEMES = new Set(['ankle-sprain', 'achilles', 'plantar', 'severs'])

/**
 * 場面ごとの絵。
 * 1・2 … AIの絵（ai が null のテーマは院の写真）。3 … 当院では＝足首のテーマは足首とエコー、エコーに触れるテーマはエコーの機械、ほかは運動の器具。
 * 4 … 院の強み＝3で使わなかった方（器具かエコーの機械）。5 … 外観
 */
function sceneVisuals(video: PromoVideo): SceneBase[] {
  const id = video.id
  const mentionsEcho = video.points.some((p) => p.includes('エコー'))
  let third: GbpPhoto = FOOT_THEMES.has(id) ? 'echo-hero' : mentionsEcho ? 'echo-machine' : 'exercise-tools'
  let fourth: GbpPhoto = third === 'exercise-tools' ? 'echo-machine' : 'exercise-tools'
  // 1場面めを院の写真にするテーマ（AIに院や機械を描かせない）
  let first: GbpPhoto = fourth
  if (id === 'echo') {
    first = 'echo-machine'
    third = 'echo-hero'
    fourth = 'exercise-tools'
  } else if (id === 'staff') {
    first = 'exterior'
  } else if (id === 'evening') {
    third = 'exterior'
    fourth = 'echo-machine'
  }
  const pos = (photo: GbpPhoto, where: 'top' | 'low' = 'top'): string | undefined =>
    photo === 'exterior' ? (where === 'top' ? '50% 22%' : '50% 45%') : photo === 'exercise-tools' ? '50% 42%' : undefined
  const [a, b] = video.ai
  return [
    { photo: first, position: pos(first), ai: a ? { slot: 'a', scene: a } : undefined },
    { photo: third, position: pos(third), ai: b ? { slot: 'b', scene: b } : undefined },
    { photo: third, position: pos(third) },
    { photo: fourth, position: pos(fourth) },
    { photo: 'exterior', position: pos('exterior', 'low') },
  ]
}

export const PROMO_CLINIC = {
  name: 'ゆうき整骨院',
  area: '下関市・彦島',
  address: '下関市彦島江の浦町',
  search: 'ゆうき整骨院 下関',
  phone: '083-265-4545',
}

/** 5つの場面（動画の描き方は promo-video-render.tsx） */
export function promoScenes(video: PromoVideo): PromoScene[] {
  const v = sceneVisuals(video)
  return [
    { ...v[0], kind: 'hook', area: PROMO_CLINIC.area, titleLines: [...video.headline], subtitleLines: video.subLines ? [...video.subLines] : [video.post.subtitle] },
    { ...v[1], kind: 'worry', label: 'こんなときに', lines: [...video.worry] },
    { ...v[2], kind: 'points', label: 'ゆうき整骨院では', lines: [...video.points] },
    { ...v[3], kind: 'strengths', label: '下関市彦島の整骨院', chips: GBP_SEO_CHIPS },
    {
      ...v[4],
      kind: 'cta',
      name: PROMO_CLINIC.name,
      address: PROMO_CLINIC.address,
      search: PROMO_CLINIC.search,
      lines: ['ネット予約は24時間', 'LINEでのご相談もできます', '急なケガは予約なしで受付'],
    },
  ]
}

/** AIの絵を使う動画か（説明に「AIで作成したイメージ」と書く・YouTube に申告する） */
export function promoUsesAi(video: PromoVideo): boolean {
  return video.ai.some(Boolean)
}

/** 説明に足す断り書き（AIの絵を使う動画だけ） */
export const PROMO_AI_NOTE = '※映像の一部は、AIで作成したイメージです。'

// ── 説明文（YouTube・TikTok） ────────────────────────

const hash = (tags: string[]) => tags.map((t) => `#${t.replace(/[\s#＃]+/g, '')}`).join(' ')

export function promoTags(video: PromoVideo): string[] {
  return [...new Set([...PROMO_BASE_TAGS, ...video.tags])]
}

/** YouTube の題名（100文字まで。先頭にテーマ、うしろに地域と院名） */
export function youtubeTitle(video: PromoVideo): string {
  const t = `${video.post.title}｜下関市彦島 ゆうき整骨院`
  return t.length > 95 ? `${t.slice(0, 94)}…` : t
}

/** YouTube の説明（Google検索向けの投稿と同じ本文＋院の情報＋予約の入口＋ハッシュタグ） */
export function youtubeDescription(video: PromoVideo, reserveUrl: string): string {
  return [
    video.post.body.trim(),
    '',
    gbpSeoFooter(video.post.sitePath),
    `ネット予約（24時間）：${reserveUrl}`,
    `電話：${PROMO_CLINIC.phone}`,
    ...(promoUsesAi(video) ? [PROMO_AI_NOTE] : []),
    '',
    hash([...promoTags(video), 'Shorts']),
  ].join('\n')
}

/** 2つの短い文をつなぐ（「？」「！」で終わる文のあとに「、」「。」を重ねない） */
function joinLines(a: string, b: string): string {
  const closed = (t: string) => /[？！。?!]$/.test(t)
  const joined = closed(a) ? `${a}${b}` : `${a}、${b}`
  return closed(joined) ? joined : `${joined}。`
}

/** TikTok の説明（短く。リンクは押せないので「検索」で案内する） */
export function tiktokCaption(video: PromoVideo): string {
  return [
    `【下関市彦島｜${video.post.title}】`,
    joinLines(video.worry[0], video.worry[1]),
    `${video.points[0]}。${video.points[1]}。`,
    `ご予約・ご相談は「${PROMO_CLINIC.search}」で検索してください。`,
    ...(promoUsesAi(video) ? [PROMO_AI_NOTE] : []),
    '',
    hash(promoTags(video)),
  ].join('\n')
}

export { GBP_SITE }
