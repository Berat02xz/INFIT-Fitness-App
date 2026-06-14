import { theme } from "@/constants/theme";
import type { FoodItem } from "@/constants/foods";
import { haptics } from "@/utils/haptics";
import FoodEmoji from "./FoodEmoji";
import React, { useCallback, useEffect, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Rotary arc wheel ────────────────────────────────────────────────────────
// The food emojis sit along the UPPER ARC of a large circle whose CENTER is
// anchored well BELOW the bottom of the screen. The user drags horizontally to
// ROTATE the wheel: emojis travel along the arc, the one at top-dead-center is
// the focused/selected item (largest, fully opaque), and the rest curve down &
// away to the sides (smaller, dimmer). Releasing snaps the nearest item to
// dead-center. Tapping any emoji logs it.
//
// The component is a fixed-height column; the parent positions it above the
// floating tab bar.

// ── Wheel geometry ──
// Radius of the virtual wheel. Big radius → a gentle, premium arc curvature.
const WHEEL_R = SCREEN_W * 1.55;
// Angular gap between adjacent emojis (radians from the wheel center). Smaller
// → emojis sit closer along the arc.
const STEP = 0.17;
// How many items to render on each side of the focused one. Beyond this the
// emoji has curved too far down/away to matter — keeps the DOM light.
const VISIBLE_SIDE = 5;

// ── Item sizing ──
const FOCUS_CIRCLE = 74; // focused (top-dead-center) round button
const FOCUS_EMOJI = 42; // single emoji at focus

// ── Component layout ──
const ARC_AREA_H = 116; // vertical band the arc of emojis occupies
const CAPTION_H = 30;
export const EMOJI_DIAL_HEIGHT = ARC_AREA_H + CAPTION_H;

// Where top-dead-center of the arc sits vertically inside the arc band.
const ARC_TOP_Y = 12;
// The virtual wheel center, in the arc band's local coords (far below it).
const WHEEL_CX = SCREEN_W / 2;
const WHEEL_CY = ARC_TOP_Y + WHEEL_R;

// How many px of horizontal drag rotate the wheel by one full item step.
const PX_PER_ITEM = 78;

const C = {
  circleFill: "#16181B",
  caption: "rgba(255,255,255,0.92)",
  captionDot: "rgba(255,255,255,0.30)",
  captionKcal: theme.primary,
} as const;

// ─── Single wheel item ───────────────────────────────────────────────────────
interface WheelItemProps {
  food: FoodItem;
  index: number;
  // Continuous rotation, expressed in item units (0 = item 0 at dead-center).
  rotation: SharedValue<number>;
  onTap: (food: FoodItem) => void;
}

function WheelItem({ food, index, rotation, onTap }: WheelItemProps) {
  // Animated placement along the arc. `offset` is how many items this one is
  // away from dead-center (0 = focused). theta is its angle from the top.
  const animatedStyle = useAnimatedStyle(() => {
    const offset = index - rotation.value;
    const theta = offset * STEP;

    // Cull far items entirely (kept rendered but invisible & non-interactive).
    const absOffset = Math.abs(offset);
    const visible = absOffset <= VISIBLE_SIDE + 0.5;

    const x = WHEEL_CX + WHEEL_R * Math.sin(theta);
    const y = ARC_TOP_Y + WHEEL_R * (1 - Math.cos(theta));

    // Focus falloff: 1 at dead-center → smaller/dimmer toward the sides.
    const falloff = Math.max(0, 1 - absOffset / (VISIBLE_SIDE + 1));
    const scale = 0.5 + 0.5 * falloff;
    const opacity = visible ? 0.28 + 0.72 * falloff : 0;

    return {
      opacity,
      transform: [
        // anchor the circle's center on (x, y)
        { translateX: x - FOCUS_CIRCLE / 2 },
        { translateY: y - FOCUS_CIRCLE / 2 },
        { scale },
      ],
      zIndex: Math.round(100 * falloff),
    };
  });

  const tap = Gesture.Tap()
    .maxDuration(220)
    .onEnd((_e, success) => {
      if (success) runOnJS(onTap)(food);
    });

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[styles.item, animatedStyle]}>
        <View style={styles.circle}>
          <FoodEmoji emoji={food.emoji} size={FOCUS_EMOJI} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Dial ────────────────────────────────────────────────────────────────────
interface EmojiDialProps {
  foods: FoodItem[];
  /** log this food (tap) */
  onPick: (food: FoodItem) => void;
  /** centered item changed */
  onSelectionChange?: (food: FoodItem, index: number) => void;
}

export default function EmojiDial({
  foods,
  onPick,
  onSelectionChange,
}: EmojiDialProps) {
  const lastIndex = Math.max(foods.length - 1, 0);

  // Continuous rotation in item units; integer-rounded → focused index. Start at
  // item 1 so there's always at least one item to the left of the focused one.
  const rotation = useSharedValue(1);
  const start = useSharedValue(0);

  const [selectedIndex, setSelectedIndex] = useState(1);

  // React-side updates as the focused item changes (caption + haptics + cb).
  const onFocusChange = useCallback(
    (idx: number) => {
      setSelectedIndex(idx);
      haptics.selection();
      const food = foods[idx];
      if (food) onSelectionChange?.(food, idx);
    },
    [foods, onSelectionChange]
  );

  // Nearest snapped index derived live from rotation (worklet-friendly).
  const focusedIndex = useDerivedValue(() => {
    "worklet";
    const raw = Math.round(rotation.value);
    return Math.min(Math.max(raw, 0), lastIndex);
  });

  // Fire the JS callback only when the integer focus actually changes.
  useAnimatedReaction(
    () => focusedIndex.value,
    (curr, prev) => {
      if (prev !== null && curr !== prev) runOnJS(onFocusChange)(curr);
    }
  );

  const handlePick = useCallback(
    (food: FoodItem) => {
      haptics.light();
      onPick(food);
    },
    [onPick]
  );

  // Horizontal drag rotates the wheel. Dragging right reveals earlier items
  // (rotation decreases) — like spinning a physical wheel under your finger.
  const pan = Gesture.Pan()
    .onStart(() => {
      start.value = rotation.value;
    })
    .onUpdate((e) => {
      const next = start.value - e.translationX / PX_PER_ITEM;
      // Soft clamp with a little rubber-band past the ends.
      const min = -0.6;
      const max = lastIndex + 0.6;
      rotation.value = Math.min(Math.max(next, min), max);
    })
    .onEnd(() => {
      // Snap the nearest item to dead-center.
      const raw = Math.round(rotation.value);
      const target = Math.min(Math.max(raw, 0), lastIndex);
      rotation.value = withSpring(target, { damping: 16, stiffness: 140, mass: 0.7 });
    });

  // Ensure rotation lands on a valid item if the food list shrinks.
  useEffect(() => {
    if (rotation.value > lastIndex) rotation.value = withSpring(lastIndex);
  }, [lastIndex, rotation]);

  const selected = foods[Math.min(selectedIndex, lastIndex)];

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <View style={styles.arcArea}>
          {foods.map((food, index) => (
            <WheelItem
              key={food.id}
              food={food}
              index={index}
              rotation={rotation}
              onTap={handlePick}
            />
          ))}
        </View>
      </GestureDetector>

      {selected ? (
        <Text style={styles.caption} numberOfLines={1} allowFontScaling={false}>
          {selected.name}
          <Text style={styles.captionDot}>{"  ·  "}</Text>
          <Text style={styles.captionKcal}>{selected.calories} kcal</Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: EMOJI_DIAL_HEIGHT,
    width: SCREEN_W,
    alignItems: "center",
  },
  arcArea: {
    height: ARC_AREA_H,
    width: SCREEN_W,
  },
  item: {
    position: "absolute",
    left: 0,
    top: 0,
    width: FOCUS_CIRCLE,
    height: FOCUS_CIRCLE,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: FOCUS_CIRCLE,
    height: FOCUS_CIRCLE,
    borderRadius: FOCUS_CIRCLE / 2,
    backgroundColor: C.circleFill,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    fontSize: 14,
    color: C.caption,
    fontFamily: theme.semibold,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  captionDot: {
    color: C.captionDot,
    fontFamily: theme.semibold,
  },
  captionKcal: {
    color: C.captionKcal,
    fontFamily: theme.bold,
  },
});
