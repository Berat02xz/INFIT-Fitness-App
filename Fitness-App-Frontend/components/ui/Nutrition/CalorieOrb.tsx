import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

// ─── Calorie ring ────────────────────────────────────────────────────────────
// A clean, substantial progress ring that sits BEHIND the central cluster of
// meal emojis on the nutrition screen. No glow, no halo — just a refined
// neutral track ring with a brand-green progress arc sweeping clockwise from
// the top as the day's calories accrue.
//
// Purely ambient/decorative: the wrapper is pointerEvents="none" so taps pass
// straight through to the emoji cluster above it.

const C = {
  // Steady, neutral track ring — a quiet hairline.
  track: "rgba(255,255,255,0.07)",
  // Brand-green progress arc.
  progress: "#AAFB05",
} as const;

// Stroke weights — thin and refined. The track is a near-hairline and the
// progress arc sits only marginally prouder so the ring reads as elegant, not
// chunky. The diameter (passed by the parent) carries the visual weight.
const TRACK_WIDTH = 2.5;
const PROGRESS_WIDTH = 4;

// Padding so the rounded arc cap is never clipped by the SVG bounds.
const PAD = PROGRESS_WIDTH;

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export default function CalorieOrb(props: {
  progress: number; // 0..1 = calories consumed / target (clamped internally)
  size: number; // diameter in px of the ring
  centerX: number; // where the ring center should sit (px)
  centerY: number; // where the ring center should sit (px)
}): React.JSX.Element {
  const { progress, size, centerX, centerY } = props;

  const clamped = clamp01(progress);

  // Box is the ring diameter plus a little padding for the stroke caps.
  const box = size + PAD * 2;
  const cx = box / 2;
  const cy = box / 2;
  const radius = size / 2;

  // Arc circumference and the dash offset that reveals `clamped` of it.
  const { circumference, dashOffset } = useMemo(() => {
    const c = 2 * Math.PI * radius;
    return { circumference: c, dashOffset: c * (1 - clamped) };
  }, [radius, clamped]);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrapper,
        { left: centerX - box / 2, top: centerY - box / 2, width: box, height: box },
      ]}
    >
      <Svg width={box} height={box}>
        {/* Neutral track ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={C.track}
          strokeWidth={TRACK_WIDTH}
        />
        {/* Brand-green progress arc, starting at the top, sweeping clockwise */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={C.progress}
          strokeWidth={PROGRESS_WIDTH}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
  },
});
