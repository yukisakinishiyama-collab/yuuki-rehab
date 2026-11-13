'use client'
/**
 * 会員プランのご案内（患者様にお見せする説明）
 *
 * カルテの「契約・同意書」タブから開く。画面いっぱいに出して、カルテの内容が見えないようにする
 * （タブレットを患者様に向けて、いっしょに読む）。何も保存しない（見るだけ）。
 *
 * 流れ：対象の方 → 今の状態と目標 → プランの内容 → 含まれるもの → 料金 → 都度払いとの比較（その方の回数で計算）
 *       → 会員の方の取り扱い → 契約前の確認 → 選び方とお申し込みの流れ（ここから契約書の署名へ進める）
 *
 * - 金額と計算は lib/contracts/member-guide.ts（契約書・料金案内のひな形と同じ金額）
 * - 効果を約束する言い方・不安をあおる言い方はしない。都度払いのほうが少ないときは、そのまま出す
 * - 会員プランは、1か月以上通院され、継続管理が合うと院が判断した方にだけご案内する（料金案内 4）
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Activity, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock, FileSignature, LineChart, Minus, Plus, X, Zap } from 'lucide-react'
import type { MemberPlan } from '@/types/contracts'
import { Button } from '@/components/ui/button'
import { cardSurface } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { MEMBER_PLANS, PAIR_PLAN } from '@/lib/contracts/member'
import {
  breakEvenVisits,
  compareGuide,
  MEMBER_MONTHLY,
  MEMBER_PART_FEE,
  MEMBER_PART_FEE_WITH_INSURANCE,
  PAYG_FEES,
  PHYSIO_OPTIONS,
  SPECIAL_PLANS,
  yen,
  type PhysioId,
} from '@/lib/contracts/member-guide'

const CLINIC_PHONE = '083-265-4545'

const PAGE_TITLES = [
  'ご案内の対象',
  '今の状態と目標',
  '会員プランとは',
  '含まれるもの',
  '料金',
  '都度払いとの比較',
  '会員の方の取り扱い',
  'ご契約前の確認',
  '選び方とお申し込み',
] as const

interface Props {
  patientName: string
  /** 会員プランの契約がまだ無い（最後のページから契約書へ進める） */
  canJoin: boolean
  onClose: () => void
  /** 最後のページの「契約書を開く」。比較のページで選んだ種別を渡す */
  onOpenContract: (plan: MemberPlan) => void
}

export default function MemberPlanGuide({ patientName, canJoin, onClose, onOpenContract }: Props) {
  const [page, setPage] = useState(0)
  const [plan, setPlan] = useState<MemberPlan>('一般会員')
  const [visits, setVisits] = useState(8)
  const [parts, setParts] = useState(1)
  const [physio, setPhysio] = useState<PhysioId>('none')
  const scroller = useRef<HTMLDivElement>(null)
  const last = PAGE_TITLES.length - 1

  const go = useCallback(
    (step: number) => {
      setPage((p) => Math.min(last, Math.max(0, p + step)))
      scroller.current?.scrollTo({ top: 0 })
    },
    [last],
  )

  // 左右の矢印でページ送り・Esc で閉じる。開いている間は、うしろのカルテの画面を動かさない
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = before
    }
  }, [go, onClose])

  const physioFee = PHYSIO_OPTIONS.find((p) => p.id === physio)?.fee ?? 0

  return (
    // m-0：置き場所の space-y-* が付ける余白（margin）で、画面の下があかないように
    <div
      className="no-print fixed inset-0 z-[60] m-0 flex flex-col bg-slate-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label="会員プランのご案内"
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2">
          <p className="text-sm font-bold text-slate-700">ゆうき整骨院　会員プランのご案内</p>
          <Button variant="ghost" size="sm" onClick={onClose} className="lg:h-10 lg:text-sm">
            <X className="h-4 w-4" aria-hidden />
            閉じる
          </Button>
        </div>
        <div className="h-1 bg-slate-200" aria-hidden>
          <div className="h-1 bg-teal-700 transition-all" style={{ width: `${((page + 1) / PAGE_TITLES.length) * 100}%` }} />
        </div>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          {page === 0 && <TargetPage patientName={patientName} />}
          {page === 1 && <GoalPage visits={visits} setVisits={setVisits} />}
          {page === 2 && <AboutPage />}
          {page === 3 && <IncludedPage />}
          {page === 4 && <PricePage visits={visits} />}
          {page === 5 && (
            <ComparePage
              plan={plan}
              setPlan={setPlan}
              visits={visits}
              setVisits={setVisits}
              parts={parts}
              setParts={setParts}
              physio={physio}
              setPhysio={setPhysio}
              physioFee={physioFee}
            />
          )}
          {page === 6 && <MemberPage />}
          {page === 7 && <TermsPage />}
          {page === 8 && <FlowPage canJoin={canJoin} plan={plan} onOpenContract={onOpenContract} onClose={onClose} />}
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Button variant="outline" size="lg" onClick={() => go(-1)} disabled={page === 0} className="px-4 sm:px-6">
            <ChevronLeft className="h-5 w-5" aria-hidden />
            前へ
          </Button>
          <p className="text-center text-sm font-bold text-slate-600" aria-live="polite">
            <span className="tabular-nums">
              {page + 1} / {PAGE_TITLES.length}
            </span>
            <span className="ml-2 max-sm:hidden">{PAGE_TITLES[page]}</span>
          </p>
          {page < last ? (
            <Button size="lg" onClick={() => go(1)} className="px-4 sm:px-6">
              次へ
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Button>
          ) : (
            <Button variant="outline" size="lg" onClick={onClose} className="px-4 sm:px-6">
              閉じる
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}

// ── 共通の部品 ─────────────────────────────────────────────

function Heading({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-bold tracking-widest text-teal-700">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black leading-snug text-slate-900 sm:text-3xl">{children}</h2>
    </div>
  )
}

function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4 text-base leading-relaxed text-slate-800', className)}>{children}</div>
}

function StepCard({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className={cn(cardSurface, 'p-5')}>
      <p className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-lg font-black text-white" aria-hidden>
        {n}
      </p>
      <h3 className="mt-3 text-lg font-bold leading-snug text-slate-900">{title}</h3>
      <p className="mt-1 text-base leading-relaxed text-slate-700">{children}</p>
    </div>
  )
}

/** 選ぶボタン（選んでいるものは塗りと「選択中」の読み上げ） */
function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-lg border px-4 text-base font-medium transition-colors',
        selected ? 'border-teal-700 bg-teal-700 font-bold text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  )
}

function Stepper({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (n: number) => void }) {
  return (
    <div>
      <p className="text-sm font-bold text-slate-700">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${label}を1つ減らす`}>
          <Minus className="h-5 w-5" aria-hidden />
        </Button>
        <p className="min-w-20 text-center text-2xl font-black text-slate-900 tabular-nums" aria-live="polite">
          {value}
          <span className="ml-1 text-base font-bold">{unit}</span>
        </p>
        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${label}を1つ増やす`}>
          <Plus className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

// ── 1. ご案内の対象 ─────────────────────────────────────────

function TargetPage({ patientName }: { patientName: string }) {
  return (
    <div>
      <div className="mb-6 rounded-2xl bg-teal-700 p-6 text-white sm:p-8">
        <p className="text-sm font-bold tracking-widest text-teal-100">ゆうき整骨院</p>
        <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">会員プランのご案内</h1>
        <p className="mt-2 text-lg font-medium">月額制リハビリ継続管理プラン</p>
        <p className="mt-4 text-base text-teal-50">
          <span className="break-keep wrap-anywhere font-bold">{patientName}</span> 様へ　｜　料金はすべて税込です
        </p>
      </div>
      <Heading eyebrow="ご案内の対象">会員プランは、こんな方にご案内しています</Heading>
      <div className="grid gap-4 sm:grid-cols-3">
        <StepCard n={1} title="1か月以上、続けて通院されている">
          まずは都度払いで、評価・施術・リハビリと経過を確認します。
        </StepCard>
        <StepCard n={2} title="継続的なリハビリ管理が合うと当院が判断した">
          症状・身体の状態・通院頻度・予約状況をふまえて判断します。
        </StepCard>
        <StepCard n={3} title="内容と条件にご自身が納得された">
          料金・最低利用期間・解約条件をご説明したうえでご案内します。
        </StepCard>
      </div>
      <Note className="mt-5">初回のご来院からご契約いただくプランではありません。ご希望だけでのご契約もお受けしていません。</Note>
    </div>
  )
}

// ── 2. 今の状態と目標 ───────────────────────────────────────

function GoalPage({ visits, setVisits }: { visits: number; setVisits: (n: number) => void }) {
  return (
    <div>
      <Heading eyebrow="はじめに">まず、今の状態と目標を一緒に確認します</Heading>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={cn(cardSurface, 'p-5')}>
          <h3 className="text-lg font-bold text-slate-900">いまの状態</h3>
          <p className="mt-1 text-base text-slate-700">評価でわかったことを、担当者からお伝えします。</p>
        </div>
        <div className={cn(cardSurface, 'p-5')}>
          <h3 className="text-lg font-bold text-slate-900">めざすゴール</h3>
          <p className="mt-1 text-base text-slate-700">競技復帰・日常の動作・再発予防など、ご希望をお聞かせください。</p>
        </div>
        <div className={cn(cardSurface, 'p-5')}>
          <h3 className="text-lg font-bold text-slate-900">通院の目安</h3>
          <p className="mt-1 text-base text-slate-700">いまの状態から考える、通院のペースです。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[1, 2, 3].map((w) => (
              <Choice key={w} selected={visits === w * 4} onClick={() => setVisits(w * 4)}>
                週{w}回
              </Choice>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-600">あとの「費用の目安」に使います（月{visits}回）。</p>
        </div>
      </div>
      <Note className="mt-5">プランが合うかどうかは、この3つをもとに、お一人ずつ一緒に考えます。</Note>
    </div>
  )
}

// ── 3. 会員プランとは ───────────────────────────────────────

function AboutPage() {
  const steps = [
    { title: '評価', text: '身体の状態と動きを確認します' },
    { title: '施術計画', text: '目標と通院の頻度を決めます' },
    { title: 'リハビリ', text: '運動療法・物理療法などを行います' },
    { title: '再評価', text: '計画と頻度を見直します' },
  ]
  return (
    <div>
      <Heading eyebrow="会員プランとは">評価と見直しを続ける、月額制の継続管理プランです</Heading>
      <ol className="grid gap-3 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className={cn(cardSurface, 'p-4')}>
            <p className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-lg font-black text-white" aria-hidden>
              {i + 1}
            </p>
            <h3 className="mt-2 text-lg font-bold text-slate-900">{s.title}</h3>
            <p className="mt-1 text-base text-slate-700">{s.text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-base text-slate-700">再評価の結果をもとに、次の計画へ進みます。この流れを続けていくプランです。</p>
      <Note className="mt-5">
        <p className="font-bold">単なる割引や、通い放題のプランではありません。</p>
        <p>機能改善・再発予防・競技復帰や日常生活動作の改善を目的とした、自費のプランです。</p>
      </Note>
    </div>
  )
}

// ── 4. 含まれるもの ─────────────────────────────────────────

function IncludedPage() {
  const items = [
    { icon: Activity, title: 'リハビリセッション', text: '運動療法と機能評価を含みます。' },
    { icon: LineChart, title: '継続管理と定期的な再評価', text: '施術計画にもとづいて進めます。' },
    { icon: Zap, title: '状態に応じた物理療法', text: '体外衝撃波・5D・コンビネーション治療・微弱電流エレサス など' },
    { icon: CheckCircle2, title: 'その他の自費施術', text: '当院が必要と判断するものが対象です。' },
  ]
  return (
    <div>
      <Heading eyebrow="含まれる内容">月額料金に含まれるもの</Heading>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className={cn(cardSurface, 'flex items-start gap-4 p-5')}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50">
              <Icon className="h-6 w-6 text-teal-700" aria-hidden />
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{title}</h3>
              <p className="mt-1 text-base leading-relaxed text-slate-700">{text}</p>
            </div>
          </li>
        ))}
      </ul>
      <Note className="mt-5">
        <p>施術内容・通院頻度・物理療法の使用は、症状・評価結果・安全性・必要性をふまえて当院が判断します。</p>
        <p>
          来院ごとの1部位施術料（{yen(MEMBER_PART_FEE)}。健康保険の施術を併用する日は{yen(MEMBER_PART_FEE_WITH_INSURANCE)}＋保険の窓口料金）は、月額とは別にかかります。
        </p>
      </Note>
    </div>
  )
}

// ── 5. 料金 ─────────────────────────────────────────────────

function PricePage({ visits }: { visits: number }) {
  const example = MEMBER_MONTHLY['一般会員'] + MEMBER_PART_FEE * visits
  return (
    <div>
      <Heading eyebrow="料金（税込）">月額料金と、来院ごとの1部位施術料</Heading>
      <div className="grid gap-4 sm:grid-cols-3">
        {MEMBER_PLANS.map((p) => (
          <div key={p} className={cn(cardSurface, 'p-5')}>
            <h3 className="text-base font-bold text-teal-800">
              {p}
              {p === PAIR_PLAN && <span className="ml-1 text-sm font-medium text-slate-600">（2名まで）</span>}
            </h3>
            <p className="mt-2 text-4xl font-black text-slate-900 tabular-nums">
              {MEMBER_MONTHLY[p].toLocaleString('ja-JP')}
              <span className="ml-1 text-base font-bold">円／月</span>
            </p>
          </div>
        ))}
      </div>
      <div className={cn(cardSurface, 'mt-4 p-5')}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 className="text-base font-bold text-teal-800">＋ 来院ごとの1部位施術料</h3>
          <p className="text-4xl font-black text-slate-900 tabular-nums">
            {MEMBER_PART_FEE.toLocaleString('ja-JP')}
            <span className="ml-1 text-base font-bold">円／回</span>
          </p>
        </div>
        <ul className="mt-3 space-y-1 text-base leading-relaxed text-slate-700">
          <li>・月額とは別に、来院した方ごと・施術した部位ごとにかかります。</li>
          <li>
            ・健康保険の施術を併用する日は、<b className="text-slate-900">{yen(MEMBER_PART_FEE_WITH_INSURANCE)}＋保険の窓口料金</b>です。
          </li>
        </ul>
      </div>
      <div className="mt-4 rounded-xl bg-teal-700 p-5 text-white">
        <p className="text-sm font-bold text-teal-100">例）一般会員・月{visits}回・1部位・保険併用なしの場合</p>
        <p className="mt-1 text-xl font-black leading-snug tabular-nums sm:text-2xl">
          {yen(MEMBER_MONTHLY['一般会員'])} ＋ {yen(MEMBER_PART_FEE)} × {visits}回 ＝ 月{yen(example)}
        </p>
      </div>
      <p className="mt-4 text-base text-slate-700">
        通院回数が少ない月も、月額は変わりません（日割り・増減はありません）。お支払いはクレジットカードのみです。
      </p>
    </div>
  )
}

// ── 6. 都度払いとの比較 ─────────────────────────────────────

function ComparePage({
  plan,
  setPlan,
  visits,
  setVisits,
  parts,
  setParts,
  physio,
  setPhysio,
  physioFee,
}: {
  plan: MemberPlan
  setPlan: (p: MemberPlan) => void
  visits: number
  setVisits: (n: number) => void
  parts: number
  setParts: (n: number) => void
  physio: PhysioId
  setPhysio: (p: PhysioId) => void
  physioFee: number
}) {
  const result = compareGuide({ plan, visits, parts, physioFee })
  const even = breakEvenVisits(plan, parts, physioFee)
  const pair = plan === PAIR_PLAN
  return (
    <div>
      <Heading eyebrow="都度払いとの比較">1か月の費用の目安</Heading>

      <div className={cn(cardSurface, 'space-y-4 p-5')}>
        <div>
          <p className="text-sm font-bold text-slate-700">会員の種別</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {MEMBER_PLANS.map((p) => (
              <Choice key={p} selected={plan === p} onClick={() => setPlan(p)}>
                {p}
              </Choice>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <Stepper label={pair ? '1か月の来院回数（2名の合計）' : '1か月の来院回数'} value={visits} min={1} max={31} unit="回" onChange={setVisits} />
          <Stepper label="1回あたりの施術の部位" value={parts} min={1} max={3} unit="部位" onChange={setParts} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-700">毎回あわせて使う物理療法</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {PHYSIO_OPTIONS.map((p) => (
              <Choice key={p.id} selected={physio === p.id} onClick={() => setPhysio(p.id)}>
                {p.name}
              </Choice>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className={cn(cardSurface, 'p-5', result.cheaper === 'payg' && 'border-2 border-teal-700')}>
          <h3 className="text-base font-bold text-slate-700">都度払い</h3>
          <p className="mt-1 text-4xl font-black text-slate-900 tabular-nums">
            {result.payg.toLocaleString('ja-JP')}
            <span className="ml-1 text-base font-bold">円</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 tabular-nums">
            （リハビリ{yen(PAYG_FEES.rehab)}＋施術{yen(PAYG_FEES.part)}×{parts}部位
            {physioFee > 0 ? `＋物理療法${yen(physioFee)}` : ''}）×{visits}回
          </p>
          {result.cheaper === 'payg' && <p className="mt-2 text-sm font-bold text-teal-800">✓ この条件では、こちらが少なくなります</p>}
        </div>
        <div className={cn(cardSurface, 'p-5', result.cheaper === 'member' && 'border-2 border-teal-700')}>
          <h3 className="text-base font-bold text-slate-700">会員プラン（{plan}）</h3>
          <p className="mt-1 text-4xl font-black text-slate-900 tabular-nums">
            {result.member.toLocaleString('ja-JP')}
            <span className="ml-1 text-base font-bold">円</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 tabular-nums">
            月額{yen(MEMBER_MONTHLY[plan])}＋施術{yen(MEMBER_PART_FEE)}×{parts}部位×{visits}回
          </p>
          {result.cheaper === 'member' && <p className="mt-2 text-sm font-bold text-teal-800">✓ この条件では、こちらが少なくなります</p>}
        </div>
      </div>

      <Note className="mt-4">
        <p className="font-bold" aria-live="polite">
          {result.cheaper === 'member' && `この条件では、会員プランのほうが月${yen(result.diff)}少なくなります。`}
          {result.cheaper === 'payg' && `この条件では、都度払いのほうが月${yen(-result.diff)}少なくなります。`}
          {result.cheaper === 'same' && 'この条件では、どちらも同じ金額です。'}
        </p>
        {even !== null && (
          <p>
            同じ内容なら、月{even}回以上の来院で会員プランのほうが少なくなります。それより少ない方は、都度払いのほうが少なくなります。
          </p>
        )}
      </Note>
      <ul className="mt-4 space-y-1 text-sm leading-relaxed text-slate-600">
        <li>・健康保険の施術を併用しない場合の金額です。</li>
        <li>・会員プランで行う内容は、状態に応じて当院が判断します。毎回同じ内容とは限らないため、金額は目安です。</li>
        {pair && <li>・兄弟・親子プランは、2名分の来院を合わせた回数で比べています。</li>}
      </ul>
    </div>
  )
}

// ── 7. 会員の方の取り扱い ───────────────────────────────────

function MemberPage() {
  return (
    <div>
      <Heading eyebrow="会員の方の取り扱い">特別手技療法プランの会員価格と、キャンセル料</Heading>
      <div className={cn(cardSurface, 'overflow-x-auto')}>
        <table className="w-full min-w-[34rem] text-base">
          <thead>
            <tr className="bg-teal-700 text-left text-white">
              <th className="px-4 py-3 font-bold">特別手技療法プラン</th>
              <th className="px-4 py-3 text-right font-bold">非会員</th>
              <th className="px-4 py-3 text-right font-bold">会員</th>
              <th className="px-4 py-3 text-right font-bold">学生会員</th>
            </tr>
          </thead>
          <tbody>
            {SPECIAL_PLANS.map((s) => (
              <tr key={s.name} className="border-t border-slate-200">
                <th className="px-4 py-3 text-left font-medium text-slate-900">{s.name}</th>
                <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{yen(s.nonMember)}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{yen(s.member)}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{yen(s.student)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 space-y-1 text-sm leading-relaxed text-slate-600">
        <li>・完全予約制で、通常のリハビリ枠とは別日・別枠です。会員価格でのご利用は、原則月1回までです。</li>
        <li>・通常の会員リハビリとの同日併用は、原則できません。</li>
      </ul>
      <div className={cn(cardSurface, 'mt-5 flex items-start gap-4 p-5')}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50">
          <Clock className="h-6 w-6 text-teal-700" aria-hidden />
        </span>
        <div>
          <h3 className="text-lg font-bold text-slate-900">会員契約中は、キャンセル料は原則かかりません</h3>
          <p className="mt-1 text-base leading-relaxed text-slate-700">
            当日のキャンセルでも同じです。ただし、キャンセルや変更が続く場合は、予約枠の制限・会員サービスの一時停止・ご契約の継続をお断りすることがあります。
          </p>
        </div>
      </div>
    </div>
  )
}

// ── 8. ご契約前の確認 ───────────────────────────────────────

function TermsPage() {
  const plan = [
    '通い放題ではありません。同じ日に複数回のご利用も原則できません。',
    '施術内容と通院頻度は、状態に応じて当院が判断します。ご希望の内容・回数のすべてを保証するものではありません。',
    '予約枠には限りがあります。ご希望の日時に必ず予約できるとは限りません。',
    '健康保険を使う施術とは別の、自費のプランです。',
  ]
  const contract = [
    '最低利用期間は3か月です。その間の解約は原則お受けできません。',
    'お支払いはクレジットカードのみです。3か月の満了後は、1か月ごとの自動更新です。',
    '未利用分の返金・翌月への繰越は原則ありません。',
    '解約は解約届でお申し出ください。15日までの提出で当月末、16日以降は翌月末に終了します。',
    '入院・医師による運動制限・転居の予定などのときは、休会をご相談いただけます。',
  ]
  return (
    <div>
      <Heading eyebrow="重要事項">ご契約の前に、必ずご確認ください</Heading>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { title: 'プランの内容について', items: plan },
          { title: 'ご契約・お支払いについて', items: contract },
        ].map((g) => (
          <div key={g.title} className={cn(cardSurface, 'p-5')}>
            <h3 className="text-lg font-bold text-slate-900">{g.title}</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-base leading-relaxed text-slate-700 marker:text-teal-700">
              {g.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Note className="mt-5">
        当院は施術所のため、診断・画像検査・投薬・注射は行いません。必要なときは医療機関の受診をお願いし、医師の指示を優先します。
      </Note>
      <p className="mt-3 text-sm text-slate-600">くわしい条件は、「会員プラン利用契約書」の文面でいっしょに確認します。</p>
    </div>
  )
}

// ── 9. 選び方とお申し込みの流れ ─────────────────────────────

function FlowPage({ canJoin, plan, onOpenContract, onClose }: { canJoin: boolean; plan: MemberPlan; onOpenContract: (plan: MemberPlan) => void; onClose: () => void }) {
  const fits = [
    {
      title: '会員プランが合いやすい方',
      items: ['週1〜2回以上のペースで、継続したリハビリが必要な方', '術後のリハビリや競技復帰など、計画を立てて進めたい方', '物理療法を組み合わせる必要がある方', '再評価を受けながら、再発予防まで取り組みたい方'],
    },
    {
      title: '都度払いが合いやすい方',
      items: ['月に数回の通院で足りる方', '通院の予定が立てにくい方', '3か月続けられるか、まだ分からない方', 'まずは短い期間で様子をみたい方'],
    },
  ]
  const steps = [
    { title: 'ご説明', text: 'このご案内と契約書で、内容をご確認ください' },
    { title: 'ご相談', text: '持ち帰って、ご家族とご相談いただけます' },
    { title: 'ご署名', text: '契約書に署名します（未成年の方は保護者も）' },
    { title: '利用開始', text: '最初の決済日からスタートします' },
  ]
  return (
    <div>
      <Heading eyebrow="プランの選び方">どちらが合うか、一緒に考えます</Heading>
      <div className="grid gap-4 sm:grid-cols-2">
        {fits.map((g) => (
          <div key={g.title} className={cn(cardSurface, 'p-5')}>
            <h3 className="text-lg font-bold text-slate-900">{g.title}</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-slate-700 marker:text-teal-700">
              {g.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Note className="mt-4">
        <p className="font-bold">無理におすすめすることはありません。今日、お決めいただく必要もありません。</p>
        <p>合わないと感じたら、都度払いのまま続けていただけます。</p>
      </Note>

      <h3 className="mt-6 flex items-center gap-2 text-lg font-bold text-slate-900">
        <ClipboardCheck className="h-5 w-5 text-teal-700" aria-hidden />
        お申し込みの流れ
      </h3>
      <ol className="mt-2 grid gap-3 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className={cn(cardSurface, 'p-4')}>
            <p className="text-sm font-bold text-teal-700">
              {i + 1}. {s.title}
            </p>
            <p className="mt-1 text-base leading-relaxed text-slate-700">{s.text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-5 rounded-xl bg-teal-700 p-5 text-white">
        <p className="text-sm font-bold text-teal-100">ご質問・お申し込み</p>
        <p className="mt-1 text-xl font-black">お電話 {CLINIC_PHONE}　／　公式LINE</p>
        <p className="mt-2 text-base text-teal-50">痛み・腫れ・しびれが強くなったときは、次の予約を待たずに、当院または医療機関へご連絡ください。</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {canJoin ? (
          <Button size="lg" onClick={() => onOpenContract(plan)} className="px-6">
            <FileSignature className="h-5 w-5" aria-hidden />
            会員プラン利用契約書を開く
          </Button>
        ) : (
          <p className="text-sm text-slate-600">すでに会員プランのお手続きがある方です（契約書は「書類をえらぶ」から開けます）。</p>
        )}
        <Button variant="outline" size="lg" onClick={onClose} className="px-6">
          ご案内を閉じる
        </Button>
      </div>
      {canJoin && <p className="mt-2 text-sm text-slate-600">お申し込みの場合だけ押してください。署名の前に、契約書の文面をいっしょに読みます。</p>}
    </div>
  )
}
