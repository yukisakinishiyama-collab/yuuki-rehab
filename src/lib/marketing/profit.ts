/**
 * 経費・利益・損益分岐点の計算（純粋関数。画面とテストから使う）
 *
 * 経費は「毎月の固定費（家賃・人件費など）」＋「売上に比例する変動費（消耗品などの割合）」＋「その月だけの出費」。
 * 利益 ＝ 売上（NOAH＋NOAH以外） − 経費。税引き前。院長の報酬を固定費に入れるかは院長が決める。
 */

export interface CostItem {
  id: string
  label: string
  amount: number
}

export interface ExpenseSettings {
  /** 毎月の固定費 */
  fixed: CostItem[]
  /** 売上に対する変動費の割合（%） */
  variableRate: number
  /** その月だけの出費（月ごと） */
  oneOff: Record<string, CostItem[]>
  updatedAt?: string
}

export const DEFAULT_FIXED: CostItem[] = [
  { id: 'rent', label: '家賃', amount: 0 },
  { id: 'staff', label: '人件費（スタッフ）', amount: 0 },
  { id: 'owner', label: '院長の報酬', amount: 0 },
  { id: 'utility', label: '水道光熱費', amount: 0 },
  { id: 'comm', label: '通信・システム', amount: 0 },
  { id: 'lease', label: 'リース・機器', amount: 0 },
  { id: 'ads', label: '広告・販促', amount: 0 },
  { id: 'other', label: 'その他', amount: 0 },
]

export const EMPTY_SETTINGS: ExpenseSettings = { fixed: DEFAULT_FIXED, variableRate: 5, oneOff: {} }

export interface MonthProfitInput {
  month: string
  /** NOAH の売上（その月のここまで） */
  sales: number
  /** NOAH以外の収入 */
  outside: number
  /** 来院（延べ） */
  visits: number
  /** ここまでの診療日・月の残りの診療日（途中の月の見込み用。月末までの月は 0） */
  openDays: number
  remainingOpenDays: number
}

export interface MonthProfit {
  month: string
  revenue: number
  fixed: number
  variable: number
  oneOff: number
  expenses: number
  profit: number
  /** 利益率（売上に対して） */
  margin: number | null
  /** 損益分岐点の売上（固定費＋臨時 ÷ (1 − 変動費率)） */
  breakEven: number
  /** 分岐点に要る来院回数（来院1回あたりの金額で割る） */
  breakEvenVisits: number | null
  /** 分岐点まであといくら（マイナスなら超えている） */
  toBreakEven: number
  /** 途中の月：このペースの月末の見込み（売上・利益） */
  projected: { revenue: number; profit: number } | null
}

export function sum(items: CostItem[]): number {
  return items.reduce((s, i) => s + (Number.isFinite(i.amount) ? i.amount : 0), 0)
}

export function monthProfit(input: MonthProfitInput, settings: ExpenseSettings): MonthProfit {
  const revenue = input.sales + input.outside
  const fixed = sum(settings.fixed)
  const rate = Math.min(Math.max(settings.variableRate, 0), 95) / 100
  const oneOff = sum(settings.oneOff[input.month] ?? [])
  const variable = Math.round(revenue * rate)
  const expenses = fixed + variable + oneOff
  const profit = revenue - expenses
  const breakEven = Math.round((fixed + oneOff) / (1 - rate))
  const perVisit = input.visits > 0 ? input.sales / input.visits : 0
  let projected: MonthProfit['projected'] = null
  if (input.remainingOpenDays > 0 && input.openDays > 0) {
    const perDayRevenue = input.sales / input.openDays
    const pr = Math.round(input.sales + perDayRevenue * input.remainingOpenDays + input.outside)
    projected = { revenue: pr, profit: pr - (fixed + oneOff + Math.round(pr * rate)) }
  }
  return {
    month: input.month,
    revenue,
    fixed,
    variable,
    oneOff,
    expenses,
    profit,
    margin: revenue > 0 ? profit / revenue : null,
    breakEven,
    breakEvenVisits: perVisit > 0 ? Math.ceil((breakEven - input.outside) / perVisit) : null,
    toBreakEven: breakEven - revenue,
    projected,
  }
}

/** 目標の利益に要る売上（固定費＋臨時＋目標利益 ÷ (1 − 変動費率)） */
export function revenueForProfit(targetProfit: number, settings: ExpenseSettings, month: string): number {
  const rate = Math.min(Math.max(settings.variableRate, 0), 95) / 100
  return Math.round((sum(settings.fixed) + sum(settings.oneOff[month] ?? []) + targetProfit) / (1 - rate))
}
