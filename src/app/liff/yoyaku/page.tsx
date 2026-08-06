'use client'
// ──────────────────────────────────────────────
// LIFF橋渡しページ（LINE → 予約サイト）
//
// 【最優先の設計方針】
//   何が起きても必ず予約サイトへ進むこと。
//   LINE通知はあくまで「付加価値」であり、通知の仕組みが原因で
//   患者さんが予約できない事態は絶対に起こしてはならない。
//   → LIFFの初期化・検証は「4秒以内に成功すれば使う、ダメなら諦めて進む」方式。
//   → 例外・タイムアウト・キャッシュ・LINE外アクセスなど、
//     あらゆる失敗はすべて「チケット無しで予約サイトへ」に収束させる。
//
// リッチメニュー「ネット予約」を https://liff.line.me/{LIFF_ID} にすると、
// LINEアプリ内でこのページが開く。ここで LIFF の IDトークンを取得し、
// サーバー（/api/liff/verify）でLINEの公式APIに検証させたうえで、
// 短命チケットを予約サイトへ引き渡す（本人確認済みの証明）。
//
// LIFF IDはURLクエリ `lid` で受け取る（エンドポイントURLに ?lid={LIFF_ID} を付けて登録）。
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'

const RESERVATION_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec'

/** ここまでにチケットが取れなければ諦めて予約サイトへ進む（体感を損ねない範囲） */
const GIVE_UP_MS = 4000

interface LiffApi {
  init(config: { liffId: string }): Promise<void>
  isLoggedIn(): boolean
  getIDToken(): string | null
}

declare global {
  interface Window {
    liff?: LiffApi
  }
}

export default function LiffYoyakuPage() {
  const doneRef = useRef(false)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    // 予約サイトへ進む（1度だけ）。ticketが取れていれば付ける
    const go = (ticket?: string) => {
      if (doneRef.current) return
      doneRef.current = true
      const url = ticket ? `${RESERVATION_URL}?lt=${encodeURIComponent(ticket)}` : RESERVATION_URL
      window.location.replace(url)
    }

    // 何があっても必ず進むための保険（この時点で未遷移なら強制的に予約サイトへ）
    const giveUpTimer = setTimeout(() => go(), GIVE_UP_MS)
    // 2秒経っても画面が変わらない場合に、手動リンクを表示して患者を待たせない
    const slowTimer = setTimeout(() => setSlow(true), 2000)

    // LIFF SDKを読み込んでチケットを取得する（失敗は全て握りつぶして通常予約へ）
    const run = async () => {
      try {
        const liffId = new URLSearchParams(window.location.search).get('lid') || ''
        if (!/^\d{5,}-\w+$/.test(liffId)) return go()

        await new Promise<void>((resolve, reject) => {
          if (window.liff) return resolve()
          const script = document.createElement('script')
          script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('sdk load failed'))
          document.head.appendChild(script)
        })
        if (doneRef.current || !window.liff) return

        await window.liff.init({ liffId })
        if (doneRef.current) return
        if (!window.liff.isLoggedIn()) return go() // LINE外ブラウザ等はそのまま予約へ

        const idToken = window.liff.getIDToken()
        if (!idToken) return go()

        const res = await fetch('/api/liff/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, liffId }),
        })
        const data = (await res.json().catch(() => null)) as { ok?: boolean; ticket?: string } | null
        // 検証に失敗しても通知が付かないだけ。予約は必ずできる
        go(data?.ok && data.ticket ? data.ticket : undefined)
      } catch {
        go()
      }
    }
    void run()

    return () => {
      clearTimeout(giveUpTimer)
      clearTimeout(slowTimer)
    }
  }, [])

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#f6f8fb',
        fontFamily: '"Hiragino Sans", "Noto Sans JP", sans-serif',
        color: '#131e2e',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '4px solid #d7e3ee',
          borderTopColor: '#06c755',
          borderRadius: '50%',
          animation: 'liffspin 0.9s linear infinite',
        }}
      />
      <style>{'@keyframes liffspin { to { transform: rotate(360deg) } }'}</style>
      <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>予約ページを開いています…</p>
      <p style={{ fontSize: 12.5, color: '#68788e', margin: 0, lineHeight: 1.8 }}>
        ゆうき整骨院 ネット予約（24時間受付）
      </p>

      {/* 万一この画面で止まっても、患者さんが自力で予約へ進めるようにする */}
      {slow && (
        <a
          href={RESERVATION_URL}
          style={{
            marginTop: 8,
            padding: '14px 28px',
            background: '#06c755',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 10,
            textDecoration: 'none',
          }}
        >
          予約ページへ進む
        </a>
      )}
    </main>
  )
}
