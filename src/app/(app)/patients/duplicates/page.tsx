'use client'
// ──────────────────────────────────────────────
// 重複したカルテの整理
// 同じ方のカルテが2つ以上あるとき、「最後に記録した日」がいちばん新しいカルテを残し、
// ほかのカルテの記録（SOAP・評価・メモ・キャンセルなど）を残す方へ移してから、ほかのカルテを消す。
// ルールと仕組みは src/lib/karte-dedupe.ts。患者さんの情報はこの端末の中だけで扱う。
// 消すのは院長だけ。消す前に、端末の全データの控え（JSON）を保存する。
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ExternalLink, Users } from 'lucide-react'
import { getPatients, initPatientStore } from '@/lib/patient-store'
import {
  applyMerge,
  backupJson,
  defaultMode,
  findDuplicateGroups,
  readRecordStore,
  unitsFor,
  writeMerge,
  type GroupMode,
  type MemberInfo,
  type NameGroup,
} from '@/lib/karte-dedupe'
import { getPinnedIds, getRecentViews } from '@/lib/patient-ui-prefs'
import { useMarketingRole } from '@/lib/marketing/use-role'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** 日本時間の今日 'YYYY-MM-DD' */
function jstToday(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())
}

function shortDay(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—'
  const [y, m, dd] = d.split('-').map(Number)
  return `${y}/${m}/${dd}`
}

const tail4 = (phone: string) => {
  const d = (phone ?? '').replace(/\D/g, '')
  return d ? `…${d.slice(-4)}` : '—'
}

function downloadBackup(): string {
  const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(/[-: ]/g, '').slice(0, 12)
  const name = `karte-backup-${stamp}.json`
  const blob = new Blob([backupJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return name
}

const MODE_LABELS: Record<GroupMode, string> = {
  sure: '同じ方だけまとめる',
  all: '全員まとめる',
  none: 'まとめない',
}

export default function DuplicateKartePage() {
  const { isAdmin } = useMarketingRole()
  const [groups, setGroups] = useState<NameGroup[] | null>(null)
  const [modes, setModes] = useState<Record<string, GroupMode>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  function load() {
    initPatientStore()
    const found = findDuplicateGroups(getPatients(), readRecordStore(), jstToday())
    setGroups(found)
    setModes(Object.fromEntries(found.map((g) => [g.key, defaultMode(g)])))
  }

  // まず クラウドの最新の控えを取り込んでから探す（ほかの端末で書いた記録も入れて決めるため）
  useEffect(() => {
    let alive = true
    import('@/lib/sync-service')
      .then(async ({ isSyncEnabled, pullFromCloud }) => {
        if (isSyncEnabled()) await pullFromCloud()
      })
      .catch(() => {})
      .finally(() => {
        if (alive) load()
      })
    return () => {
      alive = false
    }
  }, [])

  const units = useMemo(
    () => (groups ?? []).flatMap((g) => unitsFor(g, modes[g.key] ?? defaultMode(g))),
    [groups, modes],
  )
  const removeCount = units.reduce((n, u) => n + u.members.length - 1, 0)
  const sureCount = (groups ?? []).filter((g) => g.sureUnits.length > 0).length
  const unsureCount = (groups ?? []).filter((g) => g.hasUnsure).length

  async function run() {
    if (!groups || units.length === 0 || busy) return
    const ok = window.confirm(
      `${units.length}人分のカルテをまとめ、${removeCount}件のカルテを消します。\n` +
        '消す方のカルテの記録は、残す方のカルテへ移します。\n' +
        'はじめに、この端末の全データの控え（ファイル）を保存します。よろしいですか？',
    )
    if (!ok) return
    setBusy(true)
    setMessage(null)
    try {
      // 画面を開いてから別の画面で変わっていないかを確かめる（変わっていたら、読み直してもらう）
      initPatientStore()
      const patientsNow = getPatients()
      const ids = new Set(patientsNow.map((p) => p.id))
      const stale = units.some((u) => u.members.some((m) => !ids.has(m.patient.id)))
      if (stale) {
        load()
        setMessage({ kind: 'error', text: 'カルテが変わっていたので、一覧を読み直しました。もう一度確かめてから押してください。' })
        return
      }
      const fileName = downloadBackup()
      const result = applyMerge(patientsNow, readRecordStore(), units, getPinnedIds(), getRecentViews(), new Date().toISOString())
      const { cloud } = await writeMerge(result)
      load()
      setMessage({
        kind: 'ok',
        text:
          `${result.removed}件のカルテを消し、記録${result.moved}件を残す方のカルテへ移しました。控えのファイル「${fileName}」を保存しました。` +
          (cloud ? 'クラウドにも保存しました。' : 'クラウドへは保存できませんでした。メニューの「カルテをクラウドへ保存」を押してください。') +
          (result.droppedSingles > 0 ? `（目標・説明の上書きが重なっていた${result.droppedSingles}件は、新しい方を残しました）` : ''),
      })
    } catch (error) {
      setMessage({ kind: 'error', text: `まとめられませんでした（${error instanceof Error ? error.message : '不明'}）。カルテは変えていません。` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/patients" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 max-lg:min-h-10">
          ← カルテ一覧
        </Link>
        <h1 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">重複したカルテの整理</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          同じ方のカルテが2つ以上あるとき、<strong>最後に記録した日がいちばん新しいカルテ</strong>を残します（記録が無いときは登録日）。
          消す方のカルテの記録（SOAP・評価・メモ・キャンセルなど）は、消さずに残す方のカルテへ移します。
          「同じ方」は、お名前が同じで、<strong>生年月日か電話番号も同じ</strong>カルテです。
        </p>
      </div>

      {groups === null && <p className="text-sm text-slate-600">最新のカルテを読み込んでいます…</p>}

      {message && (
        <div
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-xl border p-3 text-sm',
            message.kind === 'ok' ? 'border-green-300 bg-green-50 text-green-900' : 'border-red-300 bg-red-50 text-red-800',
          )}
        >
          {message.kind === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          <p className="leading-relaxed">{message.text}</p>
        </div>
      )}

      {groups && groups.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 p-4 text-sm font-bold text-green-900">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          同じお名前のカルテはありません。
        </div>
      )}

      {groups && groups.length > 0 && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p>
              同じ方と思われるカルテ：<strong>{sureCount}人分</strong>
              {unsureCount > 0 && (
                <>
                  ／ お名前だけ同じ（別の方かも）：<strong>{unsureCount}人分</strong>
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              名前ごとに「まとめる・まとめない」を選べます。お名前だけ同じで生年月日も電話も違う方は、最初は「まとめない」にしています。
            </p>
          </div>

          <ul className="space-y-3">
            {groups.map((g) => {
              const mode = modes[g.key] ?? defaultMode(g)
              const chosen = unitsFor(g, mode)
              const keepIds = new Set(chosen.map((u) => u.keep.patient.id))
              const removeIds = new Set(chosen.flatMap((u) => u.members.filter((m) => m.patient.id !== u.keep.patient.id).map((m) => m.patient.id)))
              const options: GroupMode[] = g.sureUnits.length > 0 ? (g.hasUnsure ? ['sure', 'all', 'none'] : ['sure', 'none']) : ['all', 'none']
              return (
                <li key={g.key} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Users className="h-4 w-4 text-teal-700" aria-hidden />
                    <h2 className="text-base font-bold text-slate-900">{g.name}</h2>
                    <span className="text-xs text-slate-600">{g.all.length}件</span>
                    {g.hasUnsure && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-900">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        生年月日も電話も違う方がいます（別の方かも）
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={`${g.name}のまとめ方`}>
                    {options.map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={mode === m}
                        onClick={() => setModes((prev) => ({ ...prev, [g.key]: m }))}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-sm font-bold max-lg:min-h-10',
                          mode === m ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        {MODE_LABELS[m]}
                      </button>
                    ))}
                  </div>

                  <ul className="mt-3 divide-y divide-slate-100">
                    {g.all.map((m: MemberInfo) => {
                      const keep = keepIds.has(m.patient.id)
                      const remove = removeIds.has(m.patient.id)
                      return (
                        <li key={m.patient.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                          <span
                            className={cn(
                              'inline-flex w-16 shrink-0 justify-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-bold',
                              keep && 'border-teal-700 bg-teal-50 text-teal-800',
                              remove && 'border-red-300 bg-red-50 text-red-700',
                              !keep && !remove && 'border-slate-300 bg-slate-50 text-slate-600',
                            )}
                          >
                            {keep ? '残す' : remove ? '消す' : 'そのまま'}
                          </span>
                          <span className="text-slate-700">
                            {m.activityFromCreated ? '登録日' : '最後の記録'} <strong className="text-slate-900">{shortDay(m.lastActivity)}</strong>
                          </span>
                          <span className="text-slate-600">記録 {m.recordCount}件</span>
                          <span className="text-slate-600">生年月日 {m.patient.birthDate ? shortDay(m.patient.birthDate) : '—'}</span>
                          <span className="text-slate-600">電話 {tail4(m.patient.phone)}</span>
                          {m.patient.noah?.ids?.length ? <span className="text-slate-600">NOAH {m.patient.noah.ids.length}件</span> : null}
                          <Link
                            href={`/patients/${m.patient.id}`}
                            target="_blank"
                            rel="noopener"
                            className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:underline max-lg:min-h-10"
                          >
                            カルテを見る
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            })}
          </ul>

          <div className="sticky bottom-20 rounded-xl border border-slate-300 bg-white p-4 shadow-lg lg:bottom-4">
            <p className="text-sm text-slate-700">
              まとめる：<strong>{units.length}人分</strong>（消すカルテ <strong>{removeCount}件</strong>）。押すと、はじめにこの端末の全データの控え（ファイル）を保存します。
            </p>
            {isAdmin ? (
              <button
                type="button"
                disabled={busy || units.length === 0}
                onClick={() => void run()}
                className={cn(buttonVariants({ variant: 'destructive' }), 'mt-3 w-full sm:w-auto')}
              >
                {busy ? 'まとめています…' : `まとめて、${removeCount}件のカルテを消す`}
              </button>
            ) : (
              <p className="mt-2 text-xs font-bold text-slate-600">まとめる（消す）のは院長だけです。</p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              まとめたあと、ほかの端末（スタッフのスマホなど）は、いったんアプリを開き直してください。開いたままの古い画面で保存すると、消したカルテが戻ることがあります。
            </p>
          </div>
        </>
      )}
    </div>
  )
}
