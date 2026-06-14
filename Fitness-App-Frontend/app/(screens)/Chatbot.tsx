import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, Image, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Platform, Keyboard, ScrollView, Animated, BackHandler,
  Modal, Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { theme } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Paywall } from "@/components/ui/RevenueCat/Paywall";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "@/utils/haptics";
import {
  useChatEngine, loadChatUserData, loadChatDailyCount,
  loadChatSavedMessages, FREE_DAILY_LIMIT, type ChatMessage,
} from "@/hooks/useChatEngine";
import { parseHtmlResponse } from "@/components/ui/Chatbot/ChatRenderer";
import FadeTranslate from "@/components/ui/FadeTranslate";

// ─── Constants ────────────────────────────────────────────────────────────────

const AI_VIDEO = require("@/assets/videos/AI.mp4");
const PROFILE_AVATAR = require("@/assets/avatars/avatar1.jpg");

const GREETING_SUGGESTIONS = [
  { icon: "time-outline",         text: "15 min meals",         color: "#22C55E" },
  { icon: "barbell-outline",      text: "Workout plan",         color: "#EF4444" },
  { icon: "cafe-outline",         text: "Quick breakfast",      color: "#F97316" },
  { icon: "flame-outline",        text: "How to burn calories", color: "#EF4444" },
  { icon: "nutrition-outline",    text: "Healthy snacks",       color: "#22C55E" },
  { icon: "fitness-outline",      text: "Build muscle",         color: "#3B82F6" },
  { icon: "footsteps-outline",    text: "Cardio tips",          color: "#F97316" },
  { icon: "fast-food-outline",    text: "High protein food",    color: "#A855F7" },
  { icon: "scale-outline",        text: "Lose weight plan",     color: "#EC4899" },
  { icon: "body-outline",         text: "Stretching properly",  color: "#14B8A6" },
  { icon: "restaurant-outline",   text: "Meal prep",            color: "#22C55E" },
  { icon: "flash-outline",        text: "Pre-workout tips",     color: "#FBBF24" },
  { icon: "moon-outline",         text: "Recovery tips",        color: "#6366F1" },
  { icon: "water-outline",        text: "Hydration guide",      color: "#0EA5E9" },
  { icon: "hand-right-outline",   text: "Arm workout",          color: "#EF4444" },
] as const;

const GREETING_VARIANTS = [
  "What can I help with?",
  "How can I assist you?",
  "What can I do for you?",
  "How may I help today?",
  "What would you like to know?",
];

// ─── Message entry animation ───────────────────────────────────────────────────

function MessageEntry({ children, isAi }: { children: React.ReactNode; isAi: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 340, useNativeDriver: true }).start();
  }, [anim]);
  if (!isAi) return <>{children}</>;
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
    }}>
      {children}
    </Animated.View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type ChatbotProps = {
  onRequestClose?: () => void;
  initialMessage?: string;
};

export default function Chatbot({ onRequestClose, initialMessage }: ChatbotProps = {}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation() as any;

  const {
    messages, isLoading, sendMessage, toggleSavedMessage,
    savedMessages, savedMessageIds, deleteSavedMessage,
    subscriptionPlan, setSubscriptionPlan, dailyMessageCount,
  } = useChatEngine();

  const [inputText, setInputText] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showSavedMessages, setShowSavedMessages] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [greetingMessage] = useState(
    () => GREETING_VARIANTS[Math.floor(Math.random() * GREETING_VARIANTS.length)],
  );
  const [randomSuggestions] = useState(
    () => [...GREETING_SUGGESTIONS].sort(() => Math.random() - 0.5).slice(0, 4),
  );

  const flatListRef = useRef<FlatList>(null);
  const thinkingOpacity = useRef(new Animated.Value(0.4)).current;
  const seededRef = useRef(false);

  const videoPlayer = useVideoPlayer(AI_VIDEO, (p) => {
    p.loop  = true;
    p.muted = true;
    p.volume = 0;
    p.audioMixingMode = "mixWithOthers";
    if (Platform.OS === "web") p.play();
  });

  // Ensure video plays on focus; load user + daily data
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      videoPlayer.play();
      loadChatUserData();
      loadChatDailyCount();
      loadChatSavedMessages();

      const onBack = () => {
        if (onRequestClose) { onRequestClose(); return true; }
        navigation.navigate("nutrition");
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => { mounted = false; sub.remove(); };
    }, [videoPlayer, onRequestClose, navigation]),
  );

  // Keyboard listeners
  useEffect(() => {
    const show = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hide = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s1 = Keyboard.addListener(show, (e: any) => setKeyboardHeight(e?.endCoordinates?.height ?? 0));
    const s2 = Keyboard.addListener(hide, () => setKeyboardHeight(0));
    return () => { s1.remove(); s2.remove(); };
  }, []);

  // Thinking pulse
  useEffect(() => {
    if (!isLoading) { thinkingOpacity.setValue(0.4); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(thinkingOpacity, { toValue: 1,    duration: 800, useNativeDriver: true }),
        Animated.timing(thinkingOpacity, { toValue: 0.4,  duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => { loop.stop(); thinkingOpacity.setValue(0.4); };
  }, [isLoading, thinkingOpacity]);

  // Auto-seed message (from workout ask bar)
  useEffect(() => {
    const seed = initialMessage?.trim();
    if (seed && !seededRef.current) {
      seededRef.current = true;
      sendMessage(seed, undefined, () => setShowPaywall(true));
    }
  }, [initialMessage, sendMessage]);

  const send = useCallback(async (txt?: string) => {
    const text = (txt ?? inputText).trim();
    if (!text) return;
    setInputText("");
    Keyboard.dismiss();
    await sendMessage(text, undefined, () => setShowPaywall(true));
  }, [inputText, sendMessage]);

  const handleShare = async (msg: ChatMessage) => {
    try { await Share.share({ message: msg.text, title: "AI Response" }); } catch {}
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <MessageEntry isAi={!item.isUser}>
      <View style={[st.msgRow, item.isUser ? st.msgRowUser : st.msgRowAi]}>
        <View style={item.isUser ? st.userBubbleWrap : st.aiBubbleWrap}>
          <View style={[st.bubble, item.isUser ? st.userBubble : st.aiBubble]}>
            {item.isUser ? (
              <Text style={st.msgText}>{item.text}</Text>
            ) : (
              <View style={st.aiContent}>{parseHtmlResponse(item.text || "")}</View>
            )}
          </View>

          {!item.isUser && item.text?.trim() && (
            <View style={st.actions}>
              <TouchableOpacity
                style={st.actionBtn}
                onPress={() => Clipboard.setStringAsync(item.text).catch(() => {})}
                activeOpacity={0.7}
              >
                <Ionicons name="copy-outline" size={16} color="#636366" />
              </TouchableOpacity>
              <TouchableOpacity style={st.actionBtn} onPress={() => handleShare(item)} activeOpacity={0.7}>
                <Ionicons name="share-outline" size={16} color="#636366" />
              </TouchableOpacity>
              <TouchableOpacity style={st.actionBtn} onPress={() => toggleSavedMessage(item)} activeOpacity={0.7}>
                <Ionicons
                  name={savedMessageIds.has(item.id) ? "bookmark" : "bookmark-outline"}
                  size={16}
                  color={savedMessageIds.has(item.id) ? C.primary : "#636366"}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </MessageEntry>
  );

  const isFree = subscriptionPlan === "FREE" || subscriptionPlan === "Free";

  return (
    <>
      <View style={st.container}>
        {/* Top gradient bleed */}
        <LinearGradient
          colors={["rgba(0,0,0,0.95)", "rgba(0,0,0,0.5)", "transparent"]}
          locations={[0, 0.55, 1]}
          style={[StyleSheet.absoluteFill, { height: insets.top + 90, zIndex: 5 }]}
          pointerEvents="none"
        />

        {/* ── Header ── */}
        <View style={[st.header, { paddingTop: insets.top + 8 }]}>
          {/* Back */}
          <TouchableOpacity
            style={st.hBtn}
            onPress={() => onRequestClose ? onRequestClose() : navigation.navigate("nutrition")}
            activeOpacity={0.7}
          >
            <BlurView
              intensity={40} tint="dark"
              experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
              style={st.hBtnBlur}
            >
              <Ionicons name={onRequestClose ? "chevron-down" : "arrow-back"} size={20} color="#AEAEB2" />
            </BlurView>
          </TouchableOpacity>

          {/* Center — plan badge */}
          <TouchableOpacity
            style={[st.planBadge, isFree && st.planBadgeFree]}
            onPress={() => isFree && setShowPaywall(true)}
            activeOpacity={isFree ? 0.75 : 1}
          >
            <Ionicons name="sparkles" size={12} color={C.primary} />
            {isFree ? (
              <View style={{ alignItems: "center" }}>
                <Text style={st.planText}>{`${FREE_DAILY_LIMIT - dailyMessageCount}/${FREE_DAILY_LIMIT} left`}</Text>
                <Text style={st.planSub}>Get Unlimited</Text>
              </View>
            ) : (
              <Text style={st.planText}>Unlimited</Text>
            )}
          </TouchableOpacity>

          {/* Saved */}
          <TouchableOpacity
            style={st.hBtn}
            onPress={async () => { await loadChatSavedMessages(); setShowSavedMessages(true); }}
            activeOpacity={0.7}
          >
            <BlurView
              intensity={40} tint="dark"
              experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
              style={st.hBtnBlur}
            >
              <Ionicons name="bookmark-outline" size={20} color="#AEAEB2" />
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* ── Messages ── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            st.listContent,
            {
              paddingTop: insets.top + 84,
              paddingBottom: insets.bottom + 100 + (Platform.OS === "ios" ? keyboardHeight : 0),
            },
          ]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onScrollEndDrag={
            onRequestClose
              ? (e) => { if (e.nativeEvent.contentOffset.y <= -70) onRequestClose(); }
              : undefined
          }
          showsVerticalScrollIndicator={false}

          ListEmptyComponent={
            <View style={st.emptyWrap}>
              <FadeTranslate order={0}>
                <VideoView
                  player={videoPlayer}
                  style={st.greetingVideo}
                  nativeControls={false}
                  contentFit="contain"
                  playsInline
                />
              </FadeTranslate>
              <FadeTranslate order={1}>
                <Text style={st.greetingText}>{greetingMessage}</Text>
              </FadeTranslate>
              <View style={st.suggestionsGrid}>
                {randomSuggestions.map((s, i) => (
                  <FadeTranslate key={i} order={i + 2}>
                    <TouchableOpacity
                      onPress={() => send(s.text)}
                      activeOpacity={0.75}
                      style={[st.suggestion, { borderColor: s.color + "30", backgroundColor: s.color + "10" }]}
                    >
                      <Ionicons name={s.icon as any} size={16} color={s.color} />
                      <Text style={st.suggestionText}>{s.text}</Text>
                    </TouchableOpacity>
                  </FadeTranslate>
                ))}
              </View>
            </View>
          }

          ListFooterComponent={
            isLoading ? (
              <View style={st.loadingRow}>
                <VideoView
                  player={videoPlayer}
                  style={st.loadingVideo}
                  nativeControls={false}
                  contentFit="contain"
                  allowsPictureInPicture={false}
                />
                <Animated.Text style={[st.loadingText, { opacity: thinkingOpacity }]}>
                  Thinking…
                </Animated.Text>
              </View>
            ) : null
          }
        />

        {/* ── Input bar ── */}
        <View
          style={[
            st.inputWrap,
            Platform.OS === "ios"
              ? { bottom: keyboardHeight, paddingBottom: keyboardHeight > 0 ? 10 : insets.bottom + 12 }
              : { paddingBottom: insets.bottom + 12 },
          ]}
        >
          <View style={st.askBar}>
            <TouchableOpacity
              style={st.askAvatar}
              onPress={() => { onRequestClose?.(); router.push("/profile"); }}
              activeOpacity={0.8}
            >
              <Image source={PROFILE_AVATAR} style={st.askAvatarImg} />
            </TouchableOpacity>

            <TextInput
              style={st.askInput}
              placeholder="Ask me anything…"
              placeholderTextColor="#636366"
              value={inputText}
              onChangeText={setInputText}
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={() => send()}
              underlineColorAndroid="transparent"
            />

            <TouchableOpacity
              style={[st.sendBtn, !inputText.trim() && st.sendBtnDisabled]}
              onPress={() => send()}
              disabled={!inputText.trim() || isLoading}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isLoading ? "stop" : "arrow-up"}
                size={18}
                color="#000"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Saved messages sheet ── */}
      <Modal
        visible={showSavedMessages}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSavedMessages(false)}
      >
        <View style={st.sheetBg}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSavedMessages(false)} />
          <View style={st.sheet}>
            <View style={st.sheetHandle} />
            <View style={st.sheetHeader}>
              <Text style={st.sheetTitle}>Saved</Text>
              <TouchableOpacity
                onPress={() => setShowSavedMessages(false)}
                style={st.sheetClose}
              >
                <Ionicons name="close" size={18} color="#AEAEB2" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={savedMessages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={st.sheetList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={st.savedCard}>
                  <View style={st.aiContent}>{parseHtmlResponse(item.messageText)}</View>
                  <View style={st.savedMeta}>
                    <Text style={st.savedDate}>
                      {new Date(item.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Text>
                    <View style={st.savedActions}>
                      <TouchableOpacity
                        style={st.actionBtn}
                        onPress={() => Clipboard.setStringAsync(item.messageText).catch(() => {})}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="copy-outline" size={16} color="#636366" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={st.actionBtn}
                        onPress={() => Share.share({ message: item.messageText }).catch(() => {})}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="share-outline" size={16} color="#636366" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={st.actionBtn}
                        onPress={() => deleteSavedMessage(item.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={16} color="#FF453A" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={st.emptySheet}>
                  <Ionicons name="bookmark-outline" size={44} color="#2C2C2E" />
                  <Text style={st.emptySheetTitle}>No saved messages</Text>
                  <Text style={st.emptySheetSub}>Save messages to revisit them here</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPurchaseCompleted={() => { setShowPaywall(false); setSubscriptionPlan("PRO"); }}
        onRestoreCompleted={() => { setShowPaywall(false); setSubscriptionPlan("PRO"); }}
      />
    </>
  );
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:      "#000000",
  card:    "#1C1C1E",
  cardAlt: "#242426",
  border:  "#2C2C2E",
  primary: "#AAFB05",
  deep:    "#062B0A",
  text:    "#FFFFFF",
  sub:     "#8E8E93",
  muted:   "#48484A",
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, overflow: "hidden" },

  // ── Header ──
  header: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 12,
  },
  hBtn: {
    width: 44, height: 44, borderRadius: 22, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  hBtnBlur: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  planBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 22, backgroundColor: C.deep,
    borderWidth: 1, borderColor: "rgba(170,251,5,0.28)",
    minHeight: 40,
  },
  planBadgeFree: { flexDirection: "column", gap: 1, paddingVertical: 6 },
  planText: { fontSize: 13, fontFamily: theme.medium, color: C.primary },
  planSub:  { fontSize: 10, fontFamily: theme.medium, color: C.primary, opacity: 0.75 },

  // ── Messages ──
  listContent: {
    paddingHorizontal: 16, flexGrow: 1,
    maxWidth: 768, width: "100%", alignSelf: "center" as const,
  },
  msgRow: { flexDirection: "row", marginBottom: 22, width: "100%" },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAi:   { justifyContent: "flex-start" },
  userBubbleWrap: { maxWidth: "82%" },
  aiBubbleWrap: { flex: 1, maxWidth: "100%" },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22 },
  userBubble: {
    backgroundColor: "#232325",
    borderBottomRightRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  aiBubble: { backgroundColor: "transparent", paddingHorizontal: 0, paddingVertical: 0 },
  msgText: { fontSize: 15, fontFamily: theme.regular, color: C.text, lineHeight: 22 },
  aiContent: { flexDirection: "column" as const, gap: 6 },

  actions: { flexDirection: "row", gap: 4, marginTop: 10, paddingLeft: 2 },
  actionBtn: {
    padding: 7, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },

  // ── Loading ──
  loadingRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, gap: 10,
  },
  loadingVideo: { width: 26, height: 26, backgroundColor: "transparent" },
  loadingText: { fontSize: 15, fontFamily: theme.medium, color: C.sub },

  // ── Empty / greeting ──
  emptyWrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 80, paddingHorizontal: 20,
  },
  greetingVideo: { width: 160, height: 160, marginBottom: 18, backgroundColor: "transparent" },
  greetingText: {
    fontSize: 26, fontFamily: theme.semibold, color: C.text,
    textAlign: "center", marginBottom: 28, letterSpacing: -0.5,
  },
  suggestionsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "center", gap: 10,
    maxWidth: 600, alignSelf: "center" as const,
  },
  suggestion: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 24, borderWidth: 1,
  },
  suggestionText: { fontSize: 14, fontFamily: theme.medium, color: "#E5E5EA" },

  // ── Input bar ──
  inputWrap: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 10,
    zIndex: 100,
  },
  askBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    width: "100%", maxWidth: 600, alignSelf: "center" as const,
    height: 54, paddingLeft: 6, paddingRight: 6,
    borderRadius: 27, backgroundColor: "#17191B",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  askAvatar: {
    width: 42, height: 42, borderRadius: 21,
    overflow: "hidden", backgroundColor: "#161618",
  },
  askAvatarImg: { width: "100%", height: "100%" },
  askInput: {
    flex: 1, color: C.text, fontFamily: theme.regular,
    fontSize: 14.5, paddingVertical: 0,
    textAlignVertical: "center",
  } as any,
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#3A3A3C" },

  // ── Saved sheet ──
  sheetBg: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    height: "85%", backgroundColor: C.card,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderWidth: 1, borderColor: C.border,
    paddingTop: 8, maxWidth: 768, width: "100%", alignSelf: "center" as const,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: C.border, alignSelf: "center" as const, marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, paddingBottom: 18,
  },
  sheetTitle: { fontSize: 22, fontFamily: theme.semibold, color: C.text },
  sheetClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#242426", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.border,
  },
  sheetList: { padding: 20, paddingTop: 8 },
  savedCard: {
    marginBottom: 10, borderRadius: 16, padding: 16,
    backgroundColor: "#242426", borderWidth: 1, borderColor: C.border,
  },
  savedMeta: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginTop: 12,
  },
  savedDate: { fontSize: 12, fontFamily: theme.regular, color: C.muted },
  savedActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  emptySheet: {
    alignItems: "center", paddingTop: 80, gap: 8,
  },
  emptySheetTitle: { fontSize: 17, fontFamily: theme.semibold, color: C.sub },
  emptySheetSub: { fontSize: 14, fontFamily: theme.regular, color: C.muted },
});
