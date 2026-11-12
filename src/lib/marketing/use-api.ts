'use client'

/**
 * 院内アプリの画面で、API の JSON を読み込むフック（集客の4タブで使う）
 *
 * - 読み込み中・失敗（理由つき）・読み直しを1か所で扱う。失敗したときは「動いているように」見せず、理由を出す
 * - state は fetch の返事（コールバック）の中でだけ変える（effect の中で直接 setState しない。React の決まり）
 * - pick は返ってきた JSON から使う部分を取り出す関数。ok でない・取り出せないときは undefined を返す。
 *   画面の外（モジュールの一番上）に置いて、毎回同じ関数を渡すこと（変わると読み直しが続くため）
 */
import { useCallback, useEffect, useState } from 'react'

interface ApiJson {
  ok?: boolean
  error?: string
}

export function useApi<T, J>(url: string, pick: (json: J) => T | undefined) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as (J & ApiJson) | null
        const picked = res.ok && json?.ok ? pick(json) : undefined
        if (!alive) return
        if (picked === undefined) {
          setError(json?.error ?? `読み込めませんでした（${res.status}）`)
        } else {
          setData(picked)
          setError('')
        }
      })
      .catch(() => {
        if (alive) setError('読み込めませんでした（通信を確かめてください）')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [url, pick, tick])

  /** 読み直す（ボタン・保存のあと） */
  const reload = useCallback(() => {
    setLoading(true)
    setTick((t) => t + 1)
  }, [])

  return { data, error, loading, reload }
}
