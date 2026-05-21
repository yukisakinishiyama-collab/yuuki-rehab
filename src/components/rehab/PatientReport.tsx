'use client'

import { useState, useEffect } from 'react'
import type { RehabCase, VideoComment, EvaluationResult, AISummary, SavedAnnotation, AnnotationShape, AnnotationPoint } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS } from '@/types/rehab'
import { getComments, getAllEvaluations, getAISummaries, getAnnotations, getVideoUrl, saveVideoUrl } from '@/lib/rehab-store'
import { getBlobUrlFromDB } from '@/lib/video-db'
import { Printer, Share2, Copy, Check, ChevronDown, ChevronUp, Bot, Camera, Activity, ImageDown } from 'lucide-react'
import type { JointAngles, PoseAnalysisResult, ROMItem } from '@/lib/pose-analyzer'

interface Props { case_: RehabCase }

// ── シーンフレーム ────────────────────────────────────────────────────────────
interface SceneFrame {
  videoId:      string
  videoLabel:   string
  movementType: string
  timestamp:    number
  imageData:    string          // base64 (生フレーム＋描画済みアノテーション)
  poseData:     string | null   // base64 (ポーズ骨格オーバーレイ済み)
  angles:       JointAngles | null
  romItems:     ROMItem[]
  poseSide:     'front' | 'side' | 'unknown'
  comment?:     VideoComment
  annotation?:  SavedAnnotation
}

// ── アノテーション描画（VideoAnnotationOverlay と同じロジック） ───────────────
function toCanvas(p: AnnotationPoint, w: number, h: number) { return { x: p.x * w, y: p.y * h } }

function renderShape(ctx: CanvasRenderingContext2D, shape: AnnotationShape, w: number, h: number) {
  const pts = shape.points.map((p) => toCanvas(p, w, h))
  ctx.strokeStyle = shape.color; ctx.fillStyle = shape.color
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4
  if (shape.tool === 'free') {
    if (pts.length < 2) return
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y)); ctx.stroke(); return
  }
  if (pts.length < 2) return
  if (shape.tool === 'line') { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y); ctx.stroke(); return }
  if (shape.tool === 'arrow') {
    const [a,b] = [pts[0], pts[pts.length-1]]
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    const ang = Math.atan2(b.y-a.y, b.x-a.x), len=16
    ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x-len*Math.cos(ang-0.4),b.y-len*Math.sin(ang-0.4)); ctx.lineTo(b.x-len*Math.cos(ang+0.4),b.y-len*Math.sin(ang+0.4)); ctx.closePath(); ctx.fill(); return
  }
  if (shape.tool === 'circle') {
    const [a,b] = [pts[0], pts[pts.length-1]]
    ctx.beginPath(); ctx.ellipse((a.x+b.x)/2,(a.y+b.y)/2,Math.max(Math.abs(b.x-a.x)/2,1),Math.max(Math.abs(b.y-a.y)/2,1),0,0,Math.PI*2); ctx.stroke(); return
  }
  if (shape.tool === 'angle' && pts.length >= 3) {
    const [a,b,c] = [pts[0],pts[1],pts[2]]
    ctx.beginPath(); ctx.moveTo(a.x,a.y); pts.forEach((p)=>ctx.lineTo(p.x,p.y)); ctx.stroke()
    const v1={x:a.x-b.x,y:a.y-b.y}, v2={x:c.x-b.x,y:c.y-b.y}
    const dot=v1.x*v2.x+v1.y*v2.y, mag=Math.sqrt(v1.x**2+v1.y**2)*Math.sqrt(v2.x**2+v2.y**2)
    if (mag>0) { const deg=Math.round((Math.acos(Math.min(1,Math.max(-1,dot/mag)))*180)/Math.PI); ctx.shadowBlur=0; ctx.font='bold 16px sans-serif'; ctx.fillStyle='#fff'; ctx.fillText(`${deg}°`,b.x+7,b.y-5); ctx.fillStyle=shape.color; ctx.fillText(`${deg}°`,b.x+6,b.y-6) }
    return
  }
  if (shape.tool === 'text' && shape.text) { ctx.shadowBlur=0; ctx.font='bold 15px sans-serif'; ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillText(shape.text,pts[0].x+1,pts[0].y+1); ctx.fillStyle=shape.color; ctx.fillText(shape.text,pts[0].x,pts[0].y) }
}

// ── 動画フレーム抽出（アノテーション済み） ────────────────────────────────────
async function extractFrame(videoUrl: string, timestamp: number, annotations: SavedAnnotation[]): Promise<{ base64: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true; video.playsInline = true; video.preload = 'metadata'
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.min(timestamp, Math.max(0, (video.duration||999) - 0.05))
    }, { once: true })
    video.addEventListener('seeked', () => {
      const W = video.videoWidth||640, H = video.videoHeight||360
      const canvas = document.createElement('canvas'); canvas.width=W; canvas.height=H
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0, W, H)
      annotations.forEach((ann) => ann.shapes.forEach((shape) => renderShape(ctx, shape, W, H)))
      video.src=''
      resolve({ base64: canvas.toDataURL('image/jpeg', 0.88), w: W, h: H })
    }, { once: true })
    video.addEventListener('error', ()=>reject(new Error('video error')), { once: true })
    video.src = videoUrl
  })
}

// ── AI解析 ────────────────────────────────────────────────────────────────────
interface AIParsed { observations:string[]; problems:string[]; risks:string[]; improvements:string[]; recovery:string[]; rawSections:{heading:string;body:string}[] }
function parseAISummary(text: string): AIParsed {
  const r: AIParsed = { observations:[],problems:[],risks:[],improvements:[],recovery:[],rawSections:[] }
  if (!text) return r
  for (const chunk of text.split(/\n(?=##\s)/)) {
    const lines = chunk.trim().split('\n')
    const heading = lines[0].replace(/^#+\s*/,'').trim()
    const body = lines.slice(1).join('\n').trim()
    if (!heading) continue
    r.rawSections.push({heading,body})
    const items = body.split('\n').map((l)=>l.replace(/^[-・*＊#>\s|]+/,'').replace(/\*\*/g,'').trim()).filter((l)=>l.length>8&&!l.startsWith('##')&&!l.startsWith('---')&&!/^\|[-\s|]+\|$/.test(l)).slice(0,4)
    if (/観察|所見|overview|動作確認/.test(heading)) r.observations.push(...items)
    else if (/問題|課題|気になる|特徴/.test(heading)) r.problems.push(...items)
    else if (/リスク|怪我|合併|予測|注意/.test(heading)) r.risks.push(...items)
    else if (/介入|推奨|改善|アドバイス|提案|トレーニング|エクサ/.test(heading)) r.improvements.push(...items)
    else if (/復帰|見解|ゴール/.test(heading)) r.recovery.push(...items)
    else { const lower=body.toLowerCase(); if(/リスク|危険|注意|再受傷/.test(lower)) r.risks.push(...items); else if(/改善|推奨|運動/.test(lower)) r.improvements.push(...items); else r.observations.push(...items) }
  }
  return r
}
function scoreFromAI(p: AIParsed): number { const issues=p.problems.length+p.risks.length*1.5; const pos=p.observations.filter((s)=>/良好|できて|安定|適切|正常/.test(s)).length; return Math.max(20,Math.min(95,Math.round(80-issues*6+pos*4))) }
function computeScore(comments: VideoComment[], evals: EvaluationResult[]): number {
  let score=80; const sevWeight: Record<string,number>={severe:15,moderate:8,mild:3,none:0}
  evals.forEach((ev)=>ev.items.forEach((it)=>{if(it.checked) score-=(sevWeight[it.severity]??0)}))
  score-=comments.filter((c)=>c.type==='risk').length*8; score-=comments.filter((c)=>c.type==='problem').length*4; score+=comments.filter((c)=>c.type==='positive').length*3
  return Math.max(5,Math.min(100,Math.round(score)))
}

// ── 部位検出 ──────────────────────────────────────────────────────────────────
type BodyRegion='head'|'neck'|'shoulder_l'|'shoulder_r'|'elbow_l'|'elbow_r'|'wrist_l'|'wrist_r'|'chest'|'abdomen'|'lower_back'|'hip_l'|'hip_r'|'knee_l'|'knee_r'|'ankle_l'|'ankle_r'|'foot_l'|'foot_r'|'trunk'|'pelvis'
const REGION_LABELS:Record<BodyRegion,string>={head:'頭部',neck:'頸部',shoulder_l:'左肩',shoulder_r:'右肩',elbow_l:'左肘',elbow_r:'右肘',wrist_l:'左手首',wrist_r:'右手首',chest:'胸部',abdomen:'腹部',lower_back:'腰部',hip_l:'左股関節',hip_r:'右股関節',knee_l:'左膝',knee_r:'右膝',ankle_l:'左足首',ankle_r:'右足首',foot_l:'左足部',foot_r:'右足部',trunk:'体幹',pelvis:'骨盤'}
function detectRegions(text:string):BodyRegion[]{const f=new Set<BodyRegion>();const t=text;if(/頭|頭部/.test(t))f.add('head');if(/頸|首|頚/.test(t))f.add('neck');if(/左肩/.test(t))f.add('shoulder_l');if(/右肩/.test(t))f.add('shoulder_r');if(/肩(?!甲)/.test(t)&&!f.has('shoulder_l')&&!f.has('shoulder_r')){f.add('shoulder_l');f.add('shoulder_r')};if(/左肘/.test(t))f.add('elbow_l');if(/右肘/.test(t))f.add('elbow_r');if(/肘/.test(t)&&!f.has('elbow_l')&&!f.has('elbow_r')){f.add('elbow_l');f.add('elbow_r')};if(/胸|胸郭/.test(t))f.add('chest');if(/腹|コア/.test(t)){f.add('abdomen');f.add('trunk')};if(/腰|腰部/.test(t))f.add('lower_back');if(/骨盤/.test(t))f.add('pelvis');if(/体幹/.test(t))f.add('trunk');if(/左股/.test(t))f.add('hip_l');if(/右股/.test(t))f.add('hip_r');if(/股関節|ヒップ/.test(t)&&!f.has('hip_l')&&!f.has('hip_r')){f.add('hip_l');f.add('hip_r')};if(/左膝/.test(t))f.add('knee_l');if(/右膝/.test(t))f.add('knee_r');if(/膝/.test(t)&&!f.has('knee_l')&&!f.has('knee_r')){f.add('knee_l');f.add('knee_r')};if(/左足首|左足関節/.test(t))f.add('ankle_l');if(/右足首|右足関節/.test(t))f.add('ankle_r');if(/足首|足関節/.test(t)&&!f.has('ankle_l')&&!f.has('ankle_r')){f.add('ankle_l');f.add('ankle_r')};if(/左足部/.test(t))f.add('foot_l');if(/右足部/.test(t))f.add('foot_r');if(/足部|足底|足裏/.test(t)&&!f.has('foot_l')&&!f.has('foot_r')){f.add('foot_l');f.add('foot_r')};return [...f]}

// ── 計測値パネル（ROMItemベース） ────────────────────────────────────────────
const ROM_STATUS_COLOR = { normal: '#16a34a', caution: '#d97706', alert: '#dc2626' }
const ROM_STATUS_LABEL = { normal: '正常', caution: '要注意', alert: '要改善' }
const PLANE_COLOR: Record<string, string> = { '矢状面(前後)': '#0d9488', '前額面(左右)': '#7c3aed' }

function romItemStatus(item: ROMItem): 'normal' | 'caution' | 'alert' {
  if (item.value >= item.normalMin && item.value <= item.normalMax) return 'normal'
  const dev = Math.min(Math.abs(item.value - item.normalMin), Math.abs(item.value - item.normalMax))
  return dev > 15 ? 'alert' : 'caution'
}

function MeasurementPanel({ romItems, poseSide }: { angles: JointAngles | null; romItems: ROMItem[]; poseSide: string }) {
  if (!romItems || romItems.length === 0) return null

  const sideLabel = poseSide === 'front' ? '📷 正面 AI判定' : poseSide === 'side' ? '📷 側面 AI判定' : '📷 方向判定中'
  const sideBg    = poseSide === 'front' ? 'rgba(59,130,246,0.35)' : poseSide === 'side' ? 'rgba(13,148,136,0.35)' : 'rgba(245,158,11,0.35)'
  const sideNote  = poseSide === 'front'
    ? '前額面: 外反/内反・外転・骨盤・肩傾き'
    : poseSide === 'side'
    ? '矢状面: 屈曲/伸展・背屈/底屈・体幹・頭部'
    : '全計測（参考値）'

  return (
    <div style={{ marginTop:'12px', background:'rgba(15,39,68,0.92)', borderRadius:'12px', padding:'12px 14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'10px', fontWeight:'800', color:'#fff', background:sideBg, padding:'2px 8px', borderRadius:'20px' }}>
          {sideLabel}
        </span>
        <span style={{ fontSize:'9px', color:'rgba(255,255,255,0.5)' }}>{sideNote}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'6px', marginTop:'8px' }}>
        {romItems.map((item) => {
          const st = romItemStatus(item)
          const sideColor = item.side === 'L' ? '#60a5fa' : item.side === 'R' ? '#f87171' : '#a3e635'
          const planeColor = PLANE_COLOR[item.plane] ?? '#94a3b8'
          return (
            <div key={item.key} style={{ background:'rgba(255,255,255,0.07)', borderRadius:'8px', padding:'7px 10px', borderLeft:`3px solid ${ROM_STATUS_COLOR[st]}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:'3px', marginBottom:'2px', flexWrap:'wrap' }}>
                <span style={{ fontSize:'8px', fontWeight:'800', color:sideColor, background:'rgba(255,255,255,0.12)', padding:'0 4px', borderRadius:'3px' }}>{item.side}</span>
                <span style={{ fontSize:'8px', color:planeColor, background:`${planeColor}22`, padding:'0 4px', borderRadius:'3px' }}>{item.plane}</span>
              </div>
              <p style={{ fontSize:'9px', color:'rgba(255,255,255,0.55)', margin:'0 0 2px' }}>{item.axis}</p>
              <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.8)', fontWeight:'600', margin:'0 0 4px' }}>{item.label}</p>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:'13px', fontWeight:'800', color:planeColor }}>{item.direction}</span>
                <span style={{ fontSize:'9px', fontWeight:'700', color:ROM_STATUS_COLOR[st] }}>{ROM_STATUS_LABEL[st]}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── シーンカード ───────────────────────────────────────────────────────────────
function SceneCard({ frame, index }: { frame: SceneFrame; index: number }) {
  const [showPose, setShowPose] = useState(true)
  const type = frame.comment?.type ?? 'suggestion'
  const cfg = {
    problem:     { label:'気になる動作', color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
    risk:        { label:'注意が必要な動作', color:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
    positive:    { label:'良好な動作', color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0' },
    improvement: { label:'改善ポイント', color:'#2563eb', bg:'#eff6ff', border:'#bfdbfe' },
    suggestion:  { label:'解析ポイント', color:'#7c3aed', bg:'#faf5ff', border:'#e9d5ff' },
  }[type] ?? { label:'解析ポイント', color:'#7c3aed', bg:'#faf5ff', border:'#e9d5ff' }

  const regions = detectRegions(frame.comment?.text ?? frame.annotation?.label ?? '')
  const mm = Math.floor(frame.timestamp / 60)
  const ss = Math.floor(frame.timestamp % 60).toString().padStart(2,'0')
  const hasPose = !!frame.poseData && frame.angles !== null
  const displayImage = (showPose && frame.poseData) ? frame.poseData : frame.imageData

  return (
    <div style={{ background:'#111827', borderRadius:'16px', overflow:'hidden', breakInside:'avoid', border:`1px solid ${cfg.border}40` }}>
      {/* ヘッダー */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:cfg.bg, borderBottom:`1px solid ${cfg.border}` }}>
        <div style={{ width:'24px',height:'24px',borderRadius:'50%',background:cfg.color,color:'#fff',fontSize:'12px',fontWeight:'900',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{index+1}</div>
        <span style={{ fontSize:'12px',fontWeight:'700',color:cfg.color }}>{cfg.label}</span>
        <span style={{ fontSize:'10px',color:'#9ca3af',marginLeft:'auto',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'999px',padding:'2px 8px' }}>▶ {mm}:{ss} · {MOVEMENT_TYPE_LABELS[frame.movementType as keyof typeof MOVEMENT_TYPE_LABELS]??frame.movementType}</span>
      </div>

      {/* フレーム写真 */}
      <div style={{ position:'relative',background:'#000',lineHeight:0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayImage}
          alt={`シーン${index+1}`}
          crossOrigin="anonymous"
          style={{ width:'100%',display:'block',maxHeight:'300px',objectFit:'contain' }}
        />

        {/* ポーズ切替ボタン（画面のみ） */}
        {hasPose && (
          <button className="no-print" onClick={()=>setShowPose(!showPose)}
            style={{ position:'absolute',top:'8px',right:'8px',background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',color:'#fff',fontSize:'10px',fontWeight:'600',padding:'4px 10px',borderRadius:'999px',border:'1px solid rgba(255,255,255,0.2)',cursor:'pointer' }}>
            {showPose ? '📷 元画像' : '🦴 骨格表示'}
          </button>
        )}
        {hasPose && (
          <div style={{ position:'absolute',top:'8px',left:'8px',background:'rgba(13,148,136,0.85)',backdropFilter:'blur(4px)',color:'#fff',fontSize:'9px',fontWeight:'700',padding:'3px 8px',borderRadius:'999px' }}>
            3D解析済
          </div>
        )}
      </div>

      {/* 計測値 */}
      {hasPose && frame.angles && (
        <div style={{ padding:'0 12px 12px' }}>
          <MeasurementPanel angles={frame.angles} romItems={frame.romItems ?? []} poseSide={frame.poseSide} />
        </div>
      )}

      {/* コメント */}
      {(frame.comment || frame.annotation) && (
        <div style={{ padding:`${hasPose?'0':'12px'} 14px 14px`, display:'flex', flexDirection:'column', gap:'6px' }}>
          {regions.length > 0 && (
            <div style={{ display:'flex',flexWrap:'wrap',gap:'4px' }}>
              {regions.map((r)=><span key={r} style={{ fontSize:'10px',fontWeight:'700',color:cfg.color,background:`${cfg.color}18`,border:`1px solid ${cfg.color}35`,borderRadius:'999px',padding:'1px 8px' }}>📍 {REGION_LABELS[r]}</span>)}
            </div>
          )}
          <p style={{ fontSize:'13px',color:cfg.bg==='#111827'?'#f3f4f6':'#111827',lineHeight:'1.65',margin:0,fontWeight:'500',background:cfg.bg,padding:'8px 10px',borderRadius:'8px' }}>
            {frame.comment?.text ?? frame.annotation?.label}
          </p>
        </div>
      )}
    </div>
  )
}

// ── UI部品 ────────────────────────────────────────────────────────────────────
function LineIcon() { return <svg viewBox="0 0 48 48" style={{ width:'16px',height:'16px',fill:'currentColor' }} xmlns="http://www.w3.org/2000/svg"><path d="M24 4C13 4 4 11.8 4 21.4c0 8.2 6.6 15.1 15.7 16.8l1.3 6.8 5.8-5.4c.4 0 .8.1 1.2.1 11 0 20-7.8 20-17.4S35 4 24 4zm-8 22H12v-9h2v7h2v2zm4 0h-2v-9h2v9zm8 0h-2l-4-6v6h-2v-9h2l4 6v-6h2v9zm6-7h-3v2h3v2h-3v2h3v2h-5v-9h5v1z"/></svg> }

function ScoreBadge({ score }: { score: number }) {
  const color=score>=75?'#16a34a':score>=50?'#d97706':score>=30?'#ea580c':'#dc2626'
  const bg=score>=75?'#f0fdf4':score>=50?'#fffbeb':score>=30?'#fff7ed':'#fef2f2'
  const label=score>=75?'良好':score>=50?'要注意':score>=30?'要改善':'要精査'
  const r=52,cx=70,cy=70,circ=2*Math.PI*r,dash=circ*(score/100)
  return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center' }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="10"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={circ*0.25}/>
        <circle cx={cx} cy={cy} r="42" fill={bg}/>
        <text x={cx} y={cy-8} textAnchor="middle" fontSize="28" fontWeight="800" fill={color}>{score}</text>
        <text x={cx} y={cy+8} textAnchor="middle" fontSize="11" fill="#9ca3af">/ 100</text>
        <text x={cx} y={cy+24} textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>{label}</text>
      </svg>
      <p style={{ fontSize:'11px',color:'#9ca3af',marginTop:'-4px' }}>総合評価スコア</p>
    </div>
  )
}

function StatCard({ value,label,color,bg,icon }: { value:number;label:string;color:string;bg:string;icon:string }) {
  return <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',borderRadius:'14px',padding:'10px 6px',gap:'3px',backgroundColor:bg }}><span style={{ fontSize:'18px' }}>{icon}</span><span style={{ fontSize:'22px',fontWeight:'900',color,lineHeight:1 }}>{value}</span><span style={{ fontSize:'10px',color:'#6b7280',fontWeight:'500',textAlign:'center',lineHeight:1.2 }}>{label}</span></div>
}

function SeverityBar({ label,severity,note }: { label:string;severity:string;note?:string }) {
  const levels:Record<string,number>={none:0,mild:1,moderate:2,severe:3}
  const colors=['#d1d5db','#fbbf24','#f97316','#ef4444']
  const lbls=['なし','軽度','中等度','重度']
  const lv=levels[severity]??0
  return <div style={{ display:'flex',alignItems:'center',gap:'8px',padding:'5px 0',borderBottom:'1px solid #f9fafb' }}><span style={{ fontSize:'11px',color:'#4b5563',width:'120px',flexShrink:0,lineHeight:1.3 }}>{label}</span><div style={{ display:'flex',gap:'2px' }}>{[0,1,2,3].map((i)=><div key={i} style={{ width:'18px',height:'8px',borderRadius:'3px',backgroundColor:i<=lv?colors[lv]:'#e5e7eb' }}/>)}</div><span style={{ fontSize:'11px',fontWeight:'700',width:'44px',color:lv>0?colors[lv]:'#9ca3af' }}>{lbls[lv]}</span>{note&&<span style={{ fontSize:'10px',color:'#9ca3af' }}>{note}</span>}</div>
}

function RadarChart({ data }: { data:{label:string;value:number}[] }) {
  const size=180,cx=size/2,cy=size/2,r=65,n=data.length
  if(n<3) return null
  function pt(i:number,radius:number){const angle=(i/n)*2*Math.PI-Math.PI/2;return{x:cx+radius*Math.cos(angle),y:cy+radius*Math.sin(angle)}}
  const dataPolygon=data.map((d,i)=>{const p=pt(i,r*(d.value/100));return`${p.x},${p.y}`}).join(' ')
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{[0.25,0.5,0.75,1.0].map((lv)=>{const pts=data.map((_,i)=>{const p=pt(i,r*lv);return`${p.x},${p.y}`}).join(' ');return<polygon key={lv} points={pts} fill="none" stroke="#f0f0f0" strokeWidth="1"/>})}{data.map((_,i)=>{const end=pt(i,r);return<line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#e5e7eb" strokeWidth="1"/>})}<polygon points={dataPolygon} fill="rgba(13,148,136,0.12)" stroke="#0d9488" strokeWidth="2.5" strokeLinejoin="round"/>{data.map((d,i)=>{const p=pt(i,r*(d.value/100));return<circle key={i} cx={p.x} cy={p.y} r="4" fill="#0d9488"/>})}{data.map((d,i)=>{const p=pt(i,r+18);return<text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fill="#4b5563" fontWeight="500">{d.label}</text>})}</svg>
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function PatientReport({ case_: c }: Props) {
  const [allComments, setAllComments]     = useState<VideoComment[]>([])
  const [allEvals, setAllEvals]           = useState<EvaluationResult[]>([])
  const [aiSummaries, setAiSummaries]     = useState<AISummary[]>([])
  const [sceneFrames, setSceneFrames]     = useState<SceneFrame[]>([])
  const [framesLoading, setFramesLoading] = useState(false)
  const [copied, setCopied]               = useState(false)
  const [savingImg, setSavingImg]         = useState(false)
  const [expandAIRaw, setExpandAIRaw]     = useState(false)

  const now = new Date().toLocaleDateString('ja-JP', { year:'numeric',month:'long',day:'numeric' })

  useEffect(() => {
    const comments:VideoComment[]=[], summaries:AISummary[]=[]
    c.videos.forEach((v)=>{ comments.push(...getComments(v.id)); summaries.push(...getAISummaries(v.id)) })
    setAllComments(comments); setAllEvals(getAllEvaluations(c.id))
    summaries.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)); setAiSummaries(summaries)

    setFramesLoading(true)
    ;(async () => {
      const frames: SceneFrame[] = []

      // pose-analyzer を動的インポート（ブラウザのみ）
      let analyzeAndAnnotateFrame: ((d:string,w:number,h:number)=>Promise<{annotated:string;result:PoseAnalysisResult}>) | null = null
      try {
        const mod = await import('@/lib/pose-analyzer')
        analyzeAndAnnotateFrame = mod.analyzeAndAnnotateFrame
      } catch { /* skip */ }

      for (const video of c.videos) {
        let videoUrl = getVideoUrl(video.id)
        if (!videoUrl) { videoUrl = await getBlobUrlFromDB(video.id).catch(()=>null); if (videoUrl) saveVideoUrl(video.id, videoUrl) }
        if (!videoUrl) continue

        const videoComments = getComments(video.id).filter((cm)=>['problem','risk','positive','improvement'].includes(cm.type)&&cm.timestamp>=0).sort((a,b)=>a.timestamp-b.timestamp)
        const videoAnnotations = getAnnotations(video.id)

        // コメントなし、かつアノテーションなし → 一定間隔でフレーム抽出
        const hasMarkers = videoComments.length > 0 || videoAnnotations.length > 0
        const timestamps: {ts:number;comment?:VideoComment;annotation?:SavedAnnotation}[] =
          hasMarkers
            ? [
                ...videoComments.slice(0,6).map((cm)=>({ts:cm.timestamp,comment:cm})),
                ...videoAnnotations.filter((a)=>a.shapes.length>0).slice(0,3).map((a)=>({ts:a.timestamp,annotation:a})),
              ]
            : [0.5, 2, 5, 10].map((ts)=>({ts})) // フォールバック：固定タイムスタンプ

        const used=new Set<number>()
        for (const {ts,comment,annotation} of timestamps) {
          const tKey=Math.round(ts*2)/2
          if(used.has(tKey)) continue; used.add(tKey)

          const nearAnnotations=videoAnnotations.filter((ann)=>Math.abs(ann.timestamp-ts)<=2&&ann.shapes.length>0)

          try {
            const { base64,w,h } = await extractFrame(videoUrl, ts, annotation ? [annotation,...nearAnnotations.filter((a)=>a.id!==annotation.id)] : nearAnnotations)

            // ポーズ解析
            let poseData:string|null=null, angles:JointAngles|null=null, romItems:ROMItem[]=[], poseSide:'front'|'side'|'unknown'='unknown'
            if (analyzeAndAnnotateFrame) {
              try {
                const poseResult = await analyzeAndAnnotateFrame(base64, w, h)
                if (poseResult.result.detected) {
                  poseData = poseResult.annotated
                  angles   = poseResult.result.jointAngles
                  romItems = poseResult.result.romItems ?? []
                  poseSide = poseResult.result.poseSide
                }
              } catch { /* pose失敗は無視 */ }
            }

            frames.push({ videoId:video.id, videoLabel:video.label, movementType:video.movementType, timestamp:ts, imageData:base64, poseData, angles, romItems, poseSide, comment, annotation })
          } catch { /* skip */ }
        }
      }

      // 優先度ソート（リスク→問題→改善→良好）
      const typeOrder: Record<string,number> = { risk:0, problem:1, improvement:2, positive:3 }
      frames.sort((a,b)=>(typeOrder[a.comment?.type??'z']??4)-(typeOrder[b.comment?.type??'z']??4))
      setSceneFrames(frames)
      setFramesLoading(false)
    })()
  }, [c])

  const problemComments  = allComments.filter((cm)=>cm.type==='problem')
  const riskComments     = allComments.filter((cm)=>cm.type==='risk')
  const improvComments   = allComments.filter((cm)=>cm.type==='improvement')
  const positiveComments = allComments.filter((cm)=>cm.type==='positive')
  const hasManual = allComments.length>0||allEvals.length>0

  const latestAI  = aiSummaries[0]??null
  const aiParsed  = latestAI ? parseAISummary(latestAI.summary) : null
  const hasAI     = !!aiParsed&&(aiParsed.problems.length+aiParsed.risks.length+aiParsed.improvements.length+aiParsed.observations.length>0)
  const score     = hasManual ? computeScore(allComments,allEvals) : hasAI ? scoreFromAI(aiParsed!) : 80

  const displayPositive = positiveComments.length>0 ? positiveComments.map((cm)=>({text:cm.text,fromAI:false})) : (aiParsed?.observations??[]).filter((s)=>/良好|できて|安定|適切|正常|維持/.test(s)).map((s)=>({text:s,fromAI:true}))
  const displayProblems = problemComments.length>0 ? problemComments.map((cm)=>({text:cm.text,fromAI:false})) : (aiParsed?.problems??[]).map((s)=>({text:s,fromAI:true}))
  const displayRisks    = riskComments.length>0 ? riskComments.map((cm)=>({text:cm.text,fromAI:false})) : (aiParsed?.risks??[]).map((s)=>({text:s,fromAI:true}))
  const displayImprov   = improvComments.length>0 ? improvComments.map((cm)=>({text:cm.text,fromAI:false})) : [...(aiParsed?.improvements??[]),...(aiParsed?.recovery??[])].map((s)=>({text:s,fromAI:true}))

  const priorityItems: {text:string;type:'risk'|'problem'|'improvement';fromAI:boolean}[] = [
    ...displayRisks.slice(0,2).map((x)=>({...x,type:'risk'as const})),
    ...displayProblems.slice(0,2).map((x)=>({...x,type:'problem'as const})),
    ...displayImprov.slice(0,2).map((x)=>({...x,type:'improvement'as const})),
  ].slice(0,5)

  const severeItems = allEvals.flatMap((ev)=>ev.items.filter((it)=>it.checked&&it.severity!==''&&it.severity!=='none').map((it)=>({...it})))
  const movTypes    = [...new Set(c.videos.map((v)=>v.movementType))]
  const radarData   = movTypes.slice(0,6).map((mt)=>{
    const vid=c.videos.find((v)=>v.movementType===mt); if(!vid) return{label:MOVEMENT_TYPE_LABELS[mt]??mt,value:70}
    const rel=allComments.filter((cm)=>cm.videoId===vid.id)
    const neg=rel.filter((cm)=>cm.type==='problem'||cm.type==='risk').length, pos=rel.filter((cm)=>cm.type==='positive').length
    const aiProb=aiParsed?aiParsed.problems.length+aiParsed.risks.length:0
    const val=hasManual?Math.max(20,Math.min(100,100-neg*18+pos*10)):Math.max(20,Math.min(95,80-aiProb*5))
    return{label:MOVEMENT_TYPE_LABELS[mt]??mt,value:val}
  })
  const hasContent = hasManual||hasAI

  function buildShareText(){
    const lines=[`【動作分析レポート】${now}`,`診断: ${c.diagnosis} / ${c.injuredPart}`,`総合スコア: ${score}/100`,'']
    if(displayPositive.length){lines.push('✅ 良好な点');displayPositive.forEach((x)=>lines.push(`・${x.text}`));lines.push('')}
    if(priorityItems.length){lines.push('🎯 優先改善アクション');priorityItems.forEach((item,i)=>lines.push(`${i+1}. ${item.text}`));lines.push('')}
    if(displayRisks.length){lines.push('🔴 注意事項');displayRisks.forEach((x)=>lines.push(`▲ ${x.text}`));lines.push('')}
    lines.push('※本レポートは動作分析の補助情報です。','YUUKI MOTION LAB 動作解析サービス')
    return lines.join('\n')
  }

  function handleCopy(){navigator.clipboard.writeText(buildShareText()).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500)})}
  function handleLine(){
    const text = buildShareText().slice(0, 800)
    const url = `https://line.me/R/share?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }
  function handlePrint(){window.print()}

  // ── レポートを画像化してクリップボードにコピー ──
  async function handleSaveImage() {
    setSavingImg(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const el = document.getElementById('patient-report-body')
      if (!el) return

      // 全 <img> のロードを待つ
      const allImgs = Array.from(el.querySelectorAll('img'))
      await Promise.all(allImgs.map((img) => {
        if (img.complete && img.naturalHeight > 0) return Promise.resolve()
        return new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res() })
      }))
      await new Promise((r) => setTimeout(r, 300))

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 0,
        backgroundColor: '#ffffff',
        windowWidth: 960,
        logging: false,
        onclone: (_doc, clonedEl) => {
          clonedEl.querySelectorAll<HTMLElement>('.no-print,[data-noprint]').forEach((n) => { n.style.display = 'none' })
        },
      })

      // PNG blob を生成
      const pngBlob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => b ? res(b) : rej(new Error('toBlob failed')), 'image/png')
      )

      // ① モバイル：Web Share API（LINEへ直接送信）
      if (typeof navigator.canShare === 'function') {
        const file = new File([pngBlob], `report_${c.anonymousId}.png`, { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '動作分析レポート' })
          return
        }
      }

      // ② PC：クリップボードにコピー → LINEにCtrl+Vで貼り付け可能
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
        return
      }

      // ③ 最終フォールバック：ダウンロード
      const url = URL.createObjectURL(pngBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report_${c.anonymousId}_${new Date().toISOString().slice(0,10)}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('画像コピーエラー:', e)
    } finally {
      setSavingImg(false)
    }
  }

  return (
    <>
      {/* ── ツールバー ── */}
      <div className="no-print" style={{ display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',marginBottom:'20px',padding:'12px 16px',background:'#fff',borderRadius:'16px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
          <Share2 style={{ width:'16px',height:'16px',color:'#0d9488' }}/>
          <span style={{ fontSize:'13px',fontWeight:'700',color:'#111827' }}>患者様向け説明レポート</span>
          {framesLoading && <span style={{ fontSize:'11px',color:'#0d9488',display:'flex',alignItems:'center',gap:'4px' }}><Activity style={{ width:'12px',height:'12px' }}/>3D解析中...</span>}
        </div>
        <div style={{ marginLeft:'auto',display:'flex',gap:'8px',flexWrap:'wrap' }}>
          {/* 画像コピー / LINEで共有（メイン） */}
          <button
            onClick={handleSaveImage}
            disabled={savingImg}
            style={{ display:'flex',alignItems:'center',gap:'6px',padding:'6px 12px',background:savingImg?'#6b7280':copied?'#16a34a':'#06C755',color:'#fff',fontWeight:'600',borderRadius:'8px',fontSize:'13px',border:'none',cursor:savingImg?'not-allowed':'pointer',opacity:savingImg?0.7:1 }}
          >
            {savingImg
              ? <><span style={{ fontSize:'12px' }}>⏳</span>画像生成中...</>
              : copied
                ? <><Check style={{ width:'14px',height:'14px' }}/>コピー完了！LINEに貼り付けて送信</>
                : <><ImageDown style={{ width:'14px',height:'14px' }}/>画像をコピー（LINEに貼り付け）</>
            }
          </button>
          {/* テキストコピー（サブ） */}
          <button onClick={handleCopy} style={{ display:'flex',alignItems:'center',gap:'6px',padding:'6px 12px',background:'#fff',color:'#374151',fontWeight:'600',borderRadius:'8px',fontSize:'13px',border:'1px solid #e5e7eb',cursor:'pointer' }}>
            <Copy style={{ width:'14px',height:'14px' }}/>テキストのみコピー
          </button>
          <button onClick={handlePrint} style={{ display:'flex',alignItems:'center',gap:'6px',padding:'6px 12px',background:'#111827',color:'#fff',fontWeight:'600',borderRadius:'8px',fontSize:'13px',border:'none',cursor:'pointer' }}><Printer style={{ width:'14px',height:'14px' }}/>印刷</button>
        </div>
      </div>

      {/* ── レポート本体 ── */}
      <div id="patient-report-body" style={{ background:'#fff',borderRadius:'16px',overflow:'hidden',border:'1px solid #f3f4f6',boxShadow:'0 1px 8px rgba(0,0,0,0.07)' }}>

        {/* ヘッダー */}
        <div style={{ background:'linear-gradient(135deg,#0f2744 0%,#0d9488 100%)',padding:'28px 32px' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'16px' }}>
            <div>
              <p style={{ color:'rgba(255,255,255,0.45)',fontSize:'10px',letterSpacing:'0.15em',textTransform:'uppercase',margin:'0 0 6px' }}>Motion Analysis Report</p>
              <h1 style={{ color:'#fff',fontSize:'22px',fontWeight:'800',letterSpacing:'0.04em',margin:'0 0 4px' }}>動作分析レポート</h1>
              <p style={{ color:'rgba(255,255,255,0.6)',fontSize:'13px',margin:0 }}>患者様ご説明用</p>
            </div>
            <div style={{ textAlign:'right',flexShrink:0 }}>
              <p style={{ color:'rgba(255,255,255,0.5)',fontSize:'11px',margin:'0 0 4px' }}>{now}</p>
              <p style={{ color:'#5eead4',fontSize:'14px',fontWeight:'700',letterSpacing:'0.05em',margin:0 }}>YUUKI MOTION LAB</p>
            </div>
          </div>
          <div style={{ marginTop:'20px',paddingTop:'16px',borderTop:'1px solid rgba(255,255,255,0.15)',display:'flex',flexWrap:'wrap',gap:'24px' }}>
            {[{label:'診断名',value:c.diagnosis},{label:'評価部位',value:c.injuredPart},{label:'評価目的',value:c.evaluationPurpose}].map(({label,value})=>(
              <div key={label}><p style={{ color:'rgba(255,255,255,0.4)',fontSize:'9px',textTransform:'uppercase',letterSpacing:'0.12em',margin:'0 0 3px' }}>{label}</p><p style={{ color:'#fff',fontSize:'13px',fontWeight:'600',margin:0 }}>{value}</p></div>
            ))}
          </div>
        </div>

        <div style={{ padding:'28px 32px',display:'flex',flexDirection:'column',gap:'28px' }}>

          {/* ① スコア */}
          <div style={{ display:'flex',alignItems:'center',gap:'24px',background:'#f9fafb',borderRadius:'16px',padding:'20px',flexWrap:'wrap' }}>
            <ScoreBadge score={score}/>
            <div style={{ flex:1,minWidth:'200px',display:'flex',flexDirection:'column',gap:'12px' }}>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px' }}>
                <StatCard value={displayPositive.length} label="良好な点" color="#16a34a" bg="#f0fdf4" icon="✅"/>
                <StatCard value={displayProblems.length} label="気になる点" color="#d97706" bg="#fffbeb" icon="⚠️"/>
                <StatCard value={displayImprov.length} label="改善提案" color="#2563eb" bg="#eff6ff" icon="🎯"/>
                <StatCard value={displayRisks.length} label="注意事項" color="#dc2626" bg="#fef2f2" icon="🔴"/>
              </div>
              {c.videos.length>0&&<div><p style={{ fontSize:'10px',color:'#9ca3af',fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.08em',margin:'0 0 6px' }}>評価した動作</p><div style={{ display:'flex',flexWrap:'wrap',gap:'6px' }}>{c.videos.map((v)=><span key={v.id} style={{ fontSize:'11px',padding:'3px 10px',background:'#fff',border:'1px solid #e5e7eb',color:'#4b5563',borderRadius:'999px' }}>{MOVEMENT_TYPE_LABELS[v.movementType]} — {v.label}</span>)}</div></div>}
            </div>
          </div>

          {!hasContent&&<div style={{ textAlign:'center',padding:'48px 16px',color:'#9ca3af',border:'2px dashed #e5e7eb',borderRadius:'16px' }}><p style={{ fontSize:'13px',fontWeight:'600',margin:'0 0 6px' }}>データがまだ記録されていません</p><p style={{ fontSize:'12px',margin:0 }}>動画分析ページでコメント・AI解析を実行してください</p></div>}

          {hasContent&&(
            <>
              {/* ② グラフ */}
              {(radarData.length>=3||severeItems.length>0)&&(
                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'16px' }}>
                  {radarData.length>=3&&<div style={{ background:'#fff',border:'1px solid #f3f4f6',borderRadius:'16px',padding:'20px' }}><p style={{ fontSize:'11px',fontWeight:'700',color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.08em',margin:'0 0 12px' }}>動作別評価バランス</p><div style={{ display:'flex',justifyContent:'center' }}><RadarChart data={radarData}/></div><p style={{ fontSize:'10px',color:'#9ca3af',textAlign:'center',margin:'4px 0 0' }}>外側ほど良好 / 内側ほど改善が必要</p></div>}
                  {severeItems.length>0&&<div style={{ background:'#fff',border:'1px solid #f3f4f6',borderRadius:'16px',padding:'20px' }}><p style={{ fontSize:'11px',fontWeight:'700',color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.08em',margin:'0 0 12px' }}>チェックポイント別重症度</p>{severeItems.slice(0,10).map((it,i)=><SeverityBar key={i} label={it.label} severity={it.severity} note={it.note}/>)}</div>}
                </div>
              )}

              {/* ③ 解析シーン写真（3D骨格計測） */}
              <section>
                <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px' }}>
                  <div style={{ width:'4px',height:'24px',borderRadius:'999px',background:'#0d9488',flexShrink:0 }}/>
                  <Camera style={{ width:'16px',height:'16px',color:'#0d9488' }}/>
                  <h3 style={{ fontSize:'13px',fontWeight:'800',color:'#111827',margin:0 }}>解析シーン — 動画フレーム ＋ 3D関節計測</h3>
                </div>
                {framesLoading&&sceneFrames.length===0&&(
                  <div style={{ display:'flex',alignItems:'center',gap:'10px',padding:'20px',background:'#f9fafb',borderRadius:'12px',color:'#9ca3af',fontSize:'12px' }}>
                    <div style={{ width:'18px',height:'18px',border:'2px solid #d1d5db',borderTopColor:'#0d9488',borderRadius:'50%',animation:'spin 1s linear infinite',flexShrink:0 }}/>
                    フレームを抽出・3D解析中（初回はモデルのダウンロードに1分ほどかかります）...
                  </div>
                )}
                {sceneFrames.length>0&&(
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'16px' }}>
                    {sceneFrames.map((frame,i)=><SceneCard key={`${frame.videoId}-${frame.timestamp}`} frame={frame} index={i}/>)}
                  </div>
                )}
              </section>

              {/* ④ 良好な点 */}
              {displayPositive.length>0&&(
                <section>
                  <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px' }}><div style={{ width:'4px',height:'24px',borderRadius:'999px',background:'#16a34a',flexShrink:0 }}/><h3 style={{ fontSize:'13px',fontWeight:'800',color:'#111827',margin:0 }}>✅ 良好な点</h3><p style={{ fontSize:'11px',color:'#9ca3af',margin:0 }}>現在できていること</p></div>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'8px' }}>
                    {displayPositive.map((x,i)=>{const regions=detectRegions(x.text);return<div key={i} style={{ background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'12px',padding:'12px 14px' }}>{regions.length>0&&<div style={{ display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'6px' }}>{regions.map((r)=><span key={r} style={{ fontSize:'10px',fontWeight:'700',color:'#16a34a',background:'#dcfce7',border:'1px solid #bbf7d0',borderRadius:'999px',padding:'1px 7px' }}>📍 {REGION_LABELS[r]}</span>)}</div>}<p style={{ fontSize:'13px',color:'#14532d',lineHeight:'1.65',margin:0 }}>{x.text}</p></div>})}
                  </div>
                </section>
              )}

              {/* ⑤ 優先改善アクション */}
              {priorityItems.length>0&&(
                <section>
                  <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px' }}><div style={{ width:'4px',height:'24px',borderRadius:'999px',background:'#2563eb',flexShrink:0 }}/><h3 style={{ fontSize:'13px',fontWeight:'800',color:'#111827',margin:0 }}>🎯 優先改善アクション</h3><p style={{ fontSize:'11px',color:'#9ca3af',margin:0 }}>今すぐ意識してほしいこと</p></div>
                  <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
                    {priorityItems.map((item,i)=>{const cfg={risk:{bg:'#fef2f2',border:'#fecaca',circle:'#dc2626',text:'#7f1d1d'},problem:{bg:'#fffbeb',border:'#fde68a',circle:'#d97706',text:'#78350f'},improvement:{bg:'#eff6ff',border:'#bfdbfe',circle:'#2563eb',text:'#1e3a8a'}}[item.type];const regions=detectRegions(item.text);return<div key={i} style={{ background:cfg.bg,border:`1px solid ${cfg.border}`,borderRadius:'12px',padding:'12px 14px',display:'flex',alignItems:'flex-start',gap:'12px' }}><div style={{ width:'26px',height:'26px',borderRadius:'50%',background:cfg.circle,color:'#fff',fontSize:'12px',fontWeight:'900',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{i+1}</div><div style={{ flex:1 }}>{regions.length>0&&<div style={{ display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'5px' }}>{regions.map((r)=><span key={r} style={{ fontSize:'10px',fontWeight:'700',color:cfg.circle,background:`${cfg.circle}15`,border:`1px solid ${cfg.circle}30`,borderRadius:'999px',padding:'1px 7px' }}>📍 {REGION_LABELS[r]}</span>)}</div>}<p style={{ fontSize:'13px',color:cfg.text,lineHeight:'1.65',margin:0 }}>{item.text}</p></div></div>})}
                  </div>
                </section>
              )}

              {/* ⑥ 気になる動作 */}
              {displayProblems.length>0&&(
                <section>
                  <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px' }}><div style={{ width:'4px',height:'24px',borderRadius:'999px',background:'#d97706',flexShrink:0 }}/><h3 style={{ fontSize:'13px',fontWeight:'800',color:'#111827',margin:0 }}>⚠️ 気になる動作の特徴</h3></div>
                  <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
                    {displayProblems.map((x,i)=>{const regions=detectRegions(x.text);return<div key={i} style={{ background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'12px',padding:'12px 14px' }}>{regions.length>0&&<div style={{ display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'5px' }}>{regions.map((r)=><span key={r} style={{ fontSize:'10px',fontWeight:'700',color:'#d97706',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:'999px',padding:'1px 7px' }}>📍 {REGION_LABELS[r]}</span>)}</div>}<p style={{ fontSize:'13px',color:'#78350f',lineHeight:'1.65',margin:0 }}>{x.text}</p></div>})}
                  </div>
                </section>
              )}

              {/* ⑦ 注意事項 */}
              {displayRisks.length>0&&(
                <section>
                  <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px' }}><div style={{ width:'4px',height:'24px',borderRadius:'999px',background:'#dc2626',flexShrink:0 }}/><h3 style={{ fontSize:'13px',fontWeight:'800',color:'#111827',margin:0 }}>🔴 重要な注意事項</h3></div>
                  <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
                    {displayRisks.map((x,i)=>{const regions=detectRegions(x.text);return<div key={i} style={{ background:'#fef2f2',border:'1px solid #fecaca',borderLeft:'4px solid #ef4444',borderRadius:'0 12px 12px 0',padding:'12px 14px' }}>{regions.length>0&&<div style={{ display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'5px' }}>{regions.map((r)=><span key={r} style={{ fontSize:'10px',fontWeight:'700',color:'#dc2626',background:'#fee2e2',border:'1px solid #fecaca',borderRadius:'999px',padding:'1px 7px' }}>📍 {REGION_LABELS[r]}</span>)}</div>}<p style={{ fontSize:'13px',color:'#7f1d1d',lineHeight:'1.65',fontWeight:'500',margin:0 }}>{x.text}</p></div>})}
                  </div>
                </section>
              )}

              {/* ⑧ AI所見（画面のみ） */}
              {latestAI&&<div className="no-print"><button onClick={()=>setExpandAIRaw(!expandAIRaw)} style={{ display:'flex',alignItems:'center',gap:'8px',width:'100%',background:'#faf5ff',border:'1px solid #e9d5ff',borderRadius:'16px',padding:'12px 16px',cursor:'pointer',textAlign:'left' }}><Bot style={{ width:'16px',height:'16px',color:'#7c3aed',flexShrink:0 }}/><span style={{ fontSize:'13px',fontWeight:'700',color:'#5b21b6',flex:1 }}>AI所見全文（{latestAI.createdAt.slice(0,10)}）</span>{expandAIRaw?<ChevronUp style={{ width:'16px',height:'16px',color:'#a78bfa' }}/>:<ChevronDown style={{ width:'16px',height:'16px',color:'#a78bfa' }}/>}</button>{expandAIRaw&&<div style={{ marginTop:'8px',background:'#faf5ff',border:'1px solid #e9d5ff',borderRadius:'16px',padding:'20px' }}><p style={{ fontSize:'12px',color:'#374151',lineHeight:'1.8',whiteSpace:'pre-line',margin:0 }}>{latestAI.summary}</p></div>}</div>}
            </>
          )}

          {/* フッター */}
          <div style={{ borderTop:'1px solid #f3f4f6',paddingTop:'20px',display:'flex',flexDirection:'column',gap:'10px' }}>
            <div style={{ background:'#f9fafb',borderRadius:'12px',padding:'16px',display:'flex',gap:'12px',alignItems:'flex-start' }}>
              <span style={{ fontSize:'20px',flexShrink:0 }}>📋</span>
              <div><p style={{ fontSize:'11px',fontWeight:'700',color:'#374151',margin:'0 0 4px' }}>ご注意事項</p><p style={{ fontSize:'10px',color:'#6b7280',lineHeight:'1.7',margin:0 }}>本レポートは動作分析システムによる補助情報として作成されたものです。3D関節計測値はMediaPipe AIによる推定値であり、医療機器による計測値ではありません。治療方針・競技復帰の最終判断は担当医師・理学療法士の指示に従ってください。</p></div>
            </div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 4px' }}>
              <p style={{ fontSize:'10px',color:'#9ca3af',margin:0 }}>YUUKI MOTION LAB 動作解析サービス</p>
              <p style={{ fontSize:'10px',color:'#9ca3af',margin:0 }}>{now} 作成</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          body * { visibility: hidden !important; }
          #patient-report-body, #patient-report-body * { visibility: visible !important; }
          #patient-report-body { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; background: #ffffff !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; overflow: visible !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; visibility: hidden !important; }
          .hidden.print\\:block { display: block !important; visibility: visible !important; }
        }
        @page { size: A4; margin: 10mm 12mm; }
      `}</style>
    </>
  )
}
