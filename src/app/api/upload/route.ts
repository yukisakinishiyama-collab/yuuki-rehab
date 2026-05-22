import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

// Vercel Blob クライアントアップロード用トークン発行エンドポイント
// ブラウザから直接 Blob へアップロードするために必要
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

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
