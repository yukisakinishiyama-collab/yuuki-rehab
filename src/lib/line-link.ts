/**
 * カルテ ↔ 公式LINE の結びつけ（共通の型と、患者さんを見分けるキー）
 *
 * 患者さんは「電話番号＋氏名（空白なし）」で見分ける。予約システム（GAS）の
 * patientKeyOf と同じ作りなので、予約・カルテ・LINEで同じ人を同じキーで指せる。
 * 同じ電話番号のご家族（親のLINEで子どものカルテ、など）はキーが別になる。
 *
 * LINEの userId は生で保存しない。署名付きの封印（sealed、lib/liff-ticket.ts）だけを
 * サーバー側（KV）に持ち、送信のときにサーバーの中でだけ開く。
 */

/** サーバーに保存する1件（KV の linelink:<key>） */
export interface LineLink {
  /** 電話番号の数字＋'|'＋氏名（空白なし） */
  key: string
  name: string
  phone: string
  /** 署名付きの封印済み userId（生の userId ではない） */
  sealed: string
  /** 結びつけた日時（ISO） */
  linkedAt: string
  /** どこで結びついたか */
  via: 'liff-link' | 'reservation'
  /** 生年月日（'YYYY-MM-DD'。誕生日のご挨拶に使う。患者さんが連携のときに入れたもの） */
  birthDate?: string
  /** 予約システム（患者マスタ）の患者番号。ネット予約の「患者番号をお持ちの方」で使える */
  patientNo?: string
  /** 番号を発行できなかった理由（同じ電話番号で別の方が登録済み、など） */
  patientNoError?: string
  /** まちがった番号（「院側手動登録」という文字）をお知らせ済みで、おわびと正しい番号をまだ送れていない */
  wrongNoNotified?: boolean
  /** 結びつけたときの「番号のお知らせ」をLINEへ送れたか */
  notified?: boolean
  /** 送れなかったときの理由（LINEの返事。原因を調べるため） */
  notifyError?: string
}

/** 画面に出す分（封印済みの参照は出さない） */
export type LineLinkSummary = Omit<LineLink, 'sealed'> & {
  /** 控えの患者番号が数字でない（予約システムからもらい直す必要がある） */
  patientNoInvalid?: boolean
}

/**
 * 患者番号として使える値か（数字1〜6けた）。
 * 予約システムの古い行には、番号の欄に「院側手動登録」という文字が入っていて、それがそのまま届いたことがある（2026-11）
 */
export const isPatientNo = (value: unknown): value is string => typeof value === 'string' && /^[0-9]{1,6}$/.test(value.trim())

/** 番号の使い方（お知らせの文で、番号のすぐ下に書く） */
const PATIENT_NO_HELP = 'ネット予約の「患者番号をお持ちの方」に、この番号と、院にご登録の電話番号の下4桁の2つを入れると、お名前などが自動で入ります。'

/**
 * 連携のお知らせ（番号つき）の文。
 * corrected … 前にまちがった番号（「院側手動登録」という文字）をお知らせしていた方へ、おわびと正しい番号を送る文（文面は、送る前に院長が確かめる）
 * fallback は番号を出せなかったときの文、sign は院の名前、phone は院の電話番号
 */
export function linkNoticeText(opts: { name: string; patientNo?: string; fallback: string; sign: string; phone?: string; corrected?: boolean }): string {
  if (opts.corrected && isPatientNo(opts.patientNo)) {
    const contact = opts.phone ? `このLINEか、お電話（${opts.phone}）` : 'このLINE'
    return [
      `${opts.name}様`,
      '',
      `${opts.sign}です。`,
      '以前お送りした「LINE連携のお知らせ」で、患者番号を誤ってお伝えしておりました。',
      '当院の予約システムの不具合によるものです。ご迷惑をおかけし、誠に申し訳ございません。',
      '',
      '正しい患者番号は、次のとおりです。',
      '',
      `患者番号：${opts.patientNo.trim()}`,
      PATIENT_NO_HELP,
      '',
      '同じことが起きないよう、仕組みを直しました。',
      `ご不明な点がありましたら、${contact}でお知らせください。`,
      '',
      opts.sign,
    ].join('\n')
  }
  const numberLine = isPatientNo(opts.patientNo) ? `\n\n患者番号：${opts.patientNo.trim()}\n${PATIENT_NO_HELP}` : `\n\n${opts.fallback}`
  return `${opts.name}さんのカルテとこのLINEの連携が済みました。\n誕生日のご挨拶など、院からのお知らせをこのLINEへお送りします。${numberLine}\n\n${opts.sign}`
}

export const phoneDigits = (value: string): string => String(value || '').replace(/[^0-9]/g, '')
export const nameNoSpace = (value: string): string => String(value || '').replace(/[\s　]/g, '')

/** 患者さんのキー。電話番号が10桁未満、または氏名が空なら ''（結びつけられない） */
export function patientLinkKey(name: string, phone: string): string {
  const digits = phoneDigits(phone)
  const compact = nameNoSpace(name)
  if (digits.length < 10 || !compact) return ''
  return `${digits}|${compact}`
}
