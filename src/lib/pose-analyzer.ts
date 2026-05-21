/**
 * MediaPipe Pose Landmarker による骨格検出・関節角度3D計測
 * ブラウザのみ動作（サーバーサイドでは動かない）
 */

export interface Landmark {
  x: number   // 0-1 normalized (image space)
  y: number
  z: number   // depth relative to hip midpoint (metric)
  visibility?: number
}

export interface JointAngles {
  leftKnee:       number | null   // 膝屈曲角 (0=伸展, 180=完全屈曲)
  rightKnee:      number | null
  leftHip:        number | null   // 股関節角
  rightHip:       number | null
  leftShoulder:   number | null   // 肩関節角
  rightShoulder:  number | null
  trunkAngle:     number | null   // 体幹前傾角 (垂直からの偏差)
  pelvisTilt:     number | null   // 骨盤傾斜 (左右高さ差 mm相当)
  headForward:    number | null   // 頭部前方偏位 (耳が肩より前ならプラス cm)
  shoulderSymm:   number | null   // 肩の左右対称性スコア (0=完全対称)
  leftAnkle:      number | null   // 足首角
  rightAnkle:     number | null
}

export interface PoseAnalysisResult {
  landmarks:      Landmark[]        // 画像空間座標
  worldLandmarks: Landmark[]        // ワールド座標（metric, 腰中点基準）
  jointAngles:    JointAngles
  poseSide:       'front' | 'side' | 'unknown'
  detected:       boolean
}

// MediaPipe Pose landmark インデックス
const LM = {
  NOSE: 0,
  LEFT_SHOULDER:  11, RIGHT_SHOULDER:  12,
  LEFT_ELBOW:     13, RIGHT_ELBOW:     14,
  LEFT_WRIST:     15, RIGHT_WRIST:     16,
  LEFT_HIP:       23, RIGHT_HIP:       24,
  LEFT_KNEE:      25, RIGHT_KNEE:      26,
  LEFT_ANKLE:     27, RIGHT_ANKLE:     28,
  LEFT_FOOT:      31, RIGHT_FOOT:      32,
  LEFT_EAR:        7, RIGHT_EAR:        8,
}

// 3点間の角度計算 (degrees, 頂点はb)
function angle3(a: Landmark, b: Landmark, c: Landmark): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z
  const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2)
  if (mag === 0) return 0
  return Math.round((Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI)
}

// 可視性チェック
function vis(lm: Landmark[], ...idxs: number[]): boolean {
  return idxs.every((i) => lm[i] && (lm[i].visibility ?? 1) > 0.35)
}

// 正面 vs 側面の推定
function detectSide(lm: Landmark[]): 'front' | 'side' | 'unknown' {
  if (!vis(lm, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP)) return 'unknown'
  const shoulderWidth = Math.abs(lm[LM.LEFT_SHOULDER].x - lm[LM.RIGHT_SHOULDER].x)
  const hipWidth      = Math.abs(lm[LM.LEFT_HIP].x - lm[LM.RIGHT_HIP].x)
  return shoulderWidth > 0.12 || hipWidth > 0.1 ? 'front' : 'side'
}

/**
 * 撮影方向に応じて信頼できる角度のみ計算する。
 *
 * ■ 正面 (front)
 *   - 膝・股関節屈曲: 計算（両側可視）
 *   - 骨盤傾斜・肩対称性: 計算（左右高さ差が意味を持つ）
 *   - 足首背屈: スキップ（正面からはz軸深度推定が不正確）
 *   - 頭部前方偏位: スキップ（深度z軸依存）
 *
 * ■ 側面 (side)
 *   - 膝・股関節・足首背屈: 計算（矢状面で正確）
 *   - 体幹前傾角・頭部前方偏位: 計算
 *   - 骨盤傾斜・肩対称性: スキップ（片側しか見えない）
 */
export function calcJointAngles(wl: Landmark[], poseSide: 'front' | 'side' | 'unknown' = 'unknown'): JointAngles {
  const a: JointAngles = {
    leftKnee: null, rightKnee: null,
    leftHip: null, rightHip: null,
    leftShoulder: null, rightShoulder: null,
    trunkAngle: null, pelvisTilt: null,
    headForward: null, shoulderSymm: null,
    leftAnkle: null, rightAnkle: null,
  }

  // ── 全方向共通 ─────────────────────────────────────────────────────────────

  // 膝屈曲角（臨床表示: 0=完全伸展, 増加=屈曲）
  if (vis(wl, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE))   a.leftKnee  = 180 - angle3(wl[LM.LEFT_HIP],  wl[LM.LEFT_KNEE],  wl[LM.LEFT_ANKLE])
  if (vis(wl, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE)) a.rightKnee = 180 - angle3(wl[LM.RIGHT_HIP], wl[LM.RIGHT_KNEE], wl[LM.RIGHT_ANKLE])

  // 股関節屈曲角（臨床表示: 0=中立, 増加=屈曲）
  if (vis(wl, LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE))   a.leftHip  = 180 - angle3(wl[LM.LEFT_SHOULDER],  wl[LM.LEFT_HIP],  wl[LM.LEFT_KNEE])
  if (vis(wl, LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE)) a.rightHip = 180 - angle3(wl[LM.RIGHT_SHOULDER], wl[LM.RIGHT_HIP], wl[LM.RIGHT_KNEE])

  // 肩関節角（肘-肩-腰）
  if (vis(wl, LM.LEFT_ELBOW, LM.LEFT_SHOULDER, LM.LEFT_HIP))   a.leftShoulder  = angle3(wl[LM.LEFT_ELBOW],  wl[LM.LEFT_SHOULDER],  wl[LM.LEFT_HIP])
  if (vis(wl, LM.RIGHT_ELBOW, LM.RIGHT_SHOULDER, LM.RIGHT_HIP)) a.rightShoulder = angle3(wl[LM.RIGHT_ELBOW], wl[LM.RIGHT_SHOULDER], wl[LM.RIGHT_HIP])

  // 体幹前傾角（肩中点→腰中点 の垂直からの偏差）
  if (vis(wl, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP)) {
    const shoulderMid = { x: (wl[LM.LEFT_SHOULDER].x + wl[LM.RIGHT_SHOULDER].x) / 2, y: (wl[LM.LEFT_SHOULDER].y + wl[LM.RIGHT_SHOULDER].y) / 2, z: (wl[LM.LEFT_SHOULDER].z + wl[LM.RIGHT_SHOULDER].z) / 2 }
    const hipMid      = { x: (wl[LM.LEFT_HIP].x + wl[LM.RIGHT_HIP].x) / 2,           y: (wl[LM.LEFT_HIP].y + wl[LM.RIGHT_HIP].y) / 2,           z: (wl[LM.LEFT_HIP].z + wl[LM.RIGHT_HIP].z) / 2 }
    const dx = shoulderMid.x - hipMid.x
    const dy = shoulderMid.y - hipMid.y
    a.trunkAngle = Math.round(Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI)
  }

  // ── 側面撮影のみ（矢状面の深度 z 軸が必要） ───────────────────────────────

  if (poseSide === 'side' || poseSide === 'unknown') {
    // 足首背屈角（+背屈 / -底屈）— 正面からはz深度が不正確なのでスキップ
    if (vis(wl, LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.LEFT_FOOT))   a.leftAnkle  = 90 - angle3(wl[LM.LEFT_KNEE],  wl[LM.LEFT_ANKLE],  wl[LM.LEFT_FOOT])
    if (vis(wl, LM.RIGHT_KNEE, LM.RIGHT_ANKLE, LM.RIGHT_FOOT)) a.rightAnkle = 90 - angle3(wl[LM.RIGHT_KNEE], wl[LM.RIGHT_ANKLE], wl[LM.RIGHT_FOOT])

    // 頭部前方偏位（耳の前後位置 z, 肩基準 cm換算）
    const earVisible = vis(wl, LM.LEFT_EAR, LM.LEFT_SHOULDER) || vis(wl, LM.RIGHT_EAR, LM.RIGHT_SHOULDER)
    if (earVisible) {
      const earZ = vis(wl, LM.LEFT_EAR)      ? wl[LM.LEFT_EAR].z      : wl[LM.RIGHT_EAR].z
      const shlZ = vis(wl, LM.LEFT_SHOULDER) ? wl[LM.LEFT_SHOULDER].z : wl[LM.RIGHT_SHOULDER].z
      a.headForward = Math.round((earZ - shlZ) * 100)
    }
  }

  // ── 正面撮影のみ（左右の x 軸差・高さ差が意味を持つ） ────────────────────

  if (poseSide === 'front' || poseSide === 'unknown') {
    // 骨盤傾斜（左右腰の高さ差 cm換算）
    if (vis(wl, LM.LEFT_HIP, LM.RIGHT_HIP)) {
      a.pelvisTilt = Math.round(Math.abs(wl[LM.LEFT_HIP].y - wl[LM.RIGHT_HIP].y) * 100)
    }
    // 肩の左右対称性（高さ差 cm換算）
    if (vis(wl, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER)) {
      a.shoulderSymm = Math.round(Math.abs(wl[LM.LEFT_SHOULDER].y - wl[LM.RIGHT_SHOULDER].y) * 100)
    }
  }

  return a
}

// ── skeleton 描画定数 ────────────────────────────────────────────────────────
const CONNECTIONS: [number, number][] = [
  [LM.NOSE, LM.LEFT_EAR], [LM.NOSE, LM.RIGHT_EAR],
  [LM.LEFT_SHOULDER,  LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER,  LM.LEFT_ELBOW],   [LM.LEFT_ELBOW,  LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER,  LM.LEFT_HIP],     [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP,       LM.RIGHT_HIP],
  [LM.LEFT_HIP,       LM.LEFT_KNEE],    [LM.LEFT_KNEE,   LM.LEFT_ANKLE],
  [LM.RIGHT_HIP,      LM.RIGHT_KNEE],   [LM.RIGHT_KNEE,  LM.RIGHT_ANKLE],
  [LM.LEFT_ANKLE,     LM.LEFT_FOOT],    [LM.RIGHT_ANKLE, LM.RIGHT_FOOT],
]

// 関節ノードの色
function landmarkColor(i: number): string {
  if ([LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.LEFT_HIP, LM.LEFT_SHOULDER].includes(i)) return '#3b82f6'   // 左=青
  if ([LM.RIGHT_KNEE, LM.RIGHT_ANKLE, LM.RIGHT_HIP, LM.RIGHT_SHOULDER].includes(i)) return '#ef4444' // 右=赤
  return '#f59e0b' // 中心=オレンジ
}

// 骨格 + 関節角度ラベルをcanvasに描画
export function drawPoseOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  angles: JointAngles,
  w: number,
  h: number,
) {
  ctx.save()
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'

  // ── 接続線 ──
  for (const [a, b] of CONNECTIONS) {
    const la = landmarks[a], lb = landmarks[b]
    if (!la || !lb) continue
    if ((la.visibility ?? 1) < 0.3 || (lb.visibility ?? 1) < 0.3) continue
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur  = 3
    ctx.beginPath()
    ctx.moveTo(la.x * w, la.y * h)
    ctx.lineTo(lb.x * w, lb.y * h)
    ctx.stroke()
  }

  // ── 関節点 ──
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i]
    if (!lm || (lm.visibility ?? 1) < 0.3) continue
    ctx.shadowBlur = 4
    ctx.fillStyle  = landmarkColor(i)
    ctx.beginPath()
    ctx.arc(lm.x * w, lm.y * h, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth   = 1.5
    ctx.stroke()
  }

  ctx.restore()

  // ── 角度ラベル ──
  function angleLabel(landmark: Landmark, angle: number | null, label: string, color: string) {
    if (angle === null || !landmark) return
    const x = landmark.x * w
    const y = landmark.y * h
    ctx.save()
    ctx.font      = 'bold 13px sans-serif'
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillText(`${label} ${angle}°`, x + 9, y + 5)
    ctx.fillStyle = color
    ctx.fillText(`${label} ${angle}°`, x + 8, y + 4)
    ctx.restore()
  }

  if (landmarks[LM.LEFT_KNEE])   angleLabel(landmarks[LM.LEFT_KNEE],   angles.leftKnee,   '屈曲', '#3b82f6')
  if (landmarks[LM.RIGHT_KNEE])  angleLabel(landmarks[LM.RIGHT_KNEE],  angles.rightKnee,  '屈曲', '#ef4444')
  if (landmarks[LM.LEFT_HIP])    angleLabel(landmarks[LM.LEFT_HIP],    angles.leftHip,    '屈曲', '#3b82f6')
  if (landmarks[LM.RIGHT_HIP])   angleLabel(landmarks[LM.RIGHT_HIP],   angles.rightHip,   '屈曲', '#ef4444')
  if (landmarks[LM.LEFT_ANKLE])  angleLabel(landmarks[LM.LEFT_ANKLE],  angles.leftAnkle,  '背屈', '#3b82f6')
  if (landmarks[LM.RIGHT_ANKLE]) angleLabel(landmarks[LM.RIGHT_ANKLE], angles.rightAnkle, '背屈', '#ef4444')
}

// ── MediaPipe 初期化＆解析 ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _landmarker: any = null
let _initPromise: Promise<void> | null = null

async function initLandmarker(): Promise<void> {
  if (_landmarker) return
  if (_initPromise) return _initPromise
  _initPromise = (async () => {
    const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    )
    _landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      numPoses: 1,
    })
  })()
  return _initPromise
}

/**
 * 画像データからポーズ検出・関節角度計算・描画を行い
 * アノテーション済み base64 JPEG を返す
 */
export async function analyzeAndAnnotateFrame(
  imageDataUrl: string,
  w: number,
  h: number,
): Promise<{ annotated: string; result: PoseAnalysisResult }> {
  // モデルロード
  await initLandmarker()

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      // 入力canvas
      const inputCanvas = document.createElement('canvas')
      inputCanvas.width  = w
      inputCanvas.height = h
      const inputCtx = inputCanvas.getContext('2d')!
      inputCtx.drawImage(img, 0, 0, w, h)

      // MediaPipe 解析
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = _landmarker.detect(inputCanvas)
      const detected = result.landmarks && result.landmarks.length > 0

      if (!detected) {
        resolve({
          annotated: imageDataUrl,
          result: {
            landmarks: [], worldLandmarks: [], jointAngles: {
              leftKnee: null, rightKnee: null, leftHip: null, rightHip: null,
              leftShoulder: null, rightShoulder: null, trunkAngle: null, pelvisTilt: null,
              headForward: null, shoulderSymm: null, leftAnkle: null, rightAnkle: null,
            },
            poseSide: 'unknown', detected: false,
          },
        })
        return
      }

      const landmarks:      Landmark[] = result.landmarks[0]
      const worldLandmarks: Landmark[] = result.worldLandmarks[0]

      // 撮影方向をまず自動判定し、方向に応じた角度のみ計算
      const poseSide    = detectSide(landmarks)
      const jointAngles = calcJointAngles(worldLandmarks, poseSide)

      // 出力canvas に骨格を重ねて描画
      const outCanvas = document.createElement('canvas')
      outCanvas.width  = w
      outCanvas.height = h
      const outCtx = outCanvas.getContext('2d')!
      outCtx.drawImage(inputCanvas, 0, 0)
      drawPoseOverlay(outCtx, landmarks, jointAngles, w, h)

      resolve({
        annotated: outCanvas.toDataURL('image/jpeg', 0.88),
        result: { landmarks, worldLandmarks, jointAngles, poseSide, detected: true },
      })
    }
    img.src = imageDataUrl
  })
}
