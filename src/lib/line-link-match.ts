// ──────────────────────────────────────────────
// 予約の方（お名前・電話）の LINE 連携を探す決まり（純粋な関数。サーバーも画面もここを使う）
//
// 2026-11-25 院長「予約確定したさいに患者様にlineでの通知が入っていません」「LINE連携は昨日確実にしました」。
// それまで、探し方が2か所にあった：
//   - サーバー（確定・前日のお知らせを自動で送る）＝ 予約の電話＋お名前、カルテのお名前＋生年月日
//   - 画面（今日の「前日のお知らせが届かない方」「LINEで予約日時を送る」）＝ 電話だけ・お名前だけでもカルテを当て、カルテの ID でも見る
// 画面では「連携済み」なのに、自動のお知らせは届かない方がいた。探し方を1つにして、届かないときは理由を出す。
//
// 決まり（上から順に）：
//   1. 予約の電話＋お名前で結びついた LINE
//   2. カルテを決める … お名前が同じカルテのうち、電話も同じもの（2つ以上あっても、お名前も電話も同じなら同じ方）。
//      電話で決まらなければ、お名前が同じカルテが1つだけのとき、そのカルテ。
//      お名前が同じカルテが無い → no_karte ／ 2つ以上あって決められない → karte_ambiguous（送らない）
//   3. 決めたカルテの LINE … a. カルテの画面のQRコードで結びついた LINE（カルテの ID）
//                            b. カルテの電話＋お名前で結びついた LINE
//                            c. お名前＋生年月日が同じ LINE
//      どれも無い → karte_not_linked
// 電話は、数字だけにして比べる（全角・ハイフン・+81・先頭の 0 の有無はちがいにしない）。お名前は、空白を取り全角・半角をそろえる。
// 電話だけが同じ（お名前がちがう）カルテは使わない：同じ電話のご家族（親の電話で兄弟のカルテ）の LINE に、
// ちがう方の予約を「◯◯ 様」と送ってしまうため。そのときは nearMissFor が「近いカルテ」を返すので、画面で院長に知らせる。
// ──────────────────────────────────────────────

/** カルテ（比べるのに使う分だけ） */
export interface MatchKarte {
  id?: string
  name?: string
  phone?: string
  birthDate?: string
}

/** LINE 連携（比べるのに使う分だけ。宛先は見ない） */
export interface MatchLink {
  key: string
  name: string
  phone?: string
  patientId?: string
  birthDate?: string
  linkedAt?: string
}

/** 見つけた道すじ */
export type LinkMatchHow = 'direct' | 'karte_id' | 'karte_phone' | 'birth'
/** 見つからなかった理由 */
export type LinkMatchMiss = 'no_name' | 'no_karte' | 'karte_ambiguous' | 'karte_not_linked'

export type LinkMatch<L extends MatchLink = MatchLink> =
  | { linked: true; link: L; how: LinkMatchHow }
  | { linked: false; why: LinkMatchMiss }

/** 見つからなかった理由（院長・記録むけの短い言葉。お名前などは入れない） */
export const LINK_MISS_TEXT: Record<LinkMatchMiss, string> = {
  no_name: 'お名前が読めません',
  no_karte: '予約のお名前と同じお名前のカルテがありません',
  karte_ambiguous: '同じお名前のカルテが2つ以上あり、電話番号でも1人に決められません',
  karte_not_linked: 'このお名前のカルテは、LINEと結びついていません',
}

/** お名前の比べ方（全角・半角をそろえ、空白を取る） */
export const matchName = (value: unknown): string => String(value ?? '').normalize('NFKC').replace(/\s+/g, '')

/**
 * 電話の比べ方。数字だけにして、国番号（+81）と先頭の 0 を取る（表計算で 0 が落ちた番号も同じ番号として比べる）。
 * 短すぎる番号（市外局番なし など）は ''（比べない）
 */
export function matchPhone(value: unknown): string {
  let digits = String(value ?? '').normalize('NFKC').replace(/[^0-9]/g, '')
  if (digits.length >= 11 && digits.startsWith('81')) digits = digits.slice(2)
  digits = digits.replace(/^0+/, '')
  return digits.length >= 9 ? digits : ''
}

const linkPhone = (link: MatchLink): string => matchPhone(link.phone || link.key.split('|')[0])

/** いちばん新しく結びついたもの */
function newest<L extends MatchLink>(list: L[]): L {
  return [...list].sort((a, b) => String(b.linkedAt ?? '').localeCompare(String(a.linkedAt ?? '')))[0]
}

/** 決めたカルテ（同じ方のカルテ。ふつうは1つ）に結びついた LINE。無ければ null */
function linkForKartes<L extends MatchLink>(kartes: MatchKarte[], links: L[]): { link: L; how: Exclude<LinkMatchHow, 'direct'> } | null {
  const ids = kartes.map((k) => String(k.id ?? '')).filter(Boolean)
  const byId = links.filter((l) => l.patientId && ids.includes(l.patientId))
  if (byId.length > 0) return { link: newest(byId), how: 'karte_id' }
  const byPhone = links.filter((l) => kartes.some((k) => matchPhone(k.phone) && matchPhone(k.phone) === linkPhone(l) && matchName(k.name) === matchName(l.name)))
  if (byPhone.length > 0) return { link: newest(byPhone), how: 'karte_phone' }
  const byBirth = links.filter((l) => l.birthDate && kartes.some((k) => k.birthDate === l.birthDate && matchName(k.name) === matchName(l.name)))
  if (byBirth.length > 0) return { link: newest(byBirth), how: 'birth' }
  return null
}

/** このカルテに結びついた LINE（カルテの画面・一覧の「LINE連携済み」と同じ見分け方）。無ければ null */
export function matchLinkForKarte<L extends MatchLink>(karte: MatchKarte, links: L[]): L | null {
  return linkForKartes([karte], links)?.link ?? null
}

/** 予約の方の LINE 連携を探す（決まりはこのファイルのいちばん上） */
export function matchLinkForReservation<L extends MatchLink>(row: { name?: string; phone?: string }, kartes: MatchKarte[], links: L[]): LinkMatch<L> {
  const name = matchName(row.name)
  if (!name) return { linked: false, why: 'no_name' }
  const phone = matchPhone(row.phone)
  // 1. 予約の電話＋お名前
  if (phone) {
    const direct = links.filter((l) => matchName(l.name) === name && linkPhone(l) === phone)
    if (direct.length > 0) return { linked: true, link: newest(direct), how: 'direct' }
  }
  // 2. カルテを決める
  const same = kartes.filter((k) => matchName(k.name) === name)
  if (same.length === 0) return { linked: false, why: 'no_karte' }
  const byPhone = phone ? same.filter((k) => matchPhone(k.phone) === phone) : []
  const chosen = byPhone.length > 0 ? byPhone : same.length === 1 ? same : null
  if (!chosen) return { linked: false, why: 'karte_ambiguous' }
  // 3. 決めたカルテの LINE
  const hit = linkForKartes(chosen, links)
  return hit ? { linked: true, link: hit.link, how: hit.how } : { linked: false, why: 'karte_not_linked' }
}

/**
 * 予約からは LINE を決められないが、「近いカルテ」には LINE がある（＝院長は連携したつもりなのに、自動のお知らせは届かない）。
 * - ambiguous  … 同じお名前のカルテが2つ以上あって決められない。そのうち LINE と結びついたカルテ
 * - other_name … 予約の電話と同じ電話のカルテ（お名前がちがう）が LINE と結びついている（字のちがい、または同じ電話のご家族）
 * 画面で理由と直し方を出すために使う。自動では送らない
 */
export interface NearMiss<L extends MatchLink = MatchLink> {
  kind: 'ambiguous' | 'other_name'
  kartes: Array<{ id: string; name: string; link: L }>
}

export function nearMissFor<L extends MatchLink>(row: { name?: string; phone?: string }, kartes: MatchKarte[], links: L[]): NearMiss<L> | null {
  const m = matchLinkForReservation(row, kartes, links)
  if (m.linked) return null
  const name = matchName(row.name)
  const phone = matchPhone(row.phone)
  const withLink = (list: MatchKarte[]) =>
    list.flatMap((k) => {
      const link = matchLinkForKarte(k, links)
      return link ? [{ id: String(k.id ?? ''), name: String(k.name ?? ''), link }] : []
    })
  if (m.why === 'karte_ambiguous') {
    const hit = withLink(kartes.filter((k) => matchName(k.name) === name))
    return hit.length > 0 ? { kind: 'ambiguous', kartes: hit } : null
  }
  if (m.why === 'no_karte' && phone) {
    const hit = withLink(kartes.filter((k) => matchPhone(k.phone) === phone))
    return hit.length > 0 ? { kind: 'other_name', kartes: hit } : null
  }
  return null
}

/** 近いカルテがあるときの、院長むけの説明（今日の画面に出す） */
export function nearMissText(near: NearMiss): string {
  if (near.kind === 'ambiguous') {
    return '同じお名前のカルテが2つ以上あるため、自動のLINE（確定・前日のお知らせ）は届きません。カルテを1つにまとめるか、予約とカルテの電話番号をそろえると届きます。'
  }
  const names = near.kartes.map((k) => `${k.name} 様`).join('・')
  return `同じ電話番号のカルテ（${names}）はLINEと結びついていますが、予約のお名前とちがうため、自動のLINE（確定・前日のお知らせ）は届きません。同じ方なら、予約とカルテのお名前の字をそろえると届きます。`
}
