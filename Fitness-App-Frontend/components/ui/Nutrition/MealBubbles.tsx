import { haptics } from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

// ─── Meal bubbles (simulation layer) ─────────────────────────────────────────
// A playful, springy cluster of meal-emoji "bubbles" floating around a center
// point. Each logged meal is just a LARGE borderless emoji. Bubbles pop in on
// mount, do a fast snappy pop on tap, and can be DRAGGED immediately on a small
// finger movement (no long-press hold). While dragging, a big trash zone fades
// in low-center: release over it to delete the meal (emoji is hurled away),
// otherwise the bubble springs back to its cluster spot. Taps pass through the
// empty gaps (the container is box-none).

export type MealBubbleItem = { id: string; emoji: string };

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Touch box around each (large) emoji — generous so the finger lands easily.
const SIZE = 78;
const EMOJI_SIZE = 50;

// ─── Big trash zone geometry (absolute screen coords) ───────────────────────
// A large circle low-center. Sized off screen width so it reads as a prominent
// drop target, and positioned clear of the dial / floating tab bar.
const BIN_SIZE = Math.min(SCREEN_W * 0.42, 184);
const BIN_CX = SCREEN_W / 2;
// Default low-center; the parent may override via `binY`.
const BIN_CY_DEFAULT = SCREEN_H * 0.72;
// The finger only needs to be within this radius (a bit beyond the circle's
// own edge) to arm a delete.
const BIN_HIT_RADIUS = BIN_SIZE / 2 + 28;

// Golden-angle radial packing makes the cluster read as natural, not a ring.
const GOLDEN = 2.399963;

type Offset = { x: number; y: number };

// Deterministic resting offset for a bubble at `index` within `total` bubbles.
function restingOffset(index: number, total: number): Offset {
  if (total <= 1) {
    return { x: 0, y: 0 };
  }
  const angle = index * GOLDEN;
  const jitter = ((index * 53) % 19) - 9;
  const radius = 40 + Math.min(index, 9) * 18 + jitter;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

// Shared drag state, owned by the parent and threaded to every bubble + the bin
// so the bin can react live to whichever bubble is currently being dragged.
type DragState = {
  active: SharedValue<number>; // 1 while any bubble is being dragged
  overBin: SharedValue<number>; // 1 while the dragged bubble is over the bin
};

type MealBubbleProps = {
  id: string;
  emoji: string;
  index: number;
  total: number;
  centerX: number;
  centerY: number;
  binCY: number;
  drag: DragState;
  onDelete: (id: string) => void;
};

// One component instance per meal id keeps hooks stable per bubble — never call
// hooks in a loop in the parent.
function MealBubble({
  id,
  emoji,
  index,
  total,
  centerX,
  centerY,
  binCY,
  drag,
  onDelete,
}: MealBubbleProps) {
  const rest = useMemo(() => restingOffset(index, total), [index, total]);

  const tx = useSharedValue(rest.x);
  const ty = useSharedValue(rest.y);
  const scale = useSharedValue(0);
  const dragging = useSharedValue(0);

  // Pop-in on mount.
  useEffect(() => {
    scale.value = withSpring(1, { damping: 9, stiffness: 170, mass: 0.6 });
  }, [scale]);

  // Ease toward the (possibly shifted) resting position when the layout
  // changes — but never fight an in-progress drag.
  useEffect(() => {
    if (dragging.value === 1) return;
    tx.value = withSpring(rest.x, { damping: 11, stiffness: 90, mass: 0.9 });
    ty.value = withSpring(rest.y, { damping: 11, stiffness: 90, mass: 0.9 });
  }, [rest.x, rest.y, dragging, tx, ty]);

  // Drag: activates on a tiny finger movement (no long-press). minDistance keeps
  // a still finger free for the Tap gesture below.
  const pan = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      dragging.value = 1;
      drag.active.value = 1;
      runOnJS(haptics.light)();
      scale.value = withSpring(1.18, { damping: 12, stiffness: 220, mass: 0.6 });
    })
    .onUpdate((e) => {
      tx.value = rest.x + e.translationX;
      ty.value = rest.y + e.translationY;
      // Bubble center in absolute screen space.
      const cx = centerX + tx.value;
      const cy = centerY + ty.value;
      const dist = Math.hypot(cx - BIN_CX, cy - binCY);
      drag.overBin.value = dist < BIN_HIT_RADIUS ? 1 : 0;
    })
    .onEnd(() => {
      dragging.value = 0;
      drag.active.value = 0;
      const wasOverBin = drag.overBin.value === 1;
      drag.overBin.value = 0;

      if (wasOverBin) {
        // Hurled into the bin: shrink & fall away, then remove the meal.
        runOnJS(haptics.success)();
        ty.value = withTiming(ty.value + 110, { duration: 260 });
        scale.value = withTiming(0, { duration: 240 }, (finished) => {
          if (finished) runOnJS(onDelete)(id);
        });
        return;
      }

      // Not over the bin — gravitate back to the cluster spot.
      tx.value = withSpring(rest.x, { damping: 12, stiffness: 110, mass: 0.8 });
      ty.value = withSpring(rest.y, { damping: 12, stiffness: 110, mass: 0.8 });
      scale.value = withSpring(1, { damping: 12, stiffness: 200, mass: 0.6 });
    });

  // Fast, snappy pop on tap — two very stiff springs, short and punchy.
  const tap = Gesture.Tap()
    .maxDuration(220)
    .onStart(() => {
      runOnJS(haptics.light)();
      scale.value = withSequence(
        withSpring(1.42, { damping: 9, stiffness: 650, mass: 0.4 }),
        withSpring(1, { damping: 14, stiffness: 520, mass: 0.4 })
      );
    });

  // Race: a quick tap pops; any drag movement wins and moves the emoji.
  const gesture = Gesture.Race(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
    zIndex: dragging.value === 1 ? 10 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.bubble,
          { left: centerX - SIZE / 2, top: centerY - SIZE / 2 },
          animatedStyle,
        ]}
      >
        <Text style={styles.emoji} allowFontScaling={false}>
          {emoji}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Big trash zone ──────────────────────────────────────────────────────────
// Fades & scales in only while a bubble is being dragged; grows and turns
// red-tinted while the dragged bubble hovers over it. Prominent, low-center.
function TrashZone({ drag, binCY }: { drag: DragState; binCY: number }): React.JSX.Element {
  const containerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(drag.active.value, { duration: 160 }),
    transform: [
      {
        scale: withTiming(interpolate(drag.active.value, [0, 1], [0.78, 1]), {
          duration: 180,
        }),
      },
    ],
  }));

  const circleStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(drag.overBin.value === 1 ? 1.12 : 1, { damping: 14, stiffness: 220 }) },
    ],
    backgroundColor:
      drag.overBin.value === 1 ? "rgba(255,69,58,0.16)" : "rgba(255,255,255,0.04)",
    borderColor:
      drag.overBin.value === 1 ? "rgba(255,69,58,0.9)" : "rgba(255,255,255,0.14)",
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(drag.overBin.value === 1 ? 1.16 : 1, { damping: 14, stiffness: 220 }) },
    ],
    opacity: drag.overBin.value === 1 ? 1 : 0.65,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: drag.overBin.value === 1 ? 1 : 0.5,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.binWrap,
        { left: BIN_CX - BIN_SIZE / 2, top: binCY - BIN_SIZE / 2 },
        containerStyle,
      ]}
    >
      <Animated.View style={[styles.binCircle, circleStyle]}>
        <Animated.View style={iconStyle}>
          <Ionicons name="trash-outline" size={BIN_SIZE * 0.28} color="#FF453A" />
        </Animated.View>
        <Animated.Text style={[styles.binLabel, labelStyle]} allowFontScaling={false}>
          Drop to remove
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

export default function MealBubbles(props: {
  meals: MealBubbleItem[];
  centerX: number;
  centerY: number;
  /** Absolute Y (from screen top) for the trash zone center — low-center default. */
  binY?: number;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  const { meals, centerX, centerY, onDelete } = props;
  const binCY = props.binY ?? BIN_CY_DEFAULT;

  const active = useSharedValue(0);
  const overBin = useSharedValue(0);
  const drag: DragState = { active, overBin };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Bin sits below the bubbles so a dragged emoji floats above it. */}
      <TrashZone drag={drag} binCY={binCY} />
      {meals.map((meal, index) => (
        <MealBubble
          key={meal.id}
          id={meal.id}
          emoji={meal.emoji}
          index={index}
          total={meals.length}
          centerX={centerX}
          centerY={centerY}
          binCY={binCY}
          drag={drag}
          onDelete={onDelete}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: EMOJI_SIZE,
  },
  binWrap: {
    position: "absolute",
    width: BIN_SIZE,
    height: BIN_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  binCircle: {
    width: BIN_SIZE,
    height: BIN_SIZE,
    borderRadius: BIN_SIZE / 2,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  binLabel: {
    marginTop: 10,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "#FF453A",
    fontFamily: "Bold",
  },
});
