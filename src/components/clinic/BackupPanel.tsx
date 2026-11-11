'use client'
/**
 * 設定 → バックアップ
 * - パソコンに保存（保存先のフォルダを一度選べば、次からはボタン1つ。写真も足していく）
 * - クラウドの毎月の控え（毎月1回、自動で作る。12か月分。ここから取り出せる）
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Cloud, FolderOpen, HardDriveDownload } from 'lucide-react'
import { ROLE_COOKIE } from '@/lib/marketing/auth-shared'
import {
  chooseFolder,
  getSavedFolder,
  lastPcBackupAt,
  saveBackupToPc,
  supportsFolder,
  type BackupProgress,
  type SaveResult,
} from '@/lib/backup/client'

interface MonthEntry {
  ym: string
  createdAt: string
  chars: number
  counts: Record<string, number>
}

function fmt(iso: string | null): string {
  if (!iso) return 'まだありません'
  return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isStaff(): boolean {
  try {
    return document.cookie.split('; ').some((row) => row === `${ROLE_COOKIE}=staff`)
  } catch {
    return false
  }
}

const noSubscribe = () => () => {}

export default function BackupPanel() {
  const [folderName, setFolderName] = useState<string | null>(null)
  // 端末の中の値（サーバーで作る最初の画面では読めないので、読めたら差しかえる）
  const canFolder = useSyncExternalStore(noSubscribe, supportsFolder, () => false)
  const staff = useSyncExternalStore(noSubscribe, isStaff, () => false)
  const storedLast = useSyncExternalStore(noSubscribe, lastPcBackupAt, () => null)
  const [savedLast, setSavedLast] = useState<string | null>(null)
  const last = savedLast ?? storedLast
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<BackupProgress | null>(null)
  const [result, setResult] = useState<SaveResult | null>(null)
  const [months, setMonths] = useState<MonthEntry[] | null>(null)
  const [cloudMsg, setCloudMsg] = useState('')

  async function fetchMonths(): Promise<MonthEntry[]> {
    try {
      const res = await fetch('/api/backup?part=list', { cache: 'no-store' })
      if (!res.ok) return []
      const body = (await res.json()) as { backups: MonthEntry[] }
      return body.backups ?? []
    } catch {
      return []
    }
  }

  useEffect(() => {
    let alive = true
    void getSavedFolder().then((d) => alive && setFolderName(d?.name ?? null))
    void fetchMonths().then((list) => alive && setMonths(list))
    return () => {
      alive = false
    }
  }, [])

  async function pickFolder() {
    try {
      const dir = await chooseFolder()
      if (dir) setFolderName(dir.name)
    } catch {
      // 選ぶのをやめたとき
    }
  }

  async function save() {
    setBusy(true)
    setResult(null)
    const r = await saveBackupToPc(true, setProgress)
    setBusy(false)
    setProgress(null)
    setResult(r)
    setSavedLast(lastPcBackupAt())
  }

  async function cloudNow() {
    setCloudMsg('')
    const res = await fetch('/api/backup', { method: 'POST' })
    const body = (await res.json().catch(() => ({}))) as { ym?: string; error?: string }
    setCloudMsg(res.ok ? `${body.ym} の控えを今の内容で作りました` : body.error ?? '作れませんでした')
    setMonths(await fetchMonths())
  }

  async function downloadMonth(ym: string) {
    const res = await fetch(`/api/backup?part=month&ym=${ym}`, { cache: 'no-store' })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ゆうき整骨院_アプリの毎月の控え_${ym}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-lg font-bold">バックアップ（データの控え）</h2>
        <p className="mt-1 text-sm text-slate-600">
          カルテ（患者さん・SOAP・評価・アウトカム・問診・メモ）、署名済みの契約書・同意書、患部の写真を控えます。
          クラウドの控えとは別に、院のパソコンにも保存しておくと安心です。
        </p>
      </div>

      {staff && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          バックアップには患者さんの情報がすべて入るため、院長（管理者）のパスワードで入ったときだけ作れます。
        </p>
      )}

      {/* パソコンに保存 */}
      <div className="space-y-3 rounded-lg border border-slate-200 p-3">
        <h3 className="flex items-center gap-2 font-bold text-slate-800">
          <HardDriveDownload className="h-4 w-4 text-teal-700" aria-hidden />
          パソコンに保存
        </h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">最後に保存した日時（この端末）</dt>
            <dd className="font-bold text-slate-800">{fmt(last)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">保存先のフォルダ</dt>
            <dd className="font-bold text-slate-800">
              {canFolder ? folderName ?? 'まだ選んでいません' : 'このブラウザではフォルダを選べません（ダウンロードで保存します）'}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {canFolder && (
            <button
              type="button"
              onClick={pickFolder}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FolderOpen className="h-4 w-4" aria-hidden />
              {folderName ? '保存先のフォルダを変える' : '保存先のフォルダを選ぶ'}
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy || staff}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <HardDriveDownload className="h-4 w-4" aria-hidden />
            {busy ? '保存しています…' : 'パソコンに保存する'}
          </button>
        </div>
        {progress && (
          <p role="status" className="text-sm text-slate-600">
            {progress.step}
            {progress.total ? `（${progress.done ?? 0}／${progress.total}）` : '…'}
          </p>
        )}
        {result && (
          <p role="status" className={`rounded-lg p-3 text-sm ${result.ok ? 'bg-teal-50 text-teal-900' : 'bg-red-50 text-red-700'}`}>
            {result.ok
              ? result.where === 'folder'
                ? `「${result.folderName}」フォルダに保存しました：${result.fileName}${result.photosAdded ? `（写真を${result.photosAdded}枚追加）` : ''}`
                : `ダウンロードしました：${result.fileName}（写真の画像は入っていません。院のパソコンの Chrome でフォルダを選ぶと写真も保存できます）`
              : result.error ?? '保存できませんでした'}
            {result.ok && result.counts && (
              <span className="mt-1 block text-xs">
                {Object.entries(result.counts)
                  .map(([k, v]) => `${k} ${v}`)
                  .join('・')}
              </span>
            )}
          </p>
        )}
        {canFolder && (
          <p className="text-xs text-slate-500">
            フォルダを選ぶと、ブラウザが場所を覚えます。「今日」の画面を開いたときにも1日1回、自動で保存します（ブラウザの許可が残っているとき。許可を聞かれたら「毎回許可する」を選んでください）。
          </p>
        )}
      </div>

      {/* クラウドの毎月の控え */}
      <div className="space-y-3 rounded-lg border border-slate-200 p-3">
        <h3 className="flex items-center gap-2 font-bold text-slate-800">
          <Cloud className="h-4 w-4 text-teal-700" aria-hidden />
          クラウドの毎月の控え（自動・12か月分）
        </h3>
        <p className="text-sm text-slate-600">毎月1回（その月の最初の夜中）、カルテ全部と写真の一覧の控えを自動で作ります。</p>
        {months === null ? (
          <p className="text-sm text-slate-500">読み込んでいます…</p>
        ) : months.length === 0 ? (
          <p className="text-sm text-slate-500">まだ控えはありません（今夜から作られます）。</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {months.map((m) => (
              <li key={m.ym} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <b>{m.ym.replace('-', '年')}月</b>
                  <span className="ml-2 text-xs text-slate-500">
                    {fmt(m.createdAt)} 作成・患者さん {m.counts?.['患者さん'] ?? 0}・SOAP {m.counts?.SOAP ?? 0}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => downloadMonth(m.ym)}
                  className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
                >
                  この控えを取り出す
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={cloudNow}
            disabled={staff}
            className="min-h-11 rounded-lg border border-teal-200 bg-white px-4 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
          >
            今すぐクラウドにも控える
          </button>
          {cloudMsg && (
            <span role="status" className="text-sm text-slate-600">
              {cloudMsg}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
