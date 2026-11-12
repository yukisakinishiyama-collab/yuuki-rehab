// tools/ のテストをまとめて走らせる（外には送らない・データはすべて架空）
// 実行: npm run test:tools
// どのテストも tsx で走らせる（@/ の読み替えが要るものがあるため。node だけだと一部が「見つからない」で止まる）
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const files = [
  ...readdirSync('tools').filter((f) => /^test-.*\.mjs$/.test(f)).map((f) => `tools/${f}`),
  ...readdirSync('tools/marketing').filter((f) => /^test-.*\.mjs$/.test(f)).map((f) => `tools/marketing/${f}`),
].sort()

const failed = []
for (const file of files) {
  const r = spawnSync('npx', ['tsx', file], { encoding: 'utf8', shell: process.platform === 'win32' })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const ok = r.status === 0 && !/\d+\s*件失敗/.test(out.replace(/\b0\s*件失敗/g, ''))
  console.log(`${ok ? '✓' : '✗'} ${file}`)
  if (!ok) {
    failed.push(file)
    console.log(out.split('\n').filter((l) => /✗|Error|実際|expected|actual/.test(l)).slice(0, 12).join('\n'))
  }
}
console.log(`\n${files.length - failed.length} / ${files.length} 本が通りました`)
if (failed.length) process.exit(1)
