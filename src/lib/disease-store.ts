// 疾患ページのアクセサと検索
// 現状は静的データ（src/data/diseases）を参照。
// 将来の管理画面追加時は localStorage オーバーレイをここに実装する。

import type { DiseasePage, DiseaseCategory, PlannedDisease } from '@/types/disease'
import { DISEASE_PAGES, PLANNED_CATALOG } from '@/data/diseases'

export function getDiseasePages(): DiseasePage[] {
  return DISEASE_PAGES
}

export function getDiseasePage(id: string): DiseasePage | undefined {
  return DISEASE_PAGES.find(p => p.id === id)
}

export function getPlannedCatalog(): Record<DiseaseCategory, PlannedDisease[]> {
  return PLANNED_CATALOG
}

/** 作成済みページを収載カタログの名称と照合する（一覧表示用） */
export function findPageByName(name: string): DiseasePage | undefined {
  return DISEASE_PAGES.find(p =>
    p.names.ja === name ||
    p.names.synonyms.includes(name) ||
    p.names.abbreviations.includes(name)
  )
}

/** 正規化: 大文字小文字・空白・「靱/靭」の揺れを吸収 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').replace(/靭/g, '靱')
}

export interface DiseaseSearchResult {
  type: 'page' | 'planned'
  category: DiseaseCategory
  name: string
  /** マッチした語（同義語ヒット時の表示用） */
  matched?: string
  page?: DiseasePage
}

/** 疾患名・英語名・略語・同義語・症状キーワードを横断検索 */
export function searchDiseases(query: string): DiseaseSearchResult[] {
  const q = normalize(query)
  if (!q) return []
  const results: DiseaseSearchResult[] = []

  // 作成済みページ
  for (const page of DISEASE_PAGES) {
    const haystacks: Array<[string, string]> = [
      [page.names.ja, page.names.ja],
      [page.names.en, page.names.en],
      ...page.names.abbreviations.map(a => [a, a] as [string, string]),
      ...page.names.synonyms.map(s => [s, s] as [string, string]),
      ...page.keywords.map(k => [k, k] as [string, string]),
    ]
    const hit = haystacks.find(([h]) => normalize(h).includes(q))
    if (hit) {
      results.push({ type: 'page', category: page.category, name: page.names.ja, matched: hit[1] !== page.names.ja ? hit[1] : undefined, page })
    }
  }

  // 収載予定カタログ
  for (const [category, list] of Object.entries(PLANNED_CATALOG) as [DiseaseCategory, PlannedDisease[]][]) {
    for (const d of list) {
      if (results.some(r => r.name === d.name)) continue
      const names = [d.name, ...(d.synonyms ?? [])]
      const hit = names.find(n => normalize(n).includes(q))
      if (hit) {
        const page = findPageByName(d.name)
        results.push({
          type: page ? 'page' : 'planned',
          category, name: d.name,
          matched: hit !== d.name ? hit : undefined,
          page,
        })
      }
    }
  }

  return results.slice(0, 30)
}
