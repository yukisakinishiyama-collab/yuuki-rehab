'use client'

/**
 * Skeleton3DView
 * MediaPipe worldLandmarks をリアルタイムで Three.js 3Dスケルトンとして描画。
 * ・OrbitControls相当のマウスドラッグ回転（Three.jsへの外部依存のみ）
 * ・正面/側面(左)/側面(右)/後面/上面 のプリセットビュー
 * ・関節角度ラベル（CSS2DRenderer相当をCanvas2Dで代替、軽量化）
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import * as THREE from 'three'
import type { Landmark, ROMItem } from '@/lib/pose-analyzer'

// ── MediaPipe ランドマーク接続（ボーン定義） ─────────────────────────────────
const BONE_CONNECTIONS: [number, number][] = [
  // 顔
  [0, 7], [0, 8],
  // 肩
  [11, 12],
  // 左腕
  [11, 13], [13, 15],
  // 右腕
  [12, 14], [14, 16],
  // 体幹
  [11, 23], [12, 24], [23, 24],
  // 左脚
  [23, 25], [25, 27], [27, 31],
  // 右脚
  [24, 26], [26, 28], [28, 32],
]

// 体の左右で色を分ける
const LEFT_INDICES  = new Set([7, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31])
const RIGHT_INDICES = new Set([8, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32])

const COLOR_LEFT   = 0x3b82f6   // 青
const COLOR_RIGHT  = 0xef4444   // 赤
const COLOR_CENTER = 0x94a3b8   // グレー
const COLOR_BONE   = 0xdde1e9   // ボーン（薄グレー）
const COLOR_GRID   = 0x1e3a5f   // グリッド（紺）

// ── ビュープリセット ─────────────────────────────────────────────────────────
interface ViewPreset { label: string; phi: number; theta: number; dist: number }
const VIEW_PRESETS: ViewPreset[] = [
  { label: '正面',     phi: Math.PI / 2, theta: 0,             dist: 2.2 },
  { label: '側面(左)', phi: Math.PI / 2, theta: Math.PI / 2,   dist: 2.2 },
  { label: '側面(右)', phi: Math.PI / 2, theta: -Math.PI / 2,  dist: 2.2 },
  { label: '後面',     phi: Math.PI / 2, theta: Math.PI,       dist: 2.2 },
  { label: '上面',     phi: 0.1,         theta: 0,             dist: 2.5 },
]

interface Props {
  worldLandmarks: Landmark[]
  romItems: ROMItem[]
  detected: boolean
}

export default function Skeleton3DView({ worldLandmarks, romItems, detected }: Props) {
  const mountRef   = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef   = useRef<THREE.Scene | null>(null)
  const cameraRef  = useRef<THREE.PerspectiveCamera | null>(null)
  const jointMeshes = useRef<THREE.Mesh[]>([])
  const boneMeshes  = useRef<THREE.Line[]>([])
  const rafIdRef   = useRef<number | null>(null)
  const [preset, setPreset] = useState(0)

  // ── カメラ軌道パラメータ（OrbitControls 手動実装） ───────────────────────
  const orbitRef = useRef({ phi: Math.PI / 2, theta: 0, dist: 2.2, dragging: false, lastX: 0, lastY: 0 })

  // ── Three.js 初期化 ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const W = el.clientWidth  || 400
    const H = el.clientHeight || 400

    // シーン
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111827)
    sceneRef.current = scene

    // カメラ
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 100)
    camera.position.set(0, 0, orbitRef.current.dist)
    cameraRef.current = camera

    // レンダラー
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    el.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // グリッド（床）
    const gridHelper = new THREE.GridHelper(2, 10, COLOR_GRID, 0x1a2e4a)
    gridHelper.position.y = -1.0
    scene.add(gridHelper)

    // 環境光 + ディレクショナルライト
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
    dirLight.position.set(1, 2, 2)
    scene.add(dirLight)

    // 関節スフィア（33個）
    const sphereGeo = new THREE.SphereGeometry(0.018, 8, 8)
    for (let i = 0; i < 33; i++) {
      const color = LEFT_INDICES.has(i) ? COLOR_LEFT : RIGHT_INDICES.has(i) ? COLOR_RIGHT : COLOR_CENTER
      const mat   = new THREE.MeshPhongMaterial({ color })
      const mesh  = new THREE.Mesh(sphereGeo, mat)
      mesh.visible = false
      scene.add(mesh)
      jointMeshes.current.push(mesh)
    }

    // ボーン Line（接続ごとに1本）
    for (let b = 0; b < BONE_CONNECTIONS.length; b++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
      const mat = new THREE.LineBasicMaterial({ color: COLOR_BONE, linewidth: 2 })
      const line = new THREE.Line(geo, mat)
      line.visible = false
      scene.add(line)
      boneMeshes.current.push(line)
    }

    // レンダーループ
    function animate() {
      const { phi, theta, dist } = orbitRef.current
      const x = dist * Math.sin(phi) * Math.sin(theta)
      const y = dist * Math.cos(phi)
      const z = dist * Math.sin(phi) * Math.cos(theta)
      camera.position.set(x, y, z)
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
      rafIdRef.current = requestAnimationFrame(animate)
    }
    animate()

    // リサイズ
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 400
      const h = el.clientHeight || 400
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [])

  // ── ランドマーク更新 ─────────────────────────────────────────────────────
  useEffect(() => {
    const meshes = jointMeshes.current
    const lines  = boneMeshes.current

    if (!detected || worldLandmarks.length < 33) {
      meshes.forEach((m) => { m.visible = false })
      lines.forEach((l)  => { l.visible = false })
      return
    }

    // MediaPipe → Three.js 座標変換
    // MediaPipe: 原点=股関節中点, Y上が正, Z奥が正
    // Three.js:  Y上が正 → Y反転不要、Z方向はそのまま使用
    // スケール: MediaPipe worldは概ね -1〜1 メートル範囲
    const toV3 = (lm: Landmark) =>
      new THREE.Vector3(lm.x, -lm.y + 0.5, -lm.z)

    meshes.forEach((m, i) => {
      if (i < worldLandmarks.length && (worldLandmarks[i].visibility ?? 1) > 0.3) {
        m.position.copy(toV3(worldLandmarks[i]))
        m.visible = true
      } else {
        m.visible = false
      }
    })

    BONE_CONNECTIONS.forEach(([a, b], idx) => {
      const la = worldLandmarks[a]
      const lb = worldLandmarks[b]
      if (!la || !lb || (la.visibility ?? 1) < 0.3 || (lb.visibility ?? 1) < 0.3) {
        lines[idx].visible = false
        return
      }
      const pa = toV3(la)
      const pb = toV3(lb)
      const geo = lines[idx].geometry as THREE.BufferGeometry
      geo.setFromPoints([pa, pb])
      lines[idx].visible = true
    })
  }, [worldLandmarks, detected])

  // ── ビュープリセット適用 ─────────────────────────────────────────────────
  useEffect(() => {
    const p = VIEW_PRESETS[preset]
    orbitRef.current.phi   = p.phi
    orbitRef.current.theta = p.theta
    orbitRef.current.dist  = p.dist
  }, [preset])

  // ── マウス/タッチ OrbitControls ──────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    orbitRef.current.dragging = true
    orbitRef.current.lastX = e.clientX
    orbitRef.current.lastY = e.clientY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!orbitRef.current.dragging) return
    const dx = e.clientX - orbitRef.current.lastX
    const dy = e.clientY - orbitRef.current.lastY
    orbitRef.current.theta -= dx * 0.008
    orbitRef.current.phi   = Math.max(0.05, Math.min(Math.PI - 0.05, orbitRef.current.phi + dy * 0.008))
    orbitRef.current.lastX = e.clientX
    orbitRef.current.lastY = e.clientY
  }, [])

  const onPointerUp = useCallback(() => {
    orbitRef.current.dragging = false
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    orbitRef.current.dist = Math.max(0.8, Math.min(5, orbitRef.current.dist + e.deltaY * 0.002))
  }, [])

  // ── 関節角度のラベル表示（重要な5つのみ） ─────────────────────────────────
  const keyROM = romItems.filter((r) =>
    ['leftKnee', 'rightKnee', 'leftHip', 'rightHip'].includes(r.key)
  ).slice(0, 4)

  return (
    <div className="relative w-full h-full bg-gray-950 rounded-xl overflow-hidden select-none">
      {/* Three.js マウント先 */}
      <div
        ref={mountRef}
        className="absolute inset-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        style={{ cursor: 'grab' }}
      />

      {/* ── 左上: ラベル ── */}
      <div className="absolute top-2 left-2 pointer-events-none">
        <div className="bg-black/60 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm">
          <span className="text-teal-400 font-semibold">3D</span> スケルトン
        </div>
        {!detected && (
          <div className="mt-1 bg-black/60 text-gray-400 text-[10px] px-2 py-1 rounded-md backdrop-blur-sm">
            骨格未検出
          </div>
        )}
      </div>

      {/* ── 右上: 凡例 ── */}
      <div className="absolute top-2 right-2 pointer-events-none space-y-1">
        <div className="flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-md backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          <span className="text-[10px] text-gray-300">左側</span>
        </div>
        <div className="flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-md backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          <span className="text-[10px] text-gray-300">右側</span>
        </div>
      </div>

      {/* ── 下部: ビュープリセットボタン ── */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-1 px-2">
        {VIEW_PRESETS.map((v, i) => (
          <button
            key={v.label}
            onClick={() => setPreset(i)}
            className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
              preset === i
                ? 'bg-teal-600 text-white'
                : 'bg-black/60 text-gray-400 hover:bg-black/80 hover:text-white'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* ── 下部: 操作ヒント ── */}
      <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
        <span className="text-[9px] text-gray-600">ドラッグで回転 / スクロールでズーム</span>
      </div>

      {/* ── 左下: ROM値 ── */}
      {keyROM.length > 0 && (
        <div className="absolute bottom-16 left-2 space-y-1 pointer-events-none">
          {keyROM.map((r) => {
            const isNormal = r.value >= r.normalMin && r.value <= r.normalMax
            return (
              <div key={r.key} className="flex items-center gap-1.5 bg-black/70 px-2 py-1 rounded-md backdrop-blur-sm">
                <span className={`text-[10px] font-bold ${r.side === 'L' ? 'text-blue-400' : 'text-red-400'}`}>
                  {r.label}
                </span>
                <span className={`text-[10px] font-semibold ${isNormal ? 'text-green-400' : 'text-amber-400'}`}>
                  {Math.round(r.value)}°
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
