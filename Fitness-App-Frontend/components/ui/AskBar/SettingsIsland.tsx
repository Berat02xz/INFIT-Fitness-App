import React from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const H_PAD = 18;
const BAR_H = 54;

// The ask-bar expanding (Dynamic-Island style) to host a settings editor, clear
// of the bottom navigation. Presentational only — the parent (AskBar) owns the
// open/close animation via `anim` and supplies the content + target height.

export default function SettingsIsland({
  anim,
  topInset,
  height,
  onClose,
  children,
}: {
  anim: Animated.Value;
  topInset: number;
  height: number;
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const h = anim.interpolate({ inputRange: [0, 1], outputRange: [BAR_H, height] });
  const contentOpacity = anim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0.05, 1],
  });

  return (
    <Animated.View style={[st.island, { top: topInset + 10, height: h }]}>
      <Animated.View style={[st.inner, { opacity: contentOpacity }]}>
        <Pressable onPress={onClose} style={st.close} hitSlop={8} accessibilityLabel="Close">
          <Ionicons name="close" size={18} color="#fff" />
        </Pressable>
        <View style={st.content}>{children}</View>
      </Animated.View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  island: {
    position: "absolute",
    left: H_PAD,
    right: H_PAD,
    zIndex: 40,
    borderRadius: 28,
    backgroundColor: "#0C0D0F",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  inner: { flex: 1 },
  close: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
});
