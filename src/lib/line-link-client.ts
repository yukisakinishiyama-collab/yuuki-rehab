'use client'
/**
 * カルテの画面で「この患者さんはLINEと結びついているか」を知るための小さなフック
 *
 * 患者さんがLINEで連携したら、すぐ画面に出す（院長の希望。2026-10-31）:
 * - 画面を開いたら、控え（このタブの中だけ）があれば先に出し、必ずサーバーから取り直す
 * - 画面を開いている間は30秒ごとに取り直す（画面が隠れている間は止める）
 * - アプリに戻ってきたとき（ほかのアプリから切り替え・スマホの画面をつけたとき）にもすぐ取り直す
 * 同じタブの中の複数の画面（一覧の行・カード）は、取り直しを1回にまとめる。
 */
import { useCallback, useEffect, useState } from 'react'
import { patientLinkKey, type LineLinkSummary } from '@/lib/line-link'
import type { Patient } from '@/types/patient'

const CACHE_KEY = 'line_link_cache'
/** 控えを先に出してよい古さ（出したあと、すぐ取り直す） */
const CACHE_MS = 30 * 60 * 1000
/** 画面を開いている間に取り直す間隔 */
const REFRESH_MS = 30 * 1000

/** 氏名の比べ方（空白を取り、全角・半角をそろえる。NOAH 取り込みの nameKey と同じ） */
const sameNameKey = (name: string): string => String(name || '').normalize('NFKC').replace(/\s+/g, '')

interface Cache {
  at: number
  links: LineLinkSummary[]
}

function readCache(): Cache | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Cache
    return Date.now() - c.at < CACHE_MS ? c : null
  } catch {
    return null
  }
}

/** 同じタブで同時に取り直さない（一覧の行がそれぞれこのフックを使うため） */
let inflight: Promise<LineLinkSummary[]> | null = null

function fetchLinks(): Promise<LineLinkSummary[]> {
  if (inflight) return inflight
  inflight = fetch('/api/line-link', { cache: 'no-store' })
    .then(async (res) => {
      const data = (await res.json().catch(() => null)) as { ok?: boolean; links?: LineLinkSummary[]; error?: string } | null
      if (!res.ok || !data?.ok || !data.links) throw new Error(data?.error || `HTTP ${res.status}`)
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), links: data.links } satisfies Cache))
      } catch {
        /* 控えは無くてもよい */
      }
      return data.links
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useLineLinks() {
  const [links, setLinks] = useState<LineLinkSummary[] | null>(() => readCache()?.links ?? null)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    // サーバーから取り直して、終わってから state に入れる（effect の中で同期に setState しない）
    return fetchLinks()
      .then((next) => {
        setLinks(next)
        setError('')
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '読み込みに失敗'))
  }, [])

  // 開いたらすぐ取り直す。開いている間は30秒ごと、アプリに戻ってきたときもすぐ取り直す
  useEffect(() => {
    void reload()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload()
    }, REFRESH_MS)
    const onBack = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', onBack)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onBack)
      window.removeEventListener('focus', onBack)
    }
  }, [reload])

  const unlink = useCallback(
    async (key: string) => {
      const res = await fetch(`/api/line-link?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('外せませんでした')
      try {
        sessionStorage.removeItem(CACHE_KEY)
      } catch {
        /* noop */
      }
      await reload()
    },
    [reload],
  )

  /**
   * 患者さんに結びついた LINE（無ければ null。まだ読めていなければ undefined）
   *
   * 1. 電話番号＋氏名が同じ LINE（予約システムと同じ見分け方）
   * 2. 見つからなければ、氏名＋生年月日が同じ LINE。
   *    カルテに電話番号が無い方（NOAH から取り込んだカルテなど）や、カルテの電話（自宅）と
   *    患者さんが LINE で入れた電話（携帯）が違う方も、LINE 連携済みとして出す。
   *    生年月日は患者さんが連携のときに自分で入れたもの（サーバーでも、カルテと違えば結びつけない）
   */
  const linkFor = useCallback(
    (patient: Pick<Patient, 'name' | 'phone'> & { birthDate?: string }): LineLinkSummary | null | undefined => {
      if (links === null) return undefined
      const key = patientLinkKey(patient.name, patient.phone)
      const byKey = key ? links.find((l) => l.key === key) : undefined
      if (byKey) return byKey
      const name = sameNameKey(patient.name)
      if (!name || !patient.birthDate) return null
      return links.find((l) => l.birthDate === patient.birthDate && sameNameKey(l.name) === name) ?? null
    },
    [links],
  )

  return { links, error, linkFor, unlink, reload }
}
