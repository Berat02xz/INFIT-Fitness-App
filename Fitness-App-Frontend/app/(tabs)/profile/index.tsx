
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useAskBarScroll, useSettingsIsland } from "@/components/ui/AskBar/AskBarContext";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import { User } from "@/models/User";
import { Meal } from "@/models/Meals";
import database from "@/database/database";
import CalculateBMI from "@/utils/CalculateBMI";
import { useProStatus } from "@/hooks/useProStatus";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import { getCaloriePlans } from "@/utils/GetCaloriePlans";
import { LogoutUser } from "@/api/UserDataEndpoint";
import { removeToken } from "@/api/AxiosInstance";
import DevMenu from "@/components/Testing/DevMenu";
import FadeTranslate from "@/components/ui/FadeTranslate";
import MuscleHeatmap from "@/components/ui/Profile/MuscleHeatmap";
import { computeWeeklyMuscleActivity, emptyActivity, type WeeklyMuscleActivity } from "@/utils/MuscleActivity";
import {
  WeightEditor,
  HeightEditor,
  AgeEditor,
  OptionEditor,
  RULER_EDITOR_HEIGHT,
  optionEditorHeight,
} from "@/components/ui/Profile/SettingEditors";

type Unit = "metric" | "imperial";

// --- Design Tokens ---
const D = {
  bg: "#000000",
  card: "#101012",
  cardAlt: "#1C1C1E",
  primary: "#AAFB05",
  text: "#FFFFFF",
  sub: "#6C6C70",
  border: "#1F1F22",
};

export default function Profile() {
  const insets = useSafeAreaInsets();
  const askScroll = useAskBarScroll();
  const island = useSettingsIsland();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isPro } = useProStatus();

  const [caloriePlans, setCaloriePlans] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [activity, setActivity] = useState<WeeklyMuscleActivity>(emptyActivity());

  const fitnessLevels = ["Beginner", "Intermediate", "Advanced", "Gym Enthusiast"];
  const equipmentOptions = [
    { label: "Home Workouts", value: "Home Workouts" },
    { label: "Basic Equipment", value: "Basic Equipment" },
    { label: "Gym Access", value: "Gym Access" },
  ];

  useEffect(() => {
    loadUserData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const userId = await getUserIdFromToken();
          if (!userId) {
            router.replace("/WelcomeScreen");
            return;
          }
          const act = await computeWeeklyMuscleActivity(database, userId);
          if (active) setActivity(act);

          const today = new Date();
          const currentDay = today.getDay();
          const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
          const monday = new Date(today);
          monday.setDate(diff);
          let st = 0;
          for (let i = currentDay; i >= 0; i--) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const ok = await Meal.DaySuccesfulCalorieIntake(database, userId, d);
            if (ok) st++;
            else if (i !== currentDay) break;
          }
          if (active) setStreak(st);
        } catch (e) { console.log(e); }
      })();
      return () => { active = false; };
    }, [])
  );

  const loadUserData = async () => {
    try {
      const user = await User.getUserDetails(database);
      if (user) {
        setUserData({
          name: user.name,
          email: user.email,
          weight: user.weight,
          height: user.height,
          age: user.age,
          gender: user.gender,
          bmi: user.bmi,
          fitnessLevel: user.fitnessLevel,
          equipmentAccess: user.equipmentAccess,
          activityLevel: user.activityLevel,
          goal: user.goal,
          caloricIntake: user.caloricIntake,
          role: user.role,
          unit: user.unit,
        });
        refreshCaloriePlans(user);
      } else {
        await removeToken();
        router.replace("/WelcomeScreen");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshCaloriePlans = (user: any) => {
    const userDataFormatted = {
      age: Number(user.age),
      sex: String(user.gender),
      height: user.height,
      weight: Number(user.weight),
      unit: String(user.unit),
      activity_level: String(user.activityLevel || "Sedentary"),
    };
    setCaloriePlans(getCaloriePlans(userDataFormatted));
  };

  const handleLogout = () => LogoutUser();

  // After any setting change: celebrate (avatar flip), close the island, refresh.
  const finishEdit = useCallback(() => {
    island.celebrate();
    island.close();
    loadUserData();
  }, [island]);

  // --- Save handlers (called by the island editors) ---

  const saveWeight = async (weight: number, unit: Unit) => {
    try {
      const user = await User.getUserDetails(database);
      if (!user) return;
      // Unit is global — if it changed, convert height too so the DB stays consistent.
      let height = user.height;
      if (unit !== user.unit) {
        const cm = parseFloat(user.height);
        height = unit === "imperial" ? (cm / 2.54).toFixed(0) : (cm * 2.54).toFixed(0);
      }
      const bmi = CalculateBMI(unit, weight.toString(), height);
      await database.write(async () => {
        await user.update((u) => { u.unit = unit; u.weight = weight; u.height = height; u.bmi = bmi; });
      });
      finishEdit();
    } catch { Alert.alert("Error", "Could not update weight"); }
  };

  const saveHeight = async (value: number, unit: Unit) => {
    try {
      const user = await User.getUserDetails(database);
      if (!user) return;
      let weight = user.weight;
      if (unit !== user.unit) {
        weight = unit === "imperial"
          ? parseFloat((user.weight * 2.20462).toFixed(1))
          : parseFloat((user.weight / 2.20462).toFixed(1));
      }
      const heightStr = value.toString();
      const bmi = CalculateBMI(unit, weight.toString(), heightStr);
      await database.write(async () => {
        await user.update((u) => { u.unit = unit; u.height = heightStr; u.weight = weight; u.bmi = bmi; });
      });
      finishEdit();
    } catch { Alert.alert("Error", "Could not update height"); }
  };

  const saveAge = async (age: number) => {
    try {
      const user = await User.getUserDetails(database);
      if (!user) return;
      await database.write(async () => { await user.update((u) => { u.age = age; }); });
      finishEdit();
    } catch { Alert.alert("Error", "Could not update age"); }
  };

  const saveFitness = async (level: string) => {
    try {
      const user = await User.getUserDetails(database);
      if (!user) return;
      await database.write(async () => { await user.update((u) => { u.fitnessLevel = level; }); });
      finishEdit();
    } catch { Alert.alert("Error", "Failed to update fitness level"); }
  };

  const saveEquipment = async (val: string) => {
    try {
      const user = await User.getUserDetails(database);
      if (!user) return;
      await database.write(async () => { await user.update((u) => { u.equipmentAccess = val; }); });
      finishEdit();
    } catch { Alert.alert("Error", "Failed to update equipment"); }
  };

  const saveCalorie = async (plan: any) => {
    try {
      const user = await User.getUserDetails(database);
      if (!user) return;
      await database.write(async () => {
        await user.update((u) => { u.goal = plan.type; u.caloricIntake = plan.caloriesPerDay; });
      });
      finishEdit();
    } catch { Alert.alert("Error", "Failed to update calorie plan"); }
  };

  // --- Island openers ---
  const unitOf = (): Unit => (userData?.unit === "imperial" ? "imperial" : "metric");

  const openWeight = () =>
    island.open(
      <WeightEditor initialWeight={Number(userData.weight) || 0} initialUnit={unitOf()} onSave={saveWeight} />,
      RULER_EDITOR_HEIGHT
    );

  const openHeight = () =>
    island.open(
      <HeightEditor initialValue={parseFloat(userData.height) || 0} initialUnit={unitOf()} onSave={saveHeight} />,
      RULER_EDITOR_HEIGHT
    );

  const openAge = () =>
    island.open(<AgeEditor initialAge={Number(userData.age) || 0} onSave={saveAge} />, RULER_EDITOR_HEIGHT);

  const openFitness = () =>
    island.open(
      <OptionEditor
        title="Fitness Level"
        options={fitnessLevels.map((l) => ({ label: l, value: l }))}
        selectedValue={userData?.fitnessLevel}
        onSelect={saveFitness}
      />,
      optionEditorHeight(fitnessLevels.length)
    );

  const openEquipment = () =>
    island.open(
      <OptionEditor
        title="Equipment"
        options={equipmentOptions}
        selectedValue={userData?.equipmentAccess}
        onSelect={saveEquipment}
      />,
      optionEditorHeight(equipmentOptions.length)
    );

  const openCalorie = () => {
    const opts = caloriePlans.map((p) => ({
      label: p.type || "Plan",
      value: p.type,
      sub: `${p.caloriesPerDay} kcal/day`,
      badge: p.rate || undefined,
    }));
    island.open(
      <OptionEditor
        title="Daily Goal"
        options={opts}
        selectedValue={userData?.goal}
        onSelect={(type) => {
          const plan = caloriePlans.find((p) => p.type === type);
          if (plan) saveCalorie(plan);
        }}
      />,
      Math.min(optionEditorHeight(Math.max(opts.length, 1)), 440)
    );
  };

  // Formatters
  const formatHeight = () => {
    if (!userData?.height) return "-";
    if (userData.unit === "metric") return `${userData.height} cm`;
    const total = parseFloat(userData.height);
    if (isNaN(total)) return "-";
    return `${Math.floor(total / 12)}'${Math.round(total % 12)}"`;
  };
  const formatWeight = () => userData?.weight ? `${userData.weight} ${userData.unit === "metric" ? "kg" : "lbs"}` : "-";

  if (loading) return <View style={s.center}><Text style={{ color: "#fff" }}>Loading...</Text></View>;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 92, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => askScroll.onScroll(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => askScroll.onScrollEndDrag(e.nativeEvent.contentOffset.y)}
      >
        {/* -- Top Bar -- */}
        <FadeTranslate order={0}>
          <View style={s.topBar}>
            <View style={s.topBarLeft}>
              <DevMenu />
              <Text style={s.screenTitle}>Profile</Text>
            </View>
            <View style={s.streakPill}>
              <Text style={{ fontSize: 13 }}>🔥</Text>
              <Text style={s.streakText}>{streak} Day{streak !== 1 ? "s" : ""}</Text>
            </View>
          </View>
        </FadeTranslate>

        {/* -- Weekly Muscle Heatmap -- */}
        <FadeTranslate order={0.1} delay={50}>
          <MuscleHeatmap activity={activity} />
        </FadeTranslate>

        {/* -- Body -- */}
        <FadeTranslate order={0.2} delay={120}>
          <Text style={s.sectionTitle}>Body</Text>
          <View style={s.group}>
            <SettingsRow icon="scale-outline" label="Weight" value={formatWeight()} onPress={openWeight} />
            <SettingsRow icon="resize-outline" label="Height" value={formatHeight()} onPress={openHeight} />
            <SettingsRow icon="calendar-outline" label="Age" value={`${userData?.age} yrs`} onPress={openAge} />
            <SettingsRow icon="body-outline" label="BMI" value={userData?.bmi ? Number(userData.bmi).toFixed(1) : "-"} isLast />
          </View>
        </FadeTranslate>

        {/* -- Training -- */}
        <FadeTranslate order={0.3} delay={190}>
          <Text style={s.sectionTitle}>Training</Text>
          <View style={s.group}>
            <SettingsRow icon="barbell-outline" label="Fitness Level" value={userData?.fitnessLevel} onPress={openFitness} />
            <SettingsRow icon="fitness-outline" label="Equipment" value={userData?.equipmentAccess} onPress={openEquipment} />
            <SettingsRow icon="flame-outline" label="Daily Calories" value={`${userData?.caloricIntake} kcal`} onPress={openCalorie} isLast />
          </View>
        </FadeTranslate>

        {/* -- Account -- */}
        <FadeTranslate order={0.4} delay={260}>
          <Text style={s.sectionTitle}>Account</Text>

          {isPro ? (
            <View style={s.proAccountBtn}>
              <Ionicons name="star" size={20} color={D.primary} />
              <Text style={s.proAccountText}>Pro Member</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.upgradeAccountBtn} activeOpacity={0.8} onPress={() => router.push("/SubscriptionCheck")}>
              <Ionicons name="sparkles" size={20} color={D.primary} />
              <Text style={s.upgradeAccountText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.logoutRow} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FF453A" />
            <Text style={s.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </FadeTranslate>
      </ScrollView>
    </View>
  );
}

// Subcomponents
const SettingsRow = ({ icon, label, value, onPress, isLast }: any) => (
  <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={onPress ? 0.6 : 1} disabled={!onPress}>
    <View style={s.rowIcon}>
      <Ionicons name={icon} size={17} color={D.primary} />
    </View>
    <Text style={s.rowLabel}>{label}</Text>
    <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
    {onPress ? <Ionicons name="chevron-forward" size={16} color={D.sub} style={{ marginLeft: 4 }} /> : null}
    {!isLast && <View style={s.rowDivider} />}
  </TouchableOpacity>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.bg },
  scrollContent: { paddingHorizontal: 20, maxWidth: 768, width: "100%", alignSelf: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: D.bg },

  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, marginTop: 4 },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  screenTitle: { fontFamily: theme.black, color: "#FFF", fontSize: 24, letterSpacing: -0.5 },
  streakPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  streakText: { fontSize: 13, fontFamily: theme.bold, color: "rgba(255,255,255,0.85)" },

  sectionTitle: { fontSize: 12, fontFamily: theme.bold, color: D.sub, letterSpacing: 1, textTransform: "uppercase", marginTop: 24, marginBottom: 10, marginLeft: 4 },

  group: { backgroundColor: D.card, borderRadius: 16, borderWidth: 1, borderColor: D.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 56 },
  rowIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: "rgba(170,251,5,0.10)", alignItems: "center", justifyContent: "center", marginRight: 14 },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: theme.medium, color: D.text },
  rowValue: { fontSize: 15, fontFamily: theme.medium, color: D.sub, textTransform: "capitalize", maxWidth: 150 },
  rowDivider: { position: "absolute", bottom: 0, left: 58, right: 0, height: 1, backgroundColor: D.border },

  proAccountBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(170,251,5,0.12)", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "rgba(170,251,5,0.4)" },
  proAccountText: { fontSize: 15, fontFamily: theme.bold, color: D.primary },
  upgradeAccountBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.05)", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  upgradeAccountText: { fontSize: 15, fontFamily: theme.bold, color: "#fff" },
  logoutRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,69,58,0.1)", padding: 16, borderRadius: 16 },
  logoutText: { fontSize: 15, fontFamily: theme.bold, color: "#FF453A" },
});
