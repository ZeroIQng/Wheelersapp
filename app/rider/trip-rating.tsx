import { Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { FloatingView, PulseView } from "@/components/motion";
import { StatusPill } from "@/components/StatusPill";
import { driverDetails } from "@/data/mock";
import { theme } from "@/theme";

const tips = ["$0.50", "$1.00", "$2.00", "Skip"];

export default function TripRatingScreen() {
  const router = useRouter();
  const walletRoute = "/rider/wallet" as Href;
  const [rating, setRating] = useState(4);
  const [tip, setTip] = useState("$1.00");

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
            {driverDetails.initials}
          </AppText>
        </View>
      </PulseView>

      <View style={styles.driverMeta}>
        <AppText variant="h3">{driverDetails.name}</AppText>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          {driverDetails.vehicle} · {driverDetails.plate}
        </AppText>
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

      <View style={styles.tipBlock}>
        <AppText
          variant="bodySmall"
          color={theme.colors.muted}
          style={styles.center}
        >
          Add a tip?
        </AppText>
        <View style={styles.tipRow}>
          {tips.map((entry) => {
            const active = entry === tip;

            return (
              <Pressable
                key={entry}
                onPress={() => setTip(entry)}
                style={[styles.tipChip, active ? styles.tipChipActive : null]}
              >
                <AppText
                  variant={entry === "Skip" ? "bodySmall" : "mono"}
                  color={active ? theme.colors.offWhite : theme.colors.black}
                >
                  {entry}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <AppButton
        title="Submit rating ↗"
        onPress={() => router.push(walletRoute)}
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
  tipBlock: {
    width: "100%",
    gap: theme.spacing.sm,
  },
  tipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  tipChip: {
    minWidth: 74,
    minHeight: 40,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  tipChipActive: {
    backgroundColor: theme.colors.orange,
    ...theme.shadows.card,
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
