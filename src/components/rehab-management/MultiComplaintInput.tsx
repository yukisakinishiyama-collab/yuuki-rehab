'use client'
// ──────────────────────────────────────────────
// 複数疾患・部位ごとの NRS・症状入力コンポーネント
// ──────────────────────────────────────────────
import { nanoid } from 'nanoid'
import type { ComplaintEntry, ComplaintSymptom, BodyRegion, Side } from '@/types/patient'
import { COMPLAINT_SYMPTOMS, BODY_REGION_LABELS } from '@/types/patient'

const SIDE_LABELS: Record<Side, string> = {
  right: '右', left: '左', bilateral: '両側', na: 'N/A',
}

const BODY_REGIONS: BodyRegion[] = [
  'knee', 'shoulder', 'hip', 'ankle', 'lumbar', 'cervical',
  'elbow', 'wrist', 'thoracic', 'other',
]

const NRS_COLORS = (n: number) =>
  n <= 3 ? 'bg-green-500 text-white' :
  n <= 6 ? 'bg-yellow-500 text-white' :
  'bg-red-500 text-white'

interface Props {
  value: ComplaintEntry[]
  onChange: (v: ComplaintEntry[]) => void
}

export default function MultiComplaintInput({ value, onChange }: Props) {
  function addComplaint() {
    onChange([...value, {
      id: nanoid(),
      bodyRegion: 'knee',
      side: 'right',
      diagnosisLabel: '',
      nrs: 3,
      symptoms: [],
    }])
  }

  function update(id: string, patch: Partial<ComplaintEntry>) {
    onChange(value.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function remove(id: string) {
    onChange(value.filter(c => c.id !== id))
  }

  function toggleSymptom(id: string, sym: ComplaintSymptom) {
    const entry = value.find(c => c.id === id)
    if (!entry) return
    const has = entry.symptoms.includes(sym)
    update(id, {
      symptoms: has
        ? entry.symptoms.filter(s => s !== sym)
        : [...entry.symptoms, sym],
    })
  }

  return (
    <div className="space-y-3">
      {value.map((c, idx) => (
        <div key={c.id} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
          {/* カードヘッダー */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {idx + 1}
            </span>
            <span className="text-xs font-semibold text-gray-600 flex-1">
              {BODY_REGION_LABELS[c.bodyRegion]}
              {c.side !== 'na' && `（${SIDE_LABELS[c.side]}）`}
              {c.diagnosisLabel && ` — ${c.diagnosisLabel}`}
            </span>
            <button
              type="button"
              onClick={() => remove(c.id)}
              className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
              title="削除"
            >×</button>
          </div>

          <div className="px-3 py-3 space-y-3">
            {/* 部位・患側 */}
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-gray-400 mb-1">部位</p>
                <div className="flex flex-wrap gap-1">
                  {BODY_REGIONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => update(c.id, { bodyRegion: r })}
                      className={`px-2 py-0.5 text-xs rounded-lg border transition-colors ${
                        c.bodyRegion === r
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                      }`}
                    >
                      {BODY_REGION_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0">
                <p className="text-[10px] font-semibold text-gray-400 mb-1">患側</p>
                <div className="flex gap-1">
                  {(['right', 'left', 'bilateral'] as Side[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update(c.id, { side: s })}
                      className={`px-2.5 py-0.5 text-xs rounded-lg border transition-colors ${
                        c.side === s
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                      }`}
                    >
                      {SIDE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 病名・診断名（任意） */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 mb-1">診断名・疾患名（任意）</p>
              <input
                type="text"
                value={c.diagnosisLabel}
                onChange={e => update(c.id, { diagnosisLabel: e.target.value })}
                placeholder="例：ACL再建後、腱板断裂、腰椎椎間板ヘルニア"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 placeholder-gray-300
                  focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            {/* NRS */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 mb-1">
                痛みの強さ（NRS）
                <span className={`ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${NRS_COLORS(c.nrs)}`}>
                  {c.nrs}
                </span>
              </p>
              <div className="flex gap-1">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => update(c.id, { nrs: i })}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      c.nrs === i
                        ? NRS_COLORS(i)
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-0.5 px-0.5">
                <span className="text-[10px] text-gray-400">痛みなし</span>
                <span className="text-[10px] text-gray-400">最大の痛み</span>
              </div>
            </div>

            {/* 症状チェック */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 mb-1.5">症状</p>
              <div className="flex flex-wrap gap-1.5">
                {COMPLAINT_SYMPTOMS.map(sym => {
                  const active = c.symptoms.includes(sym)
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => toggleSymptom(c.id, sym)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors font-medium ${
                        active
                          ? 'bg-teal-100 text-teal-800 border-teal-300'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-teal-200'
                      }`}
                    >
                      {active ? '✓ ' : ''}{sym}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* 追加ボタン */}
      <button
        type="button"
        onClick={addComplaint}
        className="w-full py-2.5 border-2 border-dashed border-teal-300 rounded-xl text-sm font-medium text-teal-600
          hover:bg-teal-50 transition-colors"
      >
        + 部位・疾患を追加
      </button>
    </div>
  )
}
