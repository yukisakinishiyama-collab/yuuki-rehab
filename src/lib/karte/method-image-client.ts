'use client'
/**
 * 測り方の図の一覧をブラウザで読む（アプリを開いているあいだは1回だけ読み、作り直したら入れかえる）
 */
import { useEffect, useState } from 'react'
import type { MethodImageStore } from './method-images'

export interface MethodImagesState {
  items: MethodImageStore
  configured: boolean
}

let cache: MethodImagesState | null = null
let inflight: Promise<MethodImagesState | null> | null = null
const listeners = new Set<(s: MethodImagesState) => void>()

export function loadMethodImages(force = false): Promise<MethodImagesState | null> {
  if (cache && !force) return Promise.resolve(cache)
  if (inflight && !force) return inflight
  inflight = fetch('/api/karte/method-images', { cache: 'no-store' })
    .then(async (r) => {
      const d = (await r.json().catch(() => null)) as ({ ok?: boolean } & Partial<MethodImagesState>) | null
      if (!r.ok || !d?.ok) return null
      return setMethodImages({ items: d.items ?? {}, configured: Boolean(d.configured) })
    })
    .catch(() => null)
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function setMethodImages(s: MethodImagesState): MethodImagesState {
  cache = s
  for (const l of listeners) l(s)
  return s
}

/** 一覧（読めなかったら null のまま） */
export function useMethodImages(): MethodImagesState | null {
  const [state, setState] = useState<MethodImagesState | null>(cache)
  useEffect(() => {
    listeners.add(setState)
    void loadMethodImages()
    return () => {
      listeners.delete(setState)
    }
  }, [])
  return state
}
