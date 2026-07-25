import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import type MapView from 'react-native-maps';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { GoogleMapView } from '@/components/GoogleMapView';
import { TripProgressBar } from '@/components/TripProgressBar';
import { useDriverSession } from '@/lib/driver-session';
import { useAppLocation } from '@/lib/location';
import { theme } from '@/theme';

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

export default function DriverActiveTripScreen() {
  const router = useRouter();
  const { session, endTrip, sendGps } = useDriverSession();
  const { currentLocation } = useAppLocation();
  const ride = session.currentRide;

  const mapRef = useRef<MapView>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const lastGpsSentRef = useRef(0);

  // Send GPS every time location changes (provider already throttles to 25m / 15s)
  useEffect(() => {
    if (!currentLocation || !ride) return;
    const now = Date.now();
    if (now - lastGpsSentRef.current < 10000) return; // min 10s between sends
    lastGpsSentRef.current = now;
    sendGps(currentLocation.lat, currentLocation.lng);
  }, [currentLocation, ride, sendGps]);

  useEffect(() => {
    if (!ride) {
      router.replace('/driver/(tabs)/home' as Href);
      return;
    }

    const startedAt = ride.startedAt ? new Date(ride.startedAt).getTime() : Date.now();
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [ride, router]);

  useEffect(() => {
    if (session.status === 'completed') {
      router.replace('/driver/payout' as Href);
    }
  }, [session.status, router]);

  // Fit map to show route
  useEffect(() => {
    if (!ride || !mapRef.current) return;
    const coords = [
      { latitude: ride.pickup.lat, longitude: ride.pickup.lng },
      { latitude: ride.destination.lat, longitude: ride.destination.lng },
    ];
    if (currentLocation) {
      coords.push({ latitude: currentLocation.lat, longitude: currentLocation.lng });
    }
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 50, right: 40, bottom: 40, left: 40 },
      animated: true,
    });
  }, [ride, currentLocation]);

  if (!ride) return null;

  const routeCoords = useMemo(() => {
    if (!ride.route?.coordinates) return [];
    return ride.route.coordinates.map((c) => ({ latitude: c.lat, longitude: c.lng }));
  }, [ride.route]);

  const destinationCoord = { latitude: ride.destination.lat, longitude: ride.destination.lng };

  const initialRegion = {
    latitude: (ride.pickup.lat + ride.destination.lat) / 2,
    longitude: (ride.pickup.lng + ride.destination.lng) / 2,
    latitudeDelta: Math.abs(ride.pickup.lat - ride.destination.lat) * 1.5 || 0.02,
    longitudeDelta: Math.abs(ride.pickup.lng - ride.destination.lng) * 1.5 || 0.02,
  };

  const liveDistanceKm = ride.liveDistanceKm ?? 0;
  const plannedDistanceKm = ride.plannedDistanceKm ?? 0;
  const distanceProgress = plannedDistanceKm > 0
    ? Math.min(1, liveDistanceKm / plannedDistanceKm)
    : 0;

  const handleEndRide = async () => {
    try {
      await endTrip(ride.rideId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not end ride. Please try again.');
    }
  };

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />
      <View style={styles.mapWrap}>
        <View style={styles.mapContainer}>
          <GoogleMapView
            ref={mapRef}
            initialRegion={initialRegion}
            style={StyleSheet.absoluteFill}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            showsBuildings
            showsTraffic
            toolbarEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            {routeCoords.length > 1 && (
              <Polyline coordinates={routeCoords} strokeColor={theme.colors.orange} strokeWidth={5} />
            )}
            <Marker coordinate={destinationCoord}>
              <View style={styles.destinationMarker}>
                <View style={styles.destinationDot} />
              </View>
            </Marker>
          </GoogleMapView>

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <AppText variant="monoSmall" color={theme.colors.offWhite}>LIVE</AppText>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {/* Trip stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <AppText variant="monoLarge" color={theme.colors.orange}>
              {formatDuration(elapsedSeconds)}
            </AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>Elapsed</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <AppText variant="monoLarge" color={theme.colors.black}>
              {liveDistanceKm.toFixed(1)} km
            </AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>Traveled</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <AppText variant="monoLarge" color={theme.colors.green}>
              {formatNgn(ride.fareNgn)}
            </AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>Fare</AppText>
          </View>
        </View>

        {/* Progress bar */}
        <TripProgressBar
          fillColor={theme.colors.orange}
          label={plannedDistanceKm > 0
            ? `${liveDistanceKm.toFixed(1)} of ${plannedDistanceKm.toFixed(1)} km`
            : `${liveDistanceKm.toFixed(1)} km traveled`
          }
          progress={distanceProgress}
        />

        {/* Destination card */}
        <AppCard style={styles.destinationCard}>
          <View style={styles.destinationRow}>
            <View style={styles.destinationIcon}>
              <View style={styles.destinationIconDot} />
            </View>
            <View style={styles.destinationCopy}>
              <AppText variant="bodySmall" color={theme.colors.muted}>Drop-off</AppText>
              <AppText variant="h3" numberOfLines={2}>{ride.destination.address}</AppText>
            </View>
          </View>
          {ride.riderPhone ? (
            <Pressable
              style={styles.callButton}
              onPress={() => Linking.openURL(`tel:${ride.riderPhone}`)}
            >
              <AppText variant="label">Call rider</AppText>
            </Pressable>
          ) : null}
        </AppCard>

        <AppButton title="End ride" onPress={handleEndRide} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
  },
  mapWrap: {
    borderBottomWidth: theme.borders.thick,
    borderBottomColor: theme.colors.black,
  },
  mapContainer: {
    height: 240,
    backgroundColor: theme.colors.mapBase,
  },
  destinationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.offWhite,
  },
  liveBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.black,
    ...theme.shadows.card,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.green,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.sm,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.card,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1.5,
    backgroundColor: theme.colors.borderLight,
    alignSelf: 'stretch',
  },
  destinationCard: {
    gap: theme.spacing.sm,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  destinationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationIconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.offWhite,
  },
  destinationCopy: {
    flex: 1,
    gap: 1,
  },
  callButton: {
    height: 42,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.green,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.subtle,
  },
});
