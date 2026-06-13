import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, StatusBar, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GetUserDetails } from "@/api/UserDataEndpoint";
import { Meal } from "@/models/Meals";
import database from "@/database/database";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import UserDTO from "@/models/DTO/UserDTO";
import { FOODS, type FoodItem } from "@/constants/foods";
import { useMealsVersion } from "@/components/ui/AskBar/AskBarContext";
import { haptics } from "@/utils/haptics";

import ConstellationBackground from "@/components/ui/Nutrition/ConstellationBackground";
import CalorieOrb from "@/components/ui/Nutrition/CalorieOrb";
import MealBubbles, { type MealBubbleItem } from "@/components/ui/Nutrition/MealBubbles";
import NutritionFocus from "@/components/ui/Nutrition/NutritionFocus";
import EmojiDial, { EMOJI_DIAL_HEIGHT } from "@/components/ui/Nutrition/EmojiDial";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const C = {
  bg: "#08090B",
};

const DEFAULT_MACRO_SPLIT = { protein: 0.3, carbs: 0.4, fats: 0.3 };

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

// ─── Motivational copy, chosen from the day's data ───────────────────────────
function pickMotivation(
  totals: Totals,
  target: number,
  mealCount: number,
  proteinTarget: number
): string {
  if (mealCount === 0) return "Log your first meal 🍽️";

  const left = target - totals.calories;
  const ratio = target > 0 ? totals.calories / target : 0;

  if (left < 0) return "Over your target — go easy 🌙";
  if (ratio >= 0.9) return "You're right on track today ✨";

  const proteinCal = totals.protein * 4;
  const proteinShare = totals.calories > 0 ? proteinCal / totals.calories : 0;
  if (totals.protein >= proteinTarget * 0.6 && proteinShare >= 0.22 && ratio >= 0.4) {
    return "Top 20% of healthy eaters today 🥇";
  }
  if (totals.protein >= proteinTarget * 0.5) {
    return "Great protein — keep it going 💪";
  }
  return `You still have ${Math.round(left).toLocaleString()} kcal to eat`;
}

export default function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const mealsVersion = useMealsVersion();

  const [userData, setUserData] = useState<UserDTO | null>(null);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);

  // ── Data loading ──
  const refetchMeals = useCallback(async () => {
    const userId = await getUserIdFromToken();
    if (!userId) return;
    setTodayMeals(await Meal.getTodayMeals(database, userId));
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
          const userId = await getUserIdFromToken();
          const user = await GetUserDetails();
          if (isActive) setUserData(user);
          if (userId) {
            const meals = await Meal.getTodayMeals(database, userId);
            if (isActive) setTodayMeals(meals);
          }
        } catch (e) {
          console.error(e);
        }
      })();
      return () => {
        isActive = false;
      };
    }, [])
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
          healthScore: 0,
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
  const caloriesDisplay = isOver
    ? Math.round(totals.calories - targetCalories)
    : Math.round(targetCalories - totals.calories);
  const progress = targetCalories > 0 ? totals.calories / targetCalories : 0;
  // "On track" lights the single green accent in the header: meaningfully into
  // the day's target but not yet over it.
  const onTrack = !isOver && progress >= 0.7;

  const proteinTarget = Math.round((targetCalories * DEFAULT_MACRO_SPLIT.protein) / 4);

  const motivation = useMemo(
    () => pickMotivation(totals, targetCalories, todayMeals.length, proteinTarget),
    [totals.calories, totals.protein, targetCalories, todayMeals.length, proteinTarget]
  );

  const bubbleMeals: MealBubbleItem[] = useMemo(
    () => todayMeals.map((m) => ({ id: String(m.id), emoji: m.oneEmoji ?? "🍽️" })),
    [todayMeals]
  );

  // ── Layout geometry ──
  // Lift the dial above the floating tab bar (dock height 72 + its bottom offset)
  // so its emoji buttons are no longer hidden behind the navigation bar.
  const dialBottom = Math.max(insets.bottom, 12) + 10 + 72 + 8;
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
  // Trash zone center: low-center, just above the dial so the big drop circle
  // never collides with the dial or the floating tab bar.
  const binY = dialTop - 104;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Reference-matched background: square grid + dots + diffused glow */}
      <ConstellationBackground />

      {/* Progress ring behind the cluster */}
      <CalorieOrb
        progress={progress}
        size={ORB_SIZE}
        centerX={canvasCenterX}
        centerY={canvasCenterY}
      />

      {/* Draggable, springy meal-emoji bubbles (the simulation) */}
      <MealBubbles
        meals={bubbleMeals}
        centerX={canvasCenterX}
        centerY={canvasCenterY}
        binY={binY}
        onDelete={deleteMeal}
      />

      {/* Top-left stat header: calorie number + macros + motivation */}
      <View style={[styles.topWrap, { paddingTop: insets.top + 78 }]} pointerEvents="box-none">
        <NutritionFocus
          caloriesValue={caloriesDisplay}
          isOver={isOver}
          onTrack={onTrack}
          protein={totals.protein}
          carbs={totals.carbs}
          fats={totals.fats}
          motivation={motivation}
        />
      </View>

      {/* Bottom emoji dial — lifted clear of the floating tab bar */}
      <View style={[styles.dialWrap, { bottom: dialBottom }]} pointerEvents="box-none">
        <EmojiDial foods={DIAL_FOODS} onPick={logFood} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  topWrap: { alignItems: "flex-start", paddingHorizontal: 24 },
  dialWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
