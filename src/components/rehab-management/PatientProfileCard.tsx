'use client'
// ──────────────────────────────────────────────
// カルテの「概要」に出す基本情報と保険証の情報（NOAHから取り込んだもの）
// 自費カルテとして使うため、保険の情報は参考として表示するだけ（請求には使わない）
// ──────────────────────────────────────────────
import type { Patient } from '@/types/patient'
import { calcAge } from '@/lib/rehab-algorithms'
import { birthdayLabel } from '@/lib/birthday'
import { Card, CardContent, SectionTitle } from './shared'

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex min-w-0 gap-3 py-1 text-sm">
      <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-900">{value}</dd>
    </div>
  )
}

export default function PatientProfileCard({ patient }: { patient: Patient }) {
  const ins = patient.insurance
  const age = calcAge(patient.birthDate)
  const bday = birthdayLabel(patient.birthDate)
  const hasContact = patient.phone || patient.email || patient.address
  const hasIns = ins && Object.values(ins).some(Boolean)
  if (!patient.birthDate && !hasContact && !hasIns && !patient.noah) return null

  const insuredOther = ins?.relation && ins.relation !== '本人' && ins.insuredName
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="min-w-0">
            <SectionTitle>基本情報</SectionTitle>
            <dl>
              <Row
                label="生年月日"
                value={patient.birthDate ? `${patient.birthDate}${Number.isFinite(age) ? `（${age}歳）` : ''}` : undefined}
              />
              {bday && (
                <div className="py-1">
                  <span className="inline-flex items-center gap-1 rounded-full border border-pink-200 bg-pink-50 px-2.5 py-0.5 text-xs font-bold text-pink-700">
                    🎂 {bday}
                  </span>
                </div>
              )}
              <Row label="電話" value={patient.phone} />
              <Row label="メール" value={patient.email} />
              <Row label="住所" value={[patient.postalCode ? `〒${patient.postalCode}` : '', patient.address].filter(Boolean).join(' ')} />
              <Row label="職業" value={patient.occupation} />
              {patient.noah && (
                <Row
                  label="NOAHの記録"
                  value={`受診者番号 ${patient.noah.ids.join('・')}${patient.noah.firstVisit ? ` ／ ${patient.noah.firstVisit}〜${patient.noah.lastVisit ?? ''}` : ''}${patient.noah.visitCount != null ? ` ／ ${patient.noah.visitCount}回` : ''}`}
                />
              )}
            </dl>
          </div>
          {hasIns && (
            <div className="min-w-0">
              <SectionTitle>保険証（NOAHから・参考）</SectionTitle>
              <dl>
                <Row label="種別" value={[ins!.kind, ins!.category && ins!.category !== '通常' ? ins!.category : ''].filter(Boolean).join('・')} />
                <Row label="保険者" value={[ins!.insurerNumber, ins!.insurerName].filter(Boolean).join(' ')} />
                <Row label="記号・番号" value={[ins!.symbol, ins!.number].filter(Boolean).join(' ・ ')} />
                <Row label="負担割合" value={ins!.burdenRatio} />
                <Row label="有効期限" value={ins!.validUntil} />
                <Row label="続柄" value={ins!.relation} />
                {insuredOther && <Row label="被保険者" value={`${ins!.insuredName}${ins!.insuredBirthDate ? `（${ins!.insuredBirthDate}）` : ''}`} />}
              </dl>
              <p className="mt-2 text-xs text-slate-400">
                自費カルテのため、保険の情報は参考です{ins!.asOf ? `（${ins!.asOf} 時点）` : ''}。保険証が変わっていることがあります。
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
