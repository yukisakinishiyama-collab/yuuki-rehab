'use client'
// ──────────────────────────────────────────────
// 問診フローチャート（分岐式問診ツリー）UI
// ──────────────────────────────────────────────
import { useState } from 'react'
import { getFlowchartForJoint, type FlowResultNode } from '@/data/intake-flowcharts'
import { Badge } from './shared'

export interface FlowchartResult {
  path: { question: string; answer: string }[]
  redFlag: boolean
  diagnosis: string[]
  recommendedTests: string[]
  advice: string
}

interface Props {
  joint: string
  onComplete?: (result: FlowchartResult) => void
}

interface PathStep {
  nodeId: string
  question: string
  answer: string
}

export default function IntakeFlowchart({ joint, onComplete }: Props) {
  const def = getFlowchartForJoint(joint)
  const [currentId, setCurrentId] = useState(def?.startNodeId ?? '')
  const [path, setPath] = useState<PathStep[]>([])

  if (!def) return null

  const node = def.nodes[currentId]
  if (!node) return null

  function handleAnswer(question: string, answerLabel: string, nextId: string) {
    const nextPath = [...path, { nodeId: currentId, question, answer: answerLabel }]
    setPath(nextPath)
    setCurrentId(nextId)

    const nextNode = def!.nodes[nextId]
    if (nextNode?.type === 'result') {
      onComplete?.({
        path: nextPath.map(p => ({ question: p.question, answer: p.answer })),
        redFlag: nextNode.redFlag,
        diagnosis: nextNode.diagnosis,
        recommendedTests: nextNode.recommendedTests,
        advice: nextNode.advice,
      })
    }
  }

  function handleBack() {
    if (path.length === 0) return
    const prev = path[path.length - 1]
    setPath(path.slice(0, -1))
    setCurrentId(prev.nodeId)
  }

  function handleRestart() {
    setPath([])
    setCurrentId(def!.startNodeId)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-600">{joint}の問診フローチャート</p>
        {path.length > 0 && (
          <button
            type="button"
            onClick={handleRestart}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ↺ 最初から
          </button>
        )}
      </div>

      {/* 経路（パンくず） */}
      {path.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {path.map((p, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {p.answer}
            </span>
          ))}
        </div>
      )}

      {node.type === 'question' && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-800">{node.question}</p>
            {node.hint && <p className="text-xs text-gray-400 mt-1">{node.hint}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {node.options.map(opt => (
              <button
                key={opt.label}
                type="button"
                onClick={() => handleAnswer(node.question, opt.label, opt.next)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:border-teal-400 hover:bg-teal-50 transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
          {path.length > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="text-xs text-teal-600 hover:text-teal-800 font-medium"
            >
              ← 一つ前の質問に戻る
            </button>
          )}
        </div>
      )}

      {node.type === 'result' && (
        <ResultCard node={node} onBack={path.length > 0 ? handleBack : undefined} />
      )}
    </div>
  )
}

function ResultCard({ node, onBack }: { node: FlowResultNode; onBack?: () => void }) {
  return (
    <div className="space-y-3">
      {node.redFlag && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-xs font-semibold text-red-700">⚠️ レッドフラッグに該当する可能性があります</p>
          <p className="text-xs text-red-600 mt-1">このアプリは診断を行いません。医療機関への受診・紹介を検討してください。</p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1.5">疑われる病態候補</p>
        <div className="flex flex-wrap gap-1.5">
          {node.diagnosis.map(d => (
            <Badge key={d} color={node.redFlag ? 'red' : 'teal'}>{d}</Badge>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1.5">推奨スペシャルテスト・確認事項</p>
        <div className="flex flex-wrap gap-1.5">
          {node.recommendedTests.map(t => (
            <Badge key={t} color="blue">{t}</Badge>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-600 mb-1">施術者への助言</p>
        <p className="text-xs text-gray-600">{node.advice}</p>
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-teal-600 hover:text-teal-800 font-medium"
        >
          ← 一つ前の質問に戻る
        </button>
      )}
    </div>
  )
}
