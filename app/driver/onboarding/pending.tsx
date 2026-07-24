import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/app-button";
import { theme } from "@/theme";
import { useAuth } from "@/lib/auth";
import { getDriverKycStatus } from "@/lib/api";
import { getAccessTokenWithRetry } from "@/lib/access-token";

const FIELD_TO_ROUTE: Record<string, string> = {
  nin: "/driver/onboarding/nin-upload",
  licence: "/driver/onboarding/licence-upload",
  selfie: "/driver/onboarding/face-verification",
  vehicle: "/driver/onboarding/vehicle-info",
  vehiclePhotos: "/driver/onboarding/vehicle-photos",
};

const FIELD_LABELS: Record<string, string> = {
  nin: "NIN Document",
  licence: "Driver's Licence",
  selfie: "Face Verification",
  vehicle: "Vehicle Details",
  vehiclePhotos: "Vehicle Photos",
};

export default function PendingScreen() {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const [kycStatus, setKycStatus] = useState<string>("SUBMITTED");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [rejectedFields, setRejectedFields] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function checkStatus() {
      try {
        const token = await getAccessTokenWithRetry(getAccessToken);
        if (!token || !active) return;
        const result = await getDriverKycStatus({ accessToken: token });
        if (!active) return;
        setKycStatus(result.kycStatus);
        setRejectionReason(result.submission?.rejectionReason ?? null);
        setRejectedFields(result.submission?.rejectedFields ?? []);
      } catch {
        // silently retry on next interval
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 10_000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (kycStatus === "APPROVED") {
      const timer = setTimeout(() => router.replace("/driver/(tabs)/home" as any), 2000);
      return () => clearTimeout(timer);
    }
  }, [kycStatus]);

  if (kycStatus === "APPROVED") {
    return (
      <AppScreen contentStyle={styles.container}>
        <View style={styles.center}>
          <Animated.View entering={ZoomIn.duration(400)} style={[styles.iconWrap, styles.approvedIcon]}>
            <Ionicons name="checkmark-circle" size={48} color={theme.colors.green} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.textWrap}>
            <AppText variant="h1" style={styles.title}>You're Approved!</AppText>
            <AppText variant="body" color={theme.colors.muted} style={styles.subtitle}>
              Your account is active. Taking you to the dashboard...
            </AppText>
          </Animated.View>
        </View>
        <AppButton title="Go to Dashboard" onPress={() => router.replace("/driver/(tabs)/home" as any)} />
      </AppScreen>
    );
  }

  if (kycStatus === "REJECTED") {
    const firstRejectedRoute = rejectedFields.length > 0
      ? FIELD_TO_ROUTE[rejectedFields[0]!] ?? "/driver/onboarding/welcome"
      : "/driver/onboarding/welcome";

    return (
      <AppScreen contentStyle={styles.container}>
        <View style={styles.center}>
          <Animated.View entering={ZoomIn.duration(400)} style={[styles.iconWrap, styles.rejectedIcon]}>
            <Ionicons name="close-circle" size={48} color={theme.colors.danger} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.textWrap}>
            <AppText variant="h1" style={styles.title}>Application Rejected</AppText>
            <AppText variant="body" color={theme.colors.muted} style={styles.subtitle}>
              {rejectionReason ?? "Your documents did not pass review."}
            </AppText>
          </Animated.View>

          {rejectedFields.length > 0 && (
            <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.rejectedList}>
              <AppText variant="label" style={styles.rejectedListTitle}>
                Please fix the following:
              </AppText>
              {rejectedFields.map((field) => (
                <View key={field} style={styles.rejectedItem}>
                  <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    {FIELD_LABELS[field] ?? field}
                  </AppText>
                </View>
              ))}
            </Animated.View>
          )}
        </View>
        <AppButton
          title={rejectedFields.length > 0 ? `Fix ${FIELD_LABELS[rejectedFields[0]!] ?? "Documents"}` : "Resubmit Documents"}
          onPress={() => router.replace(firstRejectedRoute as any)}
        />
      </AppScreen>
    );
  }

  // Default: SUBMITTED / PENDING
  return (
    <AppScreen contentStyle={styles.container}>
      <View style={styles.center}>
        <Animated.View entering={ZoomIn.duration(400)} style={styles.iconWrap}>
          <Ionicons name="time-outline" size={48} color={theme.colors.orange} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.textWrap}>
          <AppText variant="h1" style={styles.title}>
            Under Review
          </AppText>
          <AppText variant="body" color={theme.colors.muted} style={styles.subtitle}>
            Your application is being reviewed. We'll notify you once approved — usually within 24 hours.
          </AppText>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="notifications-outline" size={18} color={theme.colors.orange} />
          <AppText variant="bodySmall" color={theme.colors.muted}>
            You'll receive a push notification when approved
          </AppText>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.orange} />
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Your documents are stored securely
          </AppText>
        </View>
      </Animated.View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    gap: theme.spacing.xl,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  approvedIcon: {
    borderColor: theme.colors.green,
    backgroundColor: theme.colors.successLight,
  },
  rejectedIcon: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerLight,
  },
  textWrap: {
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  infoCard: {
    marginTop: theme.spacing.xxxl,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.white,
    ...theme.shadows.subtle,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  rejectedList: {
    width: "100%",
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.dangerLight,
    ...theme.shadows.subtle,
  },
  rejectedListTitle: {
    marginBottom: theme.spacing.xs,
  },
  rejectedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
});
