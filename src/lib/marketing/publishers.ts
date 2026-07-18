/**
 * 媒体別の公開処理（指示書14・15章）
 *
 * 方針: API未承認・未接続でもアプリを止めない。
 * - トークン等が未設定の媒体は「手動投稿（action_required）」として、
 *   手動投稿用データと管理画面への導線を返す
 * - MARKETING_MODE=mock では常に模擬成功（外部送信なし）
 * - トークン設定済みの媒体のみ実APIを呼ぶ
 */
import type { Channel, GeneratedContent } from './types'

export type PublishOutcome =
  | { kind: 'published'; url?: string; message: string }
  | { kind: 'action_required'; reason: string; manualUrl: string }
  | { kind: 'error'; message: string }

const MOCK = process.env.MARKETING_MODE === 'mock'

export async function publishToChannel(channel: Channel, content: GeneratedContent): Promise<PublishOutcome> {
  if (MOCK) {
    return { kind: 'published', url: `https://example.com/mock/${channel}/${Date.now()}`, message: 'モックモードで公開を模擬しました（外部送信なし）' }
  }

  switch (channel) {
    case 'instagram_feed':
    case 'instagram_carousel':
    case 'instagram_reel':
      return publishInstagram(channel, content)
    case 'google_business':
      return publishGoogleBusiness()
    case 'line_broadcast':
      return publishLineBroadcast(content)
    case 'note':
      return {
        kind: 'action_required',
        reason: 'noteは公式投稿APIが提供されていないため手動投稿です。本文をコピーして投稿してください。',
        manualUrl: 'https://note.com/notes/new',
      }
    default:
      return { kind: 'error', message: '未対応の媒体です' }
  }
}

/**
 * 投稿画像を自動で用意する：テンプレート画像を生成してVercel Blobに公開し、
 * Instagram APIに渡せる公開URLを返す。失敗時はnull（手動投稿へフォールバック）。
 */
async function ensurePublicImageUrl(content: GeneratedContent): Promise<string | null> {
  try {
    const { renderTemplateImage } = await import('./image-template')
    const { put } = await import('@vercel/blob')
    const title = content.imageText || content.title || content.hook
    const png = await renderTemplateImage(title, content.hook.slice(0, 40), 'instagram')
    const blob = await put(`marketing/ig-${Date.now()}.png`, png, {
      access: 'public',
      contentType: 'image/png',
    })
    return blob.url
  } catch (error) {
    console.error('投稿画像の自動生成に失敗:', error instanceof Error ? error.message : error)
    return null
  }
}

/** Instagram API（コンテンツ公開）。トークン設定時は画像も自動生成して完全自動投稿 */
async function publishInstagram(channel: Channel, content: GeneratedContent): Promise<PublishOutcome> {
  const { getInstagramToken, INSTAGRAM_GRAPH_HOST } = await import('./instagram-token')
  const token = await getInstagramToken()
  const igUserId = process.env.INSTAGRAM_USER_ID
  const manualUrl = 'https://www.instagram.com/'

  if (!token || !igUserId) {
    return {
      kind: 'action_required',
      reason: 'Instagram API未接続のため手動投稿です（接続手順は「接続状況」画面を参照）。本文をコピーして投稿してください。',
      manualUrl,
    }
  }
  if (channel !== 'instagram_feed') {
    return { kind: 'action_required', reason: 'カルーセル・リールの自動投稿は段階対応中です。手動投稿してください。', manualUrl }
  }

  const imageUrl = await ensurePublicImageUrl(content)
  if (!imageUrl) {
    return {
      kind: 'action_required',
      reason: '投稿画像の自動生成に失敗しました（Blobストレージの設定を確認）。テンプレ画像をダウンロードして手動投稿してください。',
      manualUrl,
    }
  }

  try {
    // Instagramログイン方式のトークンは graph.instagram.com が接続先（graph.facebook.com では認証エラーになる）
    const caption = `${content.body}\n\n${content.hashtags.join(' ')}`
    const createRes = await fetch(`${INSTAGRAM_GRAPH_HOST}/v21.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
    })
    const createData = await createRes.json()
    if (!createRes.ok) throw new Error(createData.error?.message ?? 'メディア作成に失敗')

    const publishRes = await fetch(`${INSTAGRAM_GRAPH_HOST}/v21.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: createData.id, access_token: token }),
    })
    const publishData = await publishRes.json()
    if (!publishRes.ok) throw new Error(publishData.error?.message ?? '公開に失敗')

    // メディアIDのままではURLにならないため、permalink（実際の投稿URL）を取得する（失敗しても投稿自体は成功扱い）
    let postUrl = 'https://www.instagram.com/'
    try {
      const linkRes = await fetch(
        `${INSTAGRAM_GRAPH_HOST}/v21.0/${publishData.id}?fields=permalink&access_token=${encodeURIComponent(token)}`
      )
      const linkData = await linkRes.json()
      if (linkRes.ok && linkData.permalink) postUrl = linkData.permalink
    } catch {
      /* permalink取得失敗は無視 */
    }
    return { kind: 'published', url: postUrl, message: 'Instagramへ公開しました' }
  } catch (error) {
    return { kind: 'error', message: `Instagram APIエラー: ${error instanceof Error ? error.message : '不明'}` }
  }
}

/** Google Business Profile。API承認制のため、承認されるまでは常に手動投稿モード（指示書15章） */
async function publishGoogleBusiness(): Promise<PublishOutcome> {
  return {
    kind: 'action_required',
    reason: 'Google Business Profile APIは利用申請の承認待ちです。本文をコピーして管理画面から手動投稿し、完了チェックを付けてください。',
    manualUrl: 'https://business.google.com/',
  }
}

/** 公式LINE配信（Broadcast）。トークン設定時のみ実配信 */
async function publishLineBroadcast(content: GeneratedContent): Promise<PublishOutcome> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    return {
      kind: 'action_required',
      reason: 'LINEチャネル未接続のため手動配信です。本文をコピーしてLINE Official Account Managerから配信してください。',
      manualUrl: 'https://manager.line.biz/',
    }
  }
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: [{ type: 'text', text: `${content.hook}\n\n${content.body}` }] }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { message?: string }).message ?? `HTTP ${res.status}`)
    }
    return { kind: 'published', message: 'LINE友だちへ配信しました' }
  } catch (error) {
    return { kind: 'error', message: `LINE配信エラー: ${error instanceof Error ? error.message : '不明'}` }
  }
}
