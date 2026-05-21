import type { Metadata } from 'next'
import { MapPin, Clock, Phone, Train, Car } from 'lucide-react'
import LineQRCode from '@/components/site/LineQRCode'

export const metadata: Metadata = {
  title: 'アクセス・診療時間｜ゆうき整骨院（山口県下関市）',
  description: '山口県下関市彦島江の浦町9丁目1-14のゆうき整骨院。アクセス・診療時間。平日10:00〜13:00・15:00〜20:00、土曜10:00〜15:00。TEL: 083-265-4545。LINE予約受付中。',
}

const hours = [
  { day: '月曜日', am: '10:00〜13:00', pm: '15:00〜20:00', open: true },
  { day: '火曜日', am: '10:00〜13:00', pm: '15:00〜20:00', open: true },
  { day: '水曜日', am: '10:00〜13:00', pm: '15:00〜20:00', open: true },
  { day: '木曜日', am: '10:00〜13:00', pm: '15:00〜20:00', open: true },
  { day: '金曜日', am: '10:00〜13:00', pm: '15:00〜20:00', open: true },
  { day: '土曜日', am: '10:00〜15:00', pm: '—', open: true },
  { day: '日曜日', am: '休診', pm: '休診', open: false },
  { day: '祝日', am: '休診', pm: '休診', open: false },
]

export default function AccessPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <span className="text-blue-300 text-sm font-bold tracking-widest uppercase">Access</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mt-2 mb-4">アクセス・診療時間</h1>
          <p className="text-blue-100">山口県下関市のゆうき整骨院へのアクセス情報です</p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-10">

            {/* Left: Info */}
            <div className="space-y-8">
              {/* Clinic Info */}
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <MapPin size={22} className="text-blue-700" /> 院情報
                </h2>
                <div className="bg-blue-50 rounded-xl p-5 space-y-3 text-sm">
                  <div>
                    <p className="font-bold text-slate-800 text-base">ゆうき整骨院</p>
                    <p className="text-slate-500 text-xs">YUUKI SEIKOTSU-IN</p>
                  </div>
                  <div className="flex items-start gap-2 text-slate-700">
                    <MapPin size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <span>山口県下関市彦島江の浦町9丁目1-14</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone size={16} className="text-blue-600 shrink-0" />
                    <a href="tel:0832654545" className="hover:text-blue-700">083-265-4545</a>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 shrink-0">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                      <circle cx="12" cy="12" r="3"/>
                      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                    </svg>
                    <a href="https://www.instagram.com/yu.ki__seikotsuin/" className="hover:text-blue-700 text-xs">@yu.ki__seikotsuin（Instagram）</a>
                  </div>
                </div>
              </div>

              {/* Hours */}
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock size={22} className="text-blue-700" /> 診療時間
                </h2>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-navy text-white">
                        <th className="py-2.5 px-4 text-left font-semibold">曜日</th>
                        <th className="py-2.5 px-4 text-left font-semibold">午前</th>
                        <th className="py-2.5 px-4 text-left font-semibold">午後</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hours.map((row, i) => (
                        <tr
                          key={row.day}
                          className={`border-b border-slate-50 ${!row.open ? 'bg-slate-50 text-slate-400' : i % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'}`}
                        >
                          <td className="py-2.5 px-4 font-medium">{row.day}</td>
                          <td className="py-2.5 px-4">{row.am}</td>
                          <td className="py-2.5 px-4">{row.pm}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-slate-400 text-xs mt-2">※ 祝日の診療は変更になる場合があります</p>
              </div>

              {/* Access Notes */}
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Car size={22} className="text-blue-700" /> アクセス
                </h2>
                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
                    <Car size={18} className="text-blue-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-0.5">お車でお越しの方</p>
                      <p className="text-slate-500">駐車場あり（詳細は予約時にご案内）</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
                    <Train size={18} className="text-blue-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-0.5">公共交通機関でお越しの方</p>
                      <p className="text-slate-500">詳細はLINEでお問い合わせください</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Map */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <MapPin size={22} className="text-blue-700" /> 地図
              </h2>
              <div className="rounded-2xl overflow-hidden shadow-md h-72 md:h-96 mb-4">
                <iframe
                  src="https://maps.google.com/maps?q=山口県下関市彦島江の浦町9丁目1-14&hl=ja&z=16&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="ゆうき整骨院 地図"
                />
              </div>
              <a
                href="https://www.google.com/maps/search/?api=1&query=山口県下関市彦島江の浦町9丁目1-14"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                <MapPin size={16} />
                Googleマップで開く
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* LINE Reservation */}
      <section className="py-14 bg-gradient-to-br from-navy to-blue-800">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">ご予約はLINEが便利です</h2>
          <p className="text-blue-200 mb-8 text-sm">
            LINEからご予約・お問い合わせいただけます。<br />
            24時間受付（返信は診療時間内）
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <LineQRCode />
            <div className="flex flex-col items-center gap-4">
              <a
                href="https://lin.ee/uaGKbfk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 bg-line hover:bg-line-dark text-white font-bold px-10 py-4 rounded-full shadow-xl transition-all hover:scale-105 text-lg"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.145 2 11.243c0 3.121 1.588 5.89 4.063 7.706-.165.595-.535 2.225-.608 2.558-.092.413.148.41.314.3.13-.088 2.053-1.373 2.888-1.932.74.1 1.5.155 2.343.155 5.523 0 10-4.145 10-9.243S17.523 2 12 2z" />
                </svg>
                LINEで予約する
              </a>
              <p className="text-blue-300 text-xs">ボタンをタップするとLINEが開きます</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
