import React from "react";
import { Platform, View, ViewStyle, StyleProp } from "react-native";
import { BlurView } from "expo-blur";

// ─── PlatformBlur ─────────────────────────────────────────────────────────────
// iOS gets a real backdrop BlurView. Android renders a plain solid-colour View
// instead — the `dimezisBlurView` backend is a major frame-rate killer on Android
// (it re-renders the blurred backdrop every frame), so we trade the glass look
// for smooth scrolling. Callers pass `androidColor` to match the blur's tint.

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: "light" | "dark" | "default" | string;
  /** Solid colour used on Android in place of the blur. */
  androidColor?: string;
};

export default function PlatformBlur({
  children,
  style,
  intensity = 40,
  tint = "dark",
  androidColor = "rgba(20,20,22,0.92)",
}: Props): React.JSX.Element {
  if (Platform.OS === "android") {
    return <View style={[style, { backgroundColor: androidColor }]}>{children}</View>;
  }
  return (
    <BlurView intensity={intensity} tint={tint as any} style={style}>
      {children}
    </BlurView>
  );
}
