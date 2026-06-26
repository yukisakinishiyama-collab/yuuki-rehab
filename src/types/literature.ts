import type { EvidenceGrade } from './protocol'

export interface LiteraturePaper {
  id: string
  pmid?: string
  title: string
  authors: string[]
  journal: string
  year: string
  abstract: string
  keywords: string[]
  diagnosisCategories: string[]
  evidenceGrade?: EvidenceGrade
  notes: string
  url?: string
  isActive: boolean
  addedAt: string
  updatedAt: string
}

export interface PubMedSearchResult {
  pmid: string
  title: string
  authors: string[]
  journal: string
  year: string
  abstract: string
}

export const DIAGNOSIS_CATEGORY_OPTIONS = [
  'ACL再建後', '半月板損傷', 'TKA術後', '膝蓋大腿痛（PFP）',
  '腱板修復後', '凍結肩', '肩関節不安定症', '足関節捻挫',
  'アキレス腱断裂', 'THA術後', 'FAI・股関節鏡術後', '腰椎疾患',
  '頸椎疾患', 'スポーツ障害全般', 'その他',
] as const
