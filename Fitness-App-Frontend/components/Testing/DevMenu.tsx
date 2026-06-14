import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ScrollView, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import database from "@/database/database";
import { Meal } from "@/models/Meals";
import { WorkoutLog } from "@/models/WorkoutLog";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import { theme } from "@/constants/theme";
import { ROUTINES, type WorkoutRoutine } from "@/constants/workoutRoutines";
import { showErrorToast } from "@/utils/toast";
import {
  getActivityPersistenceDiagnostics,
  persistActivitySnapshotNow,
  type ActivityPersistenceDiagnostics,
} from "@/database/expoGoActivityPersistence";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_FOODS = [
  { name: "Chicken Breast & Rice", calories: 550, protein: 45, carbs: 60, fat: 10, emoji: "🍗", healthScore: 9 },
  { name: "Salmon Salad",          calories: 420, protein: 35, carbs: 15, fat: 22, emoji: "🥗", healthScore: 10 },
  { name: "Oatmeal with Berries",  calories: 300, protein: 10, carbs: 50, fat:  6, emoji: "🥣", healthScore: 9 },
  { name: "Cheeseburger",          calories: 800, protein: 40, carbs: 50, fat: 45, emoji: "🍔", healthScore: 4 },
];

const MOCK_ROUTINES = ROUTINES.slice(0, 3);

function routineDurationSeconds(routine: WorkoutRoutine): number {
  return routine.exercises.reduce(
    (sum, exercise) =>
      sum + ((exercise.durationSeconds ?? 45) + exercise.restSeconds) * exercise.sets,
    0
  );
}

function routineCalories(routine: WorkoutRoutine): number {
  return routine.exercises.reduce(
    (sum, exercise) => sum + (exercise.expectedCalories ?? 0) * exercise.sets,
    0
  );
}

// Meal amounts for each day (index 0 = today, 6 = 6 days ago). Varying amounts
// create a realistic streak with some green, grey, and red days.
const WEEK_PLAN: (typeof MOCK_FOODS[0])[][] = [
  [MOCK_FOODS[0], MOCK_FOODS[2]],               // today      — on track
  [MOCK_FOODS[0], MOCK_FOODS[1], MOCK_FOODS[2]],// yesterday  — over target
  [],                                             // 2 days ago — no meals (grey)
  [MOCK_FOODS[2]],                               // 3 days ago — under target
  [MOCK_FOODS[0], MOCK_FOODS[1]],               // 4 days ago — on track
  [MOCK_FOODS[0], MOCK_FOODS[1], MOCK_FOODS[3]],// 5 days ago — over target
  [MOCK_FOODS[2], MOCK_FOODS[0]],               // 6 days ago — on track
];

// ─── DevMenu ─────────────────────────────────────────────────────────────────

export default function DevMenu({ onWorkoutLogged }: { onWorkoutLogged?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ActivityPersistenceDiagnostics | null>(null);

  // ── Meals ──

  const refreshDiagnostics = useCallback(async () => {
    try {
      const userId = await getUserIdFromToken();
      setDiagnostics(await getActivityPersistenceDiagnostics(database, userId));
    } catch (error) {
      console.error("[dev] Failed to read persistence diagnostics", error);
    }
  }, []);

  useEffect(() => {
    if (visible) refreshDiagnostics();
  }, [visible, refreshDiagnostics]);

  const saveSnapshotNow = async () => {
    const userId = await getUserIdFromToken();
    if (!userId) return;
    await persistActivitySnapshotNow(database, userId);
    await refreshDiagnostics();
  };

  const deleteAllMeals = async () => {
    Alert.alert("Delete all meals?", "This removes every meal logged on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const userId = await getUserIdFromToken();
            if (!userId) return;
            await Meal.deleteMealsForUser(database, userId);
            await persistActivitySnapshotNow(database, userId);
            await refreshDiagnostics();
            Alert.alert("Done", "All meals deleted");
          } catch (e) { console.error(e); showErrorToast("Dev action failed", "Failed to delete meals."); }
        },
      },
    ]);
  };

  const seedWeekMeals = async () => {
    try {
      const userId = await getUserIdFromToken();
      if (!userId) return;
      await database.write(async () => {
        const writes: any[] = [];
        WEEK_PLAN.forEach((meals, daysAgo) => {
          meals.forEach((food) => {
            const ts = new Date();
            ts.setDate(ts.getDate() - daysAgo);
            // Vary the time of day per meal so they look realistic.
            ts.setHours(8 + writes.length % 3 * 4, 0, 0, 0);
            writes.push(database.get<Meal>("meals").prepareCreate((m) => {
              m.userId          = userId;
              m.mealName        = food.name;
              m.calories        = food.calories;
              m.protein         = food.protein;
              m.carbohydrates   = food.carbs;
              m.fats            = food.fat;
              m.label           = "dev";
              m.createdAt       = ts.getTime();
              m.healthScore     = food.healthScore;
              m.oneEmoji        = food.emoji;
            }));
          });
        });
        await database.batch(writes);
      });
      await persistActivitySnapshotNow(database, userId);
      await refreshDiagnostics();
      Alert.alert("Done", "Seeded 7 days of meals");
    } catch (e) { console.error(e); showErrorToast("Dev action failed", "Failed to seed meals."); }
  };

  // ── Workouts ──

  const logRoutine = async (routine: WorkoutRoutine) => {
    try {
      const userId = await getUserIdFromToken();
      if (!userId) { showErrorToast("Dev action failed", "No user ID."); return; }
      await database.write(() =>
        WorkoutLog.logWorkout(database, {
          userId,
          routineId: routine.id,
          routineName: routine.name,
          durationSeconds: routineDurationSeconds(routine),
          caloriesBurned: routineCalories(routine),
        })
      );
      await persistActivitySnapshotNow(database, userId);
      await refreshDiagnostics();
      onWorkoutLogged?.();
      Alert.alert("Logged", `${routine.name} completed`);
    } catch (e) { console.error(e); showErrorToast("Dev action failed", "Failed to log workout."); }
  };

  const deleteAllWorkoutLogs = async () => {
    Alert.alert("Delete all workouts?", "This removes every workout log from your device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const userId = await getUserIdFromToken();
            if (!userId) return;
            await database.write(async () => {
              const logs = await database.get<WorkoutLog>("workout_logs").query().fetch();
              const mine = logs.filter(l => l.userId === userId);
              await database.batch(mine.map(l => l.prepareDestroyPermanently()));
            });
            await persistActivitySnapshotNow(database, userId);
            await refreshDiagnostics();
            onWorkoutLogged?.();
            Alert.alert("Done", "All workout logs deleted");
          } catch (e) { console.error(e); showErrorToast("Dev action failed", "Failed to delete workout logs."); }
        },
      },
    ]);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={st.trigger} hitSlop={8}>
        <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>

      <Modal animationType="slide" transparent visible={visible} onRequestClose={() => setVisible(false)}>
        <View style={st.overlay}>
          <View style={st.sheet}>
            {/* Handle */}
            <View style={st.handle} />

            {/* Header */}
            <View style={st.header}>
              <Text style={st.title}>Dev Menu</Text>
              <TouchableOpacity onPress={() => setVisible(false)} style={st.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
              <Text style={st.section}>Persistence Diagnostics</Text>
              <View style={st.diagnostics}>
                <DiagnosticRow label="Adapter" value={diagnostics?.adapter ?? "Loading..."} />
                <DiagnosticRow
                  label="Runtime"
                  value={`${diagnostics?.executionEnvironment ?? "?"} / ownership ${diagnostics?.appOwnership ?? "?"}`}
                />
                <DiagnosticRow label="Native bridge" value={diagnostics?.hasNativeBridge ? "Available" : "Missing"} />
                <DiagnosticRow
                  label="Snapshot bridge"
                  value={`${diagnostics?.persistenceEnabled ? "Enabled" : "Disabled"} / ${diagnostics?.subscribed ? "listening" : "not listening"}`}
                />
                <DiagnosticRow
                  label="WatermelonDB"
                  value={`${diagnostics?.databaseMeals ?? 0} meals / ${diagnostics?.databaseWorkouts ?? 0} workouts / ${diagnostics?.databaseSavedRoutines ?? 0} saved`}
                />
                <DiagnosticRow
                  label="Saved snapshot"
                  value={`${diagnostics?.snapshotMeals ?? 0} meals / ${diagnostics?.snapshotWorkouts ?? 0} workouts / ${diagnostics?.snapshotSavedRoutines ?? 0} saved`}
                />
                <DiagnosticRow label="Snapshot size" value={`${diagnostics?.snapshotBytes ?? 0} bytes`} />
                <DiagnosticRow label="Change events" value={String(diagnostics?.changeEventsSeen ?? 0)} />
                <DiagnosticRow
                  label="Last saved"
                  value={diagnostics?.snapshotSavedAt ? new Date(diagnostics.snapshotSavedAt).toLocaleTimeString() : "Never"}
                />
                {diagnostics?.lastError ? <Text style={st.diagnosticError}>{diagnostics.lastError}</Text> : null}
              </View>
              <View style={st.diagnosticActions}>
                <TouchableOpacity style={st.diagnosticButton} onPress={refreshDiagnostics} activeOpacity={0.7}>
                  <Ionicons name="refresh" size={15} color="#FFF" />
                  <Text style={st.diagnosticButtonText}>Refresh</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.diagnosticButton} onPress={saveSnapshotNow} activeOpacity={0.7}>
                  <Ionicons name="save-outline" size={15} color={theme.primary} />
                  <Text style={[st.diagnosticButtonText, { color: theme.primary }]}>Save Snapshot Now</Text>
                </TouchableOpacity>
              </View>

              {/* ── Workouts ── */}
              <Text style={st.section}>Log Workout</Text>
              {MOCK_ROUTINES.map((r) => (
                <TouchableOpacity key={r.id} style={st.row} onPress={() => logRoutine(r)} activeOpacity={0.7}>
                  <View style={st.rowIcon}>
                    <Ionicons name="barbell-outline" size={16} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.rowTitle}>{r.name}</Text>
                    <Text style={st.rowSub}>
                      {Math.round(routineDurationSeconds(r) / 60)} min · {routineCalories(r)} kcal
                    </Text>
                  </View>
                  <Ionicons name="add" size={18} color={theme.primary} />
                </TouchableOpacity>
              ))}

              {/* ── Meals today ── */}

              {/* ── Meals yesterday ── */}

              {/* ── Bulk seeders ── */}
              <Text style={st.section}>Bulk Actions</Text>
              <TouchableOpacity style={[st.actionBtn, st.actionBtnGreen]} onPress={seedWeekMeals} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={16} color="#000" />
                <Text style={[st.actionText, { color: "#000" }]}>Seed Full Week of Meals</Text>
              </TouchableOpacity>

              {/* ── Danger zone ── */}
              <Text style={[st.section, { color: "#FF453A" }]}>Danger Zone</Text>
              <TouchableOpacity style={[st.actionBtn, st.actionBtnRed]} onPress={deleteAllMeals} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={16} color="#FF453A" />
                <Text style={[st.actionText, { color: "#FF453A" }]}>Delete All Meals</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.actionBtn, st.actionBtnRed, { marginTop: 8 }]} onPress={deleteAllWorkoutLogs} activeOpacity={0.7}>
                <Ionicons name="barbell-outline" size={16} color="#FF453A" />
                <Text style={[st.actionText, { color: "#FF453A" }]}>Delete All Workout Logs</Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.diagnosticRow}>
      <Text style={st.diagnosticLabel}>{label}</Text>
      <Text style={st.diagnosticValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  trigger: { alignItems: "center", justifyContent: "center" },

  overlay: {
    flex: 1, justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  sheet: {
    backgroundColor: "#0A0A0C",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    maxHeight: "88%", paddingBottom: 32,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignSelf: "center", marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  title: { fontFamily: theme.bold, fontSize: 16, color: theme.primary, letterSpacing: 0.5 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
  },

  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },

  section: {
    fontSize: 11, fontFamily: theme.bold, color: "rgba(255,255,255,0.35)",
    letterSpacing: 1, textTransform: "uppercase",
    marginTop: 20, marginBottom: 8, marginLeft: 4,
  },
  diagnostics: {
    backgroundColor: "#141416",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.055)",
  },
  diagnosticRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  diagnosticLabel: { fontFamily: theme.medium, fontSize: 12, color: "rgba(255,255,255,0.42)" },
  diagnosticValue: {
    flex: 1,
    fontFamily: theme.semibold,
    fontSize: 12,
    color: "#FFF",
    textAlign: "right",
  },
  diagnosticError: { fontFamily: theme.regular, fontSize: 11, color: "#FF453A", marginTop: 6 },
  diagnosticActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  diagnosticButton: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.055)",
  },
  diagnosticButtonText: { fontFamily: theme.semibold, fontSize: 12, color: "#FFF" },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#141416", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.055)",
  },
  rowIcon: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: "rgba(170,251,5,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  rowTitle: { fontFamily: theme.medium, fontSize: 14, color: "#FFF" },
  rowSub:   { fontFamily: theme.regular, fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 1 },

  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    borderWidth: 1,
  },
  actionBtnGreen: {
    backgroundColor: theme.primary,
    borderColor: "transparent",
  },
  actionBtnRed: {
    backgroundColor: "rgba(255,69,58,0.08)",
    borderColor: "rgba(255,69,58,0.18)",
  },
  actionText: { fontFamily: theme.semibold, fontSize: 14 },
});
