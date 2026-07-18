'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { Send, Sun, Star, CheckCircle2, Flame } from 'lucide-react';
import {
  addConsultation,
  calcStreak,
  getDoneDates,
  getOfflineAnswer,
  getServerDoneDates,
  getTodayAction,
  markTodayDone,
  subscribe,
  toggleFavorite,
  toLocalDateKey,
  type Consultation,
} from '@/lib/one-store';
import { track } from '@/lib/one-metrics';

// 今日の行動は端末内で決まる。サーバー側は空文字にしてハイドレーション差異を回避
const noopSubscribe = () => () => {};
const getTodayActionSnapshot = () => getTodayAction();
const getTodayActionServer = () => '';

/**
 * Project ONE — ホーム（そうだん）
 *
 * 指示書の UI 原則:
 * - ボタン5個以内（この画面: 相談する / お気に入り☆ / 下部ナビ3つ）
 * - 3タップ以内で完結（入力 → 相談する → 回答）
 * - 大フォント・広い余白・説明文最小限
 */
export default function OneHomePage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Consultation | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  // 今日の行動（オフラインでも表示できる）
  const todayAction = useSyncExternalStore(
    noopSubscribe,
    getTodayActionSnapshot,
    getTodayActionServer
  );

  // できた！記録と連続日数（端末内で完結）
  const doneDates = useSyncExternalStore(subscribe, getDoneDates, getServerDoneDates);
  const doneToday = doneDates.includes(toLocalDateKey());
  const streak = calcStreak(doneDates);

  async function handleSubmit() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setResult(null);

    let answer = '';
    let action = '';
    let offline = false;

    try {
      const res = await fetch('/api/one-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok || !data.answer) throw new Error(data.error ?? 'no answer');
      answer = data.answer;
      action = data.action ?? '';
    } catch {
      // 圏外・サーバー障害でもアプリは止めない（オフライン回答ライブラリ）
      const fb = getOfflineAnswer(q);
      answer = fb.answer;
      action = fb.action;
      offline = true;
    }
    track(offline ? 'consult_offline' : 'consult_success');

    const saved = addConsultation({ question: q, answer, action, offline });
    setResult(saved);
    setQuestion('');
    setLoading(false);
    requestAnimationFrame(() =>
      answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  }

  function handleFavorite() {
    if (!result) return;
    toggleFavorite(result.id);
    setResult({ ...result, favorite: !result.favorite });
  }

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="text-3xl font-bold tracking-wide text-blue-600">ONE</h1>
        <p className="mt-1 text-base text-slate-500">こまったら、ひとことどうぞ</p>
      </header>

      {/* 今日の行動 */}
      <section
        aria-label="今日の行動"
        className="rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-md"
      >
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-bold tracking-wide">
            <Sun size={20} aria-hidden />
            きょうの行動
          </p>
          {streak > 0 && (
            <p className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
              <Flame size={16} aria-hidden />
              れんぞく{streak}日
            </p>
          )}
        </div>
        <p className="mt-2 text-xl font-bold leading-relaxed">{todayAction}</p>
        {doneToday ? (
          <p className="mt-4 flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-white/20 text-lg font-bold">
            <CheckCircle2 size={22} aria-hidden />
            きょうは できた！
          </p>
        ) : (
          <button
            type="button"
            onClick={() => {
              markTodayDone();
              track('action_done');
            }}
            className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-white text-lg font-bold text-blue-600 shadow-sm transition-all active:scale-[0.98]"
          >
            <CheckCircle2 size={22} aria-hidden />
            できた！
          </button>
        )}
      </section>

      {/* 悩み相談 */}
      <section aria-label="悩み相談" className="space-y-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="例）さいきん よく眠れない"
          className="w-full resize-none rounded-3xl border-2 border-blue-100 bg-blue-50/50 p-5 text-lg leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !question.trim()}
          className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-full bg-blue-600 text-xl font-bold text-white shadow-md transition-all active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          {loading ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
              かんがえ中…
            </>
          ) : (
            <>
              <Send size={22} aria-hidden />
              そうだんする
            </>
          )}
        </button>
      </section>

      {/* AI回答 */}
      {result && (
        <section
          ref={answerRef}
          aria-label="AIの回答"
          className="rounded-3xl border-2 border-blue-100 bg-white p-6 shadow-sm"
        >
          <p className="text-sm font-bold text-blue-500">こたえ</p>
          <p className="mt-2 text-lg leading-relaxed text-slate-800">{result.answer}</p>
          {result.action && (
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-base font-bold text-blue-800">
              <Sun size={20} className="mt-0.5 shrink-0" aria-hidden />
              <span>{result.action}</span>
            </p>
          )}
          {result.offline && (
            <p className="mt-3 text-sm text-slate-400">
              いまはネットにつながっていないため、かんたんな回答です
            </p>
          )}
          <button
            type="button"
            onClick={handleFavorite}
            aria-pressed={result.favorite}
            className={`mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full border-2 text-lg font-bold transition-colors ${
              result.favorite
                ? 'border-amber-300 bg-amber-50 text-amber-600'
                : 'border-blue-200 bg-white text-blue-600'
            }`}
          >
            <Star size={22} fill={result.favorite ? 'currentColor' : 'none'} aria-hidden />
            {result.favorite ? 'お気に入りずみ' : 'お気に入りにいれる'}
          </button>
        </section>
      )}
    </div>
  );
}
