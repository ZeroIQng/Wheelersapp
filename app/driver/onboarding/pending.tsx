import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { theme } from "@/theme";

export default function PendingScreen() {
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
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.white,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
});
