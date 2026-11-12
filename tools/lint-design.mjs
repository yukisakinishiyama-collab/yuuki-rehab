// 院内アプリの見た目の決まり（DESIGN_DECISIONS.md「院内アプリの見た目の決まり」）だけを確かめる。
//
//   npm run lint:design
//
// eslint.config.mjs の no-restricted-syntax（院内アプリのファイルにだけ掛けている「文字の大きさ・色・ボタンの高さ」の決まり）
// だけを動かして、1か所でもあれば失敗で終わる。ほかの lint の指摘（元からあるもの）とは分けている。
// `npm run lint` は元からのエラーが残っていていつも失敗で終わり、新しい違反が目立たないため。
// Pull Request のたびに GitHub でも動く（.github/workflows/design-check.yml）。
import { ESLint } from 'eslint'

const eslint = new ESLint({
  ruleFilter: ({ ruleId }) => ruleId === 'no-restricted-syntax',
  // ほかの決まりを止めているコメント（eslint-disable）を「使われていない」と言わないように
  overrideConfig: { linterOptions: { reportUnusedDisableDirectives: 'off' } },
})
const results = ESLint.getErrorResults(await eslint.lintFiles(['src']))
const count = results.reduce((n, r) => n + r.errorCount, 0)

if (count > 0) {
  const formatter = await eslint.loadFormatter('stylish')
  console.log(await formatter.format(results))
  console.error(`院内アプリの見た目の決まりに合わないところが ${count} か所あります。DESIGN_DECISIONS.md「院内アプリの見た目の決まり」を見て直してください。`)
  process.exit(1)
}
console.log('院内アプリの見た目の決まり：合わないところはありません。')
