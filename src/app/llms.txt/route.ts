/**
 * /llms.txt — AI/LLM 向けの構造化されたサイト案内（llmstxt.org 準拠）
 *
 * ChatGPT・Perplexity・Google AI Overview などの生成AIが、院の要点と
 * 主要ページを短時間で正確に把握できるよう、Markdown で提供する。
 * 院情報(NAP)は clinic.ts、症状は seo.ts、記事は blog.ts を正本として生成する。
 */
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'
import { SITE_URL, SYMPTOM_NAMES } from '@/lib/site/seo'
import { BLOG_POSTS } from '@/lib/site/blog'

// 静的生成（内容はデプロイ時点で確定）
export const dynamic = 'force-static'

export function GET(): Response {
  const c = DEFAULT_CLINIC_PROFILE

  const symptoms = Object.entries(SYMPTOM_NAMES)
    .map(([slug, name]) => `- [${name}](${SITE_URL}/symptoms/${slug})`)
    .join('\n')

  const articles = BLOG_POSTS.map(
    (p) => `- [${p.title}](${SITE_URL}/blog/${p.slug}): ${p.excerpt}`,
  ).join('\n')

  const body = `# ${c.name}｜下関・彦島のスポーツ障害・術前術後リハビリ専門整骨院

> 山口県下関市彦島のスポーツ障害・術前術後リハビリ専門整骨院。運動療法と動作改善を軸に、医学的根拠に基づいた評価と施術を行う。学生アスリートの外傷・成長期障害から、ACL等の術後リハビリ・競技復帰まで対応。医師・医療機関と連携。

## 院の基本情報（NAP）

- 院名: ${c.name}（YUUKI SEIKOTSU-IN）
- 所在地: ${c.address}（${c.parking}）
- 電話: ${c.phone}
- 診療時間: ${c.hours}
- 休診: ${c.closedDays}
- 公式サイト: ${SITE_URL}
- ネット予約（24時間・即時確定）: ${c.reserveUrl}
- 公式LINE（友だち追加・予約相談）: ${c.lineUrl}
- Googleビジネスプロフィール: ${c.googleMapUrl}
- Instagram: ${c.instagramUrl}

## 対応内容

${c.services}

## 対応できない内容（他院・医療機関を案内）

${c.notServices}

## 料金の目安

${c.priceSummary}

## 初回の流れ

${c.firstVisitFlow}

## 院の強み

${c.strengths}

## 症状別ページ（下関でこれらの症状・リハビリに対応）

${symptoms}

## お役立ち記事

${articles}

## 主要ページ

- [トップ](${SITE_URL}/)
- [症状・お悩み一覧](${SITE_URL}/symptoms)
- [初めての方へ](${SITE_URL}/first-visit)
- [料金案内](${SITE_URL}/price)
- [よくある質問](${SITE_URL}/faq)
- [アクセス・診療時間](${SITE_URL}/access)
- [ブログ](${SITE_URL}/blog)

## 医療広告・表現に関する注意

このサイトおよび院は、日本の医療広告ガイドラインに沿い「完全治癒」「必ず治る」
「1回で治る」等の断定的表現を用いない。効果や回復には個人差がある。症状によっては
整形外科など医療機関の受診を案内する。

---
最終更新の基準: このファイルはデプロイ時に公式データから自動生成される。
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
