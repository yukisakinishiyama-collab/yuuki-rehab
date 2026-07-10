import type { BodyRegion } from '@/types/patient'
import { drillGroups } from '@/data/drills'

// 診断名テキストに含まれるキーワードから対応する疾患スラッグを推定する
const DIAGNOSIS_KEYWORD_MAP: { keywords: string[]; slug: string }[] = [
  { keywords: ['前十字', 'ACL', 'acl'], slug: 'acl' },
  { keywords: ['半月板'], slug: 'meniscus' },
  { keywords: ['野球肘'], slug: 'baseball-elbow' },
  { keywords: ['野球肩', '投球障害肩'], slug: 'baseball-shoulder' },
  { keywords: ['オスグッド'], slug: 'osgood' },
  { keywords: ['シーバー'], slug: 'severs' },
  { keywords: ['シンスプリント'], slug: 'shin-splints' },
  { keywords: ['分離症'], slug: 'spondylolysis' },
  { keywords: ['肉離れ'], slug: 'muscle-strain' },
  { keywords: ['捻挫'], slug: 'ankle-sprain' },
  { keywords: ['股関節'], slug: 'hip-pain' },
  { keywords: ['腰'], slug: 'lower-back' },
  { keywords: ['手関節', '手首'], slug: 'wrist' },
  { keywords: ['膝'], slug: 'knee-pain' },
]

// 診断名から判別できない場合の、部位ごとのフォールバック先
const BODY_REGION_FALLBACK: Partial<Record<BodyRegion, string>> = {
  hip: 'hip-pain',
  knee: 'knee-pain',
  ankle: 'ankle-sprain',
  shoulder: 'baseball-shoulder',
  elbow: 'baseball-elbow',
  wrist: 'wrist',
  lumbar: 'lower-back',
}

const VALID_SLUGS = new Set(drillGroups.map((g) => g.diseaseSlug))

/**
 * 患者の診断名・部位から、競技復帰ドリルの疾患スラッグを推定する。
 * 該当が見つからない場合はundefined（=全疾患表示）を返す。
 */
export function guessDrillDiseaseSlug(diagnosisLabel: string, bodyRegion: BodyRegion): string | undefined {
  const byKeyword = DIAGNOSIS_KEYWORD_MAP.find((m) => m.keywords.some((k) => diagnosisLabel.includes(k)))
  const slug = byKeyword?.slug ?? BODY_REGION_FALLBACK[bodyRegion]
  return slug && VALID_SLUGS.has(slug) ? slug : undefined
}
