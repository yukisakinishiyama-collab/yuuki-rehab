'use client'
// ──────────────────────────────────────────────
// 疑問・AI相談タブ
// 患者さんについて「疑問に思ったこと」を残し、必要なときにAIへ相談する。
// AIにはお名前などの個人を特定できる情報は送らない（consult-context.ts で要約を作り、送る前に中身を見せる）。
// 回答は参考意見。判断は院長。
// ──────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Intake, KarteQuestion, Patient, QuickMemo, SOAPNote, SpecialTestRecord } from '@/types/patient'
import { deleteKarteQuestion, saveKarteQuestion } from '@/lib/patient-store'
import {
  buildConsultItems,
  findIdentifierLeaks,
  MAX_QUESTION_CHARS,
  type ConsultItem,
  type ConsultItemKey,
} from '@/lib/karte/consult-context'
import { ClearTextButton, CLEARABLE_PADDING } from './shared'

type Props = {
  patient: Patient
  questions: KarteQuestion[]
  intakes: Intake[]
  soapNotes: SOAPNote[]
  specialTests: SpecialTestRecord[]
  memos: QuickMemo[]
  onUpdate: () => void
}

const today = () => new Date().toISOString().split('T')[0]

export default function KarteQuestionsTab({ patient, questions, intakes, soapNotes, specialTests, memos, onUpdate }: Props) {
  const [date, setDate] = useState(today())
  const [text, setText] = useState('')
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open')

  const items = useMemo(
    () => buildConsultItems({ patient, intakes, soapNotes, specialTests, memos }),
    [patient, intakes, soapNotes, specialTests, memos],
  )

  const sorted = [...questions].sort((a, b) => b.questionDate.localeCompare(a.questionDate) || b.createdAt.localeCompare(a.createdAt))
  const shown = sorted.filter(q => (filter === 'all' ? true : q.status === filter))
  const openCount = questions.filter(q => q.status === 'open').length

  function handleAdd() {
    const q = text.trim()
    if (!q) return
    const now = new Date().toISOString()
    saveKarteQuestion({
      id: nanoid(),
      patientId: patient.id,
      questionDate: date,
      question: q,
      status: 'open',
      consults: [],
      createdAt: now,
      updatedAt: now,
    })
    setText('')
    onUpdate()
  }

  return (
    <div className="space-y-4">
      {/* 疑問を書く */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <span className="block text-sm font-semibold text-gray-700">❓ 疑問に思ったことを残す</span>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 whitespace-nowrap">日付</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        <div className="relative">
          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, MAX_QUESTION_CHARS))}
            placeholder="例：膝の腫脹は引いたのに階段の降りだけ痛みが残る。半月板以外に考えることは？"
            rows={3}
            className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none ${CLEARABLE_PADDING}`}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd() }}
          />
          <ClearTextButton value={text} onChange={setText} multiline />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Ctrl+Enter で保存。保存してから「AIに相談」できます</span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!text.trim()}
            className="px-4 py-1.5 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors max-lg:min-h-10"
          >
            保存
          </button>
        </div>
      </div>

      {/* 一覧 */}
      <div className="flex items-center gap-2 px-1">
        {(['open', 'resolved', 'all'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors max-lg:min-h-10 ${
              filter === f ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'open' ? `未解決 ${openCount}` : f === 'resolved' ? `解決済み ${questions.length - openCount}` : `すべて ${questions.length}`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-8">
          {questions.length === 0 ? 'まだ疑問の記録がありません' : 'この区分の記録はありません'}
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map(q => (
            <QuestionCard key={q.id} question={q} patient={patient} items={items} onUpdate={onUpdate} />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 px-1">
        AIへは、お名前・生年月日・連絡先などは送らず、年代・性別・部位・診断名・直近のカルテの要約だけを送ります。回答は参考意見で、判断は院長が行います。
      </p>
    </div>
  )
}

// ── 1件分 ──────────────────────────────────────

function QuestionCard({ question, patient, items, onUpdate }: {
  question: KarteQuestion
  patient: Patient
  items: ConsultItem[]
  onUpdate: () => void
}) {
  const [open, setOpen] = useState(question.status === 'open')
  const [consultOpen, setConsultOpen] = useState(false)
  const [selected, setSelected] = useState<Set<ConsultItemKey>>(() => new Set(items.map(i => i.key)))
  const [preview, setPreview] = useState<ConsultItemKey | null>(null)
  const [followUp, setFollowUp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolution, setResolution] = useState(question.resolution ?? '')
  const [editingResolution, setEditingResolution] = useState(false)

  const chosen = items.filter(i => selected.has(i.key))
  const leaks = findIdentifierLeaks(chosen, patient)
  const latest = question.consults.at(-1)

  function toggle(key: ConsultItemKey) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function save(patch: Partial<KarteQuestion>) {
    saveKarteQuestion({ ...question, ...patch, updatedAt: new Date().toISOString() })
    onUpdate()
  }

  async function consult() {
    if (leaks.length > 0 || busy) return
    setBusy(true)
    setError(null)
    const ask = followUp.trim() ? `${question.question}\n\n（追加の疑問）${followUp.trim()}` : question.question
    try {
      const res = await fetch('/api/karte/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: ask,
          items: chosen,
          previous: question.consults.slice(-3).map(c => ({ question: question.question, answer: c.answer })),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { answer?: string; model?: string; error?: string }
      if (!res.ok || !data.answer) throw new Error(data.error ?? `HTTP ${res.status}`)
      const consultRecord = {
        id: nanoid(),
        askedAt: new Date().toISOString(),
        sentItems: chosen.map(i => i.label),
        answer: data.answer,
        model: data.model,
      }
      save({ consults: [...question.consults, consultRecord] })
      setFollowUp('')
      setConsultOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AIに相談できませんでした')
    } finally {
      setBusy(false)
    }
  }

  function resolve() {
    save({ status: 'resolved', resolution: resolution.trim(), resolvedAt: new Date().toISOString() })
    setEditingResolution(false)
  }

  function reopen() {
    save({ status: 'open', resolvedAt: undefined })
  }

  function remove() {
    if (!window.confirm('この疑問メモを削除しますか？（AIの回答も消えます）')) return
    deleteKarteQuestion(question.id)
    onUpdate()
  }

  return (
    <div className={`bg-white rounded-xl border shadow-sm ${question.status === 'open' ? 'border-amber-200' : 'border-gray-200'}`}>
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full text-left px-4 py-3 flex items-start gap-3 max-lg:min-h-10">
        <span
          className={`mt-0.5 shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${
            question.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {question.status === 'open' ? '未解決' : '解決'}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs text-gray-500">
            {question.questionDate}
            {question.consults.length > 0 ? ` · AI相談 ${question.consults.length}回` : ''}
          </span>
          <span className={`block text-sm text-gray-800 whitespace-pre-wrap ${open ? '' : 'line-clamp-2'}`}>{question.question}</span>
        </span>
        <span className="text-slate-500 text-xs mt-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {/* 直近の回答 */}
          {latest && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs text-gray-500 mb-1">
                AIの回答（{latest.askedAt.slice(0, 16).replace('T', ' ')}・送った情報: {latest.sentItems.length ? latest.sentItems.join('、') : 'なし'}）
              </p>
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{latest.answer}</div>
              <p className="mt-2 text-xs text-gray-500">参考意見です。判断は院長が行ってください。</p>
            </div>
          )}
          {question.consults.length > 1 && (
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer">以前の回答（{question.consults.length - 1}件）</summary>
              <div className="mt-2 space-y-2">
                {question.consults.slice(0, -1).reverse().map(c => (
                  <div key={c.id} className="rounded-lg bg-gray-50 border border-gray-200 p-2">
                    <p className="text-xs text-gray-500 mb-1">{c.askedAt.slice(0, 16).replace('T', ' ')}</p>
                    <div className="whitespace-pre-wrap text-gray-700">{c.answer}</div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* 解決の結論 */}
          {question.status === 'resolved' && !editingResolution && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-xs text-emerald-800 mb-1">結論（{question.resolvedAt?.slice(0, 10) ?? ''}）</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{question.resolution || '（結論は書かれていません）'}</p>
            </div>
          )}

          {/* AIに相談 */}
          {consultOpen ? (
            <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-3 space-y-3">
              <p className="text-sm font-semibold text-gray-800">AIに送る情報を選ぶ</p>
              {items.length === 0 ? (
                <p className="text-xs text-gray-500">送れるカルテの情報がありません（疑問の文章だけで相談します）</p>
              ) : (
                <ul className="space-y-1.5">
                  {items.map(item => (
                    <li key={item.key} className="text-sm">
                      <label className="flex items-center gap-2 max-lg:min-h-10">
                        <input type="checkbox" checked={selected.has(item.key)} onChange={() => toggle(item.key)} className="accent-teal-700" />
                        <span className="text-gray-800">{item.label}</span>
                        <button
                          type="button"
                          onClick={() => setPreview(p => (p === item.key ? null : item.key))}
                          className="ml-auto text-xs text-teal-700 underline whitespace-nowrap max-lg:min-h-10"
                        >
                          {preview === item.key ? '閉じる' : '中身を見る'}
                        </button>
                      </label>
                      {preview === item.key && (
                        <pre className="mt-1 ml-6 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white border border-gray-200 p-2 text-xs text-gray-700">{item.text}</pre>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {leaks.length > 0 && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                  「{leaks.join('」「')}」にお名前または電話番号が含まれています。チェックを外すか、カルテの該当欄を直してから相談してください。
                </p>
              )}
              <div className="relative">
                <textarea
                  value={followUp}
                  onChange={e => setFollowUp(e.target.value.slice(0, 500))}
                  placeholder="追加で聞きたいこと（任意）。例：前回の回答の「確かめたいこと」は確認済みで、テストは陰性だった"
                  rows={2}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none ${CLEARABLE_PADDING}`}
                />
                <ClearTextButton value={followUp} onChange={setFollowUp} multiline />
              </div>
              {error && <p className="text-xs text-red-700">{error}</p>}
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setConsultOpen(false)} className="px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100 max-lg:min-h-10">
                  やめる
                </button>
                <button
                  type="button"
                  onClick={consult}
                  disabled={busy || leaks.length > 0}
                  className="px-4 py-1.5 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed max-lg:min-h-10"
                >
                  {busy ? '相談中…' : 'この内容で相談する'}
                </button>
              </div>
            </div>
          ) : editingResolution ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
              <p className="text-sm font-semibold text-gray-800">結論を書いて解決にする</p>
              <div className="relative">
                <textarea
                  value={resolution}
                  onChange={e => setResolution(e.target.value.slice(0, 1000))}
                  placeholder="例：McMurray陰性。膝蓋大腿関節由来と判断し、VMOの強化へ切り替えた"
                  rows={3}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none ${CLEARABLE_PADDING}`}
                />
                <ClearTextButton value={resolution} onChange={setResolution} multiline />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setEditingResolution(false)} className="px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100 max-lg:min-h-10">
                  やめる
                </button>
                <button type="button" onClick={resolve} className="px-4 py-1.5 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 max-lg:min-h-10">
                  解決にする
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setConsultOpen(true)}
                className="px-3 py-1.5 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800 max-lg:min-h-10"
              >
                {latest ? 'もう一度AIに相談' : 'AIに相談'}
              </button>
              {question.status === 'open' ? (
                <button type="button" onClick={() => setEditingResolution(true)} className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 text-sm font-medium rounded-lg hover:bg-emerald-50 max-lg:min-h-10">
                  解決にする
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setEditingResolution(true)} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 max-lg:min-h-10">
                    結論を直す
                  </button>
                  <button type="button" onClick={reopen} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 max-lg:min-h-10">
                    未解決に戻す
                  </button>
                </>
              )}
              <button type="button" onClick={remove} className="ml-auto px-2 py-1.5 text-xs text-slate-500 hover:text-red-600 max-lg:min-h-10">
                削除
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
