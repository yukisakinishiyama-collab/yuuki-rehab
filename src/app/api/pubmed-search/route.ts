import { NextRequest, NextResponse } from 'next/server'
import type { PubMedSearchResult } from '@/types/literature'

interface MedlineRecord {
  [key: string]: string[]
}

function parseMedline(text: string): PubMedSearchResult[] {
  const records: PubMedSearchResult[] = []
  const lines = text.split('\n')
  let current: MedlineRecord = {}
  let currentKey = ''

  function flush() {
    const pmid = current['PMID']?.[0]?.trim()
    if (!pmid) return
    const title = (current['TI'] ?? []).join(' ').trim()
    if (!title) return
    const dpRaw = current['DP']?.[0] ?? ''
    const year = dpRaw.match(/\d{4}/)?.[0] ?? ''
    records.push({
      pmid,
      title,
      authors: (current['AU'] ?? []).slice(0, 3).map(a => a.trim()),
      journal: (current['JT']?.[0] ?? current['TA']?.[0] ?? '').trim(),
      year,
      abstract: (current['AB'] ?? []).join(' ').trim(),
    })
  }

  for (const line of lines) {
    if (line.trim() === '') {
      if (Object.keys(current).length > 0) {
        flush()
        current = {}
        currentKey = ''
      }
      continue
    }
    const fieldMatch = line.match(/^([A-Z]{2,4})\s*- (.*)/)
    if (fieldMatch) {
      currentKey = fieldMatch[1]
      if (!current[currentKey]) current[currentKey] = []
      current[currentKey].push(fieldMatch[2])
    } else if (currentKey && line.startsWith('      ')) {
      const arr = current[currentKey]
      if (arr && arr.length > 0) {
        arr[arr.length - 1] += ' ' + line.trim()
      }
    }
  }
  if (Object.keys(current).length > 0) flush()

  return records
}

export async function POST(req: NextRequest) {
  const { diagnosis, keywords } = (await req.json()) as {
    diagnosis: string
    keywords?: string
  }

  const terms = [diagnosis, 'rehabilitation', keywords].filter(Boolean).join(' AND ')

  try {
    // Step 1: PMIDリスト取得
    const searchUrl =
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` +
      `?db=pubmed&term=${encodeURIComponent(terms)}&retmax=8&sort=relevance&retmode=json`

    const searchRes = await fetch(searchUrl, { next: { revalidate: 3600 } })
    if (!searchRes.ok) throw new Error(`PubMed search failed: ${searchRes.status}`)

    const searchData = (await searchRes.json()) as {
      esearchresult?: { idlist?: string[] }
    }
    const pmids = searchData.esearchresult?.idlist ?? []
    if (pmids.length === 0) return NextResponse.json({ papers: [] })

    // Step 2: MEDLINE形式でフル詳細を取得
    const fetchUrl =
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi` +
      `?db=pubmed&id=${pmids.join(',')}&rettype=medline&retmode=text`

    const fetchRes = await fetch(fetchUrl)
    if (!fetchRes.ok) throw new Error(`PubMed fetch failed: ${fetchRes.status}`)

    const medlineText = await fetchRes.text()
    const papers = parseMedline(medlineText)

    return NextResponse.json({ papers })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
