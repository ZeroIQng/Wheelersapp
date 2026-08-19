import { Href, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { useAuth } from '@/lib/auth';
import { getAccessTokenWithRetry } from '@/lib/access-token';
import { getDriverStats, getDriverEarnings, type DriverStatsResponse } from '@/lib/api';
import { useDriverSession } from '@/lib/driver-session';
import { useAppLocation } from '@/lib/location';
import { useAppNotifications } from '@/lib/notifications';
import { useQuestBadge } from '@/lib/quest-badge-context';
import { useResponsive } from '@/lib/responsive';
import { playRideRequestSound, stopRideRequestSound } from '@/lib/sounds';
import { theme } from '@/theme';

function countCompletedQuests(todayRides: number, todayEarnings: number, totalRides: number, rating: number): number {
  let count = 0;
  if (todayRides >= 5) count++;   // Daily Grind
  if (todayRides >= 10) count++;  // Road Warrior
  if (todayEarnings >= 10000) count++; // Big Earner
  if (rating >= 4.8 && rating > 0) count++; // Five Star Driver
  if (totalRides >= 100) count++; // Century Club
  return count;
}

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

const LAGOS_REGION = {
  latitude: 6.4478,
  longitude: 3.4401,
  latitudeDelta: 0.035,
  longitudeDelta: 0.025,
};

/** Straight-line km, same formula ride-service uses to pick nearby drivers. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return r * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function DriverHomeScreen() {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const { session, goOnline, goOffline, selectOffer } = useDriverSession();

  // Every live request. The driver picks one from this list — nothing opens by
  // itself, which is both what a driver expects and what stops the screen
  // flipping between home and the request card.
  const waitingOffers = session.offers;
  // Bids sent and still unanswered — the driver's money on the table. Shown
  // even after the offer card expires, so leaving the request screen never
  // means losing sight of what's pending.
  const pendingBids = Object.values(session.pendingBids ?? {});
  const { permissionState, requestLocationAccess, currentLocation } = useAppLocation();

  const { permissionGranted, requestNotificationAccess } = useAppNotifications();
  const { reportCompletedCount } = useQuestBadge();
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const notificationPromptedRef = useRef(false);
  const mapRef = useRef<MapView>(null);

  const [stats, setStats] = useState<DriverStatsResponse | null>(null);
  const [todayEarnings, setTodayEarnings] = useState<number>(0);

  useEffect(() => {
    if (permissionState !== 'idle') return;
    void requestLocationAccess();
  }, [permissionState, requestLocationAccess]);

  useEffect(() => {
    if (notificationPromptedRef.current || permissionGranted) return;
    notificationPromptedRef.current = true;
    void requestNotificationAccess();
  }, [permissionGranted, requestNotificationAccess]);

  useEffect(() => {
    void (async () => {
      try {
        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken) return;
        const [driverStats, earnings] = await Promise.all([
          getDriverStats({ accessToken }),
          getDriverEarnings({ accessToken, period: 'today' }),
        ]);
        setStats(driverStats);
        setTodayEarnings(earnings.totalEarningsNgn);
        reportCompletedCount(countCompletedQuests(
          earnings.rideCount,
          earnings.totalEarningsNgn,
          driverStats.totalRides,
          driverStats.rating,
        ));
      } catch {
        // non-blocking
      }
    })();
    // Both deps are stable by construction (useCallback with empty deps), so
    // this runs once per mount. That matters more than it looks: this effect
    // fires two network calls, and anything that makes either identity change
    // per render turns it into a request flood.
  }, [getAccessToken, reportCompletedCount]);

  // Requests are NOT auto-opened. Pushing the request screen automatically
  // fought with that screen's own "no offer → go home" redirect: push → replace
  // → home remounts → push again, which is the flicker you see. The driver taps
  // a request from the list below instead.
  //
  // Because nothing opens on its own, the alert has to live here: ring while
  // there is at least one live request, stop as soon as the list empties.
  const hasOffers = session.offers.length > 0;
  useEffect(() => {
    if (!hasOffers) {
      void stopRideRequestSound();
      return;
    }

    void playRideRequestSound();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    return () => {
      void stopRideRequestSound();
    };
  }, [hasOffers]);

  // Center map on user location when available
  useEffect(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.012,
      }, 600);
    }
  }, [currentLocation]);

  const isOnline = session.status !== 'offline';
  const driverLat = currentLocation?.lat ?? LAGOS_REGION.latitude;
  const driverLng = currentLocation?.lng ?? LAGOS_REGION.longitude;

  // Nearest pickup first. Arrival order is meaningless to a driver deciding
  // which job to take; how far they have to drive to reach the rider is not.
  const sortedOffers = currentLocation
    ? [...waitingOffers].sort(
        (left, right) =>
          haversineKm(currentLocation.lat, currentLocation.lng, left.pickup.lat, left.pickup.lng) -
          haversineKm(currentLocation.lat, currentLocation.lng, right.pickup.lat, right.pickup.lng),
      )
    : waitingOffers;

  const handleToggleOnline = async () => {
    try {
      if (isOnline) {
        await goOffline();
      } else {
        if (!currentLocation) {
          Alert.alert('Location unavailable', 'We need your location to go online. Please enable location services.');
          return;
        }
        await goOnline(currentLocation.lat, currentLocation.lng);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update status. Please try again.');
    }
  };

  const initialRegion = currentLocation
    ? {
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.012,
      }
    : LAGOS_REGION;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' || Platform.OS === 'ios' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsBuildings
        showsTraffic
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {isOnline && (
          <Circle
            center={{ latitude: driverLat, longitude: driverLng }}
            radius={400}
            fillColor="rgba(255,92,0,0.08)"
            strokeColor="rgba(255,92,0,0.25)"
            strokeWidth={1.5}
          />
        )}
      </MapView>

      {/* Top status bar overlay */}
      <View
        style={[
          styles.topOverlay,
          {
            top: insets.top + responsive.scale(12),
            left: responsive.gutter,
            right: responsive.gutter,
          },
        ]}>
        <View style={[styles.statusChip, isOnline ? styles.statusOnline : styles.statusOffline]}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? theme.colors.green : theme.colors.mutedLight }]} />
          <AppText variant="label" color={isOnline ? theme.colors.green : theme.colors.muted}>
            {isOnline ? 'Online' : 'Offline'}
          </AppText>
        </View>
      </View>

      {/* Bids awaiting a rider's answer — visible until resolved */}
      {pendingBids.length > 0 ? (
        <View
          style={[
            styles.requestsOverlay,
            {
              top: insets.top + responsive.scale(56),
              left: responsive.gutter,
              right: responsive.gutter,
            },
          ]}>
          <View style={styles.pendingBidCard}>
            {pendingBids.map((bid) => (
              <View key={bid.offer.rideId} style={styles.pendingBidRow}>
                <AppText variant="label" color={theme.colors.green}>
                  ⏳ Bid sent · {formatNgn(bid.amountNgn)}
                </AppText>
                <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={1}>
                  {bid.offer.pickup.address} — waiting for rider
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Incoming requests — always a list, even for one, so the driver reads
          the same layout every time and a second request simply appears in it.
          Sits at the top: nearest-first, distance leading, because "how far do
          I drive to reach them" is the first thing that decides a job. */}
      {waitingOffers.length > 0 ? (
        <View
          style={[
            styles.requestsOverlay,
            {
              top: insets.top + responsive.scale(pendingBids.length > 0 ? 132 : 56),
              left: responsive.gutter,
              right: responsive.gutter,
            },
          ]}>

          <View style={styles.queueCard}>
            <AppText variant="h3" color={theme.colors.orange} style={styles.queueHeading}>
              🚗 {waitingOffers.length} ride request{waitingOffers.length === 1 ? '' : 's'}
            </AppText>
            <AppText variant="bodySmall" color={theme.colors.muted} style={styles.queueSub}>
              Tap a request to view and bid
            </AppText>
            <ScrollView style={styles.queueScroll} showsVerticalScrollIndicator={false}>
              {sortedOffers.map((queued) => {
                const pickupKm = currentLocation
                  ? haversineKm(
                      currentLocation.lat,
                      currentLocation.lng,
                      queued.pickup.lat,
                      queued.pickup.lng,
                    )
                  : null;
                return (
                  <Pressable
                    key={queued.rideId}
                    onPress={() => {
                      void stopRideRequestSound();
                      selectOffer(queued.rideId);
                      router.push('/driver/incoming-request' as Href);
                    }}
                    style={({ pressed }) => [styles.queueRow, pressed && styles.queueRowPressed]}>
                    {/* Distance to the rider, leading and largest — the number
                        a driver decides on before anything else. */}
                    <View style={styles.distanceBadge}>
                      <AppText variant="h3" color={theme.colors.orange}>
                        {/* Without a GPS fix this would be measured from a
                            hardcoded city centre — a confident, wrong number.
                            Show nothing rather than mislead. */}
                        {pickupKm === null
                          ? '--'
                          : pickupKm < 10
                            ? pickupKm.toFixed(1)
                            : Math.round(pickupKm)}
                      </AppText>
                      <AppText variant="monoSmall" color={theme.colors.muted}>
                        {pickupKm === null ? 'no GPS' : 'km away'}
                      </AppText>
                    </View>

                    <View style={styles.queueRowText}>
                      <AppText variant="body" numberOfLines={1}>
                        {queued.pickup.address}
                      </AppText>
                      <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={1}>
                        to {queued.destination.address}
                      </AppText>
                      <AppText variant="monoSmall" color={theme.colors.mutedLight}>
                        {queued.plannedDistanceKm
                          ? `${queued.plannedDistanceKm.toFixed(1)} km trip`
                          : 'trip length unknown'}
                        {queued.isGroupRide ? ` · group · ${queued.riderCount ?? 2} riders` : ''}
                      </AppText>
                    </View>

                    <AppText variant="label" color={theme.colors.orange}>
                      {formatNgn(queued.riderOfferNgn ?? queued.fareEstimateNgn)}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {/* Bottom card overlay */}
      <View
        style={[
          styles.bottomOverlay,
          {
            bottom: Math.max(insets.bottom, responsive.scale(12)),
            left: responsive.gutter,
            right: responsive.gutter,
            gap: responsive.scale(12),
          },
        ]}>
        {/* Metrics row */}
        <View style={[styles.metricsCard, { paddingVertical: responsive.scale(14) }]}>
          <View style={styles.metricItem}>
            <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={1}>Today</AppText>
            <AppText
              variant="h3"
              color={theme.colors.orange}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={1}>
              {formatNgn(todayEarnings)}
            </AppText>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={1}>Rating</AppText>
            <AppText variant="h3" adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1}>
              {stats ? stats.rating.toFixed(1) : '--'}
            </AppText>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={1}>Rides</AppText>
            <AppText variant="h3" adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1}>
              {stats ? String(stats.totalRides) : '--'}
            </AppText>
          </View>
        </View>

        {/* Go online/offline button */}
        <Pressable
          onPress={handleToggleOnline}
          style={({ pressed }) => [
            styles.toggleBtn,
            { minHeight: responsive.scale(52) },
            isOnline ? styles.toggleBtnOffline : styles.toggleBtnOnline,
            pressed && styles.toggleBtnPressed,
          ]}
        >
          <AppText variant="label" color={theme.colors.white} numberOfLines={1}>
            {isOnline ? 'Go Offline' : 'Go Online'}
          </AppText>
        </Pressable>

        {!responsive.isShort && !isOnline && (
          <AppText variant="bodySmall" color={theme.colors.muted} style={styles.hint} numberOfLines={2}>
            Go online to start accepting ride requests
          </AppText>
        )}
        {!responsive.isShort && isOnline && (
          <AppText variant="bodySmall" color={theme.colors.green} style={styles.hint} numberOfLines={2}>
            Waiting for ride requests nearby...
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.mapBase,
  },

  // Top overlay — position comes from safe-area insets at render time
  topOverlay: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    ...theme.shadows.subtle,
  },
  statusOnline: {
    backgroundColor: theme.colors.white,
  },
  statusOffline: {
    backgroundColor: theme.colors.white,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Bottom overlay — position comes from safe-area insets at render time
  bottomOverlay: {
    position: 'absolute',
  },
  requestsOverlay: {
    position: 'absolute',
  },
  queueScroll: {
    maxHeight: 240,
  },
  distanceBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58,
  },
  queueCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: theme.colors.orange,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    shadowColor: theme.colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  queueHeading: {
    marginBottom: 0,
  },
  queueSub: {
    marginBottom: 4,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  queueRowPressed: {
    opacity: 0.6,
    backgroundColor: theme.colors.orangeLight,
  },
  pendingBidCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.green,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  pendingBidRow: {
    gap: 2,
  },
  queueRowText: {
    flex: 1,
    gap: 2,
  },
  metricsCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.md,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    ...theme.shadows.card,
  },
  metricItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.colors.borderLight,
  },

  // Toggle button
  toggleBtn: {
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    ...theme.shadows.card,
  },
  toggleBtnOnline: {
    backgroundColor: theme.colors.orange,
  },
  toggleBtnOffline: {
    backgroundColor: theme.colors.black,
  },
  toggleBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  hint: {
    textAlign: 'center',
  },
});
