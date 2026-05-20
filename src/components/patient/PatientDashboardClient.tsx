"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProgressRecord } from "@/types";
import { CheckCircle2, TrendingDown, TrendingUp, Minus } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LocalEntry {
  date: string;
  painLevel: number;
  fatigue: number;
  notes: string;
}

interface Props {
  patientId: string;
  assignedMenuId: string;
  historicalProgress: ProgressRecord[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(patientId: string) {
  return `yuuki-rehab-progress-${patientId}`;
}

function loadLocal(patientId: string): LocalEntry[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(patientId)) ?? "[]");
  } catch {
    return [];
  }
}

function mergeAndSort(
  historical: ProgressRecord[],
  local: LocalEntry[]
): Array<{ date: string; painLevel: number; fatigue: number; isLocal: boolean }> {
  const map = new Map<
    string,
    { date: string; painLevel: number; fatigue: number; isLocal: boolean }
  >();

  historical.forEach((r) =>
    map.set(r.date, {
      date: r.date,
      painLevel: r.painLevel,
      fatigue: r.fatigue,
      isLocal: false,
    })
  );
  // local entries overwrite historical if same date
  local.forEach((r) =>
    map.set(r.date, {
      date: r.date,
      painLevel: r.painLevel,
      fatigue: r.fatigue,
      isLocal: true,
    })
  );

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function painColor(v: number) {
  if (v <= 2) return "text-teal-600";
  if (v <= 4) return "text-green-600";
  if (v <= 6) return "text-yellow-500";
  if (v <= 8) return "text-orange-500";
  return "text-red-600";
}

function painBg(v: number) {
  if (v <= 2) return "bg-teal-500";
  if (v <= 4) return "bg-green-500";
  if (v <= 6) return "bg-yellow-400";
  if (v <= 8) return "bg-orange-400";
  return "bg-red-500";
}

function painLabel(v: number) {
  if (v === 0) return "痛みなし";
  if (v <= 2) return "わずかな痛み";
  if (v <= 4) return "軽度の痛み";
  if (v <= 6) return "中程度の痛み";
  if (v <= 8) return "強い痛み";
  return "耐えられない痛み";
}

function fatigueLabel(v: number) {
  if (v === 0) return "疲れなし";
  if (v <= 2) return "わずかな疲れ";
  if (v <= 4) return "軽度の疲れ";
  if (v <= 6) return "中程度の疲れ";
  if (v <= 8) return "かなり疲れた";
  return "極度の疲労";
}

// ─── Recovery Graph ───────────────────────────────────────────────────────────

const PAD = { left: 36, right: 14, top: 14, bottom: 36 };
const SVG_W = 480;
const SVG_H = 190;
const PLOT_W = SVG_W - PAD.left - PAD.right;
const PLOT_H = SVG_H - PAD.top - PAD.bottom;

function toX(i: number, total: number) {
  return PAD.left + (total <= 1 ? PLOT_W / 2 : (i / (total - 1)) * PLOT_W);
}
function toY(value: number) {
  return PAD.top + (1 - value / 10) * PLOT_H;
}

function buildPath(values: number[]) {
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i, values.length)},${toY(v)}`)
    .join(" ");
}

interface GraphProps {
  data: Array<{ date: string; painLevel: number; fatigue: number; isLocal: boolean }>;
}

function RecoveryGraph({ data }: GraphProps) {
  const displayed = data.slice(-14);
  const n = displayed.length;

  if (n === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        記録がありません
      </div>
    );
  }

  const painValues = displayed.map((d) => d.painLevel);
  const fatigueValues = displayed.map((d) => d.fatigue);
  const painPath = buildPath(painValues);
  const fatiguePath = buildPath(fatigueValues);

  const gridYs = [0, 2, 4, 6, 8, 10];

  // Show every Nth label to avoid crowding
  const labelStep = n <= 7 ? 1 : n <= 14 ? 2 : 3;

  const firstPain = painValues[0];
  const lastPain = painValues[painValues.length - 1];
  const trend = lastPain - firstPain;

  return (
    <div>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-0.5 bg-teal-500 inline-block rounded" />
          疼痛スコア
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-0.5 bg-orange-400 inline-block rounded" />
          疲労スコア
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs font-medium">
          {trend < -0.5 ? (
            <>
              <TrendingDown className="w-3.5 h-3.5 text-teal-600" />
              <span className="text-teal-600">改善傾向</span>
            </>
          ) : trend > 0.5 ? (
            <>
              <TrendingUp className="w-3.5 h-3.5 text-red-500" />
              <span className="text-red-500">増悪傾向</span>
            </>
          ) : (
            <>
              <Minus className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-400">安定</span>
            </>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        aria-label="回復グラフ"
        className="overflow-visible"
      >
        {/* Grid */}
        {gridYs.map((v) => {
          const y = toY(v);
          return (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={SVG_W - PAD.right}
                y1={y}
                y2={y}
                stroke={v === 0 ? "#d1d5db" : "#f3f4f6"}
                strokeWidth={v === 0 ? 1 : 1}
              />
              <text
                x={PAD.left - 5}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="#9ca3af"
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* X-axis date labels */}
        {displayed.map((d, i) => {
          if (i % labelStep !== 0 && i !== n - 1) return null;
          const x = toX(i, n);
          const label = d.date.slice(5); // MM-DD
          return (
            <text
              key={d.date}
              x={x}
              y={SVG_H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize={9}
              fill="#9ca3af"
            >
              {label}
            </text>
          );
        })}

        {/* Fatigue area (behind) */}
        <path
          d={`${fatiguePath} L${toX(n - 1, n)},${toY(0)} L${toX(0, n)},${toY(0)} Z`}
          fill="rgb(251 146 60 / 0.07)"
        />
        {/* Pain area (behind) */}
        <path
          d={`${painPath} L${toX(n - 1, n)},${toY(0)} L${toX(0, n)},${toY(0)} Z`}
          fill="rgb(20 184 166 / 0.08)"
        />

        {/* Fatigue line */}
        <path
          d={fatiguePath}
          fill="none"
          stroke="#fb923c"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeDasharray="4 2"
        />

        {/* Pain line */}
        <path
          d={painPath}
          fill="none"
          stroke="#14b8a6"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Pain dots */}
        {painValues.map((v, i) => {
          const x = toX(i, n);
          const y = toY(v);
          const isLocal = displayed[i].isLocal;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={4} fill="white" stroke="#14b8a6" strokeWidth={2} />
              {isLocal && (
                <circle cx={x} cy={y} r={2.5} fill="#14b8a6" />
              )}
              {/* Tooltip value on last point */}
              {i === n - 1 && (
                <text x={x + 6} y={y - 5} fontSize={9} fill="#14b8a6" fontWeight="600">
                  {v}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Score Slider ─────────────────────────────────────────────────────────────

interface SliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  valueLabel: (v: number) => string;
  colorClass: (v: number) => string;
  disabled?: boolean;
}

function ScoreSlider({ label, value, onChange, valueLabel, colorClass, disabled }: SliderProps) {
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="text-right">
          <span className={`text-3xl font-bold tabular-nums ${colorClass(value)}`}>
            {value}
          </span>
          <span className="text-gray-400 text-sm ml-0.5">/10</span>
          <div className={`text-xs mt-0.5 ${colorClass(value)}`}>{valueLabel(value)}</div>
        </div>
      </div>
      <div className="relative">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${painBg(value)}`}
            style={{ width: `${value * 10}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-2 disabled:cursor-not-allowed"
        />
      </div>
      <div className="flex justify-between mt-1">
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <span key={v} className="text-xs text-gray-300">{v}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PatientDashboardClient({
  patientId,
  assignedMenuId,
  historicalProgress,
}: Props) {
  const today = getTodayString();

  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);
  const [pain, setPain] = useState(0);
  const [fatigue, setFatigue] = useState(0);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const entries = loadLocal(patientId);
    setLocalEntries(entries);
    const todayEntry = entries.find((e) => e.date === today);
    if (todayEntry) {
      setPain(todayEntry.painLevel);
      setFatigue(todayEntry.fatigue);
      setNotes(todayEntry.notes);
      setSaved(true);
    }
    setMounted(true);
  }, [patientId, today]);

  const handleSave = useCallback(() => {
    const newEntry: LocalEntry = { date: today, painLevel: pain, fatigue, notes };
    const rest = localEntries.filter((e) => e.date !== today);
    const updated = [...rest, newEntry].sort((a, b) => a.date.localeCompare(b.date));
    localStorage.setItem(storageKey(patientId), JSON.stringify(updated));
    setLocalEntries(updated);
    setSaved(true);
    setEditing(false);
  }, [patientId, today, pain, fatigue, notes, localEntries]);

  const allData = mergeAndSort(historicalProgress, localEntries);

  const isLocked = saved && !editing;

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-52 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pain Score Input */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">今日の記録</CardTitle>
            {saved && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-teal-600 hover:underline"
              >
                修正する
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 font-normal mt-0.5">{today}</p>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          <ScoreSlider
            label="疼痛スコア"
            value={pain}
            onChange={setPain}
            valueLabel={painLabel}
            colorClass={painColor}
            disabled={isLocked}
          />
          <ScoreSlider
            label="疲労感"
            value={fatigue}
            onChange={setFatigue}
            valueLabel={fatigueLabel}
            colorClass={painColor}
            disabled={isLocked}
          />

          {!isLocked && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                メモ（任意）
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="今日の調子、気づいたことなど…"
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-gray-300"
              />
            </div>
          )}

          {notes && isLocked && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{notes}</p>
          )}

          {isLocked ? (
            <div className="flex items-center gap-2 text-teal-600 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              本日の記録が保存されました
            </div>
          ) : (
            <button
              onClick={handleSave}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              記録を保存する
            </button>
          )}
        </CardContent>
      </Card>

      {/* Recovery Graph */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">回復グラフ</CardTitle>
          <p className="text-xs text-gray-400 font-normal mt-0.5">
            直近{Math.min(allData.length, 14)}回分の疼痛・疲労スコア
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <RecoveryGraph data={allData} />
        </CardContent>
      </Card>
    </div>
  );
}
