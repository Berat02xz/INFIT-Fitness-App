import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Pressable, ScrollView, Image, Dimensions,
  StyleSheet, Animated, Easing, Keyboard, ActivityIndicator, Alert,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import { theme } from "@/constants/theme";
import { ExerciseApi, type ExerciseInfo } from "@/api/ExerciseApi";
import { searchFoods, type FoodItem } from "@/constants/foods";
import { Meal } from "@/models/Meals";
import database from "@/database/database";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import { useTabBarVisibility } from "@/components/ui/TabBarUi/TabBarVisibility";
import { useAskBarRegister, useBumpMeals } from "./AskBarContext";
import { haptics } from "@/utils/haptics";
import { useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { AIEndpoint } from "@/api/AIEndpoint";
import ScanIsland from "./ScanIsland";
import Chatbot from "@/app/(screens)/Chatbot";

const { width: SCREEN_W } = Dimensions.get("window");
const H_PAD = 18;
const MAX_RESULTS = 30;
const PULL_TO_CHAT = 130;
const AVATAR = require("@/assets/avatars/avatar1.jpg");

const C = { bg: "#000", primary: "#AAFB05", text: "#fff", sub: "#8E8E93", pill: "#17191B" };

type Tab = "workout" | "nutrition" | "profile";

type MealScanResult = {
  isMeal: boolean;
  ShortMealName: string;
  CaloriesAmount: number;
  Protein: number;
  Carbs: number;
  Fat: number;
  MealQuality: string;
  HealthScoreOutOf10: number;
  OneEmoji: string;
};

const ASK_PHRASES: Record<Tab, string[]> = {
  workout: ["Search or ask anything…", "Create your own routine", "Ask your AI coach", "Find an exercise"],
  nutrition: ["Search food or ask…", "What should I eat?", "Add a meal by name", "Ask your AI coach"],
  profile: ["Ask anything…", "Ask your AI coach", "Get a tip"],
};

function RotatingPlaceholder({ phrases, paused }: { phrases: string[]; paused: boolean }) {
  const [idx, setIdx] = useState(0);
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => { setIdx(0); }, [phrases]);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      Animated.timing(anim, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
        setIdx((i) => (i + 1) % phrases.length);
        Animated.timing(anim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      });
    }, 3200);
    return () => clearInterval(id);
  }, [paused, anim, phrases.length]);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: "center" }]}>
      <Animated.Text numberOfLines={1} style={[st.placeholder, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }]}>
        {phrases[idx]}
      </Animated.Text>
    </Animated.View>
  );
}

function ExerciseResult({ ex, onPress }: { ex: ExerciseInfo; onPress: () => void }) {
  const focus = ex.targetMuscles?.[0] ?? ex.bodyParts?.[0] ?? "Strength";
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  return (
    <TouchableOpacity style={st.row} activeOpacity={0.8} onPress={onPress}>
      <View style={st.rowThumb}>
        {ex.gifUrl ? <Image source={{ uri: ex.gifUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : <Ionicons name="barbell-outline" size={22} color={C.sub} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.rowName} numberOfLines={1}>{cap(ex.name)}</Text>
        <Text style={st.rowMeta} numberOfLines={1}>{cap(focus)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );
}

function FoodResult({ food, onAdd }: { food: FoodItem; onAdd: () => void }) {
  return (
    <TouchableOpacity style={st.row} activeOpacity={0.8} onPress={onAdd}>
      <View style={st.rowEmoji}><Text style={{ fontSize: 26 }}>{food.emoji}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.rowName} numberOfLines={1}>{food.name}</Text>
        <Text style={st.rowMeta} numberOfLines={1}>{food.calories} kcal · P{food.protein} C{food.carbs} F{food.fats}</Text>
      </View>
      <View style={st.addBtn}><Ionicons name="add" size={20} color="#000" /></View>
    </TouchableOpacity>
  );
}

export default function AskBar({ activeTab }: { activeTab: string }) {
  const insets = useSafeAreaInsets();
  const { setHidden } = useTabBarVisibility();
  const bumpMeals = useBumpMeals();

  const tab = (["workout", "nutrition", "profile"].includes(activeTab) ? activeTab : "workout") as Tab;
  const HEADER_H = insets.top + 70;
  const GLOW_H = HEADER_H + 90;

  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [exPool, setExPool] = useState<ExerciseInfo[]>([]);
  const [poolReady, setPoolReady] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatSeed, setChatSeed] = useState<string | undefined>(undefined);
  const [celebrate, setCelebrate] = useState(0);
  const [scanState, setScanState] = useState<"idle" | "camera" | "scanning">("idle");
  const [permission, requestPermission] = useCameraPermissions();

  const barStretch = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const focusGlow = useRef(new Animated.Value(0)).current;
  const chatAnim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const scanPillAnim = useRef(new Animated.Value(0)).current;
  const drift1 = useRef(new Animated.Value(0)).current;
  const drift2 = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const isTyping = text.trim().length > 0;
  const isFood = tab === "nutrition";

  // Clear search when switching tabs
  useEffect(() => { setText(""); Keyboard.dismiss(); }, [tab]);

  // Warm exercise pool (workout search + nothing else needs it)
  useEffect(() => {
    let cancelled = false;
    const unsub = ExerciseApi.onExercises((ex) => { if (!cancelled) setExPool(ex); });
    ExerciseApi.getAllExercises().catch(() => {}).finally(() => { if (!cancelled) setPoolReady(true); });
    return () => { cancelled = true; unsub(); };
  }, []);

  // Slow drift of the AI glow blobs so the colors keep gently moving.
  useEffect(() => {
    const loop = (v: Animated.Value, dur: number) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
    const a = loop(drift1, 3800);
    const b = loop(drift2, 5200);
    a.start(); b.start();
    return () => { a.stop(); b.stop(); };
  }, [drift1, drift2]);

  const enterChat = useCallback((seed?: string) => {
    const trimmed = seed?.trim();
    setChatSeed(trimmed || undefined);
    setChatVisible(true);
    setHidden(true);
    Keyboard.dismiss();
    setText("");
    haptics.light();
    chatAnim.setValue(0);
    Animated.timing(chatAnim, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [chatAnim, setHidden]);

  const exitChat = useCallback(() => {
    setHidden(false);
    Animated.timing(chatAnim, { toValue: 0, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) { setChatVisible(false); setChatSeed(undefined); }
    });
  }, [chatAnim, setHidden]);

  // ── Meal scan: the bar expands into a camera, snaps a photo, then collapses
  //    to a "Scanning meal…" pill while the AI analyses + logs the meal. ──
  const runScan = useCallback(async (uri: string) => {
    try {
      const manip = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      const userId = await getUserIdFromToken();
      if (!userId) throw new Error("No user");
      const res = (await Promise.race([
        AIEndpoint.uploadMeal(userId, { uri: manip.uri, name: `meal_${Date.now()}.jpg`, type: "image/jpeg" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 25000)),
      ])) as MealScanResult;
      if (!res) throw new Error("No response");
      await Meal.createMeal(database, {
        userId,
        mealName: res.ShortMealName,
        calories: res.CaloriesAmount,
        protein: res.Protein,
        carbohydrates: res.Carbs,
        fats: res.Fat,
        label: res.MealQuality,
        createdAt: Date.now(),
        healthScore: res.HealthScoreOutOf10,
        oneEmoji: res.OneEmoji,
      });
      bumpMeals();
      haptics.success();
      setCelebrate((c) => c + 1);
    } catch (e) {
      console.log("scan error", e);
      Alert.alert("Scan failed", "Couldn't analyze that meal. Please try again.");
    } finally {
      Animated.timing(scanPillAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setScanState("idle");
      });
    }
  }, [bumpMeals, scanPillAnim]);

  const openScan = useCallback(() => {
    if (scanState !== "idle") return;
    Keyboard.dismiss();
    setText("");
    haptics.light();
    setScanState("camera");
    scanAnim.setValue(0);
    Animated.timing(scanAnim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    if (!permission?.granted) requestPermission();
  }, [scanState, scanAnim, permission, requestPermission]);

  const closeScan = useCallback(() => {
    Animated.timing(scanAnim, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
      if (finished) setScanState("idle");
    });
  }, [scanAnim]);

  const onScanCapture = useCallback((uri: string) => {
    Animated.timing(scanAnim, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
      if (!finished) return;
      setScanState("scanning");
      scanPillAnim.setValue(0);
      Animated.timing(scanPillAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      runScan(uri);
    });
  }, [scanAnim, scanPillAnim, runScan]);

  // Screens drive these via context (overscroll → grow + open chat)
  useAskBarRegister(useMemo(() => ({
    onScroll: (y: number) => { barStretch.setValue(y < 0 ? Math.min(-y, 170) : 0); },
    onEndDrag: (y: number) => { if (!chatVisible && y <= -PULL_TO_CHAT) enterChat(); },
  }), [barStretch, chatVisible, enterChat]));

  const onFocus = () => {
    setFocused(true);
    haptics.selection();
    Animated.sequence([
      Animated.timing(pressScale, { toValue: 1.03, duration: 90, useNativeDriver: false }),
      Animated.spring(pressScale, { toValue: 1, friction: 6, tension: 140, useNativeDriver: false }),
    ]).start();
    Animated.timing(focusGlow, { toValue: 1, duration: 220, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(focusGlow, { toValue: 0, duration: 260, useNativeDriver: false }).start();
  };

  const addFood = useCallback(async (food: FoodItem) => {
    try {
      const userId = await getUserIdFromToken();
      if (!userId) return;
      await Meal.createMeal(database, {
        userId, mealName: food.name, calories: food.calories, protein: food.protein,
        carbohydrates: food.carbs, fats: food.fats, label: "quick-add",
        createdAt: Date.now(), healthScore: 0, oneEmoji: food.emoji,
      });
      bumpMeals();
      setText("");
      Keyboard.dismiss();
      haptics.success();
      setCelebrate((c) => c + 1);
    } catch (e) { console.error(e); }
  }, [bumpMeals]);

  const openExercise = useCallback((ex: ExerciseInfo) => {
    Keyboard.dismiss();
    setText("");
    router.push({
      pathname: "/ExerciseDetail",
      params: { exerciseId: ex.exerciseId, name: ex.name, sets: "3", reps: "12", restSeconds: "60", category: ex.targetMuscles?.[0] ?? ex.bodyParts?.[0] ?? "Strength", gifUrl: ex.gifUrl ?? "" },
    });
  }, []);

  // Search results
  const exerciseResults = useMemo(() => {
    if (isFood || !isTyping) return [];
    const q = text.trim().toLowerCase();
    const seen = new Set<string>();
    const out: ExerciseInfo[] = [];
    for (const ex of exPool) {
      if (seen.has(ex.exerciseId)) continue;
      if (ex.name.toLowerCase().includes(q) || ex.targetMuscles.some((m) => m.toLowerCase().includes(q)) || ex.bodyParts.some((b) => b.toLowerCase().includes(q))) {
        seen.add(ex.exerciseId); out.push(ex);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [isFood, isTyping, text, exPool]);

  const foodResults = useMemo(() => (isFood && isTyping ? searchFoods(text) : []), [isFood, isTyping, text]);

  // ── Animated styles ──
  const askBarHeight = barStretch.interpolate({ inputRange: [0, 170], outputRange: [54, 150], extrapolate: "clamp" });
  const askBarRadius = barStretch.interpolate({ inputRange: [0, 170], outputRange: [27, 38], extrapolate: "clamp" });
  // Glow is fully invisible at rest — it only appears while overscrolling (the
  // bar growing) or when the input is focused for typing.
  const glowOpacity = Animated.add(
    barStretch.interpolate({ inputRange: [0, 160], outputRange: [0, 1], extrapolate: "clamp" }),
    focusGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" })
  );
  const driftAX = drift1.interpolate({ inputRange: [0, 1], outputRange: [-26, 26] });
  const driftBX = drift2.interpolate({ inputRange: [0, 1], outputRange: [22, -22] });
  const chatScaleY = chatAnim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] });
  const chatScaleX = chatAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const chatContentOpacity = chatAnim.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.15, 1] });
  const CHAT_ORIGIN_Y = insets.top + 10 + 27;

  const showResults = isTyping && (isFood ? foodResults.length >= 0 : true);
  const placeholderPhrases = ASK_PHRASES[tab];

  return (
    <>
      {/* Search results panel (workout exercises / nutrition foods) */}
      {showResults && (
        <View style={[st.resultsPanel, { top: HEADER_H + 6, paddingBottom: insets.bottom + 100 }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: H_PAD, gap: 10 }}>
            {isFood
              ? foodResults.map((f) => <FoodResult key={f.id} food={f} onAdd={() => addFood(f)} />)
              : exerciseResults.map((ex) => <ExerciseResult key={ex.exerciseId} ex={ex} onPress={() => openExercise(ex)} />)}
            {((isFood && foodResults.length === 0) || (!isFood && exerciseResults.length === 0 && exPool.length === 0)) && (
              <View style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
                {!isFood && exPool.length === 0 ? <ActivityIndicator color={C.primary} /> : null}
                <Text style={st.hint}>{isFood ? "Type a food, meal or emoji" : "Loading exercises…"}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* The bar */}
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <LinearGradient colors={["rgba(0,0,0,0.9)", "rgba(0,0,0,0.5)", "transparent"]} locations={[0, 0.62, 1]} style={[StyleSheet.absoluteFill, { height: HEADER_H + 24 }]} pointerEvents="none" />

        {/* AI glow — soft colorful light, brightest at the top, fading to nothing
            below the bar. Two radial blobs drift slowly so the colors keep moving.
            Hidden at rest; shown while overscrolling or focused. */}
        <Animated.View pointerEvents="none" style={[st.glow, { height: GLOW_H, opacity: glowOpacity }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: driftAX }] }]}>
            <Svg width={SCREEN_W} height={GLOW_H}>
              <Defs>
                <RadialGradient id="askGlowA" cx="30%" cy="0%" r="82%">
                  <Stop offset="0" stopColor="#AAFB05" stopOpacity={0.85} />
                  <Stop offset="0.5" stopColor="#00D4FF" stopOpacity={0.32} />
                  <Stop offset="1" stopColor="#00D4FF" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width={SCREEN_W} height={GLOW_H} fill="url(#askGlowA)" />
            </Svg>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: driftBX }] }]}>
            <Svg width={SCREEN_W} height={GLOW_H}>
              <Defs>
                <RadialGradient id="askGlowB" cx="74%" cy="6%" r="82%">
                  <Stop offset="0" stopColor="#A24BFF" stopOpacity={0.80} />
                  <Stop offset="0.5" stopColor="#FF4B96" stopOpacity={0.30} />
                  <Stop offset="1" stopColor="#FF4B96" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width={SCREEN_W} height={GLOW_H} fill="url(#askGlowB)" />
            </Svg>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[st.askBar, { height: askBarHeight, borderRadius: askBarRadius, transform: [{ scale: pressScale }] }]}>
          <TouchableOpacity style={st.avatar} activeOpacity={0.8} onPress={() => router.push("/profile")} accessibilityLabel="Open profile">
            <Image source={AVATAR} style={{ width: "100%", height: "100%" }} />
          </TouchableOpacity>

          <Pressable style={{ flex: 1, minWidth: 0, justifyContent: "center", alignSelf: "stretch" }} onPress={() => inputRef.current?.focus()}>
            <TextInput
              ref={inputRef}
              style={st.input}
              placeholder=""
              value={text}
              onChangeText={setText}
              onFocus={onFocus}
              onBlur={onBlur}
              onSubmitEditing={() => { const q = text.trim(); if (q) enterChat(q); }}
              returnKeyType="search"
              autoCorrect={false}
              selectionColor={C.primary}
            />
            {text.length === 0 && (
              !poolReady && tab === "workout" ? (
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: "center" }]}>
                  <Text style={st.placeholder} numberOfLines={1}>Caching exercises…</Text>
                </View>
              ) : (
                <RotatingPlaceholder phrases={placeholderPhrases} paused={focused} />
              )
            )}
          </Pressable>

          {isTyping && (
            <TouchableOpacity style={st.clearBtn} activeOpacity={0.7} onPress={() => setText("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          )}
          {isTyping ? (
            <TouchableOpacity style={[st.rightBtn, st.rightBtnActive]} activeOpacity={0.85} onPress={() => enterChat(text)} accessibilityLabel="Ask the AI assistant">
              <Ionicons name="sparkles" size={18} color="#000" />
            </TouchableOpacity>
          ) : isFood ? (
            <TouchableOpacity style={st.rightBtn} activeOpacity={0.7} onPress={openScan} accessibilityLabel="Scan a meal">
              <Ionicons name="scan-outline" size={20} color={C.sub} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={st.rightBtn} activeOpacity={0.7} onPress={() => enterChat("")} accessibilityLabel="Open AI assistant">
              <Ionicons name="sparkles" size={20} color={C.sub} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* Meal scan — bar expands into a camera, then collapses to a "scanning" pill */}
      {scanState === "camera" && (
        <ScanIsland
          anim={scanAnim}
          topInset={insets.top}
          granted={!!permission?.granted}
          onRequestPermission={requestPermission}
          onCapture={onScanCapture}
          onClose={closeScan}
        />
      )}
      {scanState === "scanning" && (
        <Animated.View style={[st.scanPill, { top: insets.top + 10, opacity: scanPillAnim }]}>
          <ActivityIndicator color={C.primary} />
          <Text style={st.scanPillText}>Scanning meal…</Text>
        </Animated.View>
      )}

      {/* Chat overlay — expands from the bar */}
      {chatVisible && (
        <Animated.View style={[st.chatOverlay, { opacity: chatAnim, transformOrigin: `50% ${CHAT_ORIGIN_Y}px`, transform: [{ scaleX: chatScaleX }, { scaleY: chatScaleY }] }]}>
          <Animated.View style={{ flex: 1, opacity: chatContentOpacity }}>
            <Chatbot initialMessage={chatSeed} onRequestClose={exitChat} />
          </Animated.View>
        </Animated.View>
      )}

      {celebrate > 0 && (
        <ConfettiCannon key={celebrate} count={18} origin={{ x: SCREEN_W / 2, y: 0 }} fadeOut autoStart explosionSpeed={350} fallSpeed={2600} />
      )}
    </>
  );
}

const st = StyleSheet.create({
  glow: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, paddingBottom: 12, paddingHorizontal: H_PAD },
  askBar: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 6, paddingRight: 6,
    backgroundColor: C.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden",
  },
  avatar: { width: 42, height: 42, borderRadius: 21, overflow: "hidden", backgroundColor: "#161618" },
  input: { color: C.text, fontFamily: theme.medium, fontSize: 14.5, paddingVertical: 0 },
  placeholder: { color: "#8A8A8E", fontFamily: theme.medium, fontSize: 14.5 },
  rightBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  rightBtnActive: { backgroundColor: C.primary },
  clearBtn: { width: 28, alignItems: "center", justifyContent: "center" },

  resultsPanel: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 8, backgroundColor: C.bg },
  row: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: C.pill, borderRadius: 16, padding: 10, paddingRight: 12 },
  rowThumb: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#0E0F10", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  rowEmoji: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#0E0F10", alignItems: "center", justifyContent: "center" },
  rowName: { color: C.text, fontFamily: theme.semibold, fontSize: 14.5 },
  rowMeta: { color: C.sub, fontFamily: theme.medium, fontSize: 11.5, marginTop: 4 },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  hint: { color: "rgba(255,255,255,0.5)", fontFamily: theme.medium, fontSize: 13 },

  chatOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 60, backgroundColor: C.bg },
  scanPill: {
    position: "absolute",
    left: H_PAD,
    right: H_PAD,
    height: 54,
    borderRadius: 27,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: C.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  scanPillText: { color: C.text, fontFamily: theme.semibold, fontSize: 14.5 },
});
