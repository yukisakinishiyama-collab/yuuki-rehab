/** 予約の流入元の表示名（予約システム側の値と対応）。画面とサーバーの両方から使う */
export const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  google_post: 'Google投稿',
  google_profile: 'Googleマップ（予約ボタン）',
  line: '公式LINE',
  website: 'ホームページ',
  flyer: 'チラシ・QR',
  direct: 'ネット予約（流入元不明）',
  staff: '院で登録（電話・窓口）',
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source
}

