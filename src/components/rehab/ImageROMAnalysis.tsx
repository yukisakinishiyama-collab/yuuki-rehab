'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, Loader2, Camera, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import type { ROMItem } from '@/lib/pose-analyzer'

interface ImageResult {
  id: string
  file: File
  originalUrl: string
  annotatedUrl: string | null
  poseSide: 'front' | 'side' | 'unknown'
  romItems: ROMItem[]
  processing: boolean
  error?: string
}

const PLANE_COLOR: Record<string, string> = {
  '矢状面(前後)': '#0d9488',
  '前額面(左右)': '#7c3aed',
}
const SIDE_COLOR: Record<string, string> = { L: '#3b82f6', R: '#ef4444', C: '#16a34a' }

function statusOf(item: ROMItem): 'normal' | 'caution' | 'alert' {
  if (item.value >= item.normalMin && item.value <= item.normalMax) return 'normal'
  const dev = Math.min(Math.abs(item.value - item.normalMin), Math.abs(item.value - item.normalMax))
  return dev > 15 ? 'alert' : 'caution'
}

const STATUS_COLOR = { normal: '#16a34a', caution: '#d97706', alert: '#dc2626' }
const STATUS_LABEL = { normal: '正常範囲', caution: '要注意', alert: '要改善' }

function ROMCard({ item }: { item: ROMItem }) {
  const st = statusOf(item)
  return (
    <div style={{
      background: '#fff',
      borderRadius: '10px',
      padding: '10px 12px',
      borderLeft: `4px solid ${STATUS_COLOR[st]}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '9px', fontWeight: '800', color: SIDE_COLOR[item.side] ?? '#888',
          background: `${SIDE_COLOR[item.side] ?? '#888'}22`, padding: '1px 5px', borderRadius: '4px' }}>
          {item.side}
        </span>
        <span style={{ fontSize: '9px', fontWeight: '700', color: PLANE_COLOR[item.plane] ?? '#888',
          background: `${PLANE_COLOR[item.plane] ?? '#888'}18`, padding: '1px 5px', borderRadius: '4px' }}>
          {item.plane}
        </span>
        <span style={{ fontSize: '9px', color: '#888', background: '#f3f4f6', padding: '1px 5px', borderRadius: '4px' }}>
          {item.axis}
        </span>
      </div>
      <p style={{ fontSize: '11px', color: '#374151', fontWeight: '600', margin: '0 0 3px' }}>{item.label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
        <span style={{ fontSize: '26px', fontWeight: '900', color: '#111', lineHeight: 1 }}>{item.value}</span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.unit}</span>
        <span style={{ fontSize: '11px', fontWeight: '700', color: PLANE_COLOR[item.plane] ?? '#888' }}>
          {item.direction}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '700', color: STATUS_COLOR[st] }}>
          {STATUS_LABEL[st]}
        </span>
      </div>
      <p style={{ fontSize: '9px', color: '#9ca3af', margin: '2px 0 0' }}>
        正常: {item.normalMin}〜{item.normalMax}{item.unit}
        {item.note && <span style={{ color: '#d97706', marginLeft: '4px' }}>({item.note})</span>}
      </p>
    </div>
  )
}

function SideLabel({ poseSide }: { poseSide: string }) {
  const map = {
    front: { label: '📷 正面撮影', color: '#3b82f6', note: '前額面計測（外反/内反・外転・骨盤傾斜・肩の左右差）' },
    side:  { label: '📷 側面撮影', color: '#0d9488', note: '矢状面計測（屈曲/伸展・背屈/底屈・体幹前傾・頭部前方偏位）' },
    unknown: { label: '📷 方向不明', color: '#d97706', note: '全計測を参考値として表示しています' },
  }
  const info = map[poseSide as keyof typeof map] ?? map.unknown
  return (
    <div style={{ background: `${info.color}18`, border: `1px solid ${info.color}44`, borderRadius: '8px',
      padding: '6px 10px', marginBottom: '10px' }}>
      <p style={{ fontSize: '11px', fontWeight: '800', color: info.color, margin: 0 }}>{info.label} — AI自動判定</p>
      <p style={{ fontSize: '10px', color: '#6b7280', margin: '2px 0 0' }}>{info.note}</p>
    </div>
  )
}

export default function ImageROMAnalysis() {
  const [images, setImages] = useState<ImageResult[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File): Promise<ImageResult> => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const originalUrl = URL.createObjectURL(file)

    // base64 変換
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target!.result as string)
      reader.readAsDataURL(file)
    })

    // 画像サイズ取得
    const { w, h } = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.src = dataUrl
    })

    try {
      const { analyzeAndAnnotateFrame } = await import('@/lib/pose-analyzer')
      const { annotated, result } = await analyzeAndAnnotateFrame(dataUrl, w, h)

      if (!result.detected) {
        return { id, file, originalUrl, annotatedUrl: null, poseSide: 'unknown',
          romItems: [], processing: false, error: '骨格が検出できませんでした。全身が映っている写真を使用してください。' }
      }

      return { id, file, originalUrl, annotatedUrl: annotated,
        poseSide: result.poseSide, romItems: result.romItems, processing: false }
    } catch (e) {
      console.error(e)
      return { id, file, originalUrl, annotatedUrl: null, poseSide: 'unknown',
        romItems: [], processing: false, error: 'エラーが発生しました。' }
    }
  }, [])

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    // 仮エントリを追加
    const stubs: ImageResult[] = imageFiles.map((file) => ({
      id: `stub-${Date.now()}-${Math.random()}`,
      file, originalUrl: URL.createObjectURL(file),
      annotatedUrl: null, poseSide: 'unknown', romItems: [],
      processing: true,
    }))
    setImages((prev) => [...prev, ...stubs])

    // 順次処理
    const results = await Promise.all(imageFiles.map((f) => processFile(f)))
    setImages((prev) => {
      const next = [...prev]
      for (let i = 0; i < stubs.length; i++) {
        const idx = next.findIndex((x) => x.id === stubs[i].id)
        if (idx !== -1) next[idx] = results[i]
      }
      return next
    })
  }, [processFile])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
  }, [addFiles])

  const remove = (id: string) => {
    setImages((prev) => prev.filter((x) => x.id !== id))
  }

  // 正面・側面のまとめ
  const frontResults = images.filter((x) => !x.processing && x.poseSide === 'front' && x.romItems.length > 0)
  const sideResults  = images.filter((x) => !x.processing && x.poseSide === 'side'  && x.romItems.length > 0)
  const hasMultiView = frontResults.length > 0 && sideResults.length > 0

  return (
    <div style={{ padding: '16px 0' }}>

      {/* 説明 */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px',
        padding: '10px 14px', marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <Info style={{ width: 16, height: 16, color: '#3b82f6', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: '12px', fontWeight: '700', color: '#1e40af', margin: '0 0 3px' }}>
            正確なROM計測のために
          </p>
          <p style={{ fontSize: '11px', color: '#1e40af', margin: 0, lineHeight: 1.6 }}>
            <strong>正面写真</strong>: 外反/内反・外転・骨盤傾斜を計測<br />
            <strong>側面写真</strong>: 屈曲/伸展・背屈/底屈・体幹前傾を計測<br />
            両方アップロードすると全平面の評価ができます。撮影方向はAIが自動判定します。
          </p>
        </div>
      </div>

      {/* ドロップゾーン */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#0d9488' : '#d1d5db'}`,
          borderRadius: '12px',
          padding: '28px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? '#f0fdfa' : '#f9fafb',
          transition: 'all 0.15s',
          marginBottom: '20px',
        }}
      >
        <Camera style={{ width: 36, height: 36, color: dragging ? '#0d9488' : '#9ca3af', margin: '0 auto 10px' }} />
        <p style={{ fontSize: '14px', fontWeight: '700', color: '#374151', margin: '0 0 4px' }}>
          画像をドロップ、またはクリックして選択
        </p>
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
          JPEG / PNG / WebP 対応 · 複数枚同時アップロード可
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={onInputChange}
        />
      </div>

      {/* アップロードボタン（モバイル向け） */}
      {images.length === 0 && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
          <button
            onClick={() => inputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
              background: '#0d9488', color: '#fff', borderRadius: '8px', border: 'none',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
          >
            <Upload style={{ width: 14, height: 14 }} />
            画像を選択
          </button>
        </div>
      )}

      {/* 複数ビュー分析サマリー */}
      {hasMultiView && (
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#0d9488)', borderRadius: '12px',
          padding: '12px 16px', marginBottom: '16px', color: '#fff' }}>
          <p style={{ fontSize: '12px', fontWeight: '800', margin: '0 0 4px', color: '#5eead4' }}>
            ✅ 正面 + 側面 — 全平面ROM評価が揃いました
          </p>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            正面: {frontResults.length}枚 / 側面: {sideResults.length}枚 — 矢状面・前額面の両方の計測結果を確認できます
          </p>
        </div>
      )}

      {/* 各画像の結果 */}
      {images.map((img) => (
        <div key={img.id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb',
          marginBottom: '20px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>

          {/* ヘッダー */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151', margin: 0,
              maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {img.file.name}
            </p>
            <button onClick={() => remove(img.id)} style={{ background: 'none', border: 'none',
              cursor: 'pointer', color: '#9ca3af', padding: '2px' }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>

          <div style={{ padding: '14px' }}>
            {img.processing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px',
                padding: '20px', justifyContent: 'center' }}>
                <Loader2 style={{ width: 20, height: 20, color: '#0d9488', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                  MediaPipeで骨格検出・ROM計測中...
                </span>
              </div>
            ) : img.error ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px',
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px' }}>
                <AlertTriangle style={{ width: 16, height: 16, color: '#dc2626', flexShrink: 0 }} />
                <p style={{ fontSize: '12px', color: '#dc2626', margin: 0 }}>{img.error}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

                {/* 左: 画像プレビュー */}
                <div>
                  <p style={{ fontSize: '10px', color: '#9ca3af', margin: '0 0 6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    骨格検出
                  </p>
                  <img
                    src={img.annotatedUrl ?? img.originalUrl}
                    alt="annotated"
                    style={{ width: '100%', borderRadius: '8px', display: 'block' }}
                  />
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 style={{ width: 12, height: 12, color: '#16a34a' }} />
                    <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600' }}>骨格検出完了</span>
                  </div>
                </div>

                {/* 右: ROM計測結果 */}
                <div>
                  <SideLabel poseSide={img.poseSide} />
                  {img.romItems.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#9ca3af' }}>計測データなし</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '460px', overflowY: 'auto' }}>
                      {img.romItems.map((item) => (
                        <ROMCard key={item.key} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {images.length > 0 && (
        <button
          onClick={() => inputRef.current?.click()}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            background: '#f3f4f6', color: '#374151', borderRadius: '8px', border: '1px solid #e5e7eb',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginTop: '4px' }}
        >
          <Upload style={{ width: 14, height: 14 }} />
          さらに画像を追加
        </button>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
