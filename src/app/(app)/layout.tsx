import AppShell from '@/components/rehab/AppShell'

/**
 * 院内アプリ全体の枠。
 * data-clinic-app は「ここから下が院内アプリ」という印。globals.css の院内アプリだけの決まり
 * （スマホで入力欄を 16px にする など）は、この印の中だけに効く（ホームページ・LINE予約には効かない）。
 * display: contents なので、並び方・大きさには影響しない。
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-clinic-app className="contents">
      <AppShell>{children}</AppShell>
    </div>
  )
}
