import type { Metadata } from 'next'

/**
 * プライバシーポリシー（個人情報の取り扱い）
 *
 * Google の OAuth 同意画面（Googleビジネスプロフィールへの投稿連携）を「本番環境」に公開するには、
 * プライバシーポリシーの URL が必要なため設けた。院の個人情報の扱い全体を書いている。
 * 外部サービスの一覧は、実際に使っているもの（予約=GAS、LINE、Vercel/Supabase、紹介状下書き=Anthropic）と
 * 合わせること。使うサービスが変わったら、ここも直す。
 */
export const metadata: Metadata = {
  title: 'プライバシーポリシー',
  description: 'ゆうき整骨院（山口県下関市）の個人情報の取り扱いについて。取得する情報、利用目的、外部サービスの利用、お問い合わせ窓口。',
  alternates: { canonical: '/privacy' },
}

const ESTABLISHED = '2026年10月29日'

type Section = { title: string; body?: string[]; items?: string[]; after?: string[] }

const sections: Section[] = [
  {
    title: '取得する情報',
    body: ['当院は、施術やご予約のために、次の情報をお預かりします。'],
    items: [
      'お名前・ふりがな、生年月日、性別、住所、電話番号',
      '健康保険証など、保険に関する情報',
      '症状、既往歴、検査や施術の内容など、健康に関する情報',
      'ご予約の日時や内容',
      '公式LINEやLINEからのご予約・カルテ連携をご利用の場合は、LINEのユーザー識別子・表示名と患者番号',
    ],
  },
  {
    title: '利用する目的',
    items: [
      'ご予約の受付と、確認・変更のご連絡',
      '施術、施術録の作成・管理、経過の確認',
      '療養費の請求など、保険に関する事務',
      '医療機関へのご紹介と、紹介状の作成',
      '公式LINEでのお知らせ（ご予約、患者番号の連携、休診のご案内など）',
      '院の運営の見直し（個人が分からない形に集計してから使います）',
    ],
  },
  {
    title: '第三者への提供',
    body: ['次の場合を除き、ご本人の同意を得ずに第三者へ提供することはありません。'],
    items: [
      '法令に基づく場合',
      '人の生命・身体・財産を守るために必要で、ご本人の同意を得ることが難しい場合',
      '保険者への療養費の請求など、保険の制度に基づいて必要な場合',
      'ご紹介先の医療機関へ情報をお伝えする場合（ご本人にご説明したうえで行います）',
    ],
  },
  {
    title: '業務の委託と外部サービスの利用',
    body: [
      '予約の管理、メッセージの送信、記録の保管、書類の下書き作成などのために外部の事業者のサービスを使い、必要な範囲で個人情報の取り扱いを任せることがあります。主なものは次のとおりです。',
    ],
    items: [
      '予約の管理：Google（スプレッドシート・Apps Script）',
      '公式LINE・LINEからのご予約：LINEヤフー株式会社',
      'ホームページ・院内システムの運用と記録の控えの保管：Vercel、Supabase',
      '紹介状など文章の下書き作成：Anthropic（AIのサービス。お名前や症状など、下書きに必要な情報を送ります）',
    ],
    after: [
      'これらには海外（米国など）の事業者が含まれ、情報が海外のサーバーで保管・処理される場合があります。個人情報を適切に扱う事業者を選び、必要な管理を行います。',
    ],
  },
  {
    title: 'Googleのサービスとの連携について',
    body: [
      '当院は、Googleビジネスプロフィール（Googleマップや検索に表示される院の情報）へのお知らせの投稿を院内システムから行うため、Googleの許可を受けて連携しています。',
      'この連携で扱うのは当院のビジネスプロフィールの情報と投稿だけで、患者さんの個人情報をGoogleへ送ることはありません。Googleから受け取る情報は投稿の目的以外には使わず、第三者に提供しません。',
    ],
  },
  {
    title: '安全管理',
    body: ['紛失、漏えい、不正なアクセスなどを防ぐため、院内システムを使える人の制限など、必要な対策を行います。'],
  },
  {
    title: '開示・訂正・利用停止などのご請求',
    body: [
      'ご本人から、個人情報の開示、訂正、利用の停止などのご請求があったときは、ご本人であることを確認したうえで、法令に従って対応します。下の窓口までお申し出ください。',
    ],
  },
  {
    title: '見直しについて',
    body: ['この方針は、法令の改正などに合わせて見直すことがあります。変えたときは、このページでお知らせします。'],
  },
]

export default function PrivacyPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-14 md:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="text-blue-300 text-sm font-bold tracking-widest uppercase">Privacy Policy</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mt-2 mb-3">プライバシーポリシー</h1>
          <p className="text-blue-100">個人情報の取り扱いについて</p>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 text-slate-700 leading-relaxed">
          <p className="mb-10">
            ゆうき整骨院（以下「当院」）は、患者さんからお預かりする個人情報を大切に扱うことを責務と考え、個人情報の保護に関する法律などの法令と、柔道整復師としての守秘義務を守り、次のとおり取り扱います。
          </p>

          <ol className="space-y-10">
            {sections.map((section, i) => (
              <li key={section.title}>
                <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-3">
                  {i + 1}. {section.title}
                </h2>
                {section.body?.map((text) => (
                  <p key={text} className="mb-3">
                    {text}
                  </p>
                ))}
                {section.items && (
                  <ul className="list-disc pl-6 space-y-1.5">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {section.after?.map((text) => (
                  <p key={text} className="mt-3">
                    {text}
                  </p>
                ))}
              </li>
            ))}
          </ol>

          <div className="mt-12 rounded-xl bg-blue-50 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3">お問い合わせ窓口</h2>
            <p className="font-bold text-slate-800">ゆうき整骨院</p>
            <p>山口県下関市彦島江の浦町9丁目1-14</p>
            <p>
              電話：<a href="tel:0832654545" className="text-blue-700 underline">083-265-4545</a>（診療時間内に受け付けています）
            </p>
          </div>

          <p className="mt-8 text-sm text-slate-500">制定日：{ESTABLISHED}</p>
        </div>
      </section>
    </div>
  )
}
