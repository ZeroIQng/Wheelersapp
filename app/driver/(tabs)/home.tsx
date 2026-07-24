import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Circle, PROVIDER_GOOGLE } from 'react-native-maps';

import { AppText } from '@/components/app-text';
import { useAuth } from '@/lib/auth';
import { getAccessTokenWithRetry } from '@/lib/access-token';
import { getDriverStats, getDriverEarnings, type DriverStatsResponse } from '@/lib/api';
import { useDriverSession } from '@/lib/driver-session';
import { useAppLocation } from '@/lib/location';
import { useAppNotifications } from '@/lib/notifications';
import { useQuestBadge } from '@/lib/quest-badge-context';
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

export default function DriverHomeScreen() {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const { session, goOnline, goOffline } = useDriverSession();
  const { permissionState, requestLocationAccess, currentLocation } = useAppLocation();
  const { permissionGranted, requestNotificationAccess } = useAppNotifications();
  const { reportCompletedCount } = useQuestBadge();
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
  }, [getAccessToken]);

  useEffect(() => {
    if (session.status === 'offered' && session.currentOffer) {
      router.push('/driver/incoming-request' as Href);
    }
  }, [session.status, session.currentOffer, router]);

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
      <View style={styles.topOverlay}>
        <View style={[styles.statusChip, isOnline ? styles.statusOnline : styles.statusOffline]}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? theme.colors.green : theme.colors.mutedLight }]} />
          <AppText variant="label" color={isOnline ? theme.colors.green : theme.colors.muted}>
            {isOnline ? 'Online' : 'Offline'}
          </AppText>
        </View>
      </View>

      {/* Bottom card overlay */}
      <View style={styles.bottomOverlay}>
        {/* Metrics row */}
        <View style={styles.metricsCard}>
          <View style={styles.metricItem}>
            <AppText variant="bodySmall" color={theme.colors.muted}>Today</AppText>
            <AppText variant="h3" color={theme.colors.orange}>{formatNgn(todayEarnings)}</AppText>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <AppText variant="bodySmall" color={theme.colors.muted}>Rating</AppText>
            <AppText variant="h3">{stats ? stats.rating.toFixed(1) : '--'}</AppText>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <AppText variant="bodySmall" color={theme.colors.muted}>Rides</AppText>
            <AppText variant="h3">{stats ? String(stats.totalRides) : '--'}</AppText>
          </View>
        </View>

        {/* Go online/offline button */}
        <Pressable
          onPress={handleToggleOnline}
          style={({ pressed }) => [
            styles.toggleBtn,
            isOnline ? styles.toggleBtnOffline : styles.toggleBtnOnline,
            pressed && styles.toggleBtnPressed,
          ]}
        >
          <AppText variant="label" color={theme.colors.white}>
            {isOnline ? 'Go Offline' : 'Go Online'}
          </AppText>
        </Pressable>

        {!isOnline && (
          <AppText variant="bodySmall" color={theme.colors.muted} style={styles.hint}>
            Go online to start accepting ride requests
          </AppText>
        )}
        {isOnline && (
          <AppText variant="bodySmall" color={theme.colors.green} style={styles.hint}>
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

  // Top overlay
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 44,
    left: 20,
    right: 20,
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

  // Bottom overlay
  bottomOverlay: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 16,
    right: 16,
    gap: 12,
  },
  metricsCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.md,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    ...theme.shadows.card,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.colors.borderLight,
  },

  // Toggle button
  toggleBtn: {
    minHeight: 52,
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
