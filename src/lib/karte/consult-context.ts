/**
 * AI相談に送る「個人が分からない」カルテの要約を作る（画面とサーバーの両方で使う純粋な関数）
 *
 * 送らないもの: お名前・ふりがな・生年月日（年代にする）・電話・住所・メール・保険証・NOAHの番号・緊急連絡先・勤務先
 * 送るもの（院長が項目ごとに外せる）: 年代・性別・部位・診断名・主訴、直近の問診、直近のSOAP、スペシャルテスト、簡易メモ
 * 自由記述の欄にお名前が書かれている可能性はあるため、送る前に画面で中身をそのまま見せる。
 */
import type { Intake, Patient, QuickMemo, SOAPNote, SpecialTestRecord } from '@/types/patient'
import { BODY_REGION_LABELS, PHASE_LABELS } from '@/types/patient'

export type ConsultItemKey = 'profile' | 'intake' | 'soap' | 'tests' | 'memos'

export interface ConsultItem {
  key: ConsultItemKey
  label: string
  /** そのまま送る文章（画面にも同じものを出す） */
  text: string
}

export const CONSULT_ITEM_LABELS: Record<ConsultItemKey, string> = {
  profile: '基本（年代・性別・部位・診断名・主訴）',
  intake: '直近の問診票',
  soap: '直近のSOAPカルテ',
  tests: 'スペシャルテスト',
  memos: '簡易メモ',
}

/** 送る本文の上限（1項目）。長い場合は古いものを削る */
export const MAX_ITEM_CHARS = 4000
/** 相談の文字数の上限 */
export const MAX_QUESTION_CHARS = 2000

/** 生年月日 → 年代（例: 40代、10代前半）。分からなければ空 */
export function ageBand(birthDate: string, today = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate ?? '')
  if (!m) return ''
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3])
  let age = today.getFullYear() - y
  if (today.getMonth() < mo || (today.getMonth() === mo && today.getDate() < d)) age -= 1
  if (age < 0 || age > 120) return ''
  if (age < 10) return '10歳未満'
  if (age < 20) return age < 15 ? '10代前半' : '10代後半'
  return `${Math.floor(age / 10) * 10}代`
}

const GENDER: Record<string, string> = { male: '男性', female: '女性', other: '' }

function line(label: string, value: unknown): string | null {
  if (value === undefined || value === null) return null
  const v = Array.isArray(value) ? value.filter(Boolean).join('、') : String(value).trim()
  return v ? `${label}: ${v}` : null
}

function clip(text: string, max = MAX_ITEM_CHARS): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function profileItem(patient: Patient, today = new Date()): ConsultItem {
  const text = [
    line('年代', ageBand(patient.birthDate, today)),
    line('性別', GENDER[patient.gender] ?? ''),
    line('部位', BODY_REGION_LABELS[patient.bodyRegion] ?? patient.bodyRegion),
    line('診断名・傷病名', patient.diagnosisLabel),
    line('主訴', patient.mainComplaint),
    line('発症日', patient.onsetDate),
    line('初診日', patient.firstVisitDate),
  ].filter((x): x is string => x !== null).join('\n')
  return { key: 'profile', label: CONSULT_ITEM_LABELS.profile, text }
}

export function intakeItem(intakes: Intake[]): ConsultItem | null {
  const latest = [...intakes].sort((a, b) => b.intakeDate.localeCompare(a.intakeDate))[0]
  if (!latest) return null
  const text = [
    line('問診日', latest.intakeDate),
    line('主訴', latest.chiefComplaint),
    line('受傷日', latest.injuryDate),
    line('受傷機転', latest.injuryMechanism),
    line('初発/再発', latest.firstTimeSymptoм ? '初発' : '再発'),
    line('以前の治療', latest.previousTreatment),
    line('痛みNRS', Number.isFinite(latest.painNrs) ? `${latest.painNrs}/10` : ''),
    line('痛みの性状', latest.painCharacter),
    line('痛みのタイミング', latest.painTiming),
    line('悪化因子', latest.worseFactor),
    line('軽快因子', latest.betterFactor),
    line('生活で困ること', latest.adlDifficulty),
    line('スポーツ・活動', latest.sportsActivity),
    line('取り戻したい動作', latest.importantGoal),
    line('既往歴', latest.pastMedicalHistory),
    line('服薬', latest.currentMedications),
    line('画像所見', latest.imagingResults),
    line('疑い診断', latest.suspectedDiagnosis),
    line('施術者メモ', latest.therapistNotes),
  ].filter((x): x is string => x !== null).join('\n')
  return { key: 'intake', label: CONSULT_ITEM_LABELS.intake, text: clip(text) }
}

function soapText(n: SOAPNote): string {
  const complaints = (n.complaints ?? [])
    .map(c => `${BODY_REGION_LABELS[c.bodyRegion] ?? c.bodyRegion}${c.diagnosisLabel ? `(${c.diagnosisLabel})` : ''} NRS${c.nrs}${c.symptoms?.length ? ` ${c.symptoms.join('・')}` : ''}`)
    .join('、')
  const tests = (n.soapSpecialTests ?? []).map(t => `${t.testName}:${t.result}`).join('、')
  return [
    `■ ${n.visitDate}（${n.visitNumber}回目${n.currentPhase ? `・${PHASE_LABELS[n.currentPhase] ?? ''}` : ''}）`,
    line('S 痛み', Number.isFinite(n.painToday) && n.painToday >= 0 ? `${n.painToday}/10` : ''),
    line('S 部位別', complaints),
    line('S 前回から', n.changeFromLast),
    line('S 生活の困りごと', n.adlDifficulty),
    line('S 自宅運動', n.homeExerciseAdherence),
    line('S 心配ごと', n.patientConcern),
    line('O ROM', n.romFindings),
    line('O 筋力', n.strengthFindings),
    line('O テスト', [n.specialTestFindings, tests].filter(Boolean).join('、')),
    line('O 圧痛', n.tenderness),
    line('O 腫脹/熱感', [n.swelling ? '腫脹あり' : '', n.heat ? '熱感あり' : ''].filter(Boolean).join('、')),
    line('O 歩行', n.gait),
    line('O 片脚立位', n.singleLegStance),
    line('O スクワット', n.squat),
    line('O 所見', n.therapistObservation),
    line('A 改善点', n.improvements),
    line('A 残る問題', n.remainingIssues),
    line('A 優先課題', n.priorityIssue),
    line('A 医師紹介の要否', n.physicianReferralNeeded ? '要検討' : ''),
    line('P 本日の施術', n.treatmentToday),
    line('P 次の目標', n.nextGoal),
    line('P 自宅運動', n.homeExercise),
    line('P 禁忌動作', n.forbiddenMovements),
  ].filter((x): x is string => x !== null).join('\n')
}

export function soapItem(notes: SOAPNote[], limit = 5): ConsultItem | null {
  const recent = [...notes].sort((a, b) => b.visitDate.localeCompare(a.visitDate)).slice(0, limit)
  if (recent.length === 0) return null
  return { key: 'soap', label: `${CONSULT_ITEM_LABELS.soap}（直近${recent.length}回）`, text: clip(recent.map(soapText).join('\n\n')) }
}

export function testsItem(tests: SpecialTestRecord[], limit = 12): ConsultItem | null {
  const recent = [...tests].sort((a, b) => b.measuredDate.localeCompare(a.measuredDate)).slice(0, limit)
  if (recent.length === 0) return null
  const text = recent
    .map(t => {
      const sides = t.rightResult || t.leftResult ? `右:${t.rightResult ?? '-'} 左:${t.leftResult ?? '-'}` : `結果:${t.result}`
      const extra = [t.apprehension ? 'apprehension(+)' : '', t.clickSound ? 'click(+)' : '', t.limitation ? '制限あり' : '', t.memo].filter(Boolean).join('、')
      return `${t.measuredDate} ${t.testName}（${BODY_REGION_LABELS[t.bodyRegion] ?? t.bodyRegion}） ${sides}${extra ? ` ${extra}` : ''}`
    })
    .join('\n')
  return { key: 'tests', label: CONSULT_ITEM_LABELS.tests, text: clip(text) }
}

export function memosItem(memos: QuickMemo[], limit = 10): ConsultItem | null {
  const recent = [...memos].sort((a, b) => b.memoDate.localeCompare(a.memoDate)).slice(0, limit)
  if (recent.length === 0) return null
  return { key: 'memos', label: CONSULT_ITEM_LABELS.memos, text: clip(recent.map(m => `${m.memoDate}: ${m.content}`).join('\n')) }
}

export interface ConsultSource {
  patient: Patient
  intakes: Intake[]
  soapNotes: SOAPNote[]
  specialTests: SpecialTestRecord[]
  memos: QuickMemo[]
}

/** 送れる項目を全部作る（画面でチェックを外せる）。お名前などは一切含めない */
export function buildConsultItems(src: ConsultSource, today = new Date()): ConsultItem[] {
  return [
    profileItem(src.patient, today),
    intakeItem(src.intakes),
    soapItem(src.soapNotes),
    testsItem(src.specialTests),
    memosItem(src.memos),
  ].filter((x): x is ConsultItem => x !== null)
}

/**
 * 送る直前の安全確認: 患者さんのお名前・ふりがな・電話番号が本文に紛れていないか。
 * 紛れていたら、その項目名を返す（画面で知らせて外してもらう）
 */
export function findIdentifierLeaks(items: ConsultItem[], patient: Pick<Patient, 'name' | 'kana' | 'phone'>): string[] {
  const needles = [patient.name, patient.kana, patient.phone]
    .flatMap(v => {
      const t = (v ?? '').trim()
      if (!t) return []
      const compact = t.replace(/[\s　]/g, '')
      return compact.length >= 2 ? [t, compact] : []
    })
    .flatMap(v => (/^\d[\d-]+$/.test(v) ? [v, v.replace(/-/g, '')] : [v]))
  return items
    .filter(item => needles.some(n => item.text.includes(n) || item.text.replace(/[\s　-]/g, '').includes(n.replace(/[\s　-]/g, ''))))
    .map(item => item.label)
}
