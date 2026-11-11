'use client'
// ──────────────────────────────────────────────
// 署名済みの書類を PDF にして、共有の画面（AirPrint の「プリント」・「ファイルに保存」）へ渡す
//
// iPad のホーム画面から開いたアプリ（ホーム画面のアイコン）では、印刷の画面（window.print）が
// 出ないことがあるため（2026-11-11 院長「登録・印刷ができない」）。
// 文面はこの端末の中だけで画像にして PDF にする（外へは送らない）。重い部品は押したときだけ読み込む。
// ──────────────────────────────────────────────
import { CONTRACT_PRINT_CSS } from './template'
import { copyPage } from './print'

/** ホーム画面のアイコンから開いている（Safari の画面ではない） */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || Boolean(window.matchMedia?.('(display-mode: standalone)').matches)
}

const A4_W = 794 // 96dpi の A4 の幅（px）

/** 署名済みの本文（HTML）から PDF を作る。copies の順に、1部ずつページを分ける */
export async function buildContractPdf(html: string, recordId: string, labels: string[]): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
  const pageW = 210
  const pageH = 297
  const margin = 10
  const innerW = pageW - margin * 2
  const innerH = pageH - margin * 2
  let first = true

  for (const label of labels) {
    const host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    host.style.cssText = `position:fixed;left:-20000px;top:0;width:${A4_W - 76}px;background:#fff;padding:0;margin:0;z-index:-1`
    host.innerHTML =
      `<style>${CONTRACT_PRINT_CSS}</style>` +
      `<section class="contract-paper">${copyPage(html.replace('<h3>署名欄</h3>', `<h3>署名欄（${label}）</h3>`), label, `記録ID ${recordId}`)}</section>`
    document.body.appendChild(host)
    try {
      // 署名の画像が読み終わるのを待つ
      await Promise.all(
        Array.from(host.querySelectorAll('img')).map((img) =>
          img.complete ? Promise.resolve() : new Promise<void>((r) => ((img.onload = () => r()), (img.onerror = () => r()))),
        ),
      )
      const canvas = await html2canvas(host, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: false })
      // 縦に長い1枚を A4 の高さで切る（文字の途中で切らないよう、切れ目の少し上の白い行で切る）
      const pxPerMm = canvas.width / innerW
      const slicePx = Math.floor(innerH * pxPerMm)
      const full = canvas.getContext('2d', { willReadFrequently: true })
      const cleanCut = (y: number): number => {
        if (!full) return y
        const minY = Math.max(y - Math.floor(slicePx * 0.12), 1)
        for (let yy = y; yy > minY; yy--) {
          const row = full.getImageData(0, yy, canvas.width, 1).data
          let white = true
          for (let i = 0; i < row.length; i += 4) {
            if (row[i] < 240 || row[i + 1] < 240 || row[i + 2] < 240) {
              white = false
              break
            }
          }
          if (white) return yy
        }
        return y
      }
      let y = 0
      while (y < canvas.height) {
        let end = Math.min(y + slicePx, canvas.height)
        if (end < canvas.height) end = cleanCut(end)
        const h = end - y
        const part = document.createElement('canvas')
        part.width = canvas.width
        part.height = h
        const ctx = part.getContext('2d')
        if (!ctx) throw new Error('画像を作れませんでした（端末のメモリ）')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, part.width, part.height)
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
        if (!first) pdf.addPage()
        first = false
        pdf.addImage(part.toDataURL('image/jpeg', 0.85), 'JPEG', margin, margin, innerW, h / pxPerMm)
        part.width = 0
        part.height = 0
        y = end
      }
      canvas.width = 0
      canvas.height = 0
    } finally {
      host.remove()
    }
  }
  return pdf.output('blob')
}

/** PDF のファイルを作る（作るのに数秒かかる。共有は、このあと別のボタンで押す） */
export async function buildContractPdfFile(html: string, recordId: string, labels: string[], title: string): Promise<File> {
  const blob = await buildContractPdf(html, recordId, labels)
  const name = `${title}_${labels.join('・')}_${recordId}.pdf`.replace(/[\\/:*?"<>|\s]+/g, '_')
  return new File([blob], name, { type: 'application/pdf' })
}

/**
 * 共有の画面を出す（iPad では「プリント」を選ぶと印刷、「"ファイル"に保存」で保存）。
 * Safari は、ボタンを押したその場で呼ばないと共有の画面を出さないため、押した処理の中ですぐ呼ぶ。
 * 共有できない端末では、PDF を開く（そこから印刷・保存）
 */
export async function shareOrOpenPdf(file: File): Promise<'shared' | 'opened' | 'cancelled'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // 共有できなかったら、開く方へ
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 120_000)
  return 'opened'
}
