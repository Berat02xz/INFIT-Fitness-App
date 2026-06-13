import { Platform, Vibration } from "react-native";

// Lightweight, build-safe haptics. Visual press-scale feedback (in the bars)
// works cross-platform without any native module. Real iOS Taptic feedback needs
// `expo-haptics` — once it's installed, swap the bodies below for
// Haptics.impactAsync / selectionAsync (kept here so call sites never change).
//
// iOS `Vibration` only does a heavy ~0.4s buzz (no fine control), which is too
// strong for frequent taps, so we no-op iOS until expo-haptics is added.

export const haptics = {
  /** small tap — entering chat, sending, food added */
  light() {
    if (Platform.OS === "android") Vibration.vibrate(8);
  },
  /** very small — focus / selection changes */
  selection() {
    if (Platform.OS === "android") Vibration.vibrate(5);
  },
  /** confirmation — successful add */
  success() {
    if (Platform.OS === "android") Vibration.vibrate(14);
  },
};
