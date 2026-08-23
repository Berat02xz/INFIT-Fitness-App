import React from "react";
import {
  ActivityIndicator,
  Animated,
  View,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { TabBar } from "@/components/ui/TabBarUi/TabBar";
import { TabBarVisibilityProvider } from "@/components/ui/TabBarUi/TabBarVisibility";
import AskBar from "@/components/ui/AskBar/AskBar";
import { AskBarProvider, useChatTransition } from "@/components/ui/AskBar/AskBarContext";
import { theme } from "@/constants/theme";
import { ensureAuthenticatedSession } from "@/api/AuthSession";
import {
  getUseNativeIosTabs,
  subscribeToNativeIosTabs,
} from "@/utils/tabBarPreference";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { router, Tabs } from "expo-router";

// Persists across remounts so the correct tab is restored when
// navigating back from a (screens) route. lastActiveTab is the short
// display name (used by AskBar/UI); lastActiveRouteName is whatever
// expo-router actually registered the screen as (e.g. "workout/index")
// and is the only thing safe to pass as initialRouteName. It starts
// undefined so the navigator falls back to declaration order (workout)
// on cold start instead of guessing a name that might not exist.
let lastActiveTab = "workout";
let lastActiveRouteName: string | undefined = undefined;

function TabSurface({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  const chatTransition = useChatTransition();
  const translateY = chatTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.min(height * 0.32, 280)],
  });
  const scale = chatTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.985],
  });
  const opacity = chatTransition.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.72, 0.42],
  });

  return (
    <Animated.View style={[styles.tabSurface, { opacity, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 1400;
  const [authReady, setAuthReady] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(lastActiveTab);
  const [useNativeIosTabs, setUseNativeIosTabs] = React.useState(true);

  React.useEffect(() => {
    if (process.env.EXPO_OS !== "ios") {
      return;
    }

    const unsubscribe = subscribeToNativeIosTabs(setUseNativeIosTabs);
    getUseNativeIosTabs().then(setUseNativeIosTabs).catch(() => undefined);

    return unsubscribe;
  }, []);

  React.useEffect(() => {
    let active = true;

    (async () => {
      const isAuthenticated = await ensureAuthenticatedSession();
      if (!active) {
        return;
      }
      if (!isAuthenticated) {
        router.replace("/WelcomeScreen");
        return;
      }
      setAuthReady(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!authReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const handleTabState = (e: any) => {
    const state = e.data?.state;
    if (state) {
      const rawName = state.routes[state.index]?.name ?? "workout";
      lastActiveRouteName = rawName;
      const name = rawName.replace(/\/index$/, "");
      lastActiveTab = name;
      setActiveTab(name);
    }
  };

  return (
    <BottomSheetModalProvider>
    <TabBarVisibilityProvider>
    <AskBarProvider>
    <View style={{ flex: 1, flexDirection: isLargeScreen ? "row" : "column", backgroundColor: theme.backgroundColor }}>
      <TabSurface>
      {process.env.EXPO_OS === "ios" && useNativeIosTabs ? (
        <View style={styles.raisedNativeTabs}>
          <NativeTabs
            backgroundColor="rgba(8, 16, 8, 0.72)"
            blurEffect="systemChromeMaterialDark"
            disableTransparentOnScrollEdge
            iconColor={{ default: "#FFFFFF", selected: theme.primary }}
            minimizeBehavior="never"
            screenListeners={{ state: handleTabState }}
            tintColor={theme.primary}
          >
            <NativeTabs.Trigger name="workout">
              <NativeTabs.Trigger.Icon sf="dumbbell.fill" />
              <NativeTabs.Trigger.Label hidden>Workout</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="nutrition">
              <NativeTabs.Trigger.Icon sf="fork.knife" />
              <NativeTabs.Trigger.Label hidden>Nutrition</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="profile">
              <NativeTabs.Trigger.Icon sf="person.fill" />
              <NativeTabs.Trigger.Label hidden>Profile</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
          </NativeTabs>
        </View>
      ) : (
        <Tabs
          initialRouteName={lastActiveRouteName}
          tabBar={props =>
            isLargeScreen
              ? <TabBar {...props} vertical />
              : <TabBar {...props} />
          }
          screenOptions={{
            headerShown: false,
            animation: "shift",
            sceneStyle: { backgroundColor: theme.backgroundColor },
          }}
          screenListeners={{ state: handleTabState }}
        >
          <Tabs.Screen name="workout" options={{ tabBarLabel: "Workout" }} />
          <Tabs.Screen name="nutrition" options={{ tabBarLabel: "Nutrition" }} />
          <Tabs.Screen name="profile" options={{ tabBarLabel: "Profile" }} />
        </Tabs>
      )}
      </TabSurface>

      {!isLargeScreen && <AskBar activeTab={activeTab} />}
    </View>
    </AskBarProvider>
    </TabBarVisibilityProvider>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  tabSurface: { flex: 1 },
  raisedNativeTabs: { flex: 1, paddingBottom: 10 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.backgroundColor,
  },
});
