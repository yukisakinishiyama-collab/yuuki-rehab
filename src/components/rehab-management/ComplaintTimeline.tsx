'use client'
// ──────────────────────────────────────────────
// 部位の移り変わり（患者さん1人分）
// SOAPカルテの部位（ComplaintEntry）を id でつなぎ、「いつ始まり・いつ終わったか・NRS の変化」を一覧で出す。
// 負傷部位や痛みの場所が変わったときに、経過を追えるようにする（lib/karte/followup.ts）
// ──────────────────────────────────────────────
import { useMemo, useState } from 'react'
import type { SOAPNote } from '@/types/patient'
import { complaintEpisodes, type ComplaintEpisode } from '@/lib/karte/followup'

const STATE: Record<ComplaintEpisode['state'], { label: string; chip: string }> = {
  active: { label: '経過中', chip: 'bg-amber-100 text-amber-900 border-amber-200' },
  resolved: { label: '軽快・終了', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  dropped: { label: '記録から外れた', chip: 'bg-slate-100 text-slate-700 border-slate-200' },
}

const md = (d?: string) => (d ? d.slice(5).replace('-', '/') : '')

export default function ComplaintTimeline({ soapNotes }: { soapNotes: SOAPNote[] }) {
  const [open, setOpen] = useState(false)
  const episodes = useMemo(() => complaintEpisodes(soapNotes), [soapNotes])
  if (episodes.length === 0) return null
  const active = episodes.filter(e => e.state === 'active')

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left max-lg:min-h-10">
        <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">🩹 部位の移り変わり</span>
        <span className="text-xs text-gray-500 truncate">
          経過中 {active.length}件{active.length ? `：${active.map(e => e.label).join('、')}` : ''}
          {episodes.length > active.length ? ` · 終了 ${episodes.length - active.length}件` : ''}
        </span>
        <span className="ml-auto text-xs text-slate-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="px-4 pb-4 space-y-2">
          {episodes.map(e => {
            const st = STATE[e.state]
            const diff = e.lastNrs - e.firstNrs
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${st.chip}`}>{st.label}</span>
                <span className="font-medium text-gray-800">{e.label}</span>
                <span className="text-xs text-gray-500">
                  {md(e.startedAt)}〜{e.endedAt ? md(e.endedAt) : ''} · {e.visits}回
                </span>
                <span className="text-xs text-gray-600">
                  NRS {e.firstNrs} → {e.lastNrs}
                  {diff !== 0 && (
                    <span className={`ml-1 font-bold ${diff < 0 ? 'text-emerald-700' : 'text-red-700'}`}>{diff < 0 ? `↓${-diff}` : `↑${diff}`}</span>
                  )}
                </span>
              </li>
            )
          })}
          <li className="text-xs text-gray-500 pt-1">
            「記録から外れた」は、終了の記録がないまま最新のカルテに出てこなくなった部位です。終了なら、次のカルテで「軽快・終了」にしてください。
          </li>
        </ul>
      )}
    </div>
  )
}
