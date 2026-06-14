import React, { useEffect, useRef, useState } from "react";
import {
  Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { theme } from "@/constants/theme";
import { sendChatMessage } from "@/hooks/useChatEngine";
import { parseHtmlResponse } from "@/components/ui/Chatbot/ChatRenderer";

// ─── Layout constants ─────────────────────────────────────────────────────────

const BAR_H          = 54;
const MAX_RESPOND_H  = 320;
/** Height taken by the responding header + paddings (added to scroll content). */
const RESPOND_OVERHEAD = 70;
const H_PAD = 18;
/** Left inset so the responding header clears the floating avatar (~48px wide). */
const AVATAR_CLEAR = 52;

const AI_VIDEO = require("../../../assets/videos/AI.mp4");

const C = {
  bg:      "#0C0D0F",
  border:  "rgba(255,255,255,0.09)",
  text:    "#FFFFFF",
  sub:     "#8E8E93",
  primary: "#AAFB05",
};

// ─── ChatIsland ───────────────────────────────────────────────────────────────
// Mounts when the AskBar has a pending question.
//   1. While THINKING the island stays collapsed at bar height — just a centred
//      video + "Thinking…". No dynamic-island expansion yet.
//   2. When the first response token arrives it expands (dynamic-island style) to
//      fit the answer, capped at MAX_RESPOND_H; content scrolls beyond that.
//   3. The answer is rendered with full pill stylisation (parseHtmlResponse), the
//      same renderer the full Chatbot screen uses.
//   4. Auto-closes after AUTO_CLOSE_MS, or immediately on user dismiss.
//
// A SINGLE video player is shared, but the thinking / responding video views are
// rendered exclusively (never mounted at the same time) so the loop never stalls
// and Android only ever decodes one instance.

const AUTO_CLOSE_MS = 9000;

export default function ChatIsland({
  question,
  topInset,
  onClose,
}: {
  question: string;
  topInset: number;
  onClose: () => void;
}): React.JSX.Element {
  const [phase, setPhase] = useState<"thinking" | "responding">("thinking");
  const [responseText, setResponseText] = useState("");

  const heightAnim     = useRef(new Animated.Value(BAR_H)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const thinkingPulse  = useRef(new Animated.Value(0.45)).current;

  const currentHeightRef = useRef(BAR_H);
  const transitionedRef  = useRef(false);
  const closingRef       = useRef(false);
  const autoCloseTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const player = useVideoPlayer(AI_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
    p.audioMixingMode = "mixWithOthers";
    p.play();
  });

  // Fade the content in, pulse "Thinking…", and fire the request.
  useEffect(() => {
    let cancelled = false;

    player.play();

    Animated.timing(contentOpacity, {
      toValue: 1, duration: 200, useNativeDriver: true,
    }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(thinkingPulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
        Animated.timing(thinkingPulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();

    sendChatMessage(
      question,
      (_chunk, full) => {
        if (cancelled) return;
        setResponseText(full);
        if (!transitionedRef.current) {
          transitionedRef.current = true;
          pulseLoop.stop();
          // Expand only now that we have something to show.
          setPhase("responding");
          currentHeightRef.current = BAR_H;
          // onContentSizeChange will animate to the real content height.
        }
      },
    ).then(() => {
      if (!cancelled) {
        autoCloseTimer.current = setTimeout(() => {
          if (!cancelled) handleClose();
        }, AUTO_CLOSE_MS);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(autoCloseTimer.current);
      pulseLoop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grow the island to fit scroll content (capped at MAX_RESPOND_H).
  const onContentSizeChange = (_: number, h: number) => {
    if (!transitionedRef.current || closingRef.current) return;
    const target = Math.min(h + RESPOND_OVERHEAD, MAX_RESPOND_H);
    if (Math.abs(target - currentHeightRef.current) < 4) return;
    currentHeightRef.current = target;
    Animated.timing(heightAnim, {
      toValue: target, duration: 220,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  };

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    clearTimeout(autoCloseTimer.current);
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(heightAnim, {
        toValue: BAR_H, duration: 260,
        easing: Easing.in(Easing.cubic), useNativeDriver: false,
      }),
    ]).start(({ finished }) => { if (finished) onClose(); });
  };

  const borderRadius = heightAnim.interpolate({
    inputRange: [BAR_H, MAX_RESPOND_H],
    outputRange: [27, 28],
    extrapolate: "clamp",
  });

  return (
    <Animated.View style={[st.island, { top: topInset + 10, height: heightAnim, borderRadius }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: contentOpacity }]}>

        {/* Close button */}
        <Pressable onPress={handleClose} style={st.closeBtn} hitSlop={10} accessibilityLabel="Close">
          <Ionicons name="close" size={16} color={C.sub} />
        </Pressable>

        {phase === "thinking" ? (
          /* ── Thinking — collapsed bar height, centred ── */
          <View style={[StyleSheet.absoluteFill, st.thinkingWrap]}>
            <VideoView
              player={player}
              style={st.thinkingVideo}
              nativeControls={false}
              contentFit="contain"
              playsInline
            />
            <Animated.Text style={[st.thinkingText, { opacity: thinkingPulse }]}>
              Thinking…
            </Animated.Text>
          </View>
        ) : (
          /* ── Responding — expanded, styled answer ── */
          <View style={[StyleSheet.absoluteFill, st.respondingWrap]}>
            <View style={st.respondingHeader}>
              <VideoView
                player={player}
                style={st.headerVideo}
                nativeControls={false}
                contentFit="contain"
                playsInline
              />
              <Text style={st.headerLabel} numberOfLines={1}>AI Coach</Text>
            </View>

            <ScrollView
              style={st.scrollArea}
              contentContainerStyle={st.scrollContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={onContentSizeChange}
            >
              {parseHtmlResponse(responseText)}
            </ScrollView>
          </View>
        )}

      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  island: {
    position: "absolute",
    left: H_PAD,
    right: H_PAD,
    zIndex: 45,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },

  closeBtn: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  // Thinking
  thinkingWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
  },
  thinkingVideo: { width: 30, height: 30, backgroundColor: "transparent" },
  thinkingText: { color: C.sub, fontFamily: theme.medium, fontSize: 14.5 },

  // Responding
  respondingWrap: { flexDirection: "column", paddingTop: 12, paddingBottom: 14 },
  respondingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    // Clear the floating avatar on the left and the close button on the right.
    paddingLeft: AVATAR_CLEAR,
    paddingRight: 44,
    paddingBottom: 8,
  },
  headerVideo: { width: 22, height: 22, backgroundColor: "transparent" },
  headerLabel: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: theme.medium,
    fontSize: 11.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    flex: 1,
  },

  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
});
