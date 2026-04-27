import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef } from "react";
import { Dimensions, PanResponder, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { FloatingView } from "@/components/motion";
import { walletOverview } from "@/data/mock";
import { StaticMap } from "@/components/static-map";
import { theme } from "@/theme";
const { height, width } = Dimensions.get("window");

const wheelerRide = {
  name: "Wheeler",
  price: "₦3,800",
  eta: "3 min away",
  distance: "5.2 km trip",
  subtitle: "Fast bike ride for 1 rider",
  pickup: "Current location • Lekki Phase 1",
  destination: "Civic Centre, Victoria Island",
} as const;

// Route coordinates as percentages of the map area
// Pickup: Lagos Island (top-left-ish), Destination: Victoria Island (bottom-right-ish)
const PICKUP_PCT = { x: 0.33, y: 0.52 };
const DEST_PCT = { x: 0.84, y: 0.84 };

function parseAmount(value: string) {
  const normalized = value.replace(/,/g, "");
  const match = normalized.match(/\d+(?:\.\d+)?/);

  return match ? Number(match[0]) : 0;
}

function RouteOverlay({
  mapWidth,
  mapHeight,
}: {
  mapWidth: number;
  mapHeight: number;
}) {
  const x1 = PICKUP_PCT.x * mapWidth;
  const y1 = PICKUP_PCT.y * mapHeight;
  const x2 = DEST_PCT.x * mapWidth;
  const y2 = DEST_PCT.y * mapHeight;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lineLength = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  const DOT_SIZE = 14;
  const BORDER = 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Route line */}
      <View
        style={{
          position: "absolute",
          left: x1,
          top: y1,
          width: lineLength,
          height: 3,
          backgroundColor: theme.colors.orange,
          borderRadius: 2,
          transformOrigin: "0 50%",
          transform: [{ rotate: `${angle}deg` }],
          opacity: 0.95,
        }}
      />

      {/* Pickup dot — orange */}
      <View
        style={{
          position: "absolute",
          left: x1 - DOT_SIZE / 2,
          top: y1 - DOT_SIZE / 2,
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: theme.colors.orange,
          borderWidth: BORDER,
          borderColor: theme.colors.black,
        }}
      />

      {/* Destination dot — green */}
      <View
        style={{
          position: "absolute",
          left: x2 - DOT_SIZE / 2,
          top: y2 - DOT_SIZE / 2,
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: theme.colors.green,
          borderWidth: BORDER,
          borderColor: theme.colors.black,
        }}
      />
    </View>
  );
}

export default function RideSelectionScreen() {
  const router = useRouter();
  const collapsedSheetOffset = 196;
  const sheetOffset = useSharedValue(0);
  const rideFare = parseAmount(wheelerRide.price);
  const walletBalance = parseAmount(walletOverview.fiatApprox);

  // Map area height = full screen height minus the bottom sheet height
  const SHEET_MIN_HEIGHT = 438;
  const mapHeight = height - SHEET_MIN_HEIGHT;
  const mapWidth = width;

  const expandSheet = () => {
    sheetOffset.value = withTiming(0, { duration: 220 });
  };

  const collapseSheet = () => {
    sheetOffset.value = withTiming(collapsedSheetOffset, { duration: 220 });
  };

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30) {
          expandSheet();
          return;
        }
        if (gestureState.dy > 30) {
          collapseSheet();
        }
      },
      onPanResponderTerminate: (_, gestureState) => {
        if (gestureState.dy < -30) {
          expandSheet();
          return;
        }
        if (gestureState.dy > 30) {
          collapseSheet();
        }
      },
    }),
  ).current;

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetOffset.value }],
  }));

  const handleBookRide = () => {
    if (walletBalance >= rideFare) {
      router.push("/matching");
      return;
    }

    router.push({
      pathname: "/rider/wallet",
      params: {
        depositAmount: String(rideFare),
        redirectReason: "insufficient-funds",
        rideName: wheelerRide.name,
      },
    });
  };

  return (
    <AppScreen
      backgroundColor={theme.colors.mapBase}
      contentStyle={styles.container}
      safeAreaEdges={["top", "left", "right"]}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />

      <View style={styles.mapWrap}>
        <StaticMap height={height} scene="rideSelection">
          {/* ── Route overlay ── */}
          <RouteOverlay mapWidth={mapWidth} mapHeight={mapHeight} />

          <View style={styles.topBar}>
            <BackArrow onPress={() => router.back()} />
            <FloatingView distance={5}>
              <View style={styles.mapChip}>
                <AppText variant="monoSmall">
                  Wheeler • {wheelerRide.eta}
                </AppText>
              </View>
            </FloatingView>
          </View>

          <FloatingView style={styles.priceBadge} distance={6}>
            <View style={styles.priceBadgeInner}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Estimated fare
              </AppText>
              <AppText variant="monoLarge">{wheelerRide.price}</AppText>
            </View>
          </FloatingView>
        </StaticMap>
      </View>

      <Animated.View
        style={[styles.sheet, sheetAnimatedStyle]}
        {...sheetPanResponder.panHandlers}
      >
        <Pressable onPress={expandSheet} style={styles.handleArea}>
          <View style={styles.handle} />
        </Pressable>

        <View style={styles.sheetHeader}>
          <View>
            <AppText variant="monoSmall" color={theme.colors.orange}>
              RIDE OPTION
            </AppText>
            <AppText variant="h1">{wheelerRide.name}</AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              {wheelerRide.subtitle}
            </AppText>
          </View>
          <View style={styles.rideIcon}>
            <AppText style={styles.rideEmoji}>🛵</AppText>
          </View>
        </View>

        <Pressable onPress={expandSheet} style={styles.rideCard}>
          <View style={styles.rideCardMain}>
            <View style={styles.rideCopy}>
              <View style={styles.metricRow}>
                <MetricPill label={wheelerRide.eta} />
                <MetricPill label={wheelerRide.distance} muted />
              </View>
              <AppText variant="h3">Wheeler</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Direct ride with pickup and drop-off shown on map
              </AppText>
            </View>
            <View style={styles.priceBlock}>
              <AppText variant="monoSmall" color={theme.colors.offWhite}>
                NGN
              </AppText>
              <AppText variant="h2" color={theme.colors.offWhite}>
                {wheelerRide.price}
              </AppText>
            </View>
          </View>
        </Pressable>

        <View style={styles.routeBox}>
          <RouteRow
            color={theme.colors.green}
            label="Pickup"
            value={wheelerRide.pickup}
          />
          <View style={styles.routeDivider} />
          <RouteRow
            color={theme.colors.orange}
            label="Destination"
            value={wheelerRide.destination}
          />
        </View>

        <AppButton
          title="Book Wheeler"
          onPress={handleBookRide}
        />
      </Animated.View>
    </AppScreen>
  );
}

function MetricPill({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <View
      style={[
        styles.metricPill,
        muted ? styles.metricPillMuted : styles.metricPillAccent,
      ]}
    >
      <AppText variant="monoSmall" color={theme.colors.black}>
        {label}
      </AppText>
    </View>
  );
}

function RouteRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.routeRow}>
      <View style={[styles.routeDot, { backgroundColor: color }]} />
      <View style={styles.routeCopy}>
        <AppText variant="monoSmall" color={theme.colors.muted}>
          {label}
        </AppText>
        <AppText variant="bodyMedium">{value}</AppText>
      </View>
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
  priceBadge: {
    position: "absolute",
    right: theme.spacing.gutter,
    bottom: 306,
  },
  priceBadgeInner: {
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
    minHeight: 438,
  },
  handleArea: {
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
  },
  handle: {
    width: 56,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.mutedLight,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  rideCard: {
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  rideCardMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  rideCopy: {
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
    minWidth: 108,
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
  routeBox: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  routeDot: {
    width: 14,
    height: 14,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  routeCopy: {
    flex: 1,
    gap: 1,
  },
  routeDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginLeft: 22,
  },
});
