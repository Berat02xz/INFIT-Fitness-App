import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
  StyleSheet,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import PlatformBlur from "@/components/ui/PlatformBlur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import FadeTranslate from "@/components/ui/FadeTranslate";
import { SquircleFrame } from "@/components/ui/Squircle";
import { useAskBarScroll } from "@/components/ui/AskBar/AskBarContext";
import { ROUTINES, type WorkoutRoutine } from "@/constants/workoutRoutines";
import { User } from "@/models/User";
import { SavedRoutine } from "@/models/SavedRoutine";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import database from "@/database/database";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const H_PAD = 18;
const CARD_W = SCREEN_W - H_PAD * 2;
const CARD_H = CARD_W * 1.0;
const CARD_RADIUS = 40;
const ITEM_H = CARD_H + 16;

const AVATARS = [
  require("@/assets/avatars/avatar1.jpg"),
  require("@/assets/avatars/avatar2.jpg"),
  require("@/assets/avatars/avatar3.jpg"),
  require("@/assets/avatars/avatar4.jpg"),
  require("@/assets/avatars/avatar5.jpg"),
  require("@/assets/avatars/avatar6.jpg"),
  require("@/assets/avatars/avatar7.jpg"),
];

const FILTER_PILLS = ["All", "Your Routines", "< 30 min", "Beginner", "Strength", "Cardio"];

const formatCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`;

const diffColor = (d: string) =>
  d === "Beginner" ? "#34C759" : d === "Intermediate" ? "#FF9500" : "#FF5C5C";

const matchesFilter = (r: WorkoutRoutine, pill: string, savedIds: Set<string>) => {
  const muscles = r.targetMuscles.map((m) => m.toLowerCase());
  switch (pill) {
    case "All":
      return true;
    case "Your Routines":
      return savedIds.has(r.id); // routines the user has saved
    case "< 30 min": {
      const mins = parseInt(r.duration, 10);
      return !Number.isNaN(mins) && mins <= 30;
    }
    case "Beginner":
      return r.difficulty === "Beginner";
    case "Strength":
      return muscles.some((m) => ["chest","shoulders","arms","legs","glutes","quads","calves","full body"].includes(m));
    case "Cardio":
      return muscles.includes("cardio");
    default:
      return true;
  }
};

const HOME_GEAR = ["body weight", "gym mat", "no equipment"];
const isGymRoutine = (r: WorkoutRoutine) =>
  r.equipment.some((e) => !HOME_GEAR.includes(e.toLowerCase()));

const D = { bg: "#000", primary: "#AAFB05", text: "#fff", sub: "#8E8E93", pill: "#17191B" };

// ── FilterPill ────────────────────────────────────────────────────────────────
const FilterPill = React.memo(function FilterPill({
  label, active, onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: active ? 1 : 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [active, anim]);
  const backgroundColor = anim.interpolate({ inputRange: [0, 1], outputRange: [D.pill, D.primary] });
  const paddingHorizontal = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 30] });
  const color = anim.interpolate({ inputRange: [0, 1], outputRange: ["#C8C8C8", "#000000"] });
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <Animated.View style={[s.pill, { backgroundColor, paddingHorizontal }]}>
        <Animated.Text style={[s.pillText, { color, fontFamily: active ? theme.semibold : theme.medium }]}>{label}</Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ── RoutineCard ───────────────────────────────────────────────────────────────
const RoutineCard = React.memo(function RoutineCard({
  routine, idx, isFocused, onPress,
}: {
  routine: WorkoutRoutine;
  idx: number;
  isFocused: boolean;
  onPress: (id: string) => void;
}) {
  const av0 = AVATARS[(idx * 3 + 0) % AVATARS.length];
  const av1 = AVATARS[(idx * 3 + 1) % AVATARS.length];
  const av2 = AVATARS[(idx * 3 + 2) % AVATARS.length];

  const av2Anim = useRef(new Animated.Value(0)).current;
  const av1Anim = useRef(new Animated.Value(0)).current;
  const av0Anim = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(false);

  useEffect(() => {
    const isMount = !mountedRef.current;
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout>;
    if (isFocused) {
      timer = setTimeout(() => {
        Animated.stagger(110, [
          Animated.spring(av2Anim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
          Animated.spring(av1Anim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
          Animated.spring(av0Anim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
          Animated.spring(countAnim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
        ]).start();
      }, isMount ? 480 : 0);
    } else {
      Animated.parallel([
        Animated.timing(av0Anim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(av1Anim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(av2Anim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(countAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
    return () => clearTimeout(timer);
  }, [isFocused]);

  const av2Scale = av2Anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const av1Scale = av1Anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const av0Scale = av0Anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const countScale = countAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <FadeTranslate direction="y" translateYFrom={36} delay={300} order={Math.min(idx, 4) * 0.1}>
      <TouchableOpacity activeOpacity={0.96} onPress={() => onPress(routine.id)}>
        <View style={s.card}>
          <LinearGradient colors={routine.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {routine.image ? <Image source={{ uri: routine.image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <LinearGradient colors={["rgba(0,0,0,0.62)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.02)"]} locations={[0, 0.36, 0.62]} style={StyleSheet.absoluteFill} />

          <View style={s.cardTopRow}>
            <View>
              <View style={s.cardTimeRow}>
                <Text style={s.cardTime}>{routine.duration}</Text>
                <Text style={[s.cardDiff, { color: diffColor(routine.difficulty) }]}>{routine.difficulty}</Text>
              </View>
              <View style={s.avatarRow}>
                <Animated.View style={{ opacity: av2Anim, transform: [{ scale: av2Scale }] }}><Image source={av2} style={s.stackAv} /></Animated.View>
                <Animated.View style={{ opacity: av1Anim, transform: [{ scale: av1Scale }], marginLeft: -9 }}><Image source={av1} style={s.stackAv} /></Animated.View>
                <Animated.View style={{ opacity: av0Anim, transform: [{ scale: av0Scale }], marginLeft: -9 }}><Image source={av0} style={s.stackAv} /></Animated.View>
                <Animated.View style={[s.countPill, { opacity: countAnim, transform: [{ scale: countScale }] }]}>
                  <Text style={s.countPillText}>+{formatCount(routine.completions ?? 0)}</Text>
                </Animated.View>
              </View>
            </View>
            <View style={s.starCircle}><Ionicons name="star" size={16} color="#fff" /></View>
          </View>

          <View style={s.glassBarWrap}>
            <PlatformBlur intensity={55} tint="light" androidColor="rgba(40,40,42,0.82)" style={s.glassBar}>
              <View style={s.glassTextCol}>
                <Text style={s.glassTitle} numberOfLines={1}>{routine.name}</Text>
                <Text style={s.glassSub} numberOfLines={1}>Routine by {routine.athlete?.name ?? "Invicta"} • {routine.exercises.length} exercises</Text>
              </View>
              <View style={s.arrowCircle}>
                <Ionicons name="arrow-forward" size={19} color="#000" style={{ transform: [{ rotate: "-45deg" }] }} />
              </View>
            </PlatformBlur>
          </View>

          <SquircleFrame width={CARD_W} height={CARD_H} cornerRadius={CARD_RADIUS} color={D.bg} strokeColor="rgba(255,255,255,0.07)" />
        </View>
      </TouchableOpacity>
    </FadeTranslate>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

export default function Workout() {
  const insets = useSafeAreaInsets();
  const askScroll = useAskBarScroll();

  const [userName, setUserName] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [focusedCard, setFocusedCard] = useState(0);
  const [workoutMode, setWorkoutMode] = useState<"home" | "gym">("home");
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());

  const feedListYRef = useRef(0);
  const HEADER_H = insets.top + 70;

  useEffect(() => {
    (async () => {
      try {
        const u = await User.getUserDetails(database);
        if (u?.name) setUserName(u.name.split(" ")[0]);
        if (u?.equipmentAccess && u.equipmentAccess !== "Home Workouts") setWorkoutMode("gym");
      } catch {}
    })();
  }, []);

  // Refresh saved routine ids whenever the tab regains focus, so routines
  // saved/unsaved from RoutineDetail show up immediately on return.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const userId = await getUserIdFromToken();
          if (!active || !userId) return;
          const ids = await SavedRoutine.getSavedRoutineIds(database, userId);
          if (active) setSavedIds(new Set(ids));
        } catch {}
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const routines = useMemo(() => {
    const list = ROUTINES.filter((r) => {
      // "Your Routines" shows every saved routine regardless of home/gym mode.
      if (activeFilter === "Your Routines") return savedIds.has(r.id);
      return (workoutMode === "gym") === isGymRoutine(r) && matchesFilter(r, activeFilter, savedIds);
    });
    return [...list].sort((a, b) => (b.completions ?? 0) - (a.completions ?? 0));
  }, [workoutMode, activeFilter, savedIds]);

  // Hide the "Your Routines" pill entirely until the user has saved a routine.
  const visiblePills = useMemo(
    () => (savedIds.size > 0 ? FILTER_PILLS : FILTER_PILLS.filter((p) => p !== "Your Routines")),
    [savedIds]
  );

  // If the active filter vanishes (last saved routine removed), fall back to All.
  useEffect(() => {
    if (activeFilter === "Your Routines" && savedIds.size === 0) setActiveFilter("All");
  }, [activeFilter, savedIds]);

  const switchFilter = useCallback((pill: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));
    setActiveFilter(pill);
    setFocusedCard(0);
  }, []);

  const openRoutine = useCallback((routineId: string) => {
    router.push({ pathname: "/RoutineDetail", params: { routineId } });
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const sy = e.nativeEvent.contentOffset.y;
    askScroll.onScroll(sy);
    const screenCenter = sy + SCREEN_H * 0.48;
    const relative = screenCenter - feedListYRef.current;
    const newIdx = Math.max(0, Math.min(routines.length - 1, Math.round(relative / ITEM_H - 0.3)));
    setFocusedCard((prev) => (prev !== newIdx ? newIdx : prev));
  }, [routines.length, askScroll]);

  const onScrollEndDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    askScroll.onScrollEndDrag(e.nativeEvent.contentOffset.y);
  }, [askScroll]);

  const onFeedListLayout = useCallback((e: any) => {
    feedListYRef.current = e.nativeEvent.layout.y;
  }, []);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["transparent", "rgba(0,0,0,0.38)", "rgba(0,0,0,0.82)"]} locations={[0, 0.55, 1]} style={s.bottomScreenFade} pointerEvents="none" />

      <GestureDetector gesture={askScroll.pullGesture}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingTop: HEADER_H + 8, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        onScrollEndDrag={onScrollEndDrag}
        scrollEventThrottle={16}
      >
        <FadeTranslate order={0} delay={60} direction="y" translateYFrom={-10}>
          <View style={s.helloWrap}>
            <Text style={s.hello}>Hello, {userName || "Athlete"}</Text>
            <Text style={s.helloSub}>Let&apos;s explore your workout world!</Text>
          </View>
        </FadeTranslate>

        <FadeTranslate order={0} delay={140} direction="y" translateYFrom={12}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillScroll}>
            {visiblePills.map((pill) => (
              <FilterPill key={pill} label={pill} active={activeFilter === pill} onPress={() => switchFilter(pill)} />
            ))}
          </ScrollView>
        </FadeTranslate>

        <FadeTranslate order={0} delay={200} direction="y" translateYFrom={14}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Workout Routines</Text>
            <Text style={s.createText}>Create</Text>
          </View>
        </FadeTranslate>

        <View style={s.feedList} onLayout={onFeedListLayout}>
          {routines.map((routine, idx) => (
            <RoutineCard key={routine.id} routine={routine} idx={idx} isFocused={focusedCard === idx} onPress={openRoutine} />
          ))}
          {routines.length === 0 && (
            <Text style={s.emptyText}>
              {activeFilter === "Your Routines"
                ? "You haven't saved any routines yet."
                : `No ${workoutMode === "gym" ? "gym" : "home"} workouts in this category yet.`}
            </Text>
          )}
        </View>
      </ScrollView>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.bg },
  scroll: { flex: 1 },

  helloWrap: { paddingHorizontal: H_PAD, marginBottom: 18, marginTop: 2 },
  hello: { color: D.text, fontFamily: theme.semibold, fontSize: 30, lineHeight: 35, letterSpacing: -0.6 },
  helloSub: { color: "#8E8E93", fontFamily: theme.regular, fontSize: 13, lineHeight: 17, marginTop: 2 },

  pillScroll: { paddingHorizontal: H_PAD, paddingBottom: 20, gap: 10 },
  pill: { height: 46, justifyContent: "center", alignItems: "center", borderRadius: 23 },
  pillText: { fontFamily: theme.medium, fontSize: 14 },

  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: H_PAD, marginBottom: 14 },
  sectionTitle: { color: D.text, fontFamily: theme.semibold, fontSize: 22, letterSpacing: -0.4 },
  createText: { color: D.primary, fontFamily: theme.semibold, fontSize: 14 },

  feedList: { paddingHorizontal: H_PAD, gap: 16 },
  card: { width: CARD_W, height: CARD_H, backgroundColor: "#0D0D0D" },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 20 },
  cardTimeRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  cardTime: { color: "#fff", fontFamily: theme.semibold, fontSize: 24, letterSpacing: -0.4 },
  cardDiff: { fontFamily: theme.semibold, fontSize: 12 },
  avatarRow: { flexDirection: "row", alignItems: "center", marginTop: 7 },
  stackAv: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(0,0,0,0.85)" },
  countPill: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, paddingHorizontal: 8, height: 24, alignItems: "center", justifyContent: "center", marginLeft: -6, borderWidth: 1.5, borderColor: "rgba(0,0,0,0.85)" },
  countPillText: { color: "#fff", fontFamily: theme.semibold, fontSize: 10 },
  starCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },

  glassBarWrap: { position: "absolute", bottom: 12, left: 12, right: 12, borderRadius: 30, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)" },
  glassBar: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.14)", paddingVertical: 11, paddingLeft: 18, paddingRight: 10 },
  glassTextCol: { flex: 1, gap: 2 },
  glassTitle: { color: "#fff", fontFamily: theme.semibold, fontSize: 17.5, letterSpacing: -0.2, textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  glassSub: { color: "rgba(255,255,255,0.85)", fontFamily: theme.medium, fontSize: 11, textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  arrowCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },

  emptyText: { color: D.sub, fontFamily: theme.medium, fontSize: 14, textAlign: "center" },
  bottomScreenFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 130, zIndex: 10 },
});
