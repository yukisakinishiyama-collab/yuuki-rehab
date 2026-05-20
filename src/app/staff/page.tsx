import { patients, rehabMenus } from "@/lib/data";
import { DISEASE_LABELS, PHASE_LABELS } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ClipboardList, Activity, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function StaffDashboard() {
  const activeMenus = rehabMenus.filter((m) => m.isActive);
  const recentProgress = patients
    .flatMap((p) =>
      p.progress.map((pr) => ({ ...pr, patientName: p.name, patientId: p.id }))
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const highPainPatients = patients.filter((p) => {
    const latest = p.progress.at(-1);
    return latest && latest.painLevel >= 4;
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-gray-500 text-sm mt-1">本日の状況サマリー</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "登録患者数",
            value: patients.length,
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "有効メニュー数",
            value: activeMenus.length,
            icon: ClipboardList,
            color: "text-teal-600",
            bg: "bg-teal-50",
          },
          {
            label: "本日の実施予定",
            value: patients.length,
            icon: Activity,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            label: "疼痛注意患者",
            value: highPainPatients.length,
            icon: AlertCircle,
            color: "text-red-600",
            bg: "bg-red-50",
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Patient List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>患者一覧</CardTitle>
            <Link href="/staff/patients" className="text-xs text-blue-600 hover:underline">
              すべて見る
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {patients.map((patient) => {
                const latestProgress = patient.progress.at(-1);
                return (
                  <Link
                    key={patient.id}
                    href={`/staff/patients/${patient.id}`}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{patient.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {patient.age}歳 · {DISEASE_LABELS[patient.diseaseType]}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                      {latestProgress && latestProgress.painLevel >= 4 && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Progress */}
        <Card>
          <CardHeader>
            <CardTitle>最近の実施記録</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentProgress.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">記録がありません</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentProgress.map((record, i) => (
                  <div key={i} className="px-6 py-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 text-sm">
                        {record.patientName}
                      </span>
                      <span className="text-xs text-gray-400">{record.date}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">
                        {record.durationMinutes}分実施
                      </span>
                      <span className="text-xs text-gray-500">
                        疼痛 {record.painLevel}/10
                      </span>
                      <span className="text-xs text-gray-500">
                        疲労度 {record.fatigue}/10
                      </span>
                    </div>
                    {record.notes && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{record.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
