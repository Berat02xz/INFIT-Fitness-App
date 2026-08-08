import { routeForSession } from "@/api/AuthSession";
import RevenueCatService from "@/api/RevenueCatService";
import { useFonts } from "expo-font";
import { Stack, ThemeProvider, DarkTheme } from "expo-router";
import { useEffect, useState } from "react";
import Toast, { BaseToast, ErrorToast, type BaseToastProps } from "react-native-toast-message";
import { ActivityIndicator, View, StatusBar, Platform } from "react-native";
import { theme } from "@/constants/theme";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import * as SystemUI from 'expo-system-ui';
import { Ionicons } from "@expo/vector-icons";

// ─── Toast style config ───────────────────────────────────────────────────────
// Full-pill, black background, white text — applied to every toast type.
const TOAST_STYLE: Partial<BaseToastProps> = {
  style: {
    borderRadius: 999,
    backgroundColor: "#000000",
    borderLeftWidth: 0,
    paddingHorizontal: 18,
    height: 52,
    minWidth: 200,
    alignItems: "center",
  },
  contentContainerStyle: { paddingHorizontal: 6 },
  text1Style: {
    fontSize: 14,
    fontFamily: theme.semibold,
    color: "#FFFFFF",
  },
  text2Style: {
    fontSize: 12,
    fontFamily: theme.regular,
    color: "rgba(255,255,255,0.65)",
  },
};

const toastConfig = {
  success: (props: BaseToastProps) => <BaseToast {...props} {...TOAST_STYLE} />,
  error:   (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      {...TOAST_STYLE}
      style={[
        TOAST_STYLE.style,
        {
          borderWidth: 1,
          borderColor: "#FF453A",
          borderRadius: 22,
          backgroundColor: "rgba(35,8,8,0.98)",
          height: undefined,
          minHeight: 58,
          width: "90%",
          maxWidth: 420,
          paddingVertical: 9,
          shadowColor: "#FF453A",
          shadowOpacity: 0.22,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        },
      ]}
      text1Style={[TOAST_STYLE.text1Style, { color: "#FF6B63" }]}
      text2NumberOfLines={2}
      renderLeadingIcon={() => (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,69,58,0.14)",
          }}
        >
          <Ionicons name="alert-circle" size={18} color="#FF453A" />
        </View>
      )}
    />
  ),
  info:    (props: BaseToastProps) => <BaseToast  {...props} {...TOAST_STYLE} />,
};

export default function RootLayout() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [fontsLoaded] = useFonts({
    Regular: require("../assets/fonts/Albert_Sans/static/AlbertSans-Regular.ttf"),
    Bold: require("../assets/fonts/Albert_Sans/static/AlbertSans-Bold.ttf"),
    Light: require("../assets/fonts/Albert_Sans/static/AlbertSans-Light.ttf"),
    Medium: require("../assets/fonts/Albert_Sans/static/AlbertSans-Medium.ttf"),
    SemiBold: require("../assets/fonts/Albert_Sans/static/AlbertSans-SemiBold.ttf"), 
    ExtraBold: require("../assets/fonts/Albert_Sans/static/AlbertSans-ExtraBold.ttf"),
    ExtraLight: require("../assets/fonts/Albert_Sans/static/AlbertSans-ExtraLight.ttf"),
    Thin: require("../assets/fonts/Albert_Sans/static/AlbertSans-Thin.ttf"),
    Black: require("../assets/fonts/Albert_Sans/static/AlbertSans-Black.ttf"),
  });

  useEffect(() => {
    // Set background color asap to prevent white flash
    const setBackground = async () => {
        if (Platform.OS === 'android') {
            await SystemUI.setBackgroundColorAsync("black");
        }
    };
    setBackground();

    if (fontsLoaded) {
      (async () => {
        try {
          await RevenueCatService.initialize();
          await routeForSession();
        } finally {
          setSessionChecked(true);
        }
      })();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.backgroundColor }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const navTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: theme.backgroundColor,
    },
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
        <SafeAreaProvider
          initialMetrics={initialWindowMetrics}
          style={{ flex: 1, backgroundColor: theme.backgroundColor }}
        >
          <ThemeProvider value={navTheme}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.backgroundColor },
              }}
            />
            {!sessionChecked && (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: theme.backgroundColor,
                }}
              >
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            )}
            <Toast config={toastConfig} />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  );
}
