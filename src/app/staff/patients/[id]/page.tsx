import { patients, rehabMenus } from "@/lib/data";
import { DISEASE_LABELS, PHASE_LABELS, CATEGORY_LABELS } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import { User, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = patients.find((p) => p.id === id);
  if (!patient) notFound();

  const menu = rehabMenus.find((m) => m.id === patient.assignedMenuId);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
              <Badge variant="secondary">{patient.age}歳</Badge>
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
            <p className="text-gray-500 text-sm mt-1">
              開始日: {patient.startDate} · ID: {patient.id}
            </p>
            {patient.notes && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-2 inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {patient.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Assigned Menu */}
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>担当リハビリメニュー</CardTitle>
            </CardHeader>
            <CardContent>
              {menu ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{menu.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          合計 {menu.totalDurationMinutes}分
                        </span>
                      </div>
                    </div>
                    <Badge variant={menu.isActive ? "success" : "secondary"}>
                      {menu.isActive ? "有効" : "無効"}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {menu.exercises.map((ex) => (
                      <div
                        key={ex.id}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="w-8 h-8 bg-white rounded-lg border border-gray-200 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-gray-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 text-sm">{ex.name}</span>
                            <Badge variant="secondary">{CATEGORY_LABELS[ex.category]}</Badge>
                            <span className="text-xs text-gray-400">{ex.durationMinutes}分</span>
                            {ex.sets && ex.reps && (
                              <span className="text-xs text-gray-400">
                                {ex.sets}セット×{ex.reps}回
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{ex.description}</p>
                          {ex.precautions && ex.precautions.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {ex.precautions.map((p, i) => (
                                <span
                                  key={i}
                                  className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded"
                                >
                                  ⚠ {p}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">メニューが設定されていません</p>
              )}
            </CardContent>
          </Card>

          {/* Progress History */}
          <Card>
            <CardHeader>
              <CardTitle>実施記録</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {patient.progress.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-gray-400">
                  まだ記録がありません
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {[...patient.progress]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((record, i) => (
                      <div key={i} className="px-6 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900 text-sm">{record.date}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">
                              {record.durationMinutes}分
                            </span>
                            <Badge
                              variant={
                                record.painLevel >= 7
                                  ? "danger"
                                  : record.painLevel >= 4
                                  ? "warning"
                                  : "success"
                              }
                            >
                              疼痛 {record.painLevel}/10
                            </Badge>
                            <Badge variant="secondary">疲労 {record.fatigue}/10</Badge>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          実施:{" "}
                          {record.completedExercises
                            .map((exId) => menu?.exercises.find((e) => e.id === exId)?.name)
                            .filter(Boolean)
                            .join("、")}
                        </div>
                        {record.notes && (
                          <p className="text-xs text-gray-400 mt-1">{record.notes}</p>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">患者情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "氏名", value: patient.name },
                { label: "年齢", value: `${patient.age}歳` },
                { label: "疾患", value: DISEASE_LABELS[patient.diseaseType] },
                { label: "フェーズ", value: PHASE_LABELS[patient.currentPhase] },
                { label: "開始日", value: patient.startDate },
                { label: "記録数", value: `${patient.progress.length}回` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
