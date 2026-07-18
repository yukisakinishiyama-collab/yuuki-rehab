'use client';

import { useSyncExternalStore } from 'react';
import { History } from 'lucide-react';
import {
  getConsultations,
  getServerConsultations,
  removeConsultation,
  subscribe,
  toggleFavorite,
} from '@/lib/one-store';
import ConsultationCard from '@/components/one/ConsultationCard';

/** Project ONE — 履歴。端末内データのみ、オフラインで動作。 */
export default function OneHistoryPage() {
  const items = useSyncExternalStore(subscribe, getConsultations, getServerConsultations);

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold text-blue-600">りれき</h1>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-blue-50/50 px-6 py-14 text-center">
          <History size={40} className="text-blue-200" aria-hidden />
          <p className="text-lg font-medium text-slate-500">
            まだ そうだんが ありません
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ConsultationCard
              key={item.id}
              item={item}
              onToggleFavorite={toggleFavorite}
              onRemove={removeConsultation}
            />
          ))}
        </div>
      )}
    </div>
  );
}
