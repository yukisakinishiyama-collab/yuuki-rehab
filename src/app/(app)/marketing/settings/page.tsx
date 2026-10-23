'use client'

/** 基本設定：院情報の一元管理（全AI生成に反映）＋監査ログ */
import { useEffect, useState } from 'react'
import { loadAuditLog, loadClinicProfile, saveClinicProfile } from '@/lib/marketing/store'
import type { AuditLogEntry, ClinicProfile } from '@/lib/marketing/types'

const FIELDS: Array<{ key: keyof ClinicProfile; label: string; rows?: number }> = [
  { key: 'name', label: '院名' },
  { key: 'address', label: '所在地' },
  { key: 'phone', label: '電話番号' },
  { key: 'hours', label: '営業時間' },
  { key: 'closedDays', label: '休業日' },
  { key: 'reserveUrl', label: '予約URL' },
  { key: 'lineUrl', label: '公式LINE URL' },
  { key: 'googleMapUrl', label: 'Google店舗ページURL' },
  { key: 'instagramUrl', label: 'Instagram URL' },
  { key: 'parking', label: '駐車場情報' },
  { key: 'services', label: '対応内容', rows: 3 },
  { key: 'notServices', label: '対応できない内容', rows: 3 },
  { key: 'priceSummary', label: '料金の目安', rows: 3 },
  { key: 'firstVisitFlow', label: '初回の流れ', rows: 2 },
  { key: 'strengths', label: '院の強み', rows: 3 },
  { key: 'bannedPhrases', label: '禁止表現（カンマまたは改行区切り。表現チェックに追加）', rows: 2 },
  { key: 'defaultTone', label: '投稿トーン', rows: 2 },
]

export default function SettingsPage() {
  const [profile, setProfile] = useState<ClinicProfile | null>(null)
  const [audit, setAudit] = useState<AuditLogEntry[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setProfile(loadClinicProfile())
    setAudit(loadAuditLog())
  }, [])

  if (!profile) return null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">基本設定</h1>
      <p className="text-sm text-slate-600">
        ここで設定した情報が、すべてのAI生成コンテンツに反映されます。料金や営業時間を変更したら必ず更新してください。
      </p>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        {FIELDS.map(({ key, label, rows }) => (
          <label key={key} className={`block text-sm ${rows ? 'sm:col-span-2' : ''}`}>
            <span className="font-bold">{label}</span>
            {rows ? (
              <textarea
                value={profile[key]}
                rows={rows}
                onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
              />
            ) : (
              <input
                value={profile[key]}
                onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
              />
            )}
          </label>
        ))}
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => {
              saveClinicProfile(profile)
              setAudit(loadAuditLog())
              setSaved(true)
              setTimeout(() => setSaved(false), 2500)
            }}
            className="rounded-lg bg-teal-700 px-5 py-2.5 font-bold text-white hover:bg-teal-800"
          >
            保存する
          </button>
          {saved && <span className="ml-3 text-sm font-bold text-emerald-700">保存しました ✓</span>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">操作履歴（監査ログ・直近20件）</h2>
        {audit.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">まだ操作履歴はありません。</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 text-xs text-slate-600">
            {audit.slice(0, 20).map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-2 py-1.5">
                <span className="font-mono">{entry.at.slice(0, 19).replace('T', ' ')}</span>
                <span className="font-bold text-slate-800">{entry.action}</span>
                <span className="truncate">{entry.target}</span>
                {entry.detail && <span className="text-slate-400">{entry.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
