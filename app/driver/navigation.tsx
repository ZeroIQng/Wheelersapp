import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import type MapView from 'react-native-maps';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { GoogleMapView } from '@/components/GoogleMapView';
import { InstructionCard } from '@/components/InstructionCard';
import { MetricCard } from '@/components/MetricCard';
import { StatusPill } from '@/components/StatusPill';
import { useDriverSession } from '@/lib/driver-session';
import { useAppLocation } from '@/lib/location';
import { theme } from '@/theme';

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

export default function DriverNavigationScreen() {
  const router = useRouter();
  const { session, arriveAtPickup } = useDriverSession();
  const { currentLocation } = useAppLocation();
  const ride = session.currentRide;
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!ride) {
      router.replace('/driver/(tabs)/home' as Href);
    }
  }, [ride, router]);

  useEffect(() => {
    if (session.status === 'arrived') {
      router.replace('/driver/arrived' as Href);
    }
  }, [session.status, router]);

  // Fit map to show driver + pickup when ride data is available
  useEffect(() => {
    if (!ride || !mapRef.current) return;
    const coords = [
      { latitude: ride.pickup.lat, longitude: ride.pickup.lng },
    ];
    if (currentLocation) {
      coords.push({ latitude: currentLocation.lat, longitude: currentLocation.lng });
    }
    if (coords.length > 0) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    }
  }, [ride, currentLocation]);

  if (!ride) return null;

  const routeCoords = useMemo(() => {
    if (!ride.route?.coordinates) return [];
    return ride.route.coordinates.map((c) => ({ latitude: c.lat, longitude: c.lng }));
  }, [ride.route]);

  const pickupCoord = { latitude: ride.pickup.lat, longitude: ride.pickup.lng };

  const initialRegion = {
    latitude: ride.pickup.lat,
    longitude: ride.pickup.lng,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  const etaMinutes = ride.plannedDurationSeconds
    ? Math.ceil(ride.plannedDurationSeconds / 60)
    : '--';
  const distanceKm = ride.plannedDistanceKm
    ? ride.plannedDistanceKm.toFixed(1)
    : '--';

  const handleArrived = async () => {
    await arriveAtPickup(ride.rideId);
  };

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />
      <View style={styles.mapWrap}>
        <View style={{ height: 290, backgroundColor: theme.colors.mapBase }}>
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
            <Marker coordinate={pickupCoord}>
              <View style={styles.pickupMarker}>
                <AppText style={styles.markerEmoji}>🟢</AppText>
              </View>
            </Marker>
          </GoogleMapView>

          <View style={styles.instructionBanner}>
            <InstructionCard
              instruction={{ icon: '↖', title: 'Head to pickup', subtitle: ride.pickup.address }}
              variant="banner"
            />
          </View>

          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <BackArrow style={styles.backButton} />
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <StatusPill
          dotColor={theme.colors.green}
          label="HEADING TO PICKUP"
          variant="orange"
        />

        <View style={styles.metricsRow}>
          <MetricCard
            accent="orange"
            label="MIN AWAY"
            value={String(etaMinutes)}
          />
          <MetricCard
            label="KM LEFT"
            value={String(distanceKm)}
          />
          <MetricCard
            label="FARE"
            value={formatNgn(ride.fareNgn)}
          />
        </View>

        <AppButton title="I've arrived" onPress={handleArrived} />
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
  backButton: {
    position: 'absolute',
    top: 64,
    left: theme.spacing.gutter,
  },
  pickupMarker: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerEmoji: {
    fontSize: 16,
  },
  instructionBanner: {
    position: 'absolute',
    left: theme.spacing.gutter,
    right: theme.spacing.gutter,
    bottom: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
});
