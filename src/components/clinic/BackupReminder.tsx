'use client'
/**
 * 「今日」の画面のバックアップ（院長のパソコンだけ）
 * - 保存先のフォルダが決まっていて、ブラウザの許可が残っていれば、1日1回だまってパソコンに保存する
 * - 7日以上保存していなければ、小さなお知らせと「パソコンに保存する」ボタンを出す
 * フォルダを選べないブラウザ（iPad・スマホ）やスタッフのログインでは何も出さない。
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HardDriveDownload } from 'lucide-react'
import { ROLE_COOKIE } from '@/lib/marketing/auth-shared'
import { getSavedFolder, lastPcBackupAt, saveBackupToPc, supportsFolder } from '@/lib/backup/client'

const DAY = 24 * 3600 * 1000

export default function BackupReminder() {
  const [show, setShow] = useState<'none' | 'old' | 'never'>('none')
  const [hasFolder, setHasFolder] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!supportsFolder()) return
    if (document.cookie.split('; ').some((row) => row === `${ROLE_COOKIE}=staff`)) return
    let alive = true
    void (async () => {
      const folder = await getSavedFolder()
      if (!alive) return
      setHasFolder(Boolean(folder))
      const last = lastPcBackupAt()
      const age = last ? Date.now() - new Date(last).getTime() : Infinity
      if (folder && age > 20 * 3600 * 1000) {
        // 許可が残っていれば、だまって保存（許可を聞く画面は出さない）
        const r = await saveBackupToPc(false)
        if (!alive) return
        if (r.ok) {
          setMsg(`パソコンの「${r.folderName}」にバックアップを保存しました`)
          setTimeout(() => alive && setMsg(''), 8000)
          return
        }
      }
      if (age > 7 * DAY) setShow(last ? 'old' : 'never')
    })()
    return () => {
      alive = false
    }
  }, [])

  async function save() {
    setBusy(true)
    const r = await saveBackupToPc(true)
    setBusy(false)
    if (r.ok) {
      setShow('none')
      setMsg(r.where === 'folder' ? `パソコンの「${r.folderName}」にバックアップを保存しました` : `${r.fileName} をダウンロードしました`)
      setTimeout(() => setMsg(''), 8000)
    } else if (r.error) {
      setMsg(r.error)
    }
  }

  if (msg && show === 'none') {
    return (
      <p role="status" className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
        {msg}
      </p>
    )
  }
  if (show === 'none') return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
      <p className="text-sm">
        <b>{show === 'never' ? 'パソコンへのバックアップがまだありません。' : 'パソコンへのバックアップが7日以上ありません。'}</b>
        {hasFolder ? '' : '最初に「設定 → バックアップ」で保存先のフォルダを選ぶと、次から自動で保存します。'}
        {msg && <span className="ml-1 text-red-700">{msg}</span>}
      </p>
      <div className="flex gap-2">
        {!hasFolder && (
          <Link href="/marketing/settings#backup" className="inline-flex min-h-10 items-center rounded-lg border border-amber-400 bg-white px-3 text-sm font-medium">
            設定を開く
          </Link>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-teal-700 px-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          <HardDriveDownload className="h-4 w-4" aria-hidden />
          {busy ? '保存しています…' : 'パソコンに保存する'}
        </button>
      </div>
    </div>
  )
}
