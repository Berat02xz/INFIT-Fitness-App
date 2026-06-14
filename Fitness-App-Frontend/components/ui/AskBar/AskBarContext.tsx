import React, { createContext, useContext, useRef, useState, useCallback, useMemo } from "react";

// The shared ask-bar lives at the tab-navigation layer. Screens report their
// scroll so the bar can grow on overscroll / open chat; the bar registers the
// handlers. Food adds bump `mealsVersion` so the nutrition screen refetches.
//
// It also hosts a generic "island": any screen can push a React node (e.g. a
// settings editor) into the ask-bar, which expands Dynamic-Island style to show
// it — clear of the bottom navigation. `pulseAvatar` triggers the avatar's
// celebratory 3D flip + glow after a setting is changed.

type ScrollHandlers = {
  onScroll?: (y: number) => void;
  onEndDrag?: (y: number) => void;
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
    }),
    [mealsVersion, bumpMeals, island, openIsland, closeIsland, avatarPulse, pulseAvatar]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useCtx() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AskBarProvider missing");
  return c;
}

/** Screens: report scroll position so the bar can react. */
export function useAskBarScroll() {
  const { scrollRef } = useCtx();
  return {
    onScroll: (y: number) => scrollRef.current.onScroll?.(y),
    onScrollEndDrag: (y: number) => scrollRef.current.onEndDrag?.(y),
  };
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
