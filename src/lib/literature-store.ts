import type { LiteraturePaper } from '@/types/literature'
import { nanoid } from 'nanoid'

const KEY = 'literatureLibrary'

export function getLiteratureLibrary(): LiteraturePaper[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function savePaperToLibrary(
  paper: Omit<LiteraturePaper, 'id' | 'addedAt' | 'updatedAt'>,
): LiteraturePaper {
  const papers = getLiteratureLibrary()
  const now = new Date().toISOString()
  const newPaper: LiteraturePaper = { ...paper, id: nanoid(), addedAt: now, updatedAt: now }
  localStorage.setItem(KEY, JSON.stringify([...papers, newPaper]))
  return newPaper
}

export function updateLibraryPaper(id: string, patch: Partial<LiteraturePaper>): void {
  const papers = getLiteratureLibrary()
  const updated = papers.map(p =>
    p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
  )
  localStorage.setItem(KEY, JSON.stringify(updated))
}

export function deleteLibraryPaper(id: string): void {
  const papers = getLiteratureLibrary()
  localStorage.setItem(KEY, JSON.stringify(papers.filter(p => p.id !== id)))
}

export function isPmidSaved(pmid: string): boolean {
  return getLiteratureLibrary().some(p => p.pmid === pmid)
}

export function getPapersByDiagnosis(diagnosis: string): LiteraturePaper[] {
  if (!diagnosis) return []
  const papers = getLiteratureLibrary()
  const lower = diagnosis.toLowerCase()
  return papers.filter(
    p =>
      p.isActive &&
      (p.diagnosisCategories.some(d => d.toLowerCase().includes(lower)) ||
        p.keywords.some(k => k.toLowerCase().includes(lower)) ||
        p.title.toLowerCase().includes(lower)),
  )
}
