'use client';

import { Star, Trash2, Sun, WifiOff } from 'lucide-react';
import type { Consultation } from '@/lib/one-store';

/**
 * 相談1件のカード表示（履歴・お気に入り共用）
 * 長文禁止の方針に合わせ、質問・回答とも短く収まるレイアウト。
 */
export default function ConsultationCard({
  item,
  onToggleFavorite,
  onRemove,
}: {
  item: Consultation;
  onToggleFavorite: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const date = new Date(item.createdAt);
  const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;

  return (
    <article className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-bold leading-relaxed text-blue-700">
          {item.question}
        </p>
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          {dateLabel}
        </span>
      </div>

      <p className="mt-3 text-base leading-relaxed text-slate-700">{item.answer}</p>

      {item.action && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-base font-medium text-blue-800">
          <Sun size={20} className="mt-0.5 shrink-0" aria-hidden />
          <span>{item.action}</span>
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        {item.offline ? (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <WifiOff size={14} aria-hidden />
            オフライン回答
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label="この相談を削除"
              className="flex h-12 w-12 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-50 hover:text-slate-500"
            >
              <Trash2 size={22} aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleFavorite(item.id)}
            aria-label={item.favorite ? 'お気に入りから外す' : 'お気に入りに追加'}
            aria-pressed={item.favorite}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              item.favorite
                ? 'text-amber-400 hover:bg-amber-50'
                : 'text-slate-300 hover:bg-slate-50 hover:text-amber-300'
            }`}
          >
            <Star size={24} fill={item.favorite ? 'currentColor' : 'none'} aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}
