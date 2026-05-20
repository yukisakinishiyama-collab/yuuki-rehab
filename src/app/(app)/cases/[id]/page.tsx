import { Suspense } from 'react'
import CaseDetail from '@/components/rehab/CaseDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CaseDetailPage({ params }: Props) {
  const { id } = await params
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">読み込み中...</div>}>
      <CaseDetail caseId={id} />
    </Suspense>
  )
}
