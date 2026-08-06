'use client'
// ──────────────────────────────────────────────
// LIFF橋渡しページ（LINE → 予約サイト）
//
// リッチメニュー「ネット予約」を https://liff.line.me/{LIFF_ID} にすると、
// LINEアプリ内でこのページが開き、患者のLINE userId を取得して
// GAS予約サイトへ ?lineUserId=... 付きでリダイレクトする。
// → 予約完了/キャンセル時に患者本人のLINEへ自動通知が届くようになる。
//
// LIFF IDはこのページのURLクエリ `lid` で受け取る（LIFFのエンドポイントURLに
// ?lid={LIFF_ID} を含めて登録する）。コード変更・再デプロイなしでID差し替え可能。
//
// フォールバック: LINE外で開かれた・SDK失敗・タイムアウト時は、
// userIdなしで通常どおり予約サイトへ進む（予約自体は必ずできる）。
// ──────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import Script from 'next/script'

const RESERVATION_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec'

interface LiffApi {
  init(config: { liffId: string }): Promise<void>
  isLoggedIn(): boolean
  getProfile(): Promise<{ userId: string; displayName?: string }>
}

declare global {
  interface Window {
    liff?: LiffApi
  }
}

export default function LiffYoyakuPage() {
  const redirected = useRef(false)

  // 予約サイトへ進む（userIdが取れていればクエリで引き渡す）
  const goToReservation = (lineUserId?: string) => {
    if (redirected.current) return
    redirected.current = true
    const url =
      lineUserId && /^U[0-9a-f]{32}$/.test(lineUserId)
        ? `${RESERVATION_URL}?lineUserId=${encodeURIComponent(lineUserId)}`
        : RESERVATION_URL
    window.location.replace(url)
  }

  const initLiff = async () => {
    try {
      const liffId = new URLSearchParams(window.location.search).get('lid') || ''
      if (!liffId || !window.liff) {
        goToReservation()
        return
      }
      await window.liff.init({ liffId })
      if (!window.liff.isLoggedIn()) {
        // LINE外ブラウザ等でログインしていない場合は、ログインを強制せず通常予約へ
        goToReservation()
        return
      }
      const profile = await window.liff.getProfile()
      goToReservation(profile.userId)
    } catch {
      goToReservation()
    }
  }

  // SDKが読み込めない環境でも必ず予約サイトへ進めるよう、8秒で強制フォールバック
  useEffect(() => {
    const timer = setTimeout(() => goToReservation(), 8000)
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
