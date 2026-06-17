import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
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
import { LiveMap } from "@/components/live-map";
import { FloatingView } from "@/components/motion";
import { PulseCircle } from "@/components/static-map";
import { parseRideEstimateParam } from "@/lib/ride-estimate";
import { parseRideItineraryParam, serializeRideItinerary } from "@/lib/ride-route";
import { useRideSession } from "@/lib/ride-session";
import { theme } from "@/theme";

const searchStages = [
  {
    id: "requesting",
    title: "Preparing route",
    subtitle: "Resolving your pickup, destination, and stops",
  },
  {
    id: "ringing",
    title: "Finding nearby drivers",
    subtitle: "Sending the trip to the best drivers around your route",
  },
  {
    id: "matching",
    title: "Waiting for acceptance",
    subtitle: "A nearby driver is reviewing the route details now",
  },
] as const;

export default function MatchingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    itinerary?: string | string[];
    estimate?: string | string[];
  }>();
  const itinerary = useMemo(
    () => parseRideItineraryParam(params.itinerary),
    [params.itinerary],
  );
  const initialEstimate = useMemo(
    () => parseRideEstimateParam(params.estimate),
    [params.estimate],
  );
  const serializedItinerary = useMemo(
    () => serializeRideItinerary(itinerary),
    [itinerary],
  );
  const { simulateMatchedRide } = useRideSession();
  const [stageIndex, setStageIndex] = useState(0);
  const autoMatchFiredRef = useRef(false);

  const routeSnapshot = useMemo(() => {
    if (
      initialEstimate?.pickup &&
      initialEstimate.destination &&
      initialEstimate.route
    ) {
      return {
        pickup: initialEstimate.pickup,
        destination: initialEstimate.destination,
        stops: initialEstimate.stops ?? [],
        route: initialEstimate.route,
      };
    }

    return null;
  }, [initialEstimate]);

  const activeStage = searchStages[Math.min(stageIndex, searchStages.length - 1)];

  // Cycle through the search stages with haptic ticks
  useEffect(() => {
    const timer = setInterval(() => {
      setStageIndex((current) => (current + 1) % searchStages.length);
      void Haptics.selectionAsync();
    }, 1200);

    return () => clearInterval(timer);
  }, []);

  // Auto-simulate after cycling through all stages twice
  useEffect(() => {
    if (autoMatchFiredRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      if (autoMatchFiredRef.current) {
        return;
      }
      autoMatchFiredRef.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      simulateMatchedRide({
        itinerary,
        route: routeSnapshot,
        fareEstimateNgn: initialEstimate?.fareEstimateNgn,
        fareEstimateUsdt: initialEstimate?.fareEstimateUsdt,
        plannedDistanceKm: initialEstimate?.plannedDistanceKm,
        plannedDurationSeconds: initialEstimate?.plannedDurationSeconds,
      });

      router.replace({
        pathname: "/driver-found",
        params: { itinerary: serializedItinerary },
      });
    }, 7200);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppScreen
      backgroundColor={theme.colors.mapBase}
      contentStyle={styles.container}
      safeAreaEdges={["top", "left", "right"]}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />

      <View style={styles.mapWrap}>
        <LiveMap
          height={780}
          pickup={routeSnapshot?.pickup}
          destination={routeSnapshot?.destination}
          stops={routeSnapshot?.stops}
          route={routeSnapshot?.route}
          initialCenter={routeSnapshot?.pickup}
          fitPadding={{ top: 92, right: 48, bottom: 360, left: 48 }}
        >
          <MapSearchPulse />

          <View style={styles.mapTopRow}>
            <BackArrow onPress={() => router.back()} />
            <FloatingView distance={5}>
              <View style={styles.mapChip}>
                <MaterialIcons
                  name="location-on"
                  size={16}
                  color={theme.colors.black}
                />
                <AppText variant="monoSmall">Searching nearby</AppText>
              </View>
            </FloatingView>
          </View>

          <FloatingView style={styles.mapBadge} distance={6}>
            <View style={styles.mapBadgeInner}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Searching nearby
              </AppText>
              <AppText variant="monoLarge">Live request</AppText>
            </View>
          </FloatingView>
        </LiveMap>
      </View>

      <View style={styles.sheet}>
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
                index < stageIndex ? styles.progressDotDone : null,
                index === stageIndex ? styles.progressDotActive : null,
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
            <AppText variant="bodyMedium">Ride request is live</AppText>
          </View>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Wheelers is matching your route from {itinerary.pickup} to{" "}
            {itinerary.stops[itinerary.stops.length - 1]}.
          </AppText>
        </View>

        <View style={styles.actionsRow}>
          <View style={styles.actionSlot}>
            <CompactActionButton
              title="Edit route"
              variant="ghost"
              onPress={() => router.back()}
            />
          </View>
          <View style={styles.actionSlot}>
            <CompactActionButton
              title="Cancel ride"
              variant="danger"
              onPress={() => router.replace("/rider")}
            />
          </View>
        </View>
      </View>
    </AppScreen>
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
    <View
      accessibilityRole="button"
      onTouchEnd={onPress}
      style={[
        styles.compactButton,
        isGhost ? styles.compactButtonGhost : null,
        isDanger ? styles.compactButtonDanger : null,
      ]}
    >
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
    </View>
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
    minHeight: 280,
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
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  searchIconWrap: {
    width: 48,
    height: 48,
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
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: "#E4D7CB",
  },
  progressDotDone: {
    backgroundColor: theme.colors.orangeLight,
  },
  progressDotActive: {
    backgroundColor: theme.colors.orange,
  },
  searchInfoCard: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white,
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
  },
  actionSlot: {
    flex: 1,
  },
  compactButton: {
    minHeight: 48,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
    ...theme.shadows.card,
  },
  compactButtonGhost: {
    backgroundColor: theme.colors.white,
  },
  compactButtonDanger: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.offWhite,
  },
  compactButtonLabel: {
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
});
