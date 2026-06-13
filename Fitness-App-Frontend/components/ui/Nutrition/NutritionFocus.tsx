import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";

// ─── Nutrition focal stat header ─────────────────────────────────────────────
// A calm, premium, LEFT-ALIGNED stat header for the gamified nutrition screen.
//
// Color logic (deliberately restrained — Apple-Fitness restraint):
//   • The big calorie number is NEUTRAL white. The label below it is muted grey.
//     Nothing is green "just because".
//   • The brand green is reserved as a single small accent — a tiny status dot
//     that lights up green only while the day is "on track". When over target
//     that same dot, and the number, shift to a restrained red.
//   • The macro row is understated: small colored dots + grey gram values.
//
// Layout-agnostic: no absolute positioning, left-aligned — the parent places
// this block in the top-left of the screen.

const C = {
  white: "#FFFFFF",
  over: "#FF453A",
  onTrack: theme.primary, // brand green — the ONE accent
  idle: "rgba(255,255,255,0.28)", // status dot when neither on-track nor over
  label: "#8E8E93",
  unit: "rgba(255,255,255,0.40)",
  macroValue: "rgba(255,255,255,0.92)",
  macroLetter: "#6E6E73",
  protein: "#4E9FFF",
  carbs: "#FFB340",
  fats: "#34C759",
} as const;

type MacroItemProps = {
  dotColor: string;
  letter: string;
  grams: number;
};

function MacroItem({ dotColor, letter, grams }: MacroItemProps): React.JSX.Element {
  return (
    <View style={styles.macroItem}>
      <View style={[styles.macroDot, { backgroundColor: dotColor }]} />
      <Text style={styles.macroValue} allowFontScaling={false}>
        {Math.round(grams)}
        <Text style={styles.macroLetter}>{letter}</Text>
      </Text>
    </View>
  );
}

export default function NutritionFocus(props: {
  caloriesValue: number;
  isOver: boolean;
  /** day is tracking well (parent derives from progress) — lights the green accent */
  onTrack: boolean;
  protein: number;
  carbs: number;
  fats: number;
  motivation: string;
}): React.JSX.Element {
  const { caloriesValue, isOver, onTrack, protein, carbs, fats, motivation } = props;

  const statusColor = isOver ? C.over : onTrack ? C.onTrack : C.idle;

  return (
    <View style={styles.container}>
      {/* big neutral number + quiet unit */}
      <View style={styles.numberRow}>
        <Text
          style={[styles.bigNumber, isOver && styles.bigNumberOver]}
          allowFontScaling={false}
        >
          {caloriesValue.toLocaleString()}
        </Text>
        <Text style={styles.unit} allowFontScaling={false}>
          kcal
        </Text>
      </View>

      {/* muted label with a single small status accent dot */}
      <View style={styles.labelRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.label} allowFontScaling={false}>
          {isOver ? "over target" : "left today"}
        </Text>
      </View>

      {/* understated macro row */}
      <View style={styles.macroRow}>
        <MacroItem dotColor={C.protein} letter="P" grams={protein} />
        <MacroItem dotColor={C.carbs} letter="C" grams={carbs} />
        <MacroItem dotColor={C.fats} letter="F" grams={fats} />
      </View>

      <Text style={styles.motivation} numberOfLines={2}>
        {motivation}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
  },
  numberRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  bigNumber: {
    fontFamily: theme.black,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
    color: C.white,
  },
  bigNumberOver: {
    color: C.over,
  },
  unit: {
    fontFamily: theme.semibold,
    fontSize: 15,
    color: C.unit,
    marginLeft: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 7,
  },
  label: {
    fontFamily: theme.medium,
    fontSize: 12.5,
    letterSpacing: 0.3,
    color: C.label,
  },
  macroRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
  },
  macroItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  macroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
    opacity: 0.9,
  },
  macroValue: {
    fontFamily: theme.semibold,
    fontSize: 13,
    color: C.macroValue,
  },
  macroLetter: {
    fontFamily: theme.medium,
    fontSize: 12,
    color: C.macroLetter,
  },
  motivation: {
    fontFamily: theme.medium,
    fontSize: 13.5,
    lineHeight: 19,
    color: "rgba(255,255,255,0.62)",
    textAlign: "left",
    marginTop: 16,
    maxWidth: 240,
  },
});
