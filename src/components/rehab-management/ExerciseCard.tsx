'use client'
// ──────────────────────────────────────────────
// 運動カードコンポーネント
// ──────────────────────────────────────────────
import type { Exercise, PatientExercise } from '@/types/patient'
import ExerciseIllustration from './ExerciseIllustration'
import { Badge } from './shared'

const DIFFICULTY_LABELS = { easy: 'かんたん', medium: '普通', hard: 'きつめ' }
const DIFFICULTY_COLORS = { easy: 'green', medium: 'yellow', hard: 'red' } as const

interface Props {
  exercise: Exercise
  patientExercise?: PatientExercise
  onAssign?: (id: string) => void
  onRemove?: (id: string) => void
  showPatientView?: boolean
}

export default function ExerciseCard({ exercise, patientExercise, onAssign, onRemove, showPatientView }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex">
        {/* イラスト */}
        <div className="bg-gray-50 p-3 flex items-center justify-center flex-shrink-0">
          <ExerciseIllustration type={exercise.svgIllustration} size={80} />
        </div>

        {/* 内容 */}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-gray-800 text-sm">{exercise.name}</h4>
              <p className="text-xs text-gray-500 mt-0.5">{exercise.purpose}</p>
            </div>
            <Badge color={DIFFICULTY_COLORS[exercise.difficulty]}>
              {DIFFICULTY_LABELS[exercise.difficulty]}
            </Badge>
          </div>

          {/* 回数・頻度 */}
          <div className="flex gap-3 mt-2">
            <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
              {exercise.reps} × {exercise.sets}セット
            </span>
            <span className="text-xs text-gray-500">
              {exercise.frequency}
            </span>
          </div>

          {/* 患者向け説明 */}
          {showPatientView && (
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              {exercise.patientInstruction}
            </p>
          )}

          {/* 注意 */}
          {exercise.contraindications && (
            <p className="text-xs text-orange-600 mt-1.5 flex items-center gap-1">
              <span>⚠</span> {exercise.contraindications}
            </p>
          )}

          {/* 実施率 */}
          {patientExercise && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-teal-500 h-1.5 rounded-full"
                  style={{ width: `${patientExercise.adherenceRate}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{patientExercise.adherenceRate}%実施</span>
            </div>
          )}

          {/* ボタン */}
          <div className="flex gap-2 mt-3">
            {onAssign && !patientExercise && (
              <button
                type="button"
                onClick={() => onAssign(exercise.id)}
                className="px-3 py-1 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700 transition-colors"
              >
                処方する
              </button>
            )}
            {onRemove && patientExercise && (
              <button
                type="button"
                onClick={() => onRemove(patientExercise.id)}
                className="px-3 py-1 bg-red-100 text-red-600 text-xs rounded-lg hover:bg-red-200 transition-colors"
              >
                外す
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
