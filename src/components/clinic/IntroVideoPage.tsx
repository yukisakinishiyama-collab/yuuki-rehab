'use client'
/**
 * 料金と会員プランのご紹介（動画）― 患者さんにお見せする紹介ページ
 *
 * 今日 →「患者さんに見せる」から開く（/dashboard/price-video）。2026-11-16 院長の依頼。
 *
 * - この画面（スタッフ用）：動画の確認、向きの選択、動画に出てくる金額の一覧（聞かれたときの確認用）
 * - 「患者さんに見せる」を押すと、画面いっぱいに動画だけを出す（IntroVideoStage.tsx）。開いている間は、院内アプリの
 *   メニューやほかの画面を見せない。Esc か「閉じる」で戻る。何も保存しない
 * - 同じ動画は、カルテの「契約・同意書」タブの「紹介動画を見せる」からも、カルテを開いたまま再生できる
 * - 向きは、押したときの画面の形で選ぶ（横長＝横向きの動画、縦長＝縦向きの動画）。手で選ぶこともできる
 *
 * 動画・金額の出どころと、料金を変えたときの決まりは src/data/intro-videos.ts
 */
import { useCallback, useState } from 'react'
import { MonitorPlay } from 'lucide-react'
import { Button } from '@/components/ui/button'
import IntroVideoStage from './IntroVideoStage'
import { cardSurface } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  lengthLabel,
  paygPerVisit,
  pickOrientation,
  PRICE_GUIDE_FACTS as F,
  PRICE_GUIDE_VIDEO as V,
  yen,
  type VideoOrientation,
} from '@/data/intro-videos'

type Choice = VideoOrientation | 'auto'

const CHOICES: Array<{ id: Choice; label: string }> = [
  { id: 'auto', label: '自動（画面の向き）' },
  { id: 'land', label: '横向き' },
  { id: 'port', label: '縦向き' },
]

function asOfLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

// ── スタッフ用の画面 ─────────────────────────────────

export default function IntroVideoPage() {
  const [choice, setChoice] = useState<Choice>('auto')
  const [stage, setStage] = useState<VideoOrientation | null>(null)
  const close = useCallback(() => setStage(null), [])
  const preview = V.files[choice === 'auto' ? 'land' : choice]

  function show() {
    // 押したときの画面の形で選ぶ（タブレットを横に持っていれば横向きの動画）
    setStage(choice === 'auto' ? pickOrientation(window.innerWidth, window.innerHeight) : choice)
  }

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
    { label: '最低利用期間', value: `${F.minimumMonths}か月`, note: 'そのあとは1か月ごとの更新。解約届は15日までの提出で当月末に終了' },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <p className="text-sm font-bold text-teal-800">患者さんに見せる</p>
        <h1 className="text-xl font-black text-slate-900 lg:text-2xl">{V.title}（動画）</h1>
        <p className="mt-1 text-sm text-slate-700">
          {V.summary}
          {lengthLabel(V.seconds)}・音が出ます。
        </p>
      </div>

      <section className={cn(cardSurface, 'space-y-4 p-4 sm:p-5')}>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={show} size="lg" className="h-12 w-full px-5 font-bold sm:w-auto sm:px-8">
            <MonitorPlay className="h-5 w-5" aria-hidden />
            患者さんに見せる（画面いっぱい）
          </Button>
          <div className="flex overflow-hidden rounded-lg border border-slate-300" role="group" aria-label="動画の向き">
            {CHOICES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={choice === c.id}
                onClick={() => setChoice(c.id)}
                className={cn(
                  'inline-flex min-h-11 items-center px-3 text-sm font-bold',
                  choice === c.id ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-slate-700">
          押すと、メニューやほかの画面を隠して動画だけを出します。タブレットを患者さんに向けてご覧いただけます。終わったら「閉じる」で戻ります。
        </p>

        <div>
          <p className="mb-1.5 text-sm font-bold text-slate-800">動画の確認（スタッフ用）</p>
          <div className="flex justify-center rounded-lg bg-teal-950 p-2">
            <video
              key={preview.src}
              src={preview.src}
              poster={preview.poster}
              width={preview.width}
              height={preview.height}
              controls
              playsInline
              preload="metadata"
              className="h-auto max-h-[60vh] w-auto max-w-full rounded-md bg-black"
            >
              <track kind="captions" src={V.captions} srcLang="ja" label="日本語（声の文字）" />
              この端末では動画を再生できません。
            </video>
          </div>
          <p className="mt-1.5 text-xs text-slate-600">音を出せないときは、動画の字幕（声の文字）を出せます。画面の文字だけでも内容は分かります。</p>
        </div>
      </section>

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

      {stage && <IntroVideoStage orientation={stage} onOrientation={setStage} onClose={close} />}
    </div>
  )
}
