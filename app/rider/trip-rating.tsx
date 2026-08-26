import { Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { FloatingView, PulseView } from "@/components/motion";
import { StatusPill } from "@/components/StatusPill";
import { toUserMessage } from "@/lib/error-messages";
import { useRideSession } from "@/lib/ride-session";
import { theme } from "@/theme";

export default function TripRatingScreen() {
  const router = useRouter();
  const walletRoute = "/rider/wallet" as Href;
  const { currentRide, submitRating } = useRideSession();
  const [rating, setRating] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The real driver from the trip that just ended. This screen used to show a
  // hardcoded person from the mock file, so a rider was asked to rate somebody
  // who had never driven them anywhere.
  const driver = currentRide?.driver;
  const driverName = driver?.driverName?.trim() || "Your driver";
  const driverInitials =
    driverName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "D";
  const vehicleLine = [driver?.vehicleModel, driver?.vehiclePlate]
    .filter((part) => Boolean(part && part.trim()))
    .join(" · ");
  const canRate = Boolean(driver?.driverUserId);

  async function handleSubmit() {
    if (!canRate) {
      // Nothing to attach the rating to, so say so rather than pretending it
      // was sent.
      Alert.alert(
        "We could not find that trip",
        "Your rating could not be matched to a driver. You can rate from your ride history instead.",
        [{ text: "OK", onPress: () => router.replace(walletRoute) }],
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await submitRating({ rating });
      router.replace(walletRoute);
    } catch (error) {
      Alert.alert(
        "Could not send your rating",
        toUserMessage(error, "Please try again in a moment."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <ConfettiPiece color={theme.colors.orange} style={styles.confettiOne} />
      <ConfettiPiece color={theme.colors.black} style={styles.confettiTwo} />
      <ConfettiPiece color={theme.colors.green} style={styles.confettiThree} />
      <ConfettiPiece color={theme.colors.orange} style={styles.confettiFour} />

      <StatusPill label="TRIP COMPLETE" variant="light" style={styles.badge} />

      <View style={styles.header}>
        <AppText variant="h1" style={styles.center}>
          How was{"\n"}your ride?
        </AppText>
        <AppText
          variant="bodySmall"
          color={theme.colors.muted}
          style={styles.center}
        >
          Rate your driver
        </AppText>
      </View>

      <PulseView>
        <View style={styles.avatar}>
          <AppText variant="h2" color={theme.colors.offWhite}>
            {driverInitials}
          </AppText>
        </View>
      </PulseView>

      <View style={styles.driverMeta}>
        <AppText variant="h3">{driverName}</AppText>
        {vehicleLine ? (
          <AppText variant="bodySmall" color={theme.colors.muted}>
            {vehicleLine}
          </AppText>
        ) : null}
      </View>

      <View style={styles.stars}>
        {Array.from({ length: 5 }).map((_, index) => {
          const active = index < rating;
          return (
            <Pressable key={index} onPress={() => setRating(index + 1)}>
              <AppText
                style={[styles.star, !active ? styles.starInactive : null]}
              >
                ⭐
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* The tip selector that used to sit here moved no money: it set local
          state, was never sent anywhere, and left a rider believing they had
          tipped ₦200. It comes back when there is a tipping endpoint behind
          it. */}

      <AppButton
        title={isSubmitting ? "Sending…" : "Submit rating ↗"}
        disabled={isSubmitting}
        onPress={() => void handleSubmit()}
      />
    </AppScreen>
  );
}

function ConfettiPiece({ color, style }: { color: string; style: object }) {
  return (
    <FloatingView distance={12} style={style}>
      <View style={[styles.confetti, { backgroundColor: color }]} />
    </FloatingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.gutter,
  },
  badge: {
    marginBottom: theme.spacing.sm,
  },
  header: {
    gap: theme.spacing.xs,
  },
  center: {
    textAlign: "center",
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  driverMeta: {
    alignItems: "center",
    gap: theme.spacing.xxs,
  },
  stars: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  star: {
    fontSize: 34,
  },
  starInactive: {
    opacity: 0.28,
  },
  confetti: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  confettiOne: {
    position: "absolute",
    top: 78,
    left: "22%",
  },
  confettiTwo: {
    position: "absolute",
    top: 96,
    right: "24%",
  },
  confettiThree: {
    position: "absolute",
    top: 134,
    left: "70%",
  },
  confettiFour: {
    position: "absolute",
    top: 150,
    left: "34%",
  },
});
