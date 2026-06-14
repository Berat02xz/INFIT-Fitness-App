import React from "react";
import {
  ActivityIndicator,
  Animated,
  View,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import WorkoutScreen from "./workout/index";
import NutritionScreen from "./nutrition/index";
import ProfileScreen from "./profile/index";
import { TabBar } from "@/components/ui/TabBarUi/TabBar";
import { TabBarVisibilityProvider } from "@/components/ui/TabBarUi/TabBarVisibility";
import AskBar from "@/components/ui/AskBar/AskBar";
import { AskBarProvider, useChatTransition } from "@/components/ui/AskBar/AskBarContext";
import { theme } from "@/constants/theme";
import { ensureAuthenticatedSession } from "@/api/AuthSession";
import { router } from "expo-router";

const Tab = createBottomTabNavigator();

// Persists across remounts so the correct tab is restored when
// navigating back from a (screens) route.
let lastActiveTab = "workout";

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

  return (
    <BottomSheetModalProvider>
    <TabBarVisibilityProvider>
    <AskBarProvider>
    <View style={{ flex: 1, flexDirection: isLargeScreen ? "row" : "column", backgroundColor: theme.backgroundColor }}>
      <TabSurface>
      <Tab.Navigator
        initialRouteName={lastActiveTab}
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
        screenListeners={{
          state: (e) => {
            const state = e.data?.state;
            if (state) {
              const name = state.routes[state.index]?.name ?? "workout";
              lastActiveTab = name;
              setActiveTab(name);
            }
          },
        }}
      >
        <Tab.Screen
          name="workout"
          component={WorkoutScreen}
          options={{ tabBarLabel: "Workout" }}
        />
        <Tab.Screen
          name="nutrition"
          component={NutritionScreen}
          options={{ tabBarLabel: "Nutrition" }}
        />
        <Tab.Screen
          name="profile"
          component={ProfileScreen}
          options={{ tabBarLabel: "Profile" }}
        />
      </Tab.Navigator>
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.backgroundColor,
  },
});
