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

  /** 患者さんに結びついた LINE（無ければ null。まだ読めていなければ undefined） */
  const linkFor = useCallback(
    (patient: Pick<Patient, 'name' | 'phone'>): LineLinkSummary | null | undefined => {
      if (links === null) return undefined
      const key = patientLinkKey(patient.name, patient.phone)
      if (!key) return null
      return links.find((l) => l.key === key) ?? null
    },
    [links],
  )

  return { links, error, linkFor, unlink, reload }
}
