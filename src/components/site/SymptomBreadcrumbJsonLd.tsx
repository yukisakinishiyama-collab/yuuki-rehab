/**
 * 症状ページ用のパンくず（BreadcrumbList）構造化データを描画する。
 * slug を渡すだけで「ホーム > 症状一覧 > 各症状」の JSON-LD を出力する。
 */
import JsonLd from './JsonLd'
import { symptomBreadcrumbJsonLd } from '@/lib/site/seo'

export default function SymptomBreadcrumbJsonLd({ slug }: { slug: string }) {
  return <JsonLd data={symptomBreadcrumbJsonLd(slug)} />
}
