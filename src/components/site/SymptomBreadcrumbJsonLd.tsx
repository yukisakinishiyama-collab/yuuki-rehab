/**
 * 症状ページ用の構造化データをまとめて描画する。
 * slug を渡すだけで、以下2つの JSON-LD を出力する:
 *  - BreadcrumbList（ホーム > 症状一覧 > 各症状）
 *  - MedicalWebPage（このページが扱う疾患を about で明示 = AI検索対策）
 */
import JsonLd from './JsonLd'
import {
  symptomBreadcrumbJsonLd,
  symptomMedicalWebPageJsonLd,
} from '@/lib/site/seo'

export default function SymptomBreadcrumbJsonLd({ slug }: { slug: string }) {
  return (
    <>
      <JsonLd data={symptomBreadcrumbJsonLd(slug)} />
      <JsonLd data={symptomMedicalWebPageJsonLd(slug)} />
    </>
  )
}
