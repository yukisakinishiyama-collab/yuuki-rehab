import { rehabMenus } from "@/lib/data";
import { DISEASE_LABELS, PHASE_LABELS, CATEGORY_LABELS, DiseaseType, RehabPhase } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronDown } from "lucide-react";

const DISEASE_COLORS: Record<DiseaseType, string> = {
  stroke: "bg-red-50 border-red-200",
  orthopedic: "bg-orange-50 border-orange-200",
  cardiac: "bg-pink-50 border-pink-200",
  respiratory: "bg-sky-50 border-sky-200",
  neurological: "bg-purple-50 border-purple-200",
};

const PHASE_ORDER: RehabPhase[] = ["acute", "recovery", "maintenance"];

export default function MenusPage() {
  const grouped = PHASE_ORDER.map((phase) => ({
    phase,
    menus: rehabMenus.filter((m) => m.phase === phase),
  }));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">リハビリメニュー管理</h1>
        <p className="text-gray-500 text-sm mt-1">フェーズ別・疾患別のメニュー一覧</p>
      </div>

      {/* Filters summary */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(DISEASE_LABELS).map(([key, label]) => (
          <Badge key={key} variant="secondary" className="cursor-pointer hover:bg-gray-200">
            {label}
          </Badge>
        ))}
      </div>

      <div className="space-y-8">
        {grouped.map(({ phase, menus }) => (
          <div key={phase}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-bold text-gray-800">{PHASE_LABELS[phase]}</h2>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-sm text-gray-400">{menus.length}件</span>
            </div>

            {menus.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                このフェーズのメニューはありません
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {menus.map((menu) => (
                  <Card
                    key={menu.id}
                    className={`border ${DISEASE_COLORS[menu.diseaseType]} hover:shadow-md transition-shadow`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug">{menu.name}</CardTitle>
                        <Badge variant={menu.isActive ? "success" : "secondary"} className="flex-shrink-0">
                          {menu.isActive ? "有効" : "無効"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="default">{DISEASE_LABELS[menu.diseaseType]}</Badge>
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                          <Clock className="w-3 h-3" />
                          {menu.totalDurationMinutes}分
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div className="text-xs text-gray-500 mb-3">
                        {menu.exercises.length}種目
                      </div>
                      <div className="space-y-2">
                        {menu.exercises.map((ex) => (
                          <div
                            key={ex.id}
                            className="flex items-center gap-2 text-sm bg-white/60 rounded-lg px-3 py-2"
                          >
                            <span className="flex-1 text-gray-800">{ex.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {CATEGORY_LABELS[ex.category]}
                            </Badge>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {ex.durationMinutes}分
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-gray-400 mt-3">
                        更新: {menu.updatedAt}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
