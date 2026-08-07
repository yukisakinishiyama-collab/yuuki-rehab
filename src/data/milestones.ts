// ──────────────────────────────────────────────
// 疾患別マイルストーン定義
//
// プロトコルの疾患（PRESET_DIAGNOSES のキー）ごとに、回復の節目を定義する。
// 従来は全疾患共通の下肢スポーツ向けセットしかなく、肩・腰・人工関節の患者に
// 「ジャンプ解禁」等が表示されて実態と合わなかった。
//
// hint はスタッフ向けの達成目安（患者ビューには出さない前提の短文）。
// 文言は医療広告ガイドラインに配慮し、治癒の断定はしない。
// ──────────────────────────────────────────────
import type { Joint } from '@/types/protocol'

export interface MilestoneDef {
  label: string
  icon: string
  /** スタッフ向けの達成目安 */
  hint?: string
}

// ── 疾患別セット（キーは PRESET_DIAGNOSES / PROTOCOL_TEMPLATES と共通）──

const ACL_RECONSTRUCTION: MilestoneDef[] = [
  { label: '膝の完全伸展', icon: '📏', hint: '健側と同じまで伸びる・伸展ラグなし' },
  { label: '松葉杖卒業・歩行自立', icon: '🚶', hint: '跛行なく歩ける' },
  { label: '屈曲120°', icon: '🦵', hint: '階段・椅子動作に必要な曲がり' },
  { label: '階段昇降', icon: '🪜', hint: '1段ずつでなく交互に昇降できる' },
  { label: 'ジョグ開始', icon: '🏃', hint: '目安：術後3ヶ月以降・医師の許可' },
  { label: 'ランニング', icon: '⚡', hint: 'スピード走・直線ダッシュ' },
  { label: 'ジャンプ・切り返し解禁', icon: '🦘', hint: '目安：術後6ヶ月以降・筋力LSI90%' },
  { label: '競技復帰', icon: '🏆', hint: '医師の許可＋復帰基準テスト通過' },
]

const MENISCUS_REPAIR: MilestoneDef[] = [
  { label: '部分荷重開始', icon: '🦶', hint: '医師の指示に従う' },
  { label: '全荷重・歩行自立', icon: '🚶', hint: '松葉杖なしで跛行なく' },
  { label: '屈曲120°', icon: '🦵', hint: '縫合部位への負荷に注意' },
  { label: 'しゃがみ込み動作', icon: '🧎', hint: '深屈曲は医師の許可後' },
  { label: 'ジョグ開始', icon: '🏃', hint: '目安：術後3ヶ月以降' },
  { label: 'ランニング', icon: '⚡' },
  { label: 'ジャンプ解禁', icon: '🦘', hint: '縫合部の治癒確認後・医師の許可' },
  { label: '競技復帰', icon: '🏆', hint: '目安：術後6ヶ月以降・医師の許可' },
]

const MENISCUS_RESECTION: MilestoneDef[] = [
  { label: '腫脹の消退', icon: '🧊', hint: '膝蓋跳動なし' },
  { label: '歩行自立', icon: '🚶', hint: '跛行なく歩ける' },
  { label: '可動域の回復', icon: '🦵', hint: '健側と同等の曲げ伸ばし' },
  { label: '階段昇降', icon: '🪜' },
  { label: 'ジョグ開始', icon: '🏃', hint: '目安：術後4〜6週' },
  { label: 'ランニング・ダッシュ', icon: '⚡' },
  { label: '競技復帰', icon: '🏆', hint: '目安：術後2〜3ヶ月' },
]

const TKA: MilestoneDef[] = [
  { label: '膝の伸展0°', icon: '📏', hint: '伸展制限を残さないことが最優先' },
  { label: '屈曲90°', icon: '🦵', hint: '椅子座りに必要' },
  { label: '歩行器→杖歩行', icon: '🦯' },
  { label: '杖なし歩行', icon: '🚶', hint: '屋内自立' },
  { label: '屈曲120°', icon: '💪', hint: '和式動作・自転車に必要' },
  { label: '階段昇降', icon: '🪜', hint: '手すり使用から交互昇降へ' },
  { label: '屋外30分歩行', icon: '🌳', hint: '買い物・散歩の自立' },
  { label: '日常生活の完全復帰', icon: '🏆', hint: '趣味・旅行など本人の目標動作' },
]

const PFP: MilestoneDef[] = [
  { label: '安静時・夜間痛の消失', icon: '🌙' },
  { label: '平地30分歩行が痛みなく', icon: '🚶' },
  { label: '階段昇降の痛み軽減', icon: '🪜', hint: '下り階段が指標になりやすい' },
  { label: '片脚スクワット獲得', icon: '💪', hint: '膝が内に入らないフォームで' },
  { label: 'しゃがみ込み動作', icon: '🧎' },
  { label: 'ジョグ再開', icon: '🏃', hint: '翌日に痛みが残らない範囲から' },
  { label: 'ランニング', icon: '⚡' },
  { label: 'スポーツ完全復帰', icon: '🏆' },
]

const ROTATOR_CUFF_REPAIR: MilestoneDef[] = [
  { label: '装具（外転枕）卒業', icon: '🎽', hint: '医師の指示期間を厳守' },
  { label: '他動挙上120°', icon: '🙋', hint: '振り子運動〜他動運動期' },
  { label: '自動挙上90°', icon: '💪', hint: '自分の力で肩の高さまで' },
  { label: '自動挙上140°', icon: '🙌' },
  { label: '結髪・結帯動作', icon: '💇', hint: '頭を洗う・背中に手を回す' },
  { label: '軽い荷物の持ち上げ', icon: '🛍️', hint: '目安：術後4ヶ月以降' },
  { label: '仕事・スポーツ復帰', icon: '🏆', hint: '重労働・投球は医師の許可後' },
]

const SHOULDER_INSTABILITY: MilestoneDef[] = [
  { label: '固定期間終了', icon: '🎽' },
  { label: '日常動作で不安感なし', icon: '🙂', hint: '着替え・洗顔など' },
  { label: '可動域の回復', icon: '🙌', hint: '外転・外旋は段階的に' },
  { label: 'チューブ訓練クリア', icon: '💪', hint: '腱板・肩甲骨周囲の強化' },
  { label: '腕立て伏せ', icon: '🏋️', hint: '閉鎖運動連鎖での安定性' },
  { label: '投球・接触プレー段階復帰', icon: '🤾', hint: '恐怖感の確認をしながら' },
  { label: '競技復帰', icon: '🏆' },
]

const FROZEN_SHOULDER: MilestoneDef[] = [
  { label: '夜間痛の消失', icon: '🌙', hint: '眠れるようになることが第一目標' },
  { label: '安静時痛の消失', icon: '🙂' },
  { label: '挙上120°', icon: '🙋', hint: '洗濯物干しの高さ' },
  { label: '結帯動作', icon: '🧥', hint: '背中に手を回す・エプロンの紐' },
  { label: '挙上150°', icon: '🙌' },
  { label: '結髪動作', icon: '💇', hint: '頭を洗う・髪を結ぶ' },
  { label: '日常生活で支障なし', icon: '🏆' },
]

const ANKLE_SPRAIN: MilestoneDef[] = [
  { label: '腫脹・熱感の消退', icon: '🧊' },
  { label: '全荷重歩行', icon: '🚶', hint: '跛行なく歩ける' },
  { label: '片脚立ち30秒', icon: '🦩', hint: '閉眼でもぐらつかないとなお良い' },
  { label: '片脚カーフレイズ', icon: '🦵', hint: '20回を目安に' },
  { label: 'ジョグ開始', icon: '🏃' },
  { label: 'ダッシュ・切り返し', icon: '⚡', hint: 'サイドステップ・八の字走' },
  { label: '競技復帰', icon: '🏆', hint: '再発予防にテーピング・装具を検討' },
]

const ACHILLES_CONSERVATIVE: MilestoneDef[] = [
  { label: '装具下での歩行', icon: '🥾' },
  { label: 'ヒールウェッジ漸減', icon: '📉', hint: '医師の指示スケジュールに従う' },
  { label: '装具卒業', icon: '👟' },
  { label: '両脚カーフレイズ', icon: '🦵' },
  { label: '片脚カーフレイズ', icon: '💪', hint: '再断裂リスクが下がる大きな節目' },
  { label: 'ジョグ開始', icon: '🏃', hint: '目安：受傷後4〜6ヶ月' },
  { label: 'ジャンプ解禁', icon: '🦘' },
  { label: '競技復帰', icon: '🏆', hint: '目安：受傷後6ヶ月以降' },
]

const ACHILLES_SURGICAL: MilestoneDef[] = [
  { label: '部分荷重開始', icon: '🦶' },
  { label: '全荷重', icon: '🚶' },
  { label: '装具卒業', icon: '👟' },
  { label: '両脚カーフレイズ', icon: '🦵' },
  { label: '片脚カーフレイズ', icon: '💪', hint: '再断裂リスクが下がる大きな節目' },
  { label: 'ジョグ開始', icon: '🏃', hint: '目安：術後3〜4ヶ月' },
  { label: 'ジャンプ解禁', icon: '🦘' },
  { label: '競技復帰', icon: '🏆', hint: '目安：術後6ヶ月前後' },
]

const FAI_ARTHROSCOPY: MilestoneDef[] = [
  { label: '松葉杖卒業', icon: '🦯' },
  { label: '歩行自立', icon: '🚶', hint: '跛行なく歩ける' },
  { label: '股関節可動域の回復', icon: '🦵', hint: '深屈曲・内旋は無理をしない' },
  { label: '階段昇降', icon: '🪜' },
  { label: '殿筋群の筋力回復', icon: '💪', hint: '片脚ブリッジ・サイドプランク' },
  { label: 'ジョグ開始', icon: '🏃', hint: '目安：術後3ヶ月' },
  { label: '切り返し動作', icon: '⚡' },
  { label: '競技復帰', icon: '🏆', hint: '目安：術後4〜6ヶ月' },
]

const THA: MilestoneDef[] = [
  { label: 'ベッドから起立', icon: '🛏️' },
  { label: '歩行器歩行', icon: '🚶' },
  { label: '杖歩行', icon: '🦯' },
  { label: '杖なし歩行', icon: '👟', hint: '跛行（デュシェンヌ徴候）に注意' },
  { label: '靴下の着脱', icon: '🧦', hint: '脱臼肢位を避けた方法で' },
  { label: '階段昇降', icon: '🪜' },
  { label: '屋外30分歩行', icon: '🌳' },
  { label: '日常生活の完全復帰', icon: '🏆', hint: '趣味・旅行など本人の目標動作' },
]

const LUMBAR_DISC_CONSERVATIVE: MilestoneDef[] = [
  { label: '下肢痛・しびれの軽減', icon: '⚡', hint: '中枢化（痛みが腰へ集まる）は良い兆候' },
  { label: '夜間・安静時痛の消失', icon: '🌙' },
  { label: '座位30分', icon: '🪑', hint: 'デスクワーク・車の運転' },
  { label: '歩行30分', icon: '🚶' },
  { label: '前かがみ動作', icon: '🧎', hint: '洗顔・靴下・床の物を拾う' },
  { label: '体幹エクササイズ定着', icon: '💪', hint: '自宅で週3回以上続けられている' },
  { label: '軽作業・デスクワーク復帰', icon: '💼' },
  { label: '仕事・スポーツ完全復帰', icon: '🏆' },
]

const FRACTURE_CONSERVATIVE: MilestoneDef[] = [
  { label: '固定除去（ギプスオフ）', icon: '🩹', hint: '医師の骨癒合確認後' },
  { label: '腫脹の消退', icon: '🧊' },
  { label: '可動域50%回復', icon: '📐', hint: '固定除去後の初期目標' },
  { label: '可動域の回復', icon: '🦵', hint: '健側と比較して' },
  { label: '筋力の回復', icon: '💪', hint: '健側比80%を目安に' },
  { label: '日常生活で支障なし', icon: '🙂' },
  { label: 'スポーツ・重労働復帰', icon: '🏆', hint: '医師の許可後' },
]

const DISLOCATION: MilestoneDef[] = [
  { label: '固定期間終了', icon: '🩹', hint: '医師の指示期間を厳守' },
  { label: '日常動作で不安感なし', icon: '🙂' },
  { label: '可動域の回復', icon: '🙌', hint: '脱臼肢位方向は最後に・慎重に' },
  { label: '筋力の回復', icon: '💪', hint: '関節周囲の安定化筋を重点的に' },
  { label: '再脱臼予防訓練の定着', icon: '🛡️', hint: '危険肢位の学習と回避' },
  { label: 'スポーツ復帰', icon: '🏆', hint: '接触プレーは段階的に' },
]

const SPRAIN_LIGAMENT: MilestoneDef[] = [
  { label: '腫脹・痛みの軽減', icon: '🧊' },
  { label: '固定・テーピング卒業', icon: '🩹' },
  { label: '可動域の回復', icon: '📐' },
  { label: '筋力の回復', icon: '💪', hint: '健側比80〜90%' },
  { label: '実戦練習への復帰', icon: '🏃', hint: '制限付き練習から' },
  { label: '競技復帰', icon: '🏆', hint: '再発予防のセルフケア定着まで' },
]

// ── 関節別フォールバック（プリセット外の診断名のとき）──

const GENERIC_LOWER_LIMB: MilestoneDef[] = [
  { label: '痛み・腫脹の軽減', icon: '🧊' },
  { label: '歩行自立', icon: '🚶' },
  { label: '階段昇降', icon: '🪜' },
  { label: '可動域・筋力の回復', icon: '💪' },
  { label: 'ジョグ開始', icon: '🏃' },
  { label: 'ランニング', icon: '⚡' },
  { label: 'スポーツ復帰', icon: '🏆' },
]

const GENERIC_SHOULDER: MilestoneDef[] = [
  { label: '夜間・安静時痛の軽減', icon: '🌙' },
  { label: '日常動作で支障減少', icon: '🙂', hint: '着替え・洗顔・つり革' },
  { label: '挙上の回復', icon: '🙋' },
  { label: '結髪・結帯動作', icon: '💇' },
  { label: '筋力の回復', icon: '💪' },
  { label: '仕事・スポーツ復帰', icon: '🏆' },
]

const GENERIC_ELBOW: MilestoneDef[] = [
  { label: '安静時痛の消失', icon: '🙂' },
  { label: '曲げ伸ばしの回復', icon: '📐' },
  { label: '日常生活で支障なし', icon: '🍴', hint: '食事・ドアノブ・荷物' },
  { label: '握力・筋力の回復', icon: '💪' },
  { label: '投球・作業の段階復帰', icon: '🤾' },
  { label: '完全復帰', icon: '🏆' },
]

const GENERIC_HAND: MilestoneDef[] = [
  { label: '固定卒業', icon: '🩹' },
  { label: '指の曲げ伸ばし回復', icon: '✊' },
  { label: '握る動作の回復', icon: '🤝', hint: 'ペットボトルの開閉など' },
  { label: '握力の回復', icon: '💪', hint: '健側比80%を目安に' },
  { label: '日常生活で支障なし', icon: '🙂' },
  { label: 'スポーツ・作業復帰', icon: '🏆' },
]

const GENERIC_SPINE: MilestoneDef[] = [
  { label: '安静時・夜間痛の軽減', icon: '🌙' },
  { label: '座位・立位の持続', icon: '🪑', hint: '30分を目安に' },
  { label: '歩行30分', icon: '🚶' },
  { label: '前かがみ・振り向き動作', icon: '🧎' },
  { label: '体幹エクササイズ定着', icon: '💪' },
  { label: '仕事・スポーツ復帰', icon: '🏆' },
]

/** 旧・全疾患共通セット（既存データの判定と 'other' フォールバックに使用） */
export const LEGACY_DEFAULT_SET: MilestoneDef[] = [
  { label: '初回荷重', icon: '🦶' },
  { label: 'フルウェイトベアリング', icon: '🏋️' },
  { label: '平地歩行自立', icon: '🚶' },
  { label: '階段昇降', icon: '🪜' },
  { label: 'ジョグ開始', icon: '🏃' },
  { label: 'ランニング', icon: '⚡' },
  { label: 'ジャンプ解禁', icon: '🦘' },
  { label: '競技復帰', icon: '🏆' },
]

export const MILESTONE_SETS: Record<string, MilestoneDef[]> = {
  acl_reconstruction: ACL_RECONSTRUCTION,
  meniscus_repair: MENISCUS_REPAIR,
  meniscus_resection: MENISCUS_RESECTION,
  tka: TKA,
  pfp: PFP,
  rotator_cuff_repair: ROTATOR_CUFF_REPAIR,
  shoulder_instability: SHOULDER_INSTABILITY,
  frozen_shoulder: FROZEN_SHOULDER,
  ankle_sprain: ANKLE_SPRAIN,
  achilles_conservative: ACHILLES_CONSERVATIVE,
  achilles_surgical: ACHILLES_SURGICAL,
  fai_arthroscopy: FAI_ARTHROSCOPY,
  tha: THA,
  lumbar_disc_conservative: LUMBAR_DISC_CONSERVATIVE,
  fracture_conservative: FRACTURE_CONSERVATIVE,
  dislocation: DISLOCATION,
  sprain_ligament: SPRAIN_LIGAMENT,
}

const JOINT_FALLBACK: Record<Joint, MilestoneDef[]> = {
  knee: GENERIC_LOWER_LIMB,
  ankle: GENERIC_LOWER_LIMB,
  hip: GENERIC_LOWER_LIMB,
  shoulder: GENERIC_SHOULDER,
  elbow: GENERIC_ELBOW,
  hand: GENERIC_HAND,
  spine: GENERIC_SPINE,
  other: LEGACY_DEFAULT_SET,
}

/**
 * 診断名（自由記述）と関節から、最適なマイルストーンセットを選ぶ。
 * 1. 診断名のキーワードで疾患セットを特定
 * 2. 見つからなければ関節別の汎用セット
 * 3. それも無ければ従来の共通セット
 */
export function resolveMilestoneSet(
  diagnosis?: string,
  joint?: Joint | string,
): { key: string; defs: MilestoneDef[] } {
  const d = (diagnosis ?? '').toLowerCase()
  const pick = (key: string) => ({ key, defs: MILESTONE_SETS[key] })
  const fallbackShoulder = { key: 'joint_shoulder', defs: JOINT_FALLBACK.shoulder }
  const fallbackSpine = { key: 'joint_spine', defs: JOINT_FALLBACK.spine }

  if (d) {
    // 特異度の高いキーワードから順に判定する（「捻挫」より「ACL」を先に）
    if (d.includes('acl') || d.includes('前十字')) return pick('acl_reconstruction')
    if (d.includes('半月板')) {
      return d.includes('縫合') ? pick('meniscus_repair') : pick('meniscus_resection')
    }
    if (d.includes('tka') || d.includes('人工膝')) return pick('tka')
    if (d.includes('tha') || d.includes('人工股')) return pick('tha')
    if (d.includes('pfp') || d.includes('膝蓋大腿') || d.includes('膝前面痛')) return pick('pfp')

    // 脊椎の頻出診断（ぎっくり腰・むちうち・腰椎捻挫など）。
    // 後続の「捻挫→競技復帰セット」に食われないよう、汎用の捻挫判定より先に置く
    if (d.includes('ぎっくり') || d.includes('むちうち') || d.includes('むち打ち')) {
      return fallbackSpine
    }
    if (
      d.includes('捻挫') &&
      (joint === 'spine' || d.includes('腰椎') || d.includes('頚椎') || d.includes('頸椎'))
    ) {
      return fallbackSpine
    }
    if (d.includes('ヘルニア') || d.includes('椎間板') || d.includes('坐骨神経')) {
      return pick('lumbar_disc_conservative')
    }

    // 股関節鏡・FAI（股関節唇損傷を含む）。肩の関節唇判定より先に置く
    if (
      d.includes('fai') || d.includes('股関節鏡') ||
      (d.includes('股') && d.includes('関節唇')) ||
      (d.includes('インピンジ') && joint === 'hip')
    ) {
      return pick('fai_arthroscopy')
    }

    // 手術を受けた後だと肯定的に分かる語。
    // 単なる「術」だと「手術せず」「手術適応なし」等の否定表現にも一致してしまう
    const POSITIVE_SURGERY = /術後|手術後|再建|縫合|修復/

    // 腱板：修復術後のみ術後セット。保存療法（腱板損傷・腱板炎）は肩の汎用セット
    if (d.includes('腱板') || d.includes('カフ')) {
      return POSITIVE_SURGERY.test(d) ? pick('rotator_cuff_repair') : fallbackShoulder
    }
    // 肩の関節唇・脱臼・不安定症（「肩」を含む場合のみ。部位不明の関節唇は汎用へ）
    if (d.includes('肩') && (d.includes('関節唇') || d.includes('脱臼') || d.includes('不安定'))) {
      return pick('shoulder_instability')
    }
    // 凍結肩。「周囲炎」はアキレス腱周囲炎等と紛れるため肩の文脈に限る
    if (
      d.includes('凍結') || d.includes('五十肩') || d.includes('四十肩') ||
      (d.includes('周囲炎') && (d.includes('肩') || joint === 'shoulder'))
    ) {
      return pick('frozen_shoulder')
    }

    // アキレス腱：断裂のみ専用セット（術後かどうかは肯定的な術後語で判定）。
    // 腱炎・腱周囲炎などは該当させず、後続の判定〜関節フォールバックへ流す
    if (d.includes('アキレス') && d.includes('断裂')) {
      return POSITIVE_SURGERY.test(d) ? pick('achilles_surgical') : pick('achilles_conservative')
    }
    if (d.includes('捻挫') && (d.includes('足') || joint === 'ankle')) return pick('ankle_sprain')
    if (d.includes('骨折')) return pick('fracture_conservative')
    if (d.includes('脱臼')) return pick('dislocation')
    if (
      d.includes('捻挫') || d.includes('靱帯') || d.includes('靭帯') ||
      d.includes('突き指') || d.includes('mcl') || d.includes('lcl')
    ) {
      return pick('sprain_ligament')
    }
  }

  const j = joint as Joint
  if (j && JOINT_FALLBACK[j]) {
    return { key: `joint_${j}`, defs: JOINT_FALLBACK[j] }
  }
  return { key: 'legacy_default', defs: LEGACY_DEFAULT_SET }
}
