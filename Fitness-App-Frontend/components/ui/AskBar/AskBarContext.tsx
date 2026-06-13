import React, { createContext, useContext, useRef, useState, useCallback, useMemo } from "react";

// The shared ask-bar lives at the tab-navigation layer. Screens report their
// scroll so the bar can grow on overscroll / open chat; the bar registers the
// handlers. Food adds bump `mealsVersion` so the nutrition screen refetches.

type ScrollHandlers = {
  onScroll?: (y: number) => void;
  onEndDrag?: (y: number) => void;
};

type AskBarCtx = {
  scrollRef: React.MutableRefObject<ScrollHandlers>;
  mealsVersion: number;
  bumpMeals: () => void;
};

const Ctx = createContext<AskBarCtx | null>(null);

export function AskBarProvider({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<ScrollHandlers>({});
  const [mealsVersion, setMealsVersion] = useState(0);
  const bumpMeals = useCallback(() => setMealsVersion((v) => v + 1), []);
  const value = useMemo(() => ({ scrollRef, mealsVersion, bumpMeals }), [mealsVersion, bumpMeals]);
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
