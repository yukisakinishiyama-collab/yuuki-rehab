/**
 * 院内アプリのメニュー（予約管理・カルテ・経営・集客）
 *
 * PCは左のメニュー、スマホは下のタブ（今日・予約・カルテ・集客）と、
 * 経営・集客の中の切り替え（上の横並びのボタン）で使う。
 *
 * 「経営」（売上などの数字）は患者さんの目に入らないよう、ふだんは出さない（secret）。
 * 隠しコマンドで開いたときだけ表示する（src/lib/clinic/keiei-mode.ts）。
 *
 * 集客は4つのタブ（集客概要・問い合わせ・コンテンツ・自動化設定。2026-11 の指示書6章）。
 * 今までの集客の画面は URL を変えずに、各タブの下（pages）に入れた。開いているときはそのタブが光り、
 * 上の見出しにはその画面の名前が出る。
 */
import {
  CalendarCheck,
  CalendarClock,
  ChartColumn,
  ChartLine,
  ClipboardList,
  Gauge,
  House,
  Inbox,
  Megaphone,
  Mountain,
  PenLine,
  RefreshCcw,
  Settings,
  Sparkles,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

/** タブの下に入れた画面（切り替えのボタンには出さない） */
export interface NavPage {
  href: string
  label: string
}

export interface NavLink {
  href: string
  label: string
  icon: LucideIcon
  /** このタブの下に入れた画面 */
  pages?: NavPage[]
}

export interface NavSection {
  key: 'today' | 'yoyaku' | 'karte' | 'keiei' | 'shukyaku' | 'settings'
  label: string
  /** タブを押したときに開く画面 */
  href: string
  icon: LucideIcon
  /** 一言の説明（PCのメニューの見出しの下） */
  hint: string
  /** この項目の中の画面（経営・集客） */
  children?: NavLink[]
  /** 下のタブに出すか（スマホ） */
  tab: boolean
  /** ふだんは隠す（隠しコマンドで開いたときだけ出す） */
  secret?: boolean
}

export const NAV: NavSection[] = [
  { key: 'today', label: '今日', href: '/dashboard', icon: House, hint: '今日の予約とお知らせ', tab: true },
  { key: 'yoyaku', label: '予約', href: '/yoyaku', icon: CalendarClock, hint: '予約表・空き・受付', tab: true },
  { key: 'karte', label: 'カルテ', href: '/patients', icon: ClipboardList, hint: '患者さんの記録', tab: true },
  {
    key: 'keiei',
    label: '経営',
    href: '/marketing/sales',
    icon: ChartColumn,
    hint: '売上・来院・目標・PDCA・相談',
    tab: true,
    secret: true,
    children: [
      { href: '/marketing/sales', label: '売上・来院', icon: ChartColumn },
      { href: '/marketing/sales/monthly', label: '月次レポート', icon: CalendarCheck },
      { href: '/marketing/sales/patients', label: '患者さんの動き', icon: Users },
      { href: '/marketing/sales/goal', label: '月の目標への道すじ', icon: Mountain },
      { href: '/marketing/sales/profit', label: '経費・利益', icon: Wallet },
      { href: '/marketing/sales/pdca', label: 'PDCA（施策）', icon: RefreshCcw },
      { href: '/marketing/sales/chat', label: '経営相談（AI）', icon: Sparkles },
      { href: '/marketing/analytics', label: '集客の効果', icon: ChartLine },
    ],
  },
  {
    key: 'shukyaku',
    label: '集客',
    href: '/marketing',
    icon: Megaphone,
    hint: '概要・問い合わせ・コンテンツ・自動化',
    tab: true,
    children: [
      { href: '/marketing', label: '集客概要', icon: Gauge },
      {
        href: '/marketing/inquiries',
        label: '問い合わせ',
        icon: Inbox,
        pages: [{ href: '/marketing/line', label: 'LINE導線（会話）' }],
      },
      {
        href: '/marketing/content',
        label: 'コンテンツ',
        icon: PenLine,
        pages: [
          { href: '/marketing/autopilot', label: '自動投稿' },
          { href: '/marketing/compose', label: '投稿を作る' },
          { href: '/marketing/calendar', label: '投稿カレンダー' },
          { href: '/marketing/jobs', label: '投稿の予定と結果' },
          { href: '/marketing/tools', label: 'リンク・QR・ストーリー' },
          { href: '/marketing/reviews', label: '口コミ返信' },
          { href: '/marketing/videos', label: '動画ストック' },
          { href: '/marketing/references', label: '論文・根拠' },
        ],
      },
      {
        href: '/marketing/automation',
        label: '自動化設定',
        icon: Workflow,
        pages: [{ href: '/marketing/line/richmenu', label: 'LINEのメニュー' }],
      },
    ],
  },
  { key: 'settings', label: '設定', href: '/marketing/settings', icon: Settings, hint: '院の情報・連携', tab: false },
]

/** いま表示してよい項目（隠しモードが閉じていれば secret を除く） */
export function visibleNav(keieiOpen: boolean): NavSection[] {
  return NAV.filter((s) => !s.secret || keieiOpen)
}

/**
 * いまの画面がどの項目か（いちばん長く一致する入口で決める）
 * page … タブの下に入れた画面を開いているとき、その画面（見出しの名前に使う。link はそのタブ）
 */
export function activeSection(pathname: string): { section: NavSection | null; link: NavLink | null; page: NavPage | null } {
  let best: { section: NavSection; link: NavLink | null; page: NavPage | null; length: number } | null = null
  const consider = (section: NavSection, href: string, link: NavLink | null, page: NavPage | null) => {
    const hit = pathname === href || pathname.startsWith(`${href}/`)
    // 同じ長さなら中の画面（子）を優先する（例: /marketing/sales は「経営」の中の「売上・来院」）
    if (hit && (!best || href.length > best.length || (link && href.length === best.length))) {
      best = { section, link, page, length: href.length }
    }
  }
  for (const section of NAV) {
    consider(section, section.href, null, null)
    for (const child of section.children ?? []) {
      consider(section, child.href, child, null)
      for (const page of child.pages ?? []) consider(section, page.href, child, page)
    }
  }
  const found = best as { section: NavSection; link: NavLink | null; page: NavPage | null; length: number } | null
  return { section: found?.section ?? null, link: found?.link ?? null, page: found?.page ?? null }
}
