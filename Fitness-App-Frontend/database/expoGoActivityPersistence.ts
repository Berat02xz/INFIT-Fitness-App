import AsyncStorage from "@react-native-async-storage/async-storage";
import { Database, Q } from "@nozbe/watermelondb";
import { databaseRuntime, usesLokiFallback } from "./adapter";

const SNAPSHOT_VERSION = 1;
const KEY_PREFIX = "invicta_expo_go_activity_v1:";
type PersistedMeal = {
  userId: string;
  mealName: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fats: number;
  label: string;
  createdAt: number;
  healthScore: number;
  oneEmoji: string;
};

type PersistedWorkout = {
  userId: string;
  routineId: string;
  routineName: string;
  completedAt: number;
  durationSeconds: number;
  caloriesBurned: number;
};

type PersistedSavedRoutine = {
  userId: string;
  routineId: string;
  savedAt: number;
};

type ActivitySnapshot = {
  version: number;
  savedAt?: number;
  meals: PersistedMeal[];
  workouts: PersistedWorkout[];
  savedRoutines?: PersistedSavedRoutine[];
};

export type ActivityPersistenceDiagnostics = {
  userId: string | null;
  adapter: string;
  appOwnership: string;
  executionEnvironment: string;
  hasNativeBridge: boolean;
  persistenceEnabled: boolean;
  subscribed: boolean;
  databaseMeals: number;
  databaseWorkouts: number;
  databaseSavedRoutines: number;
  snapshotMeals: number;
  snapshotWorkouts: number;
  snapshotSavedRoutines: number;
  snapshotBytes: number;
  snapshotSavedAt: number | null;
  changeEventsSeen: number;
  lastError: string | null;
};

const subscriptions = new Map<string, { unsubscribe: () => void }[]>();
const hydrationPromises = new Map<string, Promise<void>>();
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
let writeQueue: Promise<void> = Promise.resolve();
let changeEventsSeen = 0;
let lastError: string | null = null;

const keyFor = (userId: string) => `${KEY_PREFIX}${userId}`;

async function readSnapshot(userId: string): Promise<ActivitySnapshot | null> {
  try {
    const value = await AsyncStorage.getItem(keyFor(userId));
    if (!value) return null;
    const snapshot = JSON.parse(value) as ActivitySnapshot;
    return snapshot.version === SNAPSHOT_VERSION ? snapshot : null;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    console.error("[database] Failed to read Expo Go activity snapshot", error);
    return null;
  }
}

async function writeSnapshot(database: Database, userId: string): Promise<void> {
  const [meals, workouts, savedRoutines] = await Promise.all([
    database.get<any>("meals").query(Q.where("user_id", userId)).fetch(),
    database.get<any>("workout_logs").query(Q.where("user_id", userId)).fetch(),
    database.get<any>("saved_routines").query(Q.where("user_id", userId)).fetch(),
  ]);

  const snapshot: ActivitySnapshot = {
    version: SNAPSHOT_VERSION,
    savedAt: Date.now(),
    meals: meals.map((meal) => ({
      userId: meal.userId,
      mealName: meal.mealName,
      calories: meal.calories,
      protein: meal.protein,
      carbohydrates: meal.carbohydrates,
      fats: meal.fats,
      label: meal.label,
      createdAt: meal.createdAt,
      healthScore: meal.healthScore,
      oneEmoji: meal.oneEmoji,
    })),
    workouts: workouts.map((workout) => ({
      userId: workout.userId,
      routineId: workout.routineId,
      routineName: workout.routineName,
      completedAt: workout.completedAt,
      durationSeconds: workout.durationSeconds,
      caloriesBurned: workout.caloriesBurned,
    })),
    savedRoutines: savedRoutines.map((routine) => ({
      userId: routine.userId,
      routineId: routine.routineId,
      savedAt: routine.savedAt,
    })),
  };

  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(snapshot));
  lastError = null;
}

function scheduleSnapshot(database: Database, userId: string) {
  const existingTimer = persistTimers.get(userId);
  if (existingTimer) clearTimeout(existingTimer);

  persistTimers.set(userId, setTimeout(() => {
    persistTimers.delete(userId);
    writeQueue = writeQueue
      .then(() => writeSnapshot(database, userId))
      .catch((error) => {
        lastError = error instanceof Error ? error.message : String(error);
        console.error("[database] Failed to save Expo Go activity snapshot", error);
      });
  }, 0));
}

function startSnapshotting(database: Database, userId: string) {
  if (subscriptions.has(userId)) return;

  const onChange = () => {
    changeEventsSeen += 1;
    scheduleSnapshot(database, userId);
  };
  const mealSubscription = database.get<any>("meals").changes.subscribe(onChange);
  const workoutSubscription = database.get<any>("workout_logs").changes.subscribe(onChange);
  const savedRoutineSubscription = database.get<any>("saved_routines").changes.subscribe(onChange);
  subscriptions.set(userId, [mealSubscription, workoutSubscription, savedRoutineSubscription]);
}

async function hydrate(database: Database, userId: string) {
  const [existingMeals, existingWorkouts, existingSavedRoutines] = await Promise.all([
    database.get<any>("meals").query(Q.where("user_id", userId)).fetchCount(),
    database.get<any>("workout_logs").query(Q.where("user_id", userId)).fetchCount(),
    database.get<any>("saved_routines").query(Q.where("user_id", userId)).fetchCount(),
  ]);

  if (existingMeals > 0 || existingWorkouts > 0 || existingSavedRoutines > 0) {
    await writeSnapshot(database, userId);
    startSnapshotting(database, userId);
    return;
  }

  const snapshot = await readSnapshot(userId);
  if (snapshot && (snapshot.meals.length > 0 || snapshot.workouts.length > 0 || (snapshot.savedRoutines?.length ?? 0) > 0)) {
    await database.write(async () => {
      const writes = [
        ...snapshot.meals.map((saved) =>
          database.get<any>("meals").prepareCreate((meal) => {
            meal.userId = saved.userId;
            meal.mealName = saved.mealName;
            meal.calories = saved.calories;
            meal.protein = saved.protein;
            meal.carbohydrates = saved.carbohydrates;
            meal.fats = saved.fats;
            meal.label = saved.label;
            meal.createdAt = saved.createdAt;
            meal.healthScore = saved.healthScore;
            meal.oneEmoji = saved.oneEmoji;
          })
        ),
        ...snapshot.workouts.map((saved) =>
          database.get<any>("workout_logs").prepareCreate((workout) => {
            workout.userId = saved.userId;
            workout.routineId = saved.routineId;
            workout.routineName = saved.routineName;
            workout.completedAt = saved.completedAt;
            workout.durationSeconds = saved.durationSeconds;
            workout.caloriesBurned = saved.caloriesBurned;
          })
        ),
        ...(snapshot.savedRoutines ?? []).map((saved) =>
          database.get<any>("saved_routines").prepareCreate((routine) => {
            routine.userId = saved.userId;
            routine.routineId = saved.routineId;
            routine.savedAt = saved.savedAt;
          })
        ),
      ];
      if (writes.length > 0) await database.batch(writes);
    });
    console.log(
      `[database] Restored ${snapshot.meals.length} meals, ${snapshot.workouts.length} workouts, and ${snapshot.savedRoutines?.length ?? 0} saved routines.`
    );
  }

  startSnapshotting(database, userId);
}

export async function hydrateExpoGoActivity(database: Database, userId: string): Promise<void> {
  if (!usesLokiFallback) return;

  const existing = hydrationPromises.get(userId);
  if (existing) return existing;

  const promise = hydrate(database, userId).catch((error) => {
    hydrationPromises.delete(userId);
    lastError = error instanceof Error ? error.message : String(error);
    console.error("[database] Failed to hydrate Expo Go activity", error);
  });
  hydrationPromises.set(userId, promise);
  return promise;
}

export async function clearExpoGoActivity(userId: string): Promise<void> {
  if (!usesLokiFallback) return;

  const timer = persistTimers.get(userId);
  if (timer) clearTimeout(timer);
  persistTimers.delete(userId);

  subscriptions.get(userId)?.forEach((subscription) => subscription.unsubscribe());
  subscriptions.delete(userId);
  hydrationPromises.delete(userId);

  await writeQueue;
  await AsyncStorage.removeItem(keyFor(userId));
}

export async function persistActivitySnapshotNow(database: Database, userId: string): Promise<void> {
  if (!usesLokiFallback) return;

  const timer = persistTimers.get(userId);
  if (timer) clearTimeout(timer);
  persistTimers.delete(userId);

  writeQueue = writeQueue
    .then(() => writeSnapshot(database, userId))
    .catch((error) => {
      lastError = error instanceof Error ? error.message : String(error);
      console.error("[database] Failed to save activity snapshot", error);
    });
  await writeQueue;
}

export async function getActivityPersistenceDiagnostics(
  database: Database,
  userId: string | null
): Promise<ActivityPersistenceDiagnostics> {
  const [databaseMeals, databaseWorkouts, databaseSavedRoutines, rawSnapshot] = await Promise.all([
    userId ? database.get<any>("meals").query(Q.where("user_id", userId)).fetchCount() : 0,
    userId ? database.get<any>("workout_logs").query(Q.where("user_id", userId)).fetchCount() : 0,
    userId ? database.get<any>("saved_routines").query(Q.where("user_id", userId)).fetchCount() : 0,
    userId ? AsyncStorage.getItem(keyFor(userId)) : null,
  ]);

  let snapshot: ActivitySnapshot | null = null;
  if (rawSnapshot) {
    try {
      snapshot = JSON.parse(rawSnapshot) as ActivitySnapshot;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    userId,
    adapter: databaseRuntime.adapter,
    appOwnership: databaseRuntime.appOwnership,
    executionEnvironment: databaseRuntime.executionEnvironment,
    hasNativeBridge: databaseRuntime.hasWatermelonNativeBridge,
    persistenceEnabled: usesLokiFallback,
    subscribed: Boolean(userId && subscriptions.has(userId)),
    databaseMeals,
    databaseWorkouts,
    databaseSavedRoutines,
    snapshotMeals: snapshot?.meals?.length ?? 0,
    snapshotWorkouts: snapshot?.workouts?.length ?? 0,
    snapshotSavedRoutines: snapshot?.savedRoutines?.length ?? 0,
    snapshotBytes: rawSnapshot?.length ?? 0,
    snapshotSavedAt: snapshot?.savedAt ?? null,
    changeEventsSeen,
    lastError,
  };
}
