'use client'
/**
 * カルテの「契約・同意書」タブ
 *
 * 1. 書類をえらぶ（6種類。署名済みのものには日付が出る）
 * 2. 文面をいっしょに読み、□ をタップ・空欄に記入
 * 3. 患者さん（未成年なら保護者も）と担当者が指で署名 →「署名して完了する」
 *    → 署名入りの本文をクラウドに保存（あとから変えない）、一覧（pt_contracts）に1行
 * 4. 「印刷する」で院保管用と患者様控えの2部（控えだけ・白紙も印刷できる）
 * 会員プランの書類（入会・休会・解約）に署名すると、会員の状態と日付（最低利用期間・契約終了日）が自動で変わる。
 */
import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import { CheckCircle2, ChevronLeft, FileSignature, Printer } from 'lucide-react'
import type { Patient } from '@/types/patient'
import type { ContractRecord, MemberStatus } from '@/types/contracts'
import { CONTRACT_TEMPLATES, type ContractTemplate } from '@/data/contract-templates'
import { parseTemplate, renderTemplateHtml, escapeHtml, jaDate } from '@/lib/contracts/template'
import {
  addMonthsYm,
  buildMemberEvent,
  cancelEndOf,
  jstToday,
  MEMBER_FEES,
  MEMBER_PLANS,
  memberEventHtml,
  memberStatusOf,
  minEndOf,
  type MemberInput,
} from '@/lib/contracts/member'
import { printPages, printSigned, signatureBlockHtml, copyPage } from '@/lib/contracts/print'
import { addContract, voidContract } from '@/lib/contracts/store'
import { fingerprint } from '@/lib/sync-merge'
import ContractDocument from './ContractDocument'
import SignaturePad from './SignaturePad'

const STAFF_NAME_KEY = 'contractStaffName'

function ageOf(birthDate: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  let age = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4))
  if (today.slice(5) < birthDate.slice(5)) age -= 1
  return age
}

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  if (status.state === 'none') return null
  const style: Record<string, string> = {
    active: 'border-teal-200 bg-teal-50 text-teal-800',
    upcoming: 'border-sky-200 bg-sky-50 text-sky-800',
    paused: 'border-amber-200 bg-amber-50 text-amber-800',
    ending: 'border-orange-200 bg-orange-50 text-orange-800',
    ended: 'border-slate-200 bg-slate-50 text-slate-600',
  }
  const extra =
    status.state === 'ending' && status.end
      ? `（${jaDate(status.end)}まで）`
      : status.state === 'paused' && status.resumeMonth
        ? `（${Number(status.resumeMonth.slice(5))}月に再開予定）`
        : status.state === 'upcoming' && status.start
          ? `（${jaDate(status.start)}から）`
          : ''
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${style[status.state]}`}>
      {status.label}
      {status.plan && status.state !== 'ended' ? `・${status.plan}` : ''}
      {extra}
    </span>
  )
}

type View = { kind: 'list' } | { kind: 'doc'; tpl: ContractTemplate } | { kind: 'done'; record: ContractRecord; html: string }

export default function ContractsTab({
  patient,
  contracts,
  onUpdate,
}: {
  patient: Patient
  contracts: ContractRecord[]
  onUpdate: () => void
}) {
  const today = jstToday()
  const [view, setView] = useState<View>({ kind: 'list' })
  const status = useMemo(() => memberStatusOf(contracts, today), [contracts, today])
  const active = contracts.filter((c) => !c.voided)
  const lastSigned = (id: string) => active.find((c) => c.docId === id)

  if (view.kind === 'doc') {
    return (
      <SignFlow
        key={view.tpl.id}
        tpl={view.tpl}
        patient={patient}
        contracts={contracts}
        status={status}
        today={today}
        onBack={() => setView({ kind: 'list' })}
        onDone={(record, html) => {
          onUpdate()
          setView({ kind: 'done', record, html })
        }}
      />
    )
  }

  if (view.kind === 'done') {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-teal-200 bg-white p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-teal-700" aria-hidden />
        <p className="mt-2 text-lg font-black text-slate-900">署名が完了しました</p>
        <p className="mt-1 text-sm text-slate-600">
          {view.record.title}・{jaDate(view.record.signedDate)}（記録ID {view.record.id}）
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => printSigned(view.html, view.record.id, 'both')}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 font-bold text-white hover:bg-teal-800"
          >
            <Printer className="h-4 w-4" aria-hidden />
            印刷する（院保管用＋患者様控え）
          </button>
          <button
            type="button"
            onClick={() => printSigned(view.html, view.record.id, 'patient')}
            className="min-h-11 rounded-xl border border-slate-300 px-4 font-medium text-slate-700 hover:bg-slate-50"
          >
            患者様控えだけ印刷
          </button>
          <button
            type="button"
            onClick={() => setView({ kind: 'list' })}
            className="min-h-11 rounded-xl border border-slate-300 px-4 font-medium text-slate-700 hover:bg-slate-50"
          >
            書類の一覧へ
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">印刷の画面で「PDFに保存」を選ぶと、PDFでも残せます。</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 会員の状態 */}
      {status.state !== 'none' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-700">会員プラン</h3>
            <MemberStatusBadge status={status} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">種別</dt>
              <dd className="font-bold text-slate-800">{status.plan ? `${status.plan}（${MEMBER_FEES[status.plan]}）` : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">利用開始日</dt>
              <dd className="font-bold text-slate-800">{status.start ? jaDate(status.start) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">最低利用期間の満了</dt>
              <dd className="font-bold text-slate-800">
                {status.minEnd ? jaDate(status.minEnd) : '—'}
                {status.pausedMonths > 0 && <span className="ml-1 text-xs font-normal text-slate-500">（休会{status.pausedMonths}か月分を延長）</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">契約終了日</dt>
              <dd className="font-bold text-slate-800">{status.end ? jaDate(status.end) : '自動更新'}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* 書類をえらぶ */}
      <section>
        <h3 className="mb-2 text-sm font-bold text-slate-700">書類をえらぶ</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {CONTRACT_TEMPLATES.map((tpl) => {
            const signed = lastSigned(tpl.id)
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setView({ kind: 'doc', tpl })}
                className="flex min-h-11 flex-col items-start gap-1 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40"
              >
                <span className="flex items-center gap-2 font-bold text-slate-900">
                  <FileSignature className="h-4 w-4 shrink-0 text-teal-700" aria-hidden />
                  {tpl.title}
                </span>
                <span className="text-xs text-slate-600">{tpl.summary}</span>
                {signed && (
                  <span className="mt-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-800">
                    ✓ 署名済み {jaDate(signed.signedDate)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* 署名済みの書類 */}
      <section>
        <h3 className="mb-2 text-sm font-bold text-slate-700">この患者さんの署名済み書類</h3>
        {contracts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">まだ署名済みの書類はありません。</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {contracts.map((c) => (
              <SignedRow key={c.id} record={c} onUpdate={onUpdate} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SignedRow({ record, onUpdate }: { record: ContractRecord; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')

  async function print(copies: 'both' | 'patient') {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/karte/contracts?id=${encodeURIComponent(record.id)}`, { cache: 'no-store' })
      const body = (await res.json().catch(() => ({}))) as { snapshot?: { html: string }; error?: string }
      if (!res.ok || !body.snapshot) throw new Error(body.error ?? '署名済みの本文を読めませんでした')
      printSigned(body.snapshot.html, record.id, copies)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`p-3 ${record.voided ? 'bg-slate-50 opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-slate-900">
            {record.title}
            {record.voided && <span className="ml-2 rounded bg-slate-200 px-1.5 text-xs font-medium text-slate-700">取り消し済み</span>}
          </p>
          <p className="text-xs text-slate-600">
            {jaDate(record.signedDate)}・{record.staffLabel} {record.staffName}
            {record.guardianName ? `・保護者 ${record.guardianName}` : ''}・記録ID {record.id}
          </p>
          {record.voided && <p className="text-xs text-slate-600">取り消しの理由：{record.voided.reason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => print('both')}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60"
          >
            <Printer className="h-4 w-4" aria-hidden />
            印刷（院保管用＋控え）
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => print('patient')}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            控えだけ
          </button>
          {!record.voided && (
            <button
              type="button"
              onClick={() => setVoiding((v) => !v)}
              className="min-h-10 rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-100"
            >
              取り消す
            </button>
          )}
        </div>
      </div>
      {voiding && !record.voided && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="取り消す理由（例：書き間違いのため書き直し）"
            className="min-h-10 flex-1 rounded-md border border-slate-300 px-2 text-sm"
          />
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => {
              voidContract(record.id, reason.trim())
              setVoiding(false)
              onUpdate()
            }}
            className="min-h-10 rounded-lg bg-orange-700 px-3 text-sm font-bold text-white disabled:opacity-50"
          >
            取り消す（記録は残ります）
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  )
}

function SignFlow({
  tpl,
  patient,
  contracts,
  status,
  today,
  onBack,
  onDone,
}: {
  tpl: ContractTemplate
  patient: Patient
  contracts: ContractRecord[]
  status: MemberStatus
  today: string
  onBack: () => void
  onDone: (record: ContractRecord, html: string) => void
}) {
  const parsed = useMemo(() => parseTemplate(tpl.body), [tpl.body])
  const [checks, setChecks] = useState<boolean[]>(() => Array(parsed.checkCount).fill(false))
  const [inputs, setInputs] = useState<string[]>(() => Array(parsed.blankCount).fill(''))
  const age = ageOf(patient.birthDate, today)
  const [patientName, setPatientName] = useState(patient.name)
  const [minor, setMinor] = useState(age !== null && age < 18)
  const [guardianName, setGuardianName] = useState('')
  const [relation, setRelation] = useState('')
  const [staffName, setStaffName] = useState(() => {
    try {
      return localStorage.getItem(STAFF_NAME_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [sigPatient, setSigPatient] = useState<string | null>(null)
  const [sigGuardian, setSigGuardian] = useState<string | null>(null)
  const [sigStaff, setSigStaff] = useState<string | null>(null)
  const [member, setMember] = useState<MemberInput>(() => ({
    plan: '一般会員',
    start: today,
    pauseFrom: today.slice(0, 7),
    pauseMonths: 1,
    special: false,
    specialReason: '',
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const memberCheck = tpl.member ? buildMemberEvent(tpl.member, member, contracts, today) : null
  const ready =
    patientName.trim() && staffName.trim() && sigPatient && sigStaff && (!minor || (guardianName.trim() && sigGuardian)) && (!memberCheck || memberCheck.ok)

  function printBlank() {
    const html =
      renderTemplateHtml(parsed, null, null) +
      signatureBlockHtml({ date: today, patientName: '', staffLabel: tpl.staffLabel, staffName: '' }, true)
    printPages([copyPage(html, '', `${tpl.title}（版 ${tpl.version}）`)])
  }

  async function sign() {
    setError('')
    if (!ready) {
      setError('署名とお名前がそろっているか確かめてください。')
      return
    }
    if (memberCheck && !memberCheck.ok) {
      setError(memberCheck.error)
      return
    }
    setSaving(true)
    const now = new Date()
    const id = `c${now.getTime().toString(36)}${nanoid(6)}`
    const record: ContractRecord = {
      id,
      patientId: patient.id,
      docId: tpl.id,
      title: tpl.title,
      version: tpl.version,
      bodyHash: fingerprint(tpl.body),
      signedAt: now.toISOString(),
      signedDate: today,
      patientName: patientName.trim(),
      guardianName: minor ? guardianName.trim() : undefined,
      relation: minor && relation.trim() ? relation.trim() : undefined,
      staffLabel: tpl.staffLabel,
      staffName: staffName.trim(),
      checked: checks.filter(Boolean).length,
      written: inputs.filter((v) => v.trim()).length,
      member: memberCheck && memberCheck.ok ? memberCheck.event : undefined,
    }
    const html =
      renderTemplateHtml(parsed, checks, inputs) +
      (record.member ? memberEventHtml(record.member, status) : '') +
      signatureBlockHtml({
        date: today,
        patientName: record.patientName,
        guardianName: record.guardianName,
        relation: record.relation,
        staffLabel: tpl.staffLabel,
        staffName: record.staffName,
        sigPatient,
        sigGuardian: minor ? sigGuardian : null,
        sigStaff,
      }) +
      `<p class="meta">記録ID ${escapeHtml(id)}／署名日時 ${escapeHtml(now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }))}／書類の版 ${escapeHtml(tpl.version)}／本文の指紋 ${escapeHtml(record.bodyHash)}</p>`
    try {
      const res = await fetch('/api/karte/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record, html }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? '保存できませんでした')
      addContract(record)
      try {
        localStorage.setItem(STAFF_NAME_KEY, record.staffName)
      } catch {
        // 端末の担当者名を覚えられないだけ
      }
      onDone(record, html)
    } catch (e) {
      setError(`クラウドに保存できませんでした。通信を確かめて、もう一度「署名して完了する」を押してください（${e instanceof Error ? e.message : String(e)}）`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          書類の一覧
        </button>
        <button
          type="button"
          onClick={printBlank}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Printer className="h-4 w-4" aria-hidden />
          白紙を印刷
        </button>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <ContractDocument
          parsed={parsed}
          checks={checks}
          inputs={inputs}
          onCheck={(i, v) => setChecks((prev) => prev.map((x, k) => (k === i ? v : x)))}
          onInput={(i, v) => setInputs((prev) => prev.map((x, k) => (k === i ? v : x)))}
        />
      </article>

      {tpl.member && (
        <MemberForm kind={tpl.member} member={member} setMember={setMember} status={status} today={today} check={memberCheck} />
      )}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="text-base font-bold text-slate-900">署名欄（{jaDate(today)}）</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-bold text-slate-700">患者様氏名</span>
            <input value={patientName} onChange={(e) => setPatientName(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
          </label>
          <label className="flex items-center gap-2 self-end text-sm max-lg:min-h-10">
            <input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} className="h-6 w-6 accent-teal-700" />
            <span className="font-bold text-slate-700">未成年（保護者も署名）</span>
            {age !== null && <span className="text-xs text-slate-500">（{age}歳）</span>}
          </label>
        </div>
        <SignaturePad label="患者様の署名" onChange={setSigPatient} />
        {minor && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-bold text-slate-700">保護者氏名</span>
                <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
              </label>
              <label className="block text-sm">
                <span className="font-bold text-slate-700">続柄</span>
                <input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="母・父 など" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
              </label>
            </div>
            <SignaturePad label="保護者の署名" onChange={setSigGuardian} />
          </>
        )}
        <label className="block text-sm sm:w-1/2">
          <span className="font-bold text-slate-700">{tpl.staffLabel}（氏名）</span>
          <input value={staffName} onChange={(e) => setStaffName(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
        </label>
        <SignaturePad label={`${tpl.staffLabel}の署名`} onChange={setSigStaff} />

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button
          type="button"
          onClick={sign}
          disabled={saving || !ready}
          className="min-h-14 w-full rounded-xl bg-teal-700 text-lg font-bold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? '保存しています…' : '署名して完了する'}
        </button>
        {!ready && !saving && (
          <p className="text-center text-xs text-slate-500">
            {memberCheck && !memberCheck.ok ? memberCheck.error : 'お名前と署名（患者様・担当者。未成年なら保護者も）がそろうと押せます'}
          </p>
        )}
      </section>
    </div>
  )
}

function MemberForm({
  kind,
  member,
  setMember,
  status,
  today,
  check,
}: {
  kind: 'join' | 'pause' | 'cancel'
  member: MemberInput
  setMember: (fn: (m: MemberInput) => MemberInput) => void
  status: MemberStatus
  today: string
  check: ReturnType<typeof buildMemberEvent> | null
}) {
  const set = (patch: Partial<MemberInput>) => setMember((m) => ({ ...m, ...patch }))
  const cancelEnd = cancelEndOf(today)
  const early = status.minEnd ? cancelEnd < status.minEnd : false
  return (
    <section className="space-y-3 rounded-2xl border-2 border-teal-200 bg-teal-50/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-slate-900">
          {kind === 'join' ? '会員プランの入会' : kind === 'pause' ? '会員プランの休会' : '会員プランの解約'}（院の記録）
        </h3>
        <MemberStatusBadge status={status} />
      </div>

      {kind === 'join' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset>
            <legend className="text-sm font-bold text-slate-700">会員の種別</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {MEMBER_PLANS.map((p) => (
                <label key={p} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 max-lg:min-h-10 ${member.plan === p ? 'border-teal-600 bg-white font-bold' : 'border-slate-300 bg-white'}`}>
                  <input type="radio" name="plan" checked={member.plan === p} onChange={() => set({ plan: p })} className="accent-teal-700" />
                  {p}（{MEMBER_FEES[p]}）
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm">
            <span className="font-bold text-slate-700">利用開始日（最初の決済日）</span>
            <input type="date" value={member.start ?? ''} onChange={(e) => set({ start: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3" />
          </label>
          {member.start && /^\d{4}-\d{2}-\d{2}$/.test(member.start) && (
            <p className="text-sm text-slate-700 sm:col-span-2">
              最低利用期間の満了日：<b>{jaDate(minEndOf(member.start))}</b>（以後は1か月ごとの自動更新）
            </p>
          )}
        </div>
      )}

      {kind === 'pause' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-bold text-slate-700">休会の開始月（月初めから）</span>
            <input type="month" value={member.pauseFrom ?? ''} onChange={(e) => set({ pauseFrom: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3" />
          </label>
          <label className="block text-sm">
            <span className="font-bold text-slate-700">休会の月数</span>
            <select value={member.pauseMonths ?? 1} onChange={(e) => set({ pauseMonths: Number(e.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}か月
                </option>
              ))}
            </select>
          </label>
          {member.pauseFrom && /^\d{4}-\d{2}$/.test(member.pauseFrom) && (
            <p className="text-sm text-slate-700 sm:col-span-2">
              再開予定月：<b>{Number(addMonthsYm(member.pauseFrom, member.pauseMonths ?? 1).slice(0, 4))}年{Number(addMonthsYm(member.pauseFrom, member.pauseMonths ?? 1).slice(5))}月</b>
              {status.start && (
                <>
                  ・最低利用期間の満了日は <b>{jaDate(minEndOf(status.start, status.pausedMonths + (member.pauseMonths ?? 1)))}</b> にずれます
                </>
              )}
            </p>
          )}
        </div>
      )}

      {kind === 'cancel' && (
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            今日（{jaDate(today)}）の提出のため、契約終了日は <b>{jaDate(cancelEnd)}</b>
            （{Number(today.slice(8)) <= 15 ? '15日までの提出なので当月末' : '16日以降の提出なので翌月末'}）です。
          </p>
          {status.minEnd && (
            <p>
              最低利用期間の満了日：<b>{jaDate(status.minEnd)}</b>
              {early ? '（まだ途中です）' : '（満了しています）'}
            </p>
          )}
          {early && (
            <div className="space-y-2 rounded-lg bg-white p-3">
              <label className="flex items-center gap-2 max-lg:min-h-10">
                <input type="checkbox" checked={Boolean(member.special)} onChange={(e) => set({ special: e.target.checked })} className="h-6 w-6 accent-teal-700" />
                <span className="font-bold">特別な事情あり（入院・転居・災害・医師による運動制限など）</span>
              </label>
              {member.special && (
                <input
                  value={member.specialReason ?? ''}
                  onChange={(e) => set({ specialReason: e.target.value })}
                  placeholder="特別な事情の内容"
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
                />
              )}
            </div>
          )}
        </div>
      )}

      {check && !check.ok && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">{check.error}</p>}
    </section>
  )
}
