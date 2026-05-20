import Link from "next/link";
import { Activity, LayoutDashboard, Users, ClipboardList, ChevronLeft } from "lucide-react";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Activity className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-none">YUUKI REHAB</div>
              <div className="text-gray-400 text-xs mt-0.5">スタッフポータル</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/staff"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors text-sm"
          >
            <LayoutDashboard className="w-4 h-4" />
            ダッシュボード
          </Link>
          <Link
            href="/staff/patients"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors text-sm"
          >
            <Users className="w-4 h-4" />
            患者管理
          </Link>
          <Link
            href="/staff/menus"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors text-sm"
          >
            <ClipboardList className="w-4 h-4" />
            メニュー管理
          </Link>
        </nav>

        <div className="px-3 py-4 border-t border-gray-700">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-gray-200 text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            トップへ戻る
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
        {children}
      </div>
    </div>
  );
}
