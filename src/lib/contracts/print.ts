'use client'
// ──────────────────────────────────────────────
// 契約書の印刷（院保管用・患者様控え・白紙）
// 同じ画面の中に印刷用の場所（#contract-print-root）を作り、印刷のときだけそこを出す。
// （別のウィンドウを開く印刷は、タブレットでは止められたり、ページ全体が出たりするため）
// ──────────────────────────────────────────────
import { CONTRACT_PRINT_CSS, escapeHtml, jaDate } from './template'

export interface SignatureBlockInput {
  date: string // YYYY-MM-DD
  patientName: string
  guardianName?: string
  relation?: string
  staffLabel: string
  staffName: string
  sigPatient?: string | null
  sigGuardian?: string | null
  sigStaff?: string | null
}

function sigCell(name: string, sig: string | null | undefined, blank: boolean): string {
  if (blank) return '<div class="sig-empty"></div>'
  const img = sig && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig) ? `<div class="sig"><img src="${sig}" alt="署名"></div>` : ''
  return `${escapeHtml(name)}${img}`
}

/** 署名欄（blank=true なら手書き用の空欄） */
export function signatureBlockHtml(s: SignatureBlockInput, blank = false): string {
  let rows = `<tr><th>説明日・署名日</th><td>${blank ? '<div class="sig-empty" style="height:18pt"></div>' : escapeHtml(jaDate(s.date))}</td></tr>`
  rows += `<tr><th>患者様氏名</th><td>${sigCell(s.patientName, s.sigPatient, blank)}</td></tr>`
  if (blank || s.guardianName) {
    const rel = s.relation ? `（${escapeHtml(s.relation)}）` : ''
    rows += `<tr><th>保護者氏名${blank ? '（患者様が未成年の場合）' : rel}</th><td>${sigCell(s.guardianName ?? '', s.sigGuardian, blank)}</td></tr>`
  }
  rows += `<tr><th>${escapeHtml(s.staffLabel)}</th><td>${sigCell(s.staffName, s.sigStaff, blank)}</td></tr>`
  return `<h3>署名欄</h3><table class="sigtable">${rows}</table>`
}

/** 1枚分（上に「院保管用」「患者様控え」などの印をつける） */
export function copyPage(inner: string, label: string, meta: string): string {
  return `<div class="copy-label"><span>ゆうき整骨院${meta ? `　${escapeHtml(meta)}` : ''}</span>${label ? `<b>${escapeHtml(label)}</b>` : ''}</div>${inner}`
}

export function printPages(pages: string[]): void {
  let root = document.getElementById('contract-print-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'contract-print-root'
    document.body.appendChild(root)
  }
  root.innerHTML =
    `<style>${CONTRACT_PRINT_CSS}
@page{size:A4;margin:13mm 12mm}
@media screen{#contract-print-root{display:none}}
@media print{
  body.printing-contract > *:not(#contract-print-root){display:none !important}
  body.printing-contract #contract-print-root{display:block !important}
  #contract-print-root .contract-page{break-after:page;page-break-after:always}
  #contract-print-root .contract-page:last-child{break-after:auto;page-break-after:auto}
}</style>` + pages.map((p) => `<section class="contract-paper contract-page">${p}</section>`).join('')
  document.body.classList.add('printing-contract')
  const done = () => {
    document.body.classList.remove('printing-contract')
    if (root) root.innerHTML = ''
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  setTimeout(() => window.print(), 80)
}

/** 署名済みの書類を印刷する（院保管用と患者様控えの2部、または控えだけ） */
export function printSigned(html: string, recordId: string, copies: 'both' | 'patient' | 'clinic' = 'both'): void {
  const labels = copies === 'both' ? ['院保管用', '患者様控え'] : copies === 'patient' ? ['患者様控え'] : ['院保管用']
  // 署名欄のページにも「院保管用」「患者様控え」を出す（2枚目以降のページで、どちらの控えか分かるように）
  printPages(labels.map((label) => copyPage(html.replace('<h3>署名欄</h3>', `<h3>署名欄（${label}）</h3>`), label, `記録ID ${recordId}`)))
}
