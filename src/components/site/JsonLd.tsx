/**
 * JSON-LD 構造化データを安全に描画する共通コンポーネント
 *
 * Next.js 公式推奨の方式: <script type="application/ld+json"> を描画し、
 * XSS 対策として "<" を < にエスケープする（JSON.stringify は無害化しないため）。
 * サーバー/クライアントどちらのツリーからも利用できる。
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
