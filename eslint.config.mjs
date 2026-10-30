import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ── 院内アプリの見た目の決まり（DESIGN_DECISIONS.md「院内アプリの見た目の決まり」）を lint で守る ──
// 院内アプリのファイルだけが対象（ホームページ・LINE予約は対象外）。
// 止められるのは、クラス名や数字を「そのまま書いた」ものだけ。変数や計算で決める大きさ・色（size * 0.1 など）は止まらないので、
// そういう所を書くときは決まりを読んで合わせる。
// この決まりだけを確かめるのは `npm run lint:design`（tools/lint-design.mjs。PR のたびに GitHub でも動く）。
// 決まりを足すときは、この no-restricted-syntax の中に足す（lint:design はこのルールだけを動かすため）。
// 足すときは、今ある画面をその決まりに合わせる変更と同じコミットに入れる（合わない所が残ると、どの PR にも ✗ が付くため）。

/** 12px より小さい文字のクラス名（text- のあとの角かっこに 11px・9.5px・0.65rem・length:10px などを書いたもの） */
const TINY_TEXT_CLASS =
  "/text-\\[(?:length:)?(?:(?:[0-9]|1[01])(?:\\.[0-9]+)?px|0?\\.(?:[0-6][0-9]*|7(?:[0-4][0-9]*)?)r?em)\\]/";
/** 12 より小さい数（fontSize="10"・fontSize: '11px' などの文字の形） */
const TINY_NUMBER_STRING = "/^(?:[0-9]|1[01])(?:\\.[0-9]+)?(?:px)?$/";
const TINY_TEXT_MESSAGE =
  "院内アプリでは 12px より小さい文字は使いません（スマホで読みにくいため）。text-xs（12px）・fontSize 12 以上にしてください。";

const clinicLook = (selector, message) => [
  { selector: `Literal[value=${selector}]`, message },
  { selector: `TemplateElement[value.raw=${selector}]`, message },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "src/app/(app)/**/*.{ts,tsx}",
      "src/components/{clinic,rehab,rehab-management,ui}/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // 文字の大きさ（クラス名）
        ...clinicLook(TINY_TEXT_CLASS, TINY_TEXT_MESSAGE),
        // 文字の大きさ（グラフ・図の fontSize。style={{ fontSize: 10 }}・tick={{ fontSize: 11 }}・<text fontSize="10">）
        { selector: "Property[key.name='fontSize'] > Literal[value<12]", message: TINY_TEXT_MESSAGE },
        { selector: `Property[key.name='fontSize'] > Literal[value=${TINY_NUMBER_STRING}]`, message: TINY_TEXT_MESSAGE },
        { selector: "JSXAttribute[name.name='fontSize'] > JSXExpressionContainer > Literal[value<12]", message: TINY_TEXT_MESSAGE },
        { selector: `JSXAttribute[name.name='fontSize'] > Literal[value=${TINY_NUMBER_STRING}]`, message: TINY_TEXT_MESSAGE },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
