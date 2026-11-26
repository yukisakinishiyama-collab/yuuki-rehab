'use client'
/**
 * ご来院が空いている方へのご連絡（公式LINE）— 院長のみ
 *
 * 2026-11-26 院長「一定期間ご来院のない患者様にも連絡がいくように（これは事前に私に誰に送るか出して承認したものだけ）」。
 * 患者さんへ送るのは、院長が自分の LINE で承認した方にだけ（同じ日の指示「承認は私のlineに一度送って承認の確認をしてください」）。
 * この画面は「ご来院が空いている方」を出し、選んだ方を院長の LINE へ「承認のお願い」として送る。LINE のボタンで承認すると送られる。
 * 毎週（月曜の朝）、候補を自動で院長の LINE へ送ることもできる（この画面でオン・オフ）。
 *
 * - 一覧は、この端末のカルテ（SOAP・来院記録・NOAH の最終来院）に、予約の表の過去60日の分と、来院予定の「来院した」を足して作る
 * - 送ってよいか（LINE 連携・配信停止・これからの予約や来院予定・前に送った日）は、サーバーが確かめる（/api/marketing/line/followup）
 * - 決まりは lib/followup-line.ts、サーバーは lib/marketing/followup-line-server.ts
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Phone, Send } from 'lucide-react'
import { FOLLOWUP_REQUEST_HOURS, FOLLOWUP_REQUEST_MAX } from '@/lib/followup-approval'
import { useMarketingRole } from '@/lib/marketing/use-role'
import { getAttendanceRecords, getPatients, getSOAPNotes, getVisitPlans, initPatientStore } from '@/lib/patient-store'
import { patientGaps } from '@/lib/marketing/patient-movement'
import {
  DEFAULT_FOLLOWUP_TEMPLATE,
  FOLLOWUP_BLOCK_TEXT,
  FOLLOWUP_DEFAULT_DAYS,
  FOLLOWUP_MAX_GAP_DAYS,
  FOLLOWUP_PERIODS,
  FOLLOWUP_REPEAT_DAYS,
  FOLLOWUP_TEMPLATE_MAX,
  followupCandidates,
  followupTemplateProblem,
  followupText,
  latestVisitDates,
  type FollowupCandidate,
  type FollowupCheck,
  type PastReservation,
} from '@/lib/followup-line'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const FEED_KEY_STORAGE = 'yoyaku_feed_key'

interface Feed {
  ok: boolean
  today?: string
  days?: Array<{ date: string; rows: Array<{ name: string; phone: string; status: string }> }>
}
interface Settings {
  weekly: boolean
  minDays: number
  template: string
}

const jstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
const digits = (v: string) => String(v || '').replace(/[^0-9]/g, '')
const card = 'rounded-xl border border-slate-200 bg-white p-4'

export default function FollowupLinePage() {
  const { isAdmin } = useMarketingRole()
  const today = jstToday()
  const [minDays, setMinDays] = useState<number>(FOLLOWUP_DEFAULT_DAYS)
  const [base, setBase] = useState<{ people: Array<{ id: string; name: string; phone: string; visits: number }>; last: Map<string, string> } | null>(null)
  const [feedNote, setFeedNote] = useState('')
  const [checks, setChecks] = useState<Map<string, FollowupCheck> | null>(null)
  const [checkError, setCheckError] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [template, setTemplate] = useState(DEFAULT_FOLLOWUP_TEMPLATE)
  const [recent, setRecent] = useState<Array<{ at: string; name: string; ok: boolean; error?: string }>>([])
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [saved, setSaved] = useState<Settings | null>(null)
  const [weekly, setWeekly] = useState(true)
  const [settingsNote, setSettingsNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const appliedRef = useRef(false)

  const loadSettings = useCallback(() => {
    fetch('/api/marketing/line/followup', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { ok?: boolean; recent?: typeof recent; settings?: Settings }) => {
        if (!d.ok) return
        setRecent(d.recent ?? [])
        // 保存してある設定（日数・文・毎週のお願い）を、最初の1回だけ画面に入れる
        if (d.settings) {
          setSaved(d.settings)
          if (!appliedRef.current) {
            appliedRef.current = true
            setMinDays(d.settings.minDays)
            setTemplate(d.settings.template)
            setWeekly(d.settings.weekly)
          }
        }
      })
      .catch(() => undefined)
  }, [])

  // この端末のカルテと、予約の表の過去の分から「最後に来た日」を出す（最初の1回）
  useEffect(() => {
    if (!isAdmin) return
    let alive = true
    initPatientStore()
    const visits = [
      ...getSOAPNotes().map((n) => ({ patientId: n.patientId, visitDate: n.visitDate })),
      ...getAttendanceRecords()
        .filter((a) => a.status === 'visited')
        .map((a) => ({ patientId: a.patientId, visitDate: a.visitDate })),
    ]
    const gaps = patientGaps(getPatients(), visits, today)
    const visited = getVisitPlans().filter((p) => p.status === 'visited')
    const build = (past: PastReservation[]) => {
      if (!alive) return
      const people = gaps.map((g) => ({ id: g.id, name: g.name, phone: g.phone, visits: g.visits, lastVisit: g.lastVisit }))
      setBase({ people, last: latestVisitDates(people, past, visited, today) })
    }
    let key = ''
    try {
      key = localStorage.getItem(FEED_KEY_STORAGE) || ''
    } catch {
      /* noop */
    }
    if (!key) {
      // 予約システムとつながっていない端末では、カルテの記録だけで見る（そのことを画面に出す）
      queueMicrotask(() => {
        if (alive) setFeedNote('この端末は予約システムとつながっていないため、「最後のご来院」はカルテの記録だけで見ています（「今日」の画面で予約システムと連携すると、予約の表の過去60日も見ます）。')
        build([])
      })
    } else {
      fetch(`/api/yoyaku/feed?key=${encodeURIComponent(key)}&days=1&back=60`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: Feed) => {
          if (!d.ok) throw new Error('feed')
          build((d.days ?? []).filter((day) => day.date < today).flatMap((day) => day.rows.map((r) => ({ date: day.date, name: r.name, phone: r.phone, status: r.status }))))
        })
        .catch(() => {
          if (alive) setFeedNote('予約システムから読めなかったため、「最後のご来院」はカルテの記録だけで見ています。')
          build([])
        })
    }
    loadSettings()
    return () => {
      alive = false
    }
  }, [isAdmin, today, loadSettings])

  const candidates = useMemo<FollowupCandidate[]>(() => (base ? followupCandidates(base.people, base.last, today, minDays) : []), [base, today, minDays])
  const tooOld = useMemo(() => {
    if (!base) return 0
    let n = 0
    for (const d of base.last.values()) if (Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86_400_000) > FOLLOWUP_MAX_GAP_DAYS) n += 1
    return n
  }, [base, today])

  // 送ってよいかを、サーバーで確かめる（一覧が変わるたび）
  useEffect(() => {
    if (!base) return
    let alive = true
    const people = candidates.slice(0, 300).map((c) => ({ patientId: c.patientId, name: c.name }))
    const apply = (next: Map<string, FollowupCheck> | null, error = '') => {
      if (!alive) return
      setChecks(next)
      setCheckError(error)
      // 送れなくなった方・一覧から外れた方のチェックは外す
      setPicked((prev) => new Set([...prev].filter((id) => next?.get(id)?.sendable)))
    }
    if (people.length === 0) {
      queueMicrotask(() => apply(new Map()))
      return () => {
        alive = false
      }
    }
    queueMicrotask(() => alive && setChecks(null))
    fetch('/api/marketing/line/followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check', people }) })
      .then(async (r) => {
        const d = (await r.json().catch(() => null)) as { ok?: boolean; checks?: FollowupCheck[]; error?: string } | null
        if (!r.ok || !d?.ok || !d.checks) throw new Error(d?.error || `HTTP ${r.status}`)
        apply(new Map(d.checks.map((c) => [c.patientId, c])))
      })
      .catch((e: unknown) => apply(null, e instanceof Error ? e.message : '確かめられませんでした'))
    return () => {
      alive = false
    }
  }, [base, candidates])

  const sendable = useMemo(() => candidates.filter((c) => checks?.get(c.patientId)?.sendable), [candidates, checks])
  const blocked = useMemo(() => candidates.filter((c) => checks && !checks.get(c.patientId)?.sendable), [candidates, checks])
  const chosen = useMemo(() => sendable.filter((c) => picked.has(c.patientId)), [sendable, picked])
  const problem = followupTemplateProblem(template)
  const overLimit = chosen.length > FOLLOWUP_REQUEST_MAX
  const dirty = Boolean(saved) && (saved!.weekly !== weekly || saved!.minDays !== minDays || saved!.template.trim() !== template.trim())

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/marketing/line/followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; count?: number } | null
    if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`)
    return data
  }

  async function sample() {
    setMessage(null)
    setBusy('見本を送っています…')
    try {
      await post({ action: 'sample', template })
      setMessage({ tone: 'ok', text: '院長の LINE に見本を送りました（患者さんには送っていません）' })
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : '見本を送れませんでした' })
    } finally {
      setBusy('')
    }
  }

  // 院長の LINE へ「承認のお願い」を送る（患者さんには、まだ送らない。LINE のボタンで承認すると送られる）
  async function request() {
    setMessage(null)
    setBusy('院長の LINE に送っています…')
    try {
      const data = await post({ action: 'request', template, people: chosen.map((c) => ({ patientId: c.patientId, name: c.name, lastVisit: c.lastVisit, days: c.days })) })
      setPicked(new Set())
      setConfirming(false)
      setMessage({ tone: 'ok', text: `院長の LINE に、${data.count ?? chosen.length}人分の承認のお願いを送りました。LINE のボタンで承認すると、患者さんへ送ります（まだ、だれにも送っていません）。` })
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : '院長の LINE に送れませんでした' })
    } finally {
      setBusy('')
    }
  }

  async function saveSettings() {
    setSettingsNote(null)
    try {
      const res = await fetch('/api/marketing/line/followup', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weekly, minDays, template }) })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; settings?: Settings } | null
      if (!res.ok || !data?.ok || !data.settings) throw new Error(data?.error || `HTTP ${res.status}`)
      setSaved(data.settings)
      setSettingsNote({ tone: 'ok', text: '保存しました' })
    } catch (e) {
      setSettingsNote({ tone: 'error', text: e instanceof Error ? e.message : '保存できませんでした' })
    }
  }

  if (!isAdmin) return <p className="text-sm text-slate-600">この画面は院長だけが使えます。</p>

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900">ご来院が空いている方へのご連絡（LINE）</h1>
        <p className="mt-1 text-sm text-slate-600">
          患者さんへは、自動では送りません。下の一覧から送る方を選ぶと、院長の LINE に「承認のお願い」が届きます。LINE のボタンで承認した方にだけ、公式LINE でご様子うかがいの文が届きます。
        </p>
      </div>

      <section className={card}>
        <h2 className="font-bold text-slate-900">1. 最後のご来院から、どのくらい空いた方を出すか</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {FOLLOWUP_PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setMinDays(p.days)}
              aria-pressed={minDays === p.days}
              className={cn(
                'min-h-10 rounded-lg px-3 text-sm font-bold ring-1 transition-colors',
                minDays === p.days ? 'bg-teal-700 text-white ring-teal-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          1年より長く空いた方は出しません{tooOld > 0 ? `（${tooOld}人）` : ''}。終了・紹介の方、これからのご予約・来院予定がある方、{FOLLOWUP_REPEAT_DAYS}日のうちにご連絡した方には送りません。
        </p>
        {feedNote && <p className="mt-1 text-xs text-amber-800">{feedNote}</p>}
      </section>

      <section className={card}>
        <h2 className="font-bold text-slate-900">2. 送る方を選ぶ</h2>
        {!base || (candidates.length > 0 && !checks && !checkError) ? (
          <p className="mt-2 text-sm text-slate-500">確かめています…</p>
        ) : checkError ? (
          <p role="alert" className="mt-2 text-sm text-red-700">送ってよいかを確かめられませんでした（{checkError}）。画面を読み直してください。</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-500">
              LINE で送れる方 {sendable.length}人（空いて間もない順）。チェックした方を、院長の LINE へ承認のお願いとして送ります。1回に{FOLLOWUP_REQUEST_MAX}人まで。
            </p>
            {sendable.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">いま、LINE で送れる方はいません。</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {sendable.map((c) => {
                  const check = checks?.get(c.patientId)
                  return (
                    <li key={c.patientId}>
                      <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2 text-sm">
                        <input type="checkbox" className="h-5 w-5 shrink-0" checked={picked.has(c.patientId)} onChange={() => toggle(c.patientId)} />
                        <span className="min-w-0 flex-1">
                          <span className="font-bold text-slate-900">{c.name}</span>
                          <span className="ml-1 text-slate-600">様</span>
                          <span className="block text-xs text-slate-500">
                            最後のご来院 {md(c.lastVisit)}（{c.days}日前）・来院 {c.visits}回
                            {check?.lastSentOn ? `・前のご連絡 ${md(check.lastSentOn)}` : ''}
                          </span>
                        </span>
                        <Link href={`/patients/${c.patientId}`} className="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-teal-700 hover:bg-teal-50" onClick={(e) => e.stopPropagation()}>
                          カルテ
                        </Link>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            {blocked.length > 0 && (
              <details className="mt-3 rounded-lg bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-700">LINE では送らない方 {blocked.length}人（理由を見る）</summary>
                <ul className="mt-2 divide-y divide-slate-200">
                  {blocked.map((c) => {
                    const check = checks?.get(c.patientId)
                    const reason = check?.block ? FOLLOWUP_BLOCK_TEXT[check.block] : ''
                    return (
                      <li key={c.patientId} className="flex items-center gap-3 py-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="font-bold text-slate-800">{c.name}</span>
                          <span className="ml-1 text-slate-600">様</span>
                          <span className="block text-xs text-slate-600">
                            最後のご来院 {md(c.lastVisit)}（{c.days}日前）・{reason}
                            {check?.detail ? `（${md(check.detail)}）` : ''}
                          </span>
                        </span>
                        {check?.block === 'not_linked' && c.phone && (
                          <a href={`tel:${digits(c.phone)}`} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-bold text-slate-700 hover:bg-white" aria-label={`${c.name}様に電話する`}>
                            <Phone className="h-4 w-4" aria-hidden />
                            電話
                          </a>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      <section className={card}>
        <h2 className="font-bold text-slate-900">3. 送る文</h2>
        <p className="mt-1 text-xs text-slate-500">
          {'{name}'} はお名前に置きかわります。症状・施術の内容・「治る」などの言葉は入れません。ご予約のリンク・お電話・止め方は、いつも最後に付きます。
        </p>
        <label htmlFor="followup-template" className="sr-only">送る文</label>
        <textarea
          id="followup-template"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={8}
          maxLength={FOLLOWUP_TEMPLATE_MAX + 50}
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
        />
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-500">{template.trim().length} / {FOLLOWUP_TEMPLATE_MAX}文字</span>
          <button type="button" className="font-bold text-teal-700 underline-offset-2 hover:underline" onClick={() => setTemplate(DEFAULT_FOLLOWUP_TEMPLATE)}>初めの文に戻す</button>
          {problem && <span role="alert" className="font-bold text-red-700">{problem}</span>}
        </div>
        <p className="mt-3 text-xs font-bold text-slate-700">届く文の見本{chosen[0] ? `（${chosen[0].name} 様の場合）` : '（お名前は見本）'}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-green-50 p-3 font-sans text-sm text-slate-800 ring-1 ring-green-200">
          {problem ? '（文を直すと、見本が出ます）' : followupText(template, chosen[0]?.name ?? '山田 太郎')}
        </pre>
        <Button type="button" variant="outline" className="mt-3" disabled={Boolean(problem) || Boolean(busy)} onClick={sample}>
          院長の LINE に見本を送る
        </Button>
      </section>

      <section className={cn(card, confirming && 'border-teal-600 ring-2 ring-teal-600/20')}>
        <h2 className="font-bold text-slate-900">4. 院長の LINE で承認する</h2>
        {!confirming ? (
          <>
            <p className="mt-1 text-sm text-slate-700">選んだ方 {chosen.length}人{overLimit ? `（1回のお願いは${FOLLOWUP_REQUEST_MAX}人までです。減らしてください）` : ''}</p>
            <Button type="button" className="mt-2 h-11 font-bold" disabled={chosen.length === 0 || overLimit || Boolean(problem) || Boolean(busy)} onClick={() => { setMessage(null); setConfirming(true) }}>
              選んだ方を確かめる
            </Button>
          </>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-sm font-bold text-slate-900">次の {chosen.length}人について、院長の LINE に承認のお願いを送ります。</p>
            <ul className="flex flex-wrap gap-2">
              {chosen.map((c) => (
                <li key={c.patientId} className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-900 ring-1 ring-teal-200">{c.name} 様</li>
              ))}
            </ul>
            <p className="text-xs text-slate-600">
              患者さんには、まだ送りません。院長の LINE に届く「全員に送る」「1人ずつ選ぶ」「今回は送らない」のボタンで決めます。
              お願いは{FOLLOWUP_REQUEST_HOURS}時間で期限が切れます。夜（20時〜朝8時）に承認した分は、次の朝に送ります。
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="h-11 font-bold" disabled={Boolean(busy)} onClick={request}>
                <Send className="mr-1.5 h-4 w-4" aria-hidden />
                院長の LINE に承認のお願いを送る（{chosen.length}人）
              </Button>
              <Button type="button" variant="ghost" className="h-11" disabled={Boolean(busy)} onClick={() => setConfirming(false)}>やめる</Button>
            </div>
          </div>
        )}
        {busy && <p className="mt-2 text-sm text-slate-600" role="status">{busy}</p>}
        {message && <p role={message.tone === 'error' ? 'alert' : 'status'} className={cn('mt-2 text-sm font-bold', message.tone === 'error' ? 'text-red-700' : 'text-teal-800')}>{message.text}</p>}
      </section>

      <section className={card}>
        <h2 className="font-bold text-slate-900">毎週のお願い（自動）</h2>
        <label className="mt-2 flex min-h-10 items-start gap-2 text-sm text-slate-800">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
          <span>
            毎週月曜の朝9時ごろ、候補（{FOLLOWUP_REQUEST_MAX}人まで）を院長の LINE へ送る
            <span className="block text-xs text-slate-500">
              届くのは院長の LINE だけです。承認のボタンを押した方にだけ、患者さんへ送ります。上の「1.」の日数と「3.」の文を使います。
              候補はクラウドのカルテの記録から出すので、最後のご来院の日にちを LINE でお確かめください。同じ方を、60日のうちにもう一度候補に出すことはありません。
            </span>
          </span>
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={!dirty || Boolean(problem)} onClick={saveSettings}>
            この設定を保存する（日数・文・毎週のお願い）
          </Button>
          {dirty && <span className="text-xs font-bold text-amber-800">まだ保存していません</span>}
          {settingsNote && <span role={settingsNote.tone === 'error' ? 'alert' : 'status'} className={cn('text-sm font-bold', settingsNote.tone === 'error' ? 'text-red-700' : 'text-teal-800')}>{settingsNote.text}</span>}
        </div>
      </section>

      <section className={card}>
        <h2 className="font-bold text-slate-900">最近のご連絡</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">まだ送っていません。</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {recent.map((r, i) => (
              <li key={`${r.at}-${i}`} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-slate-800">{r.name} 様</span>
                <span className={cn('text-xs', r.ok ? 'text-slate-500' : 'font-bold text-red-700')}>
                  {new Date(r.at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {r.ok ? '' : `・送れず${r.error ? `（${r.error}）` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
