'use client';

import { useEffect } from 'react';
import { initMetrics } from '@/lib/one-metrics';

/** 匿名計測の初期化（クラッシュ捕捉 + app_open）。UIは描画しない。 */
export default function OneMetrics() {
  useEffect(() => {
    initMetrics();
  }, []);

  return null;
}
