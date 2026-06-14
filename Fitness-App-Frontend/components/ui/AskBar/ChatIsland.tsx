import React, { useEffect, useRef, useState } from "react";
import {
  Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { theme } from "@/constants/theme";
import { sendChatMessage } from "@/hooks/useChatEngine";
import { stripHtml } from "@/components/ui/Chatbot/ChatRenderer";
import AnimatedWords from "@/components/ui/Chatbot/AnimatedWords";

// ─── Layout constants ─────────────────────────────────────────────────────────

const BAR_H = 54;
const THINKING_H = 148;
const RESPONDING_H = 300;
const H_PAD = 18;

const AI_VIDEO = require("../../../assets/videos/AI.mp4");

const C = {
  bg:      "#0C0D0F",
  border:  "rgba(255,255,255,0.09)",
  text:    "#FFFFFF",
  sub:     "#8E8E93",
  primary: "#AAFB05",
};

// ─── ChatIsland ───────────────────────────────────────────────────────────────
// Mounts when the AskBar has a pending question. Handles its full lifecycle:
//   1. Expand from bar height → THINKING_H while calling the AI
//   2. Transition to RESPONDING_H when first text arrives
//   3. Play word-by-word animation on the response
//   4. Auto-close after AUTO_CLOSE_MS, or immediately on user dismiss
// Calls onClose() after the collapse animation finishes so the parent can unmount.

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

  const heightAnim    = useRef(new Animated.Value(BAR_H)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const thinkingAlpha = useRef(new Animated.Value(1)).current;
  const respondingAlpha = useRef(new Animated.Value(0)).current;
  const thinkingPulse = useRef(new Animated.Value(0.45)).current;

  const transitionedRef = useRef(false);
  const closingRef      = useRef(false);
  const autoCloseTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const videoPlayer = useVideoPlayer(AI_VIDEO, (p) => {
    p.loop  = true;
    p.muted = true;
    p.volume = 0;
    p.audioMixingMode = "mixWithOthers";
  });

  // Expand open and kick off the AI request
  useEffect(() => {
    let cancelled = false;

    // Play video
    videoPlayer.play();

    // Expand to thinking height
    Animated.timing(heightAnim, {
      toValue: THINKING_H, duration: 320,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    Animated.timing(contentOpacity, {
      toValue: 1, duration: 200, delay: 160, useNativeDriver: true,
    }).start();

    // Pulse "Thinking…" text
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(thinkingPulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
        Animated.timing(thinkingPulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();

    // Send the question
    sendChatMessage(
      question,
      (_chunk, full) => {
        if (cancelled) return;
        setResponseText(full);
        if (!transitionedRef.current) {
          transitionedRef.current = true;
          setPhase("responding");
          pulseLoop.stop();

          // Cross-fade thinking ↔ responding
          Animated.parallel([
            Animated.timing(thinkingAlpha,   { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(respondingAlpha, { toValue: 1, duration: 300, delay: 100, useNativeDriver: true }),
          ]).start();

          // Expand to responding height
          Animated.timing(heightAnim, {
            toValue: RESPONDING_H, duration: 320,
            easing: Easing.out(Easing.cubic), useNativeDriver: false,
          }).start();
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
    inputRange: [BAR_H, THINKING_H, RESPONDING_H],
    outputRange: [27, 28, 28],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={[
        st.island,
        { top: topInset + 10, height: heightAnim, borderRadius },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: contentOpacity }]}>

        {/* Close button */}
        <Pressable onPress={handleClose} style={st.closeBtn} hitSlop={10} accessibilityLabel="Close">
          <Ionicons name="close" size={16} color={C.sub} />
        </Pressable>

        {/* ── Thinking ── */}
        <Animated.View
          pointerEvents={phase === "thinking" ? "auto" : "none"}
          style={[StyleSheet.absoluteFill, st.thinkingWrap, { opacity: thinkingAlpha }]}
        >
          <VideoView
            player={videoPlayer}
            style={st.thinkingVideo}
            nativeControls={false}
            contentFit="contain"
            playsInline
          />
          <Animated.Text style={[st.thinkingText, { opacity: thinkingPulse }]}>
            Thinking…
          </Animated.Text>
        </Animated.View>

        {/* ── Responding ── */}
        <Animated.View
          pointerEvents={phase === "responding" ? "auto" : "none"}
          style={[StyleSheet.absoluteFill, st.respondingWrap, { opacity: respondingAlpha }]}
        >
          {/* Header row */}
          <View style={st.respondingHeader}>
            <VideoView
              player={videoPlayer}
              style={st.headerVideo}
              nativeControls={false}
              contentFit="contain"
              playsInline
            />
            <Text style={st.headerLabel} numberOfLines={1}>AI Coach</Text>
          </View>

          {/* Animated response */}
          <ScrollView
            style={st.scrollArea}
            contentContainerStyle={st.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <AnimatedWords
              text={stripHtml(responseText)}
              style={st.responseText}
              staggerMs={28}
              durationMs={200}
            />
          </ScrollView>
        </Animated.View>

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

  // Thinking state
  thinkingWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
  },
  thinkingVideo: {
    width: 32,
    height: 32,
    backgroundColor: "transparent",
  },
  thinkingText: {
    color: C.sub,
    fontFamily: theme.medium,
    fontSize: 14.5,
  },

  // Responding state
  respondingWrap: {
    flexDirection: "column",
    paddingTop: 12,
    paddingBottom: 14,
  },
  respondingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerVideo: {
    width: 22,
    height: 22,
    backgroundColor: "transparent",
  },
  headerLabel: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: theme.medium,
    fontSize: 11.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    flex: 1,
  },

  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  responseText: {
    color: C.text,
    fontFamily: theme.regular,
    fontSize: 14.5,
    lineHeight: 22,
  },
});
