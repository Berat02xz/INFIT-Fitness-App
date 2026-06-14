import { useEffect, useReducer, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GetUserDetails } from "@/api/UserDataEndpoint";
import { Meal } from "@/models/Meals";
import { WorkoutLog } from "@/models/WorkoutLog";
import { Q } from "@nozbe/watermelondb";
import database from "@/database/database";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import { AIEndpoint } from "@/api/AIEndpoint";
import { SavedMessage } from "@/models/SavedMessage";
import { haptics } from "@/utils/haptics";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const FREE_DAILY_LIMIT = 10;

const NUTRITION_KW = [
  "meal", "nutrition", "food", "recipes", "eat", "diet", "calorie",
  "protein", "carbs", "fat", "hungry", "breakfast", "lunch", "dinner",
];
const FITNESS_KW = [
  "fitness", "workout", "gym", "exercise", "training", "muscle",
  "cardio", "strength", "run", "lift", "weight",
];

// ─── Module-level singleton store ─────────────────────────────────────────────
// All consumers (Chatbot screen + AskBar island) share exactly the same state.
// Any mutation calls notify() so every subscriber re-renders synchronously.

let _messages: ChatMessage[] = [];
let _isLoading = false;
let _subscriptionPlan = "Free";
let _dailyMessageCount = 0;
let _savedMessages: SavedMessage[] = [];
let _savedMessageIds = new Set<string>();

const _listeners = new Set<() => void>();
function notify() { _listeners.forEach((fn) => fn()); }

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function detectCategory(text: string): "nutrition" | "fitness" | "general" {
  const l = text.toLowerCase();
  const n = NUTRITION_KW.some((k) => l.includes(k));
  const f = FITNESS_KW.some((k) => l.includes(k));
  if (n) return "nutrition";
  if (f) return "fitness";
  return "general";
}

async function getContextualData(cat: "nutrition" | "fitness" | "general") {
  if (cat === "general") return null;
  try {
    const userId = await getUserIdFromToken();
    if (!userId) return null;
    const user = await GetUserDetails();
    if (cat === "nutrition") {
      const meals = await Meal.getTodayMeals(database, userId);
      const totalCal = meals.reduce((s, m) => s + m.calories, 0);
      return {
        userWeight: user?.weight, userHeight: user?.height, bmr: user?.bmr,
        dailyCalorieGoal: user?.caloricIntake,
        caloriesConsumedToday: totalCal,
        caloriesRemaining: (user?.caloricIntake || 0) - totalCal,
        proteinToday: Math.round(meals.reduce((s, m) => s + m.protein, 0)),
        carbsToday: Math.round(meals.reduce((s, m) => s + m.carbohydrates, 0)),
        fatsToday: Math.round(meals.reduce((s, m) => s + m.fats, 0)),
        mealsToday: meals.length,
        mealsList: meals.map((m) => m.mealName).join(", "),
        goal: user?.goal, activityLevel: user?.activityLevel, unit: user?.unit,
      };
    }
    return {
      userWeight: user?.weight, userHeight: user?.height, goal: user?.goal,
      fitnessLevel: user?.fitnessLevel, activityLevel: user?.activityLevel,
      equipmentAccess: user?.equipmentAccess, bmr: user?.bmr, unit: user?.unit,
    };
  } catch (e) {
    console.error("ChatEngine context fetch", e);
    return null;
  }
}

// ─── Manual context builders (used by Chatbot screen's context selector) ──────

export async function buildUserContext(): Promise<string> {
  try {
    const user = await GetUserDetails();
    if (!user) return "";
    return [
      `Name: ${user.name}`,
      `Age: ${user.age}`,
      `Gender: ${user.gender}`,
      `Weight: ${user.weight}${user.unit === "metric" ? "kg" : "lbs"}`,
      `Height: ${user.height}${user.unit === "metric" ? "cm" : "in"}`,
      `BMI: ${Number(user.bmi || 0).toFixed(1)}`,
      `Goal: ${user.goal}`,
      `Calorie Target: ${user.caloricIntake} kcal/day`,
      `Fitness Level: ${user.fitnessLevel}`,
      `Equipment: ${user.equipmentAccess}`,
      `Activity Level: ${user.activityLevel}`,
    ].join(", ");
  } catch { return ""; }
}

export async function buildWorkoutContext(): Promise<string> {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) return "";
    const endMs = Date.now();
    const startMs = endMs - 30 * 24 * 60 * 60 * 1000;
    const logs = await WorkoutLog.logsInRange(database, userId, startMs, endMs);
    const recent = logs.sort((a, b) => b.completedAt - a.completedAt).slice(0, 5);
    if (recent.length === 0) return "No workouts logged in the past 30 days.";
    const lines = recent.map((l) => {
      const date = new Date(l.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `${l.routineName} on ${date} — ${Math.round(l.durationSeconds / 60)}min, ${l.caloriesBurned} kcal burned`;
    });
    return `Recent Workouts:\n${lines.join("\n")}`;
  } catch { return ""; }
}

export async function buildNutritionContext(): Promise<string> {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) return "";
    const lines: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = i === 0 ? "Today" : i === 1 ? "Yesterday" : "2 days ago";
      const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endMs   = startMs + 24 * 60 * 60 * 1000;
      const meals   = await database
        .get<Meal>("meals")
        .query(Q.and(Q.where("user_id", userId), Q.where("created_at", Q.between(startMs, endMs))))
        .fetch();
      if (meals.length > 0) {
        const cal  = Math.round(meals.reduce((s, m) => s + m.calories, 0));
        const prot = Math.round(meals.reduce((s, m) => s + m.protein, 0));
        const carb = Math.round(meals.reduce((s, m) => s + m.carbohydrates, 0));
        const fat  = Math.round(meals.reduce((s, m) => s + m.fats, 0));
        lines.push(`${label}: ${cal} kcal — P:${prot}g C:${carb}g F:${fat}g (${meals.length} meal${meals.length > 1 ? "s" : ""})`);
      } else {
        lines.push(`${label}: no meals logged`);
      }
    }
    return `Nutrition (last 3 days):\n${lines.join("\n")}`;
  } catch { return ""; }
}

// ─── Store actions (can be called from anywhere — no hook context needed) ──────

export async function loadChatUserData() {
  try {
    const user = await GetUserDetails();
    if (user?.role) { _subscriptionPlan = user.role; notify(); }
  } catch (e) { console.error(e); }
}

export async function loadChatDailyCount() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const raw = await AsyncStorage.getItem("chatbot_daily_count");
    if (raw) {
      const { date, count } = JSON.parse(raw);
      if (date === today) {
        _dailyMessageCount = count;
      } else {
        _dailyMessageCount = 0;
        await AsyncStorage.setItem("chatbot_daily_count", JSON.stringify({ date: today, count: 0 }));
      }
    }
    notify();
  } catch (e) { console.log(e); }
}

export async function loadChatSavedMessages() {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) return;
    _savedMessages = await SavedMessage.getSavedMessages(database, userId);
    notify();
  } catch (e) { console.error(e); }
}

export async function toggleChatSavedMessage(msg: ChatMessage) {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) return;
    if (_savedMessageIds.has(msg.id)) {
      const found = _savedMessages.find((m) => m.messageText === msg.text);
      if (found) {
        await SavedMessage.deleteMessage(database, found.id);
        const next = new Set(_savedMessageIds);
        next.delete(msg.id);
        _savedMessageIds = next;
      }
    } else {
      await SavedMessage.saveMessage(database, userId, msg.text, msg.isUser ? "user" : "ai");
      _savedMessageIds = new Set([..._savedMessageIds, msg.id]);
    }
    await loadChatSavedMessages();
  } catch (e) { console.error(e); }
}

export async function deleteChatSavedMessage(id: string) {
  try {
    await SavedMessage.deleteMessage(database, id);
    await loadChatSavedMessages();
  } catch (e) { console.error(e); }
}

/**
 * Core send function — shared by Chatbot screen and AskBar island.
 *
 * Updates the singleton message list so every subscriber sees the conversation
 * in real-time. `onChunk` is called on each streamed token so callers can
 * update their own local UI (e.g. the island response text) without re-reading
 * the whole messages array.
 */
export async function sendChatMessage(
  text: string,
  onChunk?: (chunk: string, fullSoFar: string) => void,
  onPaywall?: () => void,
  /** When provided, skip keyword auto-detection and use this as the context block.
   *  Pass an empty string to explicitly send with no context. */
  explicitContext?: string,
): Promise<string | null> {
  if (!text.trim() || _isLoading) return null;
  haptics.light();

  const isFree = _subscriptionPlan === "FREE" || _subscriptionPlan === "Free";
  if (isFree && _dailyMessageCount >= FREE_DAILY_LIMIT) {
    onPaywall?.();
    return null;
  }

  const userMsg: ChatMessage = {
    id: Date.now().toString(),
    text: text.trim(),
    isUser: true,
    timestamp: new Date(),
  };
  _messages = [..._messages, userMsg];
  _isLoading = true;
  notify();

  if (isFree) {
    _dailyMessageCount += 1;
    notify();
    const today = new Date().toISOString().split("T")[0];
    AsyncStorage.setItem("chatbot_daily_count", JSON.stringify({ date: today, count: _dailyMessageCount })).catch(() => {});
  }

  try {
    let question: string;
    if (explicitContext !== undefined) {
      // Manual context mode (Chatbot screen) — use provided string, skip keyword detection.
      question = explicitContext ? `${text}\n\nContext:\n${explicitContext}` : text;
    } else {
      // Auto-detect mode (ChatIsland quick-ask) — detect category and fetch data.
      const cat = detectCategory(text);
      const ctx = await getContextualData(cat);
      question  = ctx ? `${text}\n\nUser Context:\n${JSON.stringify(ctx, null, 2)}` : text;
    }

    const aiId = (Date.now() + 1).toString();
    const aiMsg: ChatMessage = { id: aiId, text: "", isUser: false, timestamp: new Date() };
    _messages = [..._messages, aiMsg];
    notify();

    let full = "";
    await AIEndpoint.askChatStream(question, (chunk: string) => {
      full += chunk;
      const captured = full;
      _messages = _messages.map((m) => (m.id === aiId ? { ...m, text: captured } : m));
      onChunk?.(chunk, captured);
      notify();
    });

    _isLoading = false;
    notify();
    return full;
  } catch (err: any) {
    let errorText = "Sorry, I encountered an error. Please try again.";
    if (err.response?.status === 401 || err.response?.status === 403)
      errorText = "Authentication error. Please log in again.";
    else if (err.response?.status === 500)
      errorText = "Server error. Please try again.";
    else if (err.message?.includes("timeout"))
      errorText = "Request timed out. Check your connection.";
    else if (err.message?.includes("Network"))
      errorText = "Network error. Check your connection.";

    _messages = [..._messages, { id: (Date.now() + 1).toString(), text: errorText, isUser: false, timestamp: new Date() }];
    _isLoading = false;
    notify();
    return null;
  }
}

// ─── React hook ───────────────────────────────────────────────────────────────

export function useChatEngine() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    _listeners.add(rerender);
    return () => { _listeners.delete(rerender); };
  }, [rerender]);

  const send = useCallback(
    (text: string, onChunk?: (c: string, f: string) => void, onPaywall?: () => void, explicitContext?: string) =>
      sendChatMessage(text, onChunk, onPaywall, explicitContext),
    [],
  );

  return {
    messages: _messages,
    isLoading: _isLoading,
    subscriptionPlan: _subscriptionPlan,
    setSubscriptionPlan: (plan: string) => { _subscriptionPlan = plan; notify(); },
    dailyMessageCount: _dailyMessageCount,
    savedMessages: _savedMessages,
    savedMessageIds: _savedMessageIds,
    sendMessage: send,
    toggleSavedMessage: useCallback((msg: ChatMessage) => toggleChatSavedMessage(msg), []),
    deleteSavedMessage: useCallback((id: string) => deleteChatSavedMessage(id), []),
    loadUserData: loadChatUserData,
    loadDailyCount: loadChatDailyCount,
    loadSavedMessages: loadChatSavedMessages,
  };
}
