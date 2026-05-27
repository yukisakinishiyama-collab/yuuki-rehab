'use client'

/**
 * MarkerSetupPanel
 * カラーシールの色と関節を対応付ける設定UI。
 * 「+追加」で最大6マーカーまで設定可能。
 */

import { useState } from 'react'
import type { MarkerConfig } from '@/lib/color-marker-tracker'
import { COLOR_PRESETS, JOINT_OPTIONS } from '@/lib/color-marker-tracker'
import { Plus, Trash2, CircleDot } from 'lucide-react'

interface Props {
  configs:   MarkerConfig[]
  onChange:  (configs: MarkerConfig[]) => void
  onClose:   () => void
}

let _idSeq = 0
function genId() { return `m${++_idSeq}` }

export default function MarkerSetupPanel({ configs, onChange, onClose }: Props) {
  const [editConfigs, setEditConfigs] = useState<MarkerConfig[]>(configs)

  function addMarker() {
    if (editConfigs.length >= 6) return
    const preset = COLOR_PRESETS[editConfigs.length % COLOR_PRESETS.length]
    const joint  = JOINT_OPTIONS[editConfigs.length % JOINT_OPTIONS.length]
    setEditConfigs([...editConfigs, {
      id:        genId(),
      label:     joint.label,
      joint:     joint.key,
      hue:       preset.hue,
      tolerance: preset.tolerance,
      satMin:    preset.satMin,
      valMin:    preset.valMin,
      cssColor:  preset.cssColor,
    }])
  }

  function removeMarker(id: string) {
    setEditConfigs(editConfigs.filter((c) => c.id !== id))
  }

  function updateMarker(id: string, patch: Partial<MarkerConfig>) {
    setEditConfigs(editConfigs.map((c) => c.id === id ? { ...c, ...patch } : c))
  }

  function applyPreset(id: string, presetName: string) {
    const p = COLOR_PRESETS.find((c) => c.name === presetName)
    if (!p) return
    updateMarker(id, { hue: p.hue, tolerance: p.tolerance, satMin: p.satMin, valMin: p.valMin, cssColor: p.cssColor })
  }

  function save() {
    onChange(editConfigs)
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* ヘッダー */}
        <div className="sticky top-0 bg-[#111827] flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <CircleDot className="w-5 h-5 text-teal-400" />
          <div>
            <h3 className="text-white font-bold text-sm">カラーマーカー設定</h3>
            <p className="text-gray-400 text-xs mt-0.5">100均のカラーシールを関節に貼り色を登録してください</p>
          </div>
        </div>

        {/* 使い方ガイド */}
        <div className="mx-5 mt-4 p-3 bg-teal-900/30 border border-teal-700/40 rounded-xl text-xs text-teal-300 leading-relaxed">
          <p className="font-bold mb-1">📌 使い方</p>
          <ol className="list-decimal list-inside space-y-0.5 text-teal-200">
            <li>蛍光オレンジ・ピンク等のシールを関節に貼る</li>
            <li>下の「+マーカーを追加」で色と関節を対応付ける</li>
            <li>「保存して開始」→ 動画を再生するとリアルタイムで角度を計測</li>
          </ol>
          <p className="mt-1.5 text-teal-400 text-[10px]">💡 推奨：蛍光オレンジ/ピンク/黄緑（体育館照明でも検出しやすい）</p>
        </div>

        {/* マーカー一覧 */}
        <div className="px-5 py-4 space-y-3">
          {editConfigs.length === 0 && (
            <p className="text-gray-500 text-xs text-center py-4">マーカーが未設定です。下の「+追加」を押してください。</p>
          )}

          {editConfigs.map((cfg, idx) => (
            <div key={cfg.id} className="bg-white/5 rounded-xl p-3 space-y-2.5 border border-white/10">
              <div className="flex items-center gap-2">
                {/* カラードット */}
                <div
                  className="w-6 h-6 rounded-full border-2 border-white/30 flex-shrink-0"
                  style={{ background: cfg.cssColor }}
                />
                <span className="text-white text-xs font-bold">マーカー {idx + 1}</span>
                <button
                  onClick={() => removeMarker(cfg.id)}
                  className="ml-auto text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* カラープリセット選択 */}
              <div>
                <p className="text-gray-400 text-[10px] mb-1">シールの色</p>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => applyPreset(cfg.id, p.name)}
                      title={p.name}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border transition-all"
                      style={{
                        background: cfg.cssColor === p.cssColor ? p.cssColor + '33' : 'transparent',
                        borderColor: cfg.cssColor === p.cssColor ? p.cssColor : '#374151',
                        color: cfg.cssColor === p.cssColor ? p.cssColor : '#9ca3af',
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                        style={{ background: p.cssColor }}
                      />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 関節選択 */}
              <div>
                <p className="text-gray-400 text-[10px] mb-1">貼った関節</p>
                <select
                  value={cfg.joint}
                  onChange={(e) => {
                    const jo = JOINT_OPTIONS.find((j) => j.key === e.target.value)
                    updateMarker(cfg.id, { joint: e.target.value, label: jo?.label ?? e.target.value })
                  }}
                  className="w-full bg-[#1f2937] border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {JOINT_OPTIONS.map((j) => (
                    <option key={j.key} value={j.key}>{j.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          {/* 追加ボタン */}
          {editConfigs.length < 6 && (
            <button
              onClick={addMarker}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-teal-600/50 rounded-xl text-teal-400 text-xs hover:bg-teal-900/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              マーカーを追加（最大6個）
            </button>
          )}
        </div>

        {/* フッター */}
        <div className="sticky bottom-0 bg-[#111827] flex gap-2 px-5 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={save}
            className="flex-1 py-2 text-sm bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl transition-colors"
          >
            保存して開始
          </button>
        </div>
      </div>
    </div>
  )
}
