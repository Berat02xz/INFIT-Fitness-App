import React, { createContext, useContext, useRef, useState, useCallback, useMemo } from "react";
import { Animated, Platform } from "react-native";
import { Gesture } from "react-native-gesture-handler";

// Distance the user must pull down (overscroll) to open the chatbot.
const PULL_TO_CHAT = 130;

// The shared ask-bar lives at the tab-navigation layer. Screens report their
// scroll so the bar can grow on overscroll / open chat; the bar registers the
// handlers. Food adds bump `mealsVersion` so the nutrition screen refetches.
//
// It also hosts a generic "island": any screen can push a React node (e.g. a
// settings editor) into the ask-bar, which expands Dynamic-Island style to show
// it — clear of the bottom navigation. `pulseAvatar` triggers the avatar's
// celebratory 3D flip + glow after a setting is changed.

type ScrollHandlers = {
  onBeginDrag?: (y: number) => void;
  onScroll?: (y: number) => void;
  onEndDrag?: (y: number) => void;
  onPull?: () => void;
};

type IslandState = { node: React.ReactNode; height: number } | null;

type AskBarCtx = {
  scrollRef: React.MutableRefObject<ScrollHandlers>;
  mealsVersion: number;
  bumpMeals: () => void;
  island: IslandState;
  openIsland: (node: React.ReactNode, height?: number) => void;
  closeIsland: () => void;
  avatarPulse: number;
  pulseAvatar: () => void;
  chatTransition: Animated.Value;
};

const Ctx = createContext<AskBarCtx | null>(null);

export function AskBarProvider({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<ScrollHandlers>({});
  const [mealsVersion, setMealsVersion] = useState(0);
  const bumpMeals = useCallback(() => setMealsVersion((v) => v + 1), []);

  const [island, setIsland] = useState<IslandState>(null);
  const openIsland = useCallback(
    (node: React.ReactNode, height = 360) => setIsland({ node, height }),
    []
  );
  const closeIsland = useCallback(() => setIsland(null), []);

  const [avatarPulse, setAvatarPulse] = useState(0);
  const pulseAvatar = useCallback(() => setAvatarPulse((v) => v + 1), []);
  const chatTransition = useRef(new Animated.Value(0)).current;

  const value = useMemo(
    () => ({
      scrollRef,
      mealsVersion,
      bumpMeals,
      island,
      openIsland,
      closeIsland,
      avatarPulse,
      pulseAvatar,
      chatTransition,
    }),
    [mealsVersion, bumpMeals, island, openIsland, closeIsland, avatarPulse, pulseAvatar, chatTransition]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useCtx() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AskBarProvider missing");
  return c;
}

/** Screens: report scroll position so the bar can react.
 *
 * iOS reports a negative `contentOffset.y` while bouncing past the top, which
 * the bar uses to grow + open chat. Android ScrollViews clamp the offset to 0,
 * so the same overscroll never registers. To make pull-to-chat work on Android
 * we additionally expose `pullGesture`: a Pan that runs simultaneously with the
 * native scroll and fires `onPull` once the user drags down past the threshold
 * while already at the top. */
export function useAskBarScroll() {
  const { scrollRef } = useCtx();
  const atTopRef = useRef(true);
  const firedRef = useRef(false);
  const pullDistanceRef = useRef(0);

  const onScrollBeginDrag = useCallback((y: number) => {
    scrollRef.current.onBeginDrag?.(y);
  }, [scrollRef]);

  const onScroll = useCallback((y: number) => {
    atTopRef.current = y <= 1;
    scrollRef.current.onScroll?.(y);
  }, [scrollRef]);

  const onScrollEndDrag = useCallback((y: number) => {
    scrollRef.current.onEndDrag?.(y);
  }, [scrollRef]);

  // Android does not expose the same useful negative native overscroll as iOS,
  // so use the custom pull gesture there. iOS keeps its native scroll physics
  // for a smooth full-page scroll and native pull-to-chat.
  const pullGesture = useMemo(() => {
    const native = Gesture.Native();
    const pan = Gesture.Pan()
      .enabled(Platform.OS === "android")
      .activeOffsetY(10)
      .failOffsetX([-28, 28])
      .runOnJS(true)
      .onBegin(() => {
        pullDistanceRef.current = 0;
        if (atTopRef.current) scrollRef.current.onBeginDrag?.(0);
      })
      .onUpdate((e) => {
        if (!atTopRef.current || e.translationY <= 0) return;
        pullDistanceRef.current = Math.min(e.translationY, 170);
        scrollRef.current.onScroll?.(-Math.min(e.translationY, 170));
        if (!firedRef.current && e.translationY > PULL_TO_CHAT) {
          firedRef.current = true;
          scrollRef.current.onPull?.();
        }
      })
      .onFinalize(() => {
        firedRef.current = false;
        scrollRef.current.onEndDrag?.(-pullDistanceRef.current);
        pullDistanceRef.current = 0;
      });
    return Gesture.Simultaneous(native, pan);
  }, [scrollRef]);

  return { onScrollBeginDrag, onScroll, onScrollEndDrag, pullGesture };
}

/** The AskBar: register the scroll handlers it wants screens to drive. */
export function useAskBarRegister(handlers: ScrollHandlers) {
  const { scrollRef } = useCtx();
  React.useEffect(() => {
    scrollRef.current = handlers;
    return () => { scrollRef.current = {}; };
  }, [handlers, scrollRef]);
}

/** Nutrition: re-fetch meals when this changes (bar added a food). */
export function useMealsVersion() {
  return useCtx().mealsVersion;
}

/** The AskBar: signal that meals changed. */
export function useBumpMeals() {
  return useCtx().bumpMeals;
}

/** Screens (e.g. Profile): open/close an editor in the ask-bar island + celebrate. */
export function useSettingsIsland() {
  const { openIsland, closeIsland, pulseAvatar } = useCtx();
  return { open: openIsland, close: closeIsland, celebrate: pulseAvatar };
}

/** The AskBar: the current island content (or null) + the avatar pulse counter. */
export function useIslandState() {
  return useCtx().island;
}
export function useAvatarPulse() {
  return useCtx().avatarPulse;
}

/** Shared transition used by the askbar chat overlay and the active tab surface. */
export function useChatTransition() {
  return useCtx().chatTransition;
}
