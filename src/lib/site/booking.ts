/**
 * ホームページからのネット予約リンク
 *
 * 計測リンク（/api/marketing/go）経由で予約ページへ移る。
 * 予約システムの「流入元」に website と置き場所（campaign）が残り、効果測定で数えられる。
 */
export function webBookingHref(place: string): string {
  return `/api/marketing/go?d=reserve&source=website&campaign=${encodeURIComponent(place)}`
}
