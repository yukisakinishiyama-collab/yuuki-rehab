import Link from 'next/link'
import type { RehabCase } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS } from '@/types/rehab'
import StatusBadge from './StatusBadge'
import TagBadge from './TagBadge'
import { Video, Calendar, User } from 'lucide-react'

interface Props {
  case_: RehabCase
}

export default function CaseCard({ case_: c }: Props) {
  const movementTypes = [
    ...new Set(c.videos.map((v) => v.movementType)),
  ]

  return (
    <Link
      href={`/cases/${c.id}`}
      className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-[#0d9488] transition-all p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-base">
              {c.patientName ?? c.anonymousId}
            </h3>
            <StatusBadge status={c.status} />
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{c.diagnosis}</p>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-400 flex-shrink-0">
          <Video className="w-4 h-4" />
          <span>{c.videos.length}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <User className="w-3.5 h-3.5" />
          {c.age}歳 · {c.gender === 'male' ? '男性' : c.gender === 'female' ? '女性' : 'その他'}
        </span>
        <span>{c.injuredPart}</span>
        {c.postOpDays != null && <span>術後 {c.postOpDays}日</span>}
      </div>

      {movementTypes.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {movementTypes.map((mt) => (
            <span
              key={mt}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200"
            >
              {MOVEMENT_TYPE_LABELS[mt]}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 mb-3">
        {c.tags.slice(0, 4).map((t) => (
          <TagBadge key={t} tag={t} />
        ))}
        {c.tags.length > 4 && (
          <span className="text-xs text-gray-400">+{c.tags.length - 4}</span>
        )}
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-400">
        <Calendar className="w-3.5 h-3.5" />
        更新: {c.updatedAt.slice(0, 10)}
      </div>
    </Link>
  )
}
