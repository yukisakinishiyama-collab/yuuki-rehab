// ──────────────────────────────────────────────
// 進行基準×実測値の照合エンジン（NextGen v2.1）
//
// プロトコルの進行基準（自由記述。例:「Quadriceps LSI ≥80%」「屈曲120°以上」
// 「疼痛2以下」）を保守的に解析し、カルテ側の実測値（ROM・筋力・NRS）と照合する。
//
// 【設計原則】
// - 達成の「正」はあくまで施術者の手動チェック（Criterion.met）。
//   実測照合は【参考情報と提案】であり、勝手に達成扱いにしない
//   （提案→施術者がワンタップで承認、の流れ。指示書§8「AI suggestion / Clinician approved」）
// - 解析は保守的に行い、確信が持てない文言は「解析対象外」とする
//   （誤った自動判定を表示するくらいなら、何も判定しない方が安全）
// - 照合先の記録が特定できない場合（左右の記録が混在・複数の筋の記録がある等）も
//   「曖昧」として判定しない。どの記録と照合したかは必ずラベルで開示する
// - 純関数のみ。ストアへの依存を持たない（テスト可能性のため）
// ──────────────────────────────────────────────

import type { Criterion } from '@/types/protocol'

export type ComparisonOp = 'gte' | 'lte'

export type CriterionKind = 'rom' | 'lsi' | 'pain' | 'mmt'

/** 照合先の記録を特定できなかった理由 */
export type Ambiguity = 'sides' | 'muscles'

export interface ParsedCriterion {
  kind: CriterionKind
  /** rom のときの動き（屈曲・伸展など日本語キーワード） */
  movement?: string
  op: ComparisonOp
  threshold: number
  unit: string
}

/** 筋力系（LSI/MMT）の照合候補。muscle は muscleGroup（無ければ movement） */
export interface StrengthCandidate {
  value: number
  date: string
  muscle: string
  side: string
}

/** 実測データの束（呼び出し側がカルテから集めて渡す） */
export interface MeasuredEvidence {
  /** 対象部位の角度ROM記録すべて（activeRom優先の値。集約せず全件） */
  roms: Array<{ movement: string; value: number; date: string; side: string }>
  /** 健側比（LSI, %）の記録候補すべて */
  lsiCandidates: StrengthCandidate[]
  /** MMT（数値化済み）の記録候補すべて */
  mmtCandidates: StrengthCandidate[]
  /** 最新の痛みNRS（評価記録の明示入力） */
  painNrs: { value: number; date: string; label: string } | null
}

export interface CriterionEvaluation {
  index: number
  label: string
  target?: string
  /** 施術者の手動チェック（これが正） */
  met: boolean
  /** 解析結果（null = この文言は自動照合の対象外） */
  parsed: ParsedCriterion | null
  /** 照合に使った実測値。label にどの記録かを必ず明示する */
  measured?: { value: number; date: string; label: string }
  /** 実測が基準を満たすか（parsed かつ measured があるときのみ） */
  autoJudgment?: 'pass' | 'fail'
  /** 実測の経過日数 */
  staleDays?: number
  /** 照合先の記録を特定できなかった理由（判定は行わない） */
  ambiguity?: Ambiguity
}

export interface ReassessmentSuggestion {
  criterionLabel: string
  reason: 'no_data' | 'stale'
  detail: string
}

// ── 文言の解析 ──────────────────────────────────

// カルテのROM記録は movement を英語（'Flexion' 等。ROMInputForm のテンプレート）で
// 保存するため、基準文言の日本語キーワードと両対応で照合する。
// exclude は誤マッチ防止（例: 屈曲 が 'Lateral Flexion' や 'Dorsiflexion' に当たらないように）
const MOVEMENT_MATCHERS: Record<string, { include: RegExp; exclude?: RegExp }> = {
  屈曲: { include: /(屈曲|flexion)/i, exclude: /(lateral|dorsi|plantar|側屈|背屈|底屈|lag)/i },
  伸展: { include: /(伸展|extension)/i, exclude: /lag/i },
  外転: { include: /(外転|abduction)/i, exclude: /horizontal|水平/i },
  内転: { include: /(内転|adduction)/i, exclude: /horizontal|水平/i },
  外旋: { include: /(外旋|external rotation)/i },
  内旋: { include: /(内旋|internal rotation)/i },
  背屈: { include: /(背屈|dorsiflexion)/i },
  底屈: { include: /(底屈|plantar\s*flexion)/i },
  挙上: { include: /(挙上|elevation)/i },
}

const ROM_MOVEMENTS = Object.keys(MOVEMENT_MATCHERS)

/** ROM記録の movement 名（日英）が基準の動きキーワードに該当するか */
export function movementMatches(recordMovement: string, keyword: string): boolean {
  const matcher = MOVEMENT_MATCHERS[keyword]
  if (!matcher) return false
  if (matcher.exclude && matcher.exclude.test(recordMovement)) return false
  return matcher.include.test(recordMovement)
}

// 筋名の同義語グループ（基準文言 ⇔ 記録の muscleGroup を日英対応で突き合わせる）。
// 「下腿三頭筋」は「三頭筋」グループより先に置く（部分文字列の誤マッチ防止）
const MUSCLE_SYNONYMS: RegExp[] = [
  /quadriceps|quads?\b|大腿四頭筋|四頭筋/i,
  /hamstrings?|ハムスト/i,
  /gluteus|glutes?\b|殿筋|臀筋/i,
  /calf|gastrocnemius|soleus|下腿三頭筋|腓腹筋|ヒラメ筋/i,
  /deltoid|三角筋/i,
  /rotator|cuff|腱板|棘上筋|棘下筋|肩甲下筋|小円筋/i,
  /biceps|上腕二頭筋|二頭筋/i,
  /triceps|上腕三頭筋|三頭筋/i,
  /tibialis|前脛骨筋/i,
  /iliopsoas|腸腰筋/i,
]

function muscleGroupIndex(text: string): number {
  return MUSCLE_SYNONYMS.findIndex(re => re.test(text))
}

/**
 * 筋力系の照合候補から、基準文言に対応する1件を保守的に選ぶ。
 * - 基準に筋名がある → 同じ筋の記録だけに絞る（対応記録なし=null、複数筋に該当=曖昧）
 * - 基準に筋名がない → 記録が1筋だけなら採用、複数筋あれば曖昧
 * - 絞った後も左右の記録が混在していたら曖昧（患側を特定できないため）
 */
export function pickStrengthCandidate(
  criterionText: string,
  candidates: StrengthCandidate[],
): { candidate: StrengthCandidate } | { ambiguity: Ambiguity } | null {
  if (candidates.length === 0) return null
  const critIdx = muscleGroupIndex(criterionText)
  const muscles = [...new Set(candidates.map(c => c.muscle))]
  const critNamesMuscle =
    critIdx >= 0 || muscles.some(m => m.length >= 2 && criterionText.includes(m))

  let pool: StrengthCandidate[]
  if (critNamesMuscle) {
    const matched = muscles.filter(m => {
      if (!m) return false
      if (m.length >= 2 && criterionText.includes(m)) return true
      const mi = muscleGroupIndex(m)
      return mi >= 0 && mi === critIdx
    })
    if (matched.length === 0) return null // 基準の筋に対応する記録がない → データなし扱い
    if (matched.length > 1) return { ambiguity: 'muscles' }
    pool = candidates.filter(c => c.muscle === matched[0])
  } else {
    if (muscles.length > 1) return { ambiguity: 'muscles' }
    pool = candidates
  }

  const sides = new Set(pool.map(c => c.side).filter(s => s === 'left' || s === 'right'))
  if (sides.size >= 2) return { ambiguity: 'sides' }
  const latest = [...pool].sort((a, b) => b.date.localeCompare(a.date))[0]
  return { candidate: latest }
}

function detectOp(text: string, fallback: ComparisonOp): ComparisonOp {
  if (/(以上|≥|≧|>=)/.test(text)) return 'gte'
  if (/(以下|以内|≤|≦|<=|未満)/.test(text)) return 'lte'
  return fallback
}

/**
 * 進行基準の文言を解析する。確信が持てない場合は null（自動照合しない）。
 * label と target を連結して判定する（「屈曲」＋「120°」のような分割記載に対応）。
 */
export function parseCriterion(label: string, target?: string): ParsedCriterion | null {
  const text = `${label} ${target ?? ''}`.trim()
  if (!text) return null
  const lower = text.toLowerCase()

  // LSI / 健側比（%必須。「左右差5°以内」のような角度の左右差は対象外）
  if (/(lsi|健側比|健患比|患健比|左右比)/.test(lower)) {
    // 「屈曲 健側比90%」のようなROM対称性の基準は筋力LSIと別物 → 筋力の文脈が無ければ対象外
    if (ROM_MOVEMENTS.some(k => text.includes(k)) && !/筋|力|strength/i.test(text)) return null
    const m = text.match(/(\d{1,3})\s*[%％]/)
    if (!m) return null
    const threshold = Number(m[1])
    if (threshold > 150) return null
    return { kind: 'lsi', op: detectOp(text, 'gte'), threshold, unit: '%' }
  }

  // 痛み（NRS）。誤解析を避けるため:
  // - 動作特異的な痛み（例: 屈曲時痛）は全身のNRS記録と同一視できない → 対象外
  // - 機能課題との複合（例: 疼痛なく片脚スクワット10回）の回数・時間を拾わない → 対象外
  // - 数値は「◯以下」等の比較語が直接付くものだけを採用（既定方向へのフォールバックはしない）
  if (/(疼痛|痛み|nrs|pain)/.test(lower)) {
    if (ROM_MOVEMENTS.some(k => text.includes(k))) return null
    if (/\d\s*(回|セット|分|秒|時間|km|㎞|kg|㎏|cm|㎝)/.test(text)) return null
    const m =
      text.match(/(\d{1,2})\s*(?:\/\s*10)?\s*(以下|以内|未満|≤|≦|<=)/) ??
      text.match(/(?:≤|≦|<=)\s*(\d{1,2})/)
    if (!m) return null
    let threshold = Number(m[1])
    if (threshold > 10) return null
    // 「3未満」は整数NRSでは「2以下」と同義
    if (m[2] === '未満') threshold = Math.max(0, threshold - 1)
    return { kind: 'pain', op: 'lte', threshold, unit: '/10' }
  }

  // MMT（数値はMMTの直後にあるものだけ。「MMT改善（屈曲120°）」の角度の桁を拾わない）
  if (/mmt/.test(lower)) {
    const m = text.match(/mmt\s*[:：]?\s*(?:grade\s*)?([0-5])(?![0-9])/i)
    if (!m) return null
    return { kind: 'mmt', op: detectOp(text, 'gte'), threshold: Number(m[1]), unit: '' }
  }

  // ROM（動きのキーワード＋角度）。以下は比較先が複雑なため対象外:
  // 左右差◯°以内・拘縮◯°以内・「未満」表記
  const movement = ROM_MOVEMENTS.find(k => text.includes(k))
  if (movement) {
    if (/(左右差|以内|拘縮|未満)/.test(text)) return null
    const m = text.match(/(-?\d{1,3})\s*(?:°|度)/)
    if (!m) return null
    const threshold = Number(m[1])
    if (threshold > 200) return null
    return { kind: 'rom', movement, op: detectOp(text, 'gte'), threshold, unit: '°' }
  }

  return null
}

// ── 照合 ────────────────────────────────────────

function daysBetween(fromDate: string, today: string): number | undefined {
  const from = Date.parse(fromDate)
  const to = Date.parse(today)
  if (Number.isNaN(from) || Number.isNaN(to)) return undefined
  return Math.max(0, Math.round((to - from) / 86400000))
}

function judge(value: number, op: ComparisonOp, threshold: number): 'pass' | 'fail' {
  return (op === 'gte' ? value >= threshold : value <= threshold) ? 'pass' : 'fail'
}

const SIDE_LABELS: Record<string, string> = { left: '・左', right: '・右', bilateral: '・両側' }

/** 現在フェーズの進行基準を実測値と照合する */
export function evaluateCriteria(
  criteria: Criterion[],
  evidence: MeasuredEvidence,
  today: string,
): CriterionEvaluation[] {
  return criteria.map((criterion, index) => {
    const criterionText = `${criterion.label} ${criterion.target ?? ''}`.trim()
    const parsed = parseCriterion(criterion.label, criterion.target)
    const base: CriterionEvaluation = {
      index,
      label: criterion.label,
      target: criterion.target,
      met: Boolean(criterion.met),
      parsed,
    }
    if (!parsed) return base

    let measured: { value: number; date: string; label: string } | undefined
    let ambiguity: Ambiguity | undefined

    if (parsed.kind === 'rom') {
      const matches = evidence.roms.filter(r => movementMatches(r.movement, parsed.movement!))
      if (matches.length > 0) {
        // 左右の記録が混在 → 患側を特定できないので判定しない
        const sides = new Set(matches.map(r => r.side).filter(s => s === 'left' || s === 'right'))
        if (sides.size >= 2) {
          ambiguity = 'sides'
        } else {
          const latest = [...matches].sort((a, b) => b.date.localeCompare(a.date))[0]
          measured = {
            value: latest.value,
            date: latest.date,
            label: `ROM ${latest.movement}${SIDE_LABELS[latest.side] ?? ''}`,
          }
        }
      }
    } else if (parsed.kind === 'lsi' || parsed.kind === 'mmt') {
      const candidates = parsed.kind === 'lsi' ? evidence.lsiCandidates : evidence.mmtCandidates
      const picked = pickStrengthCandidate(criterionText, candidates)
      if (picked && 'candidate' in picked) {
        const c = picked.candidate
        const prefix = parsed.kind === 'lsi' ? '筋力 健側比' : 'MMT'
        measured = {
          value: c.value,
          date: c.date,
          label: `${prefix}（${c.muscle || '筋名未記載'}${SIDE_LABELS[c.side] ?? ''}）`,
        }
      } else if (picked && 'ambiguity' in picked) {
        ambiguity = picked.ambiguity
      }
    } else if (parsed.kind === 'pain' && evidence.painNrs) {
      measured = {
        value: evidence.painNrs.value,
        date: evidence.painNrs.date,
        label: evidence.painNrs.label,
      }
    }

    if (ambiguity) return { ...base, ambiguity }
    if (!measured) return base

    return {
      ...base,
      measured,
      autoJudgment: judge(measured.value, parsed.op, parsed.threshold),
      staleDays: daysBetween(measured.date, today),
    }
  })
}

// ── 再評価のおすすめ（条件ベース）──────────────

/**
 * 再評価が必要な基準を挙げる。
 * - 自動照合できる基準なのに実測データが無い → 「未測定」
 * - 実測はあるが staleDaysThreshold 日より古い → 「再測定のおすすめ」
 * 手動チェック済み（met）の基準と、照合先を特定できない曖昧な基準は対象外。
 */
export function buildReassessmentSuggestions(
  evaluations: CriterionEvaluation[],
  staleDaysThreshold = 21,
): ReassessmentSuggestion[] {
  const out: ReassessmentSuggestion[] = []
  for (const ev of evaluations) {
    if (!ev.parsed || ev.met || ev.ambiguity) continue
    if (!ev.measured) {
      out.push({
        criterionLabel: ev.label,
        reason: 'no_data',
        detail: 'この基準に対応する測定記録がまだありません',
      })
    } else if (ev.staleDays != null && ev.staleDays > staleDaysThreshold) {
      out.push({
        criterionLabel: ev.label,
        reason: 'stale',
        detail: `最終測定から${ev.staleDays}日経過（${ev.measured.label}: ${ev.measured.value}${ev.parsed.unit}）`,
      })
    }
  }
  return out
}

/** 曖昧理由の表示用文言 */
export const AMBIGUITY_LABELS: Record<Ambiguity, string> = {
  sides: '左右の記録が混在するため自動照合の対象外（患側を特定できません）',
  muscles: '複数の筋の記録があり基準の筋を特定できないため自動照合の対象外',
}

/** 表示用: 基準値の文字列（例: 「≥80%」「≤2/10」） */
export function formatThreshold(parsed: ParsedCriterion): string {
  return `${parsed.op === 'gte' ? '≥' : '≤'}${parsed.threshold}${parsed.unit}`
}
