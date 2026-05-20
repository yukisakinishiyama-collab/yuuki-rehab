import { patients, rehabMenus } from "@/lib/data";
import { DISEASE_LABELS, PHASE_LABELS } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { User, ChevronRight } from "lucide-react";

export default function PatientsPage() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">患者管理</h1>
          <p className="text-gray-500 text-sm mt-1">登録患者の一覧と状況確認</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {patients.map((patient) => {
          const menu = rehabMenus.find((m) => m.id === patient.assignedMenuId);
          const latestProgress = patient.progress.at(-1);

          return (
            <Link key={patient.id} href={`/staff/patients/${patient.id}`}>
              <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer">
                <CardContent className="flex items-center gap-6 py-5">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-gray-900">{patient.name}</span>
                      <span className="text-sm text-gray-500">{patient.age}歳</span>
                      <Badge variant="secondary">{DISEASE_LABELS[patient.diseaseType]}</Badge>
                      <Badge
                        variant={
                          patient.currentPhase === "acute"
                            ? "danger"
                            : patient.currentPhase === "recovery"
                            ? "warning"
                            : "success"
                        }
                      >
                        {PHASE_LABELS[patient.currentPhase]}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      担当メニュー: {menu?.name ?? "未設定"} · 開始日: {patient.startDate}
                    </div>
                    {patient.notes && (
                      <div className="text-xs text-gray-400 mt-1 truncate">{patient.notes}</div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    {latestProgress ? (
                      <div className="text-sm">
                        <div className="text-gray-500 text-xs mb-1">最終記録: {latestProgress.date}</div>
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs text-gray-500">疼痛 {latestProgress.painLevel}/10</span>
                          <span className="text-xs text-gray-500">疲労 {latestProgress.fatigue}/10</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">記録なし</span>
                    )}
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
