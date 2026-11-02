'use client'
// ──────────────────────────────────────────────
// カルテの上の「患者さんの目標・希望」（2026-11-02 院長の依頼「目標や希望をカルテに見えるように記入できるように」）
//
// どのタブを開いていても見える場所に、患者さんの目標（本人の言葉のまま）・目標の時期・希望や配慮してほしいことを出す。
// その場で書ける・直せる。保存先は概要の「目標と課題」と同じ（pt_goals。クラウドへの控えも同じ）。
// 前回のSOAPの「今日の希望・目標」があれば、その日付といっしょに出す。
// ──────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { Pencil, Target } from 'lucide-react'
import type { Patient, PatientGoals, SOAPNote } from '@/types/patient'
import { getPatientGoals, updatePatientGoals, GOALS_CHANGED_EVENT } from '@/lib/clinical-goals-store'
import VoiceInputButton from '@/components/rehab/VoiceInputButton'
import { Input, Textarea } from './shared'

interface Props {
  patient: Patient
  /** いちばん新しいSOAP（「今日の希望・目標」を出す） */
  latestSoap?: SOAPNote
}

interface Draft {
  patientGoal: string
  targetNote: string
  patientWishes: string
}

const toDraft = (g: PatientGoals | undefined): Draft => ({
  patientGoal: g?.patientGoal ?? '',
  targetNote: g?.targetNote ?? '',
  patientWishes: g?.patientWishes ?? '',
})

/** 音声で入れた言葉を、いまの文の後ろに足す */
const append = (prev: string, text: string, sep = ' ') => (prev.trim() ? `${prev}${prev.endsWith('\n') ? '' : sep}${text}` : text)

/** 'YYYY-MM-DD' → 'M/D' */
const shortDate = (d: string) => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(d)
  return m ? `${Number(m[1])}/${Number(m[2])}` : d
}

export default function PatientGoalsBanner({ patient, latestSoap }: Props) {
  const [saved, setSaved] = useState<Draft>(() => toDraft(getPatientGoals(patient.id)))
  const [draft, setDraft] = useState<Draft | null>(null)

  // 概要の「目標と課題」で直したとき・ほかのタブで保存したときも、ここを新しくする
  useEffect(() => {
    function onChanged(e: Event) {
      if ((e as CustomEvent<{ patientId: string }>).detail?.patientId !== patient.id) return
      setSaved(toDraft(getPatientGoals(patient.id)))
    }
    function onStorage(e: StorageEvent) {
      if (e.key === 'pt_goals') setSaved(toDraft(getPatientGoals(patient.id)))
    }
    window.addEventListener(GOALS_CHANGED_EVENT, onChanged)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(GOALS_CHANGED_EVENT, onChanged)
      window.removeEventListener('storage', onStorage)
    }
  }, [patient.id])

  const lastWish = latestSoap?.patientGoalToday?.trim()
  const hasAny = Boolean(saved.patientGoal.trim() || saved.targetNote.trim() || saved.patientWishes.trim())

  function save() {
    if (!draft) return
    const next = {
      patientGoal: draft.patientGoal.trim(),
      targetNote: draft.targetNote.trim(),
      patientWishes: draft.patientWishes.trim(),
    }
    updatePatientGoals(patient.id, next)
    setSaved(next)
    setDraft(null)
  }

  // ── 書く・直す ──
  if (draft) {
    return (
      <section className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3 sm:p-4" aria-label="患者さんの目標・希望を書く">
        <h2 className="flex items-center gap-1.5 text-sm font-black text-amber-900">
          <Target className="h-4 w-4" aria-hidden />
          患者さんの目標・希望
        </h2>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-amber-900">目標（患者さんの言葉のまま）</label>
            <VoiceInputButton size="sm" onText={t => setDraft(d => (d ? { ...d, patientGoal: append(d.patientGoal, t) } : d))} />
          </div>
          <Textarea
            value={draft.patientGoal}
            onChange={v => setDraft(d => (d ? { ...d, patientGoal: v } : d))}
            placeholder="例：サッカーの試合に最後まで出たい／孫と旅行に行きたい／正座ができるようになりたい"
            rows={2}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-amber-900">目標の時期（任意）</label>
          <Input
            value={draft.targetNote}
            onChange={v => setDraft(d => (d ? { ...d, targetNote: v } : d))}
            placeholder="例：12月の県大会まで／年内に"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-amber-900">希望・配慮してほしいこと（任意）</label>
            <VoiceInputButton size="sm" onText={t => setDraft(d => (d ? { ...d, patientWishes: append(d.patientWishes, t, '\n') } : d))} />
          </div>
          <Textarea
            value={draft.patientWishes}
            onChange={v => setDraft(d => (d ? { ...d, patientWishes: v } : d))}
            placeholder="例：強い刺激は苦手／土曜の午前に通いたい／テーピングでかぶれやすい"
            rows={2}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 max-lg:min-h-10"
          >
            やめる
          </button>
          <button
            type="button"
            onClick={save}
            className="h-9 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 max-lg:min-h-10"
          >
            保存
          </button>
        </div>
      </section>
    )
  }

  // ── まだ書いていない ──
  if (!hasAny) {
    return (
      <section className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3" aria-label="患者さんの目標・希望">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
            <Target className="h-4 w-4" aria-hidden />
            目標・希望はまだありません
          </p>
          <button
            type="button"
            onClick={() => setDraft(toDraft(getPatientGoals(patient.id)))}
            className="h-9 rounded-lg bg-amber-700 px-3.5 text-sm font-bold text-white hover:bg-amber-800 max-lg:min-h-10"
          >
            目標・希望を書く
          </button>
        </div>
        {lastWish && (
          <p className="mt-2 text-xs text-slate-700">
            <span className="font-bold text-amber-900">前回のSOAP（{shortDate(latestSoap?.visitDate ?? '')}）の「今日の希望・目標」：</span>
            {lastWish}
          </p>
        )}
      </section>
    )
  }

  // ── 書いてある内容を見せる ──
  return (
    <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 sm:p-4" aria-label="患者さんの目標・希望">
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-black text-amber-900">
          <Target className="h-4 w-4" aria-hidden />
          患者さんの目標・希望
        </h2>
        <button
          type="button"
          onClick={() => setDraft(toDraft(getPatientGoals(patient.id)))}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100 max-lg:min-h-10"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          直す
        </button>
      </div>
      <dl className="mt-2 space-y-2">
        {saved.patientGoal.trim() && (
          <div>
            <dt className="text-xs font-bold text-amber-900">目標</dt>
            <dd className="whitespace-pre-wrap text-base font-bold leading-snug text-slate-900">「{saved.patientGoal.trim()}」</dd>
          </div>
        )}
        {saved.targetNote.trim() && (
          <div className="flex flex-wrap items-baseline gap-x-2">
            <dt className="text-xs font-bold text-amber-900">目標の時期</dt>
            <dd className="text-sm font-bold text-slate-900">{saved.targetNote.trim()}</dd>
          </div>
        )}
        {saved.patientWishes.trim() && (
          <div>
            <dt className="text-xs font-bold text-amber-900">希望・配慮してほしいこと</dt>
            <dd className="whitespace-pre-wrap text-sm text-slate-900">{saved.patientWishes.trim()}</dd>
          </div>
        )}
        {lastWish && (
          <div>
            <dt className="text-xs font-bold text-amber-900">前回のSOAP（{shortDate(latestSoap?.visitDate ?? '')}）の「今日の希望・目標」</dt>
            <dd className="text-sm text-slate-800">{lastWish}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}
