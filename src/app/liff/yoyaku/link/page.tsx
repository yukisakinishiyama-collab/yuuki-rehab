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
import { useEffect, useRef, useState, type FormEvent } from 'react'

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
  // 生年月日は 年・月・日 の3つを手で入れる（カレンダーだと何十年もさかのぼるのが大変なため）
  const [by, setBy] = useState('')
  const [bm, setBm] = useState('')
  const [bd, setBd] = useState('')
  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)
  const birth = by.length === 4 && bm && bd ? `${by}-${bm.padStart(2, '0')}-${bd.padStart(2, '0')}` : ''
  const thisYear = new Date().getFullYear()
  const birthOk = (() => {
    if (!birth) return false
    const y = Number(by)
    const m = Number(bm)
    const d = Number(bd)
    if (y < 1900 || y > thisYear || m < 1 || m > 12 || d < 1) return false
    return d <= new Date(y, m, 0).getDate()
  })()
  /** 全角数字も受け取り、数字だけにして最大桁で切る */
  const digitsOnly = (value: string, max: number) =>
    value
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/\D/g, '')
      .slice(0, max)
  const [done, setDone] = useState<{ patientNo: string | null; patientNoMessage: string }>({ patientNo: null, patientNoMessage: '' })
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
    if (!birthOk) {
      setMessage('生年月日を確かめてください（例：1990年1月23日 → 1990・1・23）')
      return
    }
    setMessage('')
    setPhase('sending')
    try {
      const res = await fetch('/api/liff/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, name, phone, birthDate: birth }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; name?: string; patientNo?: string | null; patientNoMessage?: string } | null
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'うまくいきませんでした。もう一度お試しください')
        // チケット切れ（15分）のときは開き直してもらう
        setPhase(res.status === 401 ? 'error' : 'form')
        return
      }
      setDoneName(data.name || name)
      setDone({ patientNo: data.patientNo ?? null, patientNoMessage: data.patientNoMessage ?? '' })
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
          院で登録しているお名前・電話番号・生年月日を入れてください。
          結びつくと、誕生日のご挨拶や院からのお知らせがこのLINEに届き、ネット予約で使える患者番号もお知らせします。
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
            <div style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
              <span>生年月日（西暦で数字を入れてください）</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr auto 1fr auto 1fr auto', alignItems: 'center', gap: 6 }}>
                <input
                  style={{ ...input, textAlign: 'center', padding: '14px 6px' }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday-year"
                  placeholder="1990"
                  aria-label="生まれた年（西暦4桁）"
                  value={by}
                  onChange={(e) => {
                    const v = digitsOnly(e.target.value, 4)
                    setBy(v)
                    if (v.length === 4) monthRef.current?.focus()
                  }}
                  required
                />
                <span>年</span>
                <input
                  ref={monthRef}
                  style={{ ...input, textAlign: 'center', padding: '14px 6px' }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday-month"
                  placeholder="1"
                  aria-label="月"
                  value={bm}
                  onChange={(e) => {
                    const v = digitsOnly(e.target.value, 2)
                    setBm(v)
                    if (v.length === 2 || Number(v) >= 2) dayRef.current?.focus()
                  }}
                  required
                />
                <span>月</span>
                <input
                  ref={dayRef}
                  style={{ ...input, textAlign: 'center', padding: '14px 6px' }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday-day"
                  placeholder="23"
                  aria-label="日"
                  value={bd}
                  onChange={(e) => setBd(digitsOnly(e.target.value, 2))}
                  required
                />
                <span>日</span>
              </div>
              {birth && !birthOk && <span style={{ fontSize: 12, color: '#c0392b', fontWeight: 400 }}>日付を確かめてください</span>}
            </div>
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
            {done.patientNo ? (
              <div style={{ marginTop: 14, padding: '12px 14px', background: '#f0fdf4', borderRadius: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#166534', fontWeight: 700 }}>あなたの患者番号</p>
                <p style={{ margin: '2px 0 6px', fontSize: 30, fontWeight: 900, letterSpacing: '0.08em', color: '#131e2e' }}>{done.patientNo}</p>
                <p style={{ margin: 0, fontSize: 12.5, color: '#4b5b6e', lineHeight: 1.7 }}>
                  ネット予約の「患者番号をお持ちの方」に、この番号と電話番号の下4桁を入れると、お名前などが自動で入ります。LINEにも同じ内容をお送りしました。
                </p>
              </div>
            ) : done.patientNoMessage ? (
              <p style={{ margin: '12px 0 0', fontSize: 12.5, color: '#4b5b6e', lineHeight: 1.7 }}>{done.patientNoMessage}</p>
            ) : null}
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
