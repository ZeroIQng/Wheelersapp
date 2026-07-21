import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { FlowHeader } from "@/components/flow-header";
import { theme } from "@/theme";

const STEPS = [
  { icon: "id-card-outline" as const, label: "NIN card photo" },
  { icon: "car-outline" as const, label: "Driver's licence (photo or PDF)" },
  { icon: "camera-outline" as const, label: "Face verification" },
  { icon: "speedometer-outline" as const, label: "Vehicle details" },
  { icon: "images-outline" as const, label: "Vehicle photos (7-10)" },
];

export default function OnboardingWelcomeScreen() {
  const router = useRouter();

  return (
    <AppScreen scroll contentStyle={styles.container}>
      <FlowHeader
        title="Let's get you verified"
        subtitle="To start earning, we need a few things from you"
        progress={{ count: 6, active: 0 }}
      />

      <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.steps}>
        {STEPS.map((step, i) => (
          <View key={step.label} style={styles.stepRow}>
            <View style={styles.stepIcon}>
              <Ionicons name={step.icon} size={22} color={theme.colors.orange} />
            </View>
            <AppText variant="bodyMedium">{step.label}</AppText>
          </View>
        ))}
      </Animated.View>

      <View style={styles.spacer} />

      <AppButton title="Let's go" onPress={() => router.push("/driver/onboarding/nin-upload")} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.spacing.xxxl,
  },
  steps: {
    marginTop: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orangeLight,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.subtle,
  },
  spacer: {
    flex: 1,
    minHeight: theme.spacing.xxxl,
  },
});
