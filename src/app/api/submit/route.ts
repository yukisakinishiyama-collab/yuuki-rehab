import { NextRequest, NextResponse } from 'next/server'

// このAPIはローカル開発時のクライアント送付フォーム用です。
// Vercel（本番）環境では動画は直接アップロード（内部ツール）で行います。

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'このAPIはローカル開発時のみ使用できます' }, { status: 503 })
  }

  try {
    const { writeFile, readFile, mkdir } = await import('fs/promises')
    const { existsSync } = await import('fs')
    const path = await import('path')

    const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')
    const SUBMISSIONS_FILE = path.join(UPLOADS_DIR, 'submissions.json')

    if (!existsSync(UPLOADS_DIR)) {
      await mkdir(UPLOADS_DIR, { recursive: true })
    }

    const fd = await req.formData()
    const clientName  = (fd.get('clientName')  as string) || ''
    const clientEmail = (fd.get('clientEmail') as string) || ''
    const clientPhone = (fd.get('clientPhone') as string) || undefined
    const age         = (fd.get('age')         as string) || ''
    const gender      = (fd.get('gender')      as string) || 'other'
    const serviceType = (fd.get('serviceType') as string) || 'other'
    const sport       = (fd.get('sport')       as string) || ''
    const requestNote = (fd.get('requestNote') as string) || undefined
    const videoFile   = fd.get('video') as File | null

    if (!clientName || !clientEmail || !sport || !videoFile) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const ext = videoFile.name.split('.').pop() ?? 'mp4'
    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const fileName = `${fileId}.${ext}`
    const filePath = path.join(UPLOADS_DIR, fileName)

    const buffer = Buffer.from(await videoFile.arrayBuffer())
    await writeFile(filePath, buffer)

    let submissions: object[] = []
    try {
      const raw = await readFile(SUBMISSIONS_FILE, 'utf-8')
      submissions = JSON.parse(raw)
    } catch { /* 初回は空配列 */ }

    submissions.unshift({
      id: fileId, clientName, clientEmail,
      clientPhone: clientPhone || undefined,
      age: age ? Number(age) : undefined,
      gender, serviceType, sport,
      requestNote: requestNote || undefined,
      videoPath: `/uploads/${fileName}`,
      videoFileName: videoFile.name,
      createdAt: new Date().toISOString(),
      processed: false,
    })

    await writeFile(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf-8')
    return NextResponse.json({ success: true, id: fileId })
  } catch (err) {
    console.error('Submit error:', err)
    return NextResponse.json({ error: '送信処理に失敗しました' }, { status: 500 })
  }
}

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json([])
  }
  try {
    const { readFile } = await import('fs/promises')
    const path = await import('path')
    const SUBMISSIONS_FILE = path.join(process.cwd(), 'public', 'uploads', 'submissions.json')
    const raw = await readFile(SUBMISSIONS_FILE, 'utf-8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json([])
  }
}
