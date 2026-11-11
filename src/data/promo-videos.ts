// ──────────────────────────────────────────────
// 宣伝の短い動画（YouTubeショート・TikTok）の中身
//
// Google検索向けの投稿（gbp-seo-posts.ts の18テーマ）と同じテーマ・同じ写真・同じ言い方で、
// 縦型（1080×1920）・約16秒・5場面の動画にする。1本ごとに「下関市彦島＋症状・相談ごと」を1つに絞る。
//   1. つかみ（地域＋テーマの見出し）  2. こんなときに  3. 当院では（3つ）  4. 院の強み  5. ご予約・ご相談
// 文面は Google検索向けの投稿（院長が確認した決まった文）から短く抜いたもの。AIで毎回書かない。
// 治る・必ず・No.1 などの言葉は入れない（tools/test-promo-video.mjs で表現チェックを通す）。
// 写真は院の本物の写真（assets/gbp-photos/。患者さんの顔は写っていないもの）。音は入れない。
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
}

export const PROMO_VIDEO_TEXTS: PromoVideoText[] = [
  {
    id: 'ankle-sprain',
    headline: ['足首の捻挫のリハビリ'],
    worry: ['足首をひねったあと', '腫れが引いたら終わり？'],
    points: ['エコーで靭帯まわりを確認', 'バランス・筋力を段階的に', '競技への戻り方を一緒に考える'],
    tags: ['足首の捻挫', 'スポーツのケガ', 'リハビリ'],
  },
  {
    id: 'acl',
    headline: ['ACL（前十字靭帯）', '術後のリハビリ'],
    worry: ['ACLの手術の前とあと', 'リハビリはどう進める？'],
    points: ['主治医の方針を確かめて進める', '筋力の左右差・片脚ホップを確認', '着地・方向転換の動きもチェック'],
    tags: ['前十字靭帯', 'ACL', '術後リハビリ'],
  },
  {
    id: 'meniscus',
    headline: ['半月板のケガ', '術後のリハビリ'],
    worry: ['膝を曲げると痛い', '引っかかる感じがある'],
    points: ['まずは医療機関での検査を', '主治医の方針に合わせて運動療法', 'しゃがむ・踏み込む動きを段階的に'],
    tags: ['半月板', '膝の痛み', '術後リハビリ'],
  },
  {
    id: 'osgood',
    headline: ['成長期の膝の痛み', '（オスグッド）'],
    worry: ['ジャンプやダッシュのあと', '膝のお皿の下が痛い'],
    points: ['エコーで膝の下の状態を確認', '走る・跳ぶときの体の使い方を見る', '練習の量と内容を一緒に調整'],
    tags: ['オスグッド', '成長期', '膝の痛み'],
  },
  {
    id: 'severs',
    headline: ['子どものかかとの痛み', '（シーバー病）'],
    worry: ['走るとかかとが痛い', '小学生・中学生に多い痛み'],
    points: ['かかととふくらはぎの状態を確認', '練習量・ストレッチ・靴を見直す', '保護者の方だけの相談もできます'],
    tags: ['シーバー病', 'かかとの痛み', '成長期'],
  },
  {
    id: 'baseball',
    headline: ['野球ひじ・野球肩の相談'],
    worry: ['投げたあとにひじが痛い', '肩が重い'],
    points: ['エコーでひじ・肩の状態を確認', '股関節・体幹を含めた投球の動き', '投げる量・休む日を一緒に整理'],
    tags: ['野球肘', '野球肩', '少年野球'],
  },
  {
    id: 'strain',
    headline: ['肉離れのリハビリ'],
    worry: ['ダッシュで太ももの裏に痛み', '肉離れかもしれない'],
    points: ['エコーで筋肉の状態を確認', '伸ばす・縮める・走るを段階的に', '競技に合わせたテーピングも相談'],
    tags: ['肉離れ', 'スポーツのケガ', 'リハビリ'],
  },
  {
    id: 'shin',
    headline: ['すねの内側の痛み', '（シンスプリント）'],
    worry: ['走るとすねの内側が痛い', '陸上部・ランナーに多い痛み'],
    points: ['痛む場所の状態を確認', '足のつき方・走る量をチェック', '練習量の調整を一緒に考える'],
    tags: ['シンスプリント', 'ランナー', '陸上部'],
  },
  {
    id: 'groin',
    headline: ['サッカーの', '脚の付け根の痛み'],
    worry: ['キックや切り返しで', '脚の付け根が痛い'],
    points: ['エコーで痛む場所の状態を確認', '股関節の動き・体幹の筋力を見る', '運動療法と練習の調整を段階的に'],
    tags: ['グロインペイン', 'サッカー', '股関節'],
  },
  {
    id: 'jiko',
    headline: ['交通事故のケガ', 'むち打ちの相談'],
    worry: ['交通事故のあと', '首・肩・腰が痛い'],
    points: ['問診・動き・エコーで状態を確認', '整形外科との併用も相談できます', '手続きの流れもご案内します'],
    tags: ['交通事故', 'むち打ち', '整骨院'],
  },
  {
    id: 'echo',
    headline: ['エコーで状態を', '確かめてから施術します'],
    worry: ['どこがどうなっているのか', '分からないままは不安'],
    points: ['エコーで筋肉・腱・靭帯を観察', '画面を一緒に見ながら説明', 'そのうえで施術と運動療法へ'],
    tags: ['エコー', '超音波エコー', '整骨院'],
  },
  {
    id: 'evening',
    headline: ['部活のあとでも', '間に合います'],
    worry: ['部活や仕事のあとでも', '通える整骨院を探している'],
    points: ['平日は20時まで受付', '駐車場あり（3〜4台）', 'ネット予約は24時間・LINE相談も'],
    tags: ['彦島', '整骨院', '部活'],
  },
  {
    id: 'gikkuri',
    headline: ['ぎっくり腰の相談', '（急な腰の痛み）'],
    worry: ['急に腰が痛くて動けない', 'ぎっくり腰かもしれない'],
    points: ['急な痛みは予約なしで受付', '無理のない姿勢・動き方を確認', 'くり返さないための運動もお伝え'],
    tags: ['ぎっくり腰', '腰の痛み', '整骨院'],
  },
  {
    id: 'achilles',
    headline: ['アキレス腱のケガ', '術後のリハビリ'],
    worry: ['アキレス腱が痛い', '手術・固定のあとのリハビリ'],
    points: ['エコーでアキレス腱の状態を確認', '主治医の方針に合わせて進める', '歩く・走る・跳ぶを段階的に'],
    tags: ['アキレス腱', '術後リハビリ', 'スポーツのケガ'],
  },
  {
    id: 'staff',
    headline: ['柔道整復師3名で', '担当します'],
    worry: ['どんな人が担当するの？', '女性スタッフはいますか？'],
    points: ['3名とも柔道整復師（国家資格）', '女性スタッフも在籍しています', '評価から運動療法まで同じ方針で'],
    tags: ['柔道整復師', '女性スタッフ', '整骨院'],
  },
  {
    id: 'hip',
    headline: ['股関節の痛み', '術後のリハビリ'],
    worry: ['走る・しゃがむと', '股関節が痛い'],
    points: ['股関節の動き・お尻の筋力を確認', '主治医の方針に合わせて運動療法', '立つ・歩く・しゃがむを段階的に'],
    tags: ['股関節', '股関節の痛み', '術後リハビリ'],
  },
  {
    id: 'parents',
    headline: ['部活のケガ', '保護者の方だけの相談もOK'],
    subLines: ['来院前に、LINEで', '写真や動画を送って相談できます'],
    worry: ['子どものケガ、休ませる？', '病院と整骨院、どちら？'],
    points: ['保護者の方だけの相談もOK', '来院前にLINEで写真・動画を相談', '練習をどこまでできるか一緒に'],
    tags: ['部活', '保護者', 'スポーツのケガ'],
  },
  {
    id: 'plantar',
    headline: ['かかと・足の裏の痛み'],
    worry: ['朝の一歩目に', 'かかと・足の裏が痛い'],
    points: ['エコーでかかとまわりを確認', '足のつき方・靴・走る量をチェック', 'セルフケアと練習量を一緒に調整'],
    tags: ['足底腱膜炎', 'かかとの痛み', 'ランナー'],
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

export type PromoScene =
  | { kind: 'hook'; photo: GbpPhoto; position?: string; area: string; titleLines: string[]; subtitleLines: string[] }
  | { kind: 'worry'; photo: GbpPhoto; position?: string; label: string; lines: string[] }
  | { kind: 'points'; photo: GbpPhoto; position?: string; label: string; lines: string[] }
  | { kind: 'strengths'; photo: GbpPhoto; position?: string; label: string; chips: string[] }
  | { kind: 'cta'; photo: GbpPhoto; position?: string; name: string; address: string; search: string; lines: string[] }

/** 場面ごとの写真：1・2はテーマの写真、3はエコーか運動、4は院内、5は外観（同じ写真が続かないように） */
function scenePhotos(post: GbpSeoPost): GbpPhoto[] {
  const third: GbpPhoto = post.photo === 'echo-scene' ? 'exercise-tools' : post.photo === 'echo-hero' || post.photo === 'echo-machine' ? 'exercise-tools' : 'echo-scene'
  const fourth: GbpPhoto = post.photo === 'room-staff' ? 'clinic' : 'room-staff'
  const fifth: GbpPhoto = post.photo === 'exterior' ? 'clinic' : 'exterior'
  return [post.photo, post.photo, third, fourth, fifth]
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
  const photos = scenePhotos(video.post)
  const pos = video.post.photoPosition
  return [
    { kind: 'hook', photo: photos[0], position: pos, area: PROMO_CLINIC.area, titleLines: [...video.headline], subtitleLines: video.subLines ? [...video.subLines] : [video.post.subtitle] },
    { kind: 'worry', photo: photos[1], position: pos, label: 'こんなときに', lines: [...video.worry] },
    { kind: 'points', photo: photos[2], label: 'ゆうき整骨院では', lines: [...video.points] },
    { kind: 'strengths', photo: photos[3], position: '50% 30%', label: '下関市彦島の整骨院', chips: GBP_SEO_CHIPS },
    {
      kind: 'cta',
      photo: photos[4],
      position: '50% 40%',
      name: PROMO_CLINIC.name,
      address: PROMO_CLINIC.address,
      search: PROMO_CLINIC.search,
      lines: ['ネット予約は24時間', 'LINEでのご相談もできます', '急なケガは予約なしで受付'],
    },
  ]
}

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
    '',
    hash(promoTags(video)),
  ].join('\n')
}

export { GBP_SITE }
