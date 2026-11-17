'use client'
/**
 * 料金のしくみと健康保険のご案内（動画）― 患者さんにお見せする紹介ページ
 *
 * 今日 →「患者さんに見せる」から開く（/dashboard/fee-video）。2026-11-17 院長の依頼で、料金と会員プランの動画とは別の枠として足した。
 * 「高い」と感じられる前に、健康保険が使えるケガ・使えないもの、窓口の料金が全体の一部であること、当院のリハビリが自費である
 * 理由と料金に含まれるもの、料金の約束を伝える。
 *
 * 枠（題・「患者さんに見せる」・向き・動画の確認）は IntroVideoShell.tsx。ここは「動画に出てくる内容」（聞かれたときの確認用）。
 * 動画・内容の出どころと、変えたときの決まりは src/data/intro-videos.ts
 */
import IntroVideoShell, { asOfLabel } from './IntroVideoShell'
import { cardSurface } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  FEE_SYSTEM_FACTS as F,
  FEE_SYSTEM_VIDEO as V,
  FEE_VIDEO_EVIDENCE as EV,
  INSURANCE_ONE_PART as I,
  insuranceOnePartTotal,
  windowPayment,
  yen,
} from '@/data/intro-videos'

export default function FeeVideoPage() {
  const total = insuranceOnePartTotal()
  const facts: Array<{ label: string; value: string; note?: string }> = [
    { label: '健康保険が使えるケガ', value: F.insuranceCovered.join('／'), note: '使えるかどうかは、症状や受診の状況によって変わります' },
    { label: '健康保険の対象にならないもの（原則）', value: F.insuranceNotCovered.join('・') },
    { label: '保険が使えるときの料金', value: '施術の内容と料金は、国が全国共通で決めている', note: `窓口のお支払いは${F.windowShare}（年齢や所得などで変わる）。残りは加入している健康保険から` },
    {
      label: '保険の日の1か所の料金（国が決めた金額）',
      value: `全部で ${yen(total)}（後療料 ${yen(I.koryo)}＋温罨法 ${yen(I.onanpo)}＋電療 ${yen(I.denryo)}・10割）`,
      note: `窓口3割で約${yen(windowPayment(total, 0.3))}・2割で約${yen(windowPayment(total, 0.2))}・1割で約${yen(windowPayment(total, 0.1))}。ねんざ・打撲の2回目以降、受傷から6日目以降に温罨法と電療を加えた場合。長く続く場合や部位が増える場合は計算が変わる`,
    },
    {
      label: '痛みが引いても（線のグラフ）',
      value: '痛みは早く引くが、筋力・バランスが戻るまでには時間がかかることがある（線の形はイメージ図）',
      note: `足首のねんざで、1年たっても痛みが残る人は100人に${EV.painAtOneYear.min}〜${EV.painAtOneYear.max}人（${EV.painAtOneYear.source}）`,
    },
    {
      label: 'くり返した人（100人の図）',
      value: `1年のあいだに、いつもの治療だけ 100人中${EV.recurrence.usualCare}人／＋${EV.recurrence.weeks}週間のバランスの運動 100人中${EV.recurrence.withBalanceTraining}人`,
      note: `${EV.recurrence.source}・${EV.recurrence.participants}人。運動は自宅で行うプログラム。すべての方に当てはまるわけではない`,
    },
    {
      label: '保険と自費の役割（帯のグラフ）',
      value: '健康保険＝急なケガの手当て／自費のリハビリ＝機能の回復・再発の予防。どちらか一方ではなく、時期と目的で使い分ける',
    },
    { label: '当院のリハビリ（自費）', value: '機能の回復と再発の予防を目的にした運動療法', note: '保険の対象とは目的がちがうため、自費。「保険では不十分だから」とは言っていない' },
    {
      label: 'リハビリ（約30分）',
      value: yen(F.paygRehab),
      note: '完全予約制・柔道整復師（国家資格）が問診から運動療法まで担当・状態の確認（初回はエコーで観察できる範囲も）・運動療法とセルフケア',
    },
    { label: '画面の小さな文字', value: `1回の基本 ${yen(F.paygRehab + F.paygPart)}（リハビリ＋施術1部位 ${yen(F.paygPart)}）`, note: `初回のみ初回料 ${yen(F.firstVisit)}。すべて税込` },
    { label: '料金の約束', value: '施術の前に料金を伝える・追加は内容と金額を伝えて了承をいただいてから・表示は税込' },
    { label: '最後の画面', value: '急なケガは保険が使える場合あり・会員プラン（1か月以上通院され必要と判断した方）・料金だけの相談も歓迎' },
  ]

  return (
    <IntroVideoShell video={V}>
      <section className={cn(cardSurface, 'p-4 sm:p-5')}>
        <h2 className="text-base font-bold text-slate-900">動画に出てくる内容</h2>
        <p className="mt-0.5 text-xs text-slate-600">税込・{asOfLabel(V.asOf)}時点。患者さんに聞かれたときの確認用です。</p>
        <dl className="mt-3 divide-y divide-slate-100">
          {facts.map((f) => (
            <div key={f.label} className="grid gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[14rem_1fr]">
              <dt className="text-sm font-bold text-slate-700">{f.label}</dt>
              <dd className="text-sm text-slate-900">
                <span className="font-bold">{f.value}</span>
                {f.note && <span className="block text-xs text-slate-600">{f.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-600">
          保険のきまりの出どころ：
          <a href={F.insuranceSource.url} target="_blank" rel="noreferrer" className="font-bold text-teal-800 underline underline-offset-2">
            {F.insuranceSource.label}
          </a>
          （{asOfLabel(F.insuranceSource.checked)}に確認）。1か所の料金（{yen(total)}）は
          <a href={I.source.url} target="_blank" rel="noreferrer" className="font-bold text-teal-800 underline underline-offset-2">
            {I.source.label}
          </a>
          の金額で、{asOfLabel(I.since)}からのものです。次の改定で変わります。研究の出どころ：
          <a href={`https://doi.org/${EV.painAtOneYear.doi}`} target="_blank" rel="noreferrer" className="font-bold text-teal-800 underline underline-offset-2">
            van Rijn ほか 2008
          </a>
          ・
          <a href={`https://doi.org/${EV.recurrence.doi}`} target="_blank" rel="noreferrer" className="font-bold text-teal-800 underline underline-offset-2">
            Hupperets ほか 2009
          </a>
          。
        </p>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
          料金や保険のきまり・保険の金額が変わったときは、動画を作り直してください。動画の中の文字と声は書きかえられません。
        </p>
        <p className="mt-2 text-xs text-slate-600">
          通院中の方・初めての方に院内でお見せするための動画です。SNS など院の外に出すときは、広告として点検し直してください。
        </p>
      </section>
    </IntroVideoShell>
  )
}
