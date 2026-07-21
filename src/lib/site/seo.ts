/**
 * 公開サイトの SEO / 構造化データ（JSON-LD）ヘルパー
 *
 * NAP（院名・住所・電話）は marketing/clinic.ts の DEFAULT_CLINIC_PROFILE を
 * 唯一の正本として参照し、サイト全体で表記を統一する。
 * 生成した JSON-LD は <JsonLd> コンポーネントで描画する（XSS 対策込み）。
 */
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'

/** 本番の正規 URL（末尾スラッシュなし） */
export const SITE_URL = 'https://yuuki-rehab.vercel.app'

const clinic = DEFAULT_CLINIC_PROFILE

/** 電話番号を国際表記に整形。先頭の 0 を +81- に置換し区切りは保持。例: 083-265-4545 → +81-83-265-4545 */
function toE164(phone: string): string {
  return phone.replace(/^0/, '+81-')
}

/** 医院の構造化データ（MedicalClinic）。全公開ページに一度だけ埋め込む */
export function medicalClinicJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': ['MedicalClinic', 'LocalBusiness'],
    '@id': `${SITE_URL}/#clinic`,
    name: clinic.name,
    alternateName: 'YUUKI SEIKOTSU-IN',
    description:
      'スポーツ障害・術前術後リハビリ・競技復帰に特化した山口県下関市の整骨院。運動療法・動作改善を重視した医学的根拠に基づく施術を提供。',
    url: SITE_URL,
    telephone: toE164(clinic.phone),
    image: `${SITE_URL}/icon.png.png`,
    logo: `${SITE_URL}/icon.png.png`,
    priceRange: '¥¥',
    currenciesAccepted: 'JPY',
    medicalSpecialty: ['Physiotherapy', 'SportsMedicine'],
    address: {
      '@type': 'PostalAddress',
      // 住所は「山口県下関市彦島江の浦町9丁目1-14」を分解
      streetAddress: '彦島江の浦町9丁目1-14',
      addressLocality: '下関市',
      addressRegion: '山口県',
      addressCountry: 'JP',
    },
    areaServed: [
      { '@type': 'City', name: '下関市' },
      { '@type': 'AdministrativeArea', name: '山口県' },
      { '@type': 'City', name: '北九州市' },
    ],
    // 診療時間: 平日 午前10-13・午後15-20 / 土 10-15 / 日祝 休診
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '10:00',
        closes: '13:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '15:00',
        closes: '20:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: '10:00',
        closes: '15:00',
      },
    ],
    hasMap: clinic.googleMapUrl,
    // 公式チャネル（LINE・Instagram・Google店舗ページ）
    sameAs: [clinic.lineUrl, clinic.instagramUrl, clinic.googleMapUrl],
  }
}

/** パンくずの構造化データ（BreadcrumbList）。{name,url} 配列から生成 */
export function breadcrumbJsonLd(
  items: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }
}

/** 症状スラッグ → パンくず表示名（症状ページ共通） */
export const SYMPTOM_NAMES: Record<string, string> = {
  acl: 'ACL（前十字靱帯）リハビリ',
  meniscus: '半月板リハビリ',
  'ankle-sprain': '足関節捻挫',
  'muscle-strain': '肉離れ',
  'baseball-shoulder': '野球肩・肩の痛み',
  'baseball-elbow': '野球肘',
  'shin-splints': 'シンスプリント',
  'knee-pain': '膝の痛み',
  'hip-pain': '股関節痛',
  osgood: 'オスグッド病',
  severs: 'シーバー病',
  spondylolysis: '腰椎分離症',
  'lower-back': '腰痛・スポーツ腰部障害',
  wrist: '手関節・手首の痛み',
}

/** 症状ページ用のパンくず（ホーム > 症状一覧 > 各症状） */
export function symptomBreadcrumbJsonLd(slug: string): Record<string, unknown> {
  const name = SYMPTOM_NAMES[slug] ?? '症状'
  return breadcrumbJsonLd([
    { name: 'ホーム', url: `${SITE_URL}/` },
    { name: '症状・お悩み一覧', url: `${SITE_URL}/symptoms` },
    { name, url: `${SITE_URL}/symptoms/${slug}` },
  ])
}

/** 症状スラッグ → 正式な疾患名（MedicalCondition の about に使う） */
export const SYMPTOM_CONDITIONS: Record<string, string> = {
  acl: '前十字靱帯損傷（ACL損傷）',
  meniscus: '半月板損傷',
  'ankle-sprain': '足関節捻挫',
  'muscle-strain': '肉離れ（筋挫傷）',
  'baseball-shoulder': '野球肩（投球障害肩）',
  'baseball-elbow': '野球肘（内側側副靱帯・離断性骨軟骨炎など）',
  'shin-splints': 'シンスプリント（脛骨過労性骨膜炎）',
  'knee-pain': '膝の痛み（腸脛靱帯炎・膝蓋腱炎など）',
  'hip-pain': '股関節痛（股関節唇損傷など）',
  osgood: 'オスグッド・シュラッター病',
  severs: 'シーバー病（踵骨骨端症）',
  spondylolysis: '腰椎分離症',
  'lower-back': '腰痛（スポーツ腰部障害）',
  wrist: '手関節障害（TFCC損傷など）',
}

/**
 * 症状ページ用の MedicalWebPage 構造化データ。
 * 「このページは○○という疾患について扱う医療情報である」とAI/検索に明示する。
 * 生成AIが疾患名クエリでこのページを参照しやすくなる。
 */
export function symptomMedicalWebPageJsonLd(
  slug: string,
): Record<string, unknown> {
  const condition = SYMPTOM_CONDITIONS[slug] ?? SYMPTOM_NAMES[slug] ?? '症状'
  const url = `${SITE_URL}/symptoms/${slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    url,
    inLanguage: 'ja',
    name: `${condition}｜下関のリハビリ対応`,
    about: {
      '@type': 'MedicalCondition',
      name: condition,
    },
    // 施術主体（院）を関連付け、地域医療情報としての文脈を与える
    mainEntityOfPage: url,
    audience: { '@type': 'MedicalAudience', audienceType: 'Patient' },
    medicalAudience: 'Patient',
    lastReviewed: new Date().toISOString().slice(0, 10),
    provider: { '@id': `${SITE_URL}/#clinic` },
    specialty: 'Physiotherapy',
  }
}

/** FAQ の構造化データ（FAQPage）。Q&A 配列から生成する */
export function faqPageJsonLd(
  items: { q: string; a: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
}
