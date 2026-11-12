/**
 * 公式LINEのリッチメニュー（Messaging API）
 *
 * LINE公式アカウントの管理画面で作れるメニューは最大6マス。7つ目（Instagramなど）を足すときは、
 * ここから API でメニューを登録し、「全員のデフォルト」にする。
 * API で入れたメニューは管理画面のメニューより優先される。「元に戻す」はデフォルトを外すだけで、
 * 管理画面のメニューがそのまま表示に戻る。
 *
 * 使うトークン: LINE_CHANNEL_ACCESS_TOKEN（配信・通知と同じ Messaging API チャネルのもの）
 */

export interface RichMenuArea {
  bounds: { x: number; y: number; width: number; height: number }
  action: { type: 'uri'; label?: string; uri: string } | { type: 'message'; label?: string; text: string }
}

export interface RichMenuSpec {
  name: string
  chatBarText: string
  areas: RichMenuArea[]
}

export const RICH_MENU_SIZE = { width: 2500, height: 1686 } as const

function token(): string {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!t) throw new Error('LINE_CHANNEL_ACCESS_TOKEN が未設定です（LINEチャネル未接続）')
  return t
}

async function lineFetch(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token()}`, ...(init.headers ?? {}) } })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string; details?: Array<{ message?: string; property?: string }> }
    const detail = data.details?.map((d) => `${d.property ?? ''} ${d.message ?? ''}`.trim()).join(' / ')
    throw new Error(`LINE API ${res.status}: ${data.message ?? ''}${detail ? `（${detail}）` : ''}`)
  }
  return res
}

export interface RichMenuListItem {
  richMenuId: string
  name: string
  chatBarText: string
  areas: RichMenuArea[]
}

/** API で登録してあるメニューの一覧（管理画面で作ったものは含まれない） */
export async function listRichMenus(): Promise<RichMenuListItem[]> {
  const res = await lineFetch('https://api.line.me/v2/bot/richmenu/list', { method: 'GET' })
  const data = (await res.json()) as { richmenus?: RichMenuListItem[] }
  return data.richmenus ?? []
}

/** いま全員に出しているメニューの ID（API のデフォルト。無ければ null） */
export async function getDefaultRichMenuId(): Promise<string | null> {
  const res = await fetch('https://api.line.me/v2/bot/user/all/richmenu', { headers: { Authorization: `Bearer ${token()}` } })
  if (res.status === 404) return null
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(`LINE API ${res.status}（デフォルトの取得）: ${data.message ?? ''}`)
  }
  const data = (await res.json()) as { richMenuId?: string }
  return data.richMenuId ?? null
}

/** メニューを作って画像を入れ、全員のデフォルトにする。古い API メニューは消す */
export async function publishRichMenu(spec: RichMenuSpec, image: Buffer, contentType: 'image/jpeg' | 'image/png'): Promise<string> {
  if (image.byteLength > 1_000_000) throw new Error('画像が1MBを超えています')
  const create = await lineFetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      size: RICH_MENU_SIZE,
      selected: true,
      name: spec.name,
      chatBarText: spec.chatBarText,
      areas: spec.areas,
    }),
  })
  const { richMenuId } = (await create.json()) as { richMenuId: string }
  await lineFetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: new Uint8Array(image),
  })
  await lineFetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: 'POST' })
  // 古い API メニューは消す（管理画面のメニューはこの一覧に無いので消えない）
  const old = (await listRichMenus()).filter((m) => m.richMenuId !== richMenuId)
  await Promise.all(old.map((m) => lineFetch(`https://api.line.me/v2/bot/richmenu/${m.richMenuId}`, { method: 'DELETE' }).catch(() => null)))
  return richMenuId
}

/** API のデフォルトを外し、管理画面のメニューに戻す（API メニューも消す） */
export async function resetRichMenu(): Promise<void> {
  await fetch('https://api.line.me/v2/bot/user/all/richmenu', { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
  const all = await listRichMenus()
  await Promise.all(all.map((m) => lineFetch(`https://api.line.me/v2/bot/richmenu/${m.richMenuId}`, { method: 'DELETE' }).catch(() => null)))
}
