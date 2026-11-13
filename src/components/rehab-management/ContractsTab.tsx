'use client'
/**
 * カルテの「契約・同意書」タブ
 *
 * 1. 書類をえらぶ（6種類。署名済みのものには日付が出る）
 * 2. 文面をいっしょに読み、□ をタップ（チェックは患者様ご自身で）。記入欄は、署名のほかはカルテ・今日の日付・
 *    会員の手続きの欄から自動で入る（緑の欄。lib/contracts/autofill.ts）
 * 3. 患者さん（未成年なら保護者も）と担当者が指で署名 →「署名して完了する」
 *    （まだのものがあれば、ボタンの上に「あと○つ」を出し、押すとそこへ飛ぶ。2026-11-11「登録できない」の見直し）
 *    → 署名入りの本文をクラウドに保存（あとから変えない）、一覧（pt_contracts）に1行
 * 4. 「印刷する」で院保管用と患者様控えの2部（控えだけ・白紙も印刷できる）。署名済みの書類は「内容を見る・印刷する」で、
 *    アプリの画面でも中身（署名入り）を確かめられる
 * 会員プランの書類（入会・休会・解約）は、いちばん上に「ご契約内容」の枠（だれが・どのプランを・いくらで・いつから＋直筆の署名）が入る。
 * 院保管用にも患者様控えにも同じものが出る（lib/contracts/summary.ts。2026-11-13 院長の依頼）。
 * 会員プランの書類（入会・休会・解約）に署名すると、会員の状態と日付（最低利用期間・契約終了日）が自動で変わる。
 * 兄弟・親子プラン（2名まで）は契約者（代表）のカルテで手続きし、もう1名の方のカルテにも会員の状態が出る。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { nanoid } from 'nanoid'
import { CheckCircle2, ChevronLeft, CloudUpload, Eye, FileDown, FileSignature, Printer } from 'lucide-react'
import type { Patient } from '@/types/patient'
import type { ContractRecord, MemberStatus } from '@/types/contracts'
import { CONTRACT_TEMPLATES, type ContractTemplate } from '@/data/contract-templates'
import { CONTRACT_PRINT_CSS, parseTemplate, renderTemplateHtml, escapeHtml, jaDate } from '@/lib/contracts/template'
import { contractSummaryHtml, insertSummary, isSafeContractHtml, memberLineOf, withContractSummary } from '@/lib/contracts/summary'
import { autofillContract, describeTemplate, effectiveInputs, pauseMonthsOfCheck, planOfCheck } from '@/lib/contracts/autofill'
import { CLINIC_STAFF } from '@/data/clinic-staff'
import { dropPending, getPendingContracts, keepPending, sendContract, sendErrorText, type PendingContract } from '@/lib/contracts/send'
import { buildContractPdfFile, isStandaloneApp, shareOrOpenPdf } from '@/lib/contracts/share-pdf'
import {
  addMonthsYm,
  buildMemberEvent,
  cancelEndOf,
  jstToday,
  MEMBER_FEES,
  MEMBER_PLANS,
  memberStatusForPatient,
  memberStatusOf,
  minEndOf,
  PAIR_PLAN,
  type MemberInput,
} from '@/lib/contracts/member'
import { getPatient, getPatients } from '@/lib/patient-store'
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
      {status.via ? `（代表 ${status.via.name}さん）` : ''}
      {extra}
    </span>
  )
}

type View = { kind: 'list' } | { kind: 'doc'; tpl: ContractTemplate } | { kind: 'done'; record: ContractRecord; html: string }

export default function ContractsTab({
  patient,
  contracts,
  allContracts,
  onUpdate,
}: {
  patient: Patient
  contracts: ContractRecord[]
  /** すべての患者さんの署名済みの書類（兄弟・親子プランのもう1名の状態を出すため） */
  allContracts?: ContractRecord[]
  onUpdate: () => void
}) {
  const today = jstToday()
  const [view, setView] = useState<View>({ kind: 'list' })
  /** この方ご自身の契約からの状態（休会・解約の書類の計算に使う） */
  const ownStatus = useMemo(() => memberStatusOf(contracts, today), [contracts, today])
  /** 画面に出す状態（兄弟・親子プランのもう1名なら、代表の方の契約から） */
  const status = useMemo(() => memberStatusForPatient(patient.id, allContracts ?? contracts, today), [patient.id, allContracts, contracts, today])
  const active = contracts.filter((c) => !c.voided)
  const lastSigned = (id: string) => active.find((c) => c.docId === id)

  if (view.kind === 'doc') {
    return (
      <SignFlow
        key={view.tpl.id}
        tpl={view.tpl}
        patient={patient}
        contracts={contracts}
        status={ownStatus}
        covered={status.via ? status : undefined}
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
        <p className="mt-2 text-lg font-black text-slate-900">署名が完了しました（クラウドに保存しました）</p>
        <p className="mt-1 text-sm text-slate-600">
          {view.record.title}・{jaDate(view.record.signedDate)}（記録ID {view.record.id}）
        </p>
        <CopyActions html={view.html} record={view.record} />
        <button
          type="button"
          onClick={() => setView({ kind: 'list' })}
          className="mt-4 min-h-11 rounded-xl border border-slate-300 px-4 font-medium text-slate-700 hover:bg-slate-50"
        >
          書類の一覧へ
        </button>
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
          {status.partner && !status.via && (
            <p className="mt-3 text-sm text-slate-700">
              兄弟・親子プランのもう1名：
              {status.partner.patientId ? (
                <Link href={`/patients/${status.partner.patientId}`} className="font-bold text-teal-700 underline underline-offset-2">
                  {status.partner.name}さん
                </Link>
              ) : (
                <b>{status.partner.name}さん</b>
              )}
              {status.partner.relation ? `（${status.partner.relation}）` : ''}
              。1部位施術料は来院した方ごとにかかります。
            </p>
          )}
          {status.via && (
            <p className="mt-3 text-sm text-slate-700">
              <Link href={`/patients/${status.via.patientId}`} className="font-bold text-teal-700 underline underline-offset-2">
                {status.via.name}さん
              </Link>
              の兄弟・親子プランのもう1名として利用しています。休会・解約の届は、{status.via.name}さんのカルテで手続きします。
            </p>
          )}
        </section>
      )}

      <PendingList patientId={patient.id} onUpdate={onUpdate} />

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

  const [html, setHtml] = useState<string | null>(null)
  const memberLine = memberLineOf(record)

  /** 署名入りの本文をクラウドから読む（読んでから印刷のボタンを出す。iPad は押したその場でないと印刷の画面が出ないため） */
  async function load() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/karte/contracts?id=${encodeURIComponent(record.id)}`, { cache: 'no-store' })
      const body = (await res.json().catch(() => ({}))) as { snapshot?: { html: string }; error?: string }
      if (!res.ok || !body.snapshot) throw new Error(body.error ?? `署名済みの本文を読めませんでした（${res.status}）`)
      setHtml(body.snapshot.html)
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
          {/* 会員プランの書類は、開かなくても契約の中身が分かるように1行で出す */}
          {memberLine && <p className="mt-0.5 text-sm font-medium text-teal-800">{memberLine}</p>}
          {record.voided && <p className="text-xs text-slate-600">取り消しの理由：{record.voided.reason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!html && (
            <button
              type="button"
              disabled={busy}
              onClick={load}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60"
            >
              <Eye className="h-4 w-4" aria-hidden />
              {busy ? '読み込んでいます…' : '内容を見る・印刷する'}
            </button>
          )}
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
      {html && (
        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
          <CopyActions html={html} record={record} compact />
          <SignedDocumentView html={html} record={record} onClose={() => setHtml(null)} />
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  )
}

/** 署名済みの書類を、アプリの画面で見る（印刷と同じ中身。署名も出る） */
function SignedDocumentView({ html, record, onClose }: { html: string; record: ContractRecord; onClose: () => void }) {
  const shown = useMemo(() => withContractSummary(html, record), [html, record])
  if (!isSafeContractHtml(shown)) {
    return <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">この書類は画面に出せませんでした。「患者様控えを印刷」で確かめてください。</p>
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
        <p className="text-xs font-bold text-slate-600">署名した書類の内容（印刷と同じもの）</p>
        <button type="button" onClick={onClose} className="min-h-9 rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-100">
          閉じる
        </button>
      </div>
      <style>{CONTRACT_PRINT_CSS}</style>
      <div className="max-h-[70vh] overflow-auto p-3 sm:p-5">
        {/* 本文はアプリが作ってクラウドに保存したもの（お名前などは保存するときに文字として入れてある） */}
        <div className="contract-paper mx-auto max-w-[190mm]" dangerouslySetInnerHTML={{ __html: shown }} />
      </div>
    </div>
  )
}

/** 署名済みの書類の控えを印刷する（印刷は患者様の控えが基本。院の分はクラウドに残る） */
function CopyActions({ html: stored, record, compact = false }: { html: string; record: ContractRecord; compact?: boolean }) {
  const standalone = isStandaloneApp()
  // 前に署名した入会の書類にも、印刷のときに「ご契約内容」の枠を足す（保存した本文は書きかえない）
  const html = useMemo(() => withContractSummary(stored, record), [stored, record])
  return (
    <div className={compact ? 'space-y-2' : 'mt-5 space-y-3'}>
      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'justify-center'}`}>
        <button
          type="button"
          onClick={() => printSigned(html, record.id, 'patient')}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 font-bold text-white hover:bg-teal-800"
        >
          <Printer className="h-4 w-4" aria-hidden />
          患者様控えを印刷
        </button>
        <button
          type="button"
          onClick={() => printSigned(html, record.id, 'both')}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          院保管用も印刷（2部）
        </button>
        <PdfButton html={html} record={record} />
      </div>
      <p className={`text-xs text-slate-600 ${compact ? '' : 'text-center'}`}>
        {standalone
          ? 'ホーム画面のアイコンから開いているときは、印刷の画面が出ないことがあります。そのときは「PDFにして印刷」→ 出てきた共有の画面で「プリント」を選んでください。'
          : '印刷の画面が出ないときは「PDFにして印刷」を使ってください。'}
      </p>
    </div>
  )
}

/** 患者様控えを PDF にして、共有の画面（プリント・ファイルに保存）を出す。作る→出す の2回押し（Safari の決まりのため） */
function PdfButton({ html, record }: { html: string; record: ContractRecord }) {
  const [state, setState] = useState<'idle' | 'building' | 'ready' | 'error'>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState('')

  async function build() {
    setState('building')
    setMsg('')
    try {
      setFile(await buildContractPdfFile(html, record.id, ['患者様控え'], record.title))
      setState('ready')
    } catch (e) {
      setMsg(`PDFを作れませんでした（${e instanceof Error ? e.message : String(e)}）`)
      setState('error')
    }
  }

  async function share() {
    if (!file) return
    const r = await shareOrOpenPdf(file)
    if (r === 'opened') setMsg('PDFを開きました。開いた画面の共有ボタンから「プリント」を選んでください。')
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {state === 'ready' ? (
        <button
          type="button"
          onClick={share}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-teal-700 bg-white px-4 font-bold text-teal-800 hover:bg-teal-50"
        >
          <FileDown className="h-4 w-4" aria-hidden />
          PDFを開く（プリント・保存）
        </button>
      ) : (
        <button
          type="button"
          onClick={build}
          disabled={state === 'building'}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <FileDown className="h-4 w-4" aria-hidden />
          {state === 'building' ? 'PDFを作っています…' : 'PDFにして印刷'}
        </button>
      )}
      {msg && <span className={`text-xs ${state === 'error' ? 'text-red-700' : 'text-slate-600'}`}>{msg}</span>}
    </span>
  )
}

/** クラウドに送れなかった書類（この端末に残っているもの）。開いたときに自動で送り直す */
function PendingList({ patientId, onUpdate }: { patientId: string; onUpdate: () => void }) {
  const [items, setItems] = useState<PendingContract[]>(() => getPendingContracts(patientId))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => {
    onUpdateRef.current = onUpdate
  })

  const resend = useCallback(
    async (stage: string) => {
      const list = getPendingContracts(patientId)
      let saved = 0
      let lastError = ''
      for (const p of list) {
        const r = await sendContract(p.record, p.html, stage)
        if (r.ok) {
          try {
            addContract(p.record)
          } catch {
            // 一覧は次の同期で入る
          }
          dropPending(p.record.id)
          saved += 1
        } else {
          lastError = sendErrorText(r)
          keepPending({ ...p, error: lastError })
        }
      }
      return { saved, lastError, tried: list.length }
    },
    [patientId],
  )

  // 開いたときに、残っている分を自動で送り直す
  useEffect(() => {
    let alive = true
    void (async () => {
      await Promise.resolve()
      if (getPendingContracts(patientId).length === 0) return
      const r = await resend('auto-retry')
      if (!alive) return
      setItems(getPendingContracts(patientId))
      if (r.saved > 0) {
        setMsg(`送れていなかった書類 ${r.saved}件を、クラウドに保存しました。`)
        onUpdateRef.current()
      } else if (r.lastError) setMsg(r.lastError)
    })()
    return () => {
      alive = false
    }
  }, [patientId, resend])

  async function resendNow() {
    setBusy(true)
    setMsg('')
    const r = await resend('retry')
    setBusy(false)
    setItems(getPendingContracts(patientId))
    if (r.saved > 0) {
      setMsg(`${r.saved}件をクラウドに保存しました。`)
      onUpdate()
    } else if (r.lastError) setMsg(r.lastError)
  }

  if (items.length === 0) return msg ? <p className="rounded-xl bg-teal-50 p-3 text-sm font-medium text-teal-800">{msg}</p> : null
  return (
    <section className="space-y-2 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <h3 className="text-sm font-bold text-slate-900">クラウドに送れていない書類（この端末に残っています）</h3>
      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.record.id} className="rounded-lg bg-white p-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <b>{p.record.title}</b>・{jaDate(p.record.signedDate)}
                {p.error && <span className="block text-xs text-slate-600">{p.error}</span>}
              </span>
              <button
                type="button"
                onClick={() => setOpen(open === p.record.id ? null : p.record.id)}
                className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                控えを印刷
              </button>
            </div>
            {open === p.record.id && (
              <div className="mt-2">
                <CopyActions html={p.html} record={p.record} compact />
              </div>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={resendNow}
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 font-bold text-white hover:bg-teal-800 disabled:opacity-60"
      >
        <CloudUpload className="h-4 w-4" aria-hidden />
        {busy ? '送っています…' : 'クラウドに送り直す'}
      </button>
      {msg && <p className="text-sm font-medium text-slate-800">{msg}</p>}
    </section>
  )
}

function SignFlow({
  tpl,
  patient,
  contracts,
  status,
  covered,
  today,
  onBack,
  onDone,
}: {
  tpl: ContractTemplate
  patient: Patient
  contracts: ContractRecord[]
  status: MemberStatus
  /** 兄弟・親子プランのもう1名として登録されているときの状態 */
  covered?: MemberStatus
  today: string
  onBack: () => void
  onDone: (record: ContractRecord, html: string) => void
}) {
  const parsed = useMemo(() => parseTemplate(tpl.body), [tpl.body])
  const described = useMemo(() => describeTemplate(parsed), [parsed])
  const [checks, setChecks] = useState<boolean[]>(() => Array(parsed.checkCount).fill(false))
  /** 手で入れた値（null はまだ触っていない＝自動の値を使う） */
  const [inputs, setInputs] = useState<Array<string | null>>(() => Array(parsed.blankCount).fill(null))
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
    partnerName: '',
    partnerRelation: '',
    partnerBirthDate: '',
    partnerPatientId: '',
    pauseFrom: today.slice(0, 7),
    pauseMonths: 1,
    special: false,
    specialReason: '',
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  /** 「署名して完了する」を一度押した（まだのものを赤で知らせる） */
  const [attempted, setAttempted] = useState(false)
  /** クラウドに送れなかった書類（端末に残してある。送り直し・控えの印刷に使う） */
  const [failed, setFailed] = useState<{ record: ContractRecord; html: string } | null>(null)

  // ── 記入欄の自動入力（署名とチェック以外） ──
  const partnerPatient = useMemo(
    () => (member.partnerPatientId ? (getPatient(member.partnerPatientId) ?? null) : null),
    [member.partnerPatientId],
  )
  const auto = useMemo(
    () =>
      autofillContract(parsed, {
        docId: tpl.id,
        today,
        patient,
        member: tpl.member ? member : undefined,
        status,
        partnerPatient,
        inputs,
      }),
    [parsed, tpl.id, tpl.member, today, patient, member, status, partnerPatient, inputs],
  )
  const values = useMemo(() => effectiveInputs(inputs, auto), [inputs, auto])
  const edited = useMemo(() => inputs.map((v) => v !== null), [inputs])
  const labels = useMemo(() => {
    const out: string[] = Array(parsed.blankCount).fill('')
    for (const b of described.blanks) out[b.i] = b.label || b.row
    return out
  }, [described, parsed.blankCount])
  const autoCount = auto.filter((a, i) => a && values[i]).length

  /** 前に署名した書類の保護者（同じ日に何枚も書くときに、ひと押しで入れる） */
  const lastGuardian = useMemo(() => {
    const hit = contracts.find((c) => !c.voided && c.guardianName)
    return hit ? { name: hit.guardianName as string, relation: hit.relation ?? '' } : null
  }, [contracts])

  // 会員プランの書類：文面の □ と、下の「会員の手続き」の欄が食いちがわないように
  const checkedPlans = tpl.member === 'join' ? described.checks.filter((c) => checks[c.i] && planOfCheck(c)).map((c) => planOfCheck(c) as string) : []
  const checkedMonths = tpl.member === 'pause' ? described.checks.filter((c) => checks[c.i] && pauseMonthsOfCheck(c)).map((c) => pauseMonthsOfCheck(c) as number) : []

  function onCheck(i: number, v: boolean) {
    setChecks((prev) => prev.map((x, k) => (k === i ? v : x)))
    if (!v) return
    const info = described.checks.find((c) => c.i === i)
    const plan = tpl.member === 'join' ? planOfCheck(info) : null
    if (plan) setMember((m) => ({ ...m, plan }))
    const months = tpl.member === 'pause' ? pauseMonthsOfCheck(info) : null
    if (months) setMember((m) => ({ ...m, pauseMonths: months }))
  }

  const memberCheck = tpl.member ? buildMemberEvent(tpl.member, member, contracts, today, covered) : null

  /** 署名して完了する前に、まだのもの（押したら、そこへ飛ぶ） */
  const missing: Array<{ id: string; text: string }> = []
  if (!patientName.trim()) missing.push({ id: 'cf-patient-name', text: '患者様氏名' })
  if (!sigPatient) missing.push({ id: 'cf-sig-patient', text: '患者様の署名' })
  if (minor && !guardianName.trim()) missing.push({ id: 'cf-guardian-name', text: '保護者氏名' })
  if (minor && !sigGuardian) missing.push({ id: 'cf-sig-guardian', text: '保護者の署名' })
  if (!staffName.trim()) missing.push({ id: 'cf-staff-name', text: `${tpl.staffLabel}の氏名` })
  if (!sigStaff) missing.push({ id: 'cf-sig-staff', text: `${tpl.staffLabel}の署名` })
  if (memberCheck && !memberCheck.ok) missing.push({ id: 'cf-member', text: memberCheck.error })
  if (checkedPlans.length > 1) missing.push({ id: 'cf-doc', text: '文面の「申し込む」のチェックが2つ以上あります。申し込むプランを1つにしてください。' })
  else if (checkedPlans.length === 1 && checkedPlans[0] !== member.plan)
    missing.push({ id: 'cf-member', text: `文面で選んだプラン（${checkedPlans[0]}）と、下の「会員の種別」（${member.plan}）がちがいます。` })
  if (checkedMonths.length > 1) missing.push({ id: 'cf-doc', text: '文面の「休会の月数」のチェックが2つ以上あります。1つにしてください。' })
  else if (checkedMonths.length === 1 && checkedMonths[0] !== Number(member.pauseMonths))
    missing.push({ id: 'cf-member', text: `文面の休会の月数（${checkedMonths[0]}か月）と、下の「休会の月数」（${member.pauseMonths}か月）がちがいます。` })
  const ready = missing.length === 0
  const isMissing = (id: string) => attempted && missing.some((m) => m.id === id)

  function jumpTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const input = el.querySelector('input') ?? (el instanceof HTMLInputElement ? el : null)
    if (input && input.type === 'text') setTimeout(() => input.focus({ preventScroll: true }), 300)
  }

  function printBlank() {
    const html =
      renderTemplateHtml(parsed, null, null) +
      signatureBlockHtml({ date: today, patientName: '', staffLabel: tpl.staffLabel, staffName: '' }, true)
    printPages([copyPage(html, '', `${tpl.title}（版 ${tpl.version}）`)])
  }

  /** 署名した内容から、保存する記録と本文を作る */
  function buildSigned(): { record: ContractRecord; html: string } {
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
      patientName: patientName.trim().slice(0, 40),
      guardianName: minor ? guardianName.trim().slice(0, 40) : undefined,
      relation: minor && relation.trim() ? relation.trim().slice(0, 20) : undefined,
      staffLabel: tpl.staffLabel,
      staffName: staffName.trim().slice(0, 40),
      checked: checks.filter(Boolean).length,
      written: values.filter((v) => v.trim()).length,
      member: memberCheck && memberCheck.ok ? memberCheck.event : undefined,
    }
    // 会員プランの書類は、いちばん上に「ご契約内容」の枠（直筆の署名も）を入れる。院保管用にも患者様控えにも同じものが出る
    const summary = contractSummaryHtml({
      record,
      before: status,
      parsed,
      described,
      checks,
      values,
      signatures: [
        { label: '患者様', name: record.patientName, image: sigPatient },
        ...(record.guardianName ? [{ label: `保護者${record.relation ? `（${record.relation}）` : ''}`, name: record.guardianName, image: sigGuardian }] : []),
        { label: tpl.staffLabel, name: record.staffName, image: sigStaff },
      ],
    })
    const html =
      insertSummary(renderTemplateHtml(parsed, checks, values), summary) +
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
    return { record, html }
  }

  /** クラウドに保存できた：端末の一覧に入れて、完了の画面へ */
  function finish(record: ContractRecord, html: string) {
    try {
      addContract(record)
    } catch {
      console.warn('[contracts] 端末の一覧に入れられませんでした', record.id)
    }
    dropPending(record.id)
    try {
      localStorage.setItem(STAFF_NAME_KEY, record.staffName)
    } catch {
      // 端末の担当者名を覚えられないだけ
    }
    onDone(record, html)
  }

  /** 送れなかった：端末に残して、送り直し・控えの印刷を出す */
  function keepFailed(record: ContractRecord, html: string, message: string) {
    const kept = keepPending({ record, html, at: new Date().toISOString(), error: message })
    setFailed({ record, html })
    setError(
      kept
        ? `${message} 署名した書類はこの端末に残しました。`
        : `${message} この端末に残すこともできませんでした。下の「患者様控えを印刷」で控えを渡し、院長に知らせてください。`,
    )
  }

  async function sign() {
    setError('')
    setAttempted(true)
    if (!ready || !sigPatient || !sigStaff) {
      // 何がまだかは、ボタンの上の赤い枠に出る。いちばん上のものへ飛ぶ
      if (missing[0]) jumpTo(missing[0].id)
      return
    }
    setSaving(true)
    let signed: { record: ContractRecord; html: string }
    try {
      signed = buildSigned()
    } catch (e) {
      setSaving(false)
      setError(`書類を作れませんでした（${e instanceof Error ? e.message : String(e)}）。院長に知らせてください。`)
      return
    }
    // 前に送れなかった分は、作りなおした今回の分に置きかえる
    if (failed) dropPending(failed.record.id)
    const r = await sendContract(signed.record, signed.html)
    setSaving(false)
    if (r.ok) finish(signed.record, signed.html)
    else keepFailed(signed.record, signed.html, sendErrorText(r))
  }

  /** 送れなかった同じ書類を、もう一度送る（記録IDは変えない） */
  async function retry() {
    if (!failed) return
    setError('')
    setSaving(true)
    const r = await sendContract(failed.record, failed.html, 'retry')
    setSaving(false)
    if (r.ok) finish(failed.record, failed.html)
    else keepFailed(failed.record, failed.html, sendErrorText(r))
  }

  const fieldTone = (id: string) => (isMissing(id) ? 'border-red-500 bg-red-50/40' : 'border-slate-300')

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
          className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Printer className="h-4 w-4" aria-hidden />
          白紙を印刷
        </button>
      </div>

      {parsed.blankCount > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-teal-50 px-3 py-2 text-sm text-slate-700">
          <span className="mt-0.5 inline-block h-4 w-6 shrink-0 rounded border border-teal-400 bg-white" aria-hidden />
          <span>
            {autoCount > 0
              ? `緑の欄（${autoCount}か所）は、カルテ・今日の日付・下の会員の手続きから自動で入れました（カルテ・日付のものはタップして直せます）。□ のチェックと署名は、患者様ご自身でお願いします。`
              : '□ のチェックと署名は、患者様ご自身でお願いします。'}
          </span>
        </p>
      )}

      <article id="cf-doc" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <ContractDocument
          parsed={parsed}
          checks={checks}
          inputs={values}
          auto={auto}
          edited={edited}
          labels={labels}
          onCheck={onCheck}
          onInput={(i, v) => setInputs((prev) => prev.map((x, k) => (k === i ? v : x)))}
        />
      </article>

      {tpl.member && (
        <div id="cf-member" className="scroll-mt-24">
          <MemberForm kind={tpl.member} member={member} setMember={setMember} status={status} today={today} check={memberCheck} selfId={patient.id} />
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="text-base font-bold text-slate-900">署名欄（{jaDate(today)}）</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label id="cf-patient-name" className="block scroll-mt-24 text-sm">
            <span className="font-bold text-slate-700">患者様氏名</span>
            <input value={patientName} onChange={(e) => setPatientName(e.target.value)} className={`mt-1 min-h-11 w-full rounded-lg border px-3 ${fieldTone('cf-patient-name')}`} />
          </label>
          <label className="flex items-center gap-2 self-end text-sm max-lg:min-h-10">
            <input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} className="h-6 w-6 accent-teal-700" />
            <span className="font-bold text-slate-700">未成年（保護者も署名）</span>
            {age !== null && <span className="text-xs text-slate-500">（{age}歳）</span>}
          </label>
        </div>
        <SignaturePad id="cf-sig-patient" label="患者様の署名" onChange={setSigPatient} missing={isMissing('cf-sig-patient')} />
        {minor && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label id="cf-guardian-name" className="block scroll-mt-24 text-sm">
                <span className="font-bold text-slate-700">保護者氏名</span>
                <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className={`mt-1 min-h-11 w-full rounded-lg border px-3 ${fieldTone('cf-guardian-name')}`} />
              </label>
              <label className="block text-sm">
                <span className="font-bold text-slate-700">続柄</span>
                <input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="母・父 など" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
              </label>
            </div>
            {lastGuardian && !guardianName.trim() && (
              <button
                type="button"
                onClick={() => {
                  setGuardianName(lastGuardian.name)
                  if (!relation.trim()) setRelation(lastGuardian.relation)
                }}
                className="min-h-10 rounded-lg border border-teal-300 bg-white px-3 text-sm font-medium text-teal-800 hover:bg-teal-50"
              >
                前の書類と同じ保護者（{lastGuardian.name}
                {lastGuardian.relation ? `・${lastGuardian.relation}` : ''}）を入れる
              </button>
            )}
            <SignaturePad id="cf-sig-guardian" label="保護者の署名" onChange={setSigGuardian} missing={isMissing('cf-sig-guardian')} />
          </>
        )}
        <div id="cf-staff-name" className="scroll-mt-24 space-y-2">
          <label className="block text-sm sm:w-1/2">
            <span className="font-bold text-slate-700">{tpl.staffLabel}（氏名）</span>
            <input value={staffName} onChange={(e) => setStaffName(e.target.value)} className={`mt-1 min-h-11 w-full rounded-lg border px-3 ${fieldTone('cf-staff-name')}`} />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label={`${tpl.staffLabel}をえらぶ`}>
            {CLINIC_STAFF.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStaffName(n)}
                aria-pressed={staffName.trim() === n}
                className={`min-h-10 rounded-lg border px-3 text-sm font-medium ${
                  staffName.trim() === n ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <SignaturePad id="cf-sig-staff" label={`${tpl.staffLabel}の署名`} onChange={setSigStaff} missing={isMissing('cf-sig-staff')} />

        {!ready && (
          <div className={`rounded-lg p-3 text-sm ${attempted ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-700'}`}>
            <p className="font-bold">完了の前に、あと{missing.length}つ</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {missing.map((m) => (
                <li key={`${m.id}-${m.text}`}>
                  <button
                    type="button"
                    onClick={() => jumpTo(m.id)}
                    className="min-h-10 rounded-lg border border-current bg-white px-3 text-left text-sm underline-offset-2 hover:underline"
                  >
                    {m.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
            {error}
          </p>
        )}
        {failed && !saving && (
          <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-slate-800">
            <p>
              通信が戻ったら「もう一度送る」を押してください（カルテの「契約・同意書」を開いたときにも、自動で送り直します）。患者様の控えは、先に印刷できます。
            </p>
            <button
              type="button"
              onClick={retry}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 font-bold text-white hover:bg-teal-800"
            >
              <CloudUpload className="h-4 w-4" aria-hidden />
              もう一度送る
            </button>
            <CopyActions html={failed.html} record={failed.record} compact />
          </div>
        )}
        <button
          type="button"
          onClick={sign}
          disabled={saving}
          className={`min-h-14 w-full rounded-xl text-lg font-bold text-white disabled:opacity-60 ${ready ? 'bg-teal-700 hover:bg-teal-800' : 'bg-slate-500'}`}
        >
          {saving ? '保存しています…' : '署名して完了する'}
        </button>
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
  selfId,
}: {
  kind: 'join' | 'pause' | 'cancel'
  member: MemberInput
  setMember: (fn: (m: MemberInput) => MemberInput) => void
  status: MemberStatus
  today: string
  check: ReturnType<typeof buildMemberEvent> | null
  selfId: string
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
          {member.plan === PAIR_PLAN && <PartnerFields member={member} set={set} selfId={selfId} />}
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

/** 兄弟・親子プランの、もう1名の利用者（カルテから選ぶか、名前を入れる） */
function PartnerFields({ member, set, selfId }: { member: MemberInput; set: (patch: Partial<MemberInput>) => void; selfId: string }) {
  const patients = useMemo(
    () =>
      getPatients()
        .filter((p) => p.id !== selfId)
        .sort((a, b) => (a.kana || a.name).localeCompare(b.kana || b.name, 'ja')),
    [selfId],
  )
  return (
    <div className="space-y-3 rounded-xl border border-teal-200 bg-white p-3 sm:col-span-2">
      <p className="text-sm font-bold text-slate-800">もう1名の利用者（兄弟姉妹・親子）</p>
      <label className="block text-sm">
        <span className="font-bold text-slate-700">カルテから選ぶ</span>
        <select
          value={member.partnerPatientId ?? ''}
          onChange={(e) => {
            const p = patients.find((x) => x.id === e.target.value)
            set(p ? { partnerPatientId: p.id, partnerName: p.name, partnerBirthDate: p.birthDate || '' } : { partnerPatientId: '' })
          }}
          className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
        >
          <option value="">カルテがない方（下にお名前を入れる）</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.kana ? `（${p.kana}）` : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="font-bold text-slate-700">お名前</span>
          <input value={member.partnerName ?? ''} onChange={(e) => set({ partnerName: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
        </label>
        <label className="block text-sm">
          <span className="font-bold text-slate-700">続柄（契約者との関係）</span>
          <input
            value={member.partnerRelation ?? ''}
            onChange={(e) => set({ partnerRelation: e.target.value })}
            list="partner-relations"
            placeholder="弟・姉・母 など"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
          />
          <datalist id="partner-relations">
            {['兄', '弟', '姉', '妹', '父', '母', '子'].map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
        <label className="block text-sm">
          <span className="font-bold text-slate-700">生年月日</span>
          <input type="date" value={member.partnerBirthDate ?? ''} onChange={(e) => set({ partnerBirthDate: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
        </label>
      </div>
      <p className="text-xs text-slate-600">
        カルテから選ぶと、その方のカルテにも「会員（代表 この方）」と出ます。1部位施術料は来院した方ごとにかかります。休会・解約はこのカルテで2名分まとめて手続きします。
      </p>
    </div>
  )
}

