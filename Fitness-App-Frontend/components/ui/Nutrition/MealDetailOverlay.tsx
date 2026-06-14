import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";

import { theme } from "@/constants/theme";
import FoodEmoji from "./FoodEmoji";
import type { MealBubbleItem } from "./MealBubbles";

// ─── Meal detail overlay ─────────────────────────────────────────────────────
// Tapping a logged meal emoji opens this: the whole screen behind blurs, and the
// meal floats forward — its name on top, the big emoji, its calories, and a
// health level below. Tap anywhere to dismiss.

const C = {
  name: "#FFFFFF",
  cals: "rgba(255,255,255,0.62)",
  track: "rgba(255,255,255,0.14)",
  label: "rgba(255,255,255,0.85)",
} as const;

function healthMeta(score: number): { label: string; color: string; level: number } {
  const s = Math.max(0, Math.min(10, Math.round(score)));
  if (s >= 8) return { label: "Very healthy", color: "#34C759", level: s };
  if (s >= 6) return { label: "Healthy", color: "#9BE15D", level: s };
  if (s >= 4) return { label: "Balanced", color: "#FFB340", level: s };
  if (s >= 2) return { label: "Indulgent", color: "#FF9F0A", level: s };
  return { label: "Treat", color: "#FF453A", level: s };
}

export default function MealDetailOverlay({
  meal,
  autoClose,
  onClose,
}: {
  meal: MealBubbleItem;
  /** tap-opened → auto-dismiss after 2s; hold-opened → stays until release */
  autoClose: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const h = healthMeta(meal.health);

  useEffect(() => {
    if (!autoClose) return;
    const t = setTimeout(onClose, 2000);
    return () => clearTimeout(t);
  }, [autoClose, onClose]);

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(160)}
      style={styles.root}
    >
      <Pressable style={styles.fill} onPress={onClose}>
        <BlurView intensity={40} tint="dark" style={styles.fill} />
        <View style={styles.scrim} />

        <Animated.View entering={ZoomIn.duration(220)} style={styles.center} pointerEvents="none">
          <Text style={styles.name} numberOfLines={2}>
            {meal.name}
          </Text>

          <View style={styles.emojiWrap}>
            <FoodEmoji emoji={meal.emoji} size={100} />
          </View>

          <Text style={styles.cals} allowFontScaling={false}>
            {Math.round(meal.calories).toLocaleString()} kcal
          </Text>

          {/* health level */}
          <View style={styles.healthBlock}>
            <View style={styles.track}>
              <View
                style={[
                  styles.fillBar,
                  { width: `${h.level * 10}%`, backgroundColor: h.color },
                ]}
              />
            </View>
            <View style={styles.healthRow}>
              <View style={[styles.healthDot, { backgroundColor: h.color }]} />
              <Text style={[styles.healthLabel, { color: h.color }]} allowFontScaling={false}>
                {h.label}
              </Text>
              <Text style={styles.healthScore} allowFontScaling={false}>
                · {h.level}/10
              </Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  fill: StyleSheet.absoluteFillObject,
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.32)" },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 1,
  },
  name: {
    fontFamily: theme.bold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: C.name,
    textAlign: "center",
    marginBottom: 8,
  },
  emojiWrap: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  cals: {
    fontFamily: theme.semibold,
    fontSize: 16,
    color: C.cals,
    marginTop: 2,
  },
  healthBlock: {
    marginTop: 22,
    alignItems: "center",
    gap: 10,
  },
  track: {
    width: 180,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.track,
    overflow: "hidden",
  },
  fillBar: {
    height: "100%",
    borderRadius: 4,
  },
  healthRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  healthDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 7,
  },
  healthLabel: {
    fontFamily: theme.semibold,
    fontSize: 14,
  },
  healthScore: {
    fontFamily: theme.medium,
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginLeft: 4,
  },
});
