'use client';

import { useEffect } from 'react';
import { RefreshCcw } from 'lucide-react';
import { flush, track } from '@/lib/one-metrics';

/**
 * /one 用エラーバウンダリ。
 * クラッシュ率0.5%目標の実測: 到達を crash として記録し、即送信する。
 * ユーザーには専門用語を出さず、ワンタップ復帰だけを提示。
 */
export default function OneError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    track('crash', {
      msg: String(error.message ?? 'render error').slice(0, 200),
      ...(error.digest ? { digest: error.digest } : {}),
    });
    flush();
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <p className="text-5xl" aria-hidden>
        😢
      </p>
      <p className="text-xl font-bold text-slate-700">
        ごめんなさい、
        <br />
        うまく ひらけませんでした
      </p>
      <button
        type="button"
        onClick={reset}
        className="flex min-h-[64px] w-full max-w-xs items-center justify-center gap-2 rounded-full bg-blue-600 text-xl font-bold text-white shadow-md transition-all active:scale-[0.98]"
      >
        <RefreshCcw size={22} aria-hidden />
        もういちど ひらく
      </button>
    </div>
  );
}
