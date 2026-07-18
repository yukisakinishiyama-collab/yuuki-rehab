'use client';

import { useSyncExternalStore } from 'react';
import { Star } from 'lucide-react';
import {
  getConsultations,
  getServerConsultations,
  subscribe,
  toggleFavorite,
} from '@/lib/one-store';
import ConsultationCard from '@/components/one/ConsultationCard';

/** Project ONE — お気に入り。端末内データのみ、オフラインで動作。 */
export default function OneFavoritesPage() {
  const all = useSyncExternalStore(subscribe, getConsultations, getServerConsultations);
  const items = all.filter((c) => c.favorite);

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold text-blue-600">お気に入り</h1>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-blue-50/50 px-6 py-14 text-center">
          <Star size={40} className="text-blue-200" aria-hidden />
          <p className="text-lg font-medium text-slate-500">
            ☆をおすと ここに のこせます
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ConsultationCard
              key={item.id}
              item={item}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
