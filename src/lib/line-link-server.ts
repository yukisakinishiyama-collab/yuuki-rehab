/**
 * カルテ ↔ 公式LINE の結びつけ（サーバー側の保存。KV の linelink:<key>）
 */
import { createHmac } from 'crypto'
import { kvDelete, kvGet, kvList, kvSet } from '@/lib/marketing/kv-store-server'
import { RESERVE_URL } from '@/lib/marketing/clinic'
import { patientLinkKey, type LineLink, type LineLinkSummary } from '@/lib/line-link'

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
    .map(({ key, name, phone, linkedAt, via, birthDate, patientNo, patientNoError, notified, notifyError }) => ({ key, name, phone, linkedAt, via, birthDate, patientNo, patientNoError, notified, notifyError }))
    .sort((a, b) => (a.linkedAt < b.linkedAt ? 1 : -1))
}

/**
 * 予約システム（GAS）の患者マスタから患者番号をもらう（無ければ発行してもらう）。
 * 署名は hubstats と同じ作り（RESERVATION_NOTIFY_SECRET）。失敗しても結びつけ自体は成功させる
 */
export async function fetchPatientNo(name: string, phone: string): Promise<{ patientNo?: string; error?: string }> {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret) return { error: 'not_configured' }
  const ts = String(Date.now())
  const sig = createHmac('sha256', secret).update(`patientno:${ts}`).digest('hex')
  try {
    const url = `${RESERVE_URL}?api=patientno&ts=${ts}&sig=${sig}&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`
    const res = await fetch(url, { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(25_000) })
    const data = (await res.json().catch(() => null)) as { ok?: boolean; patientNo?: string; error?: string } | null
    if (!data) return { error: 'bad_response' }
    if (!data.ok) return { error: data.error ?? 'unknown' }
    return { patientNo: String(data.patientNo ?? '') || undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'fetch_failed' }
  }
}

/** 番号を発行できなかった理由を、患者さん向けの短い言葉に */
export function patientNoErrorText(error: string | undefined): string {
  if (!error) return ''
  if (error === 'same_phone_other_name') return '同じ電話番号で別の方が登録されているため、番号は受付でお渡しします'
  if (error === 'not_configured') return '番号の発行は準備中です'
  return '番号は受付でお渡しします（いまは発行できませんでした）'
}

interface SyncPatient {
  name?: string
  phone?: string
  birthDate?: string
}

/** クラウドに控えたカルテ（/api/sync）から、同じ人（電話＋氏名）のカルテを探す。無ければ null */
export async function findKartePatient(key: string): Promise<SyncPatient | null> {
  try {
    const record = await kvGet<{ payload?: Record<string, string> }>('sync:clinic')
    const raw = record?.payload?.pt_patients
    if (!raw) return null
    const patients = JSON.parse(raw) as SyncPatient[]
    return patients.find((p) => patientLinkKey(p.name ?? '', p.phone ?? '') === key) ?? null
  } catch {
    return null
  }
}
