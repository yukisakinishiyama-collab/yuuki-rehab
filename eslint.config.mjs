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

/** 白い地で読めない薄い灰色の文字（text-gray-400・text-slate-300 など。hover: などの前置きつきは対象外） */
const FAINT_TEXT = "/(?:^|\\s)text-(?:gray|slate|zinc|neutral|stone)-[34]00(?:\\s|$)/";
const FAINT_TEXT_MESSAGE =
  "院内アプリでは、白い地の文字・アイコンを slate-500 より薄くしません（読めないため）。text-slate-500 以上を使ってください（暗い地の上なら text-white/70 など）。";

/**
 * 白い地で読めない薄い色つきの文字（text-teal-600・text-green-600・text-amber-500・text-red-500 など。前置きつきは対象外）。
 * 白い地でコントラスト比 4.5 に届くのは、teal・green・amber などは 700、red・blue・indigo などは 600 から
 */
const FAINT_COLOR_TEXT =
  "/(?:^|\\s)text-(?:(?:teal|emerald|green|cyan|sky|lime|yellow|amber|orange)-[3-6]00|(?:red|blue|indigo|purple|violet|pink|rose|fuchsia)-[3-5]00)(?:\\s|$)/";
const FAINT_COLOR_TEXT_MESSAGE =
  "院内アプリでは、白い地の色つきの文字・アイコンを薄い色で書きません（読めないため）。teal・emerald・green・cyan・sky・lime・yellow・amber・orange は 700 以上、red・blue・indigo・purple・violet・pink・rose・fuchsia は 600 以上にしてください（暗い地の上なら text-teal-200 など）。";

/** 色コードで書いた文字の色（text-[#0d9488] など）。濃さを lint で確かめられないので、Tailwind の名前で書く */
const HEX_TEXT_CLASS = "/(?:^|\\s)text-\\[#[0-9a-fA-F]{3,8}\\]/";
const HEX_TEXT_CLASS_MESSAGE =
  "文字の色は色コード（text-[#0d9488] など）ではなく、Tailwind の名前（text-teal-700 など）で書いてください（読める濃さを lint で確かめるため）。";

/**
 * 図の文字（<text fill="…">、グラフの目盛り・数字の fill）と style の color に、色コードで書いてよい色。
 * どれも白い地でコントラスト比 4.5 以上（slate・gray は 500 から、teal・emerald・green・amber・orange は 700 から、red・blue は 600 から）。
 * ここにない色を使いたいときは、白い地で 4.5 以上あることを確かめてから足す
 */
const READABLE_HEX =
  "/^#(?:64748b|475569|334155|1e293b|0f172a|6b7280|4b5563|374151|1f2937|111827|0f766e|115e59|047857|065f46|15803d|166534|b45309|92400e|c2410c|9a3412|dc2626|b91c1c|991b1b|2563eb|1d4ed8)$/i";
const HEX = "/^#/";
const HEX_TEXT_MESSAGE =
  "図の文字・style の文字の色が、白い地で読める色ではありません。eslint.config.mjs の READABLE_HEX の色（灰色 #64748b・緑 #0f766e・茶 #b45309・赤 #dc2626 など）を使ってください。線や塗りの色はそのままでよく、文字だけ濃い色にします。";

/** 黒・濃い灰色の塗りに白い文字（選んでいるもの・主ボタンを黒で示す書き方） */
const DARK_FILL = "/(?:^|\\s)bg-(?:slate|gray|zinc|neutral|stone)-(?:800|900|950)(?:\\s|$)/";
const DARK_FILL_MESSAGE =
  "院内アプリでは、選んでいるもの・いちばん大事な操作のボタンは teal-700（ui/button の default）で示します。黒い塗りに白い文字は使いません（色の意味を全画面で1つにするため）。画面に重ねる幕・お知らせの帯は bg-slate-900/90 のように透明度を付けて書きます。";

/** 白い文字（text-white）と、白い文字が読めない明るい地の色が、同じクラス名の中にある */
const WHITE_TEXT = "/(?:^|\\s)text-white(?:\\s|$)/";
const LIGHT_BG =
  "/(?:^|\\s)bg-(?:(?:teal|emerald|green|cyan|sky|orange|amber|yellow|lime)-(?:50|[1-6]00)|(?:red|blue|purple|violet|pink|rose|fuchsia)-(?:50|[1-5]00)|indigo-(?:50|[1-4]00)|(?:slate|gray|zinc|neutral|stone)-(?:50|[1-4]00))(?:\\s|$)/";
const WHITE_ON_LIGHT_MESSAGE =
  "白い文字をのせる地の色が明るすぎて読めません（コントラスト比 4.5 未満）。teal・green などは 700、red・blue などは 600 以上にするか、黄色系なら文字を濃い色（text-amber-950 など）にしてください。";

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
        // 色
        ...clinicLook(FAINT_TEXT, FAINT_TEXT_MESSAGE),
        ...clinicLook(FAINT_COLOR_TEXT, FAINT_COLOR_TEXT_MESSAGE),
        ...clinicLook(HEX_TEXT_CLASS, HEX_TEXT_CLASS_MESSAGE),
        { selector: `Literal[value=${WHITE_TEXT}][value=${LIGHT_BG}]`, message: WHITE_ON_LIGHT_MESSAGE },
        { selector: `TemplateElement[value.raw=${WHITE_TEXT}][value.raw=${LIGHT_BG}]`, message: WHITE_ON_LIGHT_MESSAGE },
        { selector: `Literal[value=${WHITE_TEXT}][value=${DARK_FILL}]`, message: DARK_FILL_MESSAGE },
        { selector: `TemplateElement[value.raw=${WHITE_TEXT}][value.raw=${DARK_FILL}]`, message: DARK_FILL_MESSAGE },
        // 色（図の文字・style の color に色コードで書いたもの。<text fill="#0d9488">・tick={{ fontSize: 12, fill: '#94a3b8' }}・style={{ color: '#fff' }}）
        { selector: `JSXOpeningElement[name.name='text'] > JSXAttribute[name.name='fill'] > Literal[value=${HEX}]:not([value=${READABLE_HEX}])`, message: HEX_TEXT_MESSAGE },
        {
          selector: `JSXOpeningElement[name.name='text'] > JSXAttribute[name.name='fill'] > JSXExpressionContainer > Literal[value=${HEX}]:not([value=${READABLE_HEX}])`,
          message: HEX_TEXT_MESSAGE,
        },
        {
          selector: `ObjectExpression:has(> Property[key.name='fontSize']) > Property[key.name='fill'] > Literal[value=${HEX}]:not([value=${READABLE_HEX}])`,
          message: HEX_TEXT_MESSAGE,
        },
        {
          selector: `JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[key.name='color'] > Literal[value=${HEX}]:not([value=${READABLE_HEX}])`,
          message: HEX_TEXT_MESSAGE,
        },
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
