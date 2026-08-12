'use client'
// ──────────────────────────────────────────────
// 病院からのプロトコル（PDF）を読み取って取り込む
//
// AIに新しく作らせるのではなく、資料に書いてあることを写し取る。
// 読み取り結果はそのまま保存せず、この画面で院長が確認してから反映する。
// 取り込んだフェーズには出典を残し、あとから資料と突き合わせられるようにする。
// ──────────────────────────────────────────────
import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { Phase, Protocol, ProtocolAttachment } from '@/types/protocol'
import { updateProtocol } from '@/lib/protocol-store'
import { X, FileText, AlertTriangle, Loader2 } from 'lucide-react'

/** AIが返す「資料に書いてあったこと」 */
interface Extracted {
  sourceTitle?: string
  sourceOrg?: string
  surgeryOrCondition?: string
  overallNotes?: string
  phases?: Array<{
    order?: number
    title?: string
    durationWeeks?: string
    goals?: string[]
    exercises?: Array<{ name?: string; dose?: string; notes?: string }>
    advanceCriteria?: Array<{ label?: string; target?: string }>
    precautions?: string[]
    redFlags?: string[]
    outcomes?: string[]
  }>
  unreadable?: string[]
  notInDocument?: string[]
}

interface Props {
  protocol: Protocol
  attachment: ProtocolAttachment
  onClose: () => void
  onApplied: () => void
}

export default function ProtocolImportModal({ protocol, attachment, onClose, onApplied }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [data, setData] = useState<Extracted | null>(null)
  const [hint, setHint] = useState('')
  const [mode, setMode] = useState<'replace' | 'append'>('replace')

  async function read() {
    setLoading(true)
    setError('')
    setData(null)
    try {
      // 保存時に data URL の接頭辞が付いている場合があるので落とす
      const base64 = attachment.data.includes(',')
        ? attachment.data.slice(attachment.data.indexOf(',') + 1)
        : attachment.data

      const res = await fetch('/api/protocol-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileType: attachment.fileType,
          fileName: attachment.fileName,
          data: base64,
          hint: hint.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '読み取りに失敗しました')
      setData(json.result as Extracted)
      setTruncated(Boolean(json.truncated))
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み取りに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  /** 出典（どの資料の何ページ相当か分かるように残す） */
  function sourceLabel(): string {
    const org = data?.sourceOrg?.trim()
    const title = data?.sourceTitle?.trim()
    return [org, title].filter(Boolean).join(' ') || attachment.note || attachment.fileName
  }

  function apply() {
    if (!data?.phases?.length) return
    const source = sourceLabel()
    const base = mode === 'append' ? protocol.phases.length : 0

    const phases: Phase[] = data.phases.map((p, i) => ({
      id: nanoid(),
      order: base + i + 1,
      title: p.title?.trim() || `第${base + i + 1}期`,
      durationWeeks: p.durationWeeks?.trim() || undefined,
      goals: (p.goals ?? []).filter(Boolean),
      exercises: (p.exercises ?? [])
        .filter(e => e?.name)
        .map(e => ({ name: e.name!, dose: e.dose ?? '', notes: e.notes ?? '' })),
      advanceCriteria: (p.advanceCriteria ?? [])
        .filter(c => c?.label)
        .map(c => ({ label: c.label!, target: c.target ?? '', met: false })),
      precautions: (p.precautions ?? []).filter(Boolean),
      redFlags: (p.redFlags ?? []).filter(Boolean),
      outcomes: (p.outcomes ?? []).filter(Boolean),
      // 当院の判断ではなく、提供元の資料に基づく内容であることを残す
      evidence: 'needs_review',
      references: [{
        title: data.sourceTitle?.trim() || attachment.fileName,
        source: data.sourceOrg?.trim() || '提供元の医療機関',
        evidenceGrade: 'V',
        note: '提供された資料の記載どおり（当院での確認が必要）',
      }],
    }))

    const noteLines = [
      protocol.consensusNotes?.trim() || '',
      `【取り込み】${source} の記載をそのまま反映（${new Date().toLocaleDateString('ja-JP')}）`,
      data.surgeryOrCondition?.trim() ? `対象: ${data.surgeryOrCondition.trim()}` : '',
      data.overallNotes?.trim() ? `全体の注意: ${data.overallNotes.trim()}` : '',
      ...(data.unreadable ?? []).map(u => `※ 判読できず: ${u}`),
      ...(data.notInDocument ?? []).map(n => `※ 資料に記載なし: ${n}`),
    ].filter(Boolean)

    updateProtocol(protocol.id, {
      phases: mode === 'append' ? [...protocol.phases, ...phases] : phases,
      consensusNotes: noteLines.join('\n'),
      ...(mode === 'replace' ? { currentPhaseIndex: 0 } : {}),
    })
    onApplied()
    onClose()
  }

  const phaseCount = data?.phases?.length ?? 0

  return (
    <div className="fixed inset-0 z-[9000] bg-black/50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl my-8 shadow-xl">
        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              資料からプロトコルを取り込む
            </h2>
            <p className="text-xs text-slate-500 mt-1 truncate">
              {attachment.note || attachment.fileName}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            資料に書かれている内容だけを写し取ります。AIが内容を補ったり、良くしたりはしません。
            読み取った結果を確認してから反映してください。
          </p>

          {!data && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  補足の指示（任意）
                </label>
                <input
                  value={hint}
                  onChange={e => setHint(e.target.value)}
                  placeholder="例: 3ページ目の表だけを読み取ってください"
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>
              <button
                type="button"
                onClick={() => void read()}
                disabled={loading}
                className="w-full rounded-xl bg-teal-600 text-white py-3 text-sm font-bold
                  hover:bg-teal-700 disabled:opacity-50 transition-colors
                  flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? '資料を読み取っています…' : '資料を読み取る'}
              </button>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {data && (
            <div className="space-y-4">
              {/* 読み取り元 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs space-y-1">
                {data.sourceOrg && <p><span className="text-slate-400">発行元：</span>{data.sourceOrg}</p>}
                {data.sourceTitle && <p><span className="text-slate-400">表題：</span>{data.sourceTitle}</p>}
                {data.surgeryOrCondition && <p><span className="text-slate-400">対象：</span>{data.surgeryOrCondition}</p>}
                {data.overallNotes && <p><span className="text-slate-400">全体の注意：</span>{data.overallNotes}</p>}
              </div>

              {(truncated || (data.unreadable?.length ?? 0) > 0) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />資料と照らし合わせてください
                  </p>
                  <ul className="text-xs text-amber-800 mt-1 space-y-0.5">
                    {truncated && <li>・資料が長く、途中までしか読めていない可能性があります</li>}
                    {(data.unreadable ?? []).map((u, i) => <li key={i}>・判読できず: {u}</li>)}
                  </ul>
                </div>
              )}

              {/* 読み取り結果 */}
              <div>
                <p className="text-xs font-bold text-slate-600 mb-2">
                  読み取ったフェーズ（{phaseCount}件）
                </p>
                <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-1">
                  {(data.phases ?? []).map((p, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">
                        {i + 1}. {p.title || '（名称の記載なし）'}
                        {p.durationWeeks && (
                          <span className="ml-2 text-xs font-normal text-slate-500">{p.durationWeeks}</span>
                        )}
                      </p>
                      <List label="目標" items={p.goals} />
                      <List label="運動" items={(p.exercises ?? []).map(e =>
                        [e.name, e.dose].filter(Boolean).join('　'))} />
                      <List label="次の期へ進む基準" items={(p.advanceCriteria ?? []).map(c =>
                        [c.label, c.target].filter(Boolean).join('　'))} />
                      <List label="注意・禁忌" items={p.precautions} highlight />
                      <List label="中止・受診の基準" items={p.redFlags} highlight />
                      <List label="評価" items={p.outcomes} />
                    </div>
                  ))}
                </div>
              </div>

              {(data.notInDocument?.length ?? 0) > 0 && (
                <p className="text-[11px] text-slate-400">
                  資料に記載が無かった項目：{(data.notInDocument ?? []).join('、')}
                </p>
              )}

              {/* 反映のしかた */}
              <div className="rounded-xl border border-slate-200 px-4 py-3 space-y-2">
                <p className="text-xs font-bold text-slate-600">反映のしかた</p>
                <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')}
                    className="mt-0.5 accent-teal-600" />
                  <span>
                    今のフェーズをすべて置き換える
                    <span className="text-slate-400">（現在の{protocol.phases.length}件は消えます）</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="radio" checked={mode === 'append'} onChange={() => setMode('append')}
                    className="mt-0.5 accent-teal-600" />
                  <span>今のフェーズの後ろに追加する</span>
                </label>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                取り込んだフェーズには「要・臨床医確認」と出典が付きます。
                荷重・装具・可動域制限は患者さんの安全に関わるため、必ず資料と見比べてください。
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={apply}
                  disabled={phaseCount === 0}
                  className="flex-1 rounded-xl bg-teal-600 text-white py-3 text-sm font-bold
                    hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  この内容で反映する
                </button>
                <button
                  type="button"
                  onClick={() => { setData(null); setError('') }}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600
                    hover:bg-slate-50 transition-colors"
                >
                  読み直す
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function List({ label, items, highlight }: { label: string; items?: string[]; highlight?: boolean }) {
  const values = (items ?? []).filter(Boolean)
  if (values.length === 0) return null
  return (
    <div className="mt-1.5">
      <p className={`text-[10px] font-semibold ${highlight ? 'text-red-600' : 'text-slate-400'}`}>{label}</p>
      <ul className={`text-xs space-y-0.5 ${highlight ? 'text-red-800' : 'text-slate-600'}`}>
        {values.map((v, i) => <li key={i}>・{v}</li>)}
      </ul>
    </div>
  )
}
