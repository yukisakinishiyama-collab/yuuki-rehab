import { patients, rehabMenus } from "@/lib/data";
import { DISEASE_LABELS, PHASE_LABELS, CATEGORY_LABELS } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientDashboardClient } from "@/components/patient/PatientDashboardClient";
import { notFound } from "next/navigation";
import { Clock, AlertTriangle, Activity, Calendar } from "lucide-react";

export default async function PatientMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = patients.find((p) => p.id === id);
  if (!patient) notFound();

  const menu = rehabMenus.find((m) => m.id === patient.assignedMenuId);
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="bg-teal-600 rounded-2xl p-5 text-white">
        <div className="text-sm opacity-80 flex items-center gap-1.5 mb-3">
          <Calendar className="w-4 h-4" />
          {today}
        </div>
        <h1 className="text-xl font-bold mb-1">
          {patient.name} さん、<br />
          お疲れ様です
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <Badge className="bg-white/20 text-white border-0">
            {DISEASE_LABELS[patient.diseaseType]}
          </Badge>
          <Badge className="bg-white/20 text-white border-0">
            {PHASE_LABELS[patient.currentPhase]}
          </Badge>
        </div>
      </div>

      {/* Today's Menu */}
      {menu ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">本日のリハビリメニュー</CardTitle>
              <div className="flex items-center gap-1 text-teal-600 text-sm font-medium">
                <Clock className="w-4 h-4" />
                約{menu.totalDurationMinutes}分
              </div>
            </div>
            <p className="text-sm text-gray-500 font-normal mt-1">{menu.name}</p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {menu.exercises.map((ex, index) => (
              <div
                key={ex.id}
                className="border border-gray-100 rounded-xl p-4 bg-gray-50/50"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-teal-700">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{ex.name}</span>
                      <Badge variant="secondary">{CATEGORY_LABELS[ex.category]}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{ex.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {ex.durationMinutes}分
                      </span>
                      {ex.sets && ex.reps && (
                        <span>{ex.sets}セット × {ex.reps}回</span>
                      )}
                    </div>
                    {ex.precautions && ex.precautions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {ex.precautions.map((precaution, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            {precaution}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>メニューが設定されていません</p>
            <p className="text-sm mt-1">担当スタッフにご確認ください</p>
          </CardContent>
        </Card>
      )}

      {/* Pain score input + Recovery graph (client) */}
      <PatientDashboardClient
        patientId={patient.id}
        assignedMenuId={patient.assignedMenuId}
        historicalProgress={patient.progress}
      />

      {/* Safety notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">ご注意</p>
        <p className="text-blue-600 text-xs leading-relaxed">
          運動中に痛み・めまい・息切れを感じた場合はすぐに中止し、担当スタッフにお知らせください。
          無理せず、ご自身のペースで取り組みましょう。
        </p>
      </div>
    </div>
  );
}
