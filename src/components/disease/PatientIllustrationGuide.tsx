// 患者説明モード「イラストで見る回復の流れ」
// 疾患IDごとに、治療・リハビリの場面イラストを段階順に表示する。
// 見た目が似ていても病態・固定法が異なる疾患へは安易に流用しない（ID別の明示マッピング）。
// 出典: ChatGPT(Codex)生成のインストーラーパッチを統合（院内アプリのAppIllustration基盤に適合済み）

import AppIllustration from '@/components/AppIllustration'

interface PatientIllustration {
  slot: string
  phase: string
  title: string
  description: string
  alt: string
}

const ANKLE_ACUTE_CARE: PatientIllustration = {
  slot: 'sprain-icing',
  phase: 'けがの直後の症状対策',
  title: '足を高くして休む例',
  description:
    '足を高く保ち、必要に応じて圧迫や冷却を行う場面です。冷却は治癒を保証するものではなく、痛みを和らげるための補助手段です。',
  alt: 'ソファで足首を高くし、弾性包帯と冷却材を使用して休んでいる人のイラスト',
}

const ANKLE_SUPPORT: PatientIllustration = {
  slot: 'sprain-taping',
  phase: '歩行・活動を再開する時期',
  title: '足首を保護する方法の一例',
  description:
    'テーピングや装具は、足首の状態と活動内容に合わせて選びます。巻き方や使用時間は、担当者から説明を受けてください。',
  alt: '施術者が患者の足首にテーピングを行っているイラスト',
}

const ANKLE_BALANCE: PatientIllustration = {
  slot: 'sprain-balance',
  phase: '再発を防ぐための時期',
  title: '片脚バランス練習の例',
  description:
    '痛みや腫れが落ち着いた後は、片脚で体を支える練習を段階的に行います。最初は転ばないよう、必ず支えのある環境で行います。',
  alt: 'スタッフが見守る中でバランスディスク上の片脚立ちを練習する人のイラスト',
}

const FOREARM_PROTECTION: PatientIllustration = {
  slot: 'fracture-cast-forearm',
  phase: '固定・保護する時期',
  title: '腕を固定して保護する例',
  description:
    'ギプスや装具、三角巾を使って患部を守る時期のイメージです。固定方法と期間は骨折の状態で異なるため、自己判断で外さないでください。',
  alt: '前腕を固定して三角巾で支え、スタッフから説明を受けている患者のイラスト',
}

const CLAVICLE_PROTECTION: PatientIllustration = {
  slot: 'fracture-clavicle-band',
  phase: '固定・保護する時期',
  title: '鎖骨バンドを使う場合の一例',
  description:
    '固定方法は骨折の場所やずれ方、医師の方針で異なり、三角巾を使う場合もあります。締め方や装着時間を自己判断で変えないでください。',
  alt: '鎖骨バンドを装着した患者の上半身を正面から示したイラスト',
}

const FOOT_PROTECTION: PatientIllustration = {
  slot: 'fracture-foot-walk',
  phase: '足への負担を調整する時期',
  title: 'ブーツと松葉杖を使う場合の一例',
  description:
    '歩行用ブーツや松葉杖で骨折部への負担を減らす場面です。足をついてよい量は一人ひとり異なるため、痛みだけで判断せず医師の指示を守ります。',
  alt: '歩行用ブーツと松葉杖を使い、スタッフに見守られながら歩く患者のイラスト',
}

const SHOULDER_PROTECTION: PatientIllustration = {
  slot: 'dislocation-sling',
  phase: '肩が外れた直後の保護期',
  title: '三角巾で腕を支える例',
  description:
    '整復後に三角巾などで肩を保護する場合のイメージです。固定する期間と動かしてよい範囲は、医師の指示に従ってください。',
  alt: '肩の脱臼後に三角巾で腕を支えている若い患者のイラスト',
}

const SHOULDER_STRENGTH: PatientIllustration = {
  slot: 'dislocation-innermuscle',
  phase: '安定性を高める時期',
  title: '肩の深部筋を鍛える例',
  description:
    '肩が落ち着き、運動の許可が出た後にゴムバンドで肩まわりを鍛える場面です。負荷と動かす範囲は段階的に調整します。',
  alt: 'スタッフの指導を受けながらゴムバンドで肩の筋力訓練をする患者のイラスト',
}

/**
 * 疾患IDと患者向けイラストの対応。
 * 見た目が似ていても病態・固定法が異なる疾患へは安易に流用しない。
 */
const DISEASE_PATIENT_ILLUSTRATIONS: Record<string, readonly PatientIllustration[]> = {
  'ankle-lateral-sprain': [ANKLE_ACUTE_CARE, ANKLE_SUPPORT, ANKLE_BALANCE],
  cai: [ANKLE_BALANCE],

  'post-distal-radius-fracture': [FOREARM_PROTECTION],
  'clavicle-fracture': [CLAVICLE_PROTECTION],
  'navicular-stress-fracture': [FOOT_PROTECTION],
  'metatarsal-stress-fracture': [FOOT_PROTECTION],
  'jones-fracture': [FOOT_PROTECTION],
  'lisfranc-injury': [FOOT_PROTECTION],

  'anterior-shoulder-instability': [SHOULDER_PROTECTION, SHOULDER_STRENGTH],
  'recurrent-shoulder-dislocation': [SHOULDER_PROTECTION, SHOULDER_STRENGTH],
  'post-bankart-repair': [SHOULDER_STRENGTH],
}

export function getDiseasePatientIllustrations(diseaseId: string): readonly PatientIllustration[] {
  return DISEASE_PATIENT_ILLUSTRATIONS[diseaseId] ?? []
}

export default function PatientIllustrationGuide({ diseaseId }: { diseaseId: string }) {
  const illustrations = getDiseasePatientIllustrations(diseaseId)
  if (illustrations.length === 0) return null

  const headingId = `patient-illustrations-${diseaseId}`

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-b from-teal-50/70 to-white shadow-sm"
    >
      <div className="border-b border-teal-100 px-5 py-4">
        <h2 id={headingId} className="text-sm font-bold text-teal-900 font-display">
          イラストで見る回復の流れ
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          写真のような正確な装着図ではなく、治療やリハビリの場面を分かりやすく示したイメージです。
        </p>
      </div>

      <ol className={`grid gap-3 p-4 ${illustrations.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {illustrations.map((illustration, index) => (
          <li
            key={illustration.slot}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
              <AppIllustration
                slot={illustration.slot}
                alt={illustration.alt}
                className="h-full w-full object-contain p-2"
              />
              {illustrations.length > 1 && (
                <span className="absolute left-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white shadow-sm">
                  {index + 1}
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="text-[10px] font-bold tracking-wide text-teal-700">{illustration.phase}</p>
              <h3 className="mt-1 text-sm font-bold leading-snug text-slate-800 font-display">
                {illustration.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{illustration.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mx-4 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
        固定具・足をついてよい量・運動の開始時期は、担当医と施術者から受けた個別の指示を最優先してください。
      </p>
    </section>
  )
}
