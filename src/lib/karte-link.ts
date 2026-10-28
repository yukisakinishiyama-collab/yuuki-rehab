// ──────────────────────────────────────────────
// 予約システム（氏名・電話番号）から、カルテの患者さんを探す
//
// 予約管理画面で氏名を押したときに使う。予約システムは氏名と電話番号しか持たないため、
// 「電話番号＋氏名」→「電話番号」→「氏名」の順に当てはめ、見つかった人を返す。
// 電話番号は数字だけにして比べる（ハイフン・国番号つきでも同じ人として扱う）。
// ──────────────────────────────────────────────

export interface KarteCandidate {
  id: string
  name: string
  phone?: string
}

/** 数字だけにする。国番号（+81）は 0 始まりに直す */
export function phoneDigits(value: string | undefined): string {
  let digits = String(value || '').replace(/[^0-9]/g, '')
  if (digits.length >= 11 && digits.startsWith('81')) digits = `0${digits.slice(2)}`
  return digits
}

/** 空白（全角も）を除いた氏名 */
export function nameKey(value: string | undefined): string {
  return String(value || '').replace(/[\s　]/g, '')
}

/** 同じ電話番号か（先頭の0の有無は無視する） */
function samePhone(a: string, b: string): boolean {
  if (!a || !b) return false
  const trim = (v: string) => v.replace(/^0+/, '')
  return a === b || trim(a) === trim(b)
}

/**
 * 当てはまる患者さんを返す（当てはまりの強い順に1通りだけ）。
 * 1人に決まらないときは候補をすべて返すので、呼ぶ側で一覧を見せる。
 */
export function matchKartePatients<T extends KarteCandidate>(
  patients: T[],
  name: string,
  phone?: string,
): T[] {
  const key = nameKey(name)
  const digits = phoneDigits(phone)
  if (!key && !digits) return []

  if (digits && key) {
    const both = patients.filter(p => samePhone(phoneDigits(p.phone), digits) && nameKey(p.name) === key)
    if (both.length > 0) return both
  }
  if (digits) {
    const byPhone = patients.filter(p => samePhone(phoneDigits(p.phone), digits))
    if (byPhone.length > 0) return byPhone
  }
  if (key) {
    const byName = patients.filter(p => nameKey(p.name) === key)
    if (byName.length > 0) return byName
  }
  return []
}
