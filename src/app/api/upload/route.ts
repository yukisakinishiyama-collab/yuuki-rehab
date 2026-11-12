import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { authEnabled, ROLE_HEADER } from '@/lib/marketing/auth'

// Vercel Blob クライアントアップロード用トークン発行エンドポイント（動画ストックの登録）
// - トークンの発行（ブラウザから）: 院内アプリにログインしている人だけ（proxy が役割ヘッダーを付ける）
// - 保存完了の通知（Vercel Blob のサーバーから）: 署名（x-vercel-signature）を handleUpload が確かめる
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody
  const role = request.headers.get(ROLE_HEADER)
  if (body?.type === 'blob.generate-client-token' && authEnabled() && role !== 'admin' && role !== 'staff') {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          'video/webm',
          'video/*',
        ],
        maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
      }),
      onUploadCompleted: async ({ blob }) => {
        // アップロード完了ログ（本番環境でのみ実行）
        console.log('[blob] upload completed:', blob.url)
      },
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    )
  }
}
