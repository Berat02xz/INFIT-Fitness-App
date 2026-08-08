import React, { useState, useMemo, useEffect, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  StatusBar,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { theme } from "@/constants/theme";
import { useAskBarScroll } from "@/components/ui/AskBar/AskBarContext";
import { ROUTINES, type WorkoutRoutine } from "@/constants/workoutRoutines";
import { User } from "@/models/User";
import { SavedRoutine } from "@/models/SavedRoutine";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import database from "@/database/database";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const H_PAD = 16;
const CARD_W = SCREEN_W - H_PAD * 2;
const MEDIA_H = Math.round(CARD_W * 0.64);
const TILE = 56;

const AVATARS = [
  require("@/assets/avatars/avatar1.jpg"),
  require("@/assets/avatars/avatar2.jpg"),
  require("@/assets/avatars/avatar3.jpg"),
  require("@/assets/avatars/avatar4.jpg"),
  require("@/assets/avatars/avatar5.jpg"),
  require("@/assets/avatars/avatar6.jpg"),
  require("@/assets/avatars/avatar7.jpg"),
];

// orb-style palette: black canvas, white cards, peach-orange accents
const C = {
  bg: "#000000",
  card: "#FFFFFF",
  ink: "#111114",
  sub: "#8A8A8E",
  hairline: "rgba(17,17,20,0.08)",
  orange: "#F0955C",
  tile: "#17191B",
  media: "#141416",
};

// Filter keys must stay in sync with matchesFilter below.
const FILTERS = [
  { key: "All", label: "All", icon: "flash" as const, tint: "#FFD60A" },
  { key: "Your Routines", label: "Saved", icon: "bookmark" as const, tint: "#F0955C" },
  { key: "< 30 min", label: "Quick", icon: "time" as const, tint: "#5AC8FA" },
  { key: "Beginner", label: "Beginner", icon: "leaf" as const, tint: "#34C759" },
  { key: "Strength", label: "Strength", icon: "barbell" as const, tint: "#FF6B6B" },
  { key: "Cardio", label: "Cardio", icon: "pulse" as const, tint: "#FF375F" },
];

const POSTED_AGO = ["1h ago", "3h ago", "6h ago", "1d ago", "1d ago", "2d ago", "3d ago", "5d ago"];
const COMMENTS = [
  "Dope! LFG! 🔥",
  "New PR thanks to this 💪",
  "Day 12 and it actually works",
  "Best routine on here 🙌",
  "Sweating buckets rn 😅",
  "Added to my week, insane pump",
];

const formatCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`;

const diffColor = (d: string) =>
  d === "Beginner" ? "#34C759" : d === "Intermediate" ? "#FF9500" : "#FF5C5C";

const handleOf = (r: WorkoutRoutine) =>
  "@" + (r.athlete?.name ?? "Invicta").toLowerCase().replace(/[^a-z0-9]/g, "");

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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── FilterTile ────────────────────────────────────────────────────────────────
// Rounded icon tile (like the app-icon row in orb). Tapping it springs the tile
// open into a white pill revealing its label; tapping another closes it back.
const FilterTile = React.memo(function FilterTile({
  item, active, onPress,
}: {
  item: (typeof FILTERS)[number];
  active: boolean;
  onPress: () => void;
}) {
  const prog = useSharedValue(active ? 1 : 0);
  const press = useSharedValue(0);
  const labelW = item.label.length * 8.4 + 16;

  useEffect(() => {
    prog.value = withSpring(active ? 1 : 0, { damping: 17, stiffness: 190 });
  }, [active, prog]);

  const wrapStyle = useAnimatedStyle(() => ({
    width: TILE + prog.value * labelW,
    backgroundColor: interpolateColor(prog.value, [0, 1], [C.tile, "#FFFFFF"]),
    transform: [{ scale: 1 - press.value * 0.08 + prog.value * 0.03 }],
  }));
  const idleIcon = useAnimatedStyle(() => ({ opacity: 1 - prog.value }));
  const activeIcon = useAnimatedStyle(() => ({ opacity: prog.value }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(prog.value, [0.55, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: (1 - prog.value) * -10 }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { press.value = withTiming(1, { duration: 90 }); }}
      onPressOut={() => { press.value = withSpring(0, { damping: 14 }); }}
      style={[s.tile, wrapStyle]}
      hitSlop={4}
    >
      <View style={s.tileIconBox}>
        <Animated.View style={[StyleSheet.absoluteFill, s.center, idleIcon]}>
          <Ionicons name={item.icon} size={22} color={item.tint} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, s.center, activeIcon]}>
          <Ionicons name={item.icon} size={22} color="#000" />
        </Animated.View>
      </View>
      <Animated.Text style={[s.tileLabel, { width: labelW }, labelStyle]} numberOfLines={1}>
        {item.label}
      </Animated.Text>
    </AnimatedPressable>
  );
});

// ── pop-in helper: element scales in with overshoot as the card reveals ───────
function usePop(pop: SharedValue<number>, start: number) {
  return useAnimatedStyle(() => {
    const t = interpolate(pop.value, [start, Math.min(start + 0.35, 1)], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: t,
      transform: [{ scale: interpolate(t, [0, 0.7, 1], [0.2, 1.14, 1]) }],
    };
  });
}

// ── SocialCard ────────────────────────────────────────────────────────────────
const SocialCard = React.memo(function SocialCard({
  routine, idx, saved, feedY, scrollY, onPress,
}: {
  routine: WorkoutRoutine;
  idx: number;
  saved: boolean;
  feedY: SharedValue<number>;
  scrollY: SharedValue<number>;
  onPress: (id: string) => void;
}) {
  const cardY = useSharedValue(0);
  const press = useSharedValue(0);
  const mount = useSharedValue(0);
  const likePop = useSharedValue(1);
  const [liked, setLiked] = useState(false);

  const completions = routine.completions ?? 0;
  const likes = Math.round(completions * 0.042) + (liked ? 1 : 0);
  const comments = Math.max(4, Math.round(completions * 0.0031));
  const shares = Math.max(2, Math.round(completions * 0.0014));
  const handle = handleOf(routine);
  const tags = routine.targetMuscles
    .map((m) => "#" + m.toLowerCase().replace(/\s+/g, ""))
    .join(" ");
  const withLikedRow = idx % 2 === 0;

  useEffect(() => {
    mount.value = withDelay(380 + Math.min(idx, 5) * 110, withSpring(1, { damping: 13 }));
  }, [idx, mount]);

  // Reveal progress: 0 while the card is below the viewport, 1 once its top has
  // risen ~1/3 into view. Scroll-driven, so it plays in reverse on the way up.
  const p = useDerivedValue(() => {
    const top = feedY.value + cardY.value;
    return interpolate(
      scrollY.value + SCREEN_H,
      [top + 90, top + 340],
      [0, 1],
      Extrapolation.CLAMP
    );
  });
  const pop = useDerivedValue(() => Math.min(p.value, mount.value));

  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.6], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(p.value, [0, 1], [44, 0], Extrapolation.CLAMP) },
      { scale: interpolate(p.value, [0, 1], [0.95, 1], Extrapolation.CLAMP) * (1 - press.value * 0.02) },
    ],
  }));

  // Subtle parallax on the media image as the card travels through the screen.
  const parallaxStyle = useAnimatedStyle(() => {
    const top = feedY.value + cardY.value;
    return {
      transform: [{
        translateY: interpolate(
          scrollY.value,
          [top - SCREEN_H, top + MEDIA_H + 200],
          [-16, 16],
          Extrapolation.CLAMP
        ),
      }],
    };
  });

  const headerAvStyle = usePop(pop, 0.15);
  const av0Style = usePop(pop, 0.3);
  const av1Style = usePop(pop, 0.42);
  const av2Style = usePop(pop, 0.54);
  const likeHeartStyle = useAnimatedStyle(() => ({ transform: [{ scale: likePop.value }] }));

  const onLike = useCallback(() => {
    likePop.value = withSequence(
      withSpring(1.35, { damping: 9, stiffness: 320 }),
      withSpring(1, { damping: 13 })
    );
    setLiked((v) => !v);
  }, [likePop]);

  return (
    <Animated.View
      entering={FadeInDown.duration(480).delay(140 + Math.min(idx, 6) * 90)}
      onLayout={(e) => { cardY.value = e.nativeEvent.layout.y; }}
    >
      <AnimatedPressable
        style={[s.card, revealStyle]}
        onPress={() => onPress(routine.id)}
        onPressIn={() => { press.value = withTiming(1, { duration: 110 }); }}
        onPressOut={() => { press.value = withSpring(0, { damping: 14 }); }}
      >
        {/* social strip: friends-liked stack or a top comment */}
        {withLikedRow ? (
          <View style={s.socialStrip}>
            <View style={s.stripStack}>
              <Animated.View style={av0Style}><ExpoImage source={AVATARS[(idx * 3) % 7]} style={s.stripAv} /></Animated.View>
              <Animated.View style={[av1Style, s.overlap]}><ExpoImage source={AVATARS[(idx * 3 + 1) % 7]} style={s.stripAv} /></Animated.View>
              <Animated.View style={[av2Style, s.overlap]}><ExpoImage source={AVATARS[(idx * 3 + 2) % 7]} style={s.stripAv} /></Animated.View>
            </View>
            <Text style={s.stripText} numberOfLines={1}>
              <Text style={s.stripStrong}>{formatCount(likes)}</Text> athletes liked this routine
            </Text>
          </View>
        ) : (
          <View style={s.socialStrip}>
            <Animated.View style={av0Style}>
              <ExpoImage source={AVATARS[(idx * 5 + 2) % 7]} style={s.commentAv} />
            </Animated.View>
            <Text style={s.stripText} numberOfLines={1}>{COMMENTS[idx % COMMENTS.length]}</Text>
          </View>
        )}
        <View style={s.hairline} />

        {/* author row */}
        <View style={s.authorRow}>
          <Animated.View style={headerAvStyle}>
            <ExpoImage source={AVATARS[idx % 7]} style={s.authorAv} transition={200} />
          </Animated.View>
          <View style={s.authorCol}>
            <Text style={s.authorName} numberOfLines={1}>{routine.athlete?.name ?? "Invicta"}</Text>
            <Text style={s.authorSub} numberOfLines={1}>
              Posted in {routine.targetMuscles[0]?.toLowerCase() ?? "fitness"} ~{POSTED_AGO[idx % POSTED_AGO.length]}
            </Text>
          </View>
          {saved && <Ionicons name="bookmark" size={18} color={C.orange} />}
        </View>

        {/* post body */}
        <Text style={s.postBody}>
          {routine.description} <Text style={s.mention}>{handle}</Text> <Text style={s.mention}>{tags}</Text>
        </Text>

        {/* media card */}
        <View style={s.media}>
          {routine.image ? (
            <Animated.View style={[s.mediaImgWrap, parallaxStyle]}>
              <ExpoImage source={{ uri: routine.image }} style={s.mediaImg} contentFit="cover" transition={300} recyclingKey={routine.id} />
            </Animated.View>
          ) : (
            <LinearGradient colors={routine.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0.08)", "rgba(0,0,0,0.55)"]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.mediaTopRow}>
            <View style={s.mediaTitleCol}>
              <Text style={s.mediaTitle} numberOfLines={2}>{routine.name}</Text>
              <Text style={s.mediaSub} numberOfLines={1}>{routine.athlete?.name ?? "Invicta"} × Invicta</Text>
            </View>
            <View style={s.diffPill}>
              <View style={[s.diffDot, { backgroundColor: diffColor(routine.difficulty) }]} />
              <Text style={s.diffText}>{routine.difficulty}</Text>
            </View>
          </View>
          <View style={s.mediaBottomRow}>
            <View style={s.durationPill}>
              <Ionicons name="time-outline" size={13} color="#fff" />
              <Text style={s.durationText}>{routine.duration}</Text>
            </View>
            <View style={s.playCircle}>
              <Ionicons name="play" size={22} color="#000" style={{ marginLeft: 2 }} />
            </View>
          </View>
        </View>

        {/* footer: likes / comments / shares / more */}
        <View style={s.footerRow}>
          <Pressable style={s.footerBtn} onPress={onLike} hitSlop={8}>
            <Animated.View style={likeHeartStyle}>
              <Ionicons name={liked ? "heart" : "heart-outline"} size={22} color={liked ? C.orange : C.ink} />
            </Animated.View>
            <Text style={s.footerCount}>{formatCount(likes)}</Text>
          </Pressable>
          <Pressable style={s.footerBtn} onPress={() => onPress(routine.id)} hitSlop={8}>
            <Ionicons name="chatbubble-outline" size={20} color={C.ink} />
            <Text style={s.footerCount}>{formatCount(comments)}</Text>
          </Pressable>
          <Pressable style={s.footerBtn} onPress={() => onPress(routine.id)} hitSlop={8}>
            <Ionicons name="arrow-redo-outline" size={21} color={C.ink} />
            <Text style={s.footerCount}>{formatCount(shares)}</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => onPress(routine.id)} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={20} color={C.sub} />
          </Pressable>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

export default function Workout() {
  const insets = useSafeAreaInsets();
  const askScroll = useAskBarScroll();

  const [userName, setUserName] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [workoutMode, setWorkoutMode] = useState<"home" | "gym">("home");
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());

  const scrollY = useSharedValue(0);
  const feedY = useSharedValue(0);
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

  // Hide the "Saved" tile entirely until the user has saved a routine.
  const visibleFilters = useMemo(
    () => (savedIds.size > 0 ? FILTERS : FILTERS.filter((f) => f.key !== "Your Routines")),
    [savedIds]
  );

  // If the active filter vanishes (last saved routine removed), fall back to All.
  useEffect(() => {
    if (activeFilter === "Your Routines" && savedIds.size === 0) setActiveFilter("All");
  }, [activeFilter, savedIds]);

  const openRoutine = useCallback((routineId: string) => {
    router.push({ pathname: "/RoutineDetail", params: { routineId } });
  }, []);

  const reportScroll = askScroll.onScroll;
  const reportEndDrag = askScroll.onScrollEndDrag;
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      runOnJS(reportScroll)(e.contentOffset.y);
    },
    onEndDrag: (e) => {
      runOnJS(reportEndDrag)(e.contentOffset.y);
    },
  });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["transparent", "rgba(0,0,0,0.38)", "rgba(0,0,0,0.82)"]} locations={[0, 0.55, 1]} style={s.bottomScreenFade} pointerEvents="none" />

      <GestureDetector gesture={askScroll.pullGesture}>
      <Animated.ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingTop: HEADER_H + 8, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Animated.View entering={FadeInDown.duration(420).delay(60)} style={s.helloWrap}>
          <Text style={s.hello}>Hello, {userName || "Athlete"}</Text>
          <Text style={s.helloSub}>Let&apos;s explore your workout world!</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(140)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tileScroll}>
            {visibleFilters.map((f) => (
              <FilterTile
                key={f.key}
                item={f}
                active={activeFilter === f.key}
                onPress={() => setActiveFilter(activeFilter === f.key ? "All" : f.key)}
              />
            ))}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(200)} style={s.sectionRow}>
          <Text style={s.sectionTitle}>For You</Text>
          <Text style={s.sectionCount}>{routines.length} routines</Text>
        </Animated.View>

        <View
          key={activeFilter}
          style={s.feedList}
          onLayout={(e) => { feedY.value = e.nativeEvent.layout.y; }}
        >
          {routines.map((routine, idx) => (
            <SocialCard
              key={routine.id}
              routine={routine}
              idx={idx}
              saved={savedIds.has(routine.id)}
              feedY={feedY}
              scrollY={scrollY}
              onPress={openRoutine}
            />
          ))}
          {routines.length === 0 && (
            <Animated.View entering={FadeInDown.duration(420)} style={s.emptyWrap}>
              <Ionicons name="barbell-outline" size={28} color={C.sub} />
              <Text style={s.emptyText}>
                {activeFilter === "Your Routines"
                  ? "You haven't saved any routines yet."
                  : `No ${workoutMode === "gym" ? "gym" : "home"} workouts in this category yet.`}
              </Text>
            </Animated.View>
          )}
        </View>
      </Animated.ScrollView>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },

  helloWrap: { paddingHorizontal: H_PAD + 2, marginBottom: 18, marginTop: 2 },
  hello: { color: "#fff", fontFamily: theme.semibold, fontSize: 30, lineHeight: 35, letterSpacing: -0.6 },
  helloSub: { color: C.sub, fontFamily: theme.regular, fontSize: 13, lineHeight: 17, marginTop: 2 },

  tileScroll: { paddingHorizontal: H_PAD, paddingBottom: 20, gap: 10, alignItems: "center" },
  tile: {
    height: TILE, borderRadius: 19, borderCurve: "continuous",
    flexDirection: "row", alignItems: "center", overflow: "hidden",
  },
  tileIconBox: { width: TILE, height: TILE },
  tileLabel: { color: "#000", fontFamily: theme.semibold, fontSize: 13.5, marginLeft: -8 },

  sectionRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: H_PAD + 2, marginBottom: 14 },
  sectionTitle: { color: "#fff", fontFamily: theme.semibold, fontSize: 22, letterSpacing: -0.4 },
  sectionCount: { color: C.sub, fontFamily: theme.medium, fontSize: 12.5 },

  feedList: { paddingHorizontal: H_PAD, gap: 14 },

  card: {
    backgroundColor: C.card, borderRadius: 30, borderCurve: "continuous",
    paddingHorizontal: 16, paddingTop: 13, paddingBottom: 12, overflow: "hidden",
  },

  socialStrip: { flexDirection: "row", alignItems: "center", gap: 9, paddingBottom: 11, paddingHorizontal: 2 },
  stripStack: { flexDirection: "row", alignItems: "center" },
  stripAv: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#fff" },
  overlap: { marginLeft: -8 },
  commentAv: { width: 20, height: 20, borderRadius: 10 },
  stripText: { flex: 1, color: C.sub, fontFamily: theme.medium, fontSize: 12.5 },
  stripStrong: { color: C.ink, fontFamily: theme.semibold },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: C.hairline, marginHorizontal: -16 },

  authorRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingTop: 12, paddingHorizontal: 2 },
  authorAv: { width: 40, height: 40, borderRadius: 20 },
  authorCol: { flex: 1, gap: 1 },
  authorName: { color: C.ink, fontFamily: theme.semibold, fontSize: 16, letterSpacing: -0.2 },
  authorSub: { color: C.sub, fontFamily: theme.medium, fontSize: 12 },

  postBody: { color: C.ink, fontFamily: theme.medium, fontSize: 15, lineHeight: 21, paddingTop: 10, paddingBottom: 12, paddingHorizontal: 2, letterSpacing: -0.1 },
  mention: { color: C.orange, fontFamily: theme.semibold },

  media: { height: MEDIA_H, borderRadius: 22, borderCurve: "continuous", overflow: "hidden", backgroundColor: C.media },
  mediaImgWrap: { position: "absolute", top: -18, left: 0, right: 0, height: MEDIA_H + 36 },
  mediaImg: { width: "100%", height: "100%" },
  mediaTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 16, gap: 10 },
  mediaTitleCol: { flex: 1, gap: 3 },
  mediaTitle: { color: "#fff", fontFamily: theme.semibold, fontSize: 21, lineHeight: 25, letterSpacing: -0.4 },
  mediaSub: { color: "rgba(255,255,255,0.82)", fontFamily: theme.medium, fontSize: 12 },
  diffPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(20,20,22,0.6)", borderRadius: 999, paddingHorizontal: 10, height: 26 },
  diffDot: { width: 6, height: 6, borderRadius: 3 },
  diffText: { color: "#fff", fontFamily: theme.semibold, fontSize: 11 },
  mediaBottomRow: { position: "absolute", bottom: 14, left: 16, right: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  durationPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(20,20,22,0.72)", borderRadius: 999, paddingHorizontal: 11, height: 30 },
  durationText: { color: "#fff", fontFamily: theme.semibold, fontSize: 13 },
  playCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },

  footerRow: { flexDirection: "row", alignItems: "center", gap: 20, paddingTop: 12, paddingHorizontal: 4 },
  footerBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerCount: { color: C.ink, fontFamily: theme.semibold, fontSize: 13.5 },

  emptyWrap: { alignItems: "center", gap: 10, paddingVertical: 40 },
  emptyText: { color: C.sub, fontFamily: theme.medium, fontSize: 14, textAlign: "center" },
  bottomScreenFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 130, zIndex: 10 },
});
