import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { LiveMap } from "@/components/live-map";
import { FloatingView } from "@/components/motion";
import type { RideEstimateWaypoint } from "@/lib/api";
import { resolvePlaceQuery } from "@/lib/google-places";
import { theme } from "@/theme";

const { height } = Dimensions.get("window");

// Mock group ride match data — replace with real backend response when group ride API is ready
const MOCK_MATCH = {
  riderCount: 3,
  farePerRider: 1850,
  totalFare: 5550,
  etaMinutes: 12,
  distanceKm: 7.4,
  riders: [
    { name: "Temi A.", initials: "TA" },
    { name: "Kola B.", initials: "KB" },
  ],
};

function formatNgn(value: number): string {
  return `NGN ${Math.round(value).toLocaleString("en-NG")}`;
}

export default function GroupRideSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pickup?: string; destination?: string }>();

  const pickupLabel = params.pickup ?? "";
  const destinationLabel = params.destination ?? "";

  const [resolvedPickup, setResolvedPickup] = useState<RideEstimateWaypoint | null>(null);
  const [resolvedDestination, setResolvedDestination] = useState<RideEstimateWaypoint | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [pickup, destination] = await Promise.all([
          resolvePlaceQuery(pickupLabel),
          resolvePlaceQuery(destinationLabel),
        ]);
        if (!cancelled) {
          setResolvedPickup(pickup);
          setResolvedDestination(destination);
        }
      } catch {
        // map stays without markers — graceful fallback
      }
    })();
    return () => { cancelled = true; };
  }, [pickupLabel, destinationLabel]);

  const SHEET_MIN_HEIGHT = 500;
  const collapsedSheetOffset = 220;
  const sheetOffset = useSharedValue(0);

  const routeFitPadding = {
    top: 88,
    right: 56,
    bottom: SHEET_MIN_HEIGHT + 56,
    left: 56,
  };

  const expandSheet = () => {
    sheetOffset.value = withTiming(0, { duration: 220 });
  };

  const collapseSheet = () => {
    sheetOffset.value = withTiming(collapsedSheetOffset, { duration: 220 });
  };

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30) { expandSheet(); return; }
        if (gestureState.dy > 30) collapseSheet();
      },
      onPanResponderTerminate: (_, gestureState) => {
        if (gestureState.dy < -30) { expandSheet(); return; }
        if (gestureState.dy > 30) collapseSheet();
      },
    }),
  ).current;

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetOffset.value }],
  }));

  return (
    <AppScreen
      backgroundColor={theme.colors.mapBase}
      contentStyle={styles.container}
      safeAreaEdges={["top", "left", "right"]}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />

      {/* Real map */}
      <View style={styles.mapWrap}>
        <LiveMap
          height={height}
          pickup={resolvedPickup}
          destination={resolvedDestination}
          initialCenter={resolvedPickup}
          fitPadding={routeFitPadding}
        >
          {/* Top bar overlaid on map */}
          <View style={styles.topBar}>
            <BackArrow onPress={() => router.back()} />
            <FloatingView distance={5}>
              <View style={styles.mapChip}>
                <AppText variant="monoSmall">
                  Group • {MOCK_MATCH.etaMinutes} min trip
                </AppText>
              </View>
            </FloatingView>
          </View>

          {/* Matched riders pill floating above sheet */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(400)}
            style={styles.matchedPill}
          >
            <View style={styles.matchedAvatarRow}>
              {MOCK_MATCH.riders.map((r, i) => (
                <View key={i} style={[styles.avatar, i > 0 ? styles.avatarOverlap : null]}>
                  <AppText variant="monoSmall" color={theme.colors.black} style={styles.avatarText}>
                    {r.initials}
                  </AppText>
                </View>
              ))}
              <View style={[styles.avatar, styles.avatarOverlap, styles.avatarYou]}>
                <AppText variant="monoSmall" color={theme.colors.offWhite} style={styles.avatarText}>
                  YOU
                </AppText>
              </View>
            </View>
            <AppText variant="bodySmall" color={theme.colors.black}>
              {MOCK_MATCH.riderCount} riders matched
            </AppText>
          </Animated.View>
        </LiveMap>
      </View>

      {/* Bottom sheet */}
      <Animated.View
        style={[styles.sheet, sheetAnimatedStyle]}
        {...sheetPanResponder.panHandlers}
      >
        <Pressable onPress={expandSheet} style={styles.handleArea}>
          <View style={styles.handle} />
        </Pressable>

        {/* Sheet header */}
        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeaderCopy}>
            <AppText variant="monoSmall" color={theme.colors.orange}>GROUP RIDE • MATCHED</AppText>
            <AppText variant="h1">Wheeler Group</AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              Shared bike ride — split fare with {MOCK_MATCH.riderCount} riders
            </AppText>
          </View>
          <View style={styles.rideIcon}>
            <AppText style={styles.rideEmoji}>🛵</AppText>
          </View>
        </View>

        {/* Price card */}
        <Pressable onPress={expandSheet} style={styles.priceCard}>
          <View style={styles.priceCardMain}>
            <View style={styles.priceCopy}>
              <View style={styles.metricRow}>
                <MetricPill label={`${MOCK_MATCH.etaMinutes} min trip`} />
                <MetricPill label={`${MOCK_MATCH.distanceKm.toFixed(1)} km`} muted />
              </View>
              <AppText variant="h3" color={theme.colors.offWhite}>Per rider</AppText>
              <AppText variant="bodySmall" color="rgba(255,255,255,0.65)">
                Total {formatNgn(MOCK_MATCH.totalFare)} ÷ {MOCK_MATCH.riderCount} riders
              </AppText>
            </View>
            <View style={styles.priceBlock}>
              <AppText variant="monoSmall" color="rgba(255,255,255,0.6)">NGN</AppText>
              <AppText variant="h2" color={theme.colors.offWhite}>
                {Math.round(MOCK_MATCH.farePerRider).toLocaleString("en-NG")}
              </AppText>
            </View>
          </View>
        </Pressable>

        {/* Matched riders list */}
        <View style={styles.ridersCard}>
          <View style={styles.ridersCardHeader}>
            <MaterialIcons name="group" size={16} color={theme.colors.muted} />
            <AppText variant="monoSmall" color={theme.colors.muted}>YOUR RIDE GROUP</AppText>
          </View>
          {MOCK_MATCH.riders.map((r, i) => (
            <View key={i}>
              <View style={styles.riderRow}>
                <View style={styles.riderAvatar}>
                  <AppText variant="monoSmall" color={theme.colors.black} style={{ fontSize: 11 }}>
                    {r.initials}
                  </AppText>
                </View>
                <View style={styles.riderInfo}>
                  <AppText variant="bodyMedium">{r.name}</AppText>
                  <View style={styles.verifiedTag}>
                    <MaterialIcons name="verified-user" size={11} color={theme.colors.green} />
                    <AppText variant="monoSmall" color={theme.colors.green} style={{ fontSize: 10 }}>VERIFIED</AppText>
                  </View>
                </View>
                <View style={styles.riderFare}>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    {formatNgn(MOCK_MATCH.farePerRider)}
                  </AppText>
                </View>
              </View>
              {i < MOCK_MATCH.riders.length - 1 ? <View style={styles.riderDivider} /> : null}
            </View>
          ))}
        </View>

        <AppButton
          title="Join Group Ride"
          onPress={() => router.replace("/rider")}
        />
      </Animated.View>
    </AppScreen>
  );
}

function MetricPill({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <View style={[styles.metricPill, muted ? styles.metricPillMuted : styles.metricPillAccent]}>
      <AppText variant="monoSmall" color={theme.colors.black}>
        {label}
      </AppText>
    </View>
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
  topBar: {
    position: "absolute",
    top: 16,
    left: theme.spacing.gutter,
    right: theme.spacing.gutter,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mapChip: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadows.card,
  },
  matchedPill: {
    position: "absolute",
    right: theme.spacing.gutter,
    bottom: 320,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
    alignItems: "center",
    ...theme.shadows.card,
  },
  matchedAvatarRow: {
    flexDirection: "row",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.offWhite,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatarYou: {
    backgroundColor: theme.colors.black,
  },
  avatarText: {
    fontSize: 10,
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
    minHeight: 500,
  },
  handleArea: {
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
  },
  handle: {
    width: 56,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.borderLight,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  rideIcon: {
    width: 62,
    height: 62,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orangeLight,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  rideEmoji: {
    fontSize: 28,
  },
  priceCard: {
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  priceCardMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  priceCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  metricRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  metricPill: {
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
  },
  metricPillAccent: {
    backgroundColor: "#FFD1B5",
  },
  metricPillMuted: {
    backgroundColor: theme.colors.white,
  },
  priceBlock: {
    minWidth: 118,
    alignSelf: "stretch",
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(13,13,13,0.18)",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  ridersCard: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  ridersCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  riderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  riderAvatar: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  riderInfo: {
    flex: 1,
    gap: 3,
  },
  verifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  riderFare: {
    alignItems: "flex-end",
  },
  riderDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginLeft: 46,
    marginVertical: theme.spacing.sm,
  },
});
