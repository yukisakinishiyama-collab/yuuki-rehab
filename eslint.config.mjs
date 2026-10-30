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
        // （まだ決まりは入っていない。足し方は上の「決まりを足すときは」）
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
