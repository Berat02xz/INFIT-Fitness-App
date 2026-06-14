// ─── Weekly Muscle Activity ──────────────────────────────────────────────────
// Derives which muscle groups the user trained this week from their workout logs.
// Each workout log references a routine; we aggregate the muscle groups worked by
// that routine's exercises (and its declared target muscles).

import { Database } from "@nozbe/watermelondb";
import { WorkoutLog } from "@/models/WorkoutLog";
import { ROUTINES } from "@/constants/workoutRoutines";

export type MuscleKey =
  | "chest"
  | "shoulders"
  | "arms"
  | "abs"
  | "obliques"
  | "back"
  | "glutes"
  | "hamstrings"
  | "quads"
  | "calves";

export const MUSCLE_KEYS: MuscleKey[] = [
  "chest",
  "shoulders",
  "arms",
  "abs",
  "obliques",
  "back",
  "glutes",
  "hamstrings",
  "quads",
  "calves",
];

export const MUSCLE_LABELS: Record<MuscleKey, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  arms: "Arms",
  abs: "Abs",
  obliques: "Obliques",
  back: "Back",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
  quads: "Quads",
  calves: "Calves",
};

const ALL: MuscleKey[] = MUSCLE_KEYS;

// Maps a routine/exercise category label to the muscle groups it works.
function categoryToMuscles(raw: string): MuscleKey[] {
  switch (raw.trim().toLowerCase()) {
    case "chest":
      return ["chest"];
    case "shoulders":
    case "delts":
      return ["shoulders"];
    case "arms":
    case "biceps":
    case "triceps":
    case "forearms":
      return ["arms"];
    case "abs":
      return ["abs"];
    case "core":
      return ["abs", "obliques"];
    case "obliques":
      return ["obliques"];
    case "back":
    case "lats":
    case "traps":
      return ["back"];
    case "glutes":
      return ["glutes"];
    case "quads":
      return ["quads"];
    case "hamstrings":
      return ["hamstrings"];
    case "calves":
      return ["calves"];
    case "legs":
      return ["quads", "hamstrings", "glutes", "calves"];
    case "full body":
      return ALL;
    case "cardio":
    default:
      return [];
  }
}

export interface WeeklyMuscleActivity {
  counts: Record<MuscleKey, number>;
  workoutCount: number;
  mostTrained: MuscleKey | null;
  leastTrained: MuscleKey | null;
  weekDays: boolean[]; // Mon..Sun — true if a workout was logged that day
  todayIndex: number; // 0 = Mon … 6 = Sun
}

// Maps a JS getDay() (0=Sun) to a Monday-first index (0=Mon … 6=Sun).
function mondayIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

function startOfWeek(): number {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun … 6 = Sat
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - diff);
  return monday.getTime();
}

export function emptyActivity(): WeeklyMuscleActivity {
  const counts = {} as Record<MuscleKey, number>;
  ALL.forEach((m) => (counts[m] = 0));
  return {
    counts,
    workoutCount: 0,
    mostTrained: null,
    leastTrained: null,
    weekDays: [false, false, false, false, false, false, false],
    todayIndex: mondayIndex(new Date().getDay()),
  };
}

export async function computeWeeklyMuscleActivity(
  database: Database,
  userId: string
): Promise<WeeklyMuscleActivity> {
  const result = emptyActivity();

  const logs = await WorkoutLog.logsInRange(database, userId, startOfWeek(), Date.now());
  result.workoutCount = logs.length;

  for (const log of logs) {
    result.weekDays[mondayIndex(new Date(log.completedAt).getDay())] = true;

    const routine = ROUTINES.find((r) => r.id === log.routineId);
    if (!routine) continue;

    // Count each exercise's primary muscle group.
    for (const ex of routine.exercises) {
      categoryToMuscles(ex.category).forEach((m) => (result.counts[m] += 1));
    }

    // Fold in explicitly declared target muscles (skip the generic ones to
    // avoid lighting up every group on cardio / full-body labels).
    for (const t of routine.targetMuscles) {
      const lower = t.trim().toLowerCase();
      if (lower === "full body" || lower === "cardio") continue;
      categoryToMuscles(t).forEach((m) => (result.counts[m] += 1));
    }
  }

  // Most trained (highest count > 0).
  let mostKey: MuscleKey | null = null;
  let mostVal = 0;
  for (const m of ALL) {
    if (result.counts[m] > mostVal) {
      mostVal = result.counts[m];
      mostKey = m;
    }
  }
  result.mostTrained = mostKey;

  // Least trained — prefer a muscle that wasn't trained at all this week so it
  // reads as a "focus next" recommendation.
  let leastKey: MuscleKey | null = null;
  let leastVal = Infinity;
  for (const m of ALL) {
    if (result.counts[m] < leastVal) {
      leastVal = result.counts[m];
      leastKey = m;
    }
  }
  result.leastTrained = result.workoutCount > 0 ? leastKey : null;

  return result;
}
