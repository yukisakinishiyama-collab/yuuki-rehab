// ──────────────────────────────────────────────
// NOAH（レセコン）の患者さんを、院内アプリのカルテへ取り込む
//
// 流れ: 院のパソコンで NOAH の「ハガキ・名簿」を CSV に書き出す → パソコンの中で
// 同じ方（氏名＋生年月日）をまとめた取り込み用の JSON を作る → この画面でその JSON を選んで取り込む。
// 患者さんの情報はこの端末（とふだんのクラウド同期先）にだけ入る。リポジトリやほかのサービスには送らない。
//
// すでにカルテがある方（氏名＋生年月日が同じ、または NOAH の番号が同じ）は新しく作らず、
// 空いている欄と保険の情報・NOAH の番号だけを足す（手で書いた内容は上書きしない）。
// ──────────────────────────────────────────────
import type { Gender, NoahLink, Patient, PatientInsurance } from '@/types/patient'

export interface NoahImportPatient {
  name: string
  kana?: string
  birthDate: string
  gender?: Gender
  phone?: string
  email?: string
  postalCode?: string
  address?: string
  occupation?: string
  insurance?: PatientInsurance
  noah: { ids: string[]; firstVisit?: string; lastVisit?: string; visitCount?: number }
}

export interface NoahImportFile {
  version: 1
  source: string
  exportedAt: string
  patients: NoahImportPatient[]
}

export interface ImportPlan {
  create: Patient[]
  update: { before: Patient; after: Patient }[]
  unchanged: number
  invalid: number
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const optDate = (v: unknown): string | undefined => (typeof v === 'string' && DATE.test(v) ? v : undefined)

/** 名前の比べ方（空白を取り、全角・半角をそろえる） */
export function nameKey(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, '')
}

function personKey(name: string, birthDate: string): string {
  return `${nameKey(name)}|${birthDate}`
}

/** 取り込み用 JSON を読む。形が違うものは invalid として数えて捨てる */
export function parseImportFile(text: string): { file: NoahImportFile; invalid: number } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('JSONとして読めません（取り込み用のファイルを選んでください）')
  }
  const obj = raw as Partial<NoahImportFile>
  if (!obj || obj.version !== 1 || !Array.isArray(obj.patients)) {
    throw new Error('取り込み用のファイルではありません（version 1 の patients がありません）')
  }
  let invalid = 0
  const patients: NoahImportPatient[] = []
  for (const p of obj.patients as unknown[]) {
    const r = p as Record<string, unknown>
    const name = str(r?.name, 60)
    const birthDate = optDate(r?.birthDate)
    const noah = r?.noah as Record<string, unknown> | undefined
    const ids = Array.isArray(noah?.ids) ? (noah!.ids as unknown[]).map((x) => str(x, 20)).filter(Boolean) : []
    if (!name || !birthDate || ids.length === 0) {
      invalid += 1
      continue
    }
    const ins = (r.insurance ?? {}) as Record<string, unknown>
    const gender = r.gender === 'male' || r.gender === 'female' ? r.gender : 'other'
    patients.push({
      name,
      kana: str(r.kana, 60),
      birthDate,
      gender,
      phone: str(r.phone, 30),
      email: str(r.email, 120),
      postalCode: str(r.postalCode, 10),
      address: str(r.address, 200),
      occupation: str(r.occupation, 40),
      insurance: {
        category: str(ins.category, 20) || undefined,
        kind: str(ins.kind, 20) || undefined,
        insurerNumber: str(ins.insurerNumber, 12) || undefined,
        insurerName: str(ins.insurerName, 60) || undefined,
        symbol: str(ins.symbol, 30) || undefined,
        number: str(ins.number, 30) || undefined,
        burdenRatio: str(ins.burdenRatio, 10) || undefined,
        validUntil: optDate(ins.validUntil),
        relation: str(ins.relation, 10) || undefined,
        insuredName: str(ins.insuredName, 60) || undefined,
        insuredKana: str(ins.insuredKana, 60) || undefined,
        insuredBirthDate: optDate(ins.insuredBirthDate),
        asOf: optDate(ins.asOf),
      },
      noah: {
        ids,
        firstVisit: optDate(noah?.firstVisit),
        lastVisit: optDate(noah?.lastVisit),
        visitCount: typeof noah?.visitCount === 'number' && noah.visitCount >= 0 ? Math.floor(noah.visitCount) : undefined,
      },
    })
  }
  return { file: { version: 1, source: str(obj.source, 100), exportedAt: str(obj.exportedAt, 30), patients }, invalid }
}

function mergeNoah(a: NoahLink | undefined, b: NoahImportPatient['noah'], importedAt: string): NoahLink {
  const ids = [...new Set([...(a?.ids ?? []), ...b.ids])].sort((x, y) => Number(x) - Number(y))
  const first = [a?.firstVisit, b.firstVisit].filter(Boolean).sort()[0]
  const last = [a?.lastVisit, b.lastVisit].filter(Boolean).sort().reverse()[0]
  return { ids, firstVisit: first, lastVisit: last, visitCount: b.visitCount ?? a?.visitCount, importedAt }
}

/** 保険の情報は新しい方を使う。ただし取り込みに無い欄（記号・番号など）は前の値を残す */
function mergeInsurance(a: PatientInsurance | undefined, b: PatientInsurance | undefined): PatientInsurance | undefined {
  if (!b) return a
  const out: PatientInsurance = { ...(a ?? {}) }
  for (const [k, v] of Object.entries(b) as [keyof PatientInsurance, string | undefined][]) {
    if (v) out[k] = v
  }
  return out
}

const fill = (cur: string | undefined, next: string | undefined) => (cur && cur.trim() ? cur : next ?? cur ?? '')

/** 今あるカルテと突き合わせて、作る・足すを決める（まだ保存はしない） */
export function planImport(existing: Patient[], incoming: NoahImportPatient[], now: Date = new Date()): ImportPlan {
  const nowIso = now.toISOString()
  const today = nowIso.slice(0, 10)
  const byPerson = new Map<string, Patient>()
  const byNoahId = new Map<string, Patient>()
  for (const p of existing) {
    if (p.birthDate) byPerson.set(personKey(p.name, p.birthDate), p)
    for (const id of p.noah?.ids ?? []) byNoahId.set(id, p)
  }

  const plan: ImportPlan = { create: [], update: [], unchanged: 0, invalid: 0 }
  const touched = new Map<string, Patient>()
  for (const inc of incoming) {
    const found =
      byPerson.get(personKey(inc.name, inc.birthDate)) ?? inc.noah.ids.map((id) => byNoahId.get(id)).find(Boolean)
    if (found) {
      const base = touched.get(found.id) ?? found
      const after: Patient = {
        ...base,
        kana: fill(base.kana, inc.kana),
        phone: fill(base.phone, inc.phone),
        postalCode: fill(base.postalCode, inc.postalCode) || undefined,
        address: fill(base.address, inc.address) || undefined,
        email: fill(base.email, inc.email) || undefined,
        occupation: fill(base.occupation, inc.occupation) || undefined,
        firstVisitDate: fill(base.firstVisitDate, inc.noah.firstVisit),
        insurance: mergeInsurance(base.insurance, { ...inc.insurance, asOf: inc.insurance?.asOf ?? today }),
        noah: mergeNoah(base.noah, inc.noah, nowIso),
        updatedAt: base.updatedAt,
      }
      const changed = JSON.stringify({ ...after, noah: { ...after.noah, importedAt: '' } }) !==
        JSON.stringify({ ...base, noah: base.noah ? { ...base.noah, importedAt: '' } : undefined })
      if (changed) {
        touched.set(found.id, after)
      } else if (!touched.has(found.id)) {
        plan.unchanged += 1
      }
      continue
    }
    const recent = inc.noah.lastVisit && Date.parse(inc.noah.lastVisit) >= now.getTime() - 90 * 86_400_000
    const created: Patient = {
      id: crypto.randomUUID(),
      name: inc.name,
      kana: inc.kana ?? '',
      birthDate: inc.birthDate,
      gender: inc.gender ?? 'other',
      phone: inc.phone ?? '',
      emergencyContact: '',
      mainComplaint: '',
      bodyRegion: 'other',
      diagnosisLabel: '',
      onsetDate: '',
      firstVisitDate: inc.noah.firstVisit ?? '',
      status: recent ? 'active' : 'inactive',
      therapistNotes: '',
      createdAt: nowIso,
      updatedAt: nowIso,
      postalCode: inc.postalCode || undefined,
      address: inc.address || undefined,
      email: inc.email || undefined,
      occupation: inc.occupation || undefined,
      insurance: { ...inc.insurance, asOf: inc.insurance?.asOf ?? today },
      noah: mergeNoah(undefined, inc.noah, nowIso),
    }
    plan.create.push(created)
    // 取り込みファイルの中で同じ方が2回出てきても、2人にしない
    byPerson.set(personKey(created.name, created.birthDate), created)
    for (const id of created.noah!.ids) byNoahId.set(id, created)
  }
  for (const [id, after] of touched) {
    const before = existing.find((p) => p.id === id)
    if (before) plan.update.push({ before, after })
    else {
      // 同じ取り込みの中で作った人に、あとから同じ方の行が足された場合
      const i = plan.create.findIndex((p) => p.id === id)
      if (i >= 0) plan.create[i] = after
    }
  }
  return plan
}
