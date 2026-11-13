// ──────────────────────────────────────────────
// 会員プランのご案内（カルテの「契約・同意書」から開く、患者様にお見せする説明）の料金と計算（純粋な関数）
//
// 金額は、契約書・料金案内のひな形（src/data/contract-templates.ts）と同じにする。
// どちらかを変えたら、もう一方も同じように直す（食いちがうと tools/test-member-guide.mjs が知らせる）。
//
// 2026-11-13（院長の指示）：来院ごとの1部位施術料を 1,000円 → 1,500円 に。
// 健康保険の施術を併用する日は 1,000円＋保険の窓口料金。
// ──────────────────────────────────────────────
import type { MemberPlan } from '@/types/contracts'

/** 会員プランの月額（税込） */
export const MEMBER_MONTHLY: Record<MemberPlan, number> = {
  一般会員: 23000,
  学生会員: 19000,
  '兄弟・親子プラン': 30000,
}

/** 来院ごとの1部位施術料（会員・税込）。来院した方ごと・施術した部位ごとにかかる */
export const MEMBER_PART_FEE = 1500
/** 健康保険の施術を併用する日の施術料。このほかに保険の窓口料金（一部負担金）がかかる */
export const MEMBER_PART_FEE_WITH_INSURANCE = 1000

/** 都度払い（非会員）の料金。料金案内 2-(2) と同じ */
export const PAYG_FEES = { rehab: 2850, part: 1500 } as const

/** 会員プランに含まれうる物理療法と、都度払いでの料金（料金案内 2-(2) と同じ） */
export const PHYSIO_OPTIONS = [
  { id: 'none', name: '使わない', fee: 0 },
  { id: 'elesas', name: '微弱電流エレサス', fee: 1600 },
  { id: 'combination', name: 'コンビネーション療法', fee: 2600 },
  { id: '5d', name: '5D', fee: 2700 },
  { id: 'eswt', name: '体外衝撃波', fee: 3500 },
] as const
export type PhysioId = (typeof PHYSIO_OPTIONS)[number]['id']

/** 特別手技療法プラン（料金案内 2-(3) と同じ） */
export const SPECIAL_PLANS = [
  { name: 'プレミアム手技療法（60分）', nonMember: 11000, member: 6600, student: 5500 },
  { name: 'プレミアム手技療法・標準（90分）', nonMember: 16500, member: 8800, student: 7700 },
  { name: '院長集中コンディショニング（120分）', nonMember: 22000, member: 12100, student: 11000 },
] as const

/** 23000 → 「23,000円」 */
export function yen(n: number): string {
  return `${Math.round(n).toLocaleString('ja-JP')}円`
}

/** 契約書・院の記録に書く、1部位施術料の言い方（金額はここの定数から作る） */
export const MEMBER_PART_FEE_TEXT = `${yen(MEMBER_PART_FEE)}（健康保険の施術を併用する日は${yen(MEMBER_PART_FEE_WITH_INSURANCE)}＋保険の窓口料金）`

export interface GuideInput {
  plan: MemberPlan
  /** 1か月の来院回数（兄弟・親子プランは2名の合計） */
  visits: number
  /** 1回あたりの施術の部位数 */
  parts: number
  /** 1回あたりに使う物理療法の、都度払いでの料金（使わなければ 0） */
  physioFee: number
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** 画面の入力を、計算できる範囲にそろえる（回数 1〜31、部位 1〜3） */
export function normalizeGuideInput(input: GuideInput): GuideInput {
  return {
    plan: input.plan,
    visits: clampInt(input.visits, 1, 31),
    parts: clampInt(input.parts, 1, 3),
    physioFee: Math.max(0, Math.round(input.physioFee) || 0),
  }
}

/** 都度払いの、1回あたりの金額（リハビリ＋施術×部位＋物理療法） */
export function paygPerVisit(parts: number, physioFee: number): number {
  return PAYG_FEES.rehab + PAYG_FEES.part * parts + physioFee
}

/** 都度払いで同じ内容を受けたときの、1か月の金額 */
export function paygMonthly(input: GuideInput): number {
  const i = normalizeGuideInput(input)
  return paygPerVisit(i.parts, i.physioFee) * i.visits
}

/** 会員プランの、1か月の金額（月額＋1部位施術料×部位×回数。保険を併用しない場合） */
export function memberMonthly(input: GuideInput): number {
  const i = normalizeGuideInput(input)
  return MEMBER_MONTHLY[i.plan] + MEMBER_PART_FEE * i.parts * i.visits
}

export interface GuideComparison {
  payg: number
  member: number
  /** 都度払い − 会員プラン（＋なら会員プランのほうが少ない） */
  diff: number
  cheaper: 'member' | 'payg' | 'same'
}

export function compareGuide(input: GuideInput): GuideComparison {
  const payg = paygMonthly(input)
  const member = memberMonthly(input)
  const diff = payg - member
  return { payg, member, diff, cheaper: diff > 0 ? 'member' : diff < 0 ? 'payg' : 'same' }
}

/**
 * 同じ内容なら、月に何回以上の来院で会員プランのほうが少なくなるか。
 * 31回までに少なくならなければ null（1回あたりの差が無い・逆のとき）
 */
export function breakEvenVisits(plan: MemberPlan, parts: number, physioFee: number): number | null {
  for (let visits = 1; visits <= 31; visits += 1) {
    if (compareGuide({ plan, visits, parts, physioFee }).cheaper === 'member') return visits
  }
  return null
}
