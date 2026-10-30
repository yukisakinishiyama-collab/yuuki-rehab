'use client'
/**
 * 患者さんの動き（離反・リピート・会員）— 院長のみ・経営メニュー（隠しモード）の中
 *
 * - カルテ（この端末）から、最後に来た日と空いている日数を出し、帯ごとの人数と「声かけの候補」を出す
 * - NOAH のリピート率（先月来た人のうち今月まだ来ていない人 など）を月ごとに並べる
 * - 予約システムの「会員」のチェックがある方（予約のある方）と、LINE連携の人数
 * 名前はこの画面（院内）だけ。外部には何も送らない。計算は lib/marketing/patient-movement.ts（単体テストあり）
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronRight, Phone } from 'lucide-react'
import { useMarketingRole } from '@/lib/marketing/use-role'
import { getAttendanceRecords, getPatients, getSOAPNotes, initPatientStore } from '@/lib/patient-store'
import { useLineLinks } from '@/lib/line-link-client'
import type { NoahStore } from '@/lib/marketing/noah-types'
import { BANDS, bandOf, callCandidates, countBands, patientGaps, repeatRows, type PatientGap, type RepeatRow } from '@/lib/marketing/patient-movement'

const FEED_KEY_STORAGE = 'yoyaku_feed_key'

interface FeedRow {
  time: string
  name: string
  phone: string
  status: string
  reservationNo: string
  sub?: boolean
}
interface Feed {
  ok: boolean
  today?: string
  days?: Array<{ date: string; rows: FeedRow[] }>
}

const jstToday = () => {
  const t = new Date(Date.now() + 9 * 3_600_000)
  return t.toISOString().slice(0, 10)
}
const ymShort = (m: string) => `${m.slice(2, 4)}/${Number(m.slice(5, 7))}`
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
const digits = (v: string) => String(v || '').replace(/[^0-9]/g, '')
const nameKey = (v: string) => String(v || '').replace(/[\s　]/g, '')

export default function PatientMovementPage() {
  const { isAdmin } = useMarketingRole()
  const [gaps, setGaps] = useState<PatientGap[] | null>(null)
  const [noah, setNoah] = useState<NoahStore | null>(null)
  const [feed, setFeed] = useState<Feed | null>(null)
  const [feedError, setFeedError] = useState('')
  const { links, linkFor } = useLineLinks()
  const today = jstToday()

  useEffect(() => {
    // カルテ（この端末）から。effect の中で state を入れるのは、localStorage を読むのが最初の1回だけだから
    initPatientStore()
    const patients = getPatients()
    const visits = [
      ...getSOAPNotes().map((n) => ({ patientId: n.patientId, visitDate: n.visitDate })),
      ...getAttendanceRecords()
        .filter((a) => a.status === 'visited')
        .map((a) => ({ patientId: a.patientId, visitDate: a.visitDate })),
    ]
    const computed = patientGaps(patients, visits, today)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 端末のカルテを最初に1回読むだけ
    setGaps(computed)
    fetch('/api/marketing/noah?lite=1', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { store?: NoahStore | null } | null) => setNoah(d?.store ?? null))
      .catch(() => setNoah(null))
    let key = ''
    try {
      key = localStorage.getItem(FEED_KEY_STORAGE) || ''
    } catch {
      /* noop */
    }
    if (key) {
      fetch(`/api/yoyaku/feed?key=${encodeURIComponent(key)}&days=14&back=30`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: Feed) => (d.ok ? setFeed(d) : setFeedError('予約システムから読めませんでした')))
        .catch(() => setFeedError('予約システムから読めませんでした'))
    } else {
      setFeedError('「今日の予約」で予約システムと連携すると、会員の方が出ます')
    }
  }, [today])

  const bands = useMemo(() => (gaps ? countBands(gaps) : null), [gaps])
  const candidates = useMemo(() => (gaps ? callCandidates(gaps) : []), [gaps])
  const repeat = useMemo<RepeatRow[]>(() => (noah ? repeatRows(noah.months ?? []) : []), [noah])
  const subs = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; next: string | null; last: string | null }>()
    for (const day of feed?.days ?? []) {
      for (const r of day.rows) {
        if (!r.sub || r.status === 'キャンセル') continue
        const k = `${digits(r.phone)}|${nameKey(r.name)}`
        const cur = map.get(k) ?? { name: r.name, phone: r.phone, next: null, last: null }
        if (day.date >= today) cur.next = cur.next && cur.next < day.date ? cur.next : day.date
        else cur.last = cur.last && cur.last > day.date ? cur.last : day.date
        map.set(k, cur)
      }
    }
    return [...map.values()].sort((a, b) => (a.next ?? '9').localeCompare(b.next ?? '9'))
  }, [feed, today])

  const repeatChart = useMemo(
    () =>
      [...repeat]
        .reverse()
        .filter((r) => r.last !== null)
        .map((r) => ({ label: ymShort(r.month), 継続: (r.last ?? 0) - (r.gone ?? 0), 未来院: r.gone ?? 0, rate: r.rate === null ? null : Math.round(r.rate * 100) })),
    [repeat],
  )

  if (!isAdmin) return <p className="text-sm text-slate-600">この画面は院長だけが使えます。</p>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900">患者さんの動き</h1>
        <p className="text-xs text-slate-500">離反・リピート・会員。名前はこの画面（院内）だけで、外には送りません。</p>
      </div>

      {/* 帯ごとの人数 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold text-slate-900">最後の来院からの日数（カルテ {gaps?.length ?? '…'}名）</h2>
        <p className="text-xs text-slate-500">カルテの SOAP・来院記録・NOAHの最終来院のいちばん新しい日から。終了・紹介の方は除く。</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          {BANDS.map((b) => (
            <div key={b.key} className={`rounded-lg border p-2.5 ${b.key === 'active' ? 'border-emerald-200 bg-emerald-50' : b.key === 'w2' ? 'border-amber-200 bg-amber-50' : b.key === 'none' ? 'border-slate-200 bg-slate-50' : 'border-red-100 bg-red-50/60'}`}>
              <div className="text-xs text-slate-600">{b.label}</div>
              <div className="text-xl font-black tabular-nums text-slate-900">{bands ? bands[b.key] : '…'}<span className="text-xs font-bold text-slate-500">名</span></div>
              <div className="text-xs text-slate-500">{b.hint}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 声かけの候補 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold text-slate-900">声かけの候補（2〜8週間空いていて、2回以上来られた方）</h2>
        <p className="text-xs text-slate-500">
          早いうちの声かけほど戻りやすいので、空いて間もない順です。文面は<Link href="/dashboard" className="underline">今日</Link>の「声かけ文」が使えます。LINE連携済みの方には、次の段階でLINEからも送れるようにします。
        </p>
        {candidates.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">いまは候補がいません。</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {candidates.map((g) => {
              const link = linkFor({ name: g.name, phone: g.phone })
              return (
                <li key={g.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-slate-900">{g.name}</span>
                    {link && <span className="ml-2 rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs font-bold text-green-700">LINE</span>}
                    <div className="text-xs text-slate-500">
                      最後の来院 {g.lastVisit ? md(g.lastVisit) : '—'}（{g.days}日前）・来院 {g.visits}回
                    </div>
                  </div>
                  {g.phone && (
                    <a href={`tel:${digits(g.phone)}`} className="rounded-md p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-700" title={g.phone}>
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  <Link href={`/patients/${g.id}`} className="inline-flex items-center gap-0.5 rounded-md bg-teal-50 px-2 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100">
                    カルテ
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* NOAH のリピート */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold text-slate-900">NOAH のリピート（先月来られた方が、今月も来ているか）</h2>
        {repeat.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">NOAH の集計がまだありません。</p>
        ) : (
          <>
            <div className="mt-2 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={repeatChart} margin={{ top: 10, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="継続" stackId="a" fill="#0f766e" maxBarSize={24} isAnimationActive={false} />
                  <Bar dataKey="未来院" stackId="a" fill="#f59e0b" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left">月</th>
                    <th className="px-2 py-1.5 text-right">先月来た人</th>
                    <th className="px-2 py-1.5 text-right">今月まだ</th>
                    <th className="px-2 py-1.5 text-right">継続率</th>
                    <th className="px-2 py-1.5 text-right">内訳（継続中/治癒/中止/転医）</th>
                    <th className="px-2 py-1.5 text-right">自費の方</th>
                    <th className="px-2 py-1.5 text-right">新患/再初検</th>
                  </tr>
                </thead>
                <tbody>
                  {repeat.map((r) => (
                    <tr key={r.month} className="border-t border-slate-100">
                      <td className="px-2 py-1 text-slate-700">
                        {ymShort(r.month)}
                        {!r.complete && <span className="ml-1 text-xs text-amber-700">途中</span>}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.last ?? '—'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.gone ?? '—'}</td>
                      <td className="px-2 py-1 text-right font-bold tabular-nums">{r.rate === null ? '—' : `${Math.round(r.rate * 100)}%`}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-slate-600">
                        {r.goneCont ?? '—'}/{r.cured ?? '—'}/{r.stopped ?? '—'}/{r.moved ?? '—'}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.selfGone ?? '—'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.newPt ?? '—'}/{r.reinit ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-slate-500">「今月まだ」は NOAH の「月間離反」。途中の月は月末に向けて減っていきます。内訳は NOAH の区分（継続中＝まだ通院の予定がある方）。</p>
          </>
        )}
      </section>

      {/* 会員・LINE */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold text-slate-900">会員（月額）の方 {feed ? `${subs.length}名` : ''}</h2>
          <p className="text-xs text-slate-500">予約管理画面で「会員」にチェックした方のうち、この30日〜14日先に予約のある方。</p>
          {feedError && <p className="mt-2 text-xs text-amber-700">{feedError}</p>}
          {feed && subs.length === 0 && <p className="mt-2 text-sm text-slate-500">予約のある会員の方はいません。</p>}
          {subs.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {subs.map((s) => (
                <li key={`${s.phone}-${s.name}`} className="flex items-center justify-between py-1.5">
                  <span className="font-bold text-slate-900">{s.name}</span>
                  <span className="text-xs text-slate-500">{s.next ? `次 ${md(s.next)}` : s.last ? `最後 ${md(s.last)}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold text-slate-900">LINE連携済みの方 {links ? `${links.length}名` : '…'}</h2>
          <p className="text-xs text-slate-500">カルテと公式LINEが結びついている方。誕生日のご挨拶など、院からの連絡をLINEで送れます。</p>
          {gaps && links && (
            <p className="mt-2 text-sm text-slate-700">
              声かけの候補 {candidates.length}名のうち、LINEで連絡できる方 {candidates.filter((g) => linkFor({ name: g.name, phone: g.phone })).length}名。
              離れた方（{BANDS.find((b) => b.key === 'm3plus')!.label}）{bands?.m3plus ?? 0}名のうち {gaps.filter((g) => bandOf(g.days) === 'm3plus' && linkFor({ name: g.name, phone: g.phone })).length}名。
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            受付の案内は<Link href="/marketing/line" className="underline">集客 → LINE導線</Link>の「カルテ連携」から。
          </p>
        </div>
      </section>
    </div>
  )
}
