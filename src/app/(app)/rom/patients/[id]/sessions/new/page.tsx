'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { JOINT_CONFIGS } from '@/types/rom'
import type { JointType } from '@/types/rom'

const JOINT_ICONS: Record<JointType, string> = {
  cervical: '🔄',
  shoulder: '💪',
  elbow: '🦾',
  forearm: '↩️',
  wrist: '🤲',
  finger: '🖐️',
  thoracolumbar: '🏗️',
  hip: '🦵',
  knee: '🦿',
  ankle: '🦶',
  toe: '🦰',
}

const UPPER_JOINTS: JointType[] = ['cervical', 'shoulder', 'elbow', 'forearm', 'wrist', 'finger']
const TRUNK_JOINTS: JointType[] = ['thoracolumbar']
const LOWER_JOINTS: JointType[] = ['hip', 'knee', 'ankle', 'toe']

function JointSection({ title, joints, patientId }: { title: string; joints: JointType[]; patientId: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">{title}</h3>
      <div className="grid grid-cols-3 gap-2">
        {joints.map((joint) => (
          <Link
            key={joint}
            href={`/rom/patients/${patientId}/sessions/new/${joint}`}
            className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-teal-400 hover:shadow-md transition-all active:scale-[0.97] text-center"
          >
            <span className="text-2xl">{JOINT_ICONS[joint]}</span>
            <span className="text-sm font-semibold text-slate-700">{JOINT_CONFIGS[joint].label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function JointSelectPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/rom/patients/${id}`} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">関節を選択</h1>
          <p className="text-xs text-slate-500">測定する関節をタップしてください</p>
        </div>
      </div>

      <div className="space-y-5">
        <JointSection title="上肢・頸部" joints={UPPER_JOINTS} patientId={id} />
        <JointSection title="体幹" joints={TRUNK_JOINTS} patientId={id} />
        <JointSection title="下肢" joints={LOWER_JOINTS} patientId={id} />
      </div>
    </div>
  )
}
