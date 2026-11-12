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
import type { PublishJob } from './jobs-store-server'
import type { PromoVideoSnapshot } from './promo-approval'
import { getGbpCredentials } from './gbp-token'
import { imageTextFor } from './post-image'
import { googleButtonUrl, googlePostState, googleSummary } from './gbp-post-rules'
import { getGbpSeoPost, gbpSeoText } from '../../data/gbp-seo-posts'

export type PublishOutcome =
  | { kind: 'published'; url?: string; message: string; external?: PublishJob['external']; google?: PublishJob['google'] }
  | { kind: 'action_required'; reason: string; manualUrl: string }
  | { kind: 'error'; message: string }
  /** 出す必要がなくなった（例：ストーリーの時刻に空きが無くなっていた）。投稿はしない */
  | { kind: 'skipped'; message: string }
  /** まだ出さない（院長の承認待ちなど）。retryAt（ISO）になったらもう一度見る。やり直しの回数には数えない */
  | { kind: 'wait'; retryAt: string; message: string }

const MOCK = process.env.MARKETING_MODE === 'mock'

export async function publishToChannel(channel: Channel, content: GeneratedContent, ctx: { jobKey?: string } = {}): Promise<PublishOutcome> {
  if (MOCK) {
    return { kind: 'published', url: `https://example.com/mock/${channel}/${Date.now()}`, message: 'モックモードで公開を模擬しました（外部送信なし）' }
  }

  switch (channel) {
    case 'instagram_feed':
    case 'instagram_carousel':
      return publishInstagram(channel, content)
    case 'instagram_reel':
      // 宣伝の短い動画（promoVideoId あり）はリールとして出す。AIの投稿案のリールは動画が無いので手で（これまでどおり）
      return content.promoVideoId ? publishPromoVideo(channel, content, ctx.jobKey) : publishInstagram(channel, content)
    case 'instagram_story':
      return publishInstagramStory(content)
    case 'google_business':
      return publishGoogleBusiness(content, ctx.jobKey)
    case 'line_broadcast':
      return publishLineBroadcast(content)
    case 'note':
      return {
        kind: 'action_required',
        reason: 'noteは公式投稿APIが提供されていないため手動投稿です。本文をコピーして投稿してください。',
        manualUrl: 'https://note.com/notes/new',
      }
    case 'youtube_short':
    case 'tiktok':
      return publishPromoVideo(channel, content, ctx.jobKey)
    default:
      return { kind: 'error', message: '未対応の媒体です' }
  }
}

/**
 * 投稿画像を作って Vercel Blob に公開し、Instagram・Google の API に渡せる公開URLを返す。
 * 下書きにAI画像（photoUrl）があれば写真＋見出し、無い・読めないときはテンプレ画像（これまでどおり）
 */
async function uploadPostImage(
  text: { title: string; subtitle: string },
  name: string,
  size: 'instagram' | 'google' = 'instagram',
  photoUrl?: string,
): Promise<string> {
  const { renderTemplateImage, renderPhotoPostImage, loadPhotoDataUrl, toJpeg } = await import('./image-template')
  const { put } = await import('@vercel/blob')
  let png: Buffer | null = null
  if (photoUrl) {
    try {
      png = await renderPhotoPostImage(await loadPhotoDataUrl(photoUrl), text.title, text.subtitle, size)
    } catch (error) {
      // AI画像が読めなくても投稿は止めない（テンプレ画像で出す）
      console.warn('[publishers] AI画像を使えなかったため、テンプレ画像で投稿します', error)
    }
  }
  if (!png) png = await renderTemplateImage(text.title, text.subtitle, size)
  // Instagram の API は JPEG の画像を受け付ける。Google はどちらでもよいので同じく JPEG に
  const jpg = await toJpeg(png)
  const blob = await put(name.replace(/\.png$/, '.jpg'), jpg, { access: 'public', contentType: 'image/jpeg' })
  return blob.url
}

/** Google検索向けの投稿の画像（院の写真＋見出し・院の強み）を作って Vercel Blob に公開する */
async function uploadSeoImage(postId: string): Promise<string> {
  const { GBP_SEO_CHIPS, getGbpSeoPost } = await import('@/data/gbp-seo-posts')
  const post = getGbpSeoPost(postId)
  if (!post) throw new Error('Google検索向けの投稿が見つかりません')
  const { renderSeoPostImage, toJpeg } = await import('./image-template')
  const { put } = await import('@vercel/blob')
  const png = await renderSeoPostImage({ photo: post.photo, photoPosition: post.photoPosition, title: post.title, subtitle: post.subtitle, chips: GBP_SEO_CHIPS })
  const blob = await put(`marketing/gbp-seo-${post.id}-${Date.now()}.jpg`, await toJpeg(png), { access: 'public', contentType: 'image/jpeg' })
  return blob.url
}

/** 宣伝の短い動画の作りおき（無ければ組み立てる）。外に渡せるURLで返す */
async function promoVideoFor(content: GeneratedContent): Promise<{ url: string; posterUrl: string; aiImages: number } | { error: string }> {
  if (!content.promoVideoId) return { error: '出す動画が決まっていません' }
  try {
    const { absolutePromoUrl, ensurePromoVideo } = await import('./promo-video-server')
    const stored = await ensurePromoVideo(content.promoVideoId)
    return { url: absolutePromoUrl(stored.url), posterUrl: absolutePromoUrl(stored.posterUrl), aiImages: stored.aiImages ?? 0 }
  } catch (error) {
    console.error('[publishers] 動画を作れませんでした', error)
    return { error: `動画を作れませんでした（${error instanceof Error ? error.message.slice(0, 200) : '不明'}）` }
  }
}

/**
 * YouTubeショート・TikTok の動画（promo-video-server の promoGate で出し方を決める）。
 * 自動で出せる媒体（Buffer につないだ／YouTube の連携と審査が済んだ）は、院長の承認が要る（promo-approval.ts）:
 *   承認済み → 承認した動画を公開／承認待ち → 待つ（wait）／見送り・期限切れ → 出さない（skipped）。
 * 自動で出せない媒体は、動画と文を院長のLINEへ届けて手で投稿（action_required → nudgeManualPosts）。
 * YouTube も TikTok も、審査に通っていないアプリから送ると「非公開」「自分だけ」に固定されるため、
 * 自分で送るのは YouTube の審査に通ったときだけ。ふだんは審査済みの Buffer を通す（2026-11-12 院長の判断）。
 */
async function publishPromoVideo(channel: 'youtube_short' | 'tiktok' | 'instagram_reel', content: GeneratedContent, jobKey?: string): Promise<PublishOutcome> {
  if (!content.promoVideoId) return { kind: 'error', message: '出す動画が決まっていません' }
  const { promoGate } = await import('./promo-video-server')
  const gate = await promoGate(channel, jobKey)
  if (gate.kind === 'wait') return { kind: 'wait', retryAt: gate.retryAt, message: gate.message }
  if (gate.kind === 'skip') return { kind: 'skipped', message: gate.message }
  if (gate.kind === 'auto' && channel === 'instagram_reel') return publishInstagramReel(content, gate.video)
  if (gate.kind === 'auto' && gate.route === 'buffer' && channel !== 'instagram_reel') return publishViaBuffer(channel, content, gate.video)
  if (gate.kind === 'auto' && channel === 'youtube_short') return publishYoutubeShort(content, gate.video)
  return publishPromoManually(channel, content)
}

/** 手で投稿（動画を作りおき＝無ければ作って、院長のLINEへ届ける） */
async function publishPromoManually(channel: 'youtube_short' | 'tiktok' | 'instagram_reel', content: GeneratedContent): Promise<PublishOutcome> {
  const video = await promoVideoFor(content)
  if ('error' in video) return { kind: 'error', message: video.error }
  return {
    kind: 'action_required',
    reason:
      channel === 'instagram_reel'
        ? 'Instagramとの連携がまだのため手動投稿です。動画を保存して、Instagramアプリの「＋」→「リール」から投稿してください（文はコピーして貼れます）。'
        : channel === 'youtube_short'
        ? 'YouTubeは自動で出す連携（Buffer）がまだのため手動投稿です。動画を保存して、YouTubeアプリの「＋」→「動画をアップロード」から投稿してください（題名・説明はコピーして貼れます）。'
        : 'TikTokは自動で出す連携（Buffer）がまだのため手動投稿です。動画を保存して、TikTokアプリの「＋」→「アップロード」から投稿してください（説明はコピーして貼れます。音楽はアプリの中で足せます）。',
    manualUrl: video.url,
  }
}

/** 承認した動画を Buffer で出す（すぐ出す・自動で公開）。出たかどうかは後で確かめる（external） */
async function publishViaBuffer(channel: 'youtube_short' | 'tiktok', content: GeneratedContent, video: PromoVideoSnapshot): Promise<PublishOutcome> {
  const [{ bufferTargetFor, createBufferVideoPost, findRecentBufferPost, BufferError }, { bufferPostPhase }] = await Promise.all([import('./buffer-server'), import('./buffer')])
  const name = channel === 'youtube_short' ? 'YouTube' : 'TikTok'
  const manual = (reason: string): PublishOutcome => ({ kind: 'action_required', reason: `${reason}今回は手で投稿してください（承認した動画を開いて保存できます）。`, manualUrl: video.url })
  const { isFetchableFromOutside } = await import('./promo-video-server')
  if (!isFetchableFromOutside(video.url)) return manual('動画が院内アプリの中にあり、Bufferから取りに来られません（動画の置き場＝Vercel Blob の設定を確かめてください）。')
  const target = await bufferTargetFor(channel)
  if (!target) return manual(`Bufferの${name}のチャンネルが使えなくなっていました（自動投稿の設定の「Buffer」で確かめてください）。`)
  const outcome = (post: { id: string; status: string; externalLink: string | null; error: string | null }): PublishOutcome => {
    if (bufferPostPhase(post.status) === 'error') return manual(`Bufferから${name}へ投稿できませんでした（${(post.error ?? '理由は不明').slice(0, 200)}）。`)
    const sent = bufferPostPhase(post.status) === 'sent'
    return {
      kind: 'published',
      url: post.externalLink ?? undefined,
      message: sent ? `${name}に公開しました（Buffer）` : `Bufferに渡しました。${name}に出たかを確かめています`,
      external: { service: 'buffer', postId: post.id, createdAt: new Date().toISOString(), videoUrl: video.url, status: post.status, ...(sent && post.externalLink ? { done: true } : {}) },
    }
  }
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  try {
    return outcome(await createBufferVideoPost(target.key, { channelId: target.channelId, channel, content, videoUrl: video.url, aiGenerated: video.aiImages > 0 }))
  } catch (error) {
    if (error instanceof BufferError && error.kind === 'network') {
      // 届いたか分からない：やり直すと二重に出るので、先に同じ投稿ができていないか確かめる
      try {
        const found = await findRecentBufferPost(target.key, target.channelId, since, content.body)
        if (found) return outcome(found)
      } catch {
        return manual(`Bufferに届いたか確かめられませんでした。Bufferの画面で${name}の投稿を確かめてください。出ていなければ、`)
      }
      return { kind: 'error', message: error.message }
    }
    // 回数の上限はしばらく待てば直る（やり直す）。キーの誤り・Buffer が断った内容は、やり直しても同じなので手で
    if (error instanceof BufferError && error.kind === 'rate') return { kind: 'error', message: error.message }
    return manual(`${error instanceof Error ? error.message : 'Bufferのエラー'}。`)
  }
}

/**
 * 承認した動画を Instagram のリールとして出す（ふだんの投稿と同じ Instagram の連携で。フィードにも表示する）。
 * 動画は Instagram が URL から取りに来るので、外から読める置き場（Vercel Blob）にあるものだけ。
 * 取り込みに時間がかかる（数十秒〜）ので、準備ができるまで待ってから公開する
 */
async function publishInstagramReel(content: GeneratedContent, video: PromoVideoSnapshot): Promise<PublishOutcome> {
  const manual = (reason: string): PublishOutcome => ({ kind: 'action_required', reason: `${reason}今回は手で投稿してください（承認した動画を開いて保存できます）。`, manualUrl: video.url })
  const { getInstagramToken, getInstagramUserId, INSTAGRAM_GRAPH_HOST } = await import('./instagram-token')
  const token = await getInstagramToken()
  const igUserId = await getInstagramUserId()
  if (!token || !igUserId) return manual('Instagramとの連携が外れていました。')
  const { isFetchableFromOutside } = await import('./promo-video-server')
  if (!isFetchableFromOutside(video.url)) return manual('動画が院内アプリの中にあり、Instagramから取りに来られません（動画の置き場＝Vercel Blob の設定を確かめてください）。')
  try {
    const creationId = await igCreateContainer(INSTAGRAM_GRAPH_HOST, igUserId, token, {
      media_type: 'REELS',
      video_url: video.url,
      caption: content.body,
      share_to_feed: true,
      ...(isFetchableFromOutside(video.posterUrl) ? { cover_url: video.posterUrl } : {}),
    })
    // 動画の取り込みは画像より長い（公開側でも40秒ほど待つので、合わせて2分ほど）
    await igWaitForContainer(INSTAGRAM_GRAPH_HOST, token, creationId, 40)
    const postUrl = await igPublishContainer(INSTAGRAM_GRAPH_HOST, igUserId, token, creationId)
    return { kind: 'published', url: postUrl, message: 'Instagramにリールを公開しました' }
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明'
    // Instagram が動画を受け付けなかった（形式など）ときは、やり直しても同じなので手で
    if (/取り込めませんでした|video|format|aspect|duration|codec/i.test(message)) return manual(`Instagramが動画を受け付けませんでした（${message.slice(0, 200)}）。`)
    return { kind: 'error', message: `Instagram APIエラー: ${message}` }
  }
}

/**
 * YouTube ショートを YouTube に直接アップロードする（Buffer を使わず、YouTube の連携と審査が済んでいるとき。承認した動画だけ）。
 * 審査の前にアプリから送ると、動画が「非公開」に固定されて公開に直せない（YouTube の決まり）ので、promoGate が審査済みのときだけここへ来る。
 */
async function publishYoutubeShort(content: GeneratedContent, video: PromoVideoSnapshot): Promise<PublishOutcome> {
  const { getYoutubeCredentials, uploadYoutubeVideo, youtubeAccessToken, YoutubeAuthError } = await import('./youtube-server')
  const creds = await getYoutubeCredentials()
  if (!creds) return { kind: 'action_required', reason: 'YouTubeとの連携が外れていたため手動投稿です。動画を保存して、YouTubeアプリから投稿してください。', manualUrl: video.url }
  try {
    const token = await youtubeAccessToken(creds)
    const res = await fetch(video.url, { cache: 'no-store', signal: AbortSignal.timeout(60_000) })
    if (!res.ok) return { kind: 'error', message: `承認した動画を読めませんでした（HTTP ${res.status}）` }
    const bytes = new Uint8Array(await res.arrayBuffer())
    const tags = (content.body.match(/#[^\s#]+/g) ?? []).map((t) => t.slice(1)).filter((t) => t !== 'Shorts')
    const uploaded = await uploadYoutubeVideo(token, { title: content.title, description: content.body, tags, bytes, synthetic: video.aiImages > 0 })
    if (uploaded.privacyStatus && uploaded.privacyStatus !== 'public') {
      return { kind: 'published', url: uploaded.url, message: `YouTubeに送りましたが、公開の状態が「${uploaded.privacyStatus}」です。YouTube Studio で確かめてください` }
    }
    return { kind: 'published', url: uploaded.url, message: 'YouTubeにショート動画を公開しました' }
  } catch (error) {
    if (error instanceof YoutubeAuthError) {
      return { kind: 'action_required', reason: `${error.message}。今回は手で投稿し、自動投稿の設定の「YouTubeとつなぐ」をやり直してください。`, manualUrl: video.url }
    }
    return { kind: 'error', message: `YouTubeのエラー: ${error instanceof Error ? error.message : '不明'}` }
  }
}

/**
 * Instagramストーリー（予約の空き状況）。
 * 投稿する時刻に予約システムから空きを取り直して画像を作る（取り直せなければ下書きのときの空き）。
 * 案内できる空きが無くなっていたら出さない（skipped）。リンクのスタンプはAPIで付けられないので、画像に「プロフィールのリンクから」と書く。
 * Instagram が未接続の間は、画像だけ作って院長に送り、手で投稿してもらう（action_required の manualUrl に画像のURL）。
 */
async function publishInstagramStory(content: GeneratedContent): Promise<PublishOutcome> {
  const story = content.story
  if (!story || story.dates.length === 0) return { kind: 'error', message: 'ストーリーの空き状況の情報がありません' }
  const { fetchHubStats } = await import('./booking-stats')
  const { jstParts } = await import('./autopilot-planner')
  const { buildStory } = await import('./story-server')
  // 出す時刻のいまの空きで作る（控えは使わない）
  const fresh = await fetchHubStats(1, { fresh: true }).catch(() => null)
  // キャンセルで空いた枠のお知らせは、いまの空きが取れないと枠が空いているか分からないので、出さずにやり直す
  if (story.trigger === 'cancel' && !fresh) {
    return { kind: 'error', message: '予約システムからいまの空きを取れませんでした（やり直します）' }
  }
  const openings = fresh?.openings?.length ? fresh.openings : story.snapshot
  const now = jstParts(new Date())
  // 院長が画面で直したところ（見出し・ひとこと・出さない時間など）も、出す時刻の空きに当てはめる
  const built = buildStory(openings, story.dates, story.scope, now.local, story.title, story.edits ?? {})
  const rows = built.rows
  if (rows.length === 0 || !built.hasOpening) {
    return { kind: 'skipped', message: '投稿の時刻に案内できる空きが無かったため、ストーリーは出しませんでした' }
  }
  // キャンセルで空いた枠のお知らせは、その枠がまだ空いているときだけ出す
  if (story.requireSlot) {
    const row = rows.find((r) => r.date === story.dates[0])
    const slot = story.requireSlot
    const stillOpen = row
      ? row.slots
        ? row.slots.some((s) => s.time === slot && s.remaining > 0)
        : (slot < '13:00' ? row.am : row.pm) !== 'full' && !row.closed
      : false
    if (!stillOpen) {
      return { kind: 'skipped', message: `キャンセルで空いた ${slot} の枠がもう埋まっていたため、ストーリーは出しませんでした` }
    }
  }
  const text = { title: built.title }
  const asOfLabel = `${Number(now.local.slice(5, 7))}/${Number(now.local.slice(8, 10))} ${now.local.slice(11, 16)} 時点${fresh ? '' : '（前の晩の空き）'}`

  let imageUrl: string
  try {
    const { renderStoryImage, toJpeg } = await import('./image-template')
    const { put } = await import('@vercel/blob')
    // APIで出すストーリーには「リンク」のスタンプを付けられない（Instagramの決まり）。画像の中のQRもスマホでは読めないので、
    // プロフィールのリンクへ案内する。手で出すとき（院内アプリの「リンクつきで出す」）はスタンプで押せるようにする
    const jpg = await toJpeg(
      await renderStoryImage({
        title: text.title,
        asOfLabel,
        scope: story.scope,
        rows,
        note: built.note,
        showRemaining: built.showRemaining,
        cta: 'profile',
      }),
    )
    imageUrl = (await put(`marketing/story-${Date.now()}.jpg`, jpg, { access: 'public', contentType: 'image/jpeg' })).url
  } catch (error) {
    // 画面に出す文は短くしてよいが、原因そのものは切らずにログへ残す
    // （sharp が読み込めない等は、80字で切ると理由が分からなくなる）
    console.error('[publishers] ストーリー画像を作れませんでした', error)
    return { kind: 'error', message: `ストーリー画像を作れませんでした（${error instanceof Error ? error.message.slice(0, 200) : '不明'}）` }
  }

  const { getInstagramToken, getInstagramUserId, INSTAGRAM_GRAPH_HOST } = await import('./instagram-token')
  const token = await getInstagramToken()
  const igUserId = await getInstagramUserId()
  if (!token || !igUserId) {
    return {
      kind: 'action_required',
      reason: 'Instagram API未接続のため手動投稿です。ストーリー用の画像を開いて保存し、Instagramアプリのストーリーで投稿してください（リンクのスタンプで予約ページを付けると便利です）。',
      manualUrl: imageUrl,
    }
  }
  try {
    const creationId = await igCreateContainer(INSTAGRAM_GRAPH_HOST, igUserId, token, { image_url: imageUrl, media_type: 'STORIES' })
    const postUrl = await igPublishContainer(INSTAGRAM_GRAPH_HOST, igUserId, token, creationId)
    return { kind: 'published', url: postUrl, message: 'Instagramのストーリーに出しました' }
  } catch (error) {
    return { kind: 'error', message: `Instagram APIエラー（ストーリー）: ${error instanceof Error ? error.message : '不明'}` }
  }
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** コンテナの準備（status_code）が FINISHED になるまで待つ。ERROR なら理由つきで止める */
async function igWaitForContainer(host: string, token: string, creationId: string, tries = 20): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(
        `${host}/v21.0/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
      )
      const data = await res.json()
      const code = data.status_code as string | undefined
      if (code === 'FINISHED' || code === 'PUBLISHED') return
      if (code === 'ERROR' || code === 'EXPIRED') {
        throw new Error(`Instagramが画像・動画を取り込めませんでした（${data.status ?? code}）`)
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Instagramが画像・動画')) throw error
      // 状態の確認自体の失敗は、待ってもう一度見る
    }
    await sleep(2000)
  }
  // 待ちきれなくても公開を試す（公開側でもやり直す）
}

/** コンテナを公開し、投稿URL（permalink）を返す */
async function igPublishContainer(host: string, igUserId: string, token: string, creationId: string): Promise<string> {
  // Instagram側で画像の取り込みが終わる前に公開すると「Media ID is not available」になるため、
  // コンテナが FINISHED になるまで待ってから公開する（最大およそ40秒）
  await igWaitForContainer(host, token, creationId)

  let data: { id?: string; error?: { message?: string } } = {}
  let ok = false
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${host}/v21.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId, access_token: token }),
    })
    data = await res.json()
    ok = res.ok && Boolean(data.id)
    if (ok) break
    // まだ準備中と言われたときだけ、少し待ってやり直す
    if (!/not available|not ready/i.test(data.error?.message ?? '')) break
    await sleep(4000)
  }
  if (!ok || !data.id) throw new Error(data.error?.message ?? '公開に失敗')

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
  const { getInstagramToken, getInstagramUserId, INSTAGRAM_GRAPH_HOST } = await import('./instagram-token')
  const token = await getInstagramToken()
  const igUserId = await getInstagramUserId()
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
        // 1枚目（表紙）だけAI画像＋見出し。2枚目以降は読みやすいテンプレ（文字のスライド）
        const url = await uploadPostImage(
          i === 0 ? imageTextFor(content, 'instagram_carousel') : { title: slide.heading, subtitle: slide.body.slice(0, 40) },
          `marketing/ig-${ts}-s${i + 1}.jpg`,
          'instagram',
          i === 0 ? content.image?.photoUrl : undefined,
        )
        childIds.push(await igCreateContainer(INSTAGRAM_GRAPH_HOST, igUserId, token, { image_url: url, is_carousel_item: true }))
      }
      creationId = await igCreateContainer(INSTAGRAM_GRAPH_HOST, igUserId, token, {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption,
      })
    } else {
      // フィード単枚（カルーセル指定でもスライドが足りなければ1枚投稿に落とす）
      const url = await uploadPostImage(imageTextFor(content, 'instagram_feed'), `marketing/ig-${Date.now()}.png`, 'instagram', content.image?.photoUrl)
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
        reason: `投稿画像の公開に失敗しました（${message}）。投稿画像をダウンロードして手動投稿してください。`,
        manualUrl,
      }
    }
    return { kind: 'error', message: `Instagram APIエラー: ${message}` }
  }
}

/**
 * Google Business Profile（投稿 = localPosts）。
 * APIは利用申請の承認制（2026-10-26 承認済み）。接続すると自動投稿になる（未接続の間は手動投稿モード）:
 *   GBP_CLIENT_ID / GBP_CLIENT_SECRET … Google CloudのOAuthクライアント（Vercelの環境変数）
 *   リフレッシュトークンと投稿先の店舗 … 「投稿の予定と結果」の画面の「Googleとつなぐ」で保存（gbp-token.ts）。
 *                                     環境変数 GBP_REFRESH_TOKEN / GBP_LOCATION_NAME を設定した場合はそちらが優先
 */
async function publishGoogleBusiness(content: GeneratedContent, jobKey?: string): Promise<PublishOutcome> {
  const manualUrl = 'https://business.google.com/'
  const credentials = await getGbpCredentials()
  if (!credentials) {
    return {
      kind: 'action_required',
      reason: 'Googleとの接続がまだのため手動投稿です。本文をコピーして管理画面から手動投稿し、完了チェックを付けてください。',
      manualUrl,
    }
  }
  const { clientId, clientSecret, refreshToken, location } = credentials

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string; error?: string }
    if (!tokenRes.ok || !tokenData.access_token) {
      // 権限の取り消し・期限切れはリトライしても直らないため手動投稿へ
      return {
        kind: 'action_required',
        reason: `Googleの接続が切れています（${tokenData.error_description ?? tokenData.error ?? tokenRes.status}）。今回は手動で投稿し、接続をやり直してください。`,
        manualUrl,
      }
    }

    // 投稿画像（4:3。AI画像があれば写真＋見出し、無ければテンプレート）。画像が作れなくても文章だけで投稿する
    let media: Array<{ mediaFormat: 'PHOTO'; sourceUrl: string }> | undefined
    try {
      const url = content.seoPostId
        ? await uploadSeoImage(content.seoPostId)
        : await uploadPostImage(imageTextFor(content, 'google_business'), `marketing/gbp-${Date.now()}.png`, 'google', content.image?.photoUrl)
      media = [{ mediaFormat: 'PHOTO', sourceUrl: url }]
    } catch {
      media = undefined
    }

    // Google に拒否されないための決まり（gbp-post-rules.ts）:
    // 本文から URL・電話番号を取る／ボタンのリンクは院のホームページか公式LINEだけ（ほかは院のホームページのページに置きかえる）。
    // Google検索向けの投稿は、いまの決まった文で出す（予約したときの古い文に URL が入っていても出さない）
    const seoPost = content.seoPostId ? getGbpSeoPost(content.seoPostId) : undefined
    const cleaned = googleSummary(seoPost ? gbpSeoText(seoPost) : content.body)
    const summary = cleaned.text.length > 1500 ? `${cleaned.text.slice(0, 1499)}…` : cleaned.text
    const ctaUrl = googleButtonUrl({ ctaUrl: content.cta?.url, seoPostId: content.seoPostId, jobKey })
    const res = await fetch(`https://mybusiness.googleapis.com/v4/${location}/localPosts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenData.access_token}` },
      body: JSON.stringify({
        languageCode: 'ja',
        topicType: 'STANDARD',
        summary,
        ...(ctaUrl ? { callToAction: { actionType: 'BOOK', url: ctaUrl } } : {}),
        ...(media ? { media } : {}),
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { searchUrl?: string; name?: string; state?: string; error?: { message?: string } }
    if (!res.ok) return { kind: 'error', message: `Google投稿APIエラー: ${data.error?.message ?? `HTTP ${res.status}`}` }
    // Google が受け取っただけで、公開されたとは限らない（審査で拒否されることがある）。結果は checkGooglePosts が後で確かめる
    const fixed = [cleaned.urls > 0 ? 'URL' : '', cleaned.phones > 0 ? '電話番号' : ''].filter(Boolean).join('・')
    return {
      kind: 'published',
      url: data.searchUrl,
      message: `Googleへ投稿を送りました（Googleの審査の結果は、このあと確かめます）${fixed ? `。本文の${fixed}は取りました` : ''}`,
      google: { name: data.name, state: googlePostState(data.state), postedAt: new Date().toISOString() },
    }
  } catch (error) {
    return { kind: 'error', message: `Google投稿APIエラー: ${error instanceof Error ? error.message : '不明'}` }
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
