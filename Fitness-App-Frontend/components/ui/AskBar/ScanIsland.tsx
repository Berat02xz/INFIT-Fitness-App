import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from "react-native";
import { CameraView } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { haptics } from "@/utils/haptics";

const { width: SCREEN_W } = Dimensions.get("window");
const H_PAD = 18;

export const SCAN_BAR_H = 54;
export const SCAN_EXPANDED_H = 300;

const C = {
  primary: "#AAFB05",
  text: "#fff",
  sub: "#9A9A9F",
  card: "#0C0D0F",
  border: "rgba(255,255,255,0.10)",
};

type Props = {
  /** 0 = collapsed to bar height, 1 = fully expanded camera. */
  anim: Animated.Value;
  topInset: number;
  granted: boolean;
  onRequestPermission: () => void;
  onCapture: (uri: string) => void;
  onClose: () => void;
};

/**
 * The search bar expanding (Dynamic-Island style) into a compact camera so the
 * user can snap a meal without leaving the screen. Presentational + capture
 * only — the parent owns the open/close animation (`anim`) and the
 * scan/log pipeline that runs after `onCapture`.
 */
export default function ScanIsland({
  anim,
  topInset,
  granted,
  onRequestPermission,
  onCapture,
  onClose,
}: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  const height = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCAN_BAR_H, SCAN_EXPANDED_H],
  });
  const contentOpacity = anim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0.1, 1],
  });

  const snap = async () => {
    if (!cameraRef.current || busy) return;
    try {
      setBusy(true);
      haptics.light();
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });
      if (photo?.uri) onCapture(photo.uri);
      else setBusy(false);
    } catch (e) {
      console.log("scan capture error", e);
      setBusy(false);
    }
  };

  return (
    <Animated.View style={[st.island, { top: topInset + 10, height }]}>
      <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
        {granted ? (
          <View style={{ flex: 1 }}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

            {/* readability scrim behind the shutter */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.55)"]}
              style={st.scrim}
              pointerEvents="none"
            />

            <Pressable onPress={onClose} style={st.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>

            <View style={st.shutterRow}>
              <Pressable onPress={snap} disabled={busy} style={st.shutterOuter}>
                <View style={[st.shutterInner, busy && { backgroundColor: C.primary }]} />
              </Pressable>
            </View>

            <Text style={st.hint}>Center your meal, then tap to scan</Text>
          </View>
        ) : (
          <View style={st.permWrap}>
            <Pressable onPress={onClose} style={st.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
            <Ionicons name="camera-outline" size={28} color={C.primary} />
            <Text style={st.permText}>Allow camera access to scan your meals</Text>
            <Pressable onPress={onRequestPermission} style={st.permBtn}>
              <Text style={st.permBtnText}>Allow Camera</Text>
            </Pressable>
          </View>
        )}
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
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 110 },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  shutterRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  shutterInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
  },
  hint: {
    position: "absolute",
    bottom: 84,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "rgba(255,255,255,0.85)",
    fontFamily: theme.medium,
    fontSize: 12.5,
  },
  permWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  permText: {
    color: C.text,
    fontFamily: theme.medium,
    fontSize: 14,
    textAlign: "center",
  },
  permBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 22,
    marginTop: 2,
  },
  permBtnText: { color: "#000", fontFamily: theme.bold, fontSize: 14 },
});
