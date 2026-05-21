import Link from 'next/link'
import type { RehabCase } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS, DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS, SERVICE_TYPE_LABELS } from '@/types/rehab'
import { Video, Calendar, Mail } from 'lucide-react'

interface Props {
  case_: RehabCase
}

export default function CaseCard({ case_: c }: Props) {
  const movementTypes = [...new Set(c.videos.map((v) => v.movementType))]
  const deliveryStatus = c.deliveryStatus ?? 'received'

  return (
    <Link
      href={`/cases/${c.id}`}
      className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-[#0d9488] transition-all p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-base truncate">
              {c.patientName ?? c.anonymousId}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${DELIVERY_STATUS_COLORS[deliveryStatus]}`}>
              {DELIVERY_STATUS_LABELS[deliveryStatus]}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{c.sport ?? c.diagnosis}</p>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-400 flex-shrink-0">
          <Video className="w-4 h-4" />
          <span>{c.videos.length}</span>
        </div>
      </div>

      {/* クライアント連絡先 */}
      {c.clientEmail && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
          <Mail className="w-3.5 h-3.5 text-[#0d9488]" />
          <span className="truncate">{c.clientEmail}</span>
        </div>
      )}

      {/* サービス種別・年齢 */}
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 flex-wrap">
        {c.serviceType && (
          <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
            {SERVICE_TYPE_LABELS[c.serviceType]}
          </span>
        )}
        {c.age > 0 && (
          <span>{c.age}歳 · {c.gender === 'male' ? '男性' : c.gender === 'female' ? '女性' : 'その他'}</span>
        )}
      </div>

      {movementTypes.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {movementTypes.map((mt) => (
            <span key={mt} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
              {MOVEMENT_TYPE_LABELS[mt]}
            </span>
          ))}
        </div>
      )}

      {c.requestNote && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2 italic">"{c.requestNote}"</p>
      )}

      <div className="flex items-center gap-1 text-xs text-gray-400">
        <Calendar className="w-3.5 h-3.5" />
        受付: {c.createdAt.slice(0, 10)}
      </div>
    </Link>
  )
}
