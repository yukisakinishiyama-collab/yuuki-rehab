/**
 * カルテ ↔ 公式LINE の結びつけ（サーバー側の保存。KV の linelink:<key>）
 */
import { kvDelete, kvGet, kvList, kvSet } from '@/lib/marketing/kv-store-server'
import type { LineLink, LineLinkSummary } from '@/lib/line-link'

const PREFIX = 'linelink:'

export async function getLineLink(key: string): Promise<LineLink | null> {
  if (!key) return null
  return kvGet<LineLink>(`${PREFIX}${key}`)
}

export async function saveLineLink(link: LineLink): Promise<void> {
  await kvSet(`${PREFIX}${link.key}`, link)
}

export async function deleteLineLink(key: string): Promise<void> {
  if (!key) return
  await kvDelete(`${PREFIX}${key}`)
}

/** 結びついている患者さんの一覧（封印済みの参照は含めない） */
export async function listLineLinks(): Promise<LineLinkSummary[]> {
  const rows = await kvList<LineLink>(PREFIX)
  return rows
    .map(({ value }) => value)
    .filter((v): v is LineLink => Boolean(v && v.key))
    .map(({ key, name, phone, linkedAt, via }) => ({ key, name, phone, linkedAt, via }))
    .sort((a, b) => (a.linkedAt < b.linkedAt ? 1 : -1))
}
