
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Platform, Switch } from "react-native";
import { useAskBarScroll, useSettingsIsland } from "@/components/ui/AskBar/AskBarContext";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureDetector } from "react-native-gesture-handler";
import { theme } from "@/constants/theme";
import { User } from "@/models/User";
import database from "@/database/database";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import { getCaloriePlans } from "@/utils/GetCaloriePlans";
import { removeToken } from "@/api/AxiosInstance";
import DevMenu from "@/components/Testing/DevMenu";
import FadeTranslate from "@/components/ui/FadeTranslate";
import MuscleHeatmap from "@/components/ui/Profile/MuscleHeatmap";
import { computeWeeklyMuscleActivity, emptyActivity, type WeeklyMuscleActivity } from "@/utils/MuscleActivity";
import { showErrorToast } from "@/utils/toast";
import {
  OptionEditor,
  optionEditorHeight,
} from "@/components/ui/Profile/SettingEditors";
import {
  getUseNativeIosTabs,
  setUseNativeIosTabs,
  subscribeToNativeIosTabs,
} from "@/utils/tabBarPreference";

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
  const [useNativeIosTabs, setUseNativeIosTabsState] = useState(true);

  const [caloriePlans, setCaloriePlans] = useState<any[]>([]);
  const [activity, setActivity] = useState<WeeklyMuscleActivity>(emptyActivity());

  const refreshActivity = useCallback(async () => {
    try {
      const userId = await getUserIdFromToken();
      if (!userId) return;
      const act = await computeWeeklyMuscleActivity(database, userId);
      setActivity(act);
    } catch (e) { console.log(e); }
  }, []);

  const fitnessLevels = ["Beginner", "Intermediate", "Advanced", "Gym Enthusiast"];
  const equipmentOptions = [
    { label: "Home Workouts", value: "Home Workouts" },
    { label: "Basic Equipment", value: "Basic Equipment" },
    { label: "Gym Access", value: "Gym Access" },
  ];

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const unsubscribe = subscribeToNativeIosTabs(setUseNativeIosTabsState);
    getUseNativeIosTabs().then(setUseNativeIosTabsState).catch(() => undefined);

    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const userId = await getUserIdFromToken();
          if (!userId) { router.replace("/WelcomeScreen"); return; }
          const act = await computeWeeklyMuscleActivity(database, userId);
          if (active) setActivity(act);
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

  // After any setting change: close the island + refresh first, then celebrate.
  const finishEdit = useCallback(() => {
    island.close();
    loadUserData();
    setTimeout(() => island.celebrate(), 500);
  }, [island]);

  const saveFitness = async (level: string) => {
    try {
      const user = await User.getUserDetails(database);
      if (!user) return;
      await database.write(async () => { await user.update((u) => { u.fitnessLevel = level; }); });
      finishEdit();
    } catch { showErrorToast("Update failed", "Could not update your fitness level."); }
  };

  const saveEquipment = async (val: string) => {
    try {
      const user = await User.getUserDetails(database);
      if (!user) return;
      await database.write(async () => { await user.update((u) => { u.equipmentAccess = val; }); });
      finishEdit();
    } catch { showErrorToast("Update failed", "Could not update your equipment."); }
  };

  const saveCalorie = async (plan: any) => {
    try {
      const user = await User.getUserDetails(database);
      if (!user) return;
      await database.write(async () => {
        await user.update((u) => { u.goal = plan.type; u.caloricIntake = plan.caloriesPerDay; });
      });
      finishEdit();
    } catch { showErrorToast("Update failed", "Could not update your calorie plan."); }
  };

  // --- Island openers ---

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
      Math.min(optionEditorHeight(Math.max(opts.length, 1), true), 440)
    );
  };

  if (loading) return <View style={s.center}><Text style={{ color: "#fff" }}>Loading...</Text></View>;

  return (
    <View style={s.container}>
      <GestureDetector gesture={askScroll.pullGesture}>
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 92, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScrollBeginDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => askScroll.onScrollBeginDrag(e.nativeEvent.contentOffset.y)}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => askScroll.onScroll(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => askScroll.onScrollEndDrag(e.nativeEvent.contentOffset.y)}
      >
        {/* -- Top Bar -- */}
        <FadeTranslate order={0}>
          <View style={s.topBar}>
            <View style={s.topBarLeft}>
              <DevMenu onWorkoutLogged={refreshActivity} />
              <Text style={s.screenTitle}>Profile</Text>
            </View>
          </View>
        </FadeTranslate>

        {/* -- Weekly Muscle Heatmap -- */}
        <FadeTranslate order={0.1} delay={50}>
          <MuscleHeatmap activity={activity} />
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

        {Platform.OS === "ios" && (
          <FadeTranslate order={0.4} delay={230}>
            <Text style={s.sectionTitle}>Testing</Text>
            <View style={s.group}>
              <View style={s.row}>
                <View style={s.rowIcon}>
                  <Ionicons name="phone-portrait-outline" size={17} color={D.primary} />
                </View>
                <View style={s.testingCopy}>
                  <Text style={s.rowLabel}>iOS tab style</Text>
                  <Text style={s.testingValue}>
                    {useNativeIosTabs ? "Native tabs" : "Android-style tabs"}
                  </Text>
                </View>
                <Switch
                  value={useNativeIosTabs}
                  onValueChange={(value) => {
                    setUseNativeIosTabsState(value);
                    setUseNativeIosTabs(value).catch(() => undefined);
                  }}
                  trackColor={{ false: "#3A3A3C", true: D.primary }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#3A3A3C"
                  accessibilityLabel="Use native iOS tabs"
                />
              </View>
            </View>
          </FadeTranslate>
        )}

      </ScrollView>
      </GestureDetector>
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

  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 4 },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  screenTitle: { fontFamily: theme.black, color: "#FFF", fontSize: 24, letterSpacing: -0.5 },

  sectionTitle: { fontSize: 12, fontFamily: theme.bold, color: D.sub, letterSpacing: 1, textTransform: "uppercase", marginTop: 24, marginBottom: 10, marginLeft: 4 },

  group: { backgroundColor: D.card, borderRadius: 16, borderWidth: 1, borderColor: D.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 56 },
  rowIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: "rgba(170,251,5,0.10)", alignItems: "center", justifyContent: "center", marginRight: 14 },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: theme.medium, color: D.text },
  rowValue: { fontSize: 15, fontFamily: theme.medium, color: D.sub, textTransform: "capitalize", maxWidth: 150 },
  testingCopy: { flex: 1 },
  testingValue: { fontSize: 12, fontFamily: theme.medium, color: D.sub, marginTop: 2 },
  rowDivider: { position: "absolute", bottom: 0, left: 58, right: 0, height: 1, backgroundColor: D.border },
});
