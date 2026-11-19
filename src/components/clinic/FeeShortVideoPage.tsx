'use client'
/**
 * 料金のしくみと健康保険のご案内・短い版（動画・約2分）― 患者さんにお見せする紹介ページ
 *
 * 今日 →「患者さんに見せる」から開く（/dashboard/fee-short-video）。2026-11-19 院長の依頼で足した。
 * くわしい版（/dashboard/fee-video・約4分）の最初の版で、初めての方に、まず全体を短く伝えるためのもの。
 * 保険の日の金額（676円）・グラフ・保険＋自費・物理療法の料金は、くわしい版にだけ入っている。
 *
 * 枠（題・「患者さんに見せる」・向き・動画の確認）は IntroVideoShell.tsx。ここは「動画に出てくる内容」（聞かれたときの確認用）。
 * 動画・内容の出どころと、変えたときの決まりは src/data/intro-videos.ts
 */
import Link from 'next/link'
import IntroVideoShell, { asOfLabel } from './IntroVideoShell'
import { cardSurface } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { FEE_SHORT_VIDEO as V, FEE_SYSTEM_FACTS as F, FEE_SYSTEM_VIDEO as LONG, lengthLabel, yen } from '@/data/intro-videos'

export default function FeeShortVideoPage() {
  const facts: Array<{ label: string; value: string; note?: string }> = [
    { label: '健康保険が使えるケガ', value: F.insuranceCovered.join('／'), note: '使えるかどうかは、症状や受診の状況によって変わります' },
    { label: '健康保険の対象にならないもの（原則）', value: F.insuranceNotCovered.join('・') },
    {
      label: '保険が使えるときの料金',
      value: '施術の内容と料金は、国が全国共通で決めている',
      note: `窓口のお支払いは${F.windowShare}（年齢や所得などで変わる）。残りは、加入している健康保険から支払われる`,
    },
    {
      label: '当院のリハビリ（自費）',
      value: '機能の回復と再発の予防を目的にした運動療法',
      note: '保険の対象とは目的がちがうため、自費。「保険では不十分」とは言っていません',
    },
    {
      label: 'リハビリ（約30分）',
      value: yen(F.paygRehab),
      note: '完全予約制・柔道整復師（国家資格）が問診から運動療法まで担当・状態の確認（初回はエコーで観察できる範囲も）・運動療法とセルフケア',
    },
    {
      label: '画面の小さな文字',
      value: `1回の基本 ${yen(F.paygRehab + F.paygPart)}（リハビリ＋施術1部位 ${yen(F.paygPart)}）`,
      note: `初回のみ初回料 ${yen(F.firstVisit)}。すべて税込`,
    },
    { label: '料金の約束', value: '施術の前に料金を伝える・追加は内容と金額を伝えて了承をいただいてから・表示は税込' },
    { label: '最後の画面', value: '急なケガは保険が使える場合あり・会員プラン（1か月以上通院され必要と判断した方）・料金だけの相談も歓迎' },
  ]

  return (
    <IntroVideoShell video={V}>
      <section className={cn(cardSurface, 'p-4 sm:p-5')}>
        <h2 className="text-base font-bold text-slate-900">くわしい版とのちがい</h2>
        <p className="mt-1 text-sm text-slate-800">
          この短い版は、料金のしくみの全体を{lengthLabel(V.seconds)}で伝えます。保険の日の1か所の金額（676円）・グラフ・「保険＋自費」という選び方・物理療法の料金は入っていません。
          「どうして自費もあるの？」と聞かれたときは、
          <Link href={LONG.page} className="font-bold text-teal-800 underline underline-offset-2 hover:text-teal-900">
            くわしい版（{lengthLabel(LONG.seconds)}）
          </Link>
          をお見せください。
        </p>
      </section>

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
          （{asOfLabel(F.insuranceSource.checked)}に確認）。
        </p>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
          料金や保険のきまりが変わったときは、動画を作り直してください。動画の中の文字と声は書きかえられません。
        </p>
        <p className="mt-2 text-xs text-slate-600">
          通院中の方・初めての方に院内でお見せするための動画です。SNS など院の外に出すときは、広告として点検し直してください。
        </p>
      </section>
    </IntroVideoShell>
  )
}
