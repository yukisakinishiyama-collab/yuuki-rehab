'use client'
/**
 * 料金と会員プランのご紹介（動画）― 患者さんにお見せする紹介ページ
 *
 * 今日 →「患者さんに見せる」から開く（/dashboard/price-video）。2026-11-16 院長の依頼。
 *
 * - この画面（スタッフ用）：動画の確認、向きの選択、動画に出てくる金額の一覧（聞かれたときの確認用）
 * - 「患者さんに見せる」を押すと、画面いっぱいに動画だけを出す（枠は IntroVideoShell.tsx → IntroVideoStage.tsx）。開いている間は、
 *   院内アプリのメニューやほかの画面を見せない。Esc か「閉じる」で戻る。何も保存しない
 * - 同じ動画は、カルテの「契約・同意書」タブの「紹介動画を見せる」からも、カルテを開いたまま再生できる
 * - 向きは、押したときの画面の形で選ぶ（横長＝横向きの動画、縦長＝縦向きの動画）。手で選ぶこともできる
 *
 * 動画・金額の出どころと、料金を変えたときの決まりは src/data/intro-videos.ts
 */
import IntroVideoShell, { asOfLabel } from './IntroVideoShell'
import { cardSurface } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  paygPerVisit,
  PRICE_GUIDE_FACTS as F,
  PRICE_GUIDE_VIDEO as V,
  videoMemberMonthly,
  videoPaygMonthly,
  yen,
} from '@/data/intro-videos'

// ── スタッフ用の画面（枠は IntroVideoShell。ここは「動画に出てくる金額と条件」） ──

export default function IntroVideoPage() {
  const facts: Array<{ label: string; value: string; note?: string }> = [
    { label: '都度払い（1回の基本）', value: yen(paygPerVisit()), note: `リハビリ（約30分）${yen(F.paygRehab)}＋施術（1部位）${yen(F.paygPart)}` },
    { label: '初回のみ', value: `初回料 ${yen(F.firstVisit)}` },
    { label: '物理療法を加える日', value: `1つにつき ${F.physioMin.toLocaleString('ja-JP')}〜${yen(F.physioMax)}` },
    { label: '会員プラン（月額）', value: `一般 ${yen(F.memberGeneral)}・学生 ${yen(F.memberStudent)}` },
    {
      label: '会員の1回ごとの施術料（1部位）',
      value: `健康保険を使う日 ${yen(F.memberPartWithInsurance)}＋保険の窓口料金`,
      note: `健康保険を使わない日 ${yen(F.memberPartNoInsurance)}`,
    },
    { label: '会員の材料費', value: '追加の料金なし' },
    {
      label: '月額に含まれる物理療法',
      value: '追加の料金なし（使用は状態に応じて当院が判断）',
      note: `都度払いでは ${F.includedPhysio.map((p) => `${p.name} ${yen(p.fee)}`).join('・')}`,
    },
    {
      label: `動画の比べ方（月${F.compareVisits}回）`,
      value: `会員プラン ${yen(videoMemberMonthly(F.compareVisits))}（どの場合も同じ）`,
      note: `都度払い：物理療法なし ${yen(videoPaygMonthly(F.compareVisits))}・${F.compareExamples
        .map((x) => `${x.label} ${yen(videoPaygMonthly(F.compareVisits, x.fee))}`)
        .join('・')}。一般会員・1部位・健康保険を使わない場合`,
    },
    {
      label: '物理療法を使わない場合',
      value: `月${F.compareVisits}回はほぼ同じ（都度払いが${yen(videoMemberMonthly(F.compareVisits) - videoPaygMonthly(F.compareVisits))}少ない）`,
      note: `月9回からは会員プランが少ない（月9回 ${yen(videoPaygMonthly(9))} → ${yen(videoMemberMonthly(9))}、月12回 ${yen(videoPaygMonthly(12))} → ${yen(videoMemberMonthly(12))}）`,
    },
    { label: '最低利用期間', value: `${F.minimumMonths}か月`, note: 'そのあとは1か月ごとの更新。解約届は15日までの提出で当月末に終了' },
  ]

  return (
    <IntroVideoShell video={V}>
      <section className={cn(cardSurface, 'p-4 sm:p-5')}>
        <h2 className="text-base font-bold text-slate-900">動画に出てくる金額と条件</h2>
        <p className="mt-0.5 text-xs text-slate-600">税込・{asOfLabel(V.asOf)}時点。患者さんに聞かれたときの確認用です。</p>
        <dl className="mt-3 divide-y divide-slate-100">
          {facts.map((f) => (
            <div key={f.label} className="grid gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[14rem_1fr]">
              <dt className="text-sm font-bold text-slate-700">{f.label}</dt>
              <dd className="text-sm text-slate-900">
                <span className="font-bold tabular-nums">{f.value}</span>
                {f.note && <span className="block text-xs text-slate-600">{f.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
          料金や条件を変えたときは、動画を作り直してください。動画の中の金額は書きかえられません（古い金額のまま見せないため）。
        </p>
        <p className="mt-3 text-sm text-slate-700">
          その方の回数や部位で費用を比べるときは、カルテの「契約・同意書」→「会員プランのご案内」を開きます（金額と言い方は、この動画と同じです）。
        </p>
        <p className="mt-2 text-xs text-slate-600">
          通院中の方に院内でお見せするための動画です。SNS など院の外に出すときは、広告として点検し直してください。
        </p>
      </section>
    </IntroVideoShell>
  )
}
