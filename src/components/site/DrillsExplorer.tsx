'use client'

import { useSearchParams } from 'next/navigation'
import DrillsBrowser from './DrillsBrowser'

export default function DrillsExplorer() {
  const searchParams = useSearchParams()
  const initialDisease = searchParams.get('disease') ?? 'all'

  return <DrillsBrowser initialDiseaseSlug={initialDisease} />
}
