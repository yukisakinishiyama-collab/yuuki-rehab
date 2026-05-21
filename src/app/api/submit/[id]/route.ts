import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'

const SUBMISSIONS_FILE = path.join(process.cwd(), 'public', 'uploads', 'submissions.json')

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const raw = await readFile(SUBMISSIONS_FILE, 'utf-8')
    const submissions = JSON.parse(raw) as Array<{ id: string; processed: boolean }>
    const idx = submissions.findIndex((s) => s.id === id)
    if (idx >= 0) {
      submissions[idx] = { ...submissions[idx], ...body }
      await writeFile(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf-8')
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
