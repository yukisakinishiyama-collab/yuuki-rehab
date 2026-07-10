'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, ChevronRight } from 'lucide-react'
import { drillGroups, allSports } from '@/data/drills'
import type { DrillPhase } from '@/types/drill'

const phaseOptions: DrillPhase[] = ['アスリハ期', '競技復帰期']

const phaseStyle: Record<DrillPhase, string> = {
  'アスリハ期': 'bg-sky-100 text-sky-700 border-sky-200',
  '競技復帰期': 'bg-amber-100 text-amber-700 border-amber-200',
}

export default function DrillsExplorer() {
  const searchParams = useSearchParams()
  const initialDisease = searchParams.get('disease') ?? 'all'

  const [disease, setDisease] = useState(initialDisease)
  const [sport, setSport] = useState('all')
  const [phase, setPhase] = useState<'all' | DrillPhase>('all')

  const filteredGroups = useMemo(() => {
    return drillGroups
      .filter((g) => disease === 'all' || g.diseaseSlug === disease)
      .map((g) => ({
        ...g,
        drills: g.drills.filter((d) => {
          const sportMatch = sport === 'all' || d.sports.includes(sport)
          const phaseMatch = phase === 'all' || d.phase === phase
          return sportMatch && phaseMatch
        }),
      }))
      .filter((g) => g.drills.length > 0)
  }, [disease, sport, phase])

  return (
    <div>
      {/* フィルター */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 md:p-6 mb-10 grid sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">疾患・お悩みで絞り込む</label>
          <select
            value={disease}
            onChange={(e) => setDisease(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800"
          >
            <option value="all">すべての疾患</option>
            {drillGroups.map((g) => (
              <option key={g.diseaseSlug} value={g.diseaseSlug}>{g.diseaseLabel}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">競技で絞り込む</label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800"
          >
            <option value="all">すべての競技</option>
            {allSports.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">段階で絞り込む</label>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value as 'all' | DrillPhase)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800"
          >
            <option value="all">すべての段階</option>
            {phaseOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredGroups.length === 0 && (
        <p className="text-center text-slate-500 py-12">条件に一致するドリルが見つかりませんでした。</p>
      )}

      {/* 疾患別ドリル一覧 */}
      <div className="space-y-12">
        {filteredGroups.map((g) => (
          <div key={g.diseaseSlug}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="text-lg md:text-xl font-bold text-slate-900">{g.diseaseLabel}</h2>
              <Link
                href={`/symptoms/${g.diseaseSlug}`}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                症状の詳細を見る <ChevronRight size={14} />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {g.drills.map((d) => (
                <div key={d.id} className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-slate-800">{d.title}</h3>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${phaseStyle[d.phase]}`}>
                      {d.phase}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{d.description}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {d.sports.map((s) => (
                        <span key={s} className="bg-slate-50 text-slate-500 text-xs px-2 py-0.5 rounded border border-slate-200">
                          {s}
                        </span>
                      ))}
                    </div>
                    <a
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(d.youtubeQuery)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      <Search size={13} /> YouTubeで動画を探す
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
