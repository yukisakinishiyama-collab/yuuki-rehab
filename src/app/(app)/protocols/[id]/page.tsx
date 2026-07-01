'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Protocol, ProtocolPatient, ProtocolAttachment } from '@/types/protocol'
import {
  getProtocolById, getPatientById, updatePhase, advancePhase, deleteProtocol, updateProtocol,
  addAttachment, removeAttachment, updateAttachmentNote,
} from '@/lib/protocol-store'
import { getPatients as getPtPatients, saveRehabPlan } from '@/lib/patient-store'
import type { Patient as PtPatient } from '@/types/patient'
import PhaseCard from '@/components/protocol/PhaseCard'
import ExpertPanel from '@/components/protocol/ExpertPanel'
import DisclaimerBanner from '@/components/protocol/DisclaimerBanner'
import ProtocolSearchModal from '@/components/protocol/ProtocolSearchModal'
import {
  ArrowRight, ChevronRight, Printer, Trash2, User, MonitorPlay,
  BarChart2, MessageSquare, Cpu, FileText, AlertCircle, CheckCircle,
  BookOpen, Edit2, Plus, Paperclip, Eye, X, Upload, HelpCircle,
} from 'lucide-react'
import type { Phase } from '@/types/protocol'
import { nanoid } from 'nanoid'

type Tab = 'protocol' | 'discussion' | 'attachments'

export default function ProtocolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [patient, setPatient] = useState<ProtocolPatient | null>(null)
  const [tab, setTab] = useState<Tab>('protocol')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showReflectModal, setShowReflectModal] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [ptPatients, setPtPatients] = useState<PtPatient[]>([])
  const [selectedPtId, setSelectedPtId] = useState('')
  const [reflectDone, setReflectDone] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    const p = getProtocolById(id)
    if (!p) { router.replace('/protocols'); return }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProtocol(p)
    setPatient(getPatientById(p.patientId))
  }, [id, router])

  function handlePhaseUpdate(phaseId: string, updates: Partial<Phase>) {
    if (!protocol) return
    updatePhase(protocol.id, phaseId, updates)
    setProtocol(getProtocolById(protocol.id))
  }

  function handlePhaseDelete(phaseId: string) {
    if (!protocol) return
    if (protocol.phases.length <= 1) return
    const phases = protocol.phases.filter(ph => ph.id !== phaseId)
      .map((ph, i) => ({ ...ph, order: i + 1 }))
    const deletedIdx = protocol.phases.findIndex(ph => ph.id === phaseId)
    const newCurrentIdx = Math.min(protocol.currentPhaseIndex, phases.length - 1)
    const adjustment = deletedIdx <= protocol.currentPhaseIndex && protocol.currentPhaseIndex > 0 ? -1 : 0
    updateProtocol(protocol.id, { phases, currentPhaseIndex: Math.max(0, newCurrentIdx + adjustment) })
    setProtocol(getProtocolById(protocol.id))
  }

  function handleAddPhase() {
    if (!protocol) return
    const newPhase: Phase = {
      id: nanoid(),
      order: protocol.phases.length + 1,
      title: `フェーズ ${protocol.phases.length + 1}`,
      durationWeeks: '',
      goals: [],
      exercises: [],
      advanceCriteria: [],
      precautions: [],
      redFlags: [],
      outcomes: [],
      evidence: 'expert_opinion',
    }
    updateProtocol(protocol.id, { phases: [...protocol.phases, newPhase] })
    setProtocol(getProtocolById(protocol.id))
  }

  function handleTitleSave() {
    if (!protocol || !titleDraft.trim()) return
    updateProtocol(protocol.id, { title: titleDraft.trim() })
    setProtocol(getProtocolById(protocol.id))
    setEditingTitle(false)
  }

  function handleAdvancePhase() {
    if (!protocol) return
    if (protocol.currentPhaseIndex >= protocol.phases.length - 1) return
    advancePhase(protocol.id)
    setProtocol(getProtocolById(protocol.id))
  }

  function handleDelete() {
    if (!protocol) return
    deleteProtocol(protocol.id)
    router.replace('/protocols')
  }

  function handleOpenReflect() {
    setPtPatients(getPtPatients())
    setSelectedPtId('')
    setReflectDone(false)
    setShowReflectModal(true)
  }

  function handleReflect() {
    if (!protocol || !selectedPtId) return
    const now = new Date().toISOString()
    // プロトコルの各フェーズをRehabPlanとして登録
    protocol.phases.forEach((ph, i) => {
      const phaseNum = Math.min(i + 1, 6) as 1|2|3|4|5|6
      saveRehabPlan({
        id: nanoid(),
        patientId: selectedPtId,
        phase: phaseNum,
        mainProblem: ph.title,
        shortTermGoal: ph.goals[0] ?? '',
        midTermGoal: ph.goals[1] ?? '',
        longTermGoal: ph.goals.slice(2).join('、') ?? '',
        recommendedFrequency: ph.exercises.map(e => e.name + (e.dose ? `（${e.dose}）` : '')).join('、'),
        precautions: ph.advanceCriteria.map(c => c.label).join('、'),
        createdAt: now,
        updatedAt: now,
      })
    })
    setReflectDone(true)
  }

  if (!protocol || !patient) {
    return (
      <div className="flex items-center justify-center h-64 text-[--color-text-muted] font-body">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <div className="text-sm">読み込み中...</div>
        </div>
      </div>
    )
  }

  const currentPhase = protocol.phases[protocol.currentPhaseIndex]
  const allCriteriaMet = currentPhase?.advanceCriteria.every(c => c.met) ?? false
  const canAdvance = allCriteriaMet && protocol.currentPhaseIndex < protocol.phases.length - 1
  const isComplete = allCriteriaMet && protocol.currentPhaseIndex === protocol.phases.length - 1

  return (
    <div className="max-w-4xl mx-auto font-body">
      {/* 免責（印刷時は表示） */}
      <div className="no-print mb-2">
        <DisclaimerBanner compact />
      </div>

      {/* パンくず + アクションヘッダー */}
      <div className="flex items-start justify-between mb-5 mt-1 animate-slide-up">
        <div className="min-w-0 flex-1 mr-4">
          <div className="flex items-center gap-2 text-xs text-[--color-text-muted] mb-2 font-body">
            <Link href="/protocols" className="hover:text-[--color-primary] transition-colors">
              プロトコル一覧
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="truncate max-w-[200px]">{protocol.title}</span>
          </div>
          {editingTitle ? (
            <div className="flex items-center gap-2 mb-1.5">
              <input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false) }}
                autoFocus
                className="text-xl font-bold font-display border-b-2 border-[--color-primary] bg-transparent
                  focus:outline-none text-[--color-text-primary] flex-1 min-w-0"
              />
              <button onClick={handleTitleSave}
                className="text-xs font-semibold text-white bg-[--color-primary] px-3 py-1 rounded-lg hover:bg-[--color-primary-hover] transition-colors">
                保存
              </button>
              <button onClick={() => setEditingTitle(false)}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
                取消
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1.5 group">
              <h1 className="text-xl font-bold text-[--color-text-primary] font-display leading-tight">
                {protocol.title}
              </h1>
              <button
                onClick={() => { setTitleDraft(protocol.title); setEditingTitle(true) }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                title="タイトルを編集"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm text-[--color-text-secondary] font-body">
              <User className="w-3.5 h-3.5" />
              {patient.name ?? '匿名患者'}
              {patient.age && <span className="metric">· {patient.age}歳</span>}
            </span>
            {protocol.generatedBy === 'ai' && (
              <span className="inline-flex items-center gap-1 text-xs text-purple-700
                bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full font-display font-semibold">
                <Cpu className="w-3 h-3" />AI生成 · 要臨床確認
              </span>
            )}
            {protocol.generatedBy === 'template' && (
              <span className="inline-flex items-center gap-1 text-xs text-[--color-primary]
                bg-[--color-primary-light] px-2 py-0.5 rounded-full font-display font-semibold">
                <FileText className="w-3 h-3" />テンプレート
              </span>
            )}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2 no-print flex-shrink-0">
          <button
            onClick={handleOpenReflect}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-teal-200
              bg-teal-50 hover:bg-teal-100 transition-colors text-sm text-teal-700 font-semibold font-display"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">カルテへ反映</span>
          </button>
          <button
            onClick={() => window.print()}
            title="印刷"
            className="p-2.5 rounded-xl border border-slate-200 bg-[--color-surface-card]
              hover:bg-[--color-surface-raised] transition-colors text-slate-500 hover:text-slate-700"
          >
            <Printer className="w-4 h-4" />
          </button>
          <Link
            href={`/protocols/${id}/patient-view`}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200
              bg-[--color-surface-card] hover:bg-[--color-surface-raised] transition-colors
              text-sm text-slate-600 font-body"
          >
            <MonitorPlay className="w-3.5 h-3.5 text-[--color-primary]" />
            <span className="hidden sm:inline">患者提示</span>
          </Link>
          <Link
            href={`/protocols/${id}/progress`}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[--color-primary]
              text-white hover:bg-[--color-primary-hover] transition-colors text-sm font-semibold font-display shadow-sm"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">進捗管理</span>
          </Link>
        </div>
      </div>

      {/* フェーズジャーニーカード */}
      <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 mb-4 shadow-sm animate-slide-up delay-75">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold text-[--color-text-secondary] font-display uppercase tracking-widest">
            フェーズ進行状況
          </div>
          <div className="metric text-xs text-[--color-text-muted] font-semibold">
            {protocol.currentPhaseIndex + 1} / {protocol.phases.length} フェーズ
          </div>
        </div>

        {/* ジャーニーステッパー */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {protocol.phases.map((ph, i) => {
            const done   = i < protocol.currentPhaseIndex
            const active = i === protocol.currentPhaseIndex
            return (
              <div key={ph.id} className="flex items-center gap-1 flex-shrink-0">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                  font-semibold font-display transition-all duration-300 ${
                  done   ? 'bg-emerald-500 text-white' :
                  active ? 'bg-[--color-primary] text-white shadow-[0_0_0_3px_rgba(13,148,136,0.2)]' :
                           'bg-[--color-surface-raised] text-[--color-text-muted] border border-slate-200'
                }`}>
                  {done ? <CheckCircle className="w-3 h-3" /> : (
                    <span className="metric">{ph.order}</span>
                  )}
                  <span className="hidden sm:inline">{ph.title}</span>
                </div>
                {i < protocol.phases.length - 1 && (
                  <ArrowRight className={`w-3 h-3 flex-shrink-0 ${
                    done ? 'text-emerald-400' : 'text-slate-300'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        {/* フェーズ進行ボタン */}
        {canAdvance && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={handleAdvancePhase}
              className="w-full flex items-center justify-center gap-2
                bg-gradient-to-r from-[--color-primary] to-teal-500 text-white
                py-3 rounded-xl text-sm font-bold font-display
                hover:opacity-90 transition-opacity shadow-sm"
            >
              <ArrowRight className="w-4 h-4" />
              次フェーズへ進む：{protocol.phases[protocol.currentPhaseIndex + 1]?.title}
            </button>
          </div>
        )}
        {isComplete && (
          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <span className="inline-flex items-center gap-2 text-sm text-emerald-600 font-bold font-display
              bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
              <CheckCircle className="w-4 h-4" />全フェーズ完了
            </span>
          </div>
        )}
      </div>

      {/* タブ */}
      <div className="flex border-b border-slate-200 mb-5 no-print animate-slide-up delay-150">
        {([
          { key: 'protocol' as const, label: 'プロトコル', icon: FileText, badge: undefined as number | undefined },
          { key: 'discussion' as const, label: '専門家ディスカッション', icon: MessageSquare, badge: undefined as number | undefined },
          {
            key: 'attachments' as const,
            label: '添付資料',
            icon: Paperclip,
            badge: (protocol.attachments?.length ?? 0) || undefined,
          },
        ]).map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold
              border-b-2 transition-all duration-200 font-display ${
              tab === key
                ? 'border-[--color-primary] text-[--color-primary]'
                : 'border-transparent text-[--color-text-muted] hover:text-[--color-text-secondary]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {badge != null && (
              <span className="ml-1 text-[10px] bg-teal-100 text-teal-700 font-bold px-1.5 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      {tab === 'protocol' && (
        <div className="space-y-3">
          <div className="flex justify-end no-print">
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-1.5 text-sm text-teal-700 bg-teal-50 border
                border-teal-200 px-3 py-2 rounded-xl hover:bg-teal-100 transition-colors font-display font-semibold"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              分からない用語を調べる
            </button>
          </div>
          {protocol.phases.map((phase, i) => (
            <div key={phase.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
              <PhaseCard
                phase={phase}
                isActive={i === protocol.currentPhaseIndex}
                isCompleted={i < protocol.currentPhaseIndex}
                onUpdate={(updates) => handlePhaseUpdate(phase.id, updates)}
                onDelete={protocol.phases.length > 1 ? () => handlePhaseDelete(phase.id) : undefined}
              />
            </div>
          ))}
          <button
            onClick={handleAddPhase}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed
              border-slate-200 rounded-xl text-sm font-medium text-slate-400
              hover:border-[--color-primary]/50 hover:text-[--color-primary] hover:bg-teal-50/30
              transition-all duration-200 font-body no-print"
          >
            <Plus className="w-4 h-4" />フェーズを追加
          </button>
        </div>
      )}

      {tab === 'discussion' && (
        <ExpertPanel
          discussion={protocol.discussion}
          consensusNotes={protocol.consensusNotes}
          generatedBy={protocol.generatedBy}
        />
      )}

      {tab === 'attachments' && (
        <AttachmentsTab
          protocol={protocol}
          onUpdate={() => setProtocol(getProtocolById(protocol.id))}
        />
      )}

      {/* 削除ゾーン */}
      <div className="mt-10 pt-5 border-t border-slate-100 no-print">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-600
              transition-colors font-body"
          >
            <Trash2 className="w-3.5 h-3.5" />このプロトコルを削除
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-600 font-body">本当に削除しますか？</span>
            <button
              onClick={handleDelete}
              className="text-sm bg-red-500 text-white px-3 py-1.5 rounded-lg
                hover:bg-red-600 transition-colors font-display font-semibold"
            >
              削除
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-sm text-[--color-text-secondary] hover:text-[--color-text-primary]
                transition-colors font-body"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>

      {/* カルテへ反映モーダル */}
      {showReflectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-teal-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 font-display">カルテへ反映</h3>
            </div>

            {!reflectDone ? (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  このプロトコルのフェーズ構成をリハビリ計画としてカルテに登録します。<br />
                  対象患者を選択してください。
                </p>
                {ptPatients.length === 0 ? (
                  <div className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4 mb-4">
                    患者管理に患者が登録されていません。<br />
                    先に患者を登録してください。
                  </div>
                ) : (
                  <select
                    value={selectedPtId}
                    onChange={e => setSelectedPtId(e.target.value)}
                    className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm
                      focus:outline-none focus:ring-2 focus:ring-teal-600 mb-4"
                  >
                    <option value="">患者を選択...</option>
                    {ptPatients.map(p => (
                      <option key={p.id} value={p.id}>{p.name}　{p.kana && `（${p.kana}）`}</option>
                    ))}
                  </select>
                )}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800">
                  プロトコルの全{protocol.phases.length}フェーズがリハビリ計画として登録されます。
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleReflect}
                    disabled={!selectedPtId}
                    className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl text-sm font-bold
                      font-display hover:bg-teal-700 disabled:opacity-40 transition-colors"
                  >
                    カルテに反映する
                  </button>
                  <button
                    onClick={() => setShowReflectModal(false)}
                    className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm
                      hover:bg-gray-200 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl p-4 mb-4">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-semibold">
                    カルテにリハビリ計画を反映しました！
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href={`/patients/${selectedPtId}`}
                    className="flex-1 text-center bg-teal-600 text-white py-2.5 rounded-xl text-sm
                      font-bold font-display hover:bg-teal-700 transition-colors"
                    onClick={() => setShowReflectModal(false)}
                  >
                    カルテを開く
                  </Link>
                  <button
                    onClick={() => setShowReflectModal(false)}
                    className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm
                      hover:bg-gray-200 transition-colors"
                  >
                    閉じる
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showSearch && (
        <ProtocolSearchModal
          onClose={() => setShowSearch(false)}
          protocolContext={`プロトコル: ${protocol.title}\nフェーズ: ${protocol.phases.map(p => p.title).join('、')}`}
        />
      )}

      {/* 印刷用免責 */}
      <div className="hidden print:block mt-6 text-xs text-gray-400 border-t pt-4 font-body">
        本プロトコルは臨床意思決定支援を目的とし、医療行為・確定診断を代替しません。最終判断は有資格の医療者が行ってください。
        生成日時: {new Date(protocol.createdAt).toLocaleString('ja-JP')}
      </div>
    </div>
  )
}

// ─── 添付資料タブ ─────────────────────────────────────────────────

const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8MB

function AttachmentsTab({
  protocol,
  onUpdate,
}: {
  protocol: Protocol
  onUpdate: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const attachments = protocol.attachments ?? []

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        alert(`${file.name} は8MBを超えるため添付できません。`)
        continue
      }
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      if (!allowed.includes(file.type)) {
        alert(`${file.name} はPDF・JPEG・PNG・WebPのみ対応しています。`)
        continue
      }
      const data = await readFileAsBase64(file)
      addAttachment(protocol.id, {
        fileName: file.name,
        fileType: file.type,
        data,
        fileSize: file.size,
        note: '',
      })
      onUpdate()
    }
    setUploading(false)
  }

  function viewAttachment(att: ProtocolAttachment) {
    const bytes = atob(att.data)
    const ab = new ArrayBuffer(bytes.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < bytes.length; i++) ia[i] = bytes.charCodeAt(i)
    const blob = new Blob([ab], { type: att.fileType })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  function handleDelete(id: string) {
    if (!confirm('この添付ファイルを削除しますか？')) return
    removeAttachment(protocol.id, id)
    onUpdate()
  }

  function saveNote(id: string) {
    updateAttachmentNote(protocol.id, id, noteDraft)
    setEditingNoteId(null)
    onUpdate()
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  const fileIcon = (type: string) =>
    type === 'application/pdf' ? '📄' : '🖼️'

  return (
    <div className="space-y-4">

      {/* ドロップゾーン */}
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed
          rounded-2xl cursor-pointer transition-all duration-200 ${
          dragging
            ? 'border-teal-500 bg-teal-50 scale-[1.01]'
            : 'border-slate-200 bg-slate-50 hover:border-teal-400 hover:bg-teal-50/40'
        }`}
      >
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          multiple
          className="sr-only"
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Upload className={`w-8 h-8 ${dragging ? 'text-teal-600' : 'text-slate-300'}`} />
        )}
        <div className="text-center">
          <p className={`text-sm font-semibold ${dragging ? 'text-teal-700' : 'text-slate-500'}`}>
            {uploading ? 'アップロード中...' : 'PDFまたは画像をドラッグ＆ドロップ'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">または クリックしてファイルを選択（PDF・JPEG・PNG、最大8MB）</p>
        </div>
      </label>

      {/* 添付一覧 */}
      {attachments.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          添付ファイルはまだありません。<br />
          病院からのプロトコルや術後指示書をここに追加できます。
        </div>
      ) : (
        <div className="space-y-3">
          {attachments.map(att => (
            <div key={att.id}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">{fileIcon(att.fileType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{att.fileName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatSize(att.fileSize)} · {new Date(att.addedAt).toLocaleDateString('ja-JP')}
                  </p>

                  {/* メモ */}
                  {editingNoteId === att.id ? (
                    <div className="flex gap-2 mt-2">
                      <input
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveNote(att.id); if (e.key === 'Escape') setEditingNoteId(null) }}
                        autoFocus
                        placeholder="例: 〇〇病院 術後プロトコル"
                        className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs
                          focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                      />
                      <button onClick={() => saveNote(att.id)}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-900">保存</button>
                      <button onClick={() => setEditingNoteId(null)}
                        className="text-xs text-slate-400 hover:text-slate-600">取消</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingNoteId(att.id); setNoteDraft(att.note) }}
                      className="mt-1.5 text-xs text-left w-full"
                    >
                      {att.note
                        ? <span className="text-teal-700 font-medium">{att.note}</span>
                        : <span className="text-slate-300 italic">メモを追加（病院名・書類種別など）</span>}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => viewAttachment(att)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                    title="開いて確認"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(att.id)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                    title="削除"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-400 text-center">
        ファイルはこのデバイスのローカルストレージに保存されます。
        個人情報を含む書類の取り扱いには注意してください。
      </p>
    </div>
  )
}
