'use client'
// ──────────────────────────────────────────────
// 疾患ライブラリ - 疾患詳細ページ
// 表示レベル（基本/専門/研究）・患者説明モード・確実性/確認状態ラベル対応。
// ──────────────────────────────────────────────
import { useState, useMemo, useEffect, use } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, ShieldAlert, BookMarked, ClipboardCopy, ClipboardCheck,
  FileText, Users, AlertTriangle, ChevronDown, Route, ExternalLink,
} from 'lucide-react'
import type {
  ContentBlock, DisplayLevel, DifferentialGroup,
} from '@/types/disease'
import {
  DISEASE_CATEGORY_LABELS, CERTAINTY_LABELS, REVIEW_STATUS_LABELS, URGENCY_LABELS,
} from '@/types/disease'
import { getDiseasePage, getReview, type DiseaseReview } from '@/lib/disease-store'
import { buildExternalRefs } from '@/data/diseases/external-refs'
import AnatomyDiagram from '@/components/disease/AnatomyDiagram'
import AppIllustration from '@/components/AppIllustration'
import PatientIllustrationGuide, { getDiseasePatientIllustrations } from '@/components/disease/PatientIllustrationGuide'
import { slotForDisease } from '@/lib/illustrations'

// ── 確実性・確認状態のラベルチップ ──
function CertaintyChip({ certainty }: { certainty?: ContentBlock['certainty'] }) {
  if (!certainty) return null
  const style = certainty === 'high' ? 'bg-teal-50 text-teal-700 border-teal-200'
    : certainty === 'moderate' ? 'bg-sky-50 text-sky-700 border-sky-200'
    : certainty === 'divided' ? 'bg-violet-50 text-violet-700 border-violet-200'
    : certainty === 'expert' ? 'bg-slate-50 text-slate-600 border-slate-200'
    : 'bg-amber-50 text-amber-700 border-amber-200'
  return (
    <span className={`inline-block text-[9px] font-semibold border rounded px-1 py-px align-middle ${style}`}>
      {CERTAINTY_LABELS[certainty]}
    </span>
  )
}

function StatusChip({ status }: { status?: ContentBlock['status'] }) {
  if (!status || status === 'verified') return null
  return (
    <span className="inline-block text-[9px] font-semibold border border-orange-200 bg-orange-50
      text-orange-700 rounded px-1 py-px align-middle">
      {REVIEW_STATUS_LABELS[status]}
    </span>
  )
}

// ── 本文ブロックのレンダリング（表示レベルでフィルタ） ──
function Blocks({ blocks, level }: { blocks: ContentBlock[]; level: DisplayLevel }) {
  const visible = blocks.filter(b => {
    const bl = b.level ?? 'basic'
    if (level === 'basic') return bl === 'basic'
    if (level === 'pro') return bl !== 'research'
    return true
  })
  if (visible.length === 0) {
    return <p className="text-xs text-slate-400">この表示レベルでは記載がありません（表示レベルを上げてください）</p>
  }
  return (
    <ul className="space-y-2">
      {visible.map((b, i) => (
        <li key={i} className="text-sm text-slate-700 leading-relaxed">
          {b.text}
          {b.refs && b.refs.length > 0 && (
            <sup className="text-[--color-primary] ml-0.5">
              {b.refs.map(r => `[${r + 1}]`).join('')}
            </sup>
          )}
          <span className="ml-1.5 space-x-1">
            <CertaintyChip certainty={b.certainty} />
            <StatusChip status={b.status} />
          </span>
        </li>
      ))}
    </ul>
  )
}

// ── 折りたたみセクション ──
function Section({ title, defaultOpen, children }: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details open={defaultOpen} className="group bg-white rounded-2xl border border-slate-200 shadow-sm">
      <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none
        hover:bg-slate-50/60 rounded-2xl transition-colors list-none [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-bold text-[--color-text-primary] font-display">{title}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5 pt-1 border-t border-slate-100">{children}</div>
    </details>
  )
}

const DIFF_GROUP_LABELS: Record<DifferentialGroup, { label: string; style: string }> = {
  likely:        { label: '可能性が高いもの',       style: 'text-sky-700 bg-sky-50 border-sky-200' },
  must_not_miss: { label: '見逃してはいけないもの', style: 'text-red-700 bg-red-50 border-red-200' },
  similar:       { label: '類似症状を示すもの',     style: 'text-slate-600 bg-slate-50 border-slate-200' },
}

export default function DiseaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const page = getDiseasePage(id)
  const [level, setLevel] = useState<DisplayLevel>('pro')
  const [patientMode, setPatientMode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [review, setReview] = useState<DiseaseReview | undefined>(undefined)

  // 監修記録（localStorageオーバーレイ）の読み込み
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReview(getReview(id))
  }, [id])

  const urgencyStyle = useMemo(() => ({
    emergency:  'bg-red-600 text-white',
    same_day:   'bg-red-50 text-red-700 border border-red-200',
    early_visit:'bg-amber-50 text-amber-700 border border-amber-200',
    observe:    'bg-slate-50 text-slate-600 border border-slate-200',
    confirm_md: 'bg-sky-50 text-sky-700 border border-sky-200',
  }), [])

  if (!page) notFound()

  function copyInterview() {
    const text = `【${page!.names.ja} 問診チェックリスト】\n` +
      page!.interviewItems.map(i => `□ ${i}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div className="max-w-3xl mx-auto font-body space-y-4 pb-10">
      {/* パンくず・戻る */}
      <Link href="/diseases" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[--color-text-primary] transition-colors">
        <ArrowLeft className="w-4 h-4" />疾患ライブラリ
      </Link>

      {/* 医療安全表示（常時） */}
      <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 leading-relaxed">
        <ShieldAlert className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <span>
          本ページは臨床判断を補助する参考情報です。すべての患者に適用できるものではなく、
          担当医の個別指示を本ページの内容より優先してください。緊急所見がある場合は受診を優先してください。
        </span>
      </div>

      {/* ヘッダー */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-bold text-[--color-primary] bg-[--color-primary-light] rounded-full px-2 py-0.5 font-display">
                {DISEASE_CATEGORY_LABELS[page.category]}
              </span>
              {/* 監修状態: 静的データまたは監修記録（管理画面で登録）があれば監修済み表示 */}
              {(review?.supervisor || page.meta.supervisor) ? (
                <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">
                  医療監修: {review?.supervisor ?? page.meta.supervisor}
                  {review?.reviewedAt && `（${review.reviewedAt}）`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                  <AlertTriangle className="w-3 h-3" />医師監修前の下書き（AI作成・文献未確認を含む）
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-[--color-text-primary] font-display leading-tight">
              {page.names.ja}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {page.names.en}
              {page.names.abbreviations.length > 0 && ` ／ ${page.names.abbreviations.join('・')}`}
            </p>
            {page.names.note && (
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{page.names.note}</p>
            )}
          </div>
        </div>

        {/* メタ情報 */}
        <div className="flex items-center gap-4 flex-wrap mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
          <span>最終更新 {page.meta.updatedAt}</span>
          <span>次回見直し {page.meta.nextReviewDue}</span>
          <span>作成: {page.meta.author}</span>
          {page.meta.searchDate ? <span>文献検索日 {page.meta.searchDate}</span> : <span className="text-orange-500">文献検索日 未実施</span>}
        </div>

        {/* モード・レベル切替 + 連携 */}
        <div className="flex items-center justify-between gap-3 flex-wrap mt-4">
          <div className="flex items-center gap-2">
            {/* 患者説明モード */}
            <button
              onClick={() => setPatientMode(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors font-display ${
                patientMode
                  ? 'bg-[--color-primary] text-white border-[--color-primary]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />患者説明モード
            </button>
            {/* 表示レベル */}
            {!patientMode && (
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {([['basic', '基本'], ['pro', '専門'], ['research', '研究']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setLevel(key)}
                    className={`text-xs px-3 py-2 font-semibold transition-colors ${
                      level === key ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyInterview}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border
                border-slate-200 px-3 py-2 rounded-lg hover:border-teal-300 transition-colors font-display"
              title="問診チェックリストをコピーしてカルテに貼り付けられます"
            >
              {copied ? <ClipboardCheck className="w-3.5 h-3.5 text-teal-600" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
              {copied ? 'コピーしました' : '問診をコピー'}
            </button>
            {page.protocolTemplateKey && (
              <Link
                href={`/protocols/new?diagnosis=${encodeURIComponent(page.names.ja)}&joint=${page.protocolJoint ?? ''}`}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-[--color-primary]
                  px-3 py-2 rounded-lg hover:bg-[--color-primary-hover] transition-colors font-display"
                title="確認フォームを経てプロトコルの下書きを作成します（自動確定はされません）"
              >
                <Route className="w-3.5 h-3.5" />プロトコル下書きを作成
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 患者説明モード ═══ */}
      {patientMode ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-[--color-text-primary] font-display mb-2">このけがについて</h2>
            <div className="sm:flex sm:items-start sm:gap-4">
              <p className="text-sm text-slate-700 leading-relaxed flex-1">{page.patientExplanation.whatIs}</p>
              {/* 症例に応じたイラスト。「回復の流れ」ガイドがある疾患では重複を避けて非表示 */}
              {getDiseasePatientIllustrations(page.id).length === 0 && (
                <AppIllustration
                  slot={slotForDisease(page.names.ja, page.category)}
                  alt={`${page.names.ja}の説明イラスト`}
                  className="h-32 w-auto rounded-xl mx-auto mt-3 sm:mt-0 sm:mx-0 flex-shrink-0"
                />
              )}
            </div>
          </div>
          {/* 疾患ID別の「イラストで見る回復の流れ」（対応疾患のみ表示） */}
          <PatientIllustrationGuide diseaseId={page.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-teal-50/50 rounded-2xl border border-teal-100 p-5">
              <h3 className="text-xs font-bold text-teal-800 font-display mb-2">してよいこと</h3>
              <ul className="space-y-1.5">
                {page.patientExplanation.dos.map((d, i) => (
                  <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-teal-500">○</span>{d}</li>
                ))}
              </ul>
            </div>
            <div className="bg-amber-50/50 rounded-2xl border border-amber-100 p-5">
              <h3 className="text-xs font-bold text-amber-800 font-display mb-2">避けること</h3>
              <ul className="space-y-1.5">
                {page.patientExplanation.donts.map((d, i) => (
                  <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-amber-500">×</span>{d}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="bg-red-50/50 rounded-2xl border border-red-100 p-5">
            <h3 className="text-xs font-bold text-red-800 font-display mb-2">こんなときは受診してください</h3>
            <ul className="space-y-1.5">
              {page.patientExplanation.seekCare.map((s, i) => (
                <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-red-400">!</span>{s}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-xs font-bold text-[--color-text-primary] font-display mb-2">回復にむけて</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{page.patientExplanation.goal}</p>
          </div>
        </div>
      ) : (
        /* ═══ 専門職向け表示 ═══ */
        <div className="space-y-3">
          <Section title="概要" defaultOpen>
            <Blocks blocks={page.overview} level={level} />
          </Section>

          {/* レッドフラッグ（常時目立つ位置） */}
          <div className="bg-white rounded-2xl border-2 border-red-200 shadow-sm">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-red-100">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span className="text-sm font-bold text-red-700 font-display">レッドフラッグ（緊急対応が優先される所見）</span>
            </div>
            <div className="p-4 space-y-2">
              {page.redFlags.map((rf, i) => (
                <div key={i} className="flex items-start gap-3 bg-red-50/40 rounded-lg px-3.5 py-2.5">
                  <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 flex-shrink-0 mt-0.5 ${urgencyStyle[rf.urgency]}`}>
                    {URGENCY_LABELS[rf.urgency]}
                  </span>
                  <div className="text-sm">
                    <span className="font-semibold text-slate-800">{rf.finding}</span>
                    <span className="block text-xs text-slate-600 mt-0.5">{rf.action}</span>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-red-600 pt-1">
                該当する場合はリハビリの継続より、医師への相談または受診を優先してください。
              </p>
            </div>
          </div>

          <Section title="解剖学">
            <AnatomyDiagram category={page.category} />
            <Blocks blocks={page.anatomy} level={level} />
          </Section>
          <Section title="疫学"><Blocks blocks={page.epidemiology} level={level} /></Section>
          <Section title="病態・発生機序"><Blocks blocks={page.mechanism} level={level} /></Section>
          <Section title="代表的な主訴"><Blocks blocks={page.symptoms} level={level} /></Section>

          <Section title="問診チェックリスト">
            <ul className="space-y-1.5 mb-3">
              {page.interviewItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="w-3.5 h-3.5 border border-slate-300 rounded flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={copyInterview}
              className="text-xs text-[--color-primary] font-semibold hover:underline"
            >
              チェックリストをコピーしてカルテへ貼り付け
            </button>
          </Section>

          <Section title="身体所見"><Blocks blocks={page.physicalExam} level={level} /></Section>

          <Section title="スペシャルテスト">
            <div className="space-y-3">
              {page.specialTests.map((t, i) => (
                <div key={i} className="border border-slate-100 rounded-xl p-4 bg-slate-50/40">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-sm font-bold text-[--color-text-primary] font-display">{t.name}</span>
                    <span className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">{t.target}</span>
                    <StatusChip status={t.status} />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{t.method}</p>
                  <p className="text-xs text-slate-700 mt-1"><span className="font-semibold">陽性:</span> {t.positive}</p>
                  {(t.sensitivity || t.specificity) && (
                    <p className="metric text-[11px] text-slate-500 mt-1">
                      感度 {t.sensitivity ?? '—'} ／ 特異度 {t.specificity ?? '—'}
                      {t.refs && <sup className="text-[--color-primary]">{t.refs.map(r => `[${r + 1}]`).join('')}</sup>}
                    </p>
                  )}
                  {t.caution && <p className="text-[11px] text-amber-700 mt-1">⚠ {t.caution}</p>}
                </div>
              ))}
              <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                感度・特異度は対象集団・診断基準により変動します。単一テストで診断を確定せず、
                問診・複数所見を組み合わせた臨床推論を行ってください。
              </p>
            </div>
          </Section>

          <Section title="鑑別疾患">
            <div className="space-y-4">
              {(['must_not_miss', 'likely', 'similar'] as DifferentialGroup[]).map(group => {
                const list = page.differentials.filter(d => d.group === group)
                if (list.length === 0) return null
                const g = DIFF_GROUP_LABELS[group]
                return (
                  <div key={group}>
                    <span className={`inline-block text-[10px] font-bold border rounded-full px-2 py-0.5 mb-2 ${g.style}`}>
                      {g.label}
                    </span>
                    <ul className="space-y-1.5">
                      {list.map((d, i) => (
                        <li key={i} className="text-sm text-slate-700">
                          <span className="font-semibold">{d.name}</span>
                          {d.urgency && (
                            <span className={`text-[9px] font-bold rounded-full px-1.5 py-px ml-1.5 ${urgencyStyle[d.urgency]}`}>
                              {URGENCY_LABELS[d.urgency]}
                            </span>
                          )}
                          <span className="block text-xs text-slate-500 mt-0.5">{d.distinguishing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title="画像検査"><Blocks blocks={page.imaging} level={level} /></Section>
          <Section title="重症度・分類"><Blocks blocks={page.classification} level={level} /></Section>
          <Section title="保存療法"><Blocks blocks={page.conservative} level={level} /></Section>
          <Section title="手術療法の概要">
            <Blocks blocks={page.surgical} level={level} />
            <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mt-3">
              手術適応・術式選択は医師が判断します。術後リハビリは術式・固定法・合併処置・医師の指示により異なるため、
              一般的なプロトコルを個別患者へそのまま適用しないでください。
            </p>
          </Section>

          <Section title="リハビリテーションの段階">
            <div className="space-y-3">
              {page.rehabPhases.map((ph, i) => (
                <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[--color-surface-raised]">
                    <span className="text-sm font-bold text-[--color-text-primary] font-display">
                      {i + 1}. {ph.name}
                    </span>
                    <span className="metric text-[10px] text-slate-400">{ph.period}</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="font-bold text-teal-700 mb-1">目標</div>
                      <ul className="space-y-0.5 text-slate-600">{ph.goals.map((g, j) => <li key={j}>· {g}</li>)}</ul>
                    </div>
                    <div>
                      <div className="font-bold text-sky-700 mb-1">実施可能</div>
                      <ul className="space-y-0.5 text-slate-600">{ph.allowed.map((a, j) => <li key={j}>· {a}</li>)}</ul>
                    </div>
                    <div>
                      <div className="font-bold text-amber-700 mb-1">避けるべき負荷</div>
                      <ul className="space-y-0.5 text-slate-600">{ph.avoid.map((a, j) => <li key={j}>· {a}</li>)}</ul>
                    </div>
                    <div>
                      <div className="font-bold text-slate-700 mb-1">次段階への移行基準</div>
                      <ul className="space-y-0.5 text-slate-600">{ph.criteria.map((c, j) => <li key={j}>· {c}</li>)}</ul>
                      {ph.mdCheck && (
                        <div className="mt-1.5 text-sky-700">医師確認: {ph.mdCheck}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                時間だけで進行を決定せず、症状・腫脹・可動域・筋力・動作能力・心理的準備を含む基準ベースで判断してください。
              </p>
            </div>
          </Section>

          <Section title="復帰基準"><Blocks blocks={page.returnCriteria} level={level} /></Section>
          <Section title="予後"><Blocks blocks={page.prognosis} level={level} /></Section>

          <Section title="患者報告アウトカム（PRO）">
            <div className="space-y-2">
              {page.outcomes.map((o, i) => (
                <div key={i} className="flex items-start gap-3 text-sm border-b border-slate-50 pb-2 last:border-0">
                  <span className="font-bold text-[--color-text-primary] font-display w-24 flex-shrink-0">{o.name}</span>
                  <div className="text-xs text-slate-600">
                    {o.target} ／ {o.range}
                    {o.note && <span className="block text-slate-400 mt-0.5">{o.note}</span>}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-slate-400">
                使用許諾が必要な尺度は全文を無断掲載せず、公式配布元を利用してください。
              </p>
            </div>
          </Section>

          <Section title="動作評価（モーションキャプチャー連携）">
            <div className="space-y-3">
              {page.motionCapture.map((m, i) => (
                <div key={i} className="border border-slate-100 rounded-xl p-4">
                  <div className="text-sm font-bold text-[--color-text-primary] font-display mb-1">{m.movement}</div>
                  <p className="text-xs text-slate-600">{m.purpose}</p>
                  <p className="text-[11px] text-slate-500 mt-1">撮影: {m.setup}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.watchFor.map((w, j) => (
                      <span key={j} className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 rounded-full px-2 py-0.5">{w}</span>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                2次元動画から得られる角度・数値は推定値であり、3次元動作解析装置と同等ではありません。
                関節角度のみで病態や損傷リスクを断定しないでください。
              </p>
            </div>
          </Section>

          <Section title="参考文献">
            <ol className="space-y-2">
              {page.references.map((r, i) => {
                const refVerified = r.verified || (review?.verifiedRefs.includes(i) ?? false)
                return (
                <li key={i} className="text-xs text-slate-600 leading-relaxed">
                  <span className="metric text-slate-400">[{i + 1}]</span>{' '}
                  {r.authors}. {r.title}. <i>{r.source}</i>. {r.year}.
                  {r.doi && <span className="metric"> doi:{r.doi}</span>}
                  {r.pmid && <span className="metric"> PMID:{r.pmid}</span>}
                  {refVerified ? (
                    <span className="text-[9px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded px-1 py-px ml-1.5">
                      原文確認済み
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded px-1 py-px ml-1.5">
                      原文未確認
                    </span>
                  )}
                  {r.note && <span className="block text-slate-400 mt-0.5">{r.note}</span>}
                </li>
              )})}
            </ol>
            <p className="text-[11px] text-orange-600 bg-orange-50 rounded-lg px-3 py-2 mt-3">
              「原文未確認」の文献は実在・内容の確認が完了していません。引用・院外提供の前に必ず原文を確認してください。
            </p>
          </Section>

          <Section title="外部参考リンク・画像">
            <div className="space-y-2">
              {buildExternalRefs(page).map((ref, i) => (
                <a
                  key={i}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5
                    hover:border-[--color-primary]/40 hover:shadow-sm transition-all group"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[--color-primary] flex-shrink-0 mt-0.5" />
                  <span className="min-w-0">
                    <span className="text-sm font-semibold text-[--color-text-primary] font-display">{ref.label}</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">{ref.note}</span>
                  </span>
                </a>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mt-3 leading-relaxed">
              上記は外部サイトの検索結果ページへのリンクです。表示される論文・画像の内容・正確性・
              著作権/ライセンスは本アプリでは保証していません。特に画像を院内資料等へ転用する際は、
              各画像のライセンス表示（CC-BY等）と出典表記の要否を必ずご確認ください。
            </p>
          </Section>

          {/* 更新管理 */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-600 mb-1">
              <FileText className="w-3.5 h-3.5" />更新管理
            </div>
            <p>作成日 {page.meta.createdAt} ／ 最終更新 {page.meta.updatedAt} ／ 次回見直し {page.meta.nextReviewDue}</p>
            <p>参照ガイドライン: {page.meta.guidelineVersions.join('、') || '—'}</p>
            {review?.supervisor && (
              <p className="text-teal-700">
                · {review.reviewedAt} 医療監修: {review.supervisor}
                {review.note && `（${review.note}）`}
              </p>
            )}
            {page.meta.changeLog.map((c, i) => <p key={i}>· {c}</p>)}
          </div>
        </div>
      )}
    </div>
  )
}
