import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

// ─── Nutrition background ────────────────────────────────────────────────────
// A calm, premium, near-black canvas:
//   1) flat near-black base fill
//   2) one large, very diffused soft glow in the upper-right corner that
//      slowly "breathes" (the only animated layer)
//   3) a faint, evenly-spaced square grid with a tiny dot at every line
//      intersection.
//
// The grid is drawn as ONE tiled SVG <Pattern> (a couple of draw calls) rather
// than hundreds of individual <Line>/<Circle> nodes — that kept the UI thread
// busy on mount and made tab transitions janky. Sits behind all screen content:
// absolute fill, pointerEvents="none".

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Spacing of the square grid on both axes (px).
const GRID_SPACING = 34;
const HALF = GRID_SPACING / 2;

// Diffused glow geometry — a soft off-screen light source up and to the right.
const GLOW_CX = SCREEN_W * 0.82;
const GLOW_CY = SCREEN_H * 0.15;
const GLOW_R = SCREEN_W * 0.72;

const C = {
  base: "#08090B",
  gridLine: "rgba(255,255,255,0.045)",
  gridDot: "rgba(255,255,255,0.11)",
  // Desaturated cool light, fading to transparent. Kept to a whisper — only a
  // faint hint of light in the corner, well under a third of the old intensity.
  glowCore: "rgba(196,210,220,0.028)",
  glowMid: "rgba(170,190,196,0.01)",
  glowEdge: "rgba(170,190,196,0)",
} as const;

function ConstellationBackground() {
  // Single slow loop drives the glow "breath": ping-pongs in [0,1].
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [breath]);

  const glowStyle = useAnimatedStyle(() => ({
    // Kept to a faint whisper so the corner halo never reads as a bright white
    // circle — well under half its old intensity.
    opacity: interpolate(breath.value, [0, 1], [0.28, 0.42]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.97, 1.04]) }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* (1) Flat near-black base */}
      <View style={styles.base} />

      {/* (2) Large diffused upper-right glow (the only animated layer) */}
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <Svg width={SCREEN_W} height={SCREEN_H}>
          <Defs>
            <RadialGradient
              id="nutritionGlow"
              cx={GLOW_CX}
              cy={GLOW_CY}
              r={GLOW_R}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={C.glowCore} stopOpacity={1} />
              <Stop offset="0.45" stopColor={C.glowMid} stopOpacity={1} />
              <Stop offset="1" stopColor={C.glowEdge} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW_CX} cy={GLOW_CY} r={GLOW_R} fill="url(#nutritionGlow)" />
        </Svg>
      </Animated.View>

      {/* (3) Square grid + intersection dots — one tiled Pattern (cheap) */}
      <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="grid"
            x={0}
            y={0}
            width={GRID_SPACING}
            height={GRID_SPACING}
            patternUnits="userSpaceOnUse"
          >
            {/* one vertical + one horizontal edge → tiles into full squares */}
            <Path
              d={`M${HALF} 0 V${GRID_SPACING} M0 ${HALF} H${GRID_SPACING}`}
              stroke={C.gridLine}
              strokeWidth={1}
              fill="none"
            />
            {/* dot sits at the tile's line intersection */}
            <Circle cx={HALF} cy={HALF} r={1.1} fill={C.gridDot} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={SCREEN_W} height={SCREEN_H} fill="url(#grid)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.base,
  },
});

export default React.memo(ConstellationBackground);
