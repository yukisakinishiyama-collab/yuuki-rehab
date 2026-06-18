'use client';

import { use, useState, useEffect } from 'react';
import { KaradaMapStore, PHASE_INFO, type Session, type Patient, type HomeExercise, type MilestoneEvaluation } from '@/lib/karada-map-store';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

/**
 * 患者画面 — URLトークンでアクセス
 * 設計原則チェック（実装後セルフレビュー）:
 * 1. 卒業がゴール ✓ 山登り型進捗・「卒業まであと○回」を最上部に表示
 * 2. 責めない ✓ キャンセル情報非表示、赤色未使用
 * 3. 見える化は患者のため ✓ 初回比較グラフで改善を強調
 * 4. 不安を煽らない ✓ リスク説明は炎症期説明の1か所のみ
 * 5. 決定権は患者に ✓ 変更の強制表現なし
 * 6. スタッフ負担最小 ✓ 患者入力は週実施数の5秒タップのみ
 */

export default function PatientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [exercises, setExercises] = useState<HomeExercise[]>([]);
  const [milestones, setMilestones] = useState<MilestoneEvaluation[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'exercises' | 'report'>('home');
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    const p = KaradaMapStore.getPatientByToken(token);
    if (!p) return;
    setPatient(p);
    setSessions(KaradaMapStore.getSessions(p.id));
    setExercises(KaradaMapStore.getHomeExercises(p.id));
    setMilestones(KaradaMapStore.getMilestones(p.id));
  }, [token]);

  if (!patient) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🗺️</div>
          <h1 className="text-xl font-bold text-slate-700 mb-2">カラダの地図</h1>
          <p className="text-slate-500">ページが見つかりません。URLをご確認ください。</p>
        </div>
      </div>
    );
  }

  const nextAppt = KaradaMapStore.getAppointments(patient.id)
    .filter(a => a.status === '予定')
    .sort((a, b) => a.datetime.localeCompare(b.datetime))[0];

  const latestSession = sessions[sessions.length - 1];
  const fontClass = fontSize === 'large' ? 'text-lg' : 'text-base';
  const phaseInfo = PHASE_INFO[patient.phase];
  const remainingSessions = Math.max(0, patient.plannedSessions - patient.completedSessions);
  const progress = Math.min(100, Math.round((patient.completedSessions / patient.plannedSessions) * 100));

  // 山登り型の「合目」（10合目を卒業とする）
  const goume = Math.round(progress / 10);

  return (
    <div className={`min-h-screen bg-gradient-to-b from-blue-50 to-slate-50 ${fontClass}`}>
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗺️</span>
            <span className="font-bold text-slate-800">カラダの地図</span>
          </div>
          <button
            onClick={() => setFontSize(f => f === 'normal' ? 'large' : 'normal')}
            className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-200"
          >
            {fontSize === 'normal' ? '文字を大きく' : '文字を戻す'}
          </button>
        </div>

        {/* タブ */}
        <div className="max-w-xl mx-auto px-4 flex gap-1">
          {([
            { id: 'home', label: '回復マップ' },
            { id: 'exercises', label: '自宅メニュー' },
            { id: 'report', label: '評価レポート' },
          ] as { id: typeof activeTab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        {activeTab === 'home' && <HomeTab patient={patient} sessions={sessions} nextAppt={nextAppt} goume={goume} progress={progress} remainingSessions={remainingSessions} phaseInfo={phaseInfo} latestSession={latestSession} />}
        {activeTab === 'exercises' && <ExercisesTab exercises={exercises} patientId={patient.id} onUpdate={() => setExercises(KaradaMapStore.getHomeExercises(patient.id))} />}
        {activeTab === 'report' && <ReportTab sessions={sessions} milestones={milestones} patient={patient} />}
      </main>
    </div>
  );
}

// ========================
// A-1: ホーム「わたしの回復マップ」
// ========================
function HomeTab({
  patient, sessions, nextAppt, goume, progress, remainingSessions, phaseInfo, latestSession,
}: {
  patient: Patient;
  sessions: Session[];
  nextAppt: ReturnType<typeof KaradaMapStore.getAppointments>[0] | undefined;
  goume: number;
  progress: number;
  remainingSessions: number;
  phaseInfo: typeof PHASE_INFO[keyof typeof PHASE_INFO];
  latestSession: Session | undefined;
}) {
  const chartData = sessions.map(s => ({ date: s.date.slice(5), 痛みスコア: s.painScore }));
  const originPain = sessions[0]?.painScore;

  return (
    <>
      {/* ゴール表示 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">あなたのゴール</div>
        <p className="text-xl font-bold text-slate-800 leading-snug">🎯 {patient.goalText}</p>
      </div>

      {/* 山登り型進捗 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h2 className="font-bold text-slate-800 mb-4">卒業までの道のり</h2>
        <MountainProgress goume={goume} progress={progress} patient={patient} />
        <div className="mt-4 text-center">
          {patient.phase === '卒業' ? (
            <p className="text-purple-700 font-bold text-lg">🎉 卒業おめでとうございます！</p>
          ) : (
            <p className="text-slate-700">
              卒業まであと <span className="text-2xl font-bold text-blue-600">{remainingSessions}</span> 回
            </p>
          )}
        </div>
      </div>

      {/* 回復の3ステージ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h2 className="font-bold text-slate-800 mb-3">回復の3ステージ</h2>
        <div className="space-y-2">
          {(['炎症期', '修復期', 'リモデリング期'] as const).map((phase, i) => {
            const info = PHASE_INFO[phase];
            const isCurrentPhase = patient.phase === phase;
            return (
              <div key={phase} className={`rounded-xl p-3 border ${isCurrentPhase ? info.color + ' border-2' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isCurrentPhase ? 'bg-white/60' : 'bg-slate-100'}`}>
                    {i + 1}
                  </span>
                  <span className="font-semibold">{phase}</span>
                  {isCurrentPhase && <span className="text-xs ml-auto font-medium">← 今ここ</span>}
                </div>
                {isCurrentPhase && (
                  <p className="text-sm mt-1.5 leading-relaxed">{info.description}</p>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
          ※ 痛みが消えるのは2段階目の途中です。ゴールは「再発しない身体」をつくることです。
        </p>
      </div>

      {/* 痛みスコア推移グラフ */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-bold text-slate-800 mb-4">痛みの変化グラフ</h2>
          <p className="text-xs text-slate-500 mb-3">グラフが下に向かうほど、痛みが和らいでいます。</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} reversed tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}`, '痛みスコア']} />
              {originPain !== undefined && (
                <ReferenceLine y={originPain} stroke="#94a3b8" strokeDasharray="4 2" label={{ value: '初回', fontSize: 10, fill: '#94a3b8' }} />
              )}
              <Line type="monotone" dataKey="痛みスコア" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: '#22c55e' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 施術者からのひとこと */}
      {latestSession?.staffComment && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <div className="text-xs text-blue-600 font-semibold mb-1">担当者からのひとこと</div>
          <p className="text-slate-800 leading-relaxed">{latestSession.staffComment}</p>
        </div>
      )}

      {/* 次回予約 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h2 className="font-bold text-slate-800 mb-2">次回のご来院</h2>
        {nextAppt ? (
          <>
            <p className="text-slate-700 text-lg font-semibold">
              {nextAppt.datetime.replace('T', ' ').slice(0, 16).replace('-', '年').replace('-', '月').replace(' ', '日 ')}
            </p>
          </>
        ) : (
          <p className="text-slate-500">予約はまだ入っていません。</p>
        )}
        <p className="text-sm text-slate-500 mt-2">
          ご都合が変わった場合は、LINEで一言いただければいつでも変更できます。お気軽にどうぞ。
        </p>
      </div>
    </>
  );
}

// 山登り型ビジュアル
function MountainProgress({ goume, progress, patient }: { goume: number; progress: number; patient: Patient }) {
  const steps = [0, 2, 4, 6, 8, 10];
  return (
    <div>
      <div className="relative flex items-end justify-center gap-0 h-28 px-2">
        {/* 山の形 */}
        <svg viewBox="0 0 320 120" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="mtnGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#dbeafe" />
              <stop offset="100%" stopColor="#93c5fd" />
            </linearGradient>
          </defs>
          <polygon points="0,120 160,10 320,120" fill="url(#mtnGrad)" opacity="0.7" />
          {/* 進捗部分を青く */}
          <clipPath id="progressClip">
            <rect x="0" y={120 - (progress / 100 * 110)} width="320" height="120" />
          </clipPath>
          <polygon points="0,120 160,10 320,120" fill="#3b82f6" opacity="0.4" clipPath="url(#progressClip)" />
        </svg>

        {/* 合目マーカー */}
        <div className="relative z-10 w-full flex justify-between items-end px-6 h-full">
          {steps.map(step => {
            const heightPct = step * 10;
            const bottom = `${(step / 10) * 75}%`;
            const left = step === 0 ? '0%' : step === 10 ? '100%' : `${step * 10}%`;
            const current = goume >= step && goume < step + 2;
            return (
              <div key={step} className="flex flex-col items-center" style={{ position: 'absolute', bottom, left, transform: 'translateX(-50%)' }}>
                <div className={`w-3 h-3 rounded-full border-2 ${current ? 'bg-blue-600 border-blue-600 scale-150' : progress >= heightPct ? 'bg-blue-300 border-blue-400' : 'bg-slate-200 border-slate-300'} transition-all`} />
              </div>
            );
          })}

          {/* 現在地のキャラクター */}
          <div
            className="absolute text-xl transition-all duration-700"
            style={{
              bottom: `${(Math.min(progress, 95) / 100) * 75}%`,
              left: `${progress}%`,
              transform: 'translateX(-50%)',
            }}
          >
            {patient.phase === '卒業' ? '🏆' : '🧑‍🦺'}
          </div>

          {/* 山頂フラグ */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 text-xl">🚩</div>
        </div>
      </div>

      <div className="flex justify-between text-xs text-slate-400 mt-1 px-2">
        <span>スタート</span>
        <span className="font-semibold text-blue-600">{goume}合目</span>
        <span>卒業 🎉</span>
      </div>
    </div>
  );
}

// ========================
// A-2: 自宅メニュー
// ========================
function ExercisesTab({ exercises, patientId, onUpdate }: { exercises: HomeExercise[]; patientId: string; onUpdate: () => void }) {
  const [saving, setSaving] = useState<string | null>(null);

  function setCount(id: string, count: number) {
    setSaving(id);
    KaradaMapStore.updateHomeExerciseDoneCount(id, count);
    onUpdate();
    setTimeout(() => setSaving(null), 800);
  }

  if (exercises.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
        <p className="text-slate-500">自宅メニューはまだ登録されていません。</p>
        <p className="text-slate-400 text-sm mt-1">次回来院時にスタッフにご相談ください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
        できた日数をタップして教えてください。記録はあなたの回復の参考にさせていただきます。
        できなかった日があっても、まったく問題ありません。
      </div>

      {exercises.map(ex => (
        <div key={ex.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-800 mb-1">{ex.title}</h3>
          {ex.videoUrl && (
            <a href={ex.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
              動画を見る →
            </a>
          )}
          <div className="mt-4">
            <div className="text-sm text-slate-600 mb-2">今週できた日数（記録なしでも大丈夫です）</div>
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: 8 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCount(ex.id, i)}
                  className={`w-10 h-10 rounded-xl text-sm font-semibold transition-all ${
                    ex.weeklyDoneCount === i
                      ? 'bg-green-500 text-white scale-110'
                      : 'bg-slate-100 text-slate-600 hover:bg-green-100'
                  }`}
                >
                  {saving === ex.id && ex.weeklyDoneCount === i ? '✓' : i === 0 ? '—' : i}
                </button>
              ))}
            </div>
            {ex.weeklyDoneCount !== null && ex.weeklyDoneCount > 0 && (
              <p className="text-sm text-green-700 mt-2">
                今週は {ex.weeklyDoneCount}日 できましたね。素晴らしいです！
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ========================
// A-3: 評価日レポート
// ========================
function ReportTab({ sessions, milestones, patient }: { sessions: Session[]; milestones: MilestoneEvaluation[]; patient: Patient }) {
  if (milestones.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
        <p className="text-slate-500">評価日レポートはまだありません。</p>
        <p className="text-slate-400 text-sm mt-1">初めての評価日（4回目）のあとに表示されます。</p>
      </div>
    );
  }

  const firstSession = sessions[0];
  const latestMilestone = milestones[milestones.length - 1];
  const painImprovement = firstSession ? firstSession.painScore - latestMilestone.painScore : 0;

  return (
    <div className="space-y-5">
      {/* ねぎらい文 */}
      <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl p-6 text-white text-center">
        <div className="text-3xl mb-2">✨</div>
        <p className="font-bold text-lg">ここまでの回復は、あなたが通い続けた成果です。</p>
      </div>

      {/* 初回 vs 最新比較 */}
      {firstSession && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-bold text-slate-800 mb-4">初回との比較</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-500 mb-1">初回（{firstSession.date.slice(5)}）</div>
              <div className="text-5xl font-bold text-slate-600">{firstSession.painScore}</div>
              <div className="text-xs text-slate-500 mt-1">痛みスコア</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center border-2 border-green-300">
              <div className="text-xs text-green-600 mb-1">今回（{latestMilestone.date.slice(5)}）</div>
              <div className="text-5xl font-bold text-green-600">{latestMilestone.painScore}</div>
              <div className="text-xs text-green-600 mt-1">痛みスコア</div>
            </div>
          </div>
          {painImprovement > 0 && (
            <div className="mt-4 bg-green-50 rounded-xl p-3 text-center">
              <p className="text-green-700 font-semibold">
                痛みスコアが <span className="text-2xl">{painImprovement}</span> 改善しました 🎉
              </p>
            </div>
          )}
          {latestMilestone.romValue && (
            <div className="mt-3 text-sm text-slate-600">
              <span className="font-medium">可動域：</span>{latestMilestone.romValue}
            </div>
          )}
        </div>
      )}

      {/* 評価日グラフ */}
      {milestones.length > 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-bold text-slate-800 mb-4">評価日の変化</h2>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={milestones.map(m => ({ 回数: `第${m.sessionNumber}回`, 痛み: m.painScore }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="回数" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} reversed tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="痛み" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 各評価日の記録 */}
      <div className="space-y-3">
        {[...milestones].reverse().map(m => (
          <div key={m.id} className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-800">第{m.sessionNumber}回評価日</span>
              <span className="text-xs text-slate-500">{m.date}</span>
            </div>
            <div className="text-sm text-slate-600">痛みスコア: {m.painScore} / {m.romValue && `可動域: ${m.romValue}`}</div>
            {m.memo && <p className="text-sm text-slate-500 mt-1">{m.memo}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
