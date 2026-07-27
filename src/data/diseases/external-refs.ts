// 外部参考リンクの生成
// 方針: 特定の論文・画像を「確定した出典」として埋め込むのではなく、
//   実在する公開データベースの「検索結果ページ」へのリンクを提供する。
//   これにより出典の捏造を避けつつ、利用者が一次情報・ライセンスを自分で確認できる。
//   画像はCCライセンス確認用にWikimedia Commonsのメディア検索へ誘導する（埋め込みはしない）。

import type { DiseasePage } from '@/types/disease'

export interface ExternalRef {
  label: string
  url: string
  note: string
}

const enc = encodeURIComponent

export function buildExternalRefs(page: DiseasePage): ExternalRef[] {
  const en = page.names.en
  const ja = page.names.ja
  return [
    {
      label: 'PubMed で検索',
      url: `https://pubmed.ncbi.nlm.nih.gov/?term=${enc(en)}`,
      note: '英語の原著論文・システマティックレビューを検索（一次情報の確認用）',
    },
    {
      label: 'Google Scholar で検索',
      url: `https://scholar.google.com/scholar?q=${enc(en + ' rehabilitation')}`,
      note: '学術文献の横断検索',
    },
    {
      label: 'J-STAGE で検索',
      url: `https://www.jstage.jst.go.jp/result/global/-char/ja?globalSearchKey=${enc(ja)}`,
      note: '国内の学会誌・和文論文を検索',
    },
    {
      label: 'MSDマニュアル プロフェッショナル版',
      url: `https://www.msdmanuals.com/ja-jp/professional/search?query=${enc(ja)}`,
      note: '医療従事者向けの標準的な疾患解説（内容は要確認）',
    },
    {
      label: 'Wikimedia Commons で画像を探す',
      url: `https://commons.wikimedia.org/w/index.php?search=${enc(en)}&title=Special:MediaSearch&type=image`,
      note: 'CCライセンス等の解剖画像の検索。利用時は各画像のライセンス表示を必ず確認',
    },
  ]
}
