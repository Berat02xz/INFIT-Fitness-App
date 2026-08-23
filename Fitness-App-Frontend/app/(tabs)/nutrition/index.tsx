import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureDetector } from "react-native-gesture-handler";

import { GetUserDetails } from "@/api/UserDataEndpoint";
import { Meal } from "@/models/Meals";
import database from "@/database/database";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import UserDTO from "@/models/DTO/UserDTO";
import { FOODS, type FoodItem } from "@/constants/foods";
import { useAskBarScroll, useMealsVersion } from "@/components/ui/AskBar/AskBarContext";
import { haptics } from "@/utils/haptics";

import ConstellationBackground from "@/components/ui/Nutrition/ConstellationBackground";
import CalorieOrb from "@/components/ui/Nutrition/CalorieOrb";
import MealBubbles, { type MealBubbleItem } from "@/components/ui/Nutrition/MealBubbles";
import NutritionFocus from "@/components/ui/Nutrition/NutritionFocus";
import EmojiDial, { EMOJI_DIAL_HEIGHT } from "@/components/ui/Nutrition/EmojiDial";
import MealDetailOverlay from "@/components/ui/Nutrition/MealDetailOverlay";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const C = {
  bg: "#08090B",
};

// Curated subset for the bottom emoji dial: featured meals first, then a spread
// of varied single-emoji extras to round out the wheel.
const DIAL_FOODS: FoodItem[] = (() => {
  const featured = FOODS.filter((f) => f.featured);
  const rest = FOODS.filter((f) => !f.featured);
  const extras = rest.filter((f) =>
    ["broccoli", "fish", "oats", "yogurt", "nuts", "sushi", "burrito", "smoothie"].includes(f.id)
  );
  return [...featured, ...extras].slice(0, 16);
})();

type Totals = { calories: number; protein: number; carbs: number; fats: number };

export default function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const mealsVersion = useMealsVersion();
  const askScroll = useAskBarScroll();

  const [userData, setUserData] = useState<UserDTO | null>(null);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [recentScanned, setRecentScanned] = useState<Meal[]>([]);
  const [monthTotals, setMonthTotals] = useState<number[]>([]);
  const [monthTodayIndex, setMonthTodayIndex] = useState(-1);
  const [selectedMeal, setSelectedMeal] = useState<MealBubbleItem | null>(null);
  const [selectedAuto, setSelectedAuto] = useState(false);

  // ── Data loading ──
  const refetchMeals = useCallback(async () => {
    const userId = await getUserIdFromToken();
    if (!userId) return;
    const [today, recents, month] = await Promise.all([
      Meal.getTodayMeals(database, userId),
      Meal.getRecentScannedMeals(database, userId, 10),
      Meal.getMonthCalorieTotals(database, userId),
    ]);
    setTodayMeals(today);
    setRecentScanned(recents);
    setMonthTotals(month.totals);
    setMonthTodayIndex(month.todayIndex);
  }, []);

  // Refetch when the shared ask bar adds a food elsewhere → a bubble pops in.
  useEffect(() => {
    refetchMeals();
  }, [mealsVersion, refetchMeals]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        try {
          const user = await GetUserDetails();
          if (isActive) setUserData(user);
          await refetchMeals();
        } catch (e) {
          console.error(e);
        }
      })();
      return () => {
        isActive = false;
      };
    }, [refetchMeals])
  );

  // ── Delete a logged meal (dragged into the bin) ──
  const deleteMeal = useCallback(
    async (id: string) => {
      try {
        await Meal.deleteMealById(database, id);
        haptics.success();
        await refetchMeals();
      } catch (e) {
        console.error(e);
      }
    },
    [refetchMeals]
  );

  // ── Log a food from the dial ──
  const logFood = useCallback(
    async (food: FoodItem) => {
      try {
        const userId = await getUserIdFromToken();
        if (!userId) return;
        await Meal.createMeal(database, {
          userId,
          mealName: food.name,
          calories: food.calories,
          protein: food.protein,
          carbohydrates: food.carbs,
          fats: food.fats,
          label: "quick-add",
          createdAt: Date.now(),
          healthScore: food.health,
          oneEmoji: food.emoji,
        });
        haptics.success();
        await refetchMeals();
      } catch (e) {
        console.error(e);
      }
    },
    [refetchMeals]
  );

  // ── Totals & derived display ──
  const totals: Totals = todayMeals.reduce(
    (a, m) => ({
      calories: a.calories + m.calories,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbohydrates,
      fats: a.fats + (m.fats || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const targetCalories = userData?.caloricIntake || 2000;
  const isOver = totals.calories > targetCalories;
  const consumed = Math.round(totals.calories);
  const progress = targetCalories > 0 ? totals.calories / targetCalories : 0;
  const onTrack = !isOver && progress >= 0.7;

  const bubbleMeals: MealBubbleItem[] = useMemo(
    () =>
      todayMeals.map((m) => ({
        id: String(m.id),
        emoji: m.oneEmoji ?? "🍽️",
        name: m.mealName,
        calories: m.calories,
        health: m.healthScore,
        isScanned: m.label === "scan",
        scannedAt: m.label === "scan" ? m.createdAt : undefined,
      })),
    [todayMeals]
  );

  // The dial shows recent scanned meals (on the left) then the curated foods.
  const dialFoods: FoodItem[] = useMemo(() => {
    const recents: FoodItem[] = recentScanned.map((m) => ({
      id: `recent_${m.id}`,
      emoji: m.oneEmoji ?? "🍽️",
      name: m.mealName,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbohydrates,
      fats: m.fats,
      health: m.healthScore,
      isScanned: true,
      scannedAt: m.createdAt,
    }));
    return [...recents, ...DIAL_FOODS];
  }, [recentScanned]);

  // ── Layout geometry ──
  // Lift the dial above the floating tab bar (dock height 72 + its bottom offset).
  const dialBottom = Math.max(insets.bottom, 12) + 58;
  // Cluster + ring sit centered in the open band between the stat header and
  // the dial. The left-aligned header is ~150px tall under its top padding.
  const headerBottom = insets.top + 78 + 150;
  const dialTop = SCREEN_H - (dialBottom + EMOJI_DIAL_HEIGHT);
  const canvasCenterX = SCREEN_W / 2;
  // Bias the cluster/ring center slightly above the band midpoint so the big
  // trash zone has room to sit low-center beneath it during a drag.
  const canvasCenterY = headerBottom + (dialTop - headerBottom) * 0.42;
  // A larger, refined ring radius (thin strokes carry the elegance, not bulk).
  const ORB_SIZE = Math.min(SCREEN_W * 0.7, 286);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <GestureDetector gesture={askScroll.pullGesture}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical
          bounces
          directionalLockEnabled
          nestedScrollEnabled
          overScrollMode="always"
          scrollEventThrottle={16}
          onScrollBeginDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
            askScroll.onScrollBeginDrag(e.nativeEvent.contentOffset.y)
          }
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
            askScroll.onScroll(e.nativeEvent.contentOffset.y)
          }
          onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
            askScroll.onScrollEndDrag(e.nativeEvent.contentOffset.y)
          }
        >
          <View style={styles.canvas}>
      {/* Reference-matched background: square grid + dots + diffused glow */}
      <ConstellationBackground />

      {/* Progress ring behind the cluster */}
      <CalorieOrb
        progress={progress}
        size={ORB_SIZE}
        centerX={canvasCenterX}
        centerY={canvasCenterY}
      />

      {/* Top-left stat header: calorie number + macros + motivation */}
      <View style={[styles.topWrap, { paddingTop: insets.top + 78 }]} pointerEvents="box-none">
        <NutritionFocus
          consumed={consumed}
          target={targetCalories}
          isOver={isOver}
          onTrack={onTrack}
          protein={totals.protein}
          carbs={totals.carbs}
          fats={totals.fats}
          days={monthTotals}
          todayIndex={monthTodayIndex}
        />
      </View>

      {/* Bottom emoji dial — lifted clear of the floating tab bar */}
      <View style={[styles.dialWrap, { bottom: dialBottom }]} pointerEvents="box-none">
        <EmojiDial foods={dialFoods} onPick={logFood} />
      </View>

      {/* Draggable meal-emoji bubbles + the big bottom bin — rendered above the
          dial so the bin shows and a dragged emoji floats over everything. */}
      <MealBubbles
        meals={bubbleMeals}
        centerX={canvasCenterX}
        centerY={canvasCenterY}
        onDelete={deleteMeal}
        onSelect={(m) => { setSelectedMeal(m); setSelectedAuto(true); }}
        onPreview={(m) => { setSelectedMeal(m); setSelectedAuto(false); }}
        onPreviewClose={() => setSelectedMeal(null)}
      />
          </View>
        </ScrollView>
      </GestureDetector>

      {/* Tap a logged emoji → blurred detail (name · kcal · health) */}
      {selectedMeal && (
        <MealDetailOverlay meal={selectedMeal} autoClose={selectedAuto} onClose={() => setSelectedMeal(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { minHeight: SCREEN_H },
  canvas: { height: SCREEN_H, backgroundColor: C.bg },
  topWrap: { alignItems: "flex-start", paddingHorizontal: 24 },
  dialWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
