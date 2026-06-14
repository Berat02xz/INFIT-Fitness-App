import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { theme } from "@/constants/theme";
import { User } from "@/models/User";
import database from "@/database/database";
import CalculateBMI from "@/utils/CalculateBMI";
import { saveProfilePicture, useProfilePicture } from "@/utils/profilePicture";
import { showErrorToast } from "@/utils/toast";
import { useSettingsIsland } from "@/components/ui/AskBar/AskBarContext";
import { useProStatus } from "@/hooks/useProStatus";
import { LogoutUser } from "@/api/UserDataEndpoint";
import { Paywall } from "@/components/ui/RevenueCat/Paywall";
import { CustomerCenter } from "@/components/ui/RevenueCat/CustomerCenter";
import {
  WeightEditor, HeightEditor, AgeEditor,
  RULER_EDITOR_HEIGHT,
} from "@/components/ui/Profile/SettingEditors";

type Unit = "metric" | "imperial";
const DEFAULT_AVATAR = require("@/assets/avatars/avatar1.jpg");

const D = {
  text: "#FFFFFF",
  sub: "rgba(255,255,255,0.42)",
  primary: "#AAFB05",
  border: "rgba(255,255,255,0.07)",
  pillBg: "rgba(255,255,255,0.06)",
  pillBorder: "rgba(255,255,255,0.09)",
};

export const PROFILE_CARD_HEIGHT = 350;

export default function UserProfileCard() {
  const island = useSettingsIsland();
  const proStatus = useProStatus();
  const isPro = proStatus.isPro;
  const profilePicUri = useProfilePicture();
  const [userData, setUserData] = useState<any>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showCustomerCenter, setShowCustomerCenter] = useState(false);

  const loadData = useCallback(async () => {
    const user = await User.getUserDetails(database);
    if (!user) return;
    setUserData({
      name: user.name, email: user.email,
      weight: user.weight, height: user.height,
      age: user.age, bmi: user.bmi, unit: user.unit,
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const pickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showErrorToast("Permission needed", "Allow photo library access to change your avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await saveProfilePicture(result.assets[0].uri);
    }
  }, []);

  const unitOf = (): Unit => (userData?.unit === "imperial" ? "imperial" : "metric");

  const finishEdit = useCallback(() => {
    island.close();
    setTimeout(() => island.celebrate(), 500);
  }, [island]);

  const saveWeight = useCallback(async (weight: number, unit: Unit) => {
    try {
      const user = await User.getUserDetails(database);
      if (!user) return;
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
    } catch { showErrorToast("Update failed", "Could not update your weight."); }
  }, [finishEdit]);

  const saveHeight = useCallback(async (value: number, unit: Unit) => {
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
    } catch { showErrorToast("Update failed", "Could not update your height."); }
  }, [finishEdit]);

  const saveAge = useCallback(async (age: number) => {
    try {
      const user = await User.getUserDetails(database);
      if (!user) return;
      await database.write(async () => { await user.update((u) => { u.age = age; }); });
      finishEdit();
    } catch { showErrorToast("Update failed", "Could not update your age."); }
  }, [finishEdit]);

  const openWeight = useCallback(() => {
    if (!userData) return;
    island.open(
      <WeightEditor initialWeight={Number(userData.weight) || 0} initialUnit={unitOf()} onSave={saveWeight} />,
      RULER_EDITOR_HEIGHT,
    );
  }, [userData, island, saveWeight]);

  const openHeight = useCallback(() => {
    if (!userData) return;
    island.open(
      <HeightEditor initialValue={parseFloat(userData.height) || 0} initialUnit={unitOf()} onSave={saveHeight} />,
      RULER_EDITOR_HEIGHT,
    );
  }, [userData, island, saveHeight]);

  const openAge = useCallback(() => {
    if (!userData) return;
    island.open(<AgeEditor initialAge={Number(userData.age) || 0} onSave={saveAge} />, RULER_EDITOR_HEIGHT);
  }, [userData, island, saveAge]);

  const formatWeight = () =>
    userData?.weight ? `${userData.weight} ${userData.unit === "metric" ? "kg" : "lbs"}` : "-";

  const formatHeight = () => {
    if (!userData?.height) return "-";
    if (userData.unit === "metric") return `${userData.height} cm`;
    const total = parseFloat(userData.height);
    if (isNaN(total)) return "-";
    return `${Math.floor(total / 12)}'${Math.round(total % 12)}"`;
  };

  if (!userData) {
    return (
      <View style={st.loading}>
        <ActivityIndicator color={D.primary} />
      </View>
    );
  }

  return (
    <View style={st.container}>
      <View style={st.profileContent}>
        <TouchableOpacity
          style={st.avatarWrap}
          onPress={pickPhoto}
          activeOpacity={0.75}
          accessibilityLabel="Change profile picture"
        >
          <Image source={profilePicUri ? { uri: profilePicUri } : DEFAULT_AVATAR} style={st.avatar} />
          <View style={st.cameraBadge}>
            <Ionicons name="camera" size={11} color="#0C0D0F" />
          </View>
        </TouchableOpacity>

        <Text style={st.nameText}>{userData.name || "Your profile"}</Text>
        <Text style={st.emailText}>{userData.email || ""}</Text>

        <View style={st.pillsRow}>
          <StatPill label="Age" value={`${userData.age} yrs`} onPress={openAge} />
          <StatPill label="BMI" value={userData.bmi ? Number(userData.bmi).toFixed(1) : "-"} />
          <StatPill label="Weight" value={formatWeight()} onPress={openWeight} />
          <StatPill label="Height" value={formatHeight()} onPress={openHeight} />
        </View>
      </View>

      <View style={st.bottomActions}>
        <TouchableOpacity style={st.logoutLink} onPress={LogoutUser} activeOpacity={0.65}>
          <Text style={st.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[st.subPill, isPro ? st.subPillPro : st.subPillFree]}
          onPress={() => isPro ? setShowCustomerCenter(true) : setShowPaywall(true)}
          activeOpacity={0.75}
        >
          <Ionicons name={isPro ? "settings-outline" : "sparkles"} size={13} color={D.primary} />
          <Text style={st.subText}>
            {isPro ? "Manage Subscription" : "Subscribe"}
          </Text>
        </TouchableOpacity>
      </View>

      {showPaywall && (
        <Paywall
          visible
          onClose={() => setShowPaywall(false)}
          onPurchaseCompleted={() => {
            setShowPaywall(false);
            proStatus.refresh();
          }}
          onRestoreCompleted={() => {
            setShowPaywall(false);
            proStatus.refresh();
          }}
        />
      )}
      {showCustomerCenter && (
        <CustomerCenter
          visible
          onClose={() => {
            setShowCustomerCenter(false);
            proStatus.refresh();
          }}
        />
      )}
    </View>
  );
}

function StatPill({ label, value, onPress }: {
  label: string; value: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={st.pill}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Text style={st.pillLabel}>{label}</Text>
      <Text style={st.pillValue}>{value}</Text>
      {onPress && <Ionicons name="pencil" size={9} color="rgba(255,255,255,0.22)" style={{ marginTop: 1 }} />}
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 200 },
  container: { flex: 1, alignItems: "center" },
  profileContent: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
    paddingBottom: 44,
  },
  avatarWrap: { position: "relative", width: 68, height: 68 },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#222" },
  cameraBadge: {
    position: "absolute", right: 0, bottom: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: D.primary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#0C0D0F",
  },
  nameText: { fontFamily: theme.bold, fontSize: 16, color: D.text, marginTop: 7 },
  emailText: { fontFamily: theme.regular, fontSize: 12, color: D.sub, marginTop: 1 },

  pillsRow: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 8, justifyContent: "center",
    width: "100%", marginTop: 15,
  },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: D.pillBg,
    borderWidth: 1, borderColor: D.pillBorder,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
  },
  pillLabel: { fontFamily: theme.medium, fontSize: 11, color: D.sub },
  pillValue: { fontFamily: theme.bold, fontSize: 12, color: D.text },

  bottomActions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 14,
  },
  subPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8,
    borderWidth: 1,
  },
  subPillPro: {
    backgroundColor: "rgba(170,251,5,0.08)",
    borderColor: "rgba(170,251,5,0.25)",
  },
  subPillFree: {
    backgroundColor: "rgba(170,251,5,0.12)",
    borderColor: "rgba(170,251,5,0.30)",
  },
  subText: { fontFamily: theme.semibold, fontSize: 12.5, color: D.primary },
  logoutLink: { paddingVertical: 8, paddingHorizontal: 2 },
  logoutText: { fontFamily: theme.semibold, fontSize: 13, color: "#FF453A" },
});
