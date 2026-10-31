'use client'
/**
 * カルテの画面で「この患者さんはLINEと結びついているか」を知るための小さなフック
 * /api/line-link の一覧を1回読んで（端末内で2分だけ控える）、患者ごとにキーで引く。
 */
import { useCallback, useEffect, useState } from 'react'
import { patientLinkKey, type LineLinkSummary } from '@/lib/line-link'
import type { Patient } from '@/types/patient'

const CACHE_KEY = 'line_link_cache'
const CACHE_MS = 2 * 60 * 1000

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

export function useLineLinks() {
  const [links, setLinks] = useState<LineLinkSummary[] | null>(() => readCache()?.links ?? null)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    // サーバーから取り直して、終わってから state に入れる（effect の中で同期に setState しない）
    return fetch('/api/line-link', { cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { ok?: boolean; links?: LineLinkSummary[]; error?: string } | null
        if (!res.ok || !data?.ok || !data.links) throw new Error(data?.error || `HTTP ${res.status}`)
        setLinks(data.links)
        setError('')
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), links: data.links } satisfies Cache))
        } catch {
          /* 控えは無くてもよい */
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '読み込みに失敗'))
  }, [])

  useEffect(() => {
    if (readCache()) return
    void reload()
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
