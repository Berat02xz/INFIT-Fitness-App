import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { theme } from "@/constants/theme";
import {
  MUSCLE_KEYS,
  MUSCLE_LABELS,
  type MuscleKey,
  type WeeklyMuscleActivity,
} from "@/utils/MuscleActivity";

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  text: "#FFFFFF",
  sub: "#7A7A80",
  faint: "#5A5A60",
  on: "#AAFB05", // trained → green
  off: "#3E3E42", // muscle not trained this week
  struct: "#242427", // structural dots (head, joints) — body outline only
  hairline: "rgba(255,255,255,0.06)",
};

// ─── Pixel-body geometry ─────────────────────────────────────────────────────
// The figure is described in a normalized 100 × 196 space with smooth circles,
// ellipses and capsules, then sampled on a fine grid so the body reads as a
// dense dot-matrix rather than a blocky one.
const COLS = 17;
const ROWS = 34;
const NX = 100;
const NY = 196;

type Kind = MuscleKey | "struct" | null;

const hyp = (a: number, b: number) => Math.sqrt(a * a + b * b);
const inCircle = (x: number, y: number, cx: number, cy: number, r: number) => hyp(x - cx, y - cy) <= r;
const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
};
const inCapsule = (
  x: number, y: number,
  x1: number, y1: number, x2: number, y2: number, r: number
) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L2 = dx * dx + dy * dy;
  let t = L2 ? ((x - x1) * dx + (y - y1) * dy) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return hyp(x - px, y - py) <= r;
};

// Torso outline half-width as a function of y — gives shoulders, a tapered
// waist and a slight hip flare (shared by front and back).
const TORSO_CP: [number, number][] = [
  [34, 15], [42, 18.5], [58, 17], [80, 13], [94, 16], [100, 16.5],
];
function torsoHalf(y: number): number {
  if (y < TORSO_CP[0][0] || y > TORSO_CP[TORSO_CP.length - 1][0]) return -1;
  for (let i = 0; i < TORSO_CP.length - 1; i++) {
    const [y0, h0] = TORSO_CP[i];
    const [y1, h1] = TORSO_CP[i + 1];
    if (y >= y0 && y <= y1) {
      const t = (y - y0) / (y1 - y0);
      return h0 + (h1 - h0) * t;
    }
  }
  return -1;
}
const inTorso = (x: number, y: number) => {
  const h = torsoHalf(y);
  return h > 0 && Math.abs(x - 50) <= h;
};

// Shared limbs / structure between both views.
const arms = (x: number, y: number) =>
  inCapsule(x, y, 26, 46, 21, 82, 6) || inCapsule(x, y, 21, 82, 19, 108, 5) ||
  inCapsule(x, y, 74, 46, 79, 82, 6) || inCapsule(x, y, 79, 82, 81, 108, 5);
const delts = (x: number, y: number) => inCircle(x, y, 27, 42, 9) || inCircle(x, y, 73, 42, 9);
const calves = (x: number, y: number) =>
  inCapsule(x, y, 41, 157, 40, 189, 7) || inCapsule(x, y, 59, 157, 60, 189, 7);
const structure = (x: number, y: number) =>
  inCircle(x, y, 50, 18, 12) ||                          // head
  (x >= 45 && x <= 55 && y >= 27 && y <= 35) ||          // neck
  inCircle(x, y, 19, 111, 5) || inCircle(x, y, 81, 111, 5) || // hands
  inEllipse(x, y, 50, 102, 15, 6) ||                     // pelvis
  inCircle(x, y, 41, 151, 6) || inCircle(x, y, 59, 151, 6) || // knees
  inEllipse(x, y, 40, 192, 6, 4) || inEllipse(x, y, 60, 192, 6, 4); // feet

function classifyFront(x: number, y: number): Kind {
  if (arms(x, y)) return "arms";
  if (delts(x, y)) return "shoulders";
  if (inTorso(x, y)) {
    if (y < 38) return "shoulders";
    if (y < 60) return "chest";
    if (y <= 98) return Math.abs(x - 50) <= 8.5 ? "abs" : "obliques";
    return "struct";
  }
  if (inCapsule(x, y, 42, 108, 40, 150, 8) || inCapsule(x, y, 58, 108, 60, 150, 8)) return "quads";
  if (calves(x, y)) return "calves";
  if (structure(x, y)) return "struct";
  return null;
}

function classifyBack(x: number, y: number): Kind {
  if (arms(x, y)) return "arms";
  if (delts(x, y)) return "shoulders";
  if (inTorso(x, y)) return "back";
  if (inEllipse(x, y, 43, 106, 9, 8) || inEllipse(x, y, 57, 106, 9, 8)) return "glutes";
  if (inCapsule(x, y, 42, 116, 40, 150, 8) || inCapsule(x, y, 58, 116, 60, 150, 8)) return "hamstrings";
  if (calves(x, y)) return "calves";
  if (structure(x, y)) return "struct";
  return null;
}

interface Cell { c: number; r: number; kind: Exclude<Kind, null>; }

function buildGrid(classify: (x: number, y: number) => Kind): Cell[] {
  const cells: Cell[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = ((c + 0.5) / COLS) * NX;
      const y = ((r + 0.5) / ROWS) * NY;
      const kind = classify(x, y);
      if (kind) cells.push({ c, r, kind });
    }
  }
  return cells;
}

const FRONT_CELLS = buildGrid(classifyFront);
const BACK_CELLS = buildGrid(classifyBack);

// ─── Responsive sizing ───────────────────────────────────────────────────────
const SCREEN_W = Dimensions.get("window").width;
const CONTENT_W = Math.min(SCREEN_W - 40, 340);
const GAP = 18;
const FIG_W = (CONTENT_W - GAP) / 2;
const CELL = FIG_W / COLS;
const DOT = Math.max(3.5, CELL * 0.58);

function dotColor(kind: Exclude<Kind, null>, counts: Record<MuscleKey, number>): string {
  if (kind === "struct") return C.struct;
  return counts[kind] > 0 ? C.on : C.off;
}

function PixelBody({ cells, counts }: { cells: Cell[]; counts: Record<MuscleKey, number> }) {
  const dots = useMemo(
    () =>
      cells.map((cell, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: cell.c * CELL + (CELL - DOT) / 2,
            top: cell.r * CELL + (CELL - DOT) / 2,
            width: DOT,
            height: DOT,
            borderRadius: DOT / 2,
            backgroundColor: dotColor(cell.kind, counts),
          }}
        />
      )),
    [cells, counts]
  );
  return <View style={{ width: FIG_W, height: ROWS * CELL }}>{dots}</View>;
}

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

export default function MuscleHeatmap({ activity }: { activity: WeeklyMuscleActivity }) {
  const { counts, workoutCount, mostTrained, leastTrained, weekDays, todayIndex } = activity;
  const trainedCount = MUSCLE_KEYS.filter((k) => counts[k] > 0).length;

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>This Week</Text>
          <Text style={s.subtitle}>{trainedCount} of {MUSCLE_KEYS.length} muscle groups worked</Text>
        </View>
        <View style={s.workoutsPill}>
          <Text style={s.flame}>🔥</Text>
          <Text style={s.workoutsText}>{workoutCount} {workoutCount === 1 ? "workout" : "workouts"}</Text>
        </View>
      </View>

      {/* Week strip */}
      <View style={s.weekStrip}>
        {WEEK.map((d, i) => {
          const trained = weekDays[i];
          const today = i === todayIndex;
          return (
            <View key={i} style={[s.dayCol, today && s.dayColToday]}>
              <Text style={[s.dayLabel, today && s.dayLabelToday]}>{d}</Text>
              <View style={[s.dayDot, trained ? s.dayDotOn : s.dayDotOff]} />
            </View>
          );
        })}
      </View>

      {/* Bodies */}
      <View style={s.bodies}>
        <View style={s.bodyWrap}>
          <PixelBody cells={FRONT_CELLS} counts={counts} />
          <Text style={s.bodyLabel}>Front</Text>
        </View>
        <View style={s.bodyWrap}>
          <PixelBody cells={BACK_CELLS} counts={counts} />
          <Text style={s.bodyLabel}>Back</Text>
        </View>
      </View>

      {/* Caption */}
      <View style={s.caption}>
        <View style={s.capItem}>
          <Text style={s.capLabel}>Most trained</Text>
          <Text style={[s.capValue, { color: C.on }]} numberOfLines={1}>
            {mostTrained ? MUSCLE_LABELS[mostTrained] : "—"}
          </Text>
        </View>
        <View style={s.capDivider} />
        <View style={[s.capItem, { alignItems: "flex-end" }]}>
          <Text style={s.capLabel}>Focus next</Text>
          <Text style={s.capValue} numberOfLines={1}>
            {leastTrained ? MUSCLE_LABELS[leastTrained] : "—"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 8 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: { fontSize: 22, fontFamily: theme.black, color: C.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 12.5, fontFamily: theme.medium, color: C.sub, marginTop: 3 },
  workoutsPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20,
    paddingHorizontal: 11, paddingVertical: 6, marginTop: 2,
  },
  flame: { fontSize: 12 },
  workoutsText: { fontSize: 12.5, fontFamily: theme.bold, color: "rgba(255,255,255,0.8)" },

  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  dayCol: {
    flex: 1, alignItems: "center", gap: 7,
    paddingVertical: 7, marginHorizontal: 2, borderRadius: 12,
  },
  dayColToday: { backgroundColor: "rgba(170,251,5,0.07)" },
  dayLabel: { fontSize: 12, fontFamily: theme.bold, color: C.faint },
  dayLabelToday: { color: C.on },
  dayDot: { width: 6, height: 6, borderRadius: 3 },
  dayDotOn: { backgroundColor: C.on },
  dayDotOff: { backgroundColor: C.off },

  bodies: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: GAP,
    marginTop: 18,
  },
  bodyWrap: { alignItems: "center" },
  bodyLabel: {
    fontSize: 10.5, fontFamily: theme.bold, color: C.faint,
    marginTop: 10, letterSpacing: 1.5, textTransform: "uppercase",
  },

  caption: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
  },
  capItem: { flex: 1, gap: 4 },
  capLabel: { fontSize: 11, fontFamily: theme.medium, color: C.sub },
  capValue: { fontSize: 16, fontFamily: theme.bold, color: C.text },
  capDivider: { width: 1, height: 28, backgroundColor: C.hairline, marginHorizontal: 14 },
});
