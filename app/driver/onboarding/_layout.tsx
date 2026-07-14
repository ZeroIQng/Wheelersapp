import { Stack } from "expo-router";
import { DriverOnboardingProvider } from "@/lib/driver-onboarding";

export default function OnboardingLayout() {
  return (
    <DriverOnboardingProvider>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
    </DriverOnboardingProvider>
  );
}
