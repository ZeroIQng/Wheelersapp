import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { BidCard } from "@/components/bid-card";
import { LiveMap } from "@/components/live-map";
import { PulseCircle } from "@/components/static-map";
import { parseRideEstimateParam } from "@/lib/ride-estimate";
import { parseRideItineraryParam, serializeRideItinerary } from "@/lib/ride-route";
import { useRideSession } from "@/lib/ride-session";
import { theme } from "@/theme";

const ngn = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;

/** Matches RIDE_BID_TIMEOUT_SECONDS on the ride service. */
const BID_WINDOW_SECONDS = 180;

/** How much one tap on +/- moves the rider's own offer. */
const OFFER_STEP_NGN = 500;

/**
 * The ride auction.
 *
 * The rider names a price, drivers nearby counter with theirs, and the rider
 * picks one. This screen used to be a 7.2-second timer that invented a driver
 * out of thin air and matched against it; the backend has spoken this
 * bidding protocol all along, the app simply never joined the conversation.
 */
export default function MatchingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    itinerary?: string | string[];
    estimate?: string | string[];
    offer?: string | string[];
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

  const routeSnapshot = useMemo(() => {
    if (initialEstimate?.pickup && initialEstimate.destination && initialEstimate.route) {
      return {
        pickup: initialEstimate.pickup,
        destination: initialEstimate.destination,
        stops: initialEstimate.stops ?? [],
        route: initialEstimate.route,
      };
    }
    return null;
  }, [initialEstimate]);

  const requestedOfferNgn = useMemo(() => {
    const raw = Array.isArray(params.offer) ? params.offer[0] : params.offer;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.round(parsed)
      : initialEstimate?.fareEstimateNgn;
  }, [params.offer, initialEstimate?.fareEstimateNgn]);

  const {
    currentRide,
    error,
    requestRide,
    acceptOffer,
    counterOffer,
    updateOffer,
    dismissOffer,
    cancelRide,
  } = useRideSession();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(BID_WINDOW_SECONDS);
  const [raiseByNgn, setRaiseByNgn] = useState(0);
  const requestFiredRef = useRef(false);
  const navigatedRef = useRef(false);

  const offers = useMemo(() => currentRide?.offers ?? [], [currentRide?.offers]);
  const status = currentRide?.status;
  const riderOfferNgn = currentRide?.riderOfferNgn ?? requestedOfferNgn;
  const timedOut = currentRide?.bidTimeout === true;
  const isSearching = status === "requesting" || status === "bidding" || status === "matching";
  const destination = itinerary.stops[itinerary.stops.length - 1];

  /* ── publish the ride, exactly once ────────────────────────────────── */

  useEffect(() => {
    if (requestFiredRef.current) return;
    requestFiredRef.current = true;

    void (async () => {
      try {
        await requestRide(itinerary, { offerNgn: requestedOfferNgn });
      } catch (requestError) {
        Alert.alert(
          "Could not request this ride",
          requestError instanceof Error
            ? requestError.message
            : "Something went wrong. Please try again.",
          [{ text: "Back", onPress: () => router.back() }],
        );
      }
    })();
    // Once per mount on purpose: re-running this on every render would publish
    // the same trip to drivers over and over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── follow the ride off this screen ───────────────────────────────── */

  useEffect(() => {
    if (navigatedRef.current || !status) return;

    if (status === "matched" || status === "active") {
      navigatedRef.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/driver-found",
        params: { itinerary: serializedItinerary },
      });
      return;
    }

    if (status === "cancelled") {
      navigatedRef.current = true;
      router.replace("/rider");
    }
  }, [status, router, serializedItinerary]);

  /* ── the bid window, counting down ─────────────────────────────────── */

  useEffect(() => {
    if (!isSearching || timedOut) return;

    const closesAt = currentRide?.bidsCloseAt
      ? Date.parse(currentRide.bidsCloseAt)
      : null;

    const tick = () => {
      if (closesAt !== null && Number.isFinite(closesAt)) {
        setSecondsLeft(Math.max(0, Math.round((closesAt - Date.now()) / 1000)));
      } else {
        setSecondsLeft((current) => Math.max(0, current - 1));
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isSearching, timedOut, currentRide?.bidsCloseAt]);

  /* ── a new bid deserves to be felt, not just seen ──────────────────── */

  const offerCountRef = useRef(0);
  useEffect(() => {
    if (offers.length > offerCountRef.current) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    offerCountRef.current = offers.length;
  }, [offers.length]);

  /* ── actions ───────────────────────────────────────────────────────── */

  const handleAccept = useCallback(
    async (driverId: string) => {
      setIsSubmitting(true);
      try {
        await acceptOffer(driverId);
      } catch (acceptError) {
        Alert.alert(
          "Could not accept that bid",
          acceptError instanceof Error
            ? acceptError.message
            : "That driver may have moved on. Try another bid.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [acceptOffer],
  );

  const handleCounter = useCallback(
    async (driverId: string, amountNgn: number) => {
      try {
        await counterOffer(driverId, amountNgn);
      } catch (counterError) {
        Alert.alert(
          "Could not send that offer",
          counterError instanceof Error ? counterError.message : "Please try again.",
        );
      }
    },
    [counterOffer],
  );

  /**
   * Nudging your own price re-offers the trip to every candidate driver, which
   * is the lever that actually unsticks a quiet request.
   */
  const handleRaise = useCallback(
    async (delta: number) => {
      const base = riderOfferNgn;
      if (!base) return;
      const floor = currentRide?.minOfferNgn ?? 0;
      const next = Math.max(floor, base + delta);
      if (next === base) return;

      void Haptics.selectionAsync();
      try {
        await updateOffer(next);
        setRaiseByNgn(next - (requestedOfferNgn ?? next));
      } catch (raiseError) {
        Alert.alert(
          "Could not update your offer",
          raiseError instanceof Error ? raiseError.message : "Please try again.",
        );
      }
    },
    [riderOfferNgn, currentRide?.minOfferNgn, updateOffer, requestedOfferNgn],
  );

  const handleCancel = useCallback(async () => {
    try {
      // Actually cancel. Walking away used to leave the request live on the
      // server, still being offered to drivers the rider had abandoned.
      await cancelRide("Cancelled while choosing a driver");
    } catch {
      // The rider is leaving either way; the stale-ride sweep expires an orphan.
    } finally {
      navigatedRef.current = true;
      router.replace("/rider");
    }
  }, [cancelRide, router]);

  const cheapest = offers[0];
  const countdownColor =
    secondsLeft <= 30 ? theme.colors.danger : theme.colors.black;

  return (
    <AppScreen
      backgroundColor={theme.colors.mapBase}
      contentStyle={styles.container}
      safeAreaEdges={["top", "left", "right"]}
      avoidKeyboard={false}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />

      <View style={styles.mapWrap}>
        <LiveMap
          height={320}
          pickup={routeSnapshot?.pickup}
          destination={routeSnapshot?.destination}
          stops={routeSnapshot?.stops}
          route={routeSnapshot?.route}
          initialCenter={routeSnapshot?.pickup}
          fitPadding={{ top: 80, right: 40, bottom: 80, left: 40 }}
        >
          {offers.length === 0 && !timedOut ? <MapSearchPulse /> : null}

          <View style={styles.mapTopRow}>
            <BackArrow onPress={() => router.back()} />
            <View style={styles.mapChip}>
              <MaterialIcons
                name={offers.length > 0 ? "gavel" : "location-on"}
                size={16}
                color={theme.colors.black}
              />
              <AppText variant="monoSmall">
                {offers.length > 0
                  ? `${offers.length} ${offers.length === 1 ? "BID" : "BIDS"}`
                  : "SEARCHING"}
              </AppText>
            </View>
          </View>
        </LiveMap>
      </View>

      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <View style={styles.offerRow}>
          <View style={styles.offerCopy}>
            <AppText variant="monoSmall" color={theme.colors.orange}>
              YOUR OFFER
            </AppText>
            <AppText variant="metric">{riderOfferNgn ? ngn(riderOfferNgn) : "—"}</AppText>
            <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={1}>
              to {destination}
              {raiseByNgn > 0 ? `  ·  raised by ${ngn(raiseByNgn)}` : ""}
            </AppText>
          </View>

          {isSearching && !timedOut ? (
            <View style={styles.countdown}>
              <AppText variant="monoLarge" color={countdownColor}>
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                left to bid
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Raising your own price is the one control that changes the outcome.
            Only once the request is live — before that there is nothing on the
            server to re-price. */}
        {status === "bidding" && !timedOut && riderOfferNgn ? (
          <View style={styles.raiseRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lower your offer"
              onPress={() => void handleRaise(-OFFER_STEP_NGN)}
              style={styles.raiseButton}
            >
              <MaterialIcons name="remove" size={18} color={theme.colors.black} />
            </Pressable>
            <AppText variant="bodySmall" color={theme.colors.muted} style={styles.raiseHint}>
              {offers.length === 0
                ? "No bids yet? Add a little to reach more drivers."
                : "Adjust your price and every driver sees it."}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Raise your offer"
              onPress={() => void handleRaise(OFFER_STEP_NGN)}
              style={[styles.raiseButton, styles.raiseButtonUp]}
            >
              <MaterialIcons name="add" size={18} color={theme.colors.black} />
            </Pressable>
          </View>
        ) : null}

        {error ? (
          <Animated.View entering={FadeIn} style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={16} color={theme.colors.danger} />
            <AppText variant="bodySmall" color={theme.colors.danger} style={styles.flex}>
              {error}
            </AppText>
          </Animated.View>
        ) : null}

        <ScrollView
          style={styles.bidList}
          contentContainerStyle={styles.bidListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {timedOut ? (
            <Animated.View entering={FadeIn} style={styles.emptyState}>
              <MaterialIcons name="timer-off" size={28} color={theme.colors.muted} />
              <AppText variant="h3">No driver took this trip</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted} style={styles.center}>
                Nobody accepted before the bidding window closed. Offering a little
                more usually finds a driver quickly.
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={styles.retryButton}
              >
                <AppText variant="bodyMedium" color={theme.colors.offWhite}>
                  Try again
                </AppText>
              </Pressable>
            </Animated.View>
          ) : offers.length === 0 ? (
            <Animated.View entering={FadeIn} style={styles.emptyState}>
              <AppText variant="h3">
                {status === "requesting" ? "Sending to drivers…" : "Waiting for offers"}
              </AppText>
              <AppText variant="bodySmall" color={theme.colors.muted} style={styles.center}>
                Drivers near your pickup are seeing this trip now. Their prices land
                here as they come in.
              </AppText>
            </Animated.View>
          ) : (
            <>
              <AppText
                variant="bodySmall"
                color={theme.colors.muted}
                style={styles.listHeading}
              >
                {offers.length} {offers.length === 1 ? "driver" : "drivers"} bidding ·
                cheapest first
              </AppText>

              {offers.map((offer, index) => (
                <BidCard
                  key={offer.driverId}
                  offer={offer}
                  index={index}
                  isCheapest={offers.length > 1 && offer.driverId === cheapest?.driverId}
                  minOfferNgn={currentRide?.minOfferNgn}
                  busy={isSubmitting}
                  onAccept={() => void handleAccept(offer.driverId)}
                  onCounter={(amount) => void handleCounter(offer.driverId, amount)}
                  onDismiss={() => dismissOffer(offer.driverId)}
                />
              ))}
            </>
          )}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          onPress={() => void handleCancel()}
          style={styles.cancelButton}
        >
          <AppText variant="bodyMedium" color={theme.colors.danger}>
            Cancel ride
          </AppText>
        </Pressable>
      </View>
    </AppScreen>
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
      withSequence(withTiming(1.08, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1,
      false,
    );
  }, [markerScale, overlayOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: markerScale.value }],
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.mapBreath, overlayStyle]} />
      <View pointerEvents="none" style={styles.mapSignalWrap}>
        <PulseCircle size={140} color={theme.colors.orange} style={styles.mapSignalOuter} />
        <PulseCircle
          size={92}
          color={theme.colors.orange}
          delay={260}
          style={styles.mapSignalInner}
        />
        <Animated.View style={[styles.mapSignalMarker, markerStyle]}>
          <MaterialIcons name="location-on" size={28} color={theme.colors.offWhite} />
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
  flex: { flex: 1 },
  mapWrap: {
    height: 320,
  },
  mapBreath: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.orange,
  },
  mapSignalWrap: {
    position: "absolute",
    top: "40%",
    left: "50%",
    width: 140,
    height: 140,
    marginLeft: -70,
    marginTop: -70,
    alignItems: "center",
    justifyContent: "center",
  },
  mapSignalOuter: { top: 0, left: 0 },
  mapSignalInner: { top: 24, left: 24 },
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
  sheet: {
    flex: 1,
    marginTop: -theme.spacing.xxl,
    backgroundColor: theme.colors.offWhite,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: theme.borders.thick,
    borderBottomWidth: 0,
    borderColor: theme.colors.black,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.sm,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 56,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.mutedLight,
    marginBottom: theme.spacing.sm,
  },
  offerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  offerCopy: { flex: 1, gap: 2 },
  countdown: { alignItems: "flex-end" },
  raiseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  raiseButton: {
    width: 44,
    height: 40,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  raiseButtonUp: { backgroundColor: theme.colors.orangeLight },
  raiseHint: { flex: 1, textAlign: "center" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  bidList: { flex: 1, marginTop: theme.spacing.md },
  bidListContent: { paddingBottom: theme.spacing.lg },
  listHeading: { marginBottom: theme.spacing.sm },
  emptyState: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xxxl,
  },
  center: { textAlign: "center" },
  retryButton: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.black,
    ...theme.shadows.card,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
});
