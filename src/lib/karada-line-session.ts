/**
 * LINE予約ボット — サーバー側セッション管理と予約ストア
 *
 * MVP: モジュールレベルのMapでメモリ保持（サーバー再起動でリセット）
 * 本番移行時: Redis / Supabase に置き換えること
 */

export type ConversationStep =
  | 'idle'
  | 'wait_name'
  | 'wait_datetime'
  | 'wait_confirm';

export interface ConversationState {
  step: ConversationStep;
  patientName?: string;
  requestedDatetime?: string; // "2026-06-15T10:00"
  lineUserId: string;
  lineDisplayName?: string;
  updatedAt: number;
}

export interface LineAppointment {
  id: string;
  patientName: string;
  lineUserId: string;
  lineDisplayName?: string;
  datetime: string; // ISO "2026-06-15T10:00"
  status: 'pending' | 'confirmed' | 'cancelled';
  linkedPatientId?: string; // スタッフが紐付けした後に設定
  createdAt: number;
}

// ========================
// セッションストア（メモリ）
// ========================
const sessions = new Map<string, ConversationState>();

export function getSession(userId: string): ConversationState {
  return sessions.get(userId) ?? { step: 'idle', lineUserId: userId, updatedAt: Date.now() };
}

export function setSession(userId: string, state: Partial<ConversationState>) {
  const current = getSession(userId);
  sessions.set(userId, { ...current, ...state, updatedAt: Date.now() });
}

export function clearSession(userId: string) {
  sessions.set(userId, { step: 'idle', lineUserId: userId, updatedAt: Date.now() });
}

// ========================
// LINE予約ストア（メモリ）
// ========================
const lineAppointments: LineAppointment[] = [];

export function addLineAppointment(appt: Omit<LineAppointment, 'id' | 'createdAt'>): LineAppointment {
  const newAppt: LineAppointment = {
    ...appt,
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  lineAppointments.push(newAppt);
  return newAppt;
}

export function getLineAppointments(): LineAppointment[] {
  return [...lineAppointments].sort((a, b) => b.createdAt - a.createdAt);
}

export function updateLineAppointmentStatus(id: string, status: LineAppointment['status'], linkedPatientId?: string) {
  const appt = lineAppointments.find(a => a.id === id);
  if (appt) {
    appt.status = status;
    if (linkedPatientId) appt.linkedPatientId = linkedPatientId;
  }
}

// ========================
// 日時パーサー
// ========================
// 「6月15日 10時」「6/15 10:00」などを解析してISO文字列に変換
export function parseDatetime(text: string): string | null {
  const year = new Date().getFullYear();

  // パターン1: 「6月15日 10時30分」「6月15日 10時」
  const m1 = text.match(/(\d{1,2})月(\d{1,2})日[\s　]+(\d{1,2})時(?:(\d{2})分)?/);
  if (m1) {
    const month = m1[1].padStart(2, '0');
    const day = m1[2].padStart(2, '0');
    const hour = m1[3].padStart(2, '0');
    const min = (m1[4] ?? '00').padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${min}`;
  }

  // パターン2: 「6/15 10:00」「6-15 10:00」
  const m2 = text.match(/(\d{1,2})[\/\-](\d{1,2})[\s　]+(\d{1,2}):(\d{2})/);
  if (m2) {
    const month = m2[1].padStart(2, '0');
    const day = m2[2].padStart(2, '0');
    const hour = m2[3].padStart(2, '0');
    const min = m2[4].padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${min}`;
  }

  // パターン3: 「6/15 10時」
  const m3 = text.match(/(\d{1,2})[\/\-](\d{1,2})[\s　]+(\d{1,2})時/);
  if (m3) {
    const month = m3[1].padStart(2, '0');
    const day = m3[2].padStart(2, '0');
    const hour = m3[3].padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:00`;
  }

  return null;
}

// ISOを日本語表示に変換
export function formatDatetimeJa(iso: string): string {
  const d = new Date(iso);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
