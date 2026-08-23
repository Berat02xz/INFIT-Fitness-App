import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { GestureDetector } from "react-native-gesture-handler";
import { useAskBarScroll } from "@/components/ui/AskBar/AskBarContext";
import { ROUTINES } from "@/constants/workoutRoutines";
import { theme } from "@/constants/theme";

const featuredRoutine = ROUTINES[0];
const RATING_AVATARS = [
  require("@/assets/avatars/avatar2.jpg"),
  require("@/assets/avatars/avatar5.jpg"),
  require("@/assets/avatars/avatar7.jpg"),
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedExpoImage = Animated.createAnimatedComponent(ExpoImage);

function HeroPill({ children }: { children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;

  const hop = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.08, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }),
    ]).start();
  };

  return (
    <AnimatedPressable
      onPress={hop}
      onPressIn={() => Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }).start()}
      onPressOut={hop}
      style={[styles.glassPill, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

function RatingAvatar({ source, index }: { source: number; index: number }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.spring(scale, {
      toValue: 1,
      delay: 120 + index * 95,
      friction: 6,
      tension: 160,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, scale]);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, index > 0 && styles.avatarOverlap]}>
      <ExpoImage source={source} style={styles.avatar} contentFit="cover" />
    </Animated.View>
  );
}

export default function WorkoutHome() {
  const { width, height } = useWindowDimensions();
  const askScroll = useAskBarScroll();
  const reportScroll = askScroll.onScroll;
  const scrollY = useRef(new Animated.Value(0)).current;
  const posterHeight = Math.min(Math.max(width * 1.18, 420), 510);

  const openRoutine = () => {
    router.push({ pathname: "/RoutineDetail", params: { routineId: featuredRoutine.id } });
  };

  const startRoutine = () => {
    router.push({ pathname: "/WorkoutPlayer", params: { routineId: featuredRoutine.id } });
  };

  return (
    <View style={styles.screen}>
      {/* The photo is pinned behind the scrolling hero. Native overscroll can
          move the page without ever exposing a cut image edge. */}
      <AnimatedExpoImage
        pointerEvents="none"
        source={{ uri: featuredRoutine.image }}
        style={[styles.heroBackground, {
          height: posterHeight * 1.12,
          transform: [
            {
              translateY: scrollY.interpolate({
                inputRange: [0, posterHeight],
                outputRange: [0, -posterHeight * 0.12],
                extrapolate: "clamp",
              }),
            },
            {
              scale: scrollY.interpolate({
                inputRange: [-170, 0],
                outputRange: [1.3, 1],
                extrapolate: "clamp",
              }),
            },
          ],
        }]}
        contentFit="cover"
        contentPosition="top center"
        transition={250}
      />

      <GestureDetector gesture={askScroll.pullGesture}>
        <Animated.ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          // Keep native scrolling physics for a smooth full-page surface.
          bounces
          alwaysBounceVertical
          onScrollBeginDrag={(event) => askScroll.onScrollBeginDrag(event.nativeEvent.contentOffset.y)}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: true,
              listener: (event: any) => reportScroll(event.nativeEvent.contentOffset.y),
            }
          )}
          onScrollEndDrag={(event) => askScroll.onScrollEndDrag(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
        >
          <View testID="workout-featured-poster" style={[styles.poster, { height: posterHeight }]}>
            <LinearGradient
              colors={[
                "rgba(0,0,0,0.03)",
                "rgba(0,0,0,0.02)",
                "rgba(0,0,0,0.52)",
                "#000000",
              ]}
              locations={[0, 0.34, 0.66, 0.96]}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.posterContent}>
              <Text testID="workout-featured-title" style={styles.routineTitle}>LIVING ROOM{"\n"}BURNER</Text>

            <View style={styles.pillRow}>
              <HeroPill>
                <Text style={styles.pillText}>Popular this week</Text>
              </HeroPill>

              <HeroPill>
                <Text style={styles.pillText}>Rated by</Text>
                <View style={styles.avatarStack}>
                  {RATING_AVATARS.map((source, index) => (
                    <RatingAvatar
                      key={index}
                      source={source}
                      index={index}
                    />
                  ))}
                </View>
              </HeroPill>
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.primaryButton} onPress={startRoutine}>
                <Ionicons name="timer-outline" size={17} color="#111111" />
                <Text style={styles.primaryButtonText}>Start workout</Text>
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={openRoutine}>
                <Ionicons name="albums-outline" size={16} color="#FFFFFF" />
                <Text style={styles.secondaryButtonText}>Exercises</Text>
              </Pressable>
            </View>

            <View style={styles.sectionTabs}>
              <View style={styles.activeTabPill}>
                <Text style={styles.activeTabText}>Today</Text>
              </View>
              <Text style={styles.tabText}>Exercises</Text>
              <Text style={styles.tabText}>Plans</Text>
              <Text style={styles.tabText}>Journal</Text>
            </View>
            </View>
          </View>
          {/* Opaque page content follows the hero and scrolls over the pinned
              photo. This is the natural parallax cover—there is no fixed seam
              to reveal when the scroll direction changes. */}
          <View
            style={[
              styles.afterHeroFill,
              { minHeight: Math.max(height - posterHeight, 0) + 120 },
            ]}
          />
        </Animated.ScrollView>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  content: {
    minHeight: "100%",
    paddingBottom: 24,
  },
  heroBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  afterHeroFill: {
    width: "100%",
    backgroundColor: "#000000",
  },
  poster: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  posterContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  routineTitle: {
    color: "#FFFFFF",
    fontFamily: theme.black,
    fontSize: 47,
    lineHeight: 49,
    letterSpacing: -2.5,
    textAlign: "center",
    textTransform: "uppercase",
    transform: [{ scaleX: 0.78 }],
    width: "125%",
    paddingTop: 6,
    textShadowColor: "rgba(0,0,0,0.24)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 13,
  },
  glassPill: {
    height: 27,
    borderRadius: 999,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(42,37,36,0.76)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
  },
  pillText: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: theme.medium,
    fontSize: 11,
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  avatarOverlap: {
    marginLeft: -5,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 17,
  },
  primaryButton: {
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#FFFFFF",
    borderCurve: "continuous",
  },
  primaryButtonText: {
    color: "#111111",
    fontFamily: theme.bold,
    fontSize: 13,
  },
  secondaryButton: {
    height: 42,
    paddingHorizontal: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryButtonText: {
    color: "rgba(255,255,255,0.9)",
    fontFamily: theme.semibold,
    fontSize: 13,
  },
  sectionTabs: {
    width: "100%",
    maxWidth: 330,
    height: 38,
    marginTop: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 5,
  },
  activeTabPill: {
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(24,24,25,0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.24)",
  },
  activeTabText: {
    color: "#FFFFFF",
    fontFamily: theme.semibold,
    fontSize: 12,
  },
  tabText: {
    color: "rgba(255,255,255,0.54)",
    fontFamily: theme.medium,
    fontSize: 12,
  },
});
