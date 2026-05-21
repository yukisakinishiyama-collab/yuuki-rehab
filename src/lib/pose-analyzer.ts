/**
 * MediaPipe Pose Landmarker による骨格検出・関節角度3D計測
 * ブラウザのみ動作（サーバーサイドでは動かない）
 *
 * ── 座標系 (MediaPipe World Landmarks) ──────────────────────────────────────
 *  原点: 両股関節の中点
 *  X軸: 被験者の右方向が正
 *  Y軸: 上方向が正（解剖学的座標系）
 *  Z軸: カメラ方向が正
 *
 * ── 計測平面 ────────────────────────────────────────────────────────────────
 *  矢状面 (Sagittal)  = YZ平面  → 側面から見た屈曲/伸展
 *  前額面 (Frontal)   = XY平面  → 正面から見た外転/内転・外反/内反
 *  水平面 (Transverse)= XZ平面  → 上から見た回旋（単眼カメラでは低精度）
 */

export interface Landmark {
  x: number   // 0-1 normalized (image space) or metric (world space)
  y: number
  z: number
  visibility?: number
}

export interface JointAngles {
  leftKnee:       number | null
  rightKnee:      number | null
  leftHip:        number | null
  rightHip:       number | null
  leftShoulder:   number | null
  rightShoulder:  number | null
  trunkAngle:     number | null
  pelvisTilt:     number | null
  headForward:    number | null
  shoulderSymm:   number | null
  leftAnkle:      number | null
  rightAnkle:     number | null
}

/** 構造化ROM計測アイテム（軸・平面・方向付き） */
export interface ROMItem {
  key:       string
  label:     string      // 例: '左膝屈曲'
  value:     number      // 角度の絶対値（常に正）
  unit:      '°' | 'cm'
  direction: string      // 例: '屈曲' '底屈' '外反(valgus)' '外転'
  plane:     '矢状面(前後)' | '前額面(左右)'
  axis:      '内外側軸(ML)' | '前後軸(AP)' | '垂直軸'
  side:      'L' | 'R' | 'C'
  normalMin: number
  normalMax: number
  note?:     string      // 例: '底屈方向' '要確認'
}

export interface PoseAnalysisResult {
  landmarks:      Landmark[]
  worldLandmarks: Landmark[]
  jointAngles:    JointAngles
  romItems:       ROMItem[]
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

// ── 角度計算ユーティリティ ────────────────────────────────────────────────────

/** 3D空間での3点間角度（頂点b、単位: degrees） */
function angle3(a: Landmark, b: Landmark, c: Landmark): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z
  const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2)
  if (mag < 0.001) return 180
  return Math.round((Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI)
}

/**
 * 矢状面（YZ平面）に投影した3点間角度
 * 側面撮影での屈曲/伸展計測に使用（X成分を除去してノイズ排除）
 */
function sagittalAngle3(a: Landmark, b: Landmark, c: Landmark): number {
  const v1 = { y: a.y - b.y, z: a.z - b.z }
  const v2 = { y: c.y - b.y, z: c.z - b.z }
  const dot = v1.y * v2.y + v1.z * v2.z
  const mag = Math.sqrt(v1.y ** 2 + v1.z ** 2) * Math.sqrt(v2.y ** 2 + v2.z ** 2)
  if (mag < 0.001) return 180
  return Math.round((Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI)
}

/**
 * 前額面（XY平面）に投影した3点間角度
 * 正面撮影でのアライメント・外反/内反計測に使用（Z成分を除去）
 */
function frontalAngle3(a: Landmark, b: Landmark, c: Landmark): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2)
  if (mag < 0.001) return 180
  return Math.round((Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI)
}

/** 可視性チェック */
function vis(lm: Landmark[], ...idxs: number[]): boolean {
  return idxs.every((i) => lm[i] && (lm[i].visibility ?? 1) > 0.35)
}

/** 正面 vs 側面の推定 */
function detectSide(lm: Landmark[]): 'front' | 'side' | 'unknown' {
  if (!vis(lm, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP)) return 'unknown'
  const shoulderWidth = Math.abs(lm[LM.LEFT_SHOULDER].x - lm[LM.RIGHT_SHOULDER].x)
  const hipWidth      = Math.abs(lm[LM.LEFT_HIP].x - lm[LM.RIGHT_HIP].x)
  return shoulderWidth > 0.12 || hipWidth > 0.1 ? 'front' : 'side'
}

// ── 構造化ROM計測 ────────────────────────────────────────────────────────────

/**
 * 撮影方向に応じた正確なROM計測アイテムを返す。
 *
 * 側面 (Sagittal plane / YZ):
 *   膝屈曲、股関節屈曲、足首背屈、体幹前傾、頭部前方偏位
 *
 * 正面 (Frontal plane / XY):
 *   膝外反/内反アライメント、股関節外転角、骨盤側方傾斜、肩の高さ差
 */
export function calcROMItems(wl: Landmark[], poseSide: 'front' | 'side' | 'unknown'): ROMItem[] {
  const items: ROMItem[] = []

  // ── 矢状面計測（側面・不明のとき） ──────────────────────────────────────

  if (poseSide === 'side' || poseSide === 'unknown') {
    // 膝屈曲（内外側軸まわり）
    if (vis(wl, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE)) {
      const geo = sagittalAngle3(wl[LM.LEFT_HIP], wl[LM.LEFT_KNEE], wl[LM.LEFT_ANKLE])
      const flex = 180 - geo
      items.push({ key:'L_KneeFlexion', label:'左膝屈曲', value: Math.abs(flex), unit:'°',
        direction: flex >= 0 ? '屈曲' : '過伸展', plane:'矢状面(前後)', axis:'内外側軸(ML)',
        side:'L', normalMin:0, normalMax:15, note: flex < 0 ? '過伸展' : undefined })
    }
    if (vis(wl, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE)) {
      const geo = sagittalAngle3(wl[LM.RIGHT_HIP], wl[LM.RIGHT_KNEE], wl[LM.RIGHT_ANKLE])
      const flex = 180 - geo
      items.push({ key:'R_KneeFlexion', label:'右膝屈曲', value: Math.abs(flex), unit:'°',
        direction: flex >= 0 ? '屈曲' : '過伸展', plane:'矢状面(前後)', axis:'内外側軸(ML)',
        side:'R', normalMin:0, normalMax:15, note: flex < 0 ? '過伸展' : undefined })
    }

    // 股関節屈曲（内外側軸まわり）
    if (vis(wl, LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE)) {
      const geo = sagittalAngle3(wl[LM.LEFT_SHOULDER], wl[LM.LEFT_HIP], wl[LM.LEFT_KNEE])
      const flex = 180 - geo
      items.push({ key:'L_HipFlexion', label:'左股関節屈曲', value: Math.abs(flex), unit:'°',
        direction: flex >= 0 ? '屈曲' : '伸展', plane:'矢状面(前後)', axis:'内外側軸(ML)',
        side:'L', normalMin:0, normalMax:15 })
    }
    if (vis(wl, LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE)) {
      const geo = sagittalAngle3(wl[LM.RIGHT_SHOULDER], wl[LM.RIGHT_HIP], wl[LM.RIGHT_KNEE])
      const flex = 180 - geo
      items.push({ key:'R_HipFlexion', label:'右股関節屈曲', value: Math.abs(flex), unit:'°',
        direction: flex >= 0 ? '屈曲' : '伸展', plane:'矢状面(前後)', axis:'内外側軸(ML)',
        side:'R', normalMin:0, normalMax:15 })
    }

    // 足首背屈/底屈（内外側軸まわり）
    if (vis(wl, LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.LEFT_FOOT)) {
      const geo = sagittalAngle3(wl[LM.LEFT_KNEE], wl[LM.LEFT_ANKLE], wl[LM.LEFT_FOOT])
      const dorsi = 90 - geo  // 正=背屈, 負=底屈
      items.push({ key:'L_AnkleDorsi', label:'左足首', value: Math.abs(dorsi), unit:'°',
        direction: dorsi >= 0 ? '背屈' : '底屈', plane:'矢状面(前後)', axis:'内外側軸(ML)',
        side:'L', normalMin:0, normalMax:20, note: dorsi < 0 ? '底屈方向' : undefined })
    }
    if (vis(wl, LM.RIGHT_KNEE, LM.RIGHT_ANKLE, LM.RIGHT_FOOT)) {
      const geo = sagittalAngle3(wl[LM.RIGHT_KNEE], wl[LM.RIGHT_ANKLE], wl[LM.RIGHT_FOOT])
      const dorsi = 90 - geo
      items.push({ key:'R_AnkleDorsi', label:'右足首', value: Math.abs(dorsi), unit:'°',
        direction: dorsi >= 0 ? '背屈' : '底屈', plane:'矢状面(前後)', axis:'内外側軸(ML)',
        side:'R', normalMin:0, normalMax:20, note: dorsi < 0 ? '底屈方向' : undefined })
    }

    // 体幹前傾（矢状面、内外側軸まわり）
    if (vis(wl, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP)) {
      const sMid = { x:0, y:(wl[LM.LEFT_SHOULDER].y + wl[LM.RIGHT_SHOULDER].y)/2, z:(wl[LM.LEFT_SHOULDER].z + wl[LM.RIGHT_SHOULDER].z)/2 }
      const hMid = { x:0, y:(wl[LM.LEFT_HIP].y      + wl[LM.RIGHT_HIP].y)/2,      z:(wl[LM.LEFT_HIP].z      + wl[LM.RIGHT_HIP].z)/2 }
      const dy = sMid.y - hMid.y
      const dz = sMid.z - hMid.z
      const lean = Math.round(Math.atan2(Math.abs(dz), Math.abs(dy)) * 180 / Math.PI)
      const dir = dz > 0 ? '前傾' : '後傾'
      items.push({ key:'TrunkForward', label:'体幹前傾角', value: lean, unit:'°',
        direction: dir, plane:'矢状面(前後)', axis:'内外側軸(ML)',
        side:'C', normalMin:0, normalMax:10 })
    }

    // 頭部前方偏位（z軸、耳-肩基準）
    const earVis = vis(wl, LM.LEFT_EAR, LM.LEFT_SHOULDER) || vis(wl, LM.RIGHT_EAR, LM.RIGHT_SHOULDER)
    if (earVis) {
      const earZ = vis(wl, LM.LEFT_EAR)      ? wl[LM.LEFT_EAR].z      : wl[LM.RIGHT_EAR].z
      const shlZ = vis(wl, LM.LEFT_SHOULDER) ? wl[LM.LEFT_SHOULDER].z : wl[LM.RIGHT_SHOULDER].z
      const fwd  = Math.round((earZ - shlZ) * 100)
      items.push({ key:'HeadForward', label:'頭部前方偏位', value: Math.abs(fwd), unit:'cm',
        direction: fwd > 0 ? '前方偏位' : '後方', plane:'矢状面(前後)', axis:'内外側軸(ML)',
        side:'C', normalMin:0, normalMax:5 })
    }
  }

  // ── 前額面計測（正面・不明のとき） ──────────────────────────────────────

  if (poseSide === 'front' || poseSide === 'unknown') {
    // 膝アライメント外反(valgus)/内反(varus) — 前後軸まわり
    // 正面XY投影でhip-knee-ankle角度を計算し180°からの偏差を求める
    if (vis(wl, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE)) {
      const geo = frontalAngle3(wl[LM.LEFT_HIP], wl[LM.LEFT_KNEE], wl[LM.LEFT_ANKLE])
      const dev = Math.abs(180 - geo)
      // 左膝: knee.x が hip-ankle midlineより右(正)なら外反(valgus)
      const midX = (wl[LM.LEFT_HIP].x + wl[LM.LEFT_ANKLE].x) / 2
      const isValgus = wl[LM.LEFT_KNEE].x > midX
      items.push({ key:'L_KneeAlign', label:'左膝アライメント', value: dev, unit:'°',
        direction: isValgus ? '外反(valgus)' : '内反(varus)', plane:'前額面(左右)', axis:'前後軸(AP)',
        side:'L', normalMin:0, normalMax:5 })
    }
    if (vis(wl, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE)) {
      const geo = frontalAngle3(wl[LM.RIGHT_HIP], wl[LM.RIGHT_KNEE], wl[LM.RIGHT_ANKLE])
      const dev = Math.abs(180 - geo)
      // 右膝: knee.x が hip-ankle midlineより左(負)なら外反(valgus)
      const midX = (wl[LM.RIGHT_HIP].x + wl[LM.RIGHT_ANKLE].x) / 2
      const isValgus = wl[LM.RIGHT_KNEE].x < midX
      items.push({ key:'R_KneeAlign', label:'右膝アライメント', value: dev, unit:'°',
        direction: isValgus ? '外反(valgus)' : '内反(varus)', plane:'前額面(左右)', axis:'前後軸(AP)',
        side:'R', normalMin:0, normalMax:5 })
    }

    // 股関節外転角（大腿骨-体幹の前額面角度、垂直軸まわり）
    if (vis(wl, LM.LEFT_HIP, LM.LEFT_KNEE)) {
      const dy = wl[LM.LEFT_HIP].y - wl[LM.LEFT_KNEE].y
      const dx = wl[LM.LEFT_HIP].x - wl[LM.LEFT_KNEE].x
      const abduct = Math.round(Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI)
      const dir = wl[LM.LEFT_KNEE].x < wl[LM.LEFT_HIP].x ? '外転' : '内転'
      items.push({ key:'L_HipAbduct', label:'左股関節外転', value: abduct, unit:'°',
        direction: dir, plane:'前額面(左右)', axis:'前後軸(AP)',
        side:'L', normalMin:0, normalMax:10 })
    }
    if (vis(wl, LM.RIGHT_HIP, LM.RIGHT_KNEE)) {
      const dy = wl[LM.RIGHT_HIP].y - wl[LM.RIGHT_KNEE].y
      const dx = wl[LM.RIGHT_HIP].x - wl[LM.RIGHT_KNEE].x
      const abduct = Math.round(Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI)
      const dir = wl[LM.RIGHT_KNEE].x > wl[LM.RIGHT_HIP].x ? '外転' : '内転'
      items.push({ key:'R_HipAbduct', label:'右股関節外転', value: abduct, unit:'°',
        direction: dir, plane:'前額面(左右)', axis:'前後軸(AP)',
        side:'R', normalMin:0, normalMax:10 })
    }

    // 骨盤側方傾斜（左右腰高さ差 → 角度換算）
    if (vis(wl, LM.LEFT_HIP, LM.RIGHT_HIP)) {
      const dy = Math.abs(wl[LM.LEFT_HIP].y - wl[LM.RIGHT_HIP].y)
      const dx = Math.abs(wl[LM.LEFT_HIP].x - wl[LM.RIGHT_HIP].x)
      const tiltDeg = Math.round(Math.atan2(dy, dx) * 180 / Math.PI)
      const highSide = wl[LM.LEFT_HIP].y > wl[LM.RIGHT_HIP].y ? '右高' : '左高'
      items.push({ key:'PelvicTilt', label:'骨盤傾斜', value: tiltDeg, unit:'°',
        direction: highSide, plane:'前額面(左右)', axis:'前後軸(AP)',
        side:'C', normalMin:0, normalMax:3 })
    }

    // 肩の左右高さ差（前額面）
    if (vis(wl, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER)) {
      const dy = Math.abs(wl[LM.LEFT_SHOULDER].y - wl[LM.RIGHT_SHOULDER].y)
      const dx = Math.abs(wl[LM.LEFT_SHOULDER].x - wl[LM.RIGHT_SHOULDER].x)
      const tiltDeg = Math.round(Math.atan2(dy, dx) * 180 / Math.PI)
      const highSide = wl[LM.LEFT_SHOULDER].y > wl[LM.RIGHT_SHOULDER].y ? '右高' : '左高'
      items.push({ key:'ShoulderTilt', label:'肩の傾き', value: tiltDeg, unit:'°',
        direction: highSide, plane:'前額面(左右)', axis:'前後軸(AP)',
        side:'C', normalMin:0, normalMax:3 })
    }

    // 体幹側方傾斜（正面から）
    if (vis(wl, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP)) {
      const sMid = { x:(wl[LM.LEFT_SHOULDER].x + wl[LM.RIGHT_SHOULDER].x)/2, y:(wl[LM.LEFT_SHOULDER].y + wl[LM.RIGHT_SHOULDER].y)/2 }
      const hMid = { x:(wl[LM.LEFT_HIP].x + wl[LM.RIGHT_HIP].x)/2,           y:(wl[LM.LEFT_HIP].y + wl[LM.RIGHT_HIP].y)/2 }
      const dx = sMid.x - hMid.x
      const dy = Math.abs(sMid.y - hMid.y)
      const lat = Math.round(Math.atan2(Math.abs(dx), dy) * 180 / Math.PI)
      const dir = dx > 0 ? '右傾' : '左傾'
      items.push({ key:'TrunkLateral', label:'体幹側方傾斜', value: lat, unit:'°',
        direction: dir, plane:'前額面(左右)', axis:'前後軸(AP)',
        side:'C', normalMin:0, normalMax:5 })
    }
  }

  return items
}

// ── 後方互換: calcJointAngles ────────────────────────────────────────────────

/**
 * 従来の JointAngles を返す（PatientReport との互換用）
 * 内部では撮影方向に応じた平面投影を使用
 */
export function calcJointAngles(wl: Landmark[], poseSide: 'front' | 'side' | 'unknown' = 'unknown'): JointAngles {
  const a: JointAngles = {
    leftKnee: null, rightKnee: null, leftHip: null, rightHip: null,
    leftShoulder: null, rightShoulder: null, trunkAngle: null, pelvisTilt: null,
    headForward: null, shoulderSymm: null, leftAnkle: null, rightAnkle: null,
  }

  // 膝屈曲（矢状面優先）
  if (vis(wl, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE))
    a.leftKnee  = 180 - (poseSide === 'side' ? sagittalAngle3 : angle3)(wl[LM.LEFT_HIP],  wl[LM.LEFT_KNEE],  wl[LM.LEFT_ANKLE])
  if (vis(wl, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE))
    a.rightKnee = 180 - (poseSide === 'side' ? sagittalAngle3 : angle3)(wl[LM.RIGHT_HIP], wl[LM.RIGHT_KNEE], wl[LM.RIGHT_ANKLE])

  // 股関節屈曲
  if (vis(wl, LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE))
    a.leftHip  = 180 - (poseSide === 'side' ? sagittalAngle3 : angle3)(wl[LM.LEFT_SHOULDER],  wl[LM.LEFT_HIP],  wl[LM.LEFT_KNEE])
  if (vis(wl, LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE))
    a.rightHip = 180 - (poseSide === 'side' ? sagittalAngle3 : angle3)(wl[LM.RIGHT_SHOULDER], wl[LM.RIGHT_HIP], wl[LM.RIGHT_KNEE])

  // 肩関節
  if (vis(wl, LM.LEFT_ELBOW,  LM.LEFT_SHOULDER,  LM.LEFT_HIP))   a.leftShoulder  = angle3(wl[LM.LEFT_ELBOW],  wl[LM.LEFT_SHOULDER],  wl[LM.LEFT_HIP])
  if (vis(wl, LM.RIGHT_ELBOW, LM.RIGHT_SHOULDER, LM.RIGHT_HIP))  a.rightShoulder = angle3(wl[LM.RIGHT_ELBOW], wl[LM.RIGHT_SHOULDER], wl[LM.RIGHT_HIP])

  // 足首（側面のみ）
  if (poseSide === 'side' || poseSide === 'unknown') {
    if (vis(wl, LM.LEFT_KNEE,  LM.LEFT_ANKLE,  LM.LEFT_FOOT))   a.leftAnkle  = 90 - sagittalAngle3(wl[LM.LEFT_KNEE],  wl[LM.LEFT_ANKLE],  wl[LM.LEFT_FOOT])
    if (vis(wl, LM.RIGHT_KNEE, LM.RIGHT_ANKLE, LM.RIGHT_FOOT))  a.rightAnkle = 90 - sagittalAngle3(wl[LM.RIGHT_KNEE], wl[LM.RIGHT_ANKLE], wl[LM.RIGHT_FOOT])
    // 頭部前方偏位
    const earVis = vis(wl, LM.LEFT_EAR, LM.LEFT_SHOULDER) || vis(wl, LM.RIGHT_EAR, LM.RIGHT_SHOULDER)
    if (earVis) {
      const earZ = vis(wl, LM.LEFT_EAR)      ? wl[LM.LEFT_EAR].z      : wl[LM.RIGHT_EAR].z
      const shlZ = vis(wl, LM.LEFT_SHOULDER) ? wl[LM.LEFT_SHOULDER].z : wl[LM.RIGHT_SHOULDER].z
      a.headForward = Math.round((earZ - shlZ) * 100)
    }
  }

  // 体幹前傾
  if (vis(wl, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP)) {
    const sMid = { x:0, y:(wl[LM.LEFT_SHOULDER].y + wl[LM.RIGHT_SHOULDER].y)/2, z:(wl[LM.LEFT_SHOULDER].z + wl[LM.RIGHT_SHOULDER].z)/2 }
    const hMid = { x:0, y:(wl[LM.LEFT_HIP].y      + wl[LM.RIGHT_HIP].y)/2,      z:(wl[LM.LEFT_HIP].z      + wl[LM.RIGHT_HIP].z)/2 }
    const dy = sMid.y - hMid.y; const dz = sMid.z - hMid.z
    a.trunkAngle = Math.round(Math.atan2(Math.abs(dz), Math.abs(dy)) * 180 / Math.PI)
  }

  // 骨盤傾斜・肩対称性（正面のみ）
  if (poseSide === 'front' || poseSide === 'unknown') {
    if (vis(wl, LM.LEFT_HIP,      LM.RIGHT_HIP))      a.pelvisTilt  = Math.round(Math.abs(wl[LM.LEFT_HIP].y      - wl[LM.RIGHT_HIP].y)      * 100)
    if (vis(wl, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER)) a.shoulderSymm = Math.round(Math.abs(wl[LM.LEFT_SHOULDER].y - wl[LM.RIGHT_SHOULDER].y) * 100)
  }

  return a
}

// ── skeleton 描画定数 ─────────────────────────────────────────────────────────
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

function landmarkColor(i: number): string {
  if ([LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.LEFT_HIP, LM.LEFT_SHOULDER].includes(i)) return '#3b82f6'
  if ([LM.RIGHT_KNEE, LM.RIGHT_ANKLE, LM.RIGHT_HIP, LM.RIGHT_SHOULDER].includes(i)) return '#ef4444'
  return '#f59e0b'
}

export function drawPoseOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  romItems: ROMItem[],
  w: number,
  h: number,
) {
  ctx.save()
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'

  for (const [a, b] of CONNECTIONS) {
    const la = landmarks[a], lb = landmarks[b]
    if (!la || !lb) continue
    if ((la.visibility ?? 1) < 0.3 || (lb.visibility ?? 1) < 0.3) continue
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3
    ctx.beginPath(); ctx.moveTo(la.x * w, la.y * h); ctx.lineTo(lb.x * w, lb.y * h); ctx.stroke()
  }

  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i]
    if (!lm || (lm.visibility ?? 1) < 0.3) continue
    ctx.shadowBlur = 4; ctx.fillStyle = landmarkColor(i)
    ctx.beginPath(); ctx.arc(lm.x * w, lm.y * h, 5, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
  }
  ctx.restore()

  // ROM ラベル描画（方向のみ、数字なし）
  const keyToLM: Record<string, number> = {
    L_KneeFlexion: LM.LEFT_KNEE,  R_KneeFlexion: LM.RIGHT_KNEE,
    L_HipFlexion:  LM.LEFT_HIP,   R_HipFlexion:  LM.RIGHT_HIP,
    L_AnkleDorsi:  LM.LEFT_ANKLE, R_AnkleDorsi:  LM.RIGHT_ANKLE,
    L_KneeAlign:   LM.LEFT_KNEE,  R_KneeAlign:   LM.RIGHT_KNEE,
    L_HipAbduct:   LM.LEFT_HIP,   R_HipAbduct:   LM.RIGHT_HIP,
  }
  for (const item of romItems) {
    const lmIdx = keyToLM[item.key]
    if (lmIdx === undefined) continue
    const lm = landmarks[lmIdx]
    if (!lm || (lm.visibility ?? 1) < 0.3) continue
    const x = lm.x * w, y = lm.y * h
    const text = item.direction   // 数字なし、方向ラベルのみ
    const color = item.side === 'L' ? '#60a5fa' : item.side === 'R' ? '#f87171' : '#a3e635'
    ctx.save()
    ctx.font = 'bold 12px sans-serif'
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(text, x + 9, y + 5)
    ctx.fillStyle = color;              ctx.fillText(text, x + 8, y + 4)
    ctx.restore()
  }
}

// ── MediaPipe 初期化＆解析 ────────────────────────────────────────────────────
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

/** 画像データからポーズ検出・ROM計測・骨格描画を行い annotated base64 JPEG を返す */
export async function analyzeAndAnnotateFrame(
  imageDataUrl: string,
  w: number,
  h: number,
): Promise<{ annotated: string; result: PoseAnalysisResult }> {
  await initLandmarker()

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const inputCanvas = document.createElement('canvas')
      inputCanvas.width = w; inputCanvas.height = h
      const inputCtx = inputCanvas.getContext('2d')!
      inputCtx.drawImage(img, 0, 0, w, h)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = _landmarker.detect(inputCanvas)
      const detected = result.landmarks && result.landmarks.length > 0

      if (!detected) {
        resolve({
          annotated: imageDataUrl,
          result: {
            landmarks: [], worldLandmarks: [],
            jointAngles: { leftKnee:null,rightKnee:null,leftHip:null,rightHip:null,leftShoulder:null,rightShoulder:null,trunkAngle:null,pelvisTilt:null,headForward:null,shoulderSymm:null,leftAnkle:null,rightAnkle:null },
            romItems: [],
            poseSide: 'unknown', detected: false,
          },
        })
        return
      }

      const landmarks:      Landmark[] = result.landmarks[0]
      const worldLandmarks: Landmark[] = result.worldLandmarks[0]

      // 撮影方向を先に判定して各計測に活用
      const poseSide    = detectSide(landmarks)
      const jointAngles = calcJointAngles(worldLandmarks, poseSide)
      const romItems    = calcROMItems(worldLandmarks, poseSide)

      const outCanvas = document.createElement('canvas')
      outCanvas.width = w; outCanvas.height = h
      const outCtx = outCanvas.getContext('2d')!
      outCtx.drawImage(inputCanvas, 0, 0)
      drawPoseOverlay(outCtx, landmarks, romItems, w, h)

      resolve({
        annotated: outCanvas.toDataURL('image/jpeg', 0.88),
        result: { landmarks, worldLandmarks, jointAngles, romItems, poseSide, detected: true },
      })
    }
    img.src = imageDataUrl
  })
}
