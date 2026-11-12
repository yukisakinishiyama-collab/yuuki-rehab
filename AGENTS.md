<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## 外部AIエージェント（ChatGPT / Codex など）向けのルール

1. `main` へ直接コミットせず **Pull Request を作成**する（最終確認は院長が行う）
2. `.env*` ファイルは読まない・変更しない
3. 医療広告ガイドラインに配慮し、治癒を保証するような誇張表現は書かない・載せない
4. 院内アプリは「予約管理・カルテ・経営・集客」に絞っている。削除済みの機能（動作解析、プロトコル立案、
   疾患/文献ライブラリ、イラスト管理、患者さん向けの説明・問診・カラダマップ）を戻す変更は、院長の確認なしに行わない
<!-- END:nextjs-agent-rules -->
