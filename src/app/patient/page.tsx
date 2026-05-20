import { patients } from "@/lib/data";
import { DISEASE_LABELS, PHASE_LABELS } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { User, ChevronRight } from "lucide-react";

export default function PatientSelectPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">患者を選択</h1>
        <p className="text-sm text-gray-500 mt-1">あなたの名前を選んでください</p>
      </div>

      <div className="space-y-3">
        {patients.map((patient) => (
          <Link key={patient.id} href={`/patient/${patient.id}`}>
            <Card className="hover:shadow-md hover:border-teal-200 transition-all cursor-pointer">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-teal-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{patient.name}</div>
                  <div className="flex items-center gap-2 mt-1">
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
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
