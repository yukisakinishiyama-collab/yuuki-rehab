'use client'
// ──────────────────────────────────────────────
// Web問診の受信箱（院内画面）
//
// 患者さんが来院前に送った問診を一覧し、カルテへ取り込む。
// 取り込み先の患者は施術者が選ぶ（氏名・電話の一致は候補の提示までに留める）。
// 危険兆候に当てはまる問診は先頭で目立たせる。
// ──────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Intake, Patient } from '@/types/patient'
import { WARNING_SIGN_MAP, type StoredMonshin } from '@/lib/monshin'
import { getPatients, saveIntake, savePatient } from '@/lib/patient-store'
import { Card, CardContent, CardHeader, SectionTitle } from './shared'
import { Inbox, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

const SYNC_SECRET = process.env.NEXT_PUBLIC_SYNC_SECRET ?? ''

/** 問診の回答をカルテの初回問診（Intake）へ移し替える */
function toIntake(item: StoredMonshin, patientId: string): Intake {
  const s = item.submission
  const flagNotes = item.redFlag.matchedIds
    .map(id => WARNING_SIGN_MAP[id]?.label ?? id)
    .map(label => `※ ${label}`)
  const notes = [
    'Web問診（患者さん入力）',
    s.note ? `本人からの伝言: ${s.note}` : '',
    ...flagNotes,
  ].filter(Boolean).join('\n')

  return {
    id: nanoid(),
    patientId,
    intakeDate: item.submittedAt.slice(0, 10),
    isNewInjury: s.visitType === 'new_injury',
    chiefComplaint: s.chiefComplaint,
    injuryDate: s.injuryDate,
    injuryMechanism: s.injuryMechanism,
    // 既存の型のフィールド名をそのまま使う
    firstTimeSymptoм: s.isFirstTime,
    previousSameInjury: !s.isFirstTime,
    previousTreatment: s.previousTreatment,
    painLocations: s.painLocations,
    jointDetailLocations: {},
    painNrs: s.painNrs,
    painCharacter: s.painCharacter,
    painTiming: s.painTiming,
    worseFactor: s.worseFactor,
    betterFactor: s.betterFactor,
    adlDifficulty: s.adlDifficulty,
    occupation: s.occupation,
    sportsActivity: s.sportsActivity,
    importantGoal: s.importantGoal,
    pastMedicalHistory: s.pastMedicalHistory,
    currentMedications: s.currentMedications,
    imagingResults: '',
    suspectedDiagnosis: '',
    therapistNotes: notes,
    createdAt: new Date().toISOString(),
  }
}

/** 氏名または電話が一致する患者を候補として出す（自動では紐づけない） */
function findCandidates(item: StoredMonshin, patients: Patient[]): Patient[] {
  const s = item.submission
  const digits = (v: string) => v.replace(/[^0-9]/g, '')
  const phone = digits(s.phone)
  return patients.filter(p =>
    (phone.length >= 8 && digits(p.phone) === phone) ||
    (s.name && p.name.replace(/\s/g, '') === s.name.replace(/\s/g, '')))
}

export default function MonshinInboxCard() {
  const [items, setItems] = useState<StoredMonshin[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!SYNC_SECRET) {
      setError('クラウド同期の設定が無いため、Web問診を取得できません')
      return
    }
    setLoading(true)
    setError('')
    try {
      setPatients(getPatients())
      const res = await fetch('/api/monshin', { headers: { 'x-sync-secret': SYNC_SECRET } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '取得に失敗しました')
      setItems(data.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 初回に一度だけ取得する（読み込み中表示のため load 内で setState する）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function remove(id: string) {
    await fetch(`/api/monshin?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-sync-secret': SYNC_SECRET },
    })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  /** 既存の患者へ取り込む */
  async function importTo(item: StoredMonshin, patientId: string) {
    setBusyId(item.id)
    try {
      saveIntake(toIntake(item, patientId))
      await remove(item.id)
    } finally {
      setBusyId(null)
    }
  }

  /** 新しい患者を作って取り込む（新患用） */
  async function importAsNew(item: StoredMonshin) {
    setBusyId(item.id)
    try {
      const s = item.submission
      const now = new Date().toISOString()
      const patient: Patient = {
        id: nanoid(),
        name: s.name,
        kana: s.kana,
        birthDate: s.birthDate,
        gender: 'other',
        phone: s.phone,
        emergencyContact: '',
        mainComplaint: s.chiefComplaint,
        bodyRegion: 'other',
        diagnosisLabel: '',
        onsetDate: s.injuryDate,
        firstVisitDate: s.appointmentDate || now.slice(0, 10),
        status: 'active',
        therapistNotes: '',
        createdAt: now,
        updatedAt: now,
      }
      savePatient(patient)
      setPatients(getPatients())
      saveIntake(toIntake(item, patient.id))
      await remove(item.id)
    } finally {
      setBusyId(null)
    }
  }

  if (!loading && items.length === 0 && !error) return null

  return (
    <Card>
      <CardHeader>
        <SectionTitle>
          <Inbox className="w-4 h-4 text-teal-600" />
          <span>Web問診（{items.length}件）</span>
          <button
            type="button"
            onClick={() => void load()}
            className="ml-auto text-xs font-normal text-gray-400 hover:text-gray-600"
          >
            再読み込み
          </button>
        </SectionTitle>
        <p className="text-xs text-gray-400 mt-1">
          患者さんが来院前に送った問診です。カルテへ取り込むと、この一覧から消えます。
        </p>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-red-600 py-2">{error}</p>}
        {loading && <p className="text-sm text-gray-400 py-2">読み込んでいます…</p>}

        <ul className="divide-y divide-gray-100">
          {items.map(item => {
            const s = item.submission
            const candidates = findCandidates(item, patients)
            const open = openId === item.id
            return (
              <li key={item.id} className="py-3">
                <div className="flex items-start gap-3">
                  {item.redFlag.level && (
                    <AlertTriangle
                      className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        item.redFlag.level === 'urgent' ? 'text-red-600' : 'text-amber-500'
                      }`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{s.name}</span>
                      <span className="text-xs text-gray-400">{s.phone}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-50
                        text-slate-500 border-slate-200">
                        {s.visitType === 'new_injury' ? '新しいけが' : '新患'}
                      </span>
                      {item.redFlag.level === 'urgent' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-red-50
                          text-red-700 border-red-200">要確認</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {s.chiefComplaint}（痛み {s.painNrs}/10）
                      {s.appointmentDate && <span className="ml-2">予約 {s.appointmentDate}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : item.id)}
                    className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-700
                      border border-gray-200 rounded-md px-2 py-1 flex items-center gap-1"
                  >
                    {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    詳細
                  </button>
                </div>

                {open && (
                  <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 space-y-1.5">
                    {item.redFlag.matchedIds.length > 0 && (
                      <p className="text-xs text-red-700">
                        当てはまった項目：
                        {item.redFlag.matchedIds.map(id => WARNING_SIGN_MAP[id]?.label ?? id).join('／')}
                      </p>
                    )}
                    <Detail label="いつから" value={s.injuryDate} />
                    <Detail label="きっかけ" value={s.injuryMechanism} />
                    <Detail label="痛む場所" value={s.painLocations.join('、')} />
                    <Detail label="痛みの感じ" value={s.painCharacter.join('、')} />
                    <Detail label="痛むとき" value={s.painTiming.join('、')} />
                    <Detail label="強くなる動作" value={s.worseFactor} />
                    <Detail label="楽になること" value={s.betterFactor} />
                    <Detail label="困っている動作" value={s.adlDifficulty.join('、')} />
                    <Detail label="お仕事" value={s.occupation} />
                    <Detail label="スポーツ" value={s.sportsActivity} />
                    <Detail label="取り戻したいこと" value={s.importantGoal} />
                    <Detail label="既往" value={s.pastMedicalHistory} />
                    <Detail label="お薬" value={s.currentMedications} />
                    <Detail label="これまでの治療" value={s.previousTreatment} />
                    <Detail label="伝言" value={s.note} />
                  </div>
                )}

                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {candidates.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void importTo(item, p.id)}
                      className="text-[11px] font-semibold text-white bg-teal-600 hover:bg-teal-700
                        rounded-full px-3 py-1.5 disabled:opacity-50 transition-colors"
                    >
                      {p.name} のカルテへ取り込む
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void importAsNew(item)}
                    className="text-[11px] font-semibold text-teal-700 bg-white border border-teal-300
                      hover:bg-teal-50 rounded-full px-3 py-1.5 disabled:opacity-50 transition-colors"
                  >
                    新規患者として登録して取り込む
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => {
                      if (confirm(`${s.name} さんの問診を削除しますか？\n取り込まずに消えます。`)) void remove(item.id)
                    }}
                    className="text-[11px] text-gray-400 hover:text-red-600 px-2 py-1.5 transition-colors"
                  >
                    削除
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <p className="text-xs text-gray-600">
      <span className="text-gray-400">{label}：</span>{value}
    </p>
  )
}
