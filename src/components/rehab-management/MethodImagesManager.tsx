'use client'
/**
 * 測り方の図を作る・確かめる（院長だけ。/patients/method-images）
 *
 * 2026-11-27 院長「検査方法をChat Gptを使用して画像としても載せてください」。
 * 「ChatGPT で作る」→ 下書きを見て「この図を使う」（カルテに出る）／「作り直す」／「やめる」。
 * 1枚ごとに OpenAI の料金がかかるので、押したときだけ作る。まとめて作るときも、押した数だけ1枚ずつ。
 */
import { useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { METHOD_IMAGE_KEYS, METHOD_IMAGE_SCENES } from '@/data/outcome-method-images'
import { getOutcomeMetric } from '@/data/outcome-metrics'
import { METHOD_IMAGE_NOTE, keysWithoutImage, type MethodImage, type MethodImageAction, type MethodImageStore } from '@/lib/karte/method-images'
import { setMethodImages, useMethodImages } from '@/lib/karte/method-image-client'
import { useMarketingRole } from '@/lib/marketing/use-role'
import { Button } from '@/components/ui/button'
import type { OutcomeMetricKey } from '@/types/contracts'

function Picture({ img, label, scene }: { img: MethodImage; label: string; scene: string }) {
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.url} alt={`${label}の測り方のイメージ：${scene}`} loading="lazy" className="w-full rounded-lg border border-slate-200 bg-white" />
      <figcaption className="mt-0.5 text-xs text-slate-500">
        {img.createdAt.slice(0, 10)} に作成（{img.model}）{img.approvedAt ? `・${img.approvedAt.slice(0, 10)} から使用` : ''}
      </figcaption>
    </figure>
  )
}

export default function MethodImagesManager() {
  const { isAdmin } = useMarketingRole()
  const state = useMethodImages()
  const [busy, setBusy] = useState<OutcomeMetricKey | null>(null)
  const [errors, setErrors] = useState<Partial<Record<OutcomeMetricKey, string>>>({})
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null)
  const stopRef = useRef(false)

  async function act(key: OutcomeMetricKey, action: MethodImageAction): Promise<boolean> {
    setBusy(key)
    setErrors((e) => ({ ...e, [key]: undefined }))
    try {
      const r = await fetch('/api/karte/method-images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, action }) })
      const d = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; items?: MethodImageStore } | null
      if (!r.ok || !d?.ok || !d.items) throw new Error(d?.error || `HTTP ${r.status}`)
      setMethodImages({ items: d.items, configured: state?.configured ?? true })
      return true
    } catch (e) {
      setErrors((x) => ({ ...x, [key]: e instanceof Error ? e.message : '扱えませんでした' }))
      return false
    } finally {
      setBusy(null)
    }
  }

  async function generateMissing(keys: OutcomeMetricKey[]) {
    stopRef.current = false
    setBulk({ done: 0, total: keys.length })
    for (let i = 0; i < keys.length; i++) {
      if (stopRef.current) break
      await act(keys[i], 'generate')
      setBulk({ done: i + 1, total: keys.length })
    }
    setBulk(null)
  }

  if (!isAdmin) return <p className="text-sm text-slate-600">この画面は院長だけが使えます。</p>
  if (!state) return <p className="text-sm text-slate-500">読み込み中…</p>

  const missing = keysWithoutImage(state.items)
  const working = busy !== null || bulk !== null

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link href="/patients" className="inline-flex min-h-10 items-center text-sm font-bold text-teal-800 hover:underline">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          カルテの一覧へ
        </Link>
        <h1 className="text-xl font-black text-slate-900">測り方の図（アウトカム）</h1>
        <p className="mt-1 text-sm text-slate-700">
          アウトカムの検査の測り方を、ChatGPT（OpenAI の画像生成）で図にします。院長が見て「この図を使う」にした図だけが、カルテのアウトカムの記録の欄に出ます。
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-600">
          <li>1枚ごとに OpenAI の料金がかかります（投稿の AI 画像と同じ請求）。作るのは押したときだけです。1枚に 30秒〜2分ほどかかります。</li>
          <li>AI の図は、姿勢や角度がまちがうことがあります。説明の文と見比べて、ちがっていたら「作り直す」か「やめる」にしてください。</li>
          <li>図は顔の無い人形のような人物・文字なしで描かせます。患者さんの情報は使いません。カルテには「{METHOD_IMAGE_NOTE}」と出ます。</li>
        </ul>
        {!state.configured && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">OpenAI の設定（OPENAI_API_KEY）が無いため、図を作れません。</p>}
        {state.configured && missing.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {bulk ? (
              <>
                <span className="text-sm font-bold text-slate-700" aria-live="polite">
                  作っています… {bulk.done}/{bulk.total}
                </span>
                <Button type="button" variant="outline" onClick={() => (stopRef.current = true)}>
                  ここで止める
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" disabled={working} onClick={() => void generateMissing(missing)}>
                図の無い {missing.length} 件を、1枚ずつ順に作る
              </Button>
            )}
          </div>
        )}
      </div>

      <ul className="space-y-3">
        {METHOD_IMAGE_KEYS.map((key) => {
          const scene = METHOD_IMAGE_SCENES[key]!
          const label = getOutcomeMetric(key)?.label ?? key
          const entry = state.items[key]
          const isBusy = busy === key
          return (
            <li key={key} id={key} className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4">
              <p className="font-bold text-slate-900">{label}</p>
              <p className="mt-0.5 text-sm text-slate-700">{scene.caption}</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-bold text-slate-600">カルテに出している図</p>
                  {entry?.approved ? (
                    <>
                      <Picture img={entry.approved} label={label} scene={scene.caption} />
                      <Button type="button" size="sm" variant="outline" className="mt-2" disabled={working} onClick={() => void act(key, 'remove')}>
                        図を外す
                      </Button>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">まだありません</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600">新しく作る図（見て確かめてから使う）</p>
                  {entry?.draft ? (
                    <>
                      <Picture img={entry.draft} label={label} scene={scene.caption} />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" size="sm" className="font-bold" disabled={working} onClick={() => void act(key, 'approve')}>
                          この図を使う
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={working || !state.configured} onClick={() => void act(key, 'generate')}>
                          作り直す
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => void act(key, 'discard')}>
                          やめる
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button type="button" size="sm" variant={entry?.approved ? 'outline' : 'default'} className="mt-1 font-bold" disabled={working || !state.configured} onClick={() => void act(key, 'generate')}>
                      {isBusy ? '作っています…（30秒〜2分）' : entry?.approved ? 'ChatGPT で作り直す' : 'ChatGPT で作る'}
                    </Button>
                  )}
                  {isBusy && entry?.draft && <p className="mt-1 text-xs text-slate-600" aria-live="polite">処理しています…</p>}
                </div>
              </div>
              {errors[key] && (
                <p role="alert" className="mt-2 text-sm font-bold text-red-700">
                  {errors[key]}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
