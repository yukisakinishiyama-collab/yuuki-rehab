/**
 * 画像レポートのPDF（院内専用。proxy.ts の Basic 認証の内側）
 *
 * POST   multipart { file: application/pdf, patientId, reportId } → { storagePath, bytes }
 * GET    ?path=patientId/reportId.pdf[&name=ファイル名][&download=1] → PDFそのもの
 * DELETE ?path=patientId/reportId.pdf                              → 削除
 * 要点（部位・総括など）は端末のカルテ（pt_imaging_reports）に持つ。ログに患者IDは出さない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { getReport, isValidReportPath, MAX_REPORT_BYTES, putReport, removeReport } from '@/lib/karte/imaging-storage-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  const patientId = String(form?.get('patientId') ?? '')
  const reportId = String(form?.get('reportId') ?? '')
  if (!(file instanceof Blob) || !ID_RE.test(patientId) || !ID_RE.test(reportId)) {
    return NextResponse.json({ error: 'レポートか患者さんの情報が足りません' }, { status: 400 })
  }
  if (file.size > MAX_REPORT_BYTES) return NextResponse.json({ error: 'レポートが大きすぎます（4MBまで）' }, { status: 413 })
  const bytes = new Uint8Array(await file.arrayBuffer())
  // 中身がPDFであること（先頭が %PDF-）
  if (file.type !== 'application/pdf' || bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
    return NextResponse.json({ error: 'PDFだけ保存できます' }, { status: 400 })
  }
  const storagePath = `${patientId}/${reportId}.pdf`
  try {
    await putReport(storagePath, bytes)
    console.info('[karte/imaging] saved', { bytes: bytes.length })
    return NextResponse.json({ storagePath, bytes: bytes.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[karte/imaging] 保存に失敗', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? ''
  if (!isValidReportPath(path)) return NextResponse.json({ error: '場所が正しくありません' }, { status: 400 })
  // ファイル名は見出しに入れるだけ（記号は落とす）
  const name = (request.nextUrl.searchParams.get('name') ?? '').replace(/[^\p{L}\p{N}_.\-（）() ]/gu, '').slice(0, 80) || 'report.pdf'
  const disposition = request.nextUrl.searchParams.get('download') ? 'attachment' : 'inline'
  try {
    const bytes = await getReport(path)
    if (!bytes) return NextResponse.json({ error: 'レポートが見つかりません' }, { status: 404 })
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(name.endsWith('.pdf') ? name : `${name}.pdf`)}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}

export async function DELETE(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? ''
  if (!isValidReportPath(path)) return NextResponse.json({ error: '場所が正しくありません' }, { status: 400 })
  try {
    await removeReport(path)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
