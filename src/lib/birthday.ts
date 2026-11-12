// ──────────────────────────────────────────────
// 誕生日が近いかどうか（患者一覧のマーク用）
// 日付は日本時間で数える。うるう日（2/29）生まれは、うるう年でない年は 2/28 とみなす
// ──────────────────────────────────────────────

/** 「誕生日が近い」とみなす日数（今日を含めて何日先まで） */
export const BIRTHDAY_SOON_DAYS = 14

function jstToday(now: Date): { y: number; m: number; d: number } {
  const t = new Date(now.getTime() + 9 * 3_600_000)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/** 次の誕生日まで何日か（今日が誕生日なら 0）。生年月日が読めなければ null */
export function daysUntilBirthday(birthDate: string | undefined, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate ?? '')
  if (!m) return null
  const bm = Number(m[2])
  const bd = Number(m[3])
  if (bm < 1 || bm > 12 || bd < 1 || bd > 31) return null
  const today = jstToday(now)
  const todayUtc = Date.UTC(today.y, today.m - 1, today.d)
  for (const y of [today.y, today.y + 1]) {
    const day = bm === 2 && bd === 29 && !isLeap(y) ? 28 : bd
    const next = Date.UTC(y, bm - 1, day)
    if (next >= todayUtc) return Math.round((next - todayUtc) / 86_400_000)
  }
  return null
}

/** 誕生日が近いか（今日〜BIRTHDAY_SOON_DAYS 日以内） */
export function isBirthdaySoon(birthDate: string | undefined, now: Date = new Date(), days = BIRTHDAY_SOON_DAYS): boolean {
  const n = daysUntilBirthday(birthDate, now)
  return n !== null && n <= days
}

/** 一覧に出す短い文（「今日が誕生日」「誕生日まで3日」） */
export function birthdayLabel(birthDate: string | undefined, now: Date = new Date()): string | null {
  const n = daysUntilBirthday(birthDate, now)
  if (n === null || n > BIRTHDAY_SOON_DAYS) return null
  return n === 0 ? '今日が誕生日' : `誕生日まで${n}日`
}
