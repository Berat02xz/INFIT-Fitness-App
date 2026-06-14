import { haptics } from "@/utils/haptics";
import React, { useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
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

import FoodEmoji from "./FoodEmoji";

// Relative require (not the @/ alias) so Metro resolves the asset reliably.
const BIN_IMG = require("../../../assets/icons/recycle_bin_00000.png");

// ─── Meal bubbles (simulation layer) ─────────────────────────────────────────
// A playful, springy cluster of logged meal emojis floating around a center
// point. They pop in on mount, can be DRAGGED immediately (small movement),
// HOLD to preview the meal detail (kept until release), or quick-TAP to open the
// detail persistently. While dragging, a big recycle-bin rises from the bottom —
// drop a meal onto it (drag to the bottom) to delete it; otherwise it gravitates
// back to its cluster spot. Taps pass through the empty gaps (box-none).

export type MealBubbleItem = {
  id: string;
  emoji: string;
  name: string;
  calories: number;
  health: number;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Touch box around each (large) emoji — generous so the finger lands easily.
const SIZE = 84;
const EMOJI_SIZE = 50;

// ─── Recycle-bin drop target (bottom of screen) ─────────────────────────────
// The transparent bin image, full screen width, pushed mostly off the bottom so
// only ~40% of its top shows. No background / border. Rises while dragging.
const BIN_W = SCREEN_W;
const BIN_PEEK = 0.55; // fraction of the image hidden below the screen (top ~45% shows)
// How far down the dragged emoji must reach (absolute Y) to arm a delete.
const BIN_ARM_Y = SCREEN_H - 190;

// Golden-angle radial packing makes the cluster read as natural, not a ring.
const GOLDEN = 2.399963;

type Offset = { x: number; y: number };

function restingOffset(index: number, total: number): Offset {
  if (total <= 1) return { x: 0, y: 0 };
  const angle = index * GOLDEN;
  const jitter = ((index * 53) % 19) - 9;
  const radius = 42 + Math.min(index, 9) * 19 + jitter;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

// Shared drag state, owned by the parent and threaded to every bubble + the bin.
type DragState = {
  active: SharedValue<number>;
  overBin: SharedValue<number>;
};

type MealBubbleProps = {
  item: MealBubbleItem;
  index: number;
  total: number;
  centerX: number;
  centerY: number;
  drag: DragState;
  onDelete: (id: string) => void;
  onSelect: (item: MealBubbleItem) => void;
  onPreview: (item: MealBubbleItem) => void;
  onPreviewClose: () => void;
};

function MealBubble({
  item,
  index,
  total,
  centerX,
  centerY,
  drag,
  onDelete,
  onSelect,
  onPreview,
  onPreviewClose,
}: MealBubbleProps) {
  const rest = useMemo(() => restingOffset(index, total), [index, total]);

  const tx = useSharedValue(rest.x);
  const ty = useSharedValue(rest.y);
  const scale = useSharedValue(0);
  const dragging = useSharedValue(0);
  const previewing = useSharedValue(0);

  // Pop-in on mount.
  useEffect(() => {
    scale.value = withSpring(1, { damping: 9, stiffness: 170, mass: 0.6 });
  }, [scale]);

  // Ease toward the resting position when the layout changes (not while dragging).
  useEffect(() => {
    if (dragging.value === 1) return;
    tx.value = withSpring(rest.x, { damping: 11, stiffness: 90, mass: 0.9 });
    ty.value = withSpring(rest.y, { damping: 11, stiffness: 90, mass: 0.9 });
  }, [rest.x, rest.y, dragging, tx, ty]);

  // Drag — immediate (small movement), no long-press needed.
  const pan = Gesture.Pan()
    .minDistance(10)
    .onStart(() => {
      dragging.value = 1;
      drag.active.value = 1;
      runOnJS(haptics.light)();
      scale.value = withSpring(1.18, { damping: 12, stiffness: 220, mass: 0.6 });
    })
    .onUpdate((e) => {
      tx.value = rest.x + e.translationX;
      ty.value = rest.y + e.translationY;
      const cy = centerY + ty.value;
      drag.overBin.value = cy > BIN_ARM_Y ? 1 : 0;
    })
    .onEnd(() => {
      dragging.value = 0;
      drag.active.value = 0;
      const wasOverBin = drag.overBin.value === 1;
      drag.overBin.value = 0;

      if (wasOverBin) {
        runOnJS(haptics.success)();
        ty.value = withTiming(ty.value + 130, { duration: 260 });
        scale.value = withTiming(0, { duration: 240 }, (finished) => {
          if (finished) runOnJS(onDelete)(item.id);
        });
        return;
      }

      tx.value = withSpring(rest.x, { damping: 12, stiffness: 110, mass: 0.8 });
      ty.value = withSpring(rest.y, { damping: 12, stiffness: 110, mass: 0.8 });
      scale.value = withSpring(1, { damping: 12, stiffness: 200, mass: 0.6 });
    });

  // Hold to preview — opens the detail and keeps it until release.
  const longPress = Gesture.LongPress()
    .minDuration(180)
    .maxDistance(16)
    .onStart(() => {
      previewing.value = 1;
      runOnJS(haptics.light)();
      runOnJS(onPreview)(item);
      scale.value = withSpring(1.16, { damping: 12, stiffness: 220, mass: 0.6 });
    })
    .onFinalize(() => {
      if (previewing.value === 1) {
        previewing.value = 0;
        runOnJS(onPreviewClose)();
        scale.value = withSpring(1, { damping: 12, stiffness: 220, mass: 0.6 });
      }
    });

  // Quick tap — punchy pop + open the detail persistently.
  const tap = Gesture.Tap()
    .maxDuration(170)
    .onStart(() => {
      runOnJS(haptics.light)();
      runOnJS(onSelect)(item);
      scale.value = withSequence(
        withSpring(1.42, { damping: 9, stiffness: 650, mass: 0.4 }),
        withSpring(1, { damping: 14, stiffness: 520, mass: 0.4 })
      );
    });

  const gesture = Gesture.Race(pan, longPress, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
    zIndex: dragging.value === 1 || previewing.value === 1 ? 10 : 1,
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
        <FoodEmoji emoji={item.emoji} size={EMOJI_SIZE} />
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Big recycle-bin image at the bottom ─────────────────────────────────────
function BinImage({ drag }: { drag: DragState }): React.JSX.Element {
  const wrapStyle = useAnimatedStyle(() => ({
    opacity: withTiming(drag.active.value, { duration: 160 }),
    transform: [
      { translateY: withTiming(interpolate(drag.active.value, [0, 1], [80, 0]), { duration: 220 }) },
    ],
  }));

  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(drag.overBin.value === 1 ? 1.06 : 1, { damping: 14, stiffness: 200 }) },
      { translateY: withSpring(drag.overBin.value === 1 ? -16 : 0, { damping: 14, stiffness: 200 }) },
    ],
    opacity: interpolate(drag.overBin.value, [0, 1], [0.82, 1]),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.binWrap, wrapStyle]}>
      <Animated.Image source={BIN_IMG} resizeMode="contain" style={[styles.binImg, imgStyle]} />
    </Animated.View>
  );
}

export default function MealBubbles(props: {
  meals: MealBubbleItem[];
  centerX: number;
  centerY: number;
  onDelete: (id: string) => void;
  onSelect: (item: MealBubbleItem) => void;
  onPreview: (item: MealBubbleItem) => void;
  onPreviewClose: () => void;
}): React.JSX.Element {
  const { meals, centerX, centerY, onDelete, onSelect, onPreview, onPreviewClose } = props;

  const active = useSharedValue(0);
  const overBin = useSharedValue(0);
  const drag: DragState = { active, overBin };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <BinImage drag={drag} />
      {meals.map((meal, index) => (
        <MealBubble
          key={meal.id}
          item={meal}
          index={index}
          total={meals.length}
          centerX={centerX}
          centerY={centerY}
          drag={drag}
          onDelete={onDelete}
          onSelect={onSelect}
          onPreview={onPreview}
          onPreviewClose={onPreviewClose}
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
  binWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -BIN_W * BIN_PEEK,
    alignItems: "center",
  },
  binImg: {
    width: BIN_W,
    height: BIN_W,
  },
});
