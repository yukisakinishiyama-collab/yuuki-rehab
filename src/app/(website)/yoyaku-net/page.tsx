import type { Metadata } from 'next'
import { CalendarCheck2, ChevronRight, Clock, MapPin, MessageCircle, Phone } from 'lucide-react'
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'

/**
 * ネット予約の入口（Googleの投稿の「予約」ボタン・広告・チラシのQRなどから来る）
 *
 * Googleの投稿の「予約」ボタンに予約システム（script.google.com）のアドレスを直接入れると、投稿が拒否される。
 * そこで、院のサイトの中の「ふつうのページ」を入口にして、ボタンから予約システムへ進んでもらう。
 *   /yoyaku-net?source=google_post&campaign=gbp-20261106
 * 「空き状況を見て予約する」は /api/marketing/go（クリックを記録して予約システムへ）を通り、
 * source / campaign は予約システムまで引き継がれる（どの投稿から予約が入ったかが残る）。
 *
 * 検索に出す本来のページは院のサイト（shimonoseki-yuuki.com）なので、このページは検索の対象外（noindex）。
 * 表現は広告ガイドラインの範囲（効果の保証・体験談・割引の強調はしない）。
 */
export const metadata: Metadata = {
  title: 'ネット予約（24時間）',
  description: 'ゆうき整骨院（下関市彦島）のネット予約。空き状況を見て、その場で予約が確定します。完全予約制・駐車場あり。',
  robots: { index: false, follow: true },
}

const SAFE = /^[A-Za-z0-9_-]{1,60}$/

function pick(value: string | string[] | undefined, fallback: string): string {
  const v = Array.isArray(value) ? value[0] : value
  return v && SAFE.test(v) ? v : fallback
}

const steps = [
  { title: '日時を選ぶ', desc: '空いている時間がその場で分かります' },
  { title: 'お名前・連絡先を入れる', desc: '気になる症状があれば一言どうぞ' },
  { title: 'その場で予約が確定', desc: 'お電話を待つ必要はありません' },
]

export default async function YoyakuNetPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const source = pick(sp.source, 'yoyaku_net')
  const campaign = pick(sp.campaign, 'direct')
  const qs = new URLSearchParams({ d: 'reserve', source, campaign })
  const reserveHref = `/api/marketing/go?${qs.toString()}`
  const lineQs = new URLSearchParams({ d: 'line', source, campaign })
  const lineHref = `/api/marketing/go?${lineQs.toString()}`
  const clinic = DEFAULT_CLINIC_PROFILE

  return (
    <div className="bg-slate-50">
      <section className="mx-auto max-w-xl px-4 pb-10 pt-10 sm:pt-14">
        <p className="text-sm font-bold tracking-wide text-teal-700">ゆうき整骨院（下関市彦島）</p>
        <h1 className="mt-1 text-3xl font-black leading-tight text-slate-900">ネット予約（24時間）</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
          空き状況を見て、その場で予約が確定します。スポーツのケガ、手術の前後のリハビリ、交通事故のケガなど、まずはお気軽にどうぞ。
        </p>

        <a
          href={reserveHref}
          className="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 text-lg font-black text-white shadow-sm transition-colors hover:bg-teal-700"
        >
          <CalendarCheck2 className="h-6 w-6" aria-hidden />
          空き状況を見て予約する
          <ChevronRight className="h-5 w-5" aria-hidden />
        </a>
        <p className="mt-2 text-center text-xs text-slate-500">予約システムの画面に移ります</p>

        <ol className="mt-8 space-y-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-black text-teal-700">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-slate-900">{s.title}</span>
                <span className="block text-sm text-slate-500">{s.desc}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-slate-900">ご来院の前に</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
            <li className="flex gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
              <span>
                受付：{clinic.hours}（{clinic.closedDays}休み）
              </span>
            </li>
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
              <span>
                {clinic.address}・{clinic.parking}・完全予約制
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            検査や診断が必要な場合は、整形外科などの医療機関をご案内します。
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            href={lineHref}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <MessageCircle className="h-4 w-4 text-[#06c755]" aria-hidden />
            LINEで相談する
          </a>
          <a
            href={`tel:${clinic.phone.replace(/-/g, '')}`}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <Phone className="h-4 w-4 text-teal-700" aria-hidden />
            電話する（{clinic.phone}）
          </a>
        </div>
      </section>
    </div>
  )
}
