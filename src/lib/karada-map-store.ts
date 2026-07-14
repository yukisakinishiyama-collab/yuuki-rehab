/**
 * カラダの地図 — データモデルとLocalStorageストア
 *
 * 設計方針:
 * - データアクセス層を分離（将来Supabase等へ移行しやすい構造）
 * - 本番運用時のセキュリティ要件: HTTPS必須・URLトークンは32文字以上の乱数・データ暗号化推奨
 * - URLトークンは推測困難な英数字ランダム文字列（患者ごとに一意）
 */

// ========================
// 型定義
// ========================

export type AgeGroup = '若年' | '成人' | '高齢';
export type Category = '外傷' | 'スポーツ' | '術後' | '慢性痛';
export type Phase = '炎症期' | '修復期' | 'リモデリング期' | '卒業';
export type AppointmentStatus = '予定' | '来院済' | '変更済' | '連絡ありキャンセル' | '連絡なし';

export interface Patient {
  id: string;
  name: string;
  ageGroup: AgeGroup;
  category: Category;
  goalText: string;
  plannedSessions: number;
  completedSessions: number;
  frequencyPlan: string;
  estimatedCostNote: string;
  phase: Phase;
  urlToken: string;
  createdAt: string;
}

export interface Session {
  id: string;
  patientId: string;
  date: string;
  painScore: number;
  romNote: string;
  staffComment: string;
  isEvaluationDay: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  datetime: string;
  status: AppointmentStatus;
}

export interface HomeExercise {
  id: string;
  patientId: string;
  title: string;
  videoUrl: string;
  weeklyDoneCount: number | null;
  lastUpdated: string;
}

export interface MilestoneEvaluation {
  id: string;
  patientId: string;
  sessionNumber: number;
  painScore: number;
  romValue: string;
  memo: string;
  date: string;
}

export interface StoreData {
  patients: Patient[];
  sessions: Session[];
  appointments: Appointment[];
  homeExercises: HomeExercise[];
  milestoneEvaluations: MilestoneEvaluation[];
}

// ========================
// モックデータ（患者3名）
// ========================

const MOCK_DATA: StoreData = {
  patients: [
    {
      id: 'p1',
      name: '田中 花子',
      ageGroup: '高齢',
      category: '慢性痛',
      goalText: '孫と一緒に公園を散歩できるようになりたい',
      plannedSessions: 12,
      completedSessions: 7,
      frequencyPlan: '最初の4週は週2回、その後週1回',
      estimatedCostNote: '1回3,000円程度、計36,000円の目安',
      phase: 'リモデリング期',
      urlToken: 'tanaka-hanako-abc123',
      createdAt: '2026-04-01',
    },
    {
      id: 'p2',
      name: '山田 健太',
      ageGroup: '若年',
      category: 'スポーツ',
      goalText: '9月の市民マラソン大会に出場する',
      plannedSessions: 10,
      completedSessions: 3,
      frequencyPlan: '週2回ペースで5週間、その後状態を評価',
      estimatedCostNote: '1回2,500円程度、計25,000円の目安',
      phase: '修復期',
      urlToken: 'yamada-kenta-def456',
      createdAt: '2026-05-15',
    },
    {
      id: 'p3',
      name: '佐藤 美咲',
      ageGroup: '成人',
      category: '術後',
      goalText: '職場に復帰して以前と同じように働けるようになる',
      plannedSessions: 16,
      completedSessions: 4,
      frequencyPlan: '最初の6週は週2回（術後プロトコル）、その後週1回',
      estimatedCostNote: '1回3,000円程度、計48,000円の目安',
      phase: '修復期',
      urlToken: 'sato-misaki-ghi789',
      createdAt: '2026-05-01',
    },
  ],
  sessions: [
    // 田中さんのセッション
    { id: 's1', patientId: 'p1', date: '2026-04-01', painScore: 8, romNote: '腰椎前屈40度', staffComment: '初回お疲れ様でした。少しずつ動かしていきましょう。', isEvaluationDay: false },
    { id: 's2', patientId: 'p1', date: '2026-04-04', painScore: 7, romNote: '腰椎前屈45度', staffComment: '少し楽になってきましたね。', isEvaluationDay: false },
    { id: 's3', patientId: 'p1', date: '2026-04-08', painScore: 6, romNote: '腰椎前屈50度', staffComment: '動きが滑らかになってきました。', isEvaluationDay: false },
    { id: 's4', patientId: 'p1', date: '2026-04-11', painScore: 5, romNote: '腰椎前屈55度', staffComment: '4回目の評価日です。着実に改善しています！', isEvaluationDay: true },
    { id: 's5', patientId: 'p1', date: '2026-04-22', painScore: 4, romNote: '腰椎前屈60度', staffComment: 'お散歩の距離も少し増やせそうですね。', isEvaluationDay: false },
    { id: 's6', patientId: 'p1', date: '2026-05-06', painScore: 3, romNote: '腰椎前屈65度', staffComment: '順調です。自宅エクササイズも継続できていますね。', isEvaluationDay: false },
    { id: 's7', patientId: 'p1', date: '2026-05-20', painScore: 2, romNote: '腰椎前屈70度', staffComment: '卒業が近づいてきました。とても良い状態です。', isEvaluationDay: false },
    // 山田さんのセッション
    { id: 's8', patientId: 'p2', date: '2026-05-15', painScore: 7, romNote: '膝関節屈曲100度', staffComment: '初回お疲れ様でした。', isEvaluationDay: false },
    { id: 's9', patientId: 'p2', date: '2026-05-19', painScore: 6, romNote: '膝関節屈曲110度', staffComment: '動かせる範囲が広がってきましたね。', isEvaluationDay: false },
    { id: 's10', patientId: 'p2', date: '2026-05-23', painScore: 5, romNote: '膝関節屈曲120度', staffComment: 'ランニング再開まで、もう少しです。', isEvaluationDay: false },
    // 佐藤さんのセッション
    { id: 's11', patientId: 'p3', date: '2026-05-01', painScore: 9, romNote: '肩関節外転60度', staffComment: '術後のスタートです。無理せずいきましょう。', isEvaluationDay: false },
    { id: 's12', patientId: 'p3', date: '2026-05-06', painScore: 8, romNote: '肩関節外転70度', staffComment: '少しずつ動きが出てきました。', isEvaluationDay: false },
    { id: 's13', patientId: 'p3', date: '2026-05-13', painScore: 7, romNote: '肩関節外転80度', staffComment: 'がんばっていますね。', isEvaluationDay: false },
    { id: 's14', patientId: 'p3', date: '2026-05-20', painScore: 6, romNote: '肩関節外転90度', staffComment: '4回目の評価。着実に回復しています。', isEvaluationDay: true },
  ],
  appointments: [
    { id: 'a1', patientId: 'p1', datetime: '2026-06-17T10:00', status: '予定' },
    { id: 'a2', patientId: 'p2', datetime: '2026-06-13T14:00', status: '予定' },
    { id: 'a3', patientId: 'p2', datetime: '2026-06-16T14:00', status: '予定' },
    { id: 'a4', patientId: 'p3', datetime: '2026-06-12T11:00', status: '来院済' },
    { id: 'a5', patientId: 'p3', datetime: '2026-06-19T11:00', status: '予定' },
    { id: 'a6', patientId: 'p1', datetime: '2026-06-12T09:00', status: '連絡なし' },
  ],
  homeExercises: [
    { id: 'e1', patientId: 'p1', title: '腰のストレッチ（猫のポーズ）', videoUrl: '', weeklyDoneCount: 4, lastUpdated: '2026-06-09' },
    { id: 'e2', patientId: 'p1', title: 'ウォーキング10分', videoUrl: '', weeklyDoneCount: 3, lastUpdated: '2026-06-09' },
    { id: 'e3', patientId: 'p2', title: '大腿四頭筋ストレッチ', videoUrl: '', weeklyDoneCount: 5, lastUpdated: '2026-06-10' },
    { id: 'e4', patientId: 'p2', title: 'バランストレーニング（片足立ち）', videoUrl: '', weeklyDoneCount: null, lastUpdated: '2026-06-05' },
    { id: 'e5', patientId: 'p3', title: '肩の振り子運動', videoUrl: '', weeklyDoneCount: 6, lastUpdated: '2026-06-10' },
  ],
  milestoneEvaluations: [
    { id: 'm1', patientId: 'p1', sessionNumber: 4, painScore: 5, romValue: '腰椎前屈55度', memo: '日常生活動作が楽になってきた。', date: '2026-04-11' },
    { id: 'm2', patientId: 'p3', sessionNumber: 4, painScore: 6, romValue: '肩関節外転90度', memo: '術後プロトコル順調。', date: '2026-05-20' },
  ],
};

// ========================
// ストア
// ========================

const STORAGE_KEY = 'karada-map-data';

function loadData(): StoreData {
  if (typeof window === 'undefined') return MOCK_DATA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_DATA));
      return MOCK_DATA;
    }
    return JSON.parse(raw) as StoreData;
  } catch {
    return MOCK_DATA;
  }
}

function saveData(data: StoreData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // 保存後にクラウドへ自動同期（設定済みの場合のみ）
  import('./sync-service').then(({ scheduleSync }) => scheduleSync());
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 推測困難なURLトークンを生成（本番: crypto.randomUUID()推奨） */
function generateToken(): string {
  return Array.from({ length: 3 }, () => Math.random().toString(36).slice(2, 9)).join('-');
}

// ========================
// 公開API
// ========================

export const KaradaMapStore = {
  // 全データ取得
  getAll(): StoreData {
    return loadData();
  },

  // 患者
  getPatients(): Patient[] {
    return loadData().patients;
  },
  getPatientByToken(token: string): Patient | null {
    return loadData().patients.find(p => p.urlToken === token) ?? null;
  },
  getPatientById(id: string): Patient | null {
    return loadData().patients.find(p => p.id === id) ?? null;
  },
  addPatient(patient: Omit<Patient, 'id' | 'urlToken' | 'createdAt'>): Patient {
    const data = loadData();
    const newPatient: Patient = {
      ...patient,
      id: generateId(),
      urlToken: generateToken(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    data.patients.push(newPatient);
    saveData(data);
    return newPatient;
  },
  updatePatient(id: string, updates: Partial<Patient>): void {
    const data = loadData();
    const idx = data.patients.findIndex(p => p.id === id);
    if (idx !== -1) {
      data.patients[idx] = { ...data.patients[idx], ...updates };
      saveData(data);
    }
  },

  // セッション
  getSessions(patientId: string): Session[] {
    return loadData().sessions.filter(s => s.patientId === patientId).sort((a, b) => a.date.localeCompare(b.date));
  },
  addSession(session: Omit<Session, 'id'>): Session {
    const data = loadData();
    const newSession: Session = { ...session, id: generateId() };
    data.sessions.push(newSession);
    // 実施回数を更新
    const patIdx = data.patients.findIndex(p => p.id === session.patientId);
    if (patIdx !== -1) {
      data.patients[patIdx].completedSessions = data.sessions.filter(s => s.patientId === session.patientId).length + 1;
    }
    saveData(data);
    return newSession;
  },

  // 予約
  getAppointments(patientId?: string): Appointment[] {
    const data = loadData();
    return patientId ? data.appointments.filter(a => a.patientId === patientId) : data.appointments;
  },
  getTodayAppointments(): Appointment[] {
    const today = new Date().toISOString().split('T')[0];
    return loadData().appointments.filter(a => a.datetime.startsWith(today));
  },
  addAppointment(appt: Omit<Appointment, 'id'>): Appointment {
    const data = loadData();
    const newAppt: Appointment = { ...appt, id: generateId() };
    data.appointments.push(newAppt);
    saveData(data);
    return newAppt;
  },
  updateAppointmentStatus(id: string, status: AppointmentStatus): void {
    const data = loadData();
    const idx = data.appointments.findIndex(a => a.id === id);
    if (idx !== -1) {
      data.appointments[idx].status = status;
      saveData(data);
    }
  },

  // 自宅メニュー
  getHomeExercises(patientId: string): HomeExercise[] {
    return loadData().homeExercises.filter(e => e.patientId === patientId);
  },
  addHomeExercise(ex: Omit<HomeExercise, 'id'>): HomeExercise {
    const data = loadData();
    const newEx: HomeExercise = { ...ex, id: generateId() };
    data.homeExercises.push(newEx);
    saveData(data);
    return newEx;
  },
  updateHomeExerciseDoneCount(id: string, count: number): void {
    const data = loadData();
    const idx = data.homeExercises.findIndex(e => e.id === id);
    if (idx !== -1) {
      data.homeExercises[idx].weeklyDoneCount = count;
      data.homeExercises[idx].lastUpdated = new Date().toISOString().split('T')[0];
      saveData(data);
    }
  },

  // 評価日記録
  getMilestones(patientId: string): MilestoneEvaluation[] {
    return loadData().milestoneEvaluations.filter(m => m.patientId === patientId);
  },
  addMilestone(m: Omit<MilestoneEvaluation, 'id'>): MilestoneEvaluation {
    const data = loadData();
    const newM: MilestoneEvaluation = { ...m, id: generateId() };
    data.milestoneEvaluations.push(newM);
    saveData(data);
    return newM;
  },

  // エクスポート / インポート
  exportJSON(): string {
    return JSON.stringify(loadData(), null, 2);
  },
  importJSON(json: string): void {
    const parsed = JSON.parse(json) as StoreData;
    saveData(parsed);
  },

  // KPI計算
  getMonthlyKPI(year: number, month: number) {
    const data = loadData();
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const monthAppts = data.appointments.filter(a => a.datetime.startsWith(prefix));
    const total = monthAppts.length;
    const cancelled = monthAppts.filter(a => a.status === '連絡ありキャンセル' || a.status === '連絡なし').length;
    const noContact = monthAppts.filter(a => a.status === '連絡なし').length;
    const cancelRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const noContactRate = total > 0 ? Math.round((noContact / total) * 100) : 0;

    // 初回→4回継続率（月内に4回目のセッションを持つ患者 / 月内に初回のある患者）
    const monthSessions = data.sessions.filter(s => s.date.startsWith(prefix));
    const patientsWithFirstSession = new Set(
      data.sessions.filter(s => {
        const all = data.sessions.filter(ss => ss.patientId === s.patientId).sort((a, b) => a.date.localeCompare(b.date));
        return all[0]?.id === s.id && s.date.startsWith(prefix);
      }).map(s => s.patientId)
    );
    const continuedTo4 = [...patientsWithFirstSession].filter(pid => {
      return data.sessions.filter(s => s.patientId === pid).length >= 4;
    }).length;
    const rate4 = patientsWithFirstSession.size > 0 ? Math.round((continuedTo4 / patientsWithFirstSession.size) * 100) : 0;

    return { total, cancelRate, noContactRate, rate4, monthSessions: monthSessions.length };
  },

  // フォロー候補を取得
  getFollowCandidates() {
    const data = loadData();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const results: { patient: Patient; reason: string }[] = [];

    for (const patient of data.patients) {
      if (patient.phase === '卒業') continue;
      const sessions = data.sessions.filter(s => s.patientId === patient.id).sort((a, b) => b.date.localeCompare(a.date));
      const lastDate = sessions[0]?.date;
      if (lastDate) {
        const diffDays = Math.floor((today.getTime() - new Date(lastDate).getTime()) / 86400000);
        if (diffDays >= 10) {
          results.push({ patient, reason: `最終来院から${diffDays}日が経過しています` });
          continue;
        }
      }
      // 本日「連絡なし」
      const todayNoContact = data.appointments.find(a => a.patientId === patient.id && a.datetime.startsWith(todayStr) && a.status === '連絡なし');
      if (todayNoContact) {
        results.push({ patient, reason: '本日、ご連絡なしでお越しになれませんでした' });
        continue;
      }
      // 次回が評価日（4の倍数）
      const nextCount = (patient.completedSessions + 1);
      const nextAppt = data.appointments.find(a => a.patientId === patient.id && a.status === '予定' && a.datetime >= todayStr);
      if (nextCount % 4 === 0 && nextAppt) {
        results.push({ patient, reason: `次回は第${nextCount}回（評価日）の予定です` });
      }
    }
    return results;
  },
};

// テンプレ文ライブラリ
export const MESSAGE_TEMPLATES = [
  {
    id: 'confirm',
    label: '予約確定時',
    template: 'ご予約ありがとうございます。{datetime}のお時間は{name}様のために確保しております。ご都合が変わった場合は前日までにこのLINEで一言いただければ、いつでも変更できます。',
  },
  {
    id: 'reminder',
    label: '前日リマインド',
    template: '{name}様、明日{time}にお待ちしております。動きやすい服装でお越しください。ご都合が変わった場合は、このまま返信いただければ大丈夫です。',
  },
  {
    id: 'no_contact',
    label: '当日夜フォロー',
    template: '{name}様、本日お会いできなかったので、お身体の具合が悪くなっていないか心配しております。急なご都合は誰にでもあることですので、どうぞお気になさらないでください。ご都合のよい日時をお知らせいただければすぐにご用意します。',
  },
  {
    id: 'followup_10days',
    label: '10日経過フォロー',
    template: '{name}様、その後お加減はいかがですか？前回の測定では初回からこれだけ改善していました（患者ページURL添付）。ちょうど今は再発しにくい身体を作る大事な段階です。頻度のご相談もできますので、お気軽にご連絡ください。',
  },
  {
    id: 'after_eval',
    label: '評価日後',
    template: '本日の測定結果を{name}様のページに更新しました。初回からの変化をぜひご家族ともご覧ください（URL）。ここまでの回復は{name}様の頑張りの成果です。',
  },
];

export const PHASE_INFO: Record<Phase, { label: string; description: string; color: string }> = {
  炎症期: {
    label: '炎症期',
    description: '身体が傷ついた場所を守ろうとしている時期です。痛みや腫れは回復の第一歩です。',
    color: 'bg-orange-100 border-orange-400 text-orange-800',
  },
  修復期: {
    label: '修復期',
    description: '組織が少しずつ作り直されている時期です。痛みが消えるのはこの段階の途中です。',
    color: 'bg-blue-100 border-blue-400 text-blue-800',
  },
  リモデリング期: {
    label: 'リモデリング期',
    description: '新しい組織を強くする仕上げの時期です。ゴールは「再発しない身体」をつくることです。',
    color: 'bg-green-100 border-green-400 text-green-800',
  },
  卒業: {
    label: '卒業',
    description: 'ゴールに到達しました！おめでとうございます。',
    color: 'bg-purple-100 border-purple-400 text-purple-800',
  },
};
