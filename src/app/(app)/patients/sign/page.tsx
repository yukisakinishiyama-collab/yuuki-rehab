'use client'
// ──────────────────────────────────────────────
// 契約書・同意書を、渡された端末（iPad）で記入する（/patients/sign?t=受け渡しの番号）
//
// 2026-11-19 院長の依頼「説明はパソコンで、記入は iPad で。QR 発行・読み取り → 患者記入 → 反映（パソコンにも）」。
// パソコンの「iPadで記入してもらう」の QR コードから開く（または、iPad の院内アプリのカルテ「契約・同意書」から）。
// 1. クラウドとそろえる（パソコンで直したばかりのカルテも、同じ中身で出るように）
// 2. 受け渡しを読む → 患者さん・書類・パソコンで入れてあった中身を確かめる
// 3. いつもの署名の画面（ContractsTab の SignFlow）を、画面いっぱいに出す（患者様に渡すので、カルテやメニューは見せない）
// 4. 署名が終わったら、受け渡しに「署名済み」の印 → パソコンの画面が数秒で完了に変わる
// 決まりは lib/contracts/handoff.ts
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { Patient } from '@/types/patient'
import type { ContractRecord } from '@/types/contracts'
import { CONTRACT_TEMPLATES, type ContractTemplate } from '@/data/contract-templates'
import { parseTemplate } from '@/lib/contracts/template'
import { handoffDraftProblem, handoffStatusText, isValidHandoffToken, type HandoffDraft } from '@/lib/contracts/handoff'
import { fetchHandoff, markHandoffOpened, markHandoffSigned } from '@/lib/contracts/handoff-client'
import { jstToday, memberStatusForPatient, memberStatusOf } from '@/lib/contracts/member'
import { getAllContracts, getContracts } from '@/lib/contracts/store'
import { getPatient, initPatientStore } from '@/lib/patient-store'
import { fingerprint } from '@/lib/sync-merge'
import { SignFlow } from '@/components/rehab-management/ContractsTab'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; retry?: boolean }
  | { kind: 'ready'; token: string; draft: HandoffDraft; patient: Patient; tpl: ContractTemplate }
  | { kind: 'done'; patient: Patient; record: ContractRecord }

function readToken(): string {
  return new URLSearchParams(window.location.search).get('t') ?? ''
}

async function load(token: string): Promise<State> {
  if (!isValidHandoffToken(token)) {
    return { kind: 'error', message: 'この QR コードは使えません。パソコンで「iPadで記入してもらう」を押して、出てきた QR コードを読み取ってください。' }
  }
  initPatientStore()
  try {
    const { isSyncEnabled, syncNow } = await import('@/lib/sync-service')
    if (isSyncEnabled()) await syncNow()
  } catch {
    // そろえられなくても、この端末のカルテで続ける（足りなければ下で知らせる）
  }
  const r = await fetchHandoff(token)
  if (r.kind === 'missing') return { kind: 'error', message: handoffStatusText('missing') }
  if (r.kind === 'error') return { kind: 'error', message: `受け渡しを読めませんでした（${r.message}）。通信を確かめて、もう一度お試しください。`, retry: true }
  const session = r.session
  if (session.status === 'signed') return { kind: 'error', message: 'この書類は、もう署名が終わっています。' }
  if (session.status === 'cancelled') return { kind: 'error', message: 'パソコンの側で、この受け渡しを取り消しました。パソコンで QR コードを出し直してください。' }
  if (r.expired || !session.draft) return { kind: 'error', message: handoffStatusText('expired') }

  const patient = getPatient(session.patientId)
  if (!patient) {
    return { kind: 'error', message: 'この患者さんのカルテが、この端末にまだ届いていません。少し待ってから「もう一度読みこむ」を押してください。', retry: true }
  }
  const draft = session.draft
  const tpl = CONTRACT_TEMPLATES.find((t) => t.id === draft.docId) ?? null
  const parsed = tpl ? parseTemplate(tpl.body) : null
  const problem = handoffDraftProblem(
    draft,
    tpl && parsed ? { id: tpl.id, version: tpl.version, bodyHash: fingerprint(tpl.body), checkCount: parsed.checkCount, blankCount: parsed.blankCount } : null,
  )
  if (problem || !tpl) return { kind: 'error', message: problem ?? handoffStatusText('missing') }

  try {
    const opened = await markHandoffOpened(token)
    if (!opened.ok) {
      const reason = opened.reason === 'cancelled' || opened.reason === 'expired' || opened.reason === 'signed' ? opened.reason : 'missing'
      return { kind: 'error', message: reason === 'signed' ? 'この書類は、もう署名が終わっています。' : handoffStatusText(reason) }
    }
  } catch (e) {
    return { kind: 'error', message: `受け渡しを開けませんでした（${e instanceof Error ? e.message : String(e)}）。`, retry: true }
  }
  return { kind: 'ready', token, draft, patient, tpl }
}

export default function HandoffSignPage() {
  // アドレスの ?t= は端末の側で読む（サーバーでは空）
  const token = useSyncExternalStore(() => () => {}, readToken, () => null)
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (token === null) return
    let alive = true
    void load(token).then((next) => {
      if (alive) setState(next)
    })
    return () => {
      alive = false
    }
  }, [token, attempt])

  // 画面いっぱいに出している間は、うしろのページを動かさない
  const covering = state.kind === 'ready' || state.kind === 'done'
  useEffect(() => {
    if (!covering) return
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = before
    }
  }, [covering])

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center justify-center py-24 text-slate-600" role="status">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        書類を用意しています…
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
        <p role="alert" className="rounded-xl bg-amber-50 p-4 text-left text-sm text-amber-900">
          {state.message}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {state.retry && (
            <button
              type="button"
              onClick={() => {
                setState({ kind: 'loading' })
                setAttempt((n) => n + 1)
              }}
              className={cn(buttonVariants())}
            >
              もう一度読みこむ
            </button>
          )}
          <Link href="/patients" className={cn(buttonVariants({ variant: 'outline' }))}>
            カルテの一覧へ
          </Link>
        </div>
      </div>
    )
  }

  if (state.kind === 'done') {
    return (
      <div className="no-print fixed inset-0 z-[60] m-0 flex flex-col items-center justify-center overflow-y-auto bg-slate-50 p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-teal-200 bg-white p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-14 w-14 text-teal-700" aria-hidden />
          <p className="text-xl font-black text-slate-900">ご記入ありがとうございました</p>
          <p className="text-base text-slate-700">署名が完了しました。この端末をスタッフにお返しください。</p>
          <p className="text-sm text-slate-600">{state.record.title}</p>
          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-xs text-slate-600">スタッフ用（控えの印刷は、パソコンの画面からできます）</p>
            <Link href={`/patients/${state.patient.id}?tab=contract`} className={cn(buttonVariants({ variant: 'outline' }))}>
              カルテの「契約・同意書」を開く
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <SignStage key={state.token} state={state} onDone={(record) => setState({ kind: 'done', patient: state.patient, record })} />
}

function SignStage({ state, onDone }: { state: Extract<State, { kind: 'ready' }>; onDone: (record: ContractRecord) => void }) {
  const { patient, tpl, draft, token } = state
  const today = jstToday()
  // この方の署名済みの書類（会員の状態の計算に使う。カルテの「契約・同意書」と同じ）
  const contracts = useMemo(() => getContracts(patient.id), [patient.id])
  const ownStatus = useMemo(() => memberStatusOf(contracts, today), [contracts, today])
  const status = useMemo(() => memberStatusForPatient(patient.id, getAllContracts(), today), [patient.id, today])
  const plan = draft.member.plan === '一般会員' || draft.member.plan === '学生会員' || draft.member.plan === '兄弟・親子プラン' ? draft.member.plan : undefined

  return (
    <div className="no-print fixed inset-0 z-[60] m-0 flex flex-col bg-slate-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-bold text-teal-800">ゆうき整骨院</p>
        <h1 className="text-lg font-black text-slate-900">{tpl.title}</h1>
        <p className="break-keep text-base text-slate-700 wrap-anywhere">{patient.name} 様　内容をお確かめのうえ、□ のチェックとご署名をお願いします。</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4 pb-16">
          <SignFlow
            tpl={tpl}
            patient={patient}
            contracts={contracts}
            status={ownStatus}
            covered={status.via ? status : undefined}
            initialPlan={plan}
            today={today}
            initial={draft}
            handoffToken={token}
            onBack={() => undefined}
            onDone={(record) => {
              // パソコンへ知らせる（知らせそこねても、署名入りの本文はもうクラウドにあり、カルテの同期で届く）
              void markHandoffSigned(token, record.id)
              onDone(record)
            }}
          />
        </div>
      </div>
    </div>
  )
}
