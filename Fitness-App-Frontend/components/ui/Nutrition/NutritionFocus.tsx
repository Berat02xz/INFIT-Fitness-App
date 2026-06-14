import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";
import ContributionDots from "./ContributionDots";

// ─── Nutrition focal stat header ─────────────────────────────────────────────
// Tight, minimal, top header:
//   • LEFT  — calories consumed (big neutral number), the target + remaining,
//             and a slim macro line.
//   • RIGHT — a small GitHub-style 30-day dot grid that animates in on open.
//   • The motivational line sits quietly beneath the whole row.
// Brand green is a single restrained accent (status dot + on-track remaining);
// over target shifts that accent to red.

const C = {
  white: "#FFFFFF",
  over: "#FF453A",
  onTrack: theme.primary,
  idle: "rgba(255,255,255,0.30)",
  unit: "rgba(255,255,255,0.40)",
  target: "#8E8E93",
  remainMuted: "rgba(255,255,255,0.55)",
  macroValue: "rgba(255,255,255,0.72)",
  macroLetter: "#6E6E73",
  protein: "#4E9FFF",
  carbs: "#FFB340",
  fats: "#34C759",
} as const;

function Macro({ color, letter, grams }: { color: string; letter: string; grams: number }) {
  return (
    <View style={styles.macroItem}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroValue} allowFontScaling={false}>
        {Math.round(grams)}
        <Text style={styles.macroLetter}>{letter}</Text>
      </Text>
    </View>
  );
}

export default function NutritionFocus(props: {
  consumed: number;
  target: number;
  isOver: boolean;
  onTrack: boolean;
  protein: number;
  carbs: number;
  fats: number;
  motivation: string;
  /** last-30-days daily calorie totals (oldest → newest) for the dot grid */
  days: number[];
}): React.JSX.Element {
  const { consumed, target, isOver, onTrack, protein, carbs, fats, motivation, days } = props;

  const remaining = Math.round(target - consumed);
  const statusColor = isOver ? C.over : onTrack ? C.onTrack : C.idle;
  const remainColor = isOver ? C.over : onTrack ? C.onTrack : C.remainMuted;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* LEFT — calories + macros */}
        <View style={styles.left}>
          <View style={styles.numberRow}>
            <Text style={[styles.bigNumber, isOver && { color: C.over }]} allowFontScaling={false}>
              {Math.round(consumed).toLocaleString()}
            </Text>
            <Text style={styles.unit} allowFontScaling={false}>
              kcal
            </Text>
          </View>
          <Text style={styles.target} allowFontScaling={false}>
            of {Math.round(target).toLocaleString()}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.remaining, { color: remainColor }]} allowFontScaling={false}>
              {isOver
                ? `${Math.abs(remaining).toLocaleString()} over today`
                : `${remaining.toLocaleString()} left today`}
            </Text>
          </View>
          <View style={styles.macroRow}>
            <Macro color={C.protein} letter="P" grams={protein} />
            <Macro color={C.carbs} letter="C" grams={carbs} />
            <Macro color={C.fats} letter="F" grams={fats} />
          </View>
        </View>

        {/* RIGHT — 30-day contribution dots */}
        <View style={styles.right}>
          <ContributionDots days={days} target={target} />
        </View>
      </View>

      <Text style={styles.motivation} numberOfLines={2}>
        {motivation}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  left: { flexShrink: 1 },

  numberRow: { flexDirection: "row", alignItems: "baseline" },
  bigNumber: {
    fontFamily: theme.black,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.4,
    color: C.white,
  },
  unit: { fontFamily: theme.semibold, fontSize: 15, color: C.unit, marginLeft: 6 },
  target: { fontFamily: theme.medium, fontSize: 13, color: C.target, marginTop: 2 },

  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 7 },
  remaining: { fontFamily: theme.semibold, fontSize: 13 },

  macroRow: { flexDirection: "row", gap: 14, marginTop: 12 },
  macroItem: { flexDirection: "row", alignItems: "center" },
  macroDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5, opacity: 0.9 },
  macroValue: { fontFamily: theme.semibold, fontSize: 12.5, color: C.macroValue },
  macroLetter: { fontFamily: theme.medium, fontSize: 11.5, color: C.macroLetter },

  right: { paddingTop: 4 },

  motivation: {
    fontFamily: theme.medium,
    fontSize: 13.5,
    lineHeight: 19,
    color: "rgba(255,255,255,0.55)",
    marginTop: 18,
  },
});
