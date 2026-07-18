/**
 * Project ONE — 匿名利用計測（クラッシュ率0.5%以下・利用率の実測用）
 *
 * プライバシー方針:
 * - 相談本文・回答本文などの内容は一切送信しない（イベント種別と件数のみ）
 * - 端末IDはランダム生成の匿名ID。アカウント・個人情報とは紐づかない
 * - 送信は sendBeacon のバッチ1回。失敗しても端末内に残り、次回まとめて送る
 *   （通信量最小の方針に合わせ、リアルタイム送信はしない）
 */

export const ONE_APP_VERSION = '0.3.0';

export type MetricType =
  | 'app_open'            // 起動（セッション開始）
  | 'consult_success'     // AI回答成功
  | 'consult_offline'     // オフラインフォールバック発動
  | 'action_done'         // 今日の行動「できた！」
  | 'crash';              // 未捕捉エラー・エラーバウンダリ到達

interface MetricEvent {
  t: MetricType;
  at: string; // ISO 8601
  d?: Record<string, string | number>;
}

const QUEUE_KEY = 'project-one-metrics-v1';
const DEVICE_KEY = 'project-one-device-id';
const MAX_QUEUE = 200;

function loadQueue(): MetricEvent[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const q = raw ? (JSON.parse(raw) as MetricEvent[]) : [];
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: MetricEvent[]) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    // 保存できなくても本体機能には影響させない
  }
}

function deviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `d_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'd_unknown';
  }
}

/** イベントを端末内キューに記録する（送信は flush 時） */
export function track(t: MetricType, d?: Record<string, string | number>) {
  if (typeof window === 'undefined') return;
  const queue = loadQueue();
  queue.push({ t, at: new Date().toISOString(), ...(d ? { d } : {}) });
  saveQueue(queue);
}

/** キューをまとめて送信。成功したらキューを空にする */
export function flush() {
  if (typeof window === 'undefined') return;
  const queue = loadQueue();
  if (queue.length === 0) return;
  const payload = JSON.stringify({
    deviceId: deviceId(),
    appVersion: ONE_APP_VERSION,
    events: queue,
  });
  try {
    const ok = navigator.sendBeacon(
      '/api/one-metrics',
      new Blob([payload], { type: 'application/json' })
    );
    if (ok) saveQueue([]);
  } catch {
    // 圏外などで送れない場合は次回に持ち越す
  }
}

let initialized = false;

/** 起動時に1回だけ呼ぶ: クラッシュ捕捉 + app_open + バックグラウンド移行時の送信 */
export function initMetrics() {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;

  window.addEventListener('error', (e) => {
    track('crash', { msg: String(e.message ?? 'unknown').slice(0, 200) });
  });
  window.addEventListener('unhandledrejection', (e) => {
    track('crash', { msg: String(e.reason ?? 'unhandledrejection').slice(0, 200) });
  });
  // アプリを離れるタイミングでまとめて送信（sendBeacon はアンロード中も配送される）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  track('app_open');
  flush();
}
