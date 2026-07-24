import { Href, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { useDriverSession } from '@/lib/driver-session';
import { playRideRequestSound, stopRideRequestSound } from '@/lib/sounds';
import { theme } from '@/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 120;

const PLATFORM_FEE_RATE = 0.0008;

function formatNgn(amount: number): string {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

export default function IncomingRequestScreen() {
  const router = useRouter();
  const { session, acceptRide, rejectRide } = useDriverSession();
  const offer = session.currentOffer;
  const [countdown, setCountdown] = useState(0);
  const [bidMode, setBidMode] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bidInputRef = useRef<TextInput>(null);

  // Swipe-to-dismiss
  const translateY = useSharedValue(0);

  const dismiss = () => {
    void handleDismiss();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Only allow downward swipe
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, () => {
          runOnJS(dismiss)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (!offer?.expiresAt) return;
    const expiresMs = new Date(offer.expiresAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.round((expiresMs - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        router.replace('/driver/(tabs)/home' as Href);
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [offer?.expiresAt, router]);

  // Play alert sound + haptic when offer arrives
  useEffect(() => {
    void playRideRequestSound();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    return () => {
      void stopRideRequestSound();
    };
  }, []);

  // If no offer, go back
  useEffect(() => {
    if (!offer) {
      router.replace('/driver/(tabs)/home' as Href);
    }
  }, [offer, router]);

  // Navigate forward when ride is accepted
  useEffect(() => {
    if (session.status === 'navigating') {
      void stopRideRequestSound();
      router.replace('/driver/navigation' as Href);
    }
  }, [session.status, router]);

  const handleAccept = async () => {
    if (!offer) return;
    try {
      void stopRideRequestSound();
      await acceptRide(offer.rideId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not accept ride.');
    }
  };

  const handleDismiss = async () => {
    if (!offer) return;
    try {
      void stopRideRequestSound();
      await rejectRide(offer.rideId);
    } catch {
      // ignore
    }
    router.replace('/driver/(tabs)/home' as Href);
  };

  const handleBidPress = () => {
    setBidMode(true);
    setBidAmount('');
    requestAnimationFrame(() => bidInputRef.current?.focus());
  };

  const handleSubmitBid = async () => {
    if (!offer) return;
    const amount = parseInt(bidAmount, 10);
    if (!amount || amount < 100) {
      Alert.alert('Invalid amount', 'Enter a valid bid amount.');
      return;
    }
    try {
      void stopRideRequestSound();
      Keyboard.dismiss();
      // Accept with the bid amount — the driver session sends agreedFareNgn
      await acceptRide(offer.rideId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not submit bid.');
    }
  };

  const handleCancelBid = () => {
    setBidMode(false);
    setBidAmount('');
    Keyboard.dismiss();
  };

  if (!offer) return null;

  const grossFare = offer.fareEstimateNgn;
  const platformFee = Math.round(grossFare * PLATFORM_FEE_RATE);
  const driverPayout = grossFare - platformFee;
  const distanceKm = offer.plannedDistanceKm
    ? `${offer.plannedDistanceKm.toFixed(1)} km`
    : '--';
  const durationMin = offer.plannedDurationSeconds
    ? `${Math.ceil(offer.plannedDurationSeconds / 60)} min`
    : '--';

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Dimmed background — tap to dismiss */}
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      </Animated.View>

      {/* Swipeable card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          entering={FadeInDown.duration(350).springify().damping(18)}
          style={[styles.cardWrap, cardAnimatedStyle]}
        >
          {/* Swipe handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Header row */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <AppText variant="monoSmall" color={theme.colors.muted}>
                NEW REQUEST
              </AppText>
              <AppText variant="h2">Ride request</AppText>
            </View>
            <View style={styles.timerBadge}>
              <AppText variant="monoLarge" color={countdown <= 10 ? theme.colors.danger : theme.colors.black}>
                {countdown}s
              </AppText>
            </View>
          </View>

          {/* Route */}
          <View style={styles.routeCard}>
            <View style={styles.routeConnector}>
              <View style={[styles.routeDot, { backgroundColor: theme.colors.green }]} />
              <View style={styles.routeLine} />
              <View style={[styles.routeDot, { backgroundColor: theme.colors.black }]} />
            </View>
            <View style={styles.routeLabels}>
              <View style={styles.routeStop}>
                <AppText variant="bodySmall" color={theme.colors.muted}>Pickup</AppText>
                <AppText variant="bodyMedium" numberOfLines={2}>{offer.pickup.address}</AppText>
              </View>
              <View style={styles.routeDivider} />
              <View style={styles.routeStop}>
                <AppText variant="bodySmall" color={theme.colors.muted}>Destination</AppText>
                <AppText variant="bodyMedium" numberOfLines={2}>{offer.destination.address}</AppText>
              </View>
            </View>
          </View>

          {/* Metrics row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <AppText variant="bodySmall" color={theme.colors.muted}>Distance</AppText>
              <AppText variant="h3">{distanceKm}</AppText>
            </View>
            <View style={styles.metricCard}>
              <AppText variant="bodySmall" color={theme.colors.muted}>Duration</AppText>
              <AppText variant="h3">{durationMin}</AppText>
            </View>
            <View style={styles.metricCard}>
              <AppText variant="bodySmall" color={theme.colors.muted}>You earn</AppText>
              <AppText variant="h3" color={theme.colors.green}>{formatNgn(driverPayout)}</AppText>
            </View>
          </View>

          {/* Fare breakdown */}
          <View style={styles.fareRow}>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              Rider's offer: {formatNgn(grossFare)}
            </AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              Fee (0.08%): -{formatNgn(platformFee)}
            </AppText>
          </View>

          {/* Bid input mode */}
          {bidMode ? (
            <View style={styles.bidInputWrap}>
              <View style={styles.bidInputRow}>
                <AppText variant="h3" color={theme.colors.muted}>₦</AppText>
                <TextInput
                  ref={bidInputRef}
                  style={styles.bidInput}
                  value={bidAmount}
                  onChangeText={setBidAmount}
                  placeholder="Your price"
                  placeholderTextColor={theme.colors.mutedLight}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmitBid}
                />
              </View>
              <View style={styles.bidActions}>
                <Pressable onPress={handleCancelBid} style={styles.bidCancelBtn}>
                  <AppText variant="label" color={theme.colors.muted}>Cancel</AppText>
                </Pressable>
                <AppButton
                  title="Submit bid"
                  onPress={handleSubmitBid}
                  style={styles.bidSubmitBtn}
                />
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <AppButton title="Accept" onPress={handleAccept} style={styles.acceptBtn} />
              <AppButton title="Bid" variant="ghost" onPress={handleBidPress} style={styles.bidBtn} />
            </View>
          )}

          {/* Hint */}
          <AppText variant="bodySmall" color={theme.colors.mutedLight} style={styles.hint}>
            Swipe down to ignore
          </AppText>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardWrap: {
    backgroundColor: theme.colors.offWhite,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    borderWidth: theme.borders.thick,
    borderBottomWidth: 0,
    borderColor: theme.colors.black,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: theme.spacing.md,
  },

  // Handle
  handleWrap: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.borderLight,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    gap: 2,
  },
  timerBadge: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.subtle,
  },

  // Route card
  routeCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.sm,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.subtle,
  },
  routeConnector: {
    alignItems: 'center',
    paddingTop: 4,
    gap: 0,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: 2,
  },
  routeLabels: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  routeStop: {
    gap: 2,
  },
  routeDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.sm,
    padding: theme.spacing.sm,
    gap: 4,
    alignItems: 'center',
    ...theme.shadows.subtle,
  },

  // Fare
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xs,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  acceptBtn: {
    flex: 2,
  },
  bidBtn: {
    flex: 1,
  },

  // Bid input
  bidInputWrap: {
    gap: theme.spacing.sm,
  },
  bidInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    minHeight: 52,
    ...theme.shadows.subtle,
  },
  bidInput: {
    flex: 1,
    fontFamily: 'ClashDisplay_700Bold',
    fontSize: 22,
    color: theme.colors.black,
    paddingVertical: 0,
  },
  bidActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  bidCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  bidSubmitBtn: {
    flex: 2,
  },

  // Hint
  hint: {
    textAlign: 'center',
  },
});
