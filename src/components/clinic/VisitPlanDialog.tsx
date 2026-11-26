'use client'
// ──────────────────────────────────────────────
// 予約表の「時間未定」の欄から開く小さな画面（2026-11-25 院長「予約管理画面で院長、スタッフと別に
// その日の時間を定めない予約欄を作成してください」）
//
// 予約管理画面（予約システム）の「時間未定」の欄で「＋ 入れる」・来院予定を押すと、予約の画面から合図が届き、
// 院内アプリがこの画面を予約表の上に重ねて出す（lib/yoyaku-lane.ts・YoyakuFrame）。
// - 入れる … その日を選んだ状態で、来院予定を入れる（カルテから選ぶ・お名前だけ）
// - 来院予定 … 来院した／来なかった・日にちを変える・取り消す
// 中身は「来院予定（日にち）」と同じ部品（VisitPlansPanel の PlanAddForm・PlanRow）。記録も同じ pt_visit_plans
// ──────────────────────────────────────────────
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { jstToday, planDateLabel } from '@/lib/visit-plans'
import { PlanAddForm, PlanRow, usePlans } from './VisitPlansPanel'

export type PlanDialogState = { mode: 'add'; date: string } | { mode: 'plan'; id: string }

export default function VisitPlanDialog({ state, onClose }: { state: PlanDialogState; onClose: () => void }) {
  const [plans, reload] = usePlans()
  const today = jstToday()

  // Esc で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const plan = state.mode === 'plan' ? plans.find(p => p.id === state.id) : undefined
  const title =
    state.mode === 'add'
      ? `${planDateLabel(state.date, today)} に、時間を決めない来院予定を入れる`
      : plan
        ? `${planDateLabel(plan.date, today)} の来院予定（時間未定）`
        : '来院予定（時間未定）'

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:max-w-xl sm:rounded-2xl sm:pb-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-black text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" aria-hidden />
            閉じる
          </button>
        </div>
        {state.mode === 'add' ? (
          <>
            <p className="mb-3 text-sm text-slate-600">予約表の空きは減りません。LINE 連携の方には、LINE でお知らせします。</p>
            <PlanAddForm initialDate={state.date} autoFocus onAdded={onClose} />
          </>
        ) : plan ? (
          <ul>
            <PlanRow
              plan={plan}
              today={today}
              onChange={() => {
                reload()
                onClose()
              }}
            />
          </ul>
        ) : (
          <p className="text-sm text-slate-600">この来院予定は、もう取り消されています。</p>
        )}
      </div>
    </div>
  )
}
