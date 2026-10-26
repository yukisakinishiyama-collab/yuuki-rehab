'use client'
// ──────────────────────────────────────────────
// カルテの「概要」に出す基本情報と保険証の情報（NOAHから取り込んだもの）
// 自費カルテとして使うため、保険の情報は参考として表示するだけ（請求には使わない）
// ──────────────────────────────────────────────
import type { Patient } from '@/types/patient'
import { calcAge } from '@/lib/rehab-algorithms'
import { birthdayLabel } from '@/lib/birthday'
import { useLineLinks } from '@/lib/line-link-client'
import { patientLinkKey } from '@/lib/line-link'
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
  const { linkFor, unlink } = useLineLinks()
  const lineLink = linkFor(patient)
  if (!patient.birthDate && !hasContact && !hasIns && !patient.noah) return null

  const onUnlink = async () => {
    if (!lineLink) return
    if (!window.confirm(`${patient.name}さんとLINEの結びつけを外しますか？\n（誕生日のご挨拶などが届かなくなります）`)) return
    try {
      await unlink(lineLink.key)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '外せませんでした')
    }
  }

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
              <div className="flex min-w-0 gap-3 py-1 text-sm">
                <dt className="w-28 shrink-0 text-slate-500">公式LINE</dt>
                <dd className="min-w-0">
                  {lineLink ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-700">
                        LINE連携済み
                      </span>
                      <span className="text-xs text-slate-500">{lineLink.linkedAt.slice(0, 10)} に結びつけ</span>
                      {lineLink.patientNo && <span className="text-xs text-slate-700">患者番号 <b>{lineLink.patientNo}</b></span>}
                      {lineLink.birthDate && !patient.birthDate && <span className="text-xs text-slate-500">生年月日 {lineLink.birthDate}（LINEで入力）</span>}
                      <button type="button" onClick={onUnlink} className="text-xs text-slate-400 underline hover:text-red-600">
                        外す
                      </button>
                    </span>
                  ) : lineLink === undefined ? (
                    <span className="text-xs text-slate-400">確認中…</span>
                  ) : patientLinkKey(patient.name, patient.phone) ? (
                    <span className="text-xs text-slate-500">未連携（患者さんがLINEのメニュー「カルテ連携」で名前と電話番号を入れると結びつきます）</span>
                  ) : (
                    <span className="text-xs text-slate-500">未連携（電話番号が無いと結びつけられません）</span>
                  )}
                </dd>
              </div>
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
