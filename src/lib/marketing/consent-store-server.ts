/**
 * お知らせの受け取り（同意）の保存（サーバー専用）
 *
 * - 保存先は KV の `mkt:consent:<印>`。印は LINE の ID から作ったハッシュで、生の ID は持たない
 *   （秘密の設定を入れ替えても変わらないよう、決まった文字を足したハッシュにする）
 * - 記録が無い方は「受け取る」（consent.ts の consentAllows）
 * - 読めないときは「確かめられない」を返し、送る側は送らない（止めた方へ送ってしまうことを避ける）
 */
import { createHash } from 'node:crypto'
import { kvGet, kvList, kvSet } from './kv-store-server'
import { consentAllows, type ConsentCommand, type ConsentPurpose, type ConsentRecord } from './consent'

const PREFIX = 'mkt:consent:'

/** LINE の ID → 個人を特定しない印（同じ ID からはいつも同じ印） */
export function lineMark(userId: string): string {
  return createHash('sha256').update(`yuuki-rehab:line:${userId}`).digest('hex').slice(0, 32)
}

function keyOf(userId: string): string {
  return `${PREFIX}${lineMark(userId)}`
}

export async function getConsent(userId: string): Promise<ConsentRecord | null> {
  return kvGet<ConsentRecord>(keyOf(userId))
}

/** 本人の言葉（または院）で受け取りを変える */
export async function applyConsent(
  userId: string,
  command: ConsentCommand,
  source: ConsentRecord['source'] = 'line',
): Promise<ConsentRecord> {
  const current = await getConsent(userId).catch(() => null)
  const next: ConsentRecord = {
    reservation: current?.reservation ?? true,
    marketing: current?.marketing ?? true,
    [command.purpose]: command.allow,
    updatedAt: new Date().toISOString(),
    source,
  } as ConsentRecord
  await kvSet(keyOf(userId), next)
  return next
}

export type ConsentCheck = 'allowed' | 'opted_out' | 'unknown'

/** 送ってよいか（読めないときは unknown。送る側は送らない） */
export async function checkConsent(userId: string, purpose: ConsentPurpose): Promise<ConsentCheck> {
  try {
    const record = await getConsent(userId)
    return consentAllows(record, purpose) ? 'allowed' : 'opted_out'
  } catch (error) {
    console.error('同意の記録を読めませんでした:', error instanceof Error ? error.message : error)
    return 'unknown'
  }
}

/** 止めている方の数（自動化設定の画面用。数だけ） */
export async function consentCounts(): Promise<{ recorded: number; marketingOff: number; reservationOff: number }> {
  const rows = await kvList<ConsentRecord>(PREFIX)
  const records = rows.map((r) => r.value).filter((v): v is ConsentRecord => Boolean(v && typeof v === 'object'))
  return {
    recorded: records.length,
    marketingOff: records.filter((r) => r.marketing === false).length,
    reservationOff: records.filter((r) => r.reservation === false).length,
  }
}
