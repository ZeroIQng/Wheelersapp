import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { type GroupRideGenderPreference } from "@/lib/api";
import { theme } from "@/theme";

const matchStages = [
  { heading: "Verifying rider", body: "Securing your request before matching starts." },
  { heading: "Preparing match", body: "Your route is queued for shared-ride matching." },
  { heading: "Finding riders", body: "Matching riders heading the same way." },
  { heading: "Riders found", body: "Building your shared route." },
] as const;

export default function GroupRideMatchingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    pickup?: string;
    destination?: string;
    genderPreference?: string;
  }>();
  const genderPreference = normalizeGenderPreference(params.genderPreference);
  const [stageIndex, setStageIndex] = useState(0);
  const autoNavigatedRef = useRef(false);

  // Pulse rings
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);

  // Center dot pulse
  const centerScale = useSharedValue(1);

  // Rotating radar sweep
  const rotation = useSharedValue(0);

  // Floating dot positions
  const dot1Y = useSharedValue(0);
  const dot2Y = useSharedValue(0);
  const dot3Y = useSharedValue(0);

  useEffect(() => {
    const ringConfig = { duration: 2200, easing: Easing.out(Easing.cubic) };

    ring1.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, ringConfig),
      ),
      -1,
      false,
    );

    ring2.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, ringConfig),
        ),
        -1,
        false,
      ),
    );

    ring3.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, ringConfig),
        ),
        -1,
        false,
      ),
    );

    centerScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );

    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );

    const floatConfig = { duration: 1800, easing: Easing.inOut(Easing.quad) };
    dot1Y.value = withRepeat(
      withSequence(withTiming(-8, floatConfig), withTiming(0, floatConfig)),
      -1,
      true,
    );
    dot2Y.value = withDelay(
      400,
      withRepeat(
        withSequence(withTiming(-8, floatConfig), withTiming(0, floatConfig)),
        -1,
        true,
      ),
    );
    dot3Y.value = withDelay(
      800,
      withRepeat(
        withSequence(withTiming(-8, floatConfig), withTiming(0, floatConfig)),
        -1,
        true,
      ),
    );
  }, [centerScale, dot1Y, dot2Y, dot3Y, ring1, ring2, ring3, rotation]);

  // Cycle through match stages with haptic ticks
  useEffect(() => {
    const timer = setInterval(() => {
      setStageIndex((current) => {
        const next = current + 1;
        if (next < matchStages.length) {
          void Haptics.selectionAsync();
          return next;
        }
        return current;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  // Auto-navigate to ride-selection after all stages complete
  useEffect(() => {
    if (autoNavigatedRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      if (autoNavigatedRef.current) {
        return;
      }
      autoNavigatedRef.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      router.replace({
        pathname: "/group-ride/ride-selection",
        params: {
          mock: "1",
          pickup: params.pickup ?? "",
          destination: params.destination ?? "",
          genderPreference,
        },
      });
    }, 8500);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    opacity: 1 - ring1.value,
    transform: [{ scale: 0.5 + ring1.value * 1.4 }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: 1 - ring2.value,
    transform: [{ scale: 0.5 + ring2.value * 1.4 }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    opacity: 1 - ring3.value,
    transform: [{ scale: 0.5 + ring3.value * 1.4 }],
  }));
  const centerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerScale.value }],
  }));
  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1Y.value }],
  }));
  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2Y.value }],
  }));
  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3Y.value }],
  }));

  const stage = matchStages[stageIndex];

  return (
    <AppScreen
      backgroundColor={theme.colors.black}
      scroll
      contentStyle={styles.container}
      safeAreaEdges={["top", "left", "right", "bottom"]}
    >
      <StatusBar style="light" />

      {/* Route pill at top */}
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.routePill}>
        <View style={styles.routePillDot} />
        <AppText variant="bodySmall" color={theme.colors.offWhite} numberOfLines={1} style={styles.routePillText}>
          {params.destination ?? "Your destination"}
        </AppText>
      </Animated.View>

      {/* Radar animation */}
      <View style={styles.radarWrap}>
        <Animated.View style={[styles.ring, styles.ring1, ring1Style]} />
        <Animated.View style={[styles.ring, styles.ring2, ring2Style]} />
        <Animated.View style={[styles.ring, styles.ring3, ring3Style]} />

        <Animated.View style={[styles.sweepArm, rotationStyle]} pointerEvents="none">
          <View style={styles.sweepLine} />
          <View style={styles.sweepDot} />
        </Animated.View>

        <Animated.View style={[styles.centerWrap, centerStyle]}>
          <View style={styles.centerDot}>
            <MaterialIcons name="group" size={28} color={theme.colors.black} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.floatDot, styles.floatDot1, dot1Style]}>
          <MaterialIcons name="person-pin" size={20} color={theme.colors.orange} />
        </Animated.View>
        <Animated.View style={[styles.floatDot, styles.floatDot2, dot2Style]}>
          <MaterialIcons name="person-pin" size={16} color={theme.colors.green} />
        </Animated.View>
        <Animated.View style={[styles.floatDot, styles.floatDot3, dot3Style]}>
          <MaterialIcons name="person-pin" size={18} color={theme.colors.orange} />
        </Animated.View>
      </View>

      {/* Status text */}
      <Animated.View entering={FadeIn.delay(300).duration(600)} style={styles.statusWrap}>
        <AppText variant="h1" color={theme.colors.offWhite} style={styles.heading}>
          {stage.heading}
        </AppText>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.pingDot, dot1Style]} />
          <Animated.View style={[styles.pingDot, dot2Style]} />
          <Animated.View style={[styles.pingDot, dot3Style]} />
        </View>
        <AppText variant="bodySmall" color={theme.colors.muted} style={styles.subText}>
          {stage.body}
        </AppText>
      </Animated.View>

      {/* Info card */}
      <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View style={styles.infoIcon}>
            <MaterialIcons name="groups" size={18} color={theme.colors.black} />
          </View>
          <View style={styles.infoCopy}>
            <AppText variant="bodyMedium" color={theme.colors.offWhite}>
              Group ride matching
            </AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              {formatGenderPreference(genderPreference)}
            </AppText>
          </View>
        </View>
      </Animated.View>

      {/* Cancel */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace("/rider")}
        style={styles.cancelButton}
      >
        <AppText variant="bodyMedium" color={theme.colors.muted}>
          Cancel
        </AppText>
      </Pressable>
    </AppScreen>
  );
}

function normalizeGenderPreference(
  value: string | string[] | undefined,
): GroupRideGenderPreference {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "women_only" || raw === "men_only" || raw === "any") {
    return raw;
  }

  return "any";
}

function formatGenderPreference(value: GroupRideGenderPreference): string {
  if (value === "women_only") return "Women only";
  if (value === "men_only") return "Men only";
  return "Any verified rider";
}

const RADAR_SIZE = 220;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xl,
    paddingHorizontal: theme.spacing.gutter,
    paddingBottom: theme.spacing.xxl,
  },
  routePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: theme.borders.regular,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    maxWidth: 280,
  },
  routePillDot: {
    width: 6,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
    flexShrink: 0,
  },
  routePillText: {
    flex: 1,
  },
  radarWrap: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 1.5,
  },
  ring1: {
    borderColor: theme.colors.orange,
  },
  ring2: {
    borderColor: theme.colors.orange,
    opacity: 0.7,
  },
  ring3: {
    borderColor: theme.colors.orange,
    opacity: 0.4,
  },
  sweepArm: {
    position: "absolute",
    width: RADAR_SIZE / 2,
    height: 2,
    left: RADAR_SIZE / 2,
    top: RADAR_SIZE / 2 - 1,
    transformOrigin: "0% 50%",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sweepLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.colors.orange,
    opacity: 0.5,
  },
  sweepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.orange,
    marginRight: -4,
  },
  centerWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  centerDot: {
    alignItems: "center",
    justifyContent: "center",
  },
  floatDot: {
    position: "absolute",
  },
  floatDot1: {
    top: 30,
    right: 40,
  },
  floatDot2: {
    bottom: 44,
    left: 36,
  },
  floatDot3: {
    bottom: 30,
    right: 30,
  },
  statusWrap: {
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  heading: {
    textAlign: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "center",
  },
  pingDot: {
    width: 7,
    height: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
  },
  subText: {
    textAlign: "center",
  },
  infoCard: {
    width: "100%",
    borderWidth: theme.borders.thick,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: theme.radius.lg,
    backgroundColor: "rgba(255,132,67,0.12)",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoCopy: {
    flex: 1,
    gap: 2,
  },
  cancelButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
});
