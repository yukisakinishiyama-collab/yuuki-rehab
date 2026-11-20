/**
 * カルテ ↔ 公式LINE の結びつけ（サーバー側の保存。KV の linelink:<key>）
 */
import { createHmac } from 'crypto'
import { kvDelete, kvGet, kvList, kvSet } from '@/lib/marketing/kv-store-server'
import { DEFAULT_CLINIC_PROFILE, RESERVE_URL } from '@/lib/marketing/clinic'
import { sealUserId, unsealUserId } from '@/lib/liff-ticket'
import { isPatientNo, patientLinkKey, type LineLink, type LineLinkSummary } from '@/lib/line-link'

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
    // 患者番号は数字のものだけを画面へ出す（古い控えには「院側手動登録」という文字が入っていることがある）
    .map(({ key, name, phone, linkedAt, via, patientId, birthDate, patientNo, patientNoError, notified, notifyError }) => ({
      key,
      name,
      phone,
      linkedAt,
      via,
      patientId,
      birthDate,
      patientNo: isPatientNo(patientNo) ? patientNo.trim() : undefined,
      patientNoError,
      patientNoInvalid: Boolean(patientNo) && !isPatientNo(patientNo) ? true : undefined,
      notified,
      notifyError,
    }))
    .sort((a, b) => (a.linkedAt < b.linkedAt ? 1 : -1))
}

/**
 * この LINE（ログインの証明から取り出した userId）が、いま結びついているカルテ（お名前と患者番号だけ）。
 * 患者さんの LINE の「カルテ連携」の画面で「結びついています」を出すため（2026-11-20）。ほかの方の情報は返さない
 */
export async function linksForLineUser(userId: string, secret: string): Promise<Array<{ name: string; patientNo?: string }>> {
  if (!userId) return []
  const rows = await kvList<LineLink>(PREFIX)
  return rows
    .map(({ value }) => value)
    .filter((v): v is LineLink => Boolean(v && v.key && v.sealed) && unsealUserId(v.sealed, secret) === userId)
    .sort((a, b) => (a.linkedAt < b.linkedAt ? -1 : 1))
    .map((v) => ({ name: v.name, patientNo: isPatientNo(v.patientNo) ? v.patientNo.trim() : undefined }))
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
    // 数字の番号だけを受け取る（予約システムの古い行の文字がそのまま届いたことがあるため）
    const patientNo = String(data.patientNo ?? '').trim()
    return isPatientNo(patientNo) ? { patientNo } : { error: 'bad_number' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'fetch_failed' }
  }
}

/**
 * 控えの患者番号が数字でないとき（空・「院側手動登録」など）は、予約システムからもらい直す。
 * wrong     … まちがった番号（文字）をお知らせ済みの方（おわびと正しい番号を送るまで、控えに印を残す）
 * corrected … その方に、いま数字の番号がある（＝おわびの文を送れる）
 * issued    … 前は番号が無かった方に、今回はじめて数字の番号をもらえた
 */
export async function refreshPatientNo(link: LineLink): Promise<{ link: LineLink; wrong: boolean; corrected: boolean; issued: boolean; refreshed: boolean }> {
  const wrong = link.wrongNoNotified === true || (Boolean(String(link.patientNo ?? '').trim()) && !isPatientNo(link.patientNo))
  if (isPatientNo(link.patientNo)) return { link, wrong, corrected: wrong, issued: false, refreshed: false }
  const r = await fetchPatientNo(link.name, link.phone)
  const next: LineLink = { ...link, patientNo: r.patientNo, patientNoError: r.patientNo ? undefined : r.error, wrongNoNotified: wrong ? true : undefined }
  return { link: next, wrong, corrected: wrong && Boolean(r.patientNo), issued: !wrong && Boolean(r.patientNo), refreshed: true }
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

export interface LinkLineUserInput {
  /** LINE の userId（LIFF のチケットから取り出した、本人がログインした証明つきのもの） */
  userId: string
  name: string
  /** 電話番号（数字。10〜11桁） */
  phone: string
  /** 生年月日（'YYYY-MM-DD'。無ければ ''） */
  birthDate: string
  via: LineLink['via']
  /** カルテの ID（カルテの画面のQRコードから結びつけるとき） */
  patientId?: string
}

export interface LinkLineUserResult {
  key: string
  name: string
  notified: boolean
  again: boolean
  patientNo: string | null
  patientNoMessage: string
}

/**
 * カルテと LINE を結びつける本体（患者さんが入れた名前・電話・生年月日でも、カルテの画面のQRコードでも同じ）。
 * - 生の userId は封印して保存（KV の linelink:<電話＋氏名>）
 * - 予約システムに患者番号をもらう（前にもらっていればそれを使う）
 * - 本人の LINE へ番号つきで1通（送れなくても結びつけは成功。送れなかった理由は控える）
 * 呼ぶ前に、名前・電話・生年月日を確かめておくこと（ここでは確かめない）
 */
export async function linkLineUser(input: LinkLineUserInput, secret: string): Promise<LinkLineUserResult> {
  const key = patientLinkKey(input.name, input.phone)
  if (!key) throw new Error('お名前と電話番号を確かめてください')
  const existing = await getLineLink(key)
  // 患者番号：前に発行できていればそれを使う。無ければ予約システムにもらう
  let patientNo = isPatientNo(existing?.patientNo) ? existing?.patientNo : undefined
  let patientNoError: string | undefined
  if (!patientNo) {
    const r = await fetchPatientNo(input.name, input.phone)
    patientNo = r.patientNo
    patientNoError = r.error
  }
  const link: LineLink = {
    key,
    name: input.name,
    phone: input.phone,
    sealed: sealUserId(input.userId, secret),
    linkedAt: new Date().toISOString(),
    via: input.via,
    patientId: input.patientId || existing?.patientId || undefined,
    birthDate: input.birthDate || existing?.birthDate || undefined,
    patientNo,
    patientNoError: patientNo ? undefined : patientNoError,
  }
  // 本人へ1通（送れなくても結びつけは成功あつかい）。送れなかった理由は控えておく
  let notified = false
  let notifyError = ''
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) notifyError = 'LINE_CHANNEL_ACCESS_TOKEN 未設定'
  if (token) {
    const numberLine = patientNo
      ? `\n\n患者番号：${patientNo}\nネット予約の「患者番号をお持ちの方」に、この番号と電話番号の下4桁を入れると、お名前などが自動で入ります。`
      : `\n\n${patientNoErrorText(patientNoError)}`
    const text = `${input.name}さんのカルテとこのLINEを${existing ? 'あらためて' : ''}結びつけました。\n誕生日のご挨拶など、院からのお知らせをこのLINEへお送りします。${numberLine}\n\n${DEFAULT_CLINIC_PROFILE.name}`
    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: input.userId, messages: [{ type: 'text', text }] }),
      })
      notified = res.ok
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        notifyError = `HTTP ${res.status} ${detail}`.slice(0, 300)
      }
    } catch (error) {
      notified = false
      notifyError = (error instanceof Error ? error.message : String(error)).slice(0, 300)
    }
  }
  await saveLineLink({ ...link, notified, notifyError: notified ? undefined : notifyError || undefined })
  return {
    key,
    name: input.name,
    notified,
    again: Boolean(existing),
    patientNo: patientNo ?? null,
    patientNoMessage: patientNo ? '' : patientNoErrorText(patientNoError),
  }
}

