export type DiseaseType =
  | "stroke"
  | "orthopedic"
  | "cardiac"
  | "respiratory"
  | "neurological";

export type RehabPhase = "acute" | "recovery" | "maintenance";

export type ExerciseCategory =
  | "stretching"
  | "strength"
  | "balance"
  | "cardio"
  | "daily_activity";

export interface Exercise {
  id: string;
  name: string;
  description: string;
  category: ExerciseCategory;
  durationMinutes: number;
  sets?: number;
  reps?: number;
  videoUrl?: string;
  precautions?: string[];
}

export interface RehabMenu {
  id: string;
  name: string;
  diseaseType: DiseaseType;
  phase: RehabPhase;
  exercises: Exercise[];
  totalDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  diseaseType: DiseaseType;
  currentPhase: RehabPhase;
  assignedMenuId: string;
  startDate: string;
  notes?: string;
  progress: ProgressRecord[];
}

export interface ProgressRecord {
  date: string;
  menuId: string;
  completedExercises: string[];
  durationMinutes: number;
  painLevel: number;
  fatigue: number;
  notes?: string;
}

export interface Staff {
  id: string;
  name: string;
  role: "physiotherapist" | "occupational_therapist" | "nurse";
}

export const DISEASE_LABELS: Record<DiseaseType, string> = {
  stroke: "脳卒中",
  orthopedic: "整形外科",
  cardiac: "心臓疾患",
  respiratory: "呼吸器疾患",
  neurological: "神経疾患",
};

export const PHASE_LABELS: Record<RehabPhase, string> = {
  acute: "急性期",
  recovery: "回復期",
  maintenance: "維持期",
};

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  stretching: "ストレッチ",
  strength: "筋力強化",
  balance: "バランス",
  cardio: "有酸素運動",
  daily_activity: "日常生活動作",
};
