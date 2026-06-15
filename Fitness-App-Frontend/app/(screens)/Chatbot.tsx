import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image,
  FlatList, Platform, Keyboard, Animated, BackHandler, Easing,
  Modal, Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import PlatformBlur from "@/components/ui/PlatformBlur";
import { theme } from "@/constants/theme";
import { User } from "@/models/User";
import database from "@/database/database";
import { useFocusEffect } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Paywall } from "@/components/ui/RevenueCat/Paywall";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useChatEngine, loadChatUserData, loadChatDailyCount,
  loadChatSavedMessages, FREE_DAILY_LIMIT, type ChatMessage,
  buildUserContext, buildWorkoutContext, buildNutritionContext,
} from "@/hooks/useChatEngine";
import { parseHtmlResponse } from "@/components/ui/Chatbot/ChatRenderer";
import FadeTranslate from "@/components/ui/FadeTranslate";
import { useProfilePicture } from "@/utils/profilePicture";

const DEFAULT_AVATAR = require("@/assets/avatars/avatar1.jpg");

// ─── Constants ────────────────────────────────────────────────────────────────

const AI_VIDEO = require("@/assets/videos/AI.mp4");

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

const CONTEXT_OPTIONS = [
  {
    key: "user" as const,
    icon: "person-outline",
    label: "Your stats",
    description: "Goals, body metrics, and fitness level",
  },
  {
    key: "workout" as const,
    icon: "barbell-outline",
    label: "This week's workouts",
    description: "Routine names and muscles trained this week",
  },
  {
    key: "nutrition" as const,
    icon: "nutrition-outline",
    label: "Nutrition",
    description: "This week's meal names, daily calories, and calorie plan",
  },
] as const;

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
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [contextFlags, setContextFlags] = useState({ user: false, workout: false, nutrition: false });
  const [userName, setUserName] = useState("");
  const profilePicUri = useProfilePicture();
  const [greetingMessage] = useState(
    () => GREETING_VARIANTS[Math.floor(Math.random() * GREETING_VARIANTS.length)],
  );
  const [randomSuggestions] = useState(
    () => [...GREETING_SUGGESTIONS].sort(() => Math.random() - 0.5).slice(0, 4),
  );

  const flatListRef = useRef<FlatList>(null);
  const thinkingOpacity = useRef(new Animated.Value(0.4)).current;
  const contextPickerAnim = useRef(new Animated.Value(0)).current;
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
      User.getUserDetails(database)
        .then((u) => { if (mounted && u?.name) setUserName(u.name.split(" ")[0]); })
        .catch(() => {});

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

  useEffect(() => {
    contextPickerAnim.stopAnimation();
    const animation = Animated.timing(contextPickerAnim, {
      toValue: showContextPicker ? 1 : 0,
      duration: showContextPicker ? 220 : 150,
      easing: showContextPicker ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [showContextPicker, contextPickerAnim]);

  const closeContextPicker = useCallback(() => {
    setShowContextPicker(false);
  }, []);

  const toggleContextPicker = useCallback(() => {
    setShowContextPicker((visible) => !visible);
  }, []);

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

    // Build explicit context from whatever the user has toggled on.
    const parts: string[] = [];
    if (contextFlags.user)      parts.push(await buildUserContext());
    if (contextFlags.workout)   parts.push(await buildWorkoutContext());
    if (contextFlags.nutrition) parts.push(await buildNutritionContext());
    const ctx = parts.filter(Boolean).join("\n\n");

    // Pass ctx (even empty string) so auto-detect is skipped in the Chatbot screen.
    await sendMessage(text, undefined, () => setShowPaywall(true), ctx);
  }, [inputText, sendMessage, contextFlags]);

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
  // iOS never auto-resizes for the keyboard; on Android the askbar *overlay*
  // (onRequestClose set) is an absolute full-screen layer that also ignores the
  // window resize, so in both cases we lift the input manually. The standalone
  // chatbot *tab* relies on Android's native adjustResize instead.
  const liftForKeyboard = Platform.OS === "ios" || !!onRequestClose;
  const kbPad = liftForKeyboard ? keyboardHeight : 0;

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
          {/* Left — close + context text */}
          <View style={st.hLeftGroup}>
            <TouchableOpacity
              style={st.hBtn}
              onPress={() => onRequestClose ? onRequestClose() : navigation.navigate("nutrition")}
              activeOpacity={0.7}
            >
              <PlatformBlur intensity={40} tint="dark" androidColor="rgba(26,26,28,0.92)" style={st.hBtnBlur}>
                <Ionicons name={onRequestClose ? "chevron-down" : "grid-outline"} size={19} color="#AEAEB2" />
              </PlatformBlur>
            </TouchableOpacity>

            <TouchableOpacity
              style={st.ctxTextBtn}
              onPress={toggleContextPicker}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={st.ctxText}>
                <Text style={st.ctxInclude}>Include </Text>
                <Text style={(contextFlags.user || contextFlags.workout || contextFlags.nutrition) && { color: C.primary }}>
                  Context
                </Text>
              </Text>
              <Ionicons
                name={showContextPicker ? "chevron-up" : "chevron-down"}
                size={11}
                color={(contextFlags.user || contextFlags.workout || contextFlags.nutrition) ? C.primary : "#48484A"}
              />
            </TouchableOpacity>
          </View>

          {/* Right — bookmark */}
          <TouchableOpacity
            style={st.hBtn}
            onPress={async () => { await loadChatSavedMessages(); setShowSavedMessages(true); }}
            activeOpacity={0.7}
          >
            <PlatformBlur intensity={40} tint="dark" androidColor="rgba(26,26,28,0.92)" style={st.hBtnBlur}>
              <Ionicons name="bookmark-outline" size={19} color="#AEAEB2" />
            </PlatformBlur>
          </TouchableOpacity>
        </View>

        {/* ── Context dropdown (inline, no sheet) ── */}
        <Animated.View
          pointerEvents={showContextPicker ? "auto" : "none"}
          style={[
            st.ctxDropdown,
            {
              top: insets.top + 58,
              opacity: contextPickerAnim,
              transform: [{
                translateY: contextPickerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              }],
            },
          ]}
        >
          <View style={st.ctxOptions}>
            {CONTEXT_OPTIONS.map((item) => {
              const on = contextFlags[item.key];
              return (
                <TouchableOpacity
                  key={item.key}
                  style={st.dropRow}
                  onPress={() => setContextFlags((f) => ({ ...f, [item.key]: !f[item.key] }))}
                  activeOpacity={0.55}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={on ? C.primary : "#AEAEB2"}
                  />
                  <View style={st.dropCopy}>
                    <Text style={[st.dropLabel, on && st.dropLabelSelected]}>{item.label}</Text>
                    <Text style={st.dropDescription}>{item.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

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
              paddingBottom: insets.bottom + (isFree ? 190 : 150) + kbPad,
            },
          ]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onScrollBeginDrag={closeContextPicker}
          onScrollEndDrag={
            onRequestClose
              ? (e) => { if (e.nativeEvent.contentOffset.y <= -70) onRequestClose(); }
              : undefined
          }
          showsVerticalScrollIndicator={false}

          ListEmptyComponent={
            <View style={st.emptyWrap}>
              <FadeTranslate order={0}>
                <Text style={st.greetHi}>Hello {userName || "Athlete"}!</Text>
              </FadeTranslate>
              <FadeTranslate order={1}>
                <Text style={st.greetQuestion}>{greetingMessage}</Text>
              </FadeTranslate>
              <FadeTranslate order={2}>
                <VideoView
                  player={videoPlayer}
                  style={st.greetingVideo}
                  nativeControls={false}
                  contentFit="contain"
                  playsInline
                />
              </FadeTranslate>
              <View style={st.suggestionsGrid}>
                {randomSuggestions.map((s, i) => (
                  <FadeTranslate key={i} order={i + 3}>
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
            {
              bottom: kbPad,
              paddingBottom: kbPad > 0 ? 10 : insets.bottom + 12,
            },
          ]}
        >
          <View style={st.composerSurface}>
            {isFree && (
              <TouchableOpacity
                style={st.statusRow}
                activeOpacity={0.72}
                onPress={() => setShowPaywall(true)}
              >
                <View style={st.statusLeft}>
                  <View style={st.statusDot} />
                  <Text style={st.statusText}>
                    {Math.max(FREE_DAILY_LIMIT - dailyMessageCount, 0)}/{FREE_DAILY_LIMIT} messages left
                  </Text>
                </View>
                <Text style={st.statusCta}>Get Unlimited</Text>
              </TouchableOpacity>
            )}

            <View style={st.askBar}>
              <View style={st.avatarBtn}>
                <Image
                  source={profilePicUri ? { uri: profilePicUri } : DEFAULT_AVATAR}
                  style={st.avatarBtnImg}
                />
              </View>

              <TextInput
                style={st.askInput}
                placeholder="What can I help you with?"
                placeholderTextColor="#636366"
                value={inputText}
                onChangeText={setInputText}
                maxLength={1000}
                returnKeyType="send"
                onSubmitEditing={() => send()}
                onFocus={closeContextPicker}
                underlineColorAndroid="transparent"
              />

              <TouchableOpacity
                style={[st.sendBtn, !inputText.trim() && st.sendBtnIdle]}
                onPress={() => send()}
                disabled={!inputText.trim() || isLoading}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={inputText.trim() ? "#000" : "#AEAEB2"}
                />
              </TouchableOpacity>
            </View>
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
  hLeftGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  hBtn: {
    width: 44, height: 44, borderRadius: 22, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  hBtnBlur: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  ctxTextBtn: {
    minHeight: 44,
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, marginLeft: -8,
  },
  ctxText: { fontFamily: theme.medium, fontSize: 14, color: "#636366" },
  ctxInclude: { fontFamily: theme.bold, color: "#FFFFFF" },
  ctxDropdown: {
    position: "absolute", left: 20, right: 20, zIndex: 200,
    maxWidth: 380,
    backgroundColor: "#171719",
    borderWidth: 1,
    borderColor: "#343437",
    borderRadius: 18,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  ctxOptions: { gap: 2 },
  dropRow: {
    minHeight: 58,
    flexDirection: "row", alignItems: "center", gap: 13,
    paddingHorizontal: 4, paddingVertical: 7,
  },
  dropCopy: { flex: 1 },
  dropLabel: { fontFamily: theme.semibold, fontSize: 14, color: "#FFFFFF" },
  dropLabelSelected: { color: C.primary },
  dropDescription: {
    fontFamily: theme.regular, fontSize: 11.5, lineHeight: 16,
    color: "#7A7A7E", marginTop: 1,
  },

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

  actions: { flexDirection: "row", gap: 2, marginTop: 10, paddingLeft: 2 },
  actionBtn: { padding: 7 },

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
    paddingVertical: 60, paddingHorizontal: 20,
  },
  greetHi: {
    fontSize: 17, fontFamily: theme.medium, color: C.sub,
    textAlign: "center", marginBottom: 6,
  },
  greetQuestion: {
    fontSize: 28, fontFamily: theme.bold, color: C.text,
    textAlign: "center", marginBottom: 8, letterSpacing: -0.6, lineHeight: 34,
    paddingHorizontal: 10,
  },
  greetingVideo: { width: 190, height: 190, marginVertical: 14, backgroundColor: "transparent" },
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
  composerSurface: {
    width: "100%", maxWidth: 600, alignSelf: "center" as const,
    paddingHorizontal: 6, paddingTop: 6, paddingBottom: 7,
    borderRadius: 27,
    backgroundColor: "#17191B",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  statusRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 10, paddingTop: 4, paddingBottom: 9,
    marginHorizontal: 3, marginBottom: 2,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
  statusText: { fontSize: 12, fontFamily: theme.medium, color: C.sub },
  statusCta: { fontSize: 12, fontFamily: theme.semibold, color: C.primary },
  askBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    width: "100%", height: 48,
    paddingLeft: 0, paddingRight: 0,
  },
  avatarBtn: {
    width: 42, height: 42, borderRadius: 21, overflow: "hidden",
    backgroundColor: "#2C2C2E",
  },
  avatarBtnImg: { width: 42, height: 42, borderRadius: 21 },
  askInput: {
    flex: 1, color: C.text, fontFamily: theme.regular,
    fontSize: 14.5, paddingVertical: 0, paddingHorizontal: 6,
    textAlignVertical: "center",
  } as any,
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
  },
  sendBtnIdle: { backgroundColor: "rgba(255,255,255,0.08)" },

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
