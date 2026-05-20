import Link from "next/link";
import { Activity, ChevronLeft } from "lucide-react";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      {/* Mobile-first header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-gray-900 leading-none">YUUKI REHAB</div>
            <div className="text-xs text-gray-400">患者さん向けメニュー</div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            トップ
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
