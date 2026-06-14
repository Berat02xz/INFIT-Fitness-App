import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { theme } from "@/constants/theme";
import ContributionDots from "./ContributionDots";

// ─── Nutrition focal stat header ─────────────────────────────────────────────
// Three equal-width columns. Detail rows are absolutely positioned so revealing
// them never shifts the header or changes any column's width.

const C = {
  white: "#FFFFFF",
  over: "#FF453A",
  onTrack: theme.primary,
  idle: "rgba(255,255,255,0.28)",
  caption: "rgba(255,255,255,0.34)",
  unit: "rgba(255,255,255,0.45)",
  remainMuted: "rgba(255,255,255,0.55)",
  macroValue: "#FFFFFF",
  macroLetter: "#7A7A7E",
  protein: "#4E9FFF",
  carbs: "#FFB340",
  fats: "#34C759",
} as const;

// ─── Macro rings (concentric SVG arcs) ───────────────────────────────────────

const RING_SIZE = 78;
const CX = 39;
const CY = 39;
const STROKE = 5.5;
const R_OUTER = 32;
const R_MID = 23.5;
const R_INNER = 15;

function arcDash(r: number, progress: number): string {
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(progress, 1)) * c;
  return `${filled} ${c}`;
}

function Ring({ r, color, track, progress }: { r: number; color: string; track: string; progress: number }) {
  return (
    <>
      <Circle cx={CX} cy={CY} r={r} stroke={track} strokeWidth={STROKE} fill="none" />
      <Circle
        cx={CX} cy={CY} r={r} stroke={color} strokeWidth={STROKE} fill="none"
        strokeDasharray={arcDash(r, progress)} strokeLinecap="round"
      />
    </>
  );
}

function MacroRings({ protein, carbs, fats, target }: {
  protein: number; carbs: number; fats: number; target: number;
}) {
  const pProg = target > 0 ? (protein * 4) / target : 0;
  const cProg = target > 0 ? (carbs * 4) / target : 0;
  const fProg = target > 0 ? (fats * 9) / target : 0;
  return (
    <Svg width={RING_SIZE} height={RING_SIZE} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Ring r={R_OUTER} color={C.protein} track="rgba(78,159,255,0.16)" progress={pProg} />
      <Ring r={R_MID}   color={C.carbs}   track="rgba(255,179,64,0.16)" progress={cProg} />
      <Ring r={R_INNER} color={C.fats}    track="rgba(52,199,89,0.16)" progress={fProg} />
    </Svg>
  );
}

function MacroLegend({ color, letter, grams }: { color: string; letter: string; grams: number }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendValue} allowFontScaling={false}>
        {Math.round(grams)}
        <Text style={styles.legendLetter}>{letter}</Text>
      </Text>
    </View>
  );
}

function Caption({ children }: { children: string }) {
  return <Text style={styles.caption} allowFontScaling={false}>{children}</Text>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NutritionFocus(props: {
  consumed: number;
  target: number;
  isOver: boolean;
  onTrack: boolean;
  protein: number;
  carbs: number;
  fats: number;
  days: number[];
  todayIndex: number;
}): React.JSX.Element {
  const { consumed, target, isOver, onTrack, protein, carbs, fats, days, todayIndex } = props;

  const [revealed, setRevealed] = useState<"cal" | "macro" | "streak" | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);

  const reveal = (col: "cal" | "macro" | "streak") => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    setRevealed(col);
    revealTimer.current = setTimeout(() => setRevealed(null), 3000);
  };

  const remaining = Math.round(target - consumed);
  const statusColor = isOver ? C.over : onTrack ? C.onTrack : C.idle;
  const remainColor = isOver ? C.over : onTrack ? C.onTrack : C.remainMuted;
  const activeDays = days.filter((d) => d > 0).length;

  return (
    <View style={styles.container}>
      <View style={styles.row}>

        {/* ── CONSUMED ── */}
        <TouchableOpacity style={styles.colLeft} onPress={() => reveal("cal")} activeOpacity={0.7}>
          <Caption>CONSUMED</Caption>
          <View style={styles.numberRow}>
            <Text style={[styles.bigNumber, isOver && { color: C.over }]} allowFontScaling={false}>
              {Math.round(consumed).toLocaleString()}
            </Text>
            <Text style={styles.kcal} allowFontScaling={false}>KCAL</Text>
          </View>
          <Text style={styles.target} allowFontScaling={false}>
            / {Math.round(target).toLocaleString()}
          </Text>
          {revealed === "cal" && (
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.remaining, { color: remainColor }]} allowFontScaling={false}>
                {isOver
                  ? `${Math.abs(remaining).toLocaleString()} over`
                  : `${remaining.toLocaleString()} left`}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── MACROS ── */}
        <TouchableOpacity style={styles.colCenter} onPress={() => reveal("macro")} activeOpacity={0.7}>
          <Caption>MACROS</Caption>
          <MacroRings protein={protein} carbs={carbs} fats={fats} target={target} />
          {revealed === "macro" && (
            <View style={styles.legendRow}>
              <MacroLegend color={C.protein} letter="P" grams={protein} />
              <MacroLegend color={C.carbs}   letter="C" grams={carbs} />
              <MacroLegend color={C.fats}    letter="F" grams={fats} />
            </View>
          )}
        </TouchableOpacity>

        {/* ── STREAK ── */}
        <TouchableOpacity style={styles.colRight} onPress={() => reveal("streak")} activeOpacity={0.7}>
          <Caption>STREAK</Caption>
          <ContributionDots days={days} todayIndex={todayIndex} target={target} />
          {revealed === "streak" && (
            <Text style={styles.streakCount} allowFontScaling={false}>
              {activeDays} / 30 active
            </Text>
          )}
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  colLeft: {
    flex: 1,
    minWidth: 0,
    height: 126,
    alignItems: "center",
    paddingTop: 1,
  },
  colCenter: {
    flex: 1,
    minWidth: 0,
    height: 126,
    alignItems: "center",
    gap: 9,
  },
  colRight: {
    flex: 1,
    minWidth: 0,
    height: 126,
    alignItems: "center",
    gap: 9,
    paddingTop: 1,
  },

  caption: {
    fontFamily: theme.bold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: C.caption,
    textTransform: "uppercase",
  },

  // Calories
  numberRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  bigNumber: {
    fontFamily: theme.black,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.4,
    color: C.white,
  },
  kcal: {
    fontFamily: theme.bold,
    fontSize: 10,
    color: C.unit,
    opacity: 0.66,
    marginLeft: 5,
  },
  target: {
    fontFamily: theme.semibold,
    fontSize: 11,
    lineHeight: 13,
    color: C.unit,
    opacity: 0.72,
    marginTop: 1,
  },

  statusRow: {
    position: "absolute",
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  remaining: { fontFamily: theme.bold, fontSize: 12.5 },

  // Macro legend (below rings)
  legendRow: { position: "absolute", bottom: 0, flexDirection: "row", gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendValue: { fontFamily: theme.bold, fontSize: 11.5, color: C.macroValue },
  legendLetter: { fontFamily: theme.medium, fontSize: 10, color: C.macroLetter, marginLeft: 1 },

  // Streak count
  streakCount: {
    position: "absolute",
    bottom: 0,
    fontFamily: theme.medium,
    fontSize: 10,
    color: C.caption,
  },
});
