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

/** テンプレート画像を生成してVercel Blobに公開し、Instagram APIに渡せる公開URLを返す */
async function uploadTemplateImage(title: string, subtitle: string, name: string): Promise<string> {
  const { renderTemplateImage } = await import('./image-template')
  const { put } = await import('@vercel/blob')
  const png = await renderTemplateImage(title, subtitle, 'instagram')
  const blob = await put(name, png, { access: 'public', contentType: 'image/png' })
  return blob.url
}

/** メディアコンテナ作成（Instagramログイン方式は graph.instagram.com が接続先） */
async function igCreateContainer(
  host: string,
  igUserId: string,
  token: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${host}/v21.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, access_token: token }),
  })
  const data = await res.json()
  if (!res.ok || !data.id) throw new Error(data.error?.message ?? 'メディア作成に失敗')
  return data.id as string
}

/** コンテナを公開し、投稿URL（permalink）を返す */
async function igPublishContainer(host: string, igUserId: string, token: string, creationId: string): Promise<string> {
  const res = await fetch(`${host}/v21.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  })
  const data = await res.json()
  if (!res.ok || !data.id) throw new Error(data.error?.message ?? '公開に失敗')

  // メディアIDのままではURLにならないため、permalink（実際の投稿URL）を取得する（失敗しても投稿自体は成功扱い）
  try {
    const linkRes = await fetch(`${host}/v21.0/${data.id}?fields=permalink&access_token=${encodeURIComponent(token)}`)
    const linkData = await linkRes.json()
    if (linkRes.ok && linkData.permalink) return linkData.permalink as string
  } catch {
    /* permalink取得失敗は無視 */
  }
  return 'https://www.instagram.com/'
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
  if (channel === 'instagram_reel') {
    return { kind: 'action_required', reason: 'リールは動画素材が必要なため手動投稿です。本文をコピーして投稿してください。', manualUrl }
  }

  const caption = `${content.body}\n\n${content.hashtags.join(' ')}`
  const slides = (content.slides ?? []).slice(0, 10) // IGカルーセルの上限は10枚

  try {
    let creationId: string
    if (channel === 'instagram_carousel' && slides.length >= 2) {
      // カルーセル: スライドごとに画像を生成→子コンテナ→親コンテナの順で組み立てる
      const ts = Date.now()
      const childIds: string[] = []
      for (const [i, slide] of slides.entries()) {
        const url = await uploadTemplateImage(slide.heading, slide.body.slice(0, 40), `marketing/ig-${ts}-s${i + 1}.png`)
        childIds.push(await igCreateContainer(INSTAGRAM_GRAPH_HOST, igUserId, token, { image_url: url, is_carousel_item: true }))
      }
      creationId = await igCreateContainer(INSTAGRAM_GRAPH_HOST, igUserId, token, {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption,
      })
    } else {
      // フィード単枚（カルーセル指定でもスライドが足りなければ1枚投稿に落とす）
      const title = content.imageText || content.title || content.hook
      const url = await uploadTemplateImage(title, content.hook.slice(0, 40), `marketing/ig-${Date.now()}.png`)
      creationId = await igCreateContainer(INSTAGRAM_GRAPH_HOST, igUserId, token, { image_url: url, caption })
    }

    const postUrl = await igPublishContainer(INSTAGRAM_GRAPH_HOST, igUserId, token, creationId)
    return { kind: 'published', url: postUrl, message: 'Instagramへ公開しました' }
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明'
    // 画像生成・Blob起因の失敗は手動投稿へフォールバック（リトライしても回復しないため）
    if (/BLOB|blob/.test(message)) {
      return {
        kind: 'action_required',
        reason: `投稿画像の公開に失敗しました（${message}）。テンプレ画像をダウンロードして手動投稿してください。`,
        manualUrl,
      }
    }
    return { kind: 'error', message: `Instagram APIエラー: ${message}` }
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
