'use client'
/**
 * アウトカムの記録の欄の「測り方の図」（院長が ChatGPT で作り、「この図を使う」にした図だけ出す）
 * 図がまだ無いときは、院長にだけ「図を作る」への入口を出す。2026-11-27 院長の依頼
 */
import Link from 'next/link'
import { METHOD_IMAGE_SCENES } from '@/data/outcome-method-images'
import { METHOD_IMAGE_NOTE } from '@/lib/karte/method-images'
import { useMethodImages } from '@/lib/karte/method-image-client'
import type { OutcomeMetricKey } from '@/types/contracts'

export default function MethodImageHint({ metricKey, isAdmin }: { metricKey: OutcomeMetricKey; isAdmin: boolean }) {
  const scene = METHOD_IMAGE_SCENES[metricKey]
  const state = useMethodImages()
  if (!scene || !state) return null
  const img = state.items[metricKey]?.approved
  if (!img) {
    if (!isAdmin) return null
    return (
      <Link href={`/patients/method-images#${metricKey}`} className="mt-1 inline-flex min-h-10 items-center text-xs font-bold text-teal-800 hover:underline">
        {state.items[metricKey]?.draft ? '測り方の図：確かめを待っています（院長）→' : '測り方の図を ChatGPT で作る（院長）→'}
      </Link>
    )
  }
  return (
    <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1">
      <summary className="flex min-h-10 cursor-pointer items-center text-xs font-bold text-teal-800">測り方の図を見る（イメージ）</summary>
      <figure className="pb-2">
        {/* 図は Vercel Blob の一般の図（患者さんの情報は入っていない） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.url} alt={`測り方のイメージ：${scene.caption}`} loading="lazy" className="w-full max-w-xl rounded-lg border border-slate-200 bg-white" />
        <figcaption className="mt-1 text-xs text-slate-700">{scene.caption}</figcaption>
        <p className="mt-0.5 text-xs text-slate-500">{METHOD_IMAGE_NOTE}</p>
      </figure>
    </details>
  )
}
