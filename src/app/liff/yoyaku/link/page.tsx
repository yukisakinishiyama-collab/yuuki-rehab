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
//
// カルテの画面のQRコードから開いたとき（?c=番号。2026-11-19）は、入力の代わりに
// 「山田◯◯ 様のカルテと、このLINEを結びつけます」を出して、押すだけで結びつける（lib/line-link-qr.ts）。
// QRコードが使えないとき（10分過ぎた・もう使われた）は、そのことを出して、今までの入力に切りかえる。
//
// 2026-11-20 院長「カルテでLINE連携した時に患者様側の表示がおかしくなったりします」で直したこと：
// - 予約の橋渡し（../page.tsx）が、このページへ来る途中で予約のページへ進んでしまうことがあった（lib/liff-route.ts）
// - 結びついたあとに LINE が画面を読み直す・同じQRコードをもう一度読むと、「使えません」と入力の欄が出ていた
//   → 同じ LINE なら「結びついています」を出す（サーバーが、結びつけた LINE を封じた印で見分ける）
// - QRコードから開いたのに、確認中の文が「お名前・電話番号・生年月日を入れてください」だった
// - LINE の中なのに、確認に失敗すると「公式LINEの中から開いてください」と出ていた → 「読み込み直す」を出す
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'

interface LiffApi {
  init(config: { liffId: string }): Promise<void>
  isLoggedIn(): boolean
  isInClient(): boolean
  getIDToken(): string | null
  closeWindow(): void
  getDecodedIDToken?(): { exp?: number } | null
  logout?(): void
}

/** 予約ページ（../page.tsx）と型が食い違わないよう、グローバルは拡張せずここで読む */
const getLiff = (): LiffApi | undefined => (window as unknown as { liff?: LiffApi }).liff

type Phase = 'loading' | 'confirm' | 'form' | 'sending' | 'done' | 'outside' | 'error'

const font = '"Hiragino Sans", "Noto Sans JP", sans-serif'

/** アドレスはこのページの間は変わらないので、見張らない */
const noSubscribe = () => () => {}
/** LINE の確認（IDトークン）が古くて通らなかったとき、1回だけ自動で読み込み直す印 */
const RETRY_KEY = 'liffLinkRetry'

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
  const [done, setDone] = useState<{ patientNo: string | null; patientNoMessage: string; notified: boolean }>({ patientNo: null, patientNoMessage: '', notified: false })
  const [message, setMessage] = useState('')
  const [doneName, setDoneName] = useState('')
  // カルテの画面のQRコードの番号と、そのお名前の一部（例 山田◯◯）。電話番号を入れてもらうか
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState<{ maskedName: string; needPhone: boolean } | null>(null)
  // QRコードが使えなかったときのお知らせ（入力の欄の上に出す）
  const [qrNotice, setQrNotice] = useState('')
  // この LINE で、もう結びついていた（開き直した）
  const [already, setAlready] = useState(false)
  // QRコードから開いたか（確認中の文を、最初から QR 用にする。サーバーで作るときは false）
  const fromQr = useSyncExternalStore(
    noSubscribe,
    () => Boolean(new URLSearchParams(window.location.search).get('c')),
    () => false,
  )

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
        const inLine = (() => {
          try {
            return liff.isInClient()
          } catch {
            return false
          }
        })()
        if (!liff.isLoggedIn()) return setPhase('outside')
        const idToken = liff.getIDToken()
        if (!idToken) return inLine ? failInLine(liff) : setPhase('outside')
        const res = await fetch('/api/liff/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, liffId }),
        })
        const data = (await res.json().catch(() => null)) as { ok?: boolean; ticket?: string } | null
        // LINE の中なのに確認が通らない（確認の期限切れなど）：「公式LINEの中から」ではなく、読み込み直しを出す
        if (!data?.ok || !data.ticket) return inLine ? failInLine(liff) : setPhase('outside')
        try {
          sessionStorage.removeItem(RETRY_KEY)
        } catch {
          // 覚えられないだけ
        }
        setTicket(data.ticket)
        // カルテの画面のQRコードから開いたとき：お名前の一部を見て、押すだけで結びつける
        const qr = new URLSearchParams(window.location.search).get('c') || ''
        if (qr) {
          const peek = await fetch('/api/liff/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket: data.ticket, code: qr, peek: true }),
          })
          const info = (await peek.json().catch(() => null)) as {
            ok?: boolean
            maskedName?: string
            needPhone?: boolean
            error?: string
            already?: { maskedName?: string; patientNo?: string }
          } | null
          if (info?.ok && info.maskedName) {
            setCode(qr)
            setPreview({ maskedName: info.maskedName, needPhone: Boolean(info.needPhone) })
            return setPhase('confirm')
          }
          // この LINE でもう結びついている（結びつけたあとに開き直した）
          if (info?.already) return showAlready(info.already)
          setQrNotice(`${info?.error || 'QRコードを読み取れませんでした。'}このページで、お名前・電話番号・生年月日を入れても結びつけられます。`)
        }
        setPhase('form')
      } catch {
        setPhase('outside')
      }
    }
    void run()
  }, [])

  /** この LINE で、もう結びついている：入力の欄ではなく「結びついています」を出す */
  function showAlready(a: { maskedName?: string; patientNo?: string }) {
    setAlready(true)
    setDoneName(a.maskedName || '')
    setDone({ patientNo: a.patientNo ?? null, patientNoMessage: '', notified: true })
    setPhase('done')
  }

  /** LINE の中なのに、LINE の確認が通らなかった：1回だけ自動で読み込み直し、だめなら「読み込み直す」を出す */
  function failInLine(liff: LiffApi) {
    let retried = false
    try {
      retried = sessionStorage.getItem(RETRY_KEY) === '1'
      if (!retried) sessionStorage.setItem(RETRY_KEY, '1')
    } catch {
      retried = true
    }
    if (!retried) {
      try {
        // 古い確認を捨てて、LINE にもう一度確認してもらう
        liff.logout?.()
      } catch {
        // 捨てられなくても読み込み直す
      }
      window.location.reload()
      return
    }
    setMessage('LINEの確認ができませんでした。')
    setPhase('error')
  }

  /** カルテの画面のQRコードで結びつける（お名前などはカルテのもの。電話番号が無い方だけ入れてもらう） */
  const submitQr = async (e: FormEvent) => {
    e.preventDefault()
    if (phase === 'sending' || !preview) return
    if (preview.needPhone) {
      const digits = digitsOnly(phone, 11)
      if (digits.length < 10) {
        setMessage('電話番号を10〜11桁の数字で入れてください')
        return
      }
    }
    setMessage('')
    setPhase('sending')
    try {
      const res = await fetch('/api/liff/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, code, phone: preview.needPhone ? phone : undefined }),
      })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        reason?: string
        patientNo?: string | null
        patientNoMessage?: string
        notified?: boolean
        already?: { maskedName?: string; patientNo?: string }
      } | null
      // 2回押した・通信のやり直しで、もう結びついていた
      if (data?.already) return showAlready({ maskedName: data.already.maskedName || preview.maskedName, patientNo: data.already.patientNo })
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'うまくいきませんでした。もう一度お試しください')
        if (res.status === 401) return setPhase('error')
        // QRコードが使えなくなった（期限切れ・使用済み）→ 今までの入力に切りかえる
        if (res.status === 410) {
          setPreview(null)
          setMessage('')
          setQrNotice(`${data?.error || 'QRコードが使えなくなりました。'}このページで、お名前・電話番号・生年月日を入れても結びつけられます。`)
          return setPhase('form')
        }
        return setPhase('confirm')
      }
      // 画面には、お名前の一部だけを出す（QRコードはのぞき見られることがあるため）
      setDoneName(preview.maskedName)
      setDone({ patientNo: data.patientNo ?? null, patientNoMessage: data.patientNoMessage ?? '', notified: Boolean(data.notified) })
      setPhase('done')
    } catch {
      setMessage('通信に失敗しました。電波のよいところでもう一度お試しください')
      setPhase('confirm')
    }
  }

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
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; name?: string; patientNo?: string | null; patientNoMessage?: string; notified?: boolean } | null
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'うまくいきませんでした。もう一度お試しください')
        // チケット切れ（15分）のときは開き直してもらう
        setPhase(res.status === 401 ? 'error' : 'form')
        return
      }
      setDoneName(data.name || name)
      setDone({ patientNo: data.patientNo ?? null, patientNoMessage: data.patientNoMessage ?? '', notified: Boolean(data.notified) })
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
        {/* 説明は、入力・確認の画面のときだけ（確認中・失敗・完了の画面では出さない） */}
        {(phase === 'loading' || phase === 'confirm' || phase === 'form' || phase === 'sending') && (
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#4b5b6e', margin: '0 0 22px' }}>
            {preview || (phase === 'loading' && fromQr)
              ? '受付のQRコードから、院のカルテとこのLINEを結びつけます。'
              : '院で登録しているお名前・電話番号・生年月日を入れてください。'}
            結びつくと、誕生日のご挨拶や院からのお知らせがこのLINEに届き、ネット予約で使える患者番号もお知らせします。
          </p>
        )}

        {phase === 'loading' && (
          <p style={{ fontSize: 14, color: '#68788e' }}>{fromQr ? 'QRコードを確かめています…' : 'LINEの確認をしています…'}</p>
        )}

        {phase === 'outside' && (
          <div style={{ background: '#fff', border: '1px solid #e2e9f0', borderRadius: 14, padding: 18, lineHeight: 1.8, fontSize: 14 }}>
            {fromQr ? (
              <>
                このQRコードは、<b>LINEアプリ</b>で読み取ってください。
                <br />
                LINEの「ホーム」の上の検索欄の右にある、読み取りのマークから読み取れます。
              </>
            ) : (
              <>
                このページは、ゆうき整骨院の公式LINEの中から開いてください。
                <br />
                （友だち追加のあと、メニューの「カルテ連携」からどうぞ）
              </>
            )}
          </div>
        )}

        {phase === 'error' && (
          <div style={{ background: '#fff', border: '1px solid #e2e9f0', borderRadius: 14, padding: 18, lineHeight: 1.8, fontSize: 14 }}>
            {message}
            <br />
            下の「読み込み直す」を押すか、いったん閉じて、{fromQr ? 'もう一度QRコードを読み取ってください。' : 'LINEのメニューからもう一度開いてください。'}
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ display: 'block', marginTop: 14, padding: '12px 22px', background: '#06c755', color: '#fff', border: 0, borderRadius: 10, fontWeight: 800, fontSize: 15, fontFamily: font }}
            >
              読み込み直す
            </button>
          </div>
        )}

        {(phase === 'confirm' || (phase === 'sending' && preview)) && preview && (
          <form onSubmit={submitQr} style={{ display: 'grid', gap: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #cdeedb', borderRadius: 14, padding: 18, lineHeight: 1.8, fontSize: 15 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#06a04a', fontWeight: 700 }}>受付のQRコードから開きました</p>
              <p style={{ margin: 0 }}>
                <b style={{ fontSize: 20 }}>{preview.maskedName} 様</b>
                <br />
                のカルテと、このLINEを結びつけます。
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#68788e' }}>
                ご本人（またはご家族）のカルテでなければ、結びつけずに閉じて、受付にお知らせください。
              </p>
            </div>
            {preview.needPhone && (
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
                電話番号（院にまだご登録がありません。ふだんお使いの番号を入れてください）
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
            )}
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

        {(phase === 'form' || (phase === 'sending' && !preview)) && (
          <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
            {qrNotice && (
              <p style={{ margin: 0, padding: '12px 14px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 12, fontSize: 13, lineHeight: 1.7, color: '#7c2d12' }}>
                {qrNotice}
              </p>
            )}
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
            <p style={{ margin: '0 0 8px', fontWeight: 800, color: '#06a04a' }}>{already ? '結びついています' : '結びつきました'}</p>
            <p style={{ margin: 0 }}>
              {already
                ? `${doneName ? `${doneName} 様の` : ''}カルテと、このLINEは結びついています。このまま閉じてください。`
                : `${doneName}${preview ? ' 様' : 'さん'}のカルテと、このLINEを結びつけました。ありがとうございます。`}
            </p>
            {done.patientNo ? (
              <div style={{ marginTop: 14, padding: '12px 14px', background: '#f0fdf4', borderRadius: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#166534', fontWeight: 700 }}>あなたの患者番号</p>
                <p style={{ margin: '2px 0 6px', fontSize: 30, fontWeight: 900, letterSpacing: '0.08em', color: '#131e2e' }}>{done.patientNo}</p>
                <p style={{ margin: 0, fontSize: 12.5, color: '#4b5b6e', lineHeight: 1.7 }}>
                  ネット予約の「患者番号をお持ちの方」に、この番号と電話番号の下4桁を入れると、お名前などが自動で入ります。
                  {done.notified && !already ? 'LINEにも同じ内容をお送りしました。' : ''}
                </p>
                {!done.notified && (
                  <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#9a3412', fontWeight: 700, lineHeight: 1.7 }}>
                    LINEへのお知らせは送れませんでした。この画面のスクリーンショットを撮るか、番号を控えておいてください。
                  </p>
                )}
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
