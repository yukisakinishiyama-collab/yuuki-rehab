import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

// 依頼種別ラベル
const SERVICE_LABELS: Record<string, string> = {
  sports:  'スポーツ・競技フォーム改善',
  rehab:   'リハビリ・回復確認',
  posture: '姿勢・日常動作改善',
  team:    'チーム・法人依頼',
  other:   'その他',
}

// メール通知を送信
async function sendNotificationEmail(data: {
  clientName: string
  clientEmail: string
  clientPhone?: string
  age?: string
  gender?: string
  serviceType: string
  sport: string
  requestNote?: string
  videoFileName: string
  videoSizeMB: string
  submittedAt: string
}) {
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD

  if (!gmailUser || !gmailPass) {
    console.warn('[notify] GMAIL_USER / GMAIL_APP_PASSWORD が未設定のためメール通知をスキップします')
    return
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  })

  const genderLabel = data.gender === 'male' ? '男性' : data.gender === 'female' ? '女性' : '未回答'
  const serviceLabel = SERVICE_LABELS[data.serviceType] ?? data.serviceType

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:linear-gradient(135deg,#1e3a5f,#0d9488);padding:24px;border-radius:12px 12px 0 0">
    <h1 style="color:white;margin:0;font-size:20px">📹 動作解析依頼が届きました</h1>
    <p style="color:#b2f5ea;margin:4px 0 0;font-size:13px">${data.submittedAt}</p>
  </div>
  <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">

    <h2 style="font-size:15px;color:#0f172a;border-bottom:2px solid #0d9488;padding-bottom:8px">お客様情報</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#64748b;width:40%">お名前</td><td style="padding:6px 0;font-weight:600">${data.clientName}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">メールアドレス</td><td style="padding:6px 0"><a href="mailto:${data.clientEmail}" style="color:#0d9488">${data.clientEmail}</a></td></tr>
      ${data.clientPhone ? `<tr><td style="padding:6px 0;color:#64748b">電話番号</td><td style="padding:6px 0">${data.clientPhone}</td></tr>` : ''}
      ${data.age ? `<tr><td style="padding:6px 0;color:#64748b">年齢</td><td style="padding:6px 0">${data.age}歳 / ${genderLabel}</td></tr>` : ''}
    </table>

    <h2 style="font-size:15px;color:#0f172a;border-bottom:2px solid #0d9488;padding-bottom:8px;margin-top:20px">依頼内容</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#64748b;width:40%">依頼の種類</td><td style="padding:6px 0">${serviceLabel}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">スポーツ・目的</td><td style="padding:6px 0;font-weight:600">${data.sport}</td></tr>
    </table>
    ${data.requestNote ? `
    <div style="margin-top:12px;background:#eff6ff;border-left:4px solid #3b82f6;padding:12px;border-radius:4px;font-size:14px">
      <p style="margin:0;color:#64748b;font-size:12px;font-weight:600;margin-bottom:4px">気になること・伝えたいこと</p>
      <p style="margin:0;color:#1e293b">${data.requestNote}</p>
    </div>` : ''}

    <h2 style="font-size:15px;color:#0f172a;border-bottom:2px solid #0d9488;padding-bottom:8px;margin-top:20px">動画ファイル</h2>
    <p style="font-size:14px;margin:0">📁 ${data.videoFileName}（${data.videoSizeMB} MB）</p>
    <p style="font-size:12px;color:#94a3b8;margin:4px 0 0">※ 動画はダッシュボードで確認できます</p>

    <div style="margin-top:24px;padding:16px;background:#ecfdf5;border-radius:8px;text-align:center">
      <p style="margin:0;font-size:13px;color:#065f46;font-weight:600">まずは <a href="mailto:${data.clientEmail}" style="color:#0d9488">${data.clientEmail}</a> へ返信してご対応ください</p>
    </div>
  </div>
  <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:12px">YUUKI MOTION LAB 自動通知メール</p>
</div>
  `

  await transporter.sendMail({
    from: `"YUUKI MOTION LAB" <${gmailUser}>`,
    to: gmailUser,
    subject: `【動作解析依頼】${data.clientName}様 ／ ${data.sport}`,
    html,
  })
}

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()
    const clientName  = (fd.get('clientName')  as string) || ''
    const clientEmail = (fd.get('clientEmail') as string) || ''
    const clientPhone = (fd.get('clientPhone') as string) || ''
    const age         = (fd.get('age')         as string) || ''
    const gender      = (fd.get('gender')      as string) || 'other'
    const serviceType = (fd.get('serviceType') as string) || 'other'
    const sport       = (fd.get('sport')       as string) || ''
    const requestNote = (fd.get('requestNote') as string) || ''
    const videoFile   = fd.get('video') as File | null

    if (!clientName || !clientEmail || !sport || !videoFile) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const videoSizeMB = (videoFile.size / 1024 / 1024).toFixed(1)
    const submittedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

    // 開発環境: ファイルに保存
    if (process.env.NODE_ENV === 'development') {
      const { writeFile, readFile, mkdir } = await import('fs/promises')
      const { existsSync } = await import('fs')
      const path = await import('path')

      const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')
      const SUBMISSIONS_FILE = path.join(UPLOADS_DIR, 'submissions.json')

      if (!existsSync(UPLOADS_DIR)) {
        await mkdir(UPLOADS_DIR, { recursive: true })
      }

      const ext = videoFile.name.split('.').pop() ?? 'mp4'
      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const fileName = `${fileId}.${ext}`
      const buffer = Buffer.from(await videoFile.arrayBuffer())
      await writeFile(path.join(UPLOADS_DIR, fileName), buffer)

      let submissions: object[] = []
      try {
        const raw = await readFile(SUBMISSIONS_FILE, 'utf-8')
        submissions = JSON.parse(raw)
      } catch { /* 初回 */ }

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
    }

    // 通知メールを送信（開発・本番共通）
    await sendNotificationEmail({
      clientName, clientEmail,
      clientPhone: clientPhone || undefined,
      age: age || undefined,
      gender,
      serviceType, sport,
      requestNote: requestNote || undefined,
      videoFileName: videoFile.name,
      videoSizeMB,
      submittedAt,
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Submit error:', error)
    const msg = error instanceof Error ? error.message : '送信処理に失敗しました'
    return NextResponse.json({ error: msg }, { status: 500 })
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
