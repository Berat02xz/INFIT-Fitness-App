
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useAskBarScroll } from "@/components/ui/AskBar/AskBarContext";
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
import UnitSwitch from "@/components/ui/UnitSwitch";
import DevMenu from "@/components/Testing/DevMenu";
import FadeTranslate from "@/components/ui/FadeTranslate";
import MuscleHeatmap from "@/components/ui/Profile/MuscleHeatmap";
import { computeWeeklyMuscleActivity, emptyActivity, type WeeklyMuscleActivity } from "@/utils/MuscleActivity";
import { BottomSheetModal, BottomSheetView, BottomSheetTextInput, BottomSheetScrollView } from "@gorhom/bottom-sheet";

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
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isPro } = useProStatus();

  // Bottom Sheet Modal refs
  const weightSheetRef = useRef<BottomSheetModal>(null);
  const heightSheetRef = useRef<BottomSheetModal>(null);
  const ageSheetRef = useRef<BottomSheetModal>(null);
  const fitnessSheetRef = useRef<BottomSheetModal>(null);
  const equipmentSheetRef = useRef<BottomSheetModal>(null);
  const calorieSheetRef = useRef<BottomSheetModal>(null);

  // Modals state
  const [adjustedWeight, setAdjustedWeight] = useState(0);

  const [adjustedHeightFeet, setAdjustedHeightFeet] = useState(0);
  const [adjustedHeightInches, setAdjustedHeightInches] = useState(0);
  const [adjustedHeightCm, setAdjustedHeightCm] = useState(0);

  const [adjustedAge, setAdjustedAge] = useState(0);

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

          // Weekly muscle activity (for the heatmap)
          const act = await computeWeeklyMuscleActivity(database, userId);
          if (active) setActivity(act);

          // Calorie streak (consecutive days hitting intake)
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

        // Initialize Modal Values
        setAdjustedWeight(user.weight);
        setAdjustedAge(user.age);

        if (user.unit === "imperial") {
            const totalInches = parseFloat(user.height);
            setAdjustedHeightFeet(Math.floor(totalInches / 12));
            setAdjustedHeightInches(Math.round(totalInches % 12));
            setAdjustedHeightCm(0); // Clear metric
        } else {
            setAdjustedHeightCm(parseFloat(user.height));
            setAdjustedHeightFeet(0);
            setAdjustedHeightInches(0);
        }

        // Calculate calorie plans
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

        const plans = getCaloriePlans(userDataFormatted);
        setCaloriePlans(plans);
  };

  const handleLogout = () => {
    LogoutUser();
  };

  // --- Handlers ---

  const handleUpdateUnit = async (newUnit: "metric" | "imperial") => {
    if (newUnit === userData?.unit) return;
    try {
        const user = await User.getUserDetails(database);
        if(!user) return;

        let newWeight = user.weight;
        let newHeight = user.height;

        // Convert values
        if (newUnit === "imperial" && user.unit === "metric") {
            // Metric to Imperial
            newWeight = parseFloat( (user.weight * 2.20462).toFixed(1) );
            newHeight = (parseFloat(user.height) / 2.54).toString(); // cm to inches
        } else if (newUnit === "metric" && user.unit === "imperial") {
            // Imperial to Metric
            newWeight = parseFloat( (user.weight / 2.20462).toFixed(1) );
            newHeight = (parseFloat(user.height) * 2.54).toFixed(0); // inches to cm
        }

        await database.write(async () => {
            await user.update(u => {
                u.unit = newUnit;
                u.weight = newWeight;
                u.height = newHeight;
            });
        });

        // Reload locally
        loadUserData();

    } catch (e) {
        Alert.alert("Error", "Failed to update unit preference");
    }
  };

  const handleUpdateWeight = async () => {
    if (!userData) return;
    try {
        const user = await User.getUserDetails(database);
        if (user) {
             const newBMI = CalculateBMI(
                userData.unit,
                adjustedWeight.toString(),
                userData.height
             );
             await database.write(async () => {
                 await user.update(u => {
                     u.weight = adjustedWeight;
                     u.bmi = newBMI;
                 });
             });
             weightSheetRef.current?.dismiss();
             loadUserData(); // refresh UI
        }
    } catch(e) { Alert.alert("Error", "Could not update weight"); }
  };

  const handleUpdateHeight = async () => {
     if (!userData) return;
     try {
         let heightToSave = "";
         if (userData.unit === "imperial") {
             heightToSave = ((adjustedHeightFeet * 12) + adjustedHeightInches).toString();
         } else {
             heightToSave = adjustedHeightCm.toString();
         }

         const user = await User.getUserDetails(database);
         if (user) {
             const newBMI = CalculateBMI(
                userData.unit,
                userData.weight.toString(),
                heightToSave
             );
             await database.write(async () => {
                 await user.update(u => {
                     u.height = heightToSave;
                     u.bmi = newBMI;
                 });
             });
             heightSheetRef.current?.dismiss();
             loadUserData();
         }
     } catch(e) { Alert.alert("Error", "Could not update height"); }
  };

  const handleUpdateAge = async () => {
      if (!userData) return;
      try {
          const user = await User.getUserDetails(database);
          if (user) {
              await database.write(async () => {
                  await user.update(u => { u.age = adjustedAge; });
              });
              ageSheetRef.current?.dismiss();
              loadUserData();
          }
      } catch(e) { Alert.alert("Error", "Could not update age"); }
  };

  const handleUpdateFitnessLevel = async (level: string) => {
        try {
            const user = await User.getUserDetails(database);
            if (user) {
                await database.write(async () => { await user.update(u => { u.fitnessLevel = level; }); });
                fitnessSheetRef.current?.dismiss();
                loadUserData();
            }
        } catch(e) { Alert.alert("Error", "Failed to update fitness level"); }
  };

  const handleUpdateEquipment = async (val: string) => {
      try {
            const user = await User.getUserDetails(database);
            if (user) {
                await database.write(async () => { await user.update(u => { u.equipmentAccess = val; }); });
                equipmentSheetRef.current?.dismiss();
                loadUserData();
            }
        } catch(e) { Alert.alert("Error", "Failed to update equipment"); }
  };

  const handleUpdateCaloriePlan = async (plan: any) => {
      try {
          const user = await User.getUserDetails(database);
          if (user) {
              await database.write(async () => {
                  await user.update(u => {
                      u.goal = plan.type;
                      u.caloricIntake = plan.caloriesPerDay;
                  });
              });
              calorieSheetRef.current?.dismiss();
              loadUserData();
          }
      } catch(e) { Alert.alert("Error", "Failed to update calorie plan"); }
  };

  // Formatters
  const formatHeight = () => {
     if(!userData?.height) return "-";
     if(userData.unit === "metric") return `${userData.height} cm`;
     const total = parseFloat(userData.height);
     if (isNaN(total)) return "-";
     return `${Math.floor(total/12)}'${Math.round(total%12)}"`;
  };
  const formatWeight = () => userData?.weight ? `${userData.weight} ${userData.unit === "metric" ? "kg" : "lbs"}` : "-";

  if (loading) return <View style={s.center}><Text style={{color:"#fff"}}>Loading...</Text></View>;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={[
          s.scrollContent,
          { paddingTop: insets.top + 92, paddingBottom: insets.bottom + 100 },
        ]}
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
                    <Text style={s.streakText}>{streak} Day{streak !== 1 ? 's' : ''}</Text>
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
                <SettingsRow icon="scale-outline" label="Weight" value={formatWeight()} onPress={() => weightSheetRef.current?.present()} />
                <SettingsRow icon="resize-outline" label="Height" value={formatHeight()} onPress={() => {
                    if (userData.unit === "imperial") {
                        const total = parseFloat(userData.height);
                        setAdjustedHeightFeet(Math.floor(total/12));
                        setAdjustedHeightInches(Math.round(total%12));
                    } else {
                        setAdjustedHeightCm(parseFloat(userData.height));
                    }
                    heightSheetRef.current?.present();
                }} />
                <SettingsRow icon="calendar-outline" label="Age" value={`${userData?.age} yrs`} onPress={() => {
                    setAdjustedAge(userData.age);
                    ageSheetRef.current?.present();
                }} />
                <SettingsRow icon="body-outline" label="BMI" value={userData?.bmi ? Number(userData.bmi).toFixed(1) : "-"} isLast />
            </View>
        </FadeTranslate>

        {/* -- Training -- */}
        <FadeTranslate order={0.3} delay={190}>
            <Text style={s.sectionTitle}>Training</Text>
            <View style={s.group}>
                <SettingsRow icon="barbell-outline" label="Fitness Level" value={userData?.fitnessLevel} onPress={() => fitnessSheetRef.current?.present()} />
                <SettingsRow icon="fitness-outline" label="Equipment" value={userData?.equipmentAccess} onPress={() => equipmentSheetRef.current?.present()} />
                <SettingsRow icon="flame-outline" label="Daily Calories" value={`${userData?.caloricIntake} kcal`} onPress={() => {
                    refreshCaloriePlans(userData);
                    calorieSheetRef.current?.present();
                }} isLast />
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
                <TouchableOpacity
                    style={s.upgradeAccountBtn}
                    activeOpacity={0.8}
                    onPress={() => router.push("/SubscriptionCheck")}
                >
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

       {/* -- Bottom Sheet Modals -- */}

      {/* Weight Sheet */}
      <BottomSheetModal
        ref={weightSheetRef}
        enableDynamicSizing
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetView style={[s.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
           <Text style={s.modalTitle}>Edit Weight</Text>
           <View style={s.inputContainer}>
               <View style={{alignSelf: 'center', marginBottom: 10}}>
                    <UnitSwitch
                        unit={userData?.unit || "metric"}
                        onSelect={handleUpdateUnit}
                        metricLabel="Kg"
                        imperialLabel="Lbs"
                    />
               </View>
               <BottomSheetTextInput
                  style={s.textInput}
                  keyboardType="numeric"
                  value={adjustedWeight.toString()}
                  onChangeText={(t) => setAdjustedWeight(parseFloat(t) || 0)}
               />
               <TouchableOpacity style={s.saveBtn} onPress={handleUpdateWeight}>
                   <Text style={s.saveBtnText}>Save Weight</Text>
               </TouchableOpacity>
           </View>
        </BottomSheetView>
      </BottomSheetModal>

      {/* Height Sheet */}
      <BottomSheetModal
        ref={heightSheetRef}
        enableDynamicSizing
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetView style={[s.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
           <Text style={s.modalTitle}>Edit Height</Text>
           <View style={s.inputContainer}>
                <View style={{alignSelf: 'center', marginBottom: 10}}>
                    <UnitSwitch
                        unit={userData?.unit || "metric"}
                        onSelect={handleUpdateUnit}
                        metricLabel="Cm"
                        imperialLabel="Ft/In"
                    />
               </View>
               {userData?.unit === "imperial" ? (
                   <View style={s.rowInputs}>
                       <View style={{flex:1}}>
                           <Text style={s.label}>Feet</Text>
                           <BottomSheetTextInput
                              style={s.textInput}
                              keyboardType="numeric"
                              value={adjustedHeightFeet.toString()}
                              onChangeText={(t) => setAdjustedHeightFeet(parseFloat(t) || 0)}
                           />
                       </View>
                       <View style={{flex:1}}>
                           <Text style={s.label}>Inches</Text>
                           <BottomSheetTextInput
                              style={s.textInput}
                              keyboardType="numeric"
                              value={adjustedHeightInches.toString()}
                              onChangeText={(t) => setAdjustedHeightInches(parseFloat(t) || 0)}
                           />
                       </View>
                   </View>
               ) : (
                   <View>
                        <Text style={s.label}>Centimeters</Text>
                        <BottomSheetTextInput
                            style={s.textInput}
                            keyboardType="numeric"
                            value={adjustedHeightCm.toString()}
                            onChangeText={(t) => setAdjustedHeightCm(parseFloat(t) || 0)}
                        />
                   </View>
               )}

               <TouchableOpacity style={s.saveBtn} onPress={handleUpdateHeight}>
                   <Text style={s.saveBtnText}>Save Height</Text>
               </TouchableOpacity>
           </View>
        </BottomSheetView>
      </BottomSheetModal>

      {/* Age Sheet */}
      <BottomSheetModal
        ref={ageSheetRef}
        enableDynamicSizing
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetView style={[s.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
           <Text style={s.modalTitle}>Edit Age</Text>
           <View style={s.inputContainer}>
               <BottomSheetTextInput
                  style={s.textInput}
                  keyboardType="numeric"
                  value={adjustedAge.toString()}
                  onChangeText={(t) => setAdjustedAge(parseFloat(t) || 0)}
               />
               <TouchableOpacity style={s.saveBtn} onPress={handleUpdateAge}>
                   <Text style={s.saveBtnText}>Save Age</Text>
               </TouchableOpacity>
           </View>
        </BottomSheetView>
      </BottomSheetModal>

      {/* Fitness Level Sheet */}
      <BottomSheetModal
        ref={fitnessSheetRef}
        enableDynamicSizing
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetView style={[s.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
           <Text style={s.modalTitle}>Fitness Level</Text>
           {fitnessLevels.map(l => (
               <TouchableOpacity key={l} style={s.modalOpt} onPress={()=>handleUpdateFitnessLevel(l)}>
                   <Text style={s.modalOptText}>{l}</Text>
                   {userData?.fitnessLevel === l && <Ionicons name="checkmark" size={16} color={D.primary} />}
               </TouchableOpacity>
           ))}
        </BottomSheetView>
      </BottomSheetModal>

      {/* Equipment Sheet */}
      <BottomSheetModal
        ref={equipmentSheetRef}
        enableDynamicSizing
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetView style={[s.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
           <Text style={s.modalTitle}>Equipment</Text>
           {equipmentOptions.map(l => (
               <TouchableOpacity key={l.value} style={s.modalOpt} onPress={()=>handleUpdateEquipment(l.value)}>
                   <Text style={s.modalOptText}>{l.label}</Text>
                   {userData?.equipmentAccess === l.value && <Ionicons name="checkmark" size={16} color={D.primary} />}
               </TouchableOpacity>
           ))}
        </BottomSheetView>
      </BottomSheetModal>

      {/* Calorie Plan Sheet */}
      <BottomSheetModal
        ref={calorieSheetRef}
        enableDynamicSizing
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetScrollView style={[s.sheetScrollContent, { paddingBottom: insets.bottom + 24 }]}>
           <Text style={s.modalTitle}>Select Goal</Text>
           {caloriePlans.length > 0 ? (
               caloriePlans.map((plan, index) => (
                   <TouchableOpacity
                       key={index}
                       style={[
                           s.modalOpt,
                           userData?.goal === plan.type && {
                               borderColor: D.primary,
                               borderWidth: 1,
                               backgroundColor: "rgba(170,251,5,0.1)",
                               borderRadius: 12,
                               borderBottomWidth: 1,
                               paddingHorizontal: 12,
                               marginVertical: 4,
                               borderBottomColor: D.primary,
                           }
                       ]}
                       onPress={() => handleUpdateCaloriePlan(plan)}
                   >
                       <View style={{flex:1}}>
                           <Text style={s.modalOptText}>{plan.type || "Plan"}</Text>
                           <Text style={s.modalSubText}>{plan.caloriesPerDay} kcal/day</Text>
                       </View>

                       {plan.rate ? (
                           <View style={{backgroundColor: D.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 10}}>
                                <Text style={{color: "#000", fontFamily: theme.bold, fontSize: 12}}>{plan.rate}</Text>
                           </View>
                       ) : null}

                       {userData?.goal === plan.type && <View style={{marginLeft: 10}}><Ionicons name="checkmark-circle" size={20} color={D.primary} /></View>}
                   </TouchableOpacity>
               ))
           ) : (
               <Text style={{color: D.sub, textAlign: "center", padding: 20}}>
                   Ensure your height, weight, and age are set correctly to see plans.
               </Text>
           )}
        </BottomSheetScrollView>
      </BottomSheetModal>

    </View>
  );
}

// Subcomponents
const SettingsRow = ({ icon, label, value, onPress, isLast }: any) => (
    <TouchableOpacity
        style={s.row}
        onPress={onPress}
        activeOpacity={onPress ? 0.6 : 1}
        disabled={!onPress}
    >
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
    scrollContent: {
        paddingHorizontal: 20,
        maxWidth: 768,
        width: "100%",
        alignSelf: "center",
    },
    center: { flex:1, alignItems:"center", justifyContent:"center", backgroundColor:D.bg},

    // Top Bar
    topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, marginTop: 4 },
    topBarLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    screenTitle: { fontFamily: theme.black, color: "#FFF", fontSize: 24, letterSpacing: -0.5 },
    streakPill: {
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 7,
    },
    streakText: { fontSize: 13, fontFamily: theme.bold, color: "rgba(255,255,255,0.85)" },

    // Sections
    sectionTitle: {
        fontSize: 12, fontFamily: theme.bold, color: D.sub,
        letterSpacing: 1, textTransform: "uppercase",
        marginTop: 24, marginBottom: 10, marginLeft: 4,
    },

    // iOS-style grouped settings
    group: {
        backgroundColor: D.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: D.border,
        overflow: "hidden",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        height: 56,
    },
    rowIcon: {
        width: 30, height: 30, borderRadius: 9,
        backgroundColor: "rgba(170,251,5,0.10)",
        alignItems: "center", justifyContent: "center",
        marginRight: 14,
    },
    rowLabel: { flex: 1, fontSize: 15, fontFamily: theme.medium, color: D.text },
    rowValue: { fontSize: 15, fontFamily: theme.medium, color: D.sub, textTransform: "capitalize", maxWidth: 150 },
    rowDivider: {
        position: "absolute", bottom: 0, left: 58, right: 0,
        height: 1, backgroundColor: D.border,
    },

    // Account buttons
    proAccountBtn: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(170,251,5,0.12)", padding: 16, borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1, borderColor: "rgba(170,251,5,0.4)",
    },
    proAccountText: { fontSize: 15, fontFamily: theme.bold, color: D.primary },

    upgradeAccountBtn: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(255,255,255,0.05)", padding: 16, borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
    },
    upgradeAccountText: { fontSize: 15, fontFamily: theme.bold, color: "#fff" },

    logoutRow: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(255,69,58,0.1)", padding: 16, borderRadius: 16
    },
    logoutText: { fontSize: 15, fontFamily: theme.bold, color: "#FF453A" },

    // Bottom Sheet
    sheetBg: { backgroundColor: "#1C1C1E", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    sheetHandle: { backgroundColor: "#555", width: 40 },
    sheetContent: { padding: 24 },
    sheetScrollContent: { padding: 24, maxHeight: 500 },
    modalTitle: { fontSize: 18, fontFamily: theme.bold, color: "#FFF", marginBottom: 20 },
    modalOpt: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#333", alignItems:"center" },
    modalOptText: { fontSize: 16, color: "#FFF", fontFamily: theme.medium },
    modalSubText: { fontSize: 12, color: D.sub, fontFamily: theme.regular, marginTop: 2 },

    // Inputs
    inputContainer: { gap: 16 },
    rowInputs: { flexDirection: "row", gap: 12 },
    label: { color: D.sub, marginBottom: 6, fontSize: 12 },
    textInput: {
        backgroundColor: "#222", color: "#FFF", padding: 16, borderRadius: 12, fontSize: 16, fontFamily: theme.bold,
        borderWidth: 1, borderColor: "#333"
    },
    saveBtn: { backgroundColor: D.primary, padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
    saveBtnText: { color: "#000", fontFamily: theme.bold, fontSize: 16 },
});
