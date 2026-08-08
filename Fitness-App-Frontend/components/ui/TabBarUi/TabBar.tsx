import {
  View,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import type { ComponentProps } from "react";
import type { Tabs } from "expo-router";

// expo-router builds its tab navigator from its own vendored copy of
// react-navigation, so the props it hands to a custom `tabBar` render prop
// are structurally, but not nominally, the same as @react-navigation/bottom-tabs'
// BottomTabBarProps. Deriving the type from Tabs itself keeps this exact.
type BottomTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import PlatformBlur from "@/components/ui/PlatformBlur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTabBarVisibility } from "./TabBarVisibility";
import { haptics } from "@/utils/haptics";

const ICON_ACTIVE = "#000000";
const ICON_INACTIVE = "rgba(255,255,255,0.45)";

export const icon = {
  workout: (props: any) => (
    <Ionicons
      name={props.focused ? "barbell" : "barbell-outline"}
      size={24}
      color={props.focused ? ICON_ACTIVE : ICON_INACTIVE}
    />
  ),
  nutrition: (props: any) => (
    <Ionicons
      name={props.focused ? "restaurant" : "restaurant-outline"}
      size={24}
      color={props.focused ? ICON_ACTIVE : ICON_INACTIVE}
    />
  ),
  chatbot: (props: any) => (
    <Ionicons
      name={props.focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
      size={24}
      color={props.focused ? ICON_ACTIVE : ICON_INACTIVE}
    />
  ),
  profile: (props: any) => (
    <Ionicons
      name={props.focused ? "person" : "person-outline"}
      size={24}
      color={props.focused ? ICON_ACTIVE : ICON_INACTIVE}
    />
  ),
};

// Floating dock — icon-only, circle indicator, iOS 26 liquid-glass proportions
const BAR_HEIGHT = 72;
const BAR_PAD = 7;            // inner padding at both ends
const BTN_W = 70;             // touch target per tab
const CIRCLE = 58;            // active indicator circle (bar height minus ~7pt inset)

export function TabBar({
  state,
  descriptors,
  navigation,
  vertical,
}: BottomTabBarProps & { vertical?: boolean }) {
  const insets = useSafeAreaInsets();
  const { hidden } = useTabBarVisibility();

  const tabBarWidth = BTN_W * state.routes.length + BAR_PAD * 2;
  const circleXFor = (index: number) => BAR_PAD + BTN_W * index + (BTN_W - CIRCLE) / 2;

  // — animations
  const circleX = useSharedValue(circleXFor(state.index));
  const hideY = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pressScale = useSharedValue(1);

  const isChatbot = state.routes[state.index]?.name === "chatbot";

  // hide/show for chatbot screen + any screen that requests it (e.g. workout chat mode)
  useEffect(() => {
    hideY.value = withTiming(isChatbot || hidden ? 130 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [isChatbot, hidden]);

  // circle indicator — fast cubic ease, zero bounce
  useEffect(() => {
    circleX.value = withTiming(circleXFor(state.index), {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [state.index]);

  // drag gesture — long press to grab, spring snap back on release
  const pan = Gesture.Pan()
    .activateAfterLongPress(320)
    .onStart(() => {
      pressScale.value = withTiming(0.965, { duration: 120 });
    })
    .onUpdate((e) => {
      dragX.value = e.translationX;
      dragY.value = e.translationY;
    })
    .onEnd(() => {
      pressScale.value = withSpring(1, { damping: 22, stiffness: 320 });
      dragX.value = withSpring(0, { damping: 18, stiffness: 200, mass: 0.85 });
      dragY.value = withSpring(0, { damping: 18, stiffness: 200, mass: 0.85 });
    })
    .onFinalize(() => {
      // safety — restore if gesture is cancelled mid-drag
      pressScale.value = withSpring(1, { damping: 22, stiffness: 320 });
      dragX.value = withSpring(0, { damping: 18, stiffness: 200, mass: 0.85 });
      dragY.value = withSpring(0, { damping: 18, stiffness: 200, mass: 0.85 });
    });

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: circleX.value }],
  }));

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value },
      { translateY: hideY.value + dragY.value },
      { scale: pressScale.value },
    ],
    opacity: interpolate(hideY.value, [0, 80, 130], [1, 0.3, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.wrapper,
          {
            bottom: Math.max(insets.bottom, 12) + 10,
            width: tabBarWidth,
          },
          wrapperStyle,
        ]}
      >
        <PlatformBlur
          intensity={85}
          tint="systemChromeMaterialDark"
          androidColor="rgba(10,16,10,0.96)"
          style={[styles.bar, { width: tabBarWidth, height: BAR_HEIGHT }]}
        >
          {/* thin top-edge highlight — the only glass cue needed */}
          <View style={styles.topEdge} pointerEvents="none" />

          {/* border */}
          <View style={styles.border} pointerEvents="none" />

          {/* ── Active circle ────────────────────────────────────────────── */}
          <Animated.View style={[styles.circle, circleStyle]} />

          {/* ── Tab buttons ──────────────────────────────────────────────── */}
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              haptics.selection();
              circleX.value = withTiming(circleXFor(index), {
                duration: 200,
                easing: Easing.out(Easing.cubic),
              });

              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? route.name}
                onPress={onPress}
                onPressIn={() => { pressScale.value = withTiming(0.94, { duration: 110 }); }}
                onPressOut={() => { pressScale.value = withSpring(1, { damping: 18, stiffness: 320 }); }}
                style={styles.tabBtn}
                activeOpacity={0.72}
              >
                {icon[route.name.replace(/\/index$/, "") as keyof typeof icon]?.({ focused: isFocused })}
              </TouchableOpacity>
            );
          })}
        </PlatformBlur>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 10,
    borderRadius: BAR_HEIGHT / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: BAR_PAD,
    backgroundColor: "rgba(8, 16, 8, 0.68)",
    borderRadius: 100,
    overflow: "hidden",
  },
  topEdge: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 100,
    zIndex: 4,
  },
  border: {
    ...StyleSheet.absoluteFill,
    borderRadius: 100,
    borderWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    borderLeftColor: "rgba(255, 255, 255, 0.035)",
    borderBottomColor: "rgba(255, 255, 255, 0.025)",
    borderRightColor: "rgba(255, 255, 255, 0.035)",
    zIndex: 3,
  },
  circle: {
    position: "absolute",
    left: 0,
    top: (BAR_HEIGHT - CIRCLE) / 2,
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: theme.primary,
    zIndex: 1,
  },
  tabBtn: {
    width: BTN_W,
    height: BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
});
