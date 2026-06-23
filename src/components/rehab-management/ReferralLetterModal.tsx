'use client'
// ──────────────────────────────────────────────
// 紹介状・報告書 作成モーダル
// ──────────────────────────────────────────────
import { useState, useRef } from 'react'
import type { Patient, Intake, SOAPNote } from '@/types/patient'
import { X, Printer, Sparkles, AlertCircle, FileText, ClipboardList } from 'lucide-react'

interface Props {
  patient: Patient
  intakes: Intake[]
  soapNotes: SOAPNote[]
  selectedIntake?: Intake
  selectedSoap?: SOAPNote
  onClose: () => void
}

type LetterType = 'referral' | 'report' | 'patient'

interface Destination {
  institution: string
  department: string
  doctor: string
}

interface LetterContent {
  diagnosis: string
  onset: string
  symptoms: string
  course: string
  recommendedFrequency: string
}

// 西暦→令和変換
function toReiwa(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date()
  const reiwaStart = new Date('2019-05-01')
  if (date >= reiwaStart) {
    const y = date.getFullYear() - 2018
    return `令和${y}年${date.getMonth() + 1}月${date.getDate()}日`
  }
  const y = date.getFullYear() - 1988
  return `平成${y}年${date.getMonth() + 1}月${date.getDate()}日`
}

// ── 紹介状プレビュー ─────────────────────────────────────────
function ReferralPreview({
  patient, destination, content,
}: {
  patient: Patient
  destination: Destination
  content: LetterContent
}) {
  const today = toReiwa()
  return (
    <div className="font-serif text-sm leading-relaxed text-gray-900 space-y-5">
      {/* 件名 */}
      <h2 className="text-center text-xl tracking-[0.4em] font-bold mt-2">御　紹　介　書</h2>

      {/* 宛先 */}
      <div className="mt-6 space-y-0.5">
        <p>{destination.institution || '　（医療機関名）'}　{destination.department || '　（科名）'}</p>
        <p>{destination.doctor || '　（医師名）'}　先生　御侍史</p>
      </div>

      {/* 挨拶 */}
      <div className="mt-4 space-y-1">
        <p>　　拝啓益々ご健勝の段お慶び申し上げます。</p>
        <p>この度患者　<strong>{patient.name}</strong> 殿の御紹介申し上げます。</p>
      </div>

      {/* 記 */}
      <div className="text-center py-1">
        <span className="tracking-widest">記</span>
      </div>

      {/* 傷病名 */}
      <div>
        <span className="inline-block w-40">　傷病名　　　：</span>
        <span className="whitespace-pre-wrap">{content.diagnosis || '（診断名）'}</span>
      </div>

      {/* 発症経緯 */}
      {content.onset && (
        <div className="mt-4">
          <p className="whitespace-pre-wrap">　{content.onset}</p>
        </div>
      )}

      {/* 症状 */}
      {content.symptoms && (
        <div>
          <span className="inline-block w-40">　症　　　状　：</span>
          <span className="whitespace-pre-wrap">{content.symptoms}</span>
        </div>
      )}

      {/* 経過 */}
      {content.course && (
        <div>
          <span className="inline-block w-40">　経　　　過　：</span>
          <span className="whitespace-pre-wrap">{content.course}</span>
        </div>
      )}

      {/* フッター */}
      <div className="mt-8 pt-4 border-t border-gray-300 text-sm space-y-0.5">
        <p>{today}</p>
        <div className="mt-2">
          <p>所在地　〒７５０－００７５</p>
          <p>　　　　山口県下関市彦島江の浦町９－１－１４</p>
          <p>施術所名称　ゆうき整骨院</p>
          <p>柔道整復師名　西山　勇来　<span className="text-base">㊞</span></p>
          <p>T E L　０８３－２６５－４５４５</p>
        </div>
      </div>
    </div>
  )
}

// ── 報告書プレビュー ─────────────────────────────────────────
function ReportPreview({
  patient, destination, content,
}: {
  patient: Patient
  destination: Destination
  content: LetterContent
}) {
  const today = toReiwa()
  return (
    <div className="font-serif text-sm leading-relaxed text-gray-900 space-y-5">
      {/* 件名 */}
      <h2 className="text-center text-xl tracking-[0.3em] font-bold mt-2">御　報　告　書</h2>

      {/* 宛先 */}
      <div className="mt-6 space-y-0.5">
        <p>{destination.institution || '　（医療機関名）'}　{destination.department || '　（科名）'}</p>
        <p>{destination.doctor || '　（医師名）'}　先生御侍史</p>
      </div>

      {/* 挨拶 */}
      <div className="mt-4 space-y-1">
        <p>　　ご紹介頂きました患者　<strong>{patient.name}</strong> 殿について下記の如く</p>
        <p>ご報告申し上げます。</p>
      </div>

      {/* 記 */}
      <div className="text-center py-1">
        <span className="tracking-widest">記</span>
      </div>

      {/* 傷病名 */}
      <div>
        <span className="inline-block w-36">　傷病名　：</span>
        <span className="whitespace-pre-wrap">{content.diagnosis || '（診断名）'}</span>
      </div>

      {/* 経過 */}
      {content.course && (
        <div>
          <div>
            <span className="inline-block w-40">　　経　過　：</span>
          </div>
          <p className="whitespace-pre-wrap mt-2 ml-8">{content.course}</p>
        </div>
      )}

      {/* フッター */}
      <div className="mt-8 pt-4 border-t border-gray-300 text-sm space-y-0.5">
        <p className="text-right mr-16">{today}</p>
        <div className="mt-2">
          <p>所在地　〒７５０－００７５</p>
          <p>　　　　山口県下関市彦島江の浦町９－１－１４</p>
          <p>施術所名所　ゆうき整骨院</p>
          <p>柔道整復師名　西山　　勇来　<span className="text-base">㊞</span></p>
          <p>T E L　０８３－２６５－４５４５</p>
        </div>
      </div>
    </div>
  )
}

// ── 患者向け説明書プレビュー ─────────────────────────────────
function PatientLetterPreview({
  patient, content,
}: {
  patient: Patient
  content: LetterContent
}) {
  const today = toReiwa()
  return (
    <div className="font-serif text-sm leading-relaxed text-gray-900 space-y-5">
      <h2 className="text-center text-xl tracking-[0.3em] font-bold mt-2">治　療　説　明　書</h2>
      <div className="mt-4 text-right text-sm">{today}</div>
      <div className="border-b border-gray-300 pb-3">
        <p>{patient.name} 様</p>
      </div>
      {content.diagnosis && (
        <div>
          <span className="inline-block w-32 font-semibold">　傷病名　：</span>
          <span>{content.diagnosis}</span>
        </div>
      )}
      {content.symptoms && (
        <div>
          <p className="font-semibold mb-1">　現在の状態</p>
          <p className="ml-4 whitespace-pre-wrap">{content.symptoms}</p>
        </div>
      )}
      {content.course && (
        <div>
          <p className="font-semibold mb-1">　今後の見通し</p>
          <p className="ml-4 whitespace-pre-wrap">{content.course}</p>
        </div>
      )}
      {content.recommendedFrequency && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
          <p className="font-semibold text-teal-800 mb-1">　治療頻度の目安</p>
          <p className="ml-4 whitespace-pre-wrap text-teal-900">{content.recommendedFrequency}</p>
        </div>
      )}
      <div className="mt-8 pt-4 border-t border-gray-300 text-sm space-y-0.5">
        <p>所在地　〒７５０－００７５</p>
        <p>　　　　山口県下関市彦島江の浦町９－１－１４</p>
        <p>施術所名称　ゆうき整骨院</p>
        <p>柔道整復師名　西山　勇来</p>
        <p>T E L　０８３－２６５－４５４５</p>
      </div>
    </div>
  )
}

// ── メインモーダル ───────────────────────────────────────────
export default function ReferralLetterModal({ patient, intakes, soapNotes, selectedIntake, selectedSoap, onClose }: Props) {
  // selectedIntake が指定されていればそれを優先、なければ最新の問診票
  const primaryIntake = selectedIntake ?? intakes[0] ?? null
  // selectedSoap が指定されていれば先頭に移動し、AIが優先参照しやすくする
  const orderedSoaps = selectedSoap
    ? [selectedSoap, ...soapNotes.filter(s => s.id !== selectedSoap.id)]
    : soapNotes
  const [letterType, setLetterType] = useState<LetterType>('referral')
  const [destination, setDestination] = useState<Destination>({
    institution: '', department: '', doctor: '',
  })
  const [content, setContent] = useState<LetterContent>({
    diagnosis: patient.diagnosisLabel ?? '',
    onset: '',
    symptoms: '',
    course: '',
    recommendedFrequency: '',
  })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/referral-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: letterType,
          patient: {
            name: patient.name,
            diagnosis: patient.diagnosisLabel,
            bodyRegion: patient.bodyRegion,
          },
          destination,
          latestIntake: primaryIntake,
          soapNotes: orderedSoaps.slice(0, 10),
          selectedSoapDate: selectedSoap?.visitDate,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setContent(prev => ({ ...prev, ...data.content }))
      setGenerated(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  function handlePrint() {
    const printWindow = window.open('', '_blank')
    if (!printWindow || !printRef.current) return
    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${letterType === 'referral' ? '御紹介書' : '御報告書'} - ${patient.name}</title>
  <style>
    @page { margin: 20mm 25mm; }
    body { font-family: 'MS Mincho', 'Yu Mincho', serif; font-size: 12pt; line-height: 1.8; color: #000; }
    h2 { text-align: center; font-size: 16pt; letter-spacing: 0.4em; margin-bottom: 24pt; }
    .footer { margin-top: 40pt; border-top: 1px solid #000; padding-top: 8pt; font-size: 10pt; }
    strong { font-weight: bold; }
    pre, .pre { white-space: pre-wrap; font-family: inherit; }
  </style>
</head>
<body>
${printRef.current.innerHTML}
</body>
</html>`
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }

  const INPUT_CLS = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400'
  const TA_CLS = `${INPUT_CLS} resize-y min-h-[80px]`

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[96vh] overflow-hidden flex flex-col">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-teal-700" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">紹介状・報告書の作成</h3>
              <p className="text-xs text-gray-500">{patient.name} 殿</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* ── 左パネル（入力） ── */}
          <div className="w-80 flex-shrink-0 border-r border-gray-100 overflow-y-auto p-5 space-y-5">

            {/* 文書種別 */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">文書種別</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { type: 'referral' as const, icon: <ClipboardList className="w-4 h-4" />, label: '紹介状' },
                  { type: 'report' as const, icon: <FileText className="w-4 h-4" />, label: '報告書' },
                  { type: 'patient' as const, icon: <span className="text-sm">👤</span>, label: '患者説明書' },
                ] as const).map(opt => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setLetterType(opt.type)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                      letterType === opt.type
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-gray-200 text-gray-600 hover:border-teal-300'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 宛先情報（紹介状・報告書のみ） */}
            {letterType !== 'patient' && <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-600">宛先情報</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">医療機関名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={destination.institution}
                  onChange={e => setDestination(d => ({ ...d, institution: e.target.value }))}
                  placeholder="例：産業医科大学若松病院"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">診療科</label>
                <input
                  type="text"
                  value={destination.department}
                  onChange={e => setDestination(d => ({ ...d, department: e.target.value }))}
                  placeholder="例：整形外科"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">担当医師名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={destination.doctor}
                  onChange={e => setDestination(d => ({ ...d, doctor: e.target.value }))}
                  placeholder="例：内田　宗志"
                  className={INPUT_CLS}
                />
              </div>
            </div>}

            {/* データソース確認 */}
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-600">使用するデータ</p>
              <p>・問診票：{primaryIntake
                ? <span className="text-teal-700 font-medium">{primaryIntake.intakeDate}{selectedIntake ? '（指定）' : '（最新）'}</span>
                : 'なし'
              }</p>
              <p>・SOAPカルテ：{soapNotes.length}件
                {selectedSoap && (
                  <span className="ml-1 text-teal-700 font-medium">（{selectedSoap.visitDate} を優先参照）</span>
                )}
              </p>
            </div>

            {/* AI生成ボタン */}
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || (letterType !== 'patient' && (!destination.institution || !destination.doctor))}
              className="w-full py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  AI生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AIで文章を生成
                </>
              )}
            </button>
            {letterType !== 'patient' && (!destination.institution || !destination.doctor) ? (
              <p className="text-xs text-gray-400 -mt-3">医療機関名と医師名を入力してください</p>
            ) : null}
          </div>

          {/* ── 右パネル（編集＋プレビュー） ── */}
          <div className="flex-1 overflow-y-auto">
            {/* 手動編集エリア */}
            <div className="p-5 border-b border-gray-100 space-y-4">
              <p className="text-xs font-semibold text-gray-600">内容の確認・編集</p>

              <div>
                <label className="block text-xs text-gray-500 mb-1">傷病名</label>
                <input
                  type="text"
                  value={content.diagnosis}
                  onChange={e => setContent(c => ({ ...c, diagnosis: e.target.value }))}
                  placeholder="例：左股関節唇損傷の疑い"
                  className={INPUT_CLS}
                />
              </div>

              {letterType === 'referral' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">発症経緯</label>
                    <textarea
                      value={content.onset}
                      onChange={e => setContent(c => ({ ...c, onset: e.target.value }))}
                      placeholder="発症時期・きっかけ・来院経緯など"
                      className={TA_CLS}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">症状（身体所見）</label>
                    <textarea
                      value={content.symptoms}
                      onChange={e => setContent(c => ({ ...c, symptoms: e.target.value }))}
                      placeholder="主訴・理学所見・スペシャルテスト結果など"
                      className={TA_CLS}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {letterType === 'referral' ? '経過（紹介理由）' : letterType === 'report' ? '経過（治療経過の報告）' : '今後の見通し'}
                </label>
                <textarea
                  value={content.course}
                  onChange={e => setContent(c => ({ ...c, course: e.target.value }))}
                  placeholder={letterType === 'referral'
                    ? '治療経過と専門的診察が必要な理由など'
                    : letterType === 'report'
                    ? '当院での施術内容・経過・患者さんの状態など'
                    : '今後の経過見通しや注意事項など'
                  }
                  className={`${TA_CLS} min-h-[120px]`}
                />
              </div>

              {letterType === 'patient' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">治療頻度の目安</label>
                  <textarea
                    value={content.recommendedFrequency}
                    onChange={e => setContent(c => ({ ...c, recommendedFrequency: e.target.value }))}
                    placeholder="例：最初の2週間は週2〜3回のご来院をお勧めします。痛みが落ち着いたら週1回程度に移行します。"
                    className={TA_CLS}
                  />
                </div>
              )}

            </div>

            {/* プレビュー */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-600">プレビュー</p>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!generated && !content.course}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  印刷・PDF保存
                </button>
              </div>

              {/* 印刷対象エリア */}
              <div
                ref={printRef}
                className="bg-white border border-gray-200 rounded-xl p-8 min-h-[400px] shadow-sm"
              >
                {letterType === 'referral' ? (
                  <ReferralPreview patient={patient} destination={destination} content={content} />
                ) : letterType === 'report' ? (
                  <ReportPreview patient={patient} destination={destination} content={content} />
                ) : (
                  <PatientLetterPreview patient={patient} content={content} />
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2 text-right">
                「印刷・PDF保存」でブラウザの印刷ダイアログが開きます
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
