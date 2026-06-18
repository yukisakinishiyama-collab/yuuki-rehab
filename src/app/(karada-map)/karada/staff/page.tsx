'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  KaradaMapStore,
  MESSAGE_TEMPLATES,
  PHASE_INFO,
  type Patient,
  type Session,
  type Appointment,
  type AppointmentStatus,
  type Phase,
  type AgeGroup,
  type Category,
} from '@/lib/karada-map-store';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ========================
// LINE送信ユーティリティ
// ========================

/**
 * LINEアプリを開いてメッセージを自動入力する
 * - スマートフォン: LINEアプリが起動し、送信先を選ぶ画面になる
 * - PC: LINE for Windows/Mac が起動（インストール済みの場合）
 * 将来のMessaging API連携: /api/line-send エンドポイントを追加し、
 * userId を保持することでサーバーサイドから自動送信に移行できる
 */
function openLineWithMessage(text: string) {
  const encoded = encodeURIComponent(text);
  // line:// スキームはモバイルアプリ起動、https はフォールバック
  const url = `https://line.me/R/msg/text/?${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function buildMessage(templateId: string, patient: Patient | null, patientUrl?: string): string {
  const tmpl = MESSAGE_TEMPLATES.find(t => t.id === templateId);
  if (!tmpl) return '';
  let text = tmpl.template;
  if (patient) {
    text = text.replace(/{name}/g, patient.name);
    const nextAppt = KaradaMapStore.getAppointments(patient.id).find(a => a.status === '予定');
    if (nextAppt) {
      const [date, time] = nextAppt.datetime.split('T');
      text = text.replace(/{datetime}/g, `${date} ${time?.slice(0, 5)}`);
      text = text.replace(/{time}/g, time?.slice(0, 5) ?? '');
    }
    if (patientUrl) {
      text = text.replace(/（患者ページURL添付）/g, `\n${patientUrl}`);
      text = text.replace(/（URL）/g, `\n${patientUrl}`);
    }
  }
  return text;
}

// ========================
// PIN認証
// ========================
const STAFF_PIN = '1234'; // 本番: 環境変数 + bcrypt推奨

function PinScreen({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  function submit() {
    if (pin === STAFF_PIN) {
      sessionStorage.setItem('km-staff-auth', '1');
      onAuth();
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🗺️</div>
          <h1 className="text-2xl font-bold text-slate-800">カラダの地図</h1>
          <p className="text-slate-500 mt-1 text-sm">スタッフ用管理画面</p>
        </div>
        <div className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="PINを入力"
            className={`w-full border-2 rounded-xl px-4 py-3 text-center text-2xl tracking-widest outline-none transition-colors ${
              error ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-blue-400'
            }`}
          />
          {error && <p className="text-center text-red-500 text-sm">PINが正しくありません</p>}
          <button
            onClick={submit}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition-colors"
          >
            ログイン
          </button>
        </div>
        <p className="text-center text-slate-400 text-xs mt-6">デモ用PIN: 1234</p>
      </div>
    </div>
  );
}

// ========================
// メインアプリ
// ========================
type Tab = 'dashboard' | 'schedule' | 'patients' | 'templates' | 'kpi';

export default function StaffPage() {
  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (sessionStorage.getItem('km-staff-auth') === '1') setAuthed(true);
  }, []);

  function refresh() { setRefreshKey(k => k + 1); }

  if (!authed) return <PinScreen onAuth={() => setAuthed(true)} />;

  if (selectedPatientId) {
    return (
      <PatientDetail
        patientId={selectedPatientId}
        onBack={() => { setSelectedPatientId(null); refresh(); }}
        key={selectedPatientId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗺️</span>
            <span className="font-bold text-slate-800">カラダの地図</span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">スタッフ</span>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem('km-staff-auth'); setAuthed(false); }}
            className="text-slate-400 text-sm hover:text-slate-600"
          >
            ログアウト
          </button>
        </div>
        {/* タブ */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-0">
          {([
            { id: 'dashboard', label: '本日' },
            { id: 'schedule', label: '予約表' },
            { id: 'patients', label: '患者一覧' },
            { id: 'templates', label: 'テンプレ文' },
            { id: 'kpi', label: 'KPI' },
          ] as { id: Tab; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6" key={refreshKey}>
        {activeTab === 'dashboard' && <DashboardTab onSelectPatient={setSelectedPatientId} />}
        {activeTab === 'schedule' && <ScheduleTab onSelectPatient={setSelectedPatientId} />}
        {activeTab === 'patients' && <PatientsTab onSelectPatient={setSelectedPatientId} />}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'kpi' && <KPITab />}
      </main>
    </div>
  );
}

// ========================
// 予約表（週間カレンダー）
// ========================

const HOURS = Array.from({ length: 10 }, (_, i) => i + 9); // 9〜18時
const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

/** 週の月曜〜土曜の日付配列を返す（日曜始まりでなく月曜始まり） */
function getWeekDays(base: Date): Date[] {
  const d = new Date(base);
  const day = d.getDay();
  // 月曜を週頭に
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 6 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

// 患者ごとの色（最大10色）
const PATIENT_COLORS = [
  'bg-blue-200 border-blue-400 text-blue-900',
  'bg-green-200 border-green-400 text-green-900',
  'bg-purple-200 border-purple-400 text-purple-900',
  'bg-amber-200 border-amber-400 text-amber-900',
  'bg-pink-200 border-pink-400 text-pink-900',
  'bg-teal-200 border-teal-400 text-teal-900',
  'bg-indigo-200 border-indigo-400 text-indigo-900',
  'bg-rose-200 border-rose-400 text-rose-900',
  'bg-cyan-200 border-cyan-400 text-cyan-900',
  'bg-lime-200 border-lime-400 text-lime-900',
];

interface LineAppt {
  id: string;
  patientName: string;
  lineUserId: string;
  lineDisplayName?: string;
  datetime: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  linkedPatientId?: string;
}

function ScheduleTab({ onSelectPatient }: { onSelectPatient: (id: string) => void }) {
  const [baseDate, setBaseDate] = useState(new Date());
  const [appointments, setAppointments] = useState(() => KaradaMapStore.getAppointments());
  const [patients, setPatients] = useState(() => KaradaMapStore.getPatients());
  const [lineAppts, setLineAppts] = useState<LineAppt[]>([]);
  const [lineApptCount, setLineApptCount] = useState(0); // 通知バッジ用
  const [showLinePanel, setShowLinePanel] = useState(false);
  const [showSetupPanel, setShowSetupPanel] = useState(false);

  // 新規予約モーダル
  const [newAppt, setNewAppt] = useState<{ date: string; hour: number } | null>(null);
  const [newPatientId, setNewPatientId] = useState('');
  const [newMinute, setNewMinute] = useState('00');

  // LINE予約シミュレーター
  const [simName, setSimName] = useState('');
  const [simDate, setSimDate] = useState('');
  const [simTime, setSimTime] = useState('10:00');
  const [simSending, setSimSending] = useState(false);
  const [simResult, setSimResult] = useState('');

  const weekDays = getWeekDays(baseDate);
  const today = toDateStr(new Date());

  const colorMap = Object.fromEntries(
    patients.map((p, i) => [p.id, PATIENT_COLORS[i % PATIENT_COLORS.length]])
  );

  // LINE予約を30秒ごとにポーリング
  useEffect(() => {
    async function fetchLineAppts() {
      try {
        const res = await fetch('/api/karada-line/appointments');
        const data: LineAppt[] = await res.json();
        const pending = data.filter(a => a.status === 'pending');
        setLineAppts(data);
        setLineApptCount(prev => {
          if (pending.length > prev) setShowLinePanel(true); // 新着時に自動表示
          return pending.length;
        });
      } catch { /* ネットワークエラーは無視 */ }
    }
    fetchLineAppts();
    const timer = setInterval(fetchLineAppts, 30_000);
    return () => clearInterval(timer);
  }, []);

  function prevWeek() { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d); }
  function nextWeek() { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d); }
  function goToday() { setBaseDate(new Date()); }

  function refresh() {
    setAppointments(KaradaMapStore.getAppointments());
    setPatients(KaradaMapStore.getPatients());
  }

  function getAppts(dateStr: string, hour: number) {
    return appointments.filter(a => {
      if (!a.datetime.startsWith(dateStr)) return false;
      return parseInt(a.datetime.split('T')[1]?.slice(0, 2) ?? '0') === hour;
    });
  }

  function getLineAppts(dateStr: string, hour: number) {
    return lineAppts.filter(a => {
      if (a.status === 'cancelled') return false;
      if (!a.datetime.startsWith(dateStr)) return false;
      return parseInt(a.datetime.split('T')[1]?.slice(0, 2) ?? '0') === hour;
    });
  }

  function openNewAppt(date: string, hour: number) {
    setNewAppt({ date, hour });
    setNewPatientId(patients[0]?.id ?? '');
    setNewMinute('00');
  }

  function saveNewAppt() {
    if (!newAppt || !newPatientId) return;
    KaradaMapStore.addAppointment({
      patientId: newPatientId,
      datetime: `${newAppt.date}T${String(newAppt.hour).padStart(2, '0')}:${newMinute}`,
      status: '予定',
    });
    refresh();
    setNewAppt(null);
  }

  function updateStatus(id: string, status: AppointmentStatus) {
    KaradaMapStore.updateAppointmentStatus(id, status);
    refresh();
  }

  // LINE予約を承認 → karadaMapStoreに追加
  async function approveLineAppt(la: LineAppt, patientId: string) {
    KaradaMapStore.addAppointment({ patientId, datetime: la.datetime, status: '予定' });
    await fetch('/api/karada-line/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: la.id, status: 'confirmed', linkedPatientId: patientId }),
    });
    const res = await fetch('/api/karada-line/appointments');
    setLineAppts(await res.json());
    refresh();
  }

  async function cancelLineAppt(id: string) {
    await fetch('/api/karada-line/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'cancelled' }),
    });
    const res = await fetch('/api/karada-line/appointments');
    setLineAppts(await res.json());
  }

  // シミュレーター送信
  async function sendSimAppt() {
    if (!simName || !simDate) return;
    setSimSending(true);
    setSimResult('');
    const datetime = `${simDate}T${simTime}`;
    const res = await fetch('/api/karada-line/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientName: simName, datetime, lineDisplayName: simName }),
    });
    if (res.ok) {
      setSimResult('✅ LINE予約が届きました。予約表に表示されます。');
      setSimName(''); setSimDate('');
      const appts = await fetch('/api/karada-line/appointments').then(r => r.json());
      setLineAppts(appts);
      setShowLinePanel(true);
    } else {
      setSimResult('送信に失敗しました。');
    }
    setSimSending(false);
  }

  const pendingLineAppts = lineAppts.filter(a => a.status === 'pending');
  const weekLabel = `${weekDays[0].getMonth() + 1}月${weekDays[0].getDate()}日 〜 ${weekDays[5].getMonth() + 1}月${weekDays[5].getDate()}日`;

  return (
    <div className="space-y-4">
      {/* ナビゲーション */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-100 px-4 py-3">
        <button onClick={prevWeek} className="text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 text-lg">‹</button>
        <div className="text-center">
          <div className="font-semibold text-slate-800">{weekLabel}</div>
          <button onClick={goToday} className="text-xs text-blue-600 hover:underline mt-0.5">今週に戻る</button>
        </div>
        <button onClick={nextWeek} className="text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 text-lg">›</button>
      </div>

      {/* LINEボタン行 */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowLinePanel(v => !v)}
          className="flex items-center gap-1.5 bg-[#06C755] text-white text-sm px-4 py-2 rounded-xl hover:bg-[#05b34c] transition-colors relative"
        >
          <LineIcon />
          LINE予約
          {pendingLineAppts.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {pendingLineAppts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowSetupPanel(v => !v)}
          className="text-sm bg-slate-100 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-200"
        >
          ⚙️ LINE設定 / テスト
        </button>
      </div>

      {/* LINE予約受信パネル */}
      {showLinePanel && (
        <div className="bg-white border border-[#06C755]/40 rounded-xl overflow-hidden">
          <div className="bg-[#06C755]/10 px-4 py-2.5 flex items-center gap-2">
            <LineIcon />
            <span className="font-semibold text-slate-800 text-sm">LINEからの予約リクエスト</span>
            {pendingLineAppts.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingLineAppts.length}件 未承認</span>
            )}
          </div>
          {lineAppts.length === 0 ? (
            <p className="text-slate-400 text-sm p-4">まだLINEからの予約はありません。</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {lineAppts.map(la => (
                <LineApptRow
                  key={la.id}
                  la={la}
                  patients={patients}
                  onApprove={approveLineAppt}
                  onCancel={cancelLineAppt}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* LINE設定 / シミュレーターパネル */}
      {showSetupPanel && (
        <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-5">
          {/* Webhook設定情報 */}
          <div>
            <h3 className="font-bold text-slate-800 mb-3">📡 LINE Webhook 設定</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-sm">
              <div>
                <div className="text-xs text-slate-500 mb-1">Webhook URL（LINE Developers Consoleに貼り付け）</div>
                <div className="flex gap-2">
                  <code className="flex-1 bg-white border border-slate-200 rounded px-3 py-2 text-xs break-all">
                    {typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/karada-line/webhook
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/karada-line/webhook`)}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 shrink-0"
                  >コピー</button>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <p>① <a href="https://developers.line.biz/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">LINE Developers Console</a> でMessaging APIチャネルを作成</p>
                <p>② Webhook URLに上記URLを設定し「Webhook送信」をオンに</p>
                <p>③ チャネルシークレットとアクセストークンを環境変数に設定:</p>
                <code className="block bg-white border border-slate-200 rounded px-3 py-2 text-xs">
                  LINE_CHANNEL_SECRET=xxxx{'\n'}
                  LINE_CHANNEL_ACCESS_TOKEN=xxxx
                </code>
                <p className="text-amber-600">⚠️ 本番環境ではHTTPS必須。Vercel / Renderへのデプロイを推奨。</p>
              </div>
            </div>
          </div>

          {/* シミュレーター */}
          <div>
            <h3 className="font-bold text-slate-800 mb-3">🧪 LINE予約シミュレーター</h3>
            <p className="text-xs text-slate-500 mb-3">患者様がLINEで予約した場合の動作をテストできます。送信すると予約表に反映されます。</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">患者名</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={simName}
                  onChange={e => setSimName(e.target.value)}
                  placeholder="田中 花子"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-1 block">日付</label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    value={simDate}
                    onChange={e => setSimDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">時刻</label>
                  <input
                    type="time"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    value={simTime}
                    onChange={e => setSimTime(e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={sendSimAppt}
                disabled={simSending || !simName || !simDate}
                className="w-full bg-[#06C755] text-white rounded-xl py-2.5 font-semibold hover:bg-[#05b34c] disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                <LineIcon />
                {simSending ? '送信中...' : 'LINE予約を送信（テスト）'}
              </button>
              {simResult && <p className="text-sm text-green-700 bg-green-50 rounded-lg p-2">{simResult}</p>}
            </div>
          </div>
        </div>
      )}

      {/* 凡例 */}
      <div className="flex flex-wrap gap-2">
        {patients.map((p, i) => (
          <span key={p.id} className={`text-xs px-2 py-0.5 rounded-full border ${PATIENT_COLORS[i % PATIENT_COLORS.length]}`}>
            {p.name}
          </span>
        ))}
        <span className="text-xs px-2 py-0.5 rounded-full border bg-[#06C755]/10 border-[#06C755]/40 text-[#06C755] font-medium flex items-center gap-1">
          <LineIcon /> LINE予約
        </span>
      </div>

      {/* カレンダー本体 */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-auto">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="w-14 py-2 text-slate-400 font-normal text-xs sticky left-0 bg-white z-10">時刻</th>
              {weekDays.map(d => {
                const ds = toDateStr(d);
                const isToday = ds === today;
                const dayIdx = d.getDay();
                return (
                  <th key={ds} className={`py-2 px-1 font-medium text-center ${isToday ? 'text-blue-600' : dayIdx === 0 ? 'text-red-400' : dayIdx === 6 ? 'text-blue-400' : 'text-slate-700'}`}>
                    <div className={`inline-flex flex-col items-center ${isToday ? 'bg-blue-600 text-white rounded-lg px-2 py-0.5' : ''}`}>
                      <span className="text-xs font-normal">{DAYS_JA[dayIdx]}</span>
                      <span className="text-base font-bold">{d.getDate()}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour} className="border-b border-slate-50 hover:bg-slate-50/50 group">
                <td className="text-xs text-slate-400 text-right pr-2 py-1 align-top sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 w-14">
                  {hour}:00
                </td>
                {weekDays.map(d => {
                  const ds = toDateStr(d);
                  const cellAppts = getAppts(ds, hour);
                  const cellLineAppts = getLineAppts(ds, hour);
                  return (
                    <td key={ds} className="align-top p-0.5 min-w-[90px] cursor-pointer" onClick={() => openNewAppt(ds, hour)}>
                      {/* 通常予約 */}
                      {cellAppts.map(appt => {
                        const patient = patients.find(p => p.id === appt.patientId);
                        if (!patient) return null;
                        const time = appt.datetime.split('T')[1]?.slice(0, 5);
                        const isDone = appt.status === '来院済';
                        return (
                          <div
                            key={appt.id}
                            className={`rounded border text-xs px-1.5 py-1 mb-0.5 cursor-pointer transition-opacity ${colorMap[patient.id]} ${isDone ? 'opacity-50' : ''}`}
                            onClick={e => { e.stopPropagation(); onSelectPatient(patient.id); }}
                          >
                            <div className="font-semibold truncate">{patient.name}</div>
                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              <span className="opacity-70">{time}</span>
                              <select
                                value={appt.status}
                                onClick={e => e.stopPropagation()}
                                onChange={e => { e.stopPropagation(); updateStatus(appt.id, e.target.value as AppointmentStatus); }}
                                className="text-xs bg-white/60 border-0 rounded px-0.5 py-0 cursor-pointer max-w-[72px]"
                              >
                                {(['予定', '来院済', '変更済', '連絡ありキャンセル', '連絡なし'] as AppointmentStatus[]).map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                      {/* LINE予約 */}
                      {cellLineAppts.map(la => (
                        <div
                          key={la.id}
                          className={`rounded border text-xs px-1.5 py-1 mb-0.5 ${la.status === 'confirmed' ? 'bg-[#06C755]/20 border-[#06C755]/50' : 'bg-[#06C755]/10 border-[#06C755]/40 border-dashed'}`}
                          onClick={e => { e.stopPropagation(); setShowLinePanel(true); }}
                        >
                          <div className="flex items-center gap-0.5 font-semibold text-[#047a35] truncate">
                            <LineIcon />{la.patientName}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-[#047a35]/70">
                            <span>{la.datetime.split('T')[1]?.slice(0, 5)}</span>
                            <span className="text-xs">{la.status === 'confirmed' ? '✓承認済' : '未承認'}</span>
                          </div>
                        </div>
                      ))}
                      {cellAppts.length === 0 && cellLineAppts.length === 0 && (
                        <div className="h-8 flex items-center justify-center opacity-0 hover:opacity-100 text-slate-300 text-lg">＋</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 新規予約モーダル */}
      {newAppt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setNewAppt(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-4">予約を追加</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">日時</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">{newAppt.date.slice(5).replace('-', '月')}日</span>
                  <span className="text-sm font-medium text-slate-700">{newAppt.hour}:</span>
                  <select value={newMinute} onChange={e => setNewMinute(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 text-sm">
                    {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">患者様</label>
                <select value={newPatientId} onChange={e => setNewPatientId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveNewAppt} className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 font-semibold hover:bg-blue-700 text-sm">予約を追加</button>
              <button onClick={() => setNewAppt(null)} className="px-4 text-slate-500 hover:text-slate-700 text-sm">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// LINE予約1行コンポーネント
function LineApptRow({
  la, patients, onApprove, onCancel,
}: {
  la: LineAppt;
  patients: Patient[];
  onApprove: (la: LineAppt, patientId: string) => void;
  onCancel: (id: string) => void;
}) {
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id ?? '');
  const dt = la.datetime;
  const d = new Date(dt);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const formatted = `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const statusBadge = {
    pending: <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">未承認</span>,
    confirmed: <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ 承認済</span>,
    cancelled: <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">キャンセル</span>,
  }[la.status];

  return (
    <div className={`px-4 py-3 ${la.status !== 'pending' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">{la.patientName}</span>
            {statusBadge}
          </div>
          <div className="text-sm text-slate-600 mt-0.5">🗓️ {formatted}</div>
          {la.lineDisplayName && la.lineDisplayName !== la.patientName && (
            <div className="text-xs text-slate-400">LINE表示名: {la.lineDisplayName}</div>
          )}
        </div>
      </div>
      {la.status === 'pending' && (
        <div className="mt-2 flex gap-2 flex-wrap items-center">
          <select
            value={selectedPatientId}
            onChange={e => setSelectedPatientId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1 flex-1 min-w-0"
          >
            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            onClick={() => onApprove(la, selectedPatientId)}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 whitespace-nowrap"
          >
            承認して予約表へ
          </button>
          <button
            onClick={() => onCancel(la.id)}
            className="text-sm text-slate-500 hover:text-slate-700 px-2 py-1.5 whitespace-nowrap"
          >
            却下
          </button>
        </div>
      )}
    </div>
  );
}

// ========================
// B-1: 本日のダッシュボード
// ========================
function DashboardTab({ onSelectPatient }: { onSelectPatient: (id: string) => void }) {
  const todayAppts = KaradaMapStore.getTodayAppointments();
  const followCandidates = KaradaMapStore.getFollowCandidates();
  const patients = KaradaMapStore.getPatients();
  const [appts, setAppts] = useState(todayAppts);

  function updateStatus(id: string, status: AppointmentStatus) {
    KaradaMapStore.updateAppointmentStatus(id, status);
    setAppts(KaradaMapStore.getTodayAppointments());
  }

  const statusColors: Record<AppointmentStatus, string> = {
    予定: 'bg-blue-100 text-blue-700',
    来院済: 'bg-green-100 text-green-700',
    変更済: 'bg-slate-100 text-slate-600',
    連絡ありキャンセル: 'bg-slate-100 text-slate-600',
    連絡なし: 'bg-slate-100 text-slate-600', // 赤色は使わない（設計原則）
  };

  return (
    <div className="space-y-6">
      {/* 本日の予約 */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-3">本日の予約</h2>
        {appts.length === 0 ? (
          <p className="text-slate-500 text-sm bg-white rounded-xl p-4 border border-slate-100">本日の予約はありません</p>
        ) : (
          <div className="space-y-2">
            {appts.map(appt => {
              const patient = patients.find(p => p.id === appt.patientId);
              if (!patient) return null;
              const time = appt.datetime.split('T')[1]?.slice(0, 5);
              return (
                <div key={appt.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
                  <div className="text-slate-700 font-mono text-sm w-12">{time}</div>
                  <div className="flex-1">
                    <button
                      onClick={() => onSelectPatient(patient.id)}
                      className="font-semibold text-slate-800 hover:text-blue-600 text-left"
                    >
                      {patient.name}
                    </button>
                    <div className="text-xs text-slate-500">{patient.category} / {patient.phase}</div>
                  </div>
                  <select
                    value={appt.status}
                    onChange={e => updateStatus(appt.id, e.target.value as AppointmentStatus)}
                    className={`text-xs rounded-lg px-2 py-1 border-0 font-medium ${statusColors[appt.status]}`}
                  >
                    {(['予定', '来院済', '変更済', '連絡ありキャンセル', '連絡なし'] as AppointmentStatus[]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => onSelectPatient(patient.id)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    記録入力
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* フォロー候補 */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-1">きょうのフォロー候補</h2>
        <p className="text-xs text-slate-500 mb-3">青色の表示は評価・状態確認のご案内候補です。アクションは任意です。</p>
        {followCandidates.length === 0 ? (
          <p className="text-slate-500 text-sm bg-white rounded-xl p-4 border border-slate-100">現在フォロー候補はありません</p>
        ) : (
          <div className="space-y-2">
            {followCandidates.map(({ patient, reason }) => (
              <div key={patient.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <button
                    onClick={() => onSelectPatient(patient.id)}
                    className="font-semibold text-slate-800 hover:text-blue-600"
                  >
                    {patient.name}
                  </button>
                  <div className="text-xs text-blue-700 mt-0.5">{reason}</div>
                </div>
                <CopyTemplateButton patient={patient} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CopyTemplateButton({ patient }: { patient: Patient }) {
  const [copied, setCopied] = useState(false);
  const patientUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/karada/patient/${patient.urlToken}`
    : '';
  const text = buildMessage('followup_10days', patient, patientUrl);

  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={copy}
        className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
      >
        {copied ? '✓ コピー' : 'コピー'}
      </button>
      <button
        onClick={() => openLineWithMessage(text)}
        className="text-xs bg-[#06C755] text-white px-3 py-1.5 rounded-lg hover:bg-[#05b34c] transition-colors whitespace-nowrap flex items-center gap-1"
      >
        <LineIcon />
        LINEで送る
      </button>
    </div>
  );
}

function LineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

// ========================
// 患者一覧
// ========================
function PatientsTab({ onSelectPatient }: { onSelectPatient: (id: string) => void }) {
  const patients = KaradaMapStore.getPatients();
  const [showAddForm, setShowAddForm] = useState(false);
  const [, forceUpdate] = useState(0);

  const phaseOrder: Phase[] = ['炎症期', '修復期', 'リモデリング期', '卒業'];
  const sorted = [...patients].sort((a, b) => phaseOrder.indexOf(a.phase) - phaseOrder.indexOf(b.phase));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">患者一覧（{patients.length}名）</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
        >
          ＋ 新規登録
        </button>
      </div>

      {showAddForm && (
        <AddPatientForm
          onDone={() => { setShowAddForm(false); forceUpdate(n => n + 1); }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {sorted.map(patient => {
        const progress = Math.min(100, Math.round((patient.completedSessions / patient.plannedSessions) * 100));
        const phaseStyle = PHASE_INFO[patient.phase];
        return (
          <div
            key={patient.id}
            className="bg-white border border-slate-100 rounded-xl p-4 cursor-pointer hover:border-blue-200 transition-colors"
            onClick={() => onSelectPatient(patient.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{patient.name}</span>
                  <span className="text-xs text-slate-500">{patient.ageGroup} / {patient.category}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">🎯 {patient.goalText}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {patient.completedSessions}/{patient.plannedSessions}回
                  </span>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg border font-medium whitespace-nowrap ${phaseStyle.color}`}>
                {patient.phase}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddPatientForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: '',
    ageGroup: '成人' as AgeGroup,
    category: '慢性痛' as Category,
    goalText: '',
    plannedSessions: 10,
    frequencyPlan: '週2回',
    estimatedCostNote: '',
    phase: '炎症期' as Phase,
    completedSessions: 0,
  });

  function submit() {
    if (!form.name || !form.goalText) return;
    KaradaMapStore.addPatient(form);
    onDone();
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
      <h3 className="font-semibold text-slate-800">新規患者登録</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-600 mb-1 block">お名前</label>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="山田 太郎" />
        </div>
        <div>
          <label className="text-xs text-slate-600 mb-1 block">年齢区分</label>
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.ageGroup} onChange={e => setForm(f => ({ ...f, ageGroup: e.target.value as AgeGroup }))}>
            {(['若年', '成人', '高齢'] as AgeGroup[]).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-600 mb-1 block">区分</label>
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
            {(['外傷', 'スポーツ', '術後', '慢性痛'] as Category[]).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-600 mb-1 block">フェーズ</label>
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value as Phase }))}>
            {(['炎症期', '修復期', 'リモデリング期'] as Phase[]).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-slate-600 mb-1 block">患者様ご自身の言葉でのゴール</label>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.goalText} onChange={e => setForm(f => ({ ...f, goalText: e.target.value }))} placeholder="例：孫と散歩に行けるようになりたい" />
        </div>
        <div>
          <label className="text-xs text-slate-600 mb-1 block">計画回数</label>
          <input type="number" min={1} max={50} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.plannedSessions} onChange={e => setForm(f => ({ ...f, plannedSessions: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="text-xs text-slate-600 mb-1 block">通院ペース</label>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.frequencyPlan} onChange={e => setForm(f => ({ ...f, frequencyPlan: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-slate-600 mb-1 block">費用目安メモ</label>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.estimatedCostNote} onChange={e => setForm(f => ({ ...f, estimatedCostNote: e.target.value }))} placeholder="例: 1回3,000円程度、計30,000円の目安" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={submit} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">登録</button>
        <button onClick={onCancel} className="text-slate-600 text-sm px-4 py-2 rounded-lg hover:bg-slate-100">キャンセル</button>
      </div>
    </div>
  );
}

// ========================
// B-2: 患者詳細・来院記録入力
// ========================
const COMMENT_TEMPLATES = [
  '本日もお疲れ様でした。着実に回復しています。',
  '動きが滑らかになってきましたね。',
  '自宅でのエクササイズも効果が出ています。',
  '次回の施術でさらに良くなりますよ。',
  'ゴールに向かって順調に進んでいます。',
  '痛みが落ち着いてきましたね。',
  '可動域が広がってきました。',
];

function PatientDetail({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const patient = KaradaMapStore.getPatientById(patientId);
  const [sessions, setSessions] = useState(() => KaradaMapStore.getSessions(patientId));
  const [appts, setAppts] = useState(() => KaradaMapStore.getAppointments(patientId));
  const [exercises, setExercises] = useState(() => KaradaMapStore.getHomeExercises(patientId));
  const [tab, setTab] = useState<'record' | 'exercises' | 'appointment'>('record');

  // 来院記録フォーム
  const [painScore, setPainScore] = useState(5);
  const [romNote, setRomNote] = useState('');
  const [comment, setComment] = useState('');
  const [isEvalDay, setIsEvalDay] = useState(false);
  const [saved, setSaved] = useState(false);

  // 予約追加フォーム
  const [newApptDate, setNewApptDate] = useState('');
  const [newApptTime, setNewApptTime] = useState('10:00');

  // エクササイズ追加
  const [newExTitle, setNewExTitle] = useState('');
  const [newExUrl, setNewExUrl] = useState('');

  if (!patient) return <div className="p-8 text-slate-500">患者データが見つかりません。</div>;

  const originPain = sessions[0]?.painScore ?? painScore;
  const chartData = sessions.map(s => ({
    date: s.date.slice(5),
    痛みスコア: s.painScore,
  }));

  const patientUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/patient/${patient.urlToken}`
    : `/patient/${patient.urlToken}`;

  function saveRecord() {
    const today = new Date().toISOString().split('T')[0];
    KaradaMapStore.addSession({ patientId, date: today, painScore, romNote, staffComment: comment, isEvaluationDay: isEvalDay });
    if (isEvalDay) {
      KaradaMapStore.addMilestone({ patientId, sessionNumber: (patient?.completedSessions ?? 0) + 1, painScore, romValue: romNote, memo: comment, date: today });
    }
    setSessions(KaradaMapStore.getSessions(patientId));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setRomNote('');
    setComment('');
  }

  function addAppt() {
    if (!newApptDate) return;
    KaradaMapStore.addAppointment({ patientId, datetime: `${newApptDate}T${newApptTime}`, status: '予定' });
    setAppts(KaradaMapStore.getAppointments(patientId));
    setNewApptDate('');
  }

  function addExercise() {
    if (!newExTitle) return;
    KaradaMapStore.addHomeExercise({ patientId, title: newExTitle, videoUrl: newExUrl, weeklyDoneCount: null, lastUpdated: new Date().toISOString().split('T')[0] });
    setExercises(KaradaMapStore.getHomeExercises(patientId));
    setNewExTitle('');
    setNewExUrl('');
  }

  function copyPatientUrl() {
    navigator.clipboard.writeText(patientUrl);
  }

  const progress = Math.min(100, Math.round((patient.completedSessions / patient.plannedSessions) * 100));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="text-slate-500 hover:text-slate-700 text-sm">← 戻る</button>
          <div className="flex-1">
            <h1 className="font-bold text-slate-800">{patient.name}</h1>
            <div className="text-xs text-slate-500">{patient.ageGroup} / {patient.category} / {patient.phase}</div>
          </div>
          <button
            onClick={copyPatientUrl}
            className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200"
          >
            患者ページURLをコピー
          </button>
        </div>

        {/* 患者サマリー */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-sm font-medium text-slate-700">🎯 {patient.goalText}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-white rounded-full h-2 border border-blue-100">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-slate-600">{patient.completedSessions}/{patient.plannedSessions}回</span>
            </div>
          </div>
        </div>

        {/* タブ */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1">
          {([
            { id: 'record', label: '来院記録' },
            { id: 'exercises', label: '自宅メニュー' },
            { id: 'appointment', label: '予約管理' },
          ] as { id: typeof tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {tab === 'record' && (
          <>
            {/* 痛みスコア入力（60秒以内設計） */}
            <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
              <h2 className="font-bold text-slate-800">本日の記録入力</h2>

              <div>
                <label className="text-sm text-slate-600 mb-2 block">痛みスコア（0 = まったく痛くない、10 = 最大の痛み）</label>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setPainScore(i)}
                      className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${
                        painScore === i
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-blue-100'
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-600 mb-1 block">可動域メモ</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={romNote}
                  onChange={e => setRomNote(e.target.value)}
                  placeholder="例: 膝関節屈曲120度"
                />
              </div>

              <div>
                <label className="text-sm text-slate-600 mb-1 block">患者様へのひとこと</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {COMMENT_TEMPLATES.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setComment(t)}
                      className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100"
                    >
                      {t.slice(0, 14)}…
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
                  rows={2}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="患者様に見えるひとことコメント"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isEvalDay} onChange={e => setIsEvalDay(e.target.checked)} className="rounded" />
                <span className="text-sm text-slate-600">評価日（4回目・8回目・卒業時）</span>
              </label>

              <button
                onClick={saveRecord}
                className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition-colors"
              >
                {saved ? '✓ 保存しました！' : '記録を保存する'}
              </button>
            </div>

            {/* 推移グラフ */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 p-5">
                <h3 className="font-semibold text-slate-800 mb-4">痛みスコアの推移</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <ReferenceLine y={originPain} stroke="#94a3b8" strokeDasharray="4 2" label={{ value: '初回', fontSize: 10, fill: '#94a3b8' }} />
                    <Line type="monotone" dataKey="痛みスコア" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* セッション履歴 */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <h3 className="font-semibold text-slate-800 mb-3">来院履歴</h3>
              {sessions.length === 0
                ? <p className="text-slate-400 text-sm">記録なし</p>
                : (
                  <div className="space-y-2">
                    {[...sessions].reverse().map((s, i) => (
                      <div key={s.id} className={`flex gap-3 text-sm p-2 rounded-lg ${s.isEvaluationDay ? 'bg-blue-50' : ''}`}>
                        <span className="text-slate-400 w-14 shrink-0">{s.date.slice(5)}</span>
                        <span className="text-slate-700">痛み {s.painScore}</span>
                        {s.romNote && <span className="text-slate-500">{s.romNote}</span>}
                        {s.isEvaluationDay && <span className="text-blue-600 text-xs font-medium">評価日</span>}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </>
        )}

        {tab === 'exercises' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-3">
              <h2 className="font-bold text-slate-800">自宅メニュー追加</h2>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={newExTitle}
                onChange={e => setNewExTitle(e.target.value)}
                placeholder="エクササイズ名（例: 腰のストレッチ）"
              />
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={newExUrl}
                onChange={e => setNewExUrl(e.target.value)}
                placeholder="YouTube限定公開URL（省略可）"
              />
              <button onClick={addExercise} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">追加</button>
            </div>

            {exercises.map(ex => (
              <div key={ex.id} className="bg-white rounded-xl border border-slate-100 p-4">
                <div className="font-medium text-slate-800">{ex.title}</div>
                <div className="text-xs text-slate-500 mt-1">
                  今週の実施: {ex.weeklyDoneCount !== null ? `${ex.weeklyDoneCount}日` : '記録なし'}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'appointment' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-3">
              <h2 className="font-bold text-slate-800">予約を追加</h2>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={newApptDate}
                  onChange={e => setNewApptDate(e.target.value)}
                />
                <input
                  type="time"
                  className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={newApptTime}
                  onChange={e => setNewApptTime(e.target.value)}
                />
                <button onClick={addAppt} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">追加</button>
              </div>
            </div>

            {appts.sort((a, b) => a.datetime.localeCompare(b.datetime)).map(a => {
              const [date, time] = a.datetime.split('T');
              return (
                <div key={a.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
                  <div className="text-sm text-slate-700 font-mono">{date.slice(5)} {time?.slice(0, 5)}</div>
                  <div className="flex-1" />
                  <select
                    value={a.status}
                    onChange={e => { KaradaMapStore.updateAppointmentStatus(a.id, e.target.value as AppointmentStatus); setAppts(KaradaMapStore.getAppointments(patientId)); }}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                  >
                    {(['予定', '来院済', '変更済', '連絡ありキャンセル', '連絡なし'] as AppointmentStatus[]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ========================
// B-3: テンプレ文ライブラリ
// ========================
function TemplatesTab() {
  const patients = KaradaMapStore.getPatients();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const patientUrl = typeof window !== 'undefined' && selectedPatient
    ? `${window.location.origin}/karada/patient/${selectedPatient.urlToken}`
    : '';

  function getBuiltText(templateId: string) {
    return buildMessage(templateId, selectedPatient, patientUrl);
  }

  function copy(templateId: string) {
    navigator.clipboard.writeText(getBuiltText(templateId));
    setCopiedId(templateId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-4">
      {/* LINE連携の説明 */}
      <div className="bg-[#06C755]/10 border border-[#06C755]/30 rounded-xl p-4 flex gap-3 items-start">
        <div className="text-[#06C755] mt-0.5"><LineIcon /></div>
        <div className="text-sm text-slate-700">
          <span className="font-semibold">LINEで送る</span> ボタンを押すとLINEアプリが開き、メッセージが自動入力されます。
          送信先はLINE側で選んでください。患者様を選ぶと名前・日時・URLが自動で差し込まれます。
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <label className="text-sm text-slate-600 mb-2 block">差し込み対象の患者様を選択（省略可）</label>
        <select
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          value={selectedPatient?.id ?? ''}
          onChange={e => setSelectedPatient(patients.find(p => p.id === e.target.value) ?? null)}
        >
          <option value="">選択しない</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {selectedPatient && patientUrl && (
          <p className="text-xs text-slate-400 mt-1.5 break-all">患者ページ: {patientUrl}</p>
        )}
      </div>

      {MESSAGE_TEMPLATES.map(tmpl => {
        const preview = getBuiltText(tmpl.id) || tmpl.template;

        return (
          <div key={tmpl.id} className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="font-medium text-slate-800 text-sm">{tmpl.label}</span>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => copy(tmpl.id)}
                  className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  {copiedId === tmpl.id ? '✓ コピー' : 'コピー'}
                </button>
                <button
                  onClick={() => openLineWithMessage(getBuiltText(tmpl.id) || tmpl.template)}
                  className="text-xs bg-[#06C755] text-white px-3 py-1.5 rounded-lg hover:bg-[#05b34c] transition-colors flex items-center gap-1"
                >
                  <LineIcon />
                  LINEで送る
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">{preview}</p>
          </div>
        );
      })}
    </div>
  );
}

// ========================
// B-4: KPIビュー
// ========================
function KPITab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const kpi = KaradaMapStore.getMonthlyKPI(year, month);

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        この数字はスタッフや患者様を評価するためのものではなく、説明と仕組みを改善するための材料です。
      </div>

      <div className="flex gap-2 items-center">
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={year} onChange={e => setYear(Number(e.target.value))}>
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: '月間予約数', value: kpi.total, unit: '件' },
          { label: 'キャンセル率', value: kpi.cancelRate, unit: '%' },
          { label: '連絡なし率', value: kpi.noContactRate, unit: '%' },
          { label: '初回→4回継続率', value: kpi.rate4, unit: '%' },
          { label: '月間来院セッション', value: kpi.monthSessions, unit: '回' },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="text-slate-500 text-xs mb-1">{item.label}</div>
            <div className="text-3xl font-bold text-slate-800">{item.value}<span className="text-lg font-normal text-slate-500">{item.unit}</span></div>
          </div>
        ))}
      </div>

      {/* エクスポート/インポート */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
        <h3 className="font-semibold text-slate-800 text-sm">データ管理</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const json = KaradaMapStore.exportJSON();
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `karada-map-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
            }}
            className="text-sm bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200"
          >
            JSONエクスポート
          </button>
          <label className="text-sm bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 cursor-pointer">
            JSONインポート
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  try {
                    KaradaMapStore.importJSON(ev.target?.result as string);
                    window.location.reload();
                  } catch { alert('ファイルの読み込みに失敗しました。'); }
                };
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
