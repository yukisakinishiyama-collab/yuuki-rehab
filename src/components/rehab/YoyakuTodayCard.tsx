'use client'
// ──────────────────────────────────────────────
// 今日の予約ウィジェット（GAS予約システムと連携）
// ・今日/明日の予約を一覧表示（60秒ごと自動更新）
// ・電話へワンタップ発信
// ・患者管理に同一患者（電話 or 氏名一致）がいればカルテへ直接ジャンプ
// 連携キー＝予約管理の管理者パスワード（この端末のみに保存）
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarClock, RefreshCw, Phone, ChevronRight, KeyRound, ExternalLink,
} from 'lucide-react'
import type { Patient } from '@/types/patient'
import { getPatients, initPatientStore } from '@/lib/patient-store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const FEED_KEY_STORAGE = 'yoyaku_feed_key'

interface FeedRow {
  time: string
  name: string
  kana: string
  phone: string
  kubun: string
  status: string
  reservationNo: string
  memo: string
}
interface FeedDay {
  date: string
  rows: FeedRow[]
}
interface Feed {
  ok: boolean
  error?: string
  today?: string
  days?: FeedDay[]
}

/** 電話番号を数字だけに正規化して比較する */
const digits = (value: string) => String(value || '').replace(/[^0-9]/g, '')
/** 氏名のスペース揺れを吸収して比較する */
const normName = (value: string) => String(value || '').replace(/[\s　]/g, '')

function kubunStyle(kubun: string): string {
  if (kubun.includes('初診')) return 'bg-teal-50 text-teal-700 border-teal-200'
  if (kubun.includes('新しいケガ')) return 'bg-orange-50 text-orange-700 border-orange-200'
  if (kubun.includes('再診')) return 'bg-slate-50 text-slate-600 border-slate-200'
  return 'bg-gray-50 text-gray-500 border-gray-200'
}

function statusStyle(status: string): string {
  if (status === '来院済み') return 'bg-green-50 text-green-700 border-green-200'
  if (status === 'キャンセル') return 'bg-gray-100 text-gray-400 border-gray-200 line-through'
  return 'bg-blue-50 text-blue-700 border-blue-200'
}

function dateLabel(dateString: string, todayString: string): string {
  if (dateString === todayString) return '今日'
  const date = new Date(`${dateString}T00:00:00`)
  const youbi = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
  return `${date.getMonth() + 1}/${date.getDate()}（${youbi}）`
}

export default function YoyakuTodayCard() {
  const [feedKey, setFeedKey] = useState<string>('')
  const [keyInput, setKeyInput] = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)
  const [feed, setFeed] = useState<Feed | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [updatedAt, setUpdatedAt] = useState('')

  // 患者リスト（カルテへのジャンプ用マッチング）
  useEffect(() => {
    initPatientStore()
    setPatients(getPatients())
  }, [])

  // 保存済みの連携キーを読む
  useEffect(() => {
    const saved = localStorage.getItem(FEED_KEY_STORAGE) || ''
    if (saved) {
      setFeedKey(saved)
    } else {
      setNeedsSetup(true)
    }
  }, [])

  const load = useCallback(
    async (key: string) => {
      if (!key) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/yoyaku/feed?key=${encodeURIComponent(key)}&days=2`, { cache: 'no-store' })
        const data = (await res.json()) as Feed
        if (!data.ok) {
          if (data.error === 'unauthorized') {
            localStorage.removeItem(FEED_KEY_STORAGE)
            setFeedKey('')
            setNeedsSetup(true)
            setError('連携キーが一致しません。予約管理の管理者パスワードを入力してください。')
          } else {
            setError(data.error || '予約の取得に失敗しました。')
          }
          return
        }
        setFeed(data)
        setUpdatedAt(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }))
      } catch {
        setError('予約の取得に失敗しました。通信環境をご確認ください。')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // 初回＋60秒ごと＋タブ復帰時に更新
  useEffect(() => {
    if (!feedKey) return
    load(feedKey)
    const timer = setInterval(() => {
      if (!document.hidden) load(feedKey)
    }, 60000)
    const onVisible = () => {
      if (!document.hidden) load(feedKey)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [feedKey, load])

  const saveKey = () => {
    const value = keyInput.trim()
    if (!value) return
    localStorage.setItem(FEED_KEY_STORAGE, value)
    setFeedKey(value)
    setNeedsSetup(false)
    setKeyInput('')
  }

  /** 予約の患者を患者管理から探す（電話一致 → 氏名一致） */
  const matchPatient = useMemo(() => {
    return (row: FeedRow): Patient | undefined => {
      const rowPhone = digits(row.phone)
      if (rowPhone.length >= 10) {
        const byPhone = patients.find((p) => digits(p.phone) === rowPhone)
        if (byPhone) return byPhone
      }
      const rowName = normName(row.name)
      if (!rowName) return undefined
      return patients.find((p) => normName(p.name) === rowName)
    }
  }, [patients])

  const todayString = feed?.today || ''

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-teal-600" />
            <CardTitle className="text-sm font-semibold text-gray-900">今日の予約</CardTitle>
            {updatedAt && <span className="text-[11px] text-gray-400">更新 {updatedAt}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost" size="sm" className="h-7 px-2 text-xs text-gray-500"
              onClick={() => load(feedKey)} disabled={loading || !feedKey}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Link
              href="/yoyaku"
              className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium transition-colors"
            >
              予約管理を開く
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* 連携キーの設定（初回のみ） */}
        {needsSetup && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-2">
              <KeyRound className="w-3.5 h-3.5" />
              予約システムと連携（初回のみ）
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              予約管理画面と同じ<strong>管理者パスワード</strong>を入力してください（この端末にのみ保存されます）。
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveKey()}
                placeholder="管理者パスワード"
                className="flex-1 px-3 py-1.5 rounded-md border border-slate-300 text-sm"
              />
              <Button size="sm" className="h-8 text-xs" onClick={saveKey}>連携する</Button>
            </div>
            {error && <p className="text-[11px] text-red-600 mt-2">{error}</p>}
          </div>
        )}

        {!needsSetup && error && <p className="text-xs text-red-600 mb-2">{error}</p>}

        {!needsSetup && !feed && !error && (
          <p className="text-xs text-gray-400 py-2">予約を読み込んでいます…</p>
        )}

        {/* 予約リスト（今日・明日） */}
        {!needsSetup && feed?.days && (
          <div className="space-y-3">
            {feed.days.map((day) => {
              const activeRows = day.rows.filter((row) => row.status !== 'キャンセル')
              return (
                <div key={day.date}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-gray-700">
                      {dateLabel(day.date, todayString)}
                    </span>
                    <span className="text-[11px] text-gray-400">{activeRows.length}件</span>
                  </div>
                  {day.rows.length === 0 ? (
                    <p className="text-xs text-gray-400 pl-1">予約はありません</p>
                  ) : (
                    <div className="space-y-1">
                      {day.rows.map((row) => {
                        const patient = matchPatient(row)
                        return (
                          <div
                            key={`${day.date}-${row.reservationNo}`}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <span className="text-sm font-bold text-gray-900 tabular-nums w-11 flex-shrink-0">
                              {row.time}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-sm font-medium text-gray-800 truncate ${row.status === 'キャンセル' ? 'line-through text-gray-400' : ''}`}>
                                  {row.name}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${kubunStyle(row.kubun)}`}>
                                  {row.kubun || '区分なし'}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusStyle(row.status)}`}>
                                  {row.status}
                                </span>
                              </div>
                              {row.memo && (
                                <p className="text-[11px] text-gray-400 truncate mt-0.5">{row.memo}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {row.phone && (
                                <a
                                  href={`tel:${digits(row.phone)}`}
                                  className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                                  title={`${row.phone} に電話`}
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {patient ? (
                                <Link
                                  href={`/patients/${patient.id}`}
                                  className="flex items-center gap-0.5 h-7 px-2 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-700 text-[11px] font-medium transition-colors"
                                >
                                  カルテ
                                  <ChevronRight className="w-3 h-3" />
                                </Link>
                              ) : (
                                <span className="text-[10px] text-gray-300 px-1" title="患者管理に同一の患者が見つかりません">
                                  未登録
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
