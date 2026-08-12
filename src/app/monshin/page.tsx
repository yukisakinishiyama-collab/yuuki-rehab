'use client'
// ──────────────────────────────────────────────
// Web問診（患者さん向け・公開ページ）
//
// 新患の方、通院中で新しいけがをされた方に、来院前に入力していただく。
// 【この画面でしないこと】
// - 診断名・疑い病名を示さない（柔道整復師の業務範囲・医療広告ガイドライン）
// - AIを呼ばない（公開経路のため。分析は院内画面で行う）
// - 送信した内容を読み出す機能は持たない（第三者に他人の問診を見せない）
// ──────────────────────────────────────────────
import { useState } from 'react'
import {
  MONSHIN_VISIT_LABELS, WARNING_SIGNS, detectRedFlags, validateSubmission,
  type MonshinSubmission, type MonshinVisitType, type WarningLevel,
} from '@/lib/monshin'

const PAIN_CHARACTERS = ['ズキズキ', '鋭い', '鈍い', '重だるい', 'しびれる', '焼けるような', '張っている']
const PAIN_TIMINGS = ['じっとしていても', '動かすと', '朝が強い', '夕方〜夜が強い', '天気が悪いと']
const ADL_ITEMS = ['歩く', '階段', '立ち座り', 'しゃがむ', '正座', '腕を上げる', '物を持つ', '寝返り', '車の運転', '仕事の動作']
const BODY_PARTS = ['首', '肩', '背中', '腰', '股関節', '太もも', '膝', 'ふくらはぎ', '足首', '足の裏', '肘', '手首', '手・指']

const empty: MonshinSubmission = {
  visitType: 'new_patient',
  name: '', kana: '', phone: '', birthDate: '',
  chiefComplaint: '', injuryDate: '', injuryMechanism: '', isFirstTime: true, previousTreatment: '',
  painLocations: [], painNrs: 5, painCharacter: [], painTiming: [], worseFactor: '', betterFactor: '',
  adlDifficulty: [], occupation: '', sportsActivity: '', importantGoal: '',
  pastMedicalHistory: '', currentMedications: '',
  warningSigns: [], appointmentDate: '', note: '', consented: false,
}

const CLINIC_PHONE = '083-265-4545'

export default function MonshinPage() {
  const [form, setForm] = useState<MonshinSubmission>(empty)
  const [errors, setErrors] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<{ level: WarningLevel | null; message: string } | null>(null)

  const set = <K extends keyof MonshinSubmission>(key: K, value: MonshinSubmission[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const toggle = (key: 'painLocations' | 'painCharacter' | 'painTiming' | 'adlDifficulty' | 'warningSigns', v: string) =>
    setForm(f => ({
      ...f,
      [key]: f[key].includes(v) ? f[key].filter(x => x !== v) : [...f[key], v],
    }))

  // 入力中でも危険兆候が分かるよう、その場で案内を出す（送信を待たせない）
  const liveFlag = detectRedFlags({ warningSigns: form.warningSigns, painNrs: form.painNrs })

  async function handleSubmit() {
    const validation = validateSubmission(form)
    if (!validation.ok) {
      setErrors(validation.errors)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setErrors([])
    setSending(true)
    try {
      const res = await fetch('/api/monshin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors([data.error ?? '送信できませんでした。お手数ですがお電話ください。'])
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      setDone({ level: data.redFlagLevel ?? null, message: data.message ?? '' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setErrors(['通信に失敗しました。電波の良い場所でお試しいただくか、お電話ください。'])
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="max-w-xl mx-auto space-y-5">
          <div className="rounded-2xl bg-white border border-teal-200 px-6 py-8 text-center">
            <p className="text-3xl mb-2" aria-hidden>✓</p>
            <h1 className="text-lg font-bold text-slate-800">問診票を受け付けました</h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              ありがとうございました。ご来院時に、内容を確認しながら詳しくお伺いします。
            </p>
          </div>
          {done.message && (
            <div className={`rounded-2xl border px-6 py-5 ${
              done.level === 'urgent'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <p className="text-sm leading-relaxed">{done.message}</p>
              <a
                href={`tel:${CLINIC_PHONE.replace(/-/g, '')}`}
                className="mt-4 inline-flex items-center justify-center w-full rounded-xl
                  bg-white border border-current px-4 py-3 font-bold"
              >
                {CLINIC_PHONE} に電話する
              </a>
            </div>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="max-w-xl mx-auto space-y-5">
        <header>
          <p className="text-[11px] tracking-[0.2em] text-teal-700 font-semibold">YUUKI SEIKOTSUIN</p>
          <h1 className="text-xl font-bold text-slate-800 mt-1">来院前の問診票</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            ご来院前にお答えいただくと、当日の説明と施術がスムーズになります。
            分かる範囲で構いません。3〜5分ほどで終わります。
          </p>
        </header>

        {errors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <ul className="text-sm text-red-700 space-y-0.5">
              {errors.map((e, i) => <li key={i}>・{e}</li>)}
            </ul>
          </div>
        )}

        <Section title="ご来院のきっかけ" required>
          <div className="grid gap-2">
            {(Object.keys(MONSHIN_VISIT_LABELS) as MonshinVisitType[]).map(v => (
              <Choice key={v} selected={form.visitType === v} onClick={() => set('visitType', v)}>
                {MONSHIN_VISIT_LABELS[v]}
              </Choice>
            ))}
          </div>
        </Section>

        <Section title="お名前・ご連絡先" required>
          <Field label="お名前" required>
            <TextInput value={form.name} onChange={v => set('name', v)} placeholder="山口 太郎" autoComplete="name" />
          </Field>
          <Field label="ふりがな">
            <TextInput value={form.kana} onChange={v => set('kana', v)} placeholder="やまぐち たろう" />
          </Field>
          <Field label="電話番号" required>
            <TextInput value={form.phone} onChange={v => set('phone', v)} type="tel" placeholder="090-1234-5678" autoComplete="tel" />
          </Field>
          <Field label="生年月日">
            <TextInput value={form.birthDate} onChange={v => set('birthDate', v)} type="date" />
          </Field>
          <Field label="ご予約の日（分かれば）">
            <TextInput value={form.appointmentDate} onChange={v => set('appointmentDate', v)} type="date" />
          </Field>
        </Section>

        <Section title="どこが、どのようにつらいですか" required>
          <Field label="いちばんつらいところ・症状" required>
            <TextInput
              value={form.chiefComplaint}
              onChange={v => set('chiefComplaint', v)}
              placeholder="例：右の膝が階段で痛む"
            />
          </Field>
          <Field label="痛む場所（当てはまるものすべて）">
            <ChipGroup items={BODY_PARTS} selected={form.painLocations} onToggle={v => toggle('painLocations', v)} />
          </Field>
          <Field label="いつから">
            <TextInput value={form.injuryDate} onChange={v => set('injuryDate', v)} type="date" />
          </Field>
          <Field label="きっかけ（思い当たることがあれば）">
            <TextInput
              value={form.injuryMechanism}
              onChange={v => set('injuryMechanism', v)}
              placeholder="例：部活のジャンプ着地でひねった／思い当たらない"
            />
          </Field>
          <Field label="同じ症状は初めてですか">
            <div className="grid grid-cols-2 gap-2">
              <Choice selected={form.isFirstTime} onClick={() => set('isFirstTime', true)}>初めて</Choice>
              <Choice selected={!form.isFirstTime} onClick={() => set('isFirstTime', false)}>くり返している</Choice>
            </div>
          </Field>
        </Section>

        <Section title="痛みの強さ" required>
          <p className="text-xs text-slate-500 mb-2">
            0＝まったく痛くない　10＝これ以上ないほど痛い
          </p>
          <input
            type="range" min={0} max={10} step={1}
            value={form.painNrs}
            onChange={e => set('painNrs', Number(e.target.value))}
            className="w-full accent-teal-600"
            aria-label="痛みの強さ"
          />
          <div className="text-center text-2xl font-bold text-teal-700 tabular-nums">{form.painNrs}</div>
          <Field label="痛みの感じ">
            <ChipGroup items={PAIN_CHARACTERS} selected={form.painCharacter} onToggle={v => toggle('painCharacter', v)} />
          </Field>
          <Field label="どんなときに痛みますか">
            <ChipGroup items={PAIN_TIMINGS} selected={form.painTiming} onToggle={v => toggle('painTiming', v)} />
          </Field>
          <Field label="痛みが強くなる動作">
            <TextInput value={form.worseFactor} onChange={v => set('worseFactor', v)} placeholder="例：階段を下りるとき" />
          </Field>
          <Field label="楽になること">
            <TextInput value={form.betterFactor} onChange={v => set('betterFactor', v)} placeholder="例：休むと軽くなる" />
          </Field>
        </Section>

        <Section title="困っている動作">
          <ChipGroup items={ADL_ITEMS} selected={form.adlDifficulty} onToggle={v => toggle('adlDifficulty', v)} />
          <Field label="お仕事・よくする動作">
            <TextInput value={form.occupation} onChange={v => set('occupation', v)} placeholder="例：立ち仕事／デスクワーク" />
          </Field>
          <Field label="スポーツ・趣味">
            <TextInput value={form.sportsActivity} onChange={v => set('sportsActivity', v)} placeholder="例：サッカー（週3）" />
          </Field>
          <Field label="いちばん取り戻したいこと">
            <TextInput value={form.importantGoal} onChange={v => set('importantGoal', v)} placeholder="例：階段を痛みなく下りたい" />
          </Field>
        </Section>

        <Section title="これまでのこと">
          <Field label="これまでの病気・けが・手術">
            <TextInput value={form.pastMedicalHistory} onChange={v => set('pastMedicalHistory', v)} placeholder="例：10年前に右膝の手術" />
          </Field>
          <Field label="飲んでいるお薬">
            <TextInput value={form.currentMedications} onChange={v => set('currentMedications', v)} placeholder="例：血圧の薬" />
          </Field>
          <Field label="すでに受けた検査・治療">
            <TextInput value={form.previousTreatment} onChange={v => set('previousTreatment', v)} placeholder="例：整形外科でレントゲン、湿布" />
          </Field>
        </Section>

        <Section title="当てはまるものはありますか">
          <p className="text-xs text-slate-500 mb-2">
            安全のための確認です。当てはまらなければ選ばなくて構いません。
          </p>
          <div className="grid gap-2">
            {WARNING_SIGNS.map(w => (
              <Choice
                key={w.id}
                selected={form.warningSigns.includes(w.id)}
                onClick={() => toggle('warningSigns', w.id)}
              >
                {w.label}
              </Choice>
            ))}
          </div>
          {liveFlag.level && (
            <div className={`mt-3 rounded-xl border px-4 py-3 ${
              liveFlag.level === 'urgent'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <p className="text-sm leading-relaxed">{liveFlag.message}</p>
              <a
                href={`tel:${CLINIC_PHONE.replace(/-/g, '')}`}
                className="mt-3 inline-flex items-center justify-center w-full rounded-xl
                  bg-white border border-current px-4 py-2.5 text-sm font-bold"
              >
                {CLINIC_PHONE} に電話する
              </a>
            </div>
          )}
        </Section>

        <Section title="そのほか伝えておきたいこと">
          <textarea
            value={form.note}
            onChange={e => set('note', e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 text-base border border-slate-200 rounded-xl
              focus:outline-none focus:ring-2 focus:ring-teal-500/40 bg-white"
            placeholder="不安なこと、伝えておきたいことがあればご記入ください"
          />
        </Section>

        <div className="rounded-2xl bg-white border border-slate-200 px-5 py-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.consented}
              onChange={e => set('consented', e.target.checked)}
              className="mt-1 w-5 h-5 accent-teal-600 flex-shrink-0"
            />
            <span className="text-sm text-slate-600 leading-relaxed">
              入力内容を、施術前の確認と必要なご連絡のために使用することに同意します。
              第三者へ無断で提供することはありません。
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={sending}
          className="w-full rounded-2xl bg-teal-600 text-white py-4 text-base font-bold
            hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {sending ? '送信しています…' : '問診票を送信する'}
        </button>

        <p className="text-xs text-slate-400 text-center pb-6 leading-relaxed">
          この問診票は診断を行うものではありません。<br />
          急な強い痛みや歩けないほどの症状は、送信せずお電話ください（{CLINIC_PHONE}）。
        </p>
      </div>
    </main>
  )
}

// ── 小さな部品（この画面だけで使う） ──────────

function Section({ title, required, children }: {
  title: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl bg-white border border-slate-200 px-5 py-4 space-y-3">
      <h2 className="text-sm font-bold text-slate-700">
        {title}
        {required && <span className="ml-1.5 text-[10px] text-red-600 font-semibold">必須</span>}
      </h2>
      {children}
    </section>
  )
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, type = 'text', placeholder, autoComplete }: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      // 文字サイズ16px以上にしてiPhoneでの自動ズームを防ぐ
      className="w-full h-12 px-3 text-base border border-slate-200 rounded-xl bg-white
        focus:outline-none focus:ring-2 focus:ring-teal-500/40"
    />
  )
}

function Choice({ selected, onClick, children }: {
  selected: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-colors ${
        selected
          ? 'bg-teal-600 border-teal-600 text-white font-semibold'
          : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'
      }`}
    >
      {children}
    </button>
  )
}

function ChipGroup({ items, selected, onToggle }: {
  items: string[]; selected: string[]; onToggle: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <button
          key={item}
          type="button"
          onClick={() => onToggle(item)}
          aria-pressed={selected.includes(item)}
          className={`px-3.5 py-2 rounded-full border text-sm transition-colors ${
            selected.includes(item)
              ? 'bg-teal-600 text-white border-teal-600 font-semibold'
              : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  )
}
