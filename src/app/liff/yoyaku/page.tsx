'use client'
// ──────────────────────────────────────────────
// LIFF橋渡しページ（LINE → 予約サイト）
//
// リッチメニュー「ネット予約」を https://liff.line.me/{LIFF_ID} にすると、
// LINEアプリ内でこのページが開く。ここで LIFF の IDトークンを取得し、
// サーバー（/api/liff/verify）でLINEの公式APIに検証させたうえで、
// 短命の「チケット」を受け取って予約サイトへ引き渡す。
//
// なぜIDトークン検証が要るか:
//   userId をそのままURLに載せると、リンクの共有や履歴から他人がそのIDを使って
//   予約でき、院の公式アカウント名義で任意の相手へ通知を送れてしまう。
//   本人がLINEでログインした証明（IDトークン）をサーバーで検証することで、
//   なりすましを防いでいる。
//
// LIFF IDはURLクエリ `lid` で受け取る（LIFFのエンドポイントURLに ?lid={LIFF_ID} を
// 含めて登録する）。コード変更・再デプロイなしでID差し替えが可能。
//
// フォールバック: LINE外・SDK失敗・検証失敗・タイムアウト時は、チケットなしで
// 通常どおり予約サイトへ進む（予約自体は必ずできる。LINE通知が付かないだけ）。
// ──────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import Script from 'next/script'

const RESERVATION_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec'

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
  const redirected = useRef(false)

  // 予約サイトへ進む（チケットが取れていればクエリで引き渡す）
  const goToReservation = (ticket?: string) => {
    if (redirected.current) return
    redirected.current = true
    const url = ticket ? `${RESERVATION_URL}?lt=${encodeURIComponent(ticket)}` : RESERVATION_URL
    window.location.replace(url)
  }

  const initLiff = async () => {
    try {
      const liffId = new URLSearchParams(window.location.search).get('lid') || ''
      // LIFF IDの形式（数字チャネルID-サフィックス）以外は無視して通常予約へ
      if (!/^\d{5,}-\w+$/.test(liffId) || !window.liff) {
        goToReservation()
        return
      }
      await window.liff.init({ liffId })
      if (!window.liff.isLoggedIn()) {
        // LINE外ブラウザ等は、ログインを強制せず通常予約へ
        goToReservation()
        return
      }
      const idToken = window.liff.getIDToken()
      if (!idToken) {
        goToReservation()
        return
      }
      // サーバーでIDトークンを検証し、短命チケットを受け取る
      const res = await fetch('/api/liff/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, liffId }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; ticket?: string } | null
      goToReservation(data?.ok && data.ticket ? data.ticket : undefined)
    } catch {
      goToReservation()
    }
  }

  // SDKが読み込めない・応答しない環境でも必ず予約サイトへ進めるよう、10秒で強制フォールバック
  useEffect(() => {
    const timer = setTimeout(() => goToReservation(), 10000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <Script
        src="https://static.line-scdn.net/liff/edge/2/sdk.js"
        strategy="afterInteractive"
        onLoad={initLiff}
        onError={() => goToReservation()}
      />
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
          <br />
          画面が切り替わらない場合は、しばらくお待ちください。
        </p>
      </main>
    </>
  )
}
