import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

// ─── Month contribution dots ─────────────────────────────────────────────────
// A small GitHub-style dot grid of the current calendar month — one dot per day.
// Each day is coloured by how that day's calories compared to the target:
//   • grey        — no meals (or a future day this month)
//   • light green — under 80% of target
//   • green       — healthy, 80–100% of target
//   • red         — over target
// Today's dot gets a bright ring so you can see where in the month you are.
// On mount (and whenever the data reloads) the dots animate in one by one and
// all settle at the SAME final size/opacity.

const COLS = 7;
const DOT = 9;
const GAP = 4;
const GRID_W = COLS * DOT + (COLS - 1) * GAP;

// Per-dot fade duration as a fraction of the whole sweep. Thresholds are spread
// across [0, 1 - WINDOW] so even the last dot finishes exactly at progress = 1.
const WINDOW = 0.22;

const C = {
  grey: "rgba(255,255,255,0.12)",
  lightGreen: "#9BE15D",
  green: "#34C759",
  red: "#FF453A",
  today: "#FFFFFF",
} as const;

function colorFor(calories: number, target: number): string {
  if (target <= 0 || calories <= 0) return C.grey;
  const ratio = calories / target;
  if (ratio > 1.0) return C.red;
  if (ratio >= 0.8) return C.green;
  return C.lightGreen;
}

function Dot({
  color,
  isToday,
  index,
  total,
  progress,
}: {
  color: string;
  isToday: boolean;
  index: number;
  total: number;
  progress: SharedValue<number>;
}): React.JSX.Element {
  const style = useAnimatedStyle(() => {
    const denom = Math.max(total - 1, 1);
    const threshold = (index / denom) * (1 - WINDOW);
    const local = interpolate(
      progress.value,
      [threshold, threshold + WINDOW],
      [0, 1],
      Extrapolation.CLAMP
    );
    // Every dot settles at opacity 1 / scale 1 — only the timing is staggered.
    return { opacity: local, transform: [{ scale: 0.4 + 0.6 * local }] };
  });

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color }, isToday && styles.today, style]}
    />
  );
}

export default function ContributionDots({
  days,
  todayIndex,
  target,
}: {
  /** calories per day of the current month (index 0 = 1st) */
  days: number[];
  /** today's day-of-month minus one */
  todayIndex: number;
  target: number;
}): React.JSX.Element | null {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (days.length === 0) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [days, progress]);

  if (days.length === 0) return null;

  return (
    <View style={styles.grid} pointerEvents="none">
      {days.map((cal, i) => (
        <Dot
          key={i}
          color={colorFor(cal, target)}
          isToday={i === todayIndex}
          index={i}
          total={days.length}
          progress={progress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: GRID_W,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: 2.5,
  },
  today: {
    borderWidth: 1.5,
    borderColor: C.today,
  },
});
