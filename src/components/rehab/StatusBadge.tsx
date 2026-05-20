import type { CaseStatus } from '@/types/rehab'
import { CASE_STATUS_LABELS, CASE_STATUS_COLORS } from '@/types/rehab'

interface Props {
  status: CaseStatus
}

export default function StatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${CASE_STATUS_COLORS[status]}`}
    >
      {CASE_STATUS_LABELS[status]}
    </span>
  )
}
