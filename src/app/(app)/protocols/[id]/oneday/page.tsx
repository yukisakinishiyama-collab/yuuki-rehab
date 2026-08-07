'use client'
// ──────────────────────────────────────────────
// 1dayリハ — その日の症状を緩和させる単回メニュー（AI構築）
//
// 通常のプロトコル（長期の段階的リハ）とは別に、来院日の訴え
// （痛い・張る・腫れた等）に対して、その場の1セッションで行う
// 緩和メニューをAIが組み立てる。AIが使えないときは必ず
// ルールベースの基本メニューにフォールバックする（buildBasicMenu）。
// ──────────────────────────────────────────────
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Protocol, ProtocolPatient, Joint } from '@/types/protocol'
import { JOINT_LABELS } from '@/types/protocol'
import { getProtocolById, getPatientById } from '@/lib/protocol-store'
import {
  buildBasicMenu, buildRedFlagWarning, buildPatientNotice, needsReferralFirst, sanitizeMenuForFlags,
  SYMPTOM_LABELS, RED_FLAG_OPTIONS, ITEM_KIND_LABELS,
  type OneDayInput, type OneDayMenu, type SymptomKey, type RedFlagKey,
} from '@/lib/oneday-rehab'
import {
  getOneDaySessions, saveOneDaySession, updateOneDaySession, deleteOneDaySession,
  type OneDaySession,
} from '@/lib/oneday-store'
import DisclaimerBanner from '@/components/protocol/DisclaimerBanner'
import {
  ArrowLeft, Zap, Sparkles, AlertTriangle, Printer, Trash2,
  Clock, Bot, Wrench, History, Check,
} from 'lucide-react'

const SYMPTOM_KEYS = Object.keys(SYMPTOM_LABELS) as SymptomKey[]
const MINUTES_OPTIONS = [10, 15, 20]

const KIND_STYLES: Record<string, string> = {
  manual: 'bg-teal-50 text-teal-700 border-teal-200',
  modality: 'bg-blue-50 text-blue-700 border-blue-200',
  exercise: 'bg-amber-50 text-amber-700 border-amber-200',
  stretch: 'bg-purple-50 text-purple-700 border-purple-200',
  education: 'bg-slate-50 text-slate-600 border-slate-200',
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 印刷用ウィンドウ（患者へ渡す自宅ケアを含む） */
function printMenu(
  patientName: string,
  dateString: string,
  menu: OneDayMenu,
  /** 患者向けの注意文（スタッフ向けの redFlagWarning はそのまま載せない） */
  patientNotice?: string,
) {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  // スタッフ向けの項目（評価・受診案内の段取り）は患者へ渡す紙には載せない
  const printableItems = menu.items.filter(item => !item.staffOnly)
  const items = printableItems.map((item, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td><strong>${esc(item.name)}</strong><span class="kind">${ITEM_KIND_LABELS[item.kind]}</span>
        ${item.dose ? `<div class="dose">${esc(item.dose)}</div>` : ''}
        <div class="steps">${esc(item.steps)}</div>
        ${item.caution ? `<div class="caution">⚠ ${esc(item.caution)}</div>` : ''}
      </td>
      <td class="min">${item.minutes}分</td>
    </tr>`).join('')
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>1dayリハメニュー</title>
<style>
body{font-family:"Hiragino Sans","Noto Sans JP",sans-serif;color:#1e293b;padding:24px;font-size:11pt;line-height:1.7}
h1{font-size:15pt;border-bottom:2px solid #0d9488;padding-bottom:6px}
.meta{color:#64748b;font-size:9pt;margin-bottom:12px}
table{width:100%;border-collapse:collapse;margin:10px 0}
td{border:1px solid #e2e8f0;padding:8px;vertical-align:top}
.num{width:24px;text-align:center;color:#94a3b8;font-weight:bold}
.min{width:44px;text-align:center;white-space:nowrap}
.kind{font-size:8pt;color:#0d9488;border:1px solid #99f6e4;border-radius:8px;padding:1px 6px;margin-left:6px}
.dose{color:#0f766e;font-size:9pt}
.steps{color:#475569;font-size:9pt;margin-top:2px}
.caution{color:#b45309;font-size:9pt;margin-top:2px}
h2{font-size:11pt;margin:14px 0 4px;color:#0f766e}
ul{margin:4px 0;padding-left:20px}
.warn{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:8px 12px;border-radius:8px;margin:8px 0;font-size:10pt}
.foot{margin-top:16px;color:#94a3b8;font-size:8pt}
</style></head><body>
<h1>${esc(menu.title)}</h1>
<div class="meta">${esc(patientName)} 様 ／ ${esc(dateString)} ／ ゆうき整骨院</div>
${patientNotice ? `<div class="warn">${esc(patientNotice)}</div>` : ''}
<p>${esc(menu.summary)}</p>
${printableItems.length > 0 ? `<table>${items}</table>` : ''}
<h2>ご自宅でのケア</h2><ul>${menu.homeAdvice.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
<h2>今日は避けてください</h2><ul>${menu.avoidToday.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
<div class="foot">※ 症状の改善を目指した当日の目安です。痛みが強まる場合は中止し、ご連絡ください。<br>
※ 本メニューは${menu.source === 'ai' ? 'AIの支援を受けて作成し、' : ''}施術者が内容を確認のうえお渡ししています。</div>
<script>window.onload=()=>window.print()</script></body></html>`
  const w = window.open('', '_blank', 'width=800,height=900')
  if (w) { w.document.write(html); w.document.close() }
}

export default function OneDayRehabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [patient, setPatient] = useState<ProtocolPatient | null>(null)

  // 入力フォーム
  const [joint, setJoint] = useState<Joint>('other')
  const [symptoms, setSymptoms] = useState<SymptomKey[]>([])
  const [nrs, setNrs] = useState(5)
  const [flags, setFlags] = useState<RedFlagKey[]>([])
  const [trigger, setTrigger] = useState('')
  const [minutes, setMinutes] = useState(15)

  // 生成結果
  const [generating, setGenerating] = useState(false)
  const [session, setSession] = useState<OneDaySession | null>(null)
  const [aiNote, setAiNote] = useState('')
  const [history, setHistory] = useState<OneDaySession[]>([])

  useEffect(() => {
    const p = getProtocolById(id)
    const pt = p ? getPatientById(p.patientId) : null
    // 患者だけ削除された孤児プロトコルでも白画面にせず一覧へ戻す
    if (!p || !pt) { router.replace('/protocols'); return }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProtocol(p)
    setPatient(pt)
    if (pt.joint) setJoint(pt.joint)
    setHistory(getOneDaySessions(p.patientId))
  }, [id, router])

  function toggleSymptom(key: SymptomKey) {
    setSymptoms(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key])
  }
  function toggleFlag(key: RedFlagKey) {
    setFlags(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key])
  }

  /** メニュー生成（AI優先・失敗時は基本メニューへ必ずフォールバック） */
  async function handleGenerate(forceBasic = false) {
    if (!protocol || !patient || symptoms.length === 0 || generating) return
    setGenerating(true)
    setAiNote('')

    try {
      const input: OneDayInput = { joint, symptoms, nrs, flags, trigger: trigger.trim(), minutes }
      let menu: OneDayMenu | null = null

      // 発熱・排尿排便異常のときはAIを呼ばず、受診案内優先の基本メニューを必ず使う
      const referralFirst = needsReferralFirst(flags)
      const skipAi = forceBasic || referralFirst
      if (referralFirst && !forceBasic) {
        // 「AIでメニュー作成」を押したのに基本メニューが出る理由を必ず示す
        setAiNote('受診を優先すべきサインがあるため、AIは使わず受診案内を優先した基本メニューを表示しています。')
      }

      if (!skipAi) {
        try {
          const currentPhase = protocol.phases[protocol.currentPhaseIndex]
          const res = await fetch('/api/oneday-rehab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              context: {
                age: patient.age,
                diagnosis: patient.diagnosis,
                jointLabel: patient.joint ? JOINT_LABELS[patient.joint] : undefined,
                phaseTitle: currentPhase?.title,
                precautions: currentPhase?.precautions ?? [],
                redFlags: currentPhase?.redFlags ?? [],
                concerns: patient.concerns,
              },
              input: {
                jointLabel: JOINT_LABELS[joint],
                symptomLabels: symptoms.map(s => SYMPTOM_LABELS[s]),
                nrs,
                flagLabels: flags.map(f => RED_FLAG_OPTIONS.find(o => o.key === f)?.label ?? f),
                flagKeys: flags,
                trigger: input.trigger,
                minutes,
              },
            }),
          })
          const data = (await res.json().catch(() => null)) as { menu?: OneDayMenu; error?: string } | null
          if (res.ok && data?.menu && Array.isArray(data.menu.items) && data.menu.items.length > 0) {
            // レッドフラッグの禁忌（温熱・ストレッチ等）はAI出力にも機械的に適用する
            const sanitized = sanitizeMenuForFlags({ ...data.menu, source: 'ai' }, flags)
            if (sanitized.items.length > 0) menu = sanitized
          }
          if (!menu) setAiNote('AIに接続できなかったため、基本メニューを表示しています。')
        } catch {
          setAiNote('AIに接続できなかったため、基本メニューを表示しています。')
        }
      }

      // フォールバック（AIなしでも必ずメニューを出す）
      if (!menu) menu = buildBasicMenu(input)

      // レッドフラッグ警告はAIの出力に関わらず、必ずこちらの判定で重ねる
      const warning = buildRedFlagWarning(flags, nrs)
      if (warning) menu = { ...menu, redFlagWarning: warning }

      const record = {
        protocolId: protocol.id,
        patientId: patient.id,
        date: todayString(),
        input,
        menu,
        afterNrs: null,
        afterNote: '',
      }

      let saved: OneDaySession
      try {
        saved = saveOneDaySession(record)
        // 【この画面でいま生成し直した分】だけを置き換える（試行ログ化の防止）。
        // 過去のセッション（午前に実施した分など）は実施後記録が未入力でも消さない。
        // 削除は保存が成功してからにする（保存失敗時に元の記録まで失わないため）。
        if (
          session &&
          !session.id.startsWith('unsaved-') &&
          session.date === record.date &&
          session.afterNrs == null &&
          !session.afterNote
        ) {
          deleteOneDaySession(session.id)
        }
      } catch {
        // 保存に失敗しても（容量不足等）、メニューの表示と印刷は必ずできるようにする
        saved = { ...record, id: `unsaved-${Date.now()}`, createdAt: new Date().toISOString() }
        setAiNote(prev =>
          [prev, '端末への保存に失敗しました（容量不足の可能性）。表示と印刷はできますが、履歴には残りません。']
            .filter(Boolean).join(' '))
      }
      setSession(saved)
      setHistory(getOneDaySessions(patient.id))
    } finally {
      setGenerating(false)
    }
  }

  /** 実施後の記録（NRS・メモ） */
  function handleAfterUpdate(updates: { afterNrs?: number | null; afterNote?: string }) {
    if (!session) return
    // 保存に失敗したセッション（unsaved-）は画面上の状態だけ更新する
    if (!session.id.startsWith('unsaved-')) {
      try { updateOneDaySession(session.id, updates) } catch { /* 保存失敗時も表示は継続 */ }
    }
    setSession({ ...session, ...updates })
    if (patient) setHistory(getOneDaySessions(patient.id))
  }

  function handleDelete(target: OneDaySession) {
    if (!confirm('このメニューの記録を削除しますか？')) return
    deleteOneDaySession(target.id)
    if (session?.id === target.id) setSession(null)
    if (patient) setHistory(getOneDaySessions(patient.id))
  }

  if (!protocol || !patient) return null

  const menu = session?.menu ?? null
  const totalMinutes = menu ? menu.items.reduce((acc, item) => acc + item.minutes, 0) : 0

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16">
      <DisclaimerBanner />

      {/* ヘッダー */}
      <div>
        <Link
          href={`/protocols/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />プロトコルへ戻る
        </Link>
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Zap className="w-5 h-5 text-amber-600" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[--color-navy] font-display">1dayリハ</h1>
            <p className="text-xs text-slate-500 font-body">
              {patient.name ?? '患者'} 様 — 今日の症状を緩和させる単回メニュー（通常リハとは別）
            </p>
          </div>
        </div>
      </div>

      {/* 入力フォーム */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div>
          <div className="text-xs font-bold text-slate-500 font-display mb-1.5">今日つらい部位</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(JOINT_LABELS) as Joint[]).map(j => (
              <button
                key={j}
                type="button"
                onClick={() => setJoint(j)}
                className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${
                  joint === j
                    ? 'bg-[--color-navy] text-white border-[--color-navy]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {JOINT_LABELS[j]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold text-slate-500 font-display mb-1.5">
            今日の症状（複数OK）<span className="text-red-500 ml-1">必須</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOM_KEYS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSymptom(s)}
                aria-pressed={symptoms.includes(s)}
                className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${
                  symptoms.includes(s)
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                }`}
              >
                {SYMPTOM_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold text-slate-500 font-display mb-1.5">
            痛みの強さ（NRS）: <span className="text-base text-[--color-navy] tabular-nums">{nrs}</span> / 10
          </div>
          <input
            type="range" min={0} max={10} step={1} value={nrs}
            onChange={e => setNrs(Number(e.target.value))}
            className="w-full accent-teal-600"
            aria-label="痛みの強さ"
          />
          <div className="flex justify-between text-[10px] text-slate-400"><span>痛みなし</span><span>最悪の痛み</span></div>
        </div>

        <div>
          <div className="text-xs font-bold text-slate-500 font-display mb-1.5">注意サイン（あれば）</div>
          <div className="space-y-1">
            {RED_FLAG_OPTIONS.map(opt => (
              <label key={opt.key} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flags.includes(opt.key)}
                  onChange={() => toggleFlag(opt.key)}
                  className="accent-red-500"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500 font-display mb-1.5">きっかけ・状況（任意）</div>
            <input
              type="text" value={trigger} onChange={e => setTrigger(e.target.value)}
              placeholder="例: 昨日の練習後から / 朝起きたら"
              className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 font-display mb-1.5">セッション時間</div>
            <div className="flex gap-1.5">
              {MINUTES_OPTIONS.map(m => (
                <button
                  key={m} type="button" onClick={() => setMinutes(m)}
                  className={`flex-1 h-9 text-sm rounded-lg border font-semibold transition-colors ${
                    minutes === m
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                  }`}
                >
                  {m}分
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => void handleGenerate(false)}
            disabled={symptoms.length === 0 || generating}
            className="flex items-center gap-2 px-5 h-11 rounded-xl bg-[--color-navy] text-white text-sm
              font-bold font-display hover:opacity-90 transition-opacity disabled:opacity-40 shadow-sm"
          >
            {generating
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Sparkles className="w-4 h-4" />}
            AIでメニュー作成
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate(true)}
            disabled={symptoms.length === 0 || generating}
            className="flex items-center gap-1.5 px-3 h-11 rounded-xl border border-slate-200 text-xs
              text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40"
            title="AIを使わず、ルールベースの基本メニューを表示します"
          >
            <Wrench className="w-3.5 h-3.5" />基本メニュー
          </button>
        </div>
        {symptoms.length === 0 && (
          <p className="text-[11px] text-slate-400">今日の症状を1つ以上選ぶと作成できます。</p>
        )}
      </div>

      {/* 生成結果 */}
      {menu && session && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-slide-up">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-[--color-navy] font-display">{menu.title}</h2>
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                  menu.source === 'ai'
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {menu.source === 'ai' ? <><Bot className="w-3 h-3" />AI作成</> : <><Wrench className="w-3 h-3" />基本メニュー</>}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                  <Clock className="w-3 h-3" />計{totalMinutes}分
                </span>
              </div>
              {aiNote && <p className="text-[11px] text-amber-600 mt-1">{aiNote}</p>}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() =>
                  printMenu(patient.name ?? '患者', session.date, menu,
                    buildPatientNotice(session.input.flags, session.input.nrs))}
                className="flex items-center gap-1 px-3 h-8 rounded-lg border border-slate-200 text-xs
                  text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />印刷して渡す
              </button>
            </div>
          </div>

          {menu.redFlagWarning && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed whitespace-pre-line">{menu.redFlagWarning}</p>
            </div>
          )}

          <p className="text-sm text-slate-600 font-body">{menu.summary}</p>

          {/* メニュー項目 */}
          <ol className="space-y-2">
            {menu.items.map((item, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                <span className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center
                  justify-center text-xs font-bold text-slate-500 flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-800 font-display">{item.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${KIND_STYLES[item.kind]}`}>
                      {ITEM_KIND_LABELS[item.kind]}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums">{item.minutes}分</span>
                    {item.dose && <span className="text-[10px] text-teal-600">{item.dose}</span>}
                    {item.staffOnly && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200"
                        title="患者へ渡す印刷物には載りません">
                        スタッフ向け
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 whitespace-pre-line leading-relaxed">{item.steps}</p>
                  <p className="text-[11px] text-slate-400 mt-1">目的：{item.purpose}</p>
                  {item.caution && (
                    <p className="text-[11px] text-amber-600 mt-0.5">⚠ {item.caution}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3">
              <div className="text-xs font-bold text-teal-700 font-display mb-1">🏠 自宅ケア（患者さんへ）</div>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                {menu.homeAdvice.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3">
              <div className="text-xs font-bold text-amber-700 font-display mb-1">🚫 今日避けること</div>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                {menu.avoidToday.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          </div>

          {/* 実施後の記録 */}
          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <div className="text-xs font-bold text-slate-500 font-display mb-2">実施後の記録（任意）</div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                実施後のNRS
                <select
                  value={session.afterNrs ?? ''}
                  onChange={e => handleAfterUpdate({ afterNrs: e.target.value === '' ? null : Number(e.target.value) })}
                  className="h-8 px-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">—</option>
                  {Array.from({ length: 11 }, (_, i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </label>
              {session.afterNrs != null && session.afterNrs < session.input.nrs && (
                <span className="inline-flex items-center gap-1 text-xs text-teal-600 font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  {session.input.nrs} → {session.afterNrs}
                </span>
              )}
              <input
                type="text"
                value={session.afterNote}
                onChange={e => handleAfterUpdate({ afterNote: e.target.value })}
                placeholder="実施後の様子（例: 挙上が楽になった）"
                className="flex-1 min-w-[12rem] h-8 px-3 text-xs rounded-lg border border-slate-200
                  focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
            </div>
          </div>
        </div>
      )}

      {/* 過去の1dayリハ */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 font-display mb-3">
            <History className="w-3.5 h-3.5" />これまでの1dayリハ（{history.length}回）
          </div>
          <ul className="divide-y divide-slate-100">
            {history.map(s => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="text-xs text-slate-400 tabular-nums w-20 flex-shrink-0">{s.date}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-700 truncate">
                    {JOINT_LABELS[s.input.joint]}：{s.input.symptoms.map(k => SYMPTOM_LABELS[k]).join('・')}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    NRS {s.input.nrs}
                    {s.afterNrs != null && ` → ${s.afterNrs}`}
                    {s.afterNote && `｜${s.afterNote}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    printMenu(patient.name ?? '患者', s.date, s.menu,
                      buildPatientNotice(s.input.flags, s.input.nrs))}
                  className="p-1.5 rounded text-slate-300 hover:text-slate-600 transition-colors"
                  title="このメニューを印刷"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(s)}
                  className="p-1.5 rounded text-slate-300 hover:text-red-500 transition-colors"
                  title="削除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
