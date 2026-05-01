import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { FloatingView } from "@/components/motion";
import { PulseCircle, StaticMap } from "@/components/static-map";
import { driver } from "@/data/mock";
import { theme } from "@/theme";

const searchStages = [
  {
    id: "requesting",
    title: "Finding drivers",
    subtitle: "Sending your Wheeler request to nearby drivers",
  },
  {
    id: "ringing",
    title: "Drivers are responding",
    subtitle: "Phones nearby are ringing for this trip",
  },
  {
    id: "matching",
    title: "Almost matched",
    subtitle: "Best Wheeler for your pickup is being selected",
  },
] as const;

export default function MatchingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    itinerary?: string | string[];
  }>();
  const itineraryParam = Array.isArray(params.itinerary)
    ? params.itinerary[0]
    : params.itinerary;
  const [stageIndex, setStageIndex] = useState(0);
  const [driverFound, setDriverFound] = useState(false);

  useEffect(() => {
    if (driverFound) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const timer = setTimeout(() => {
      setStageIndex((current) => {
        if (current >= searchStages.length - 1) {
          setDriverFound(true);
          return current;
        }

        return current + 1;
      });
    }, 1300);

    return () => clearTimeout(timer);
  }, [driverFound, stageIndex]);

  useEffect(() => {
    if (driverFound) {
      return;
    }

    const interval = setInterval(() => {
      void Haptics.selectionAsync();
    }, 850);

    return () => clearInterval(interval);
  }, [driverFound]);

  const activeStage =
    searchStages[Math.min(stageIndex, searchStages.length - 1)];
  const nearbyDriversLabel = useMemo(() => {
    if (driverFound) {
      return "Driver found";
    }

    if (stageIndex === 0) {
      return "3 drivers nearby";
    }

    if (stageIndex === 1) {
      return "2 drivers reviewing";
    }

    return "Choosing best match";
  }, [driverFound, stageIndex]);

  return (
    <AppScreen
      backgroundColor={theme.colors.mapBase}
      contentStyle={styles.container}
      safeAreaEdges={["top", "left", "right"]}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />

      <View style={styles.mapWrap}>
        <StaticMap height={780} scene="driverFound">
          {!driverFound ? <MapSearchPulse /> : null}

          <View style={styles.mapTopRow}>
            <BackArrow onPress={() => router.back()} />
            <FloatingView distance={5}>
              <View style={styles.mapChip}>
                <MaterialIcons
                  name={driverFound ? "local-taxi" : "location-on"}
                  size={16}
                  color={theme.colors.black}
                />
                <AppText variant="monoSmall">{nearbyDriversLabel}</AppText>
              </View>
            </FloatingView>
          </View>

          <FloatingView style={styles.mapBadge} distance={6}>
            <View style={styles.mapBadgeInner}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {driverFound ? "Driver matched" : "Searching nearby"}
              </AppText>
              <AppText variant="monoLarge">
                {driverFound ? `${driver.etaMinutes} min away` : "Live request"}
              </AppText>
            </View>
          </FloatingView>
        </StaticMap>
      </View>

      <View style={styles.sheet}>
        {!driverFound ? (
          <>
            <View style={styles.sheetHandle} />

            <View style={styles.searchHeader}>
              <View style={styles.searchIconWrap}>
                <MaterialIcons
                  name="location-searching"
                  size={24}
                  color={theme.colors.offWhite}
                />
              </View>
              <View style={styles.searchCopy}>
                <AppText variant="monoSmall" color={theme.colors.orange}>
                  FINDING DRIVER
                </AppText>
                <AppText variant="h2">{activeStage.title}</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  {activeStage.subtitle}
                </AppText>
              </View>
            </View>

            <View style={styles.progressRow}>
              {searchStages.map((stage, index) => (
                <View
                  key={stage.id}
                  style={[
                    styles.progressDot,
                    index < stageIndex ||
                    (driverFound && index === searchStages.length - 1)
                      ? styles.progressDotDone
                      : null,
                    index === stageIndex && !driverFound
                      ? styles.progressDotActive
                      : null,
                  ]}
                />
              ))}
            </View>

            <View style={styles.searchInfoCard}>
              <View style={styles.searchInfoRow}>
                <MaterialIcons
                  name="notifications-active"
                  size={18}
                  color={theme.colors.orange}
                />
                <AppText variant="bodyMedium">Ride request sent</AppText>
              </View>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Nearby drivers are getting the request now. You can still edit
                your route or cancel the ride.
              </AppText>
            </View>

            <View style={styles.actionsRow}>
              <View style={styles.actionSlot}>
                <CompactActionButton
                  title="Edit Route"
                  variant="ghost"
                  onPress={() => router.back()}
                />
              </View>
              <View style={styles.actionSlot}>
                <CompactActionButton
                  title="Cancel Ride"
                  variant="danger"
                  onPress={() => router.back()}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.sheetHandle} />

            <AppText variant="monoSmall" color={theme.colors.green}>
              DRIVER FOUND
            </AppText>

            <Pressable
              onPress={() =>
                router.push(
                  itineraryParam
                    ? {
                        pathname: "/driver-found",
                        params: {
                          itinerary: itineraryParam,
                        },
                      }
                    : "/driver-found",
                )
              }
              style={styles.driverFoundCard}
            >
              <View style={styles.driverFoundTop}>
                <View style={styles.carIconWrap}>
                  <MaterialIcons
                    name="local-taxi"
                    size={26}
                    color={theme.colors.offWhite}
                  />
                </View>
                <View style={styles.driverFoundCopy}>
                  <AppText variant="h2">Driver found</AppText>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    {driver.name} • {driver.vehicle}
                  </AppText>
                </View>
                <MaterialIcons
                  name="keyboard-arrow-right"
                  size={24}
                  color={theme.colors.black}
                />
              </View>

              <View style={styles.driverMetaRow}>
                <MetaPill label={`ETA ${driver.etaMinutes} min`} />
                <MetaPill label={driver.plate} />
                <MetaPill label={driver.fare} />
              </View>

              <AppText variant="bodySmall" color={theme.colors.muted}>
                Tap this ride card to open the full driver details.
              </AppText>
            </Pressable>

            <View style={styles.actionsRow}>
              <View style={styles.actionSlot}>
                <CompactActionButton
                  title="View Ride"
                  onPress={() =>
                    router.push(
                      itineraryParam
                        ? {
                            pathname: "/driver-found",
                            params: {
                              itinerary: itineraryParam,
                            },
                          }
                        : "/driver-found",
                    )
                  }
                />
              </View>
              <View style={styles.actionSlot}>
                <CompactActionButton
                  title="Cancel Ride"
                  variant="danger"
                  onPress={() => router.replace("/rider")}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </AppScreen>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <AppText variant="monoSmall">{label}</AppText>
    </View>
  );
}

function CompactActionButton({
  title,
  onPress,
  variant = "primary",
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "ghost" | "danger";
}) {
  const isGhost = variant === "ghost";
  const isDanger = variant === "danger";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactButton,
        isGhost ? styles.compactButtonGhost : null,
        isDanger ? styles.compactButtonDanger : null,
        pressed ? styles.compactButtonActive : null,
      ]}
    >
      {/* ✅ Swapped raw <Text> → <AppText> to fix ClashDisplay font metrics clipping */}
      <AppText
        numberOfLines={1}
        style={[
          styles.compactButtonLabel,
          isDanger
            ? styles.compactButtonLabelDanger
            : isGhost
              ? styles.compactButtonLabelGhost
              : styles.compactButtonLabelPrimary,
        ]}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

function MapSearchPulse() {
  const overlayOpacity = useSharedValue(0.08);
  const markerScale = useSharedValue(1);

  useEffect(() => {
    overlayOpacity.value = withRepeat(
      withSequence(
        withTiming(0.16, { duration: 650 }),
        withTiming(0.06, { duration: 650 }),
      ),
      -1,
      false,
    );

    markerScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 500 }),
        withTiming(1, { duration: 500 }),
      ),
      -1,
      false,
    );
  }, [markerScale, overlayOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: markerScale.value }],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.mapBreath, overlayStyle]}
      />
      <View pointerEvents="none" style={styles.mapSignalWrap}>
        <PulseCircle
          size={140}
          color={theme.colors.orange}
          style={styles.mapSignalOuter}
        />
        <PulseCircle
          size={92}
          color={theme.colors.orange}
          delay={260}
          style={styles.mapSignalInner}
        />
        <Animated.View style={[styles.mapSignalMarker, markerStyle]}>
          <MaterialIcons
            name="location-on"
            size={28}
            color={theme.colors.offWhite}
          />
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  mapWrap: {
    flex: 1,
  },
  mapBreath: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.orange,
  },
  mapSignalWrap: {
    position: "absolute",
    top: "35%",
    left: "50%",
    width: 140,
    height: 140,
    marginLeft: -70,
    marginTop: -70,
    alignItems: "center",
    justifyContent: "center",
  },
  mapSignalOuter: {
    top: 0,
    left: 0,
  },
  mapSignalInner: {
    top: 24,
    left: 24,
  },
  mapSignalMarker: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  mapTopRow: {
    position: "absolute",
    top: 16,
    left: theme.spacing.gutter,
    right: theme.spacing.gutter,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mapChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadows.card,
  },
  mapBadge: {
    position: "absolute",
    right: theme.spacing.gutter,
    bottom: 308,
  },
  mapBadgeInner: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 2,
    ...theme.shadows.card,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.offWhite,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: theme.borders.thick,
    borderBottomWidth: 0,
    borderColor: theme.colors.black,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
    minHeight: 320,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 56,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.mutedLight,
    marginBottom: theme.spacing.xs,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  searchIconWrap: {
    width: 54,
    height: 54,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  searchCopy: {
    flex: 1,
    gap: 2,
  },
  progressRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  progressDot: {
    flex: 1,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: "#E4D8CE",
  },
  progressDotActive: {
    backgroundColor: theme.colors.orange,
  },
  progressDotDone: {
    backgroundColor: theme.colors.green,
  },
  searchInfoCard: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  searchInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "stretch",
  },
  actionSlot: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    overflow: "hidden",
  },
  compactButton: {
    width: "100%",
    minWidth: 0,
    height: 52,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 0,
    overflow: "hidden", // ✅ prevents any bleed
  },
  compactButtonGhost: {
    backgroundColor: theme.colors.white,
  },
  compactButtonDanger: {
    backgroundColor: theme.colors.dangerLight,
    borderColor: theme.colors.danger,
  },
  compactButtonActive: {
    opacity: 0.9,
  },
  compactButtonLabel: {
    // ✅ Removed lineHeight: 18 — was clipping ClashDisplay font descenders at rest
    // ✅ Removed width: "100%", maxWidth: "100%", textAlignVertical — caused layout bleed
    ...theme.typography.bodySmall,
    includeFontPadding: false,
    flexShrink: 1,
    textAlign: "center",
  },
  compactButtonLabelPrimary: {
    color: theme.colors.offWhite,
  },
  compactButtonLabelGhost: {
    color: theme.colors.black,
  },
  compactButtonLabelDanger: {
    color: theme.colors.danger,
  },
  driverFoundCard: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  driverFoundTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  carIconWrap: {
    width: 54,
    height: 54,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.green,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  driverFoundCopy: {
    flex: 1,
    gap: 2,
  },
  driverMetaRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  metaPill: {
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
});
