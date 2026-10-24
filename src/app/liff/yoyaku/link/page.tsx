'use client'
// ──────────────────────────────────────────────
// カルテ連携ページ（LINE → 名前と電話番号を入れて、カルテとLINEを結びつける）
//
// 開き方: https://liff.line.me/{LIFF_ID}/link
//   LIFF のエンドポイントは /liff/yoyaku?lid={LIFF_ID} なので、/link を足すと
//   このページ（/liff/yoyaku/link?lid={LIFF_ID}）が LINE の中で開く。
//   新しい LIFF を登録しなくてよい。
//
// 流れ: LIFF SDK → IDトークン → /api/liff/verify（短命チケット）→ 入力 → /api/liff/link
// LINE の外（ふつうのブラウザ）で開いたときは、LINE から開くよう案内するだけ。
// ──────────────────────────────────────────────
import { useEffect, useState, type FormEvent } from 'react'

interface LiffApi {
  init(config: { liffId: string }): Promise<void>
  isLoggedIn(): boolean
  isInClient(): boolean
  getIDToken(): string | null
  closeWindow(): void
}

/** 予約ページ（../page.tsx）と型が食い違わないよう、グローバルは拡張せずここで読む */
const getLiff = (): LiffApi | undefined => (window as unknown as { liff?: LiffApi }).liff

type Phase = 'loading' | 'form' | 'sending' | 'done' | 'outside' | 'error'

const font = '"Hiragino Sans", "Noto Sans JP", sans-serif'

export default function LiffLinkPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [ticket, setTicket] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [doneName, setDoneName] = useState('')

  useEffect(() => {
    const run = async () => {
      try {
        const liffId = new URLSearchParams(window.location.search).get('lid') || ''
        if (!/^\d{5,}-\w+$/.test(liffId)) return setPhase('outside')
        await new Promise<void>((resolve, reject) => {
          if (getLiff()) return resolve()
          const script = document.createElement('script')
          script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('sdk load failed'))
          document.head.appendChild(script)
        })
        const liff = getLiff()
        if (!liff) return setPhase('outside')
        await liff.init({ liffId })
        if (!liff.isLoggedIn()) return setPhase('outside')
        const idToken = liff.getIDToken()
        if (!idToken) return setPhase('outside')
        const res = await fetch('/api/liff/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, liffId }),
        })
        const data = (await res.json().catch(() => null)) as { ok?: boolean; ticket?: string } | null
        if (!data?.ok || !data.ticket) return setPhase('outside')
        setTicket(data.ticket)
        setPhase('form')
      } catch {
        setPhase('outside')
      }
    }
    void run()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (phase === 'sending') return
    setMessage('')
    setPhase('sending')
    try {
      const res = await fetch('/api/liff/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, name, phone }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; name?: string } | null
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'うまくいきませんでした。もう一度お試しください')
        // チケット切れ（15分）のときは開き直してもらう
        setPhase(res.status === 401 ? 'error' : 'form')
        return
      }
      setDoneName(data.name || name)
      setPhase('done')
    } catch {
      setMessage('通信に失敗しました。電波のよいところでもう一度お試しください')
      setPhase('form')
    }
  }

  const input = {
    width: '100%',
    boxSizing: 'border-box' as const,
    fontSize: 17,
    padding: '14px 14px',
    border: '1.5px solid #c9d6e2',
    borderRadius: 12,
    background: '#fff',
    fontFamily: font,
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#f6f8fb',
        fontFamily: font,
        color: '#131e2e',
        padding: '28px 20px 40px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <p style={{ fontSize: 12, letterSpacing: '0.12em', color: '#06a04a', fontWeight: 700, margin: '0 0 6px' }}>
          ゆうき整骨院
        </p>
        <h1 style={{ fontSize: 22, margin: '0 0 8px', lineHeight: 1.4 }}>LINEとカルテを結びつける</h1>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: '#4b5b6e', margin: '0 0 22px' }}>
          院で登録しているお名前と電話番号を入れてください。
          結びつくと、誕生日のご挨拶や院からのお知らせがこのLINEに届きます。
        </p>

        {phase === 'loading' && (
          <p style={{ fontSize: 14, color: '#68788e' }}>LINEの確認をしています…</p>
        )}

        {phase === 'outside' && (
          <div style={{ background: '#fff', border: '1px solid #e2e9f0', borderRadius: 14, padding: 18, lineHeight: 1.8, fontSize: 14 }}>
            このページは、ゆうき整骨院の公式LINEの中から開いてください。
            <br />
            （友だち追加のあと、メニューの「カルテ連携」からどうぞ）
          </div>
        )}

        {phase === 'error' && (
          <div style={{ background: '#fff', border: '1px solid #e2e9f0', borderRadius: 14, padding: 18, lineHeight: 1.8, fontSize: 14 }}>
            {message}
            <br />
            LINEのメニューから、もう一度このページを開いてください。
          </div>
        )}

        {(phase === 'form' || phase === 'sending') && (
          <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
              お名前（漢字）
              <input
                style={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：山田 太郎"
                autoComplete="name"
                required
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
              電話番号（院に登録しているもの）
              <input
                style={input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="例：09012345678"
                inputMode="numeric"
                autoComplete="tel"
                required
              />
            </label>
            <p style={{ fontSize: 12, color: '#68788e', lineHeight: 1.7, margin: 0 }}>
              ご家族のカルテを結びつけるときは、その方のお名前と、院に登録している電話番号を入れてください。
            </p>
            {message && (
              <p style={{ fontSize: 13, color: '#b42318', margin: 0, lineHeight: 1.6 }}>{message}</p>
            )}
            <button
              type="submit"
              disabled={phase === 'sending'}
              style={{
                padding: '16px',
                background: phase === 'sending' ? '#9fd9b8' : '#06c755',
                color: '#fff',
                fontWeight: 800,
                fontSize: 16,
                border: 0,
                borderRadius: 12,
                fontFamily: font,
              }}
            >
              {phase === 'sending' ? '結びつけています…' : '結びつける'}
            </button>
          </form>
        )}

        {phase === 'done' && (
          <div style={{ background: '#fff', border: '1px solid #cdeedb', borderRadius: 14, padding: 20, lineHeight: 1.8, fontSize: 15 }}>
            <p style={{ margin: '0 0 8px', fontWeight: 800, color: '#06a04a' }}>結びつきました</p>
            <p style={{ margin: 0 }}>{doneName}さんのカルテと、このLINEを結びつけました。ありがとうございます。</p>
            <button
              type="button"
              onClick={() => getLiff()?.closeWindow()}
              style={{ marginTop: 18, padding: '12px 22px', background: '#131e2e', color: '#fff', border: 0, borderRadius: 10, fontWeight: 700, fontFamily: font }}
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
