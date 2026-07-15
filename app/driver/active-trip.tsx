import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import type MapView from 'react-native-maps';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { GoogleMapView } from '@/components/GoogleMapView';
import { InstructionCard } from '@/components/InstructionCard';
import { MetricCard } from '@/components/MetricCard';
import { RideChat } from '@/components/RideChat';
import { StatusPill } from '@/components/StatusPill';
import { useDriverSession } from '@/lib/driver-session';
import { theme } from '@/theme';

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

export default function DriverActiveTripScreen() {
  const router = useRouter();
  const { session, endTrip, chatMessages, sendChatMessage } = useDriverSession();
  const ride = session.currentRide;

  const mapRef = useRef<MapView>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!ride) {
      router.replace('/driver/(tabs)/home' as Href);
      return;
    }

    const startedAt = ride.startedAt ? new Date(ride.startedAt).getTime() : Date.now();
    const tick = () => {
      setElapsedMinutes(Math.floor((Date.now() - startedAt) / 60000));
    };
    tick();
    const interval = setInterval(tick, 10000);
    return () => clearInterval(interval);
  }, [ride, router]);

  useEffect(() => {
    if (session.status === 'completed') {
      router.replace('/driver/payout' as Href);
    }
  }, [session.status, router]);

  // Fit map to show route when ride data is available
  useEffect(() => {
    if (!ride || !mapRef.current) return;
    const coords = [
      { latitude: ride.pickup.lat, longitude: ride.pickup.lng },
      { latitude: ride.destination.lat, longitude: ride.destination.lng },
    ];
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 50, right: 40, bottom: 40, left: 40 },
      animated: true,
    });
  }, [ride]);

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

  const remainingMinutes = ride.plannedDurationSeconds
    ? Math.max(0, Math.ceil(ride.plannedDurationSeconds / 60) - elapsedMinutes)
    : '--';
  const distanceKm = ride.plannedDistanceKm
    ? ride.plannedDistanceKm.toFixed(1)
    : '--';

  const handleEndRide = async () => {
    await endTrip(ride.rideId);
  };

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />
      <View style={styles.mapWrap}>
        <View style={{ height: 250, backgroundColor: theme.colors.mapBase }}>
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
                <AppText style={styles.markerEmoji}>📍</AppText>
              </View>
            </Marker>
          </GoogleMapView>

          <View style={styles.topBadge}>
            <AppText variant="monoSmall" color={theme.colors.offWhite}>REC</AppText>
          </View>

          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <BackArrow style={styles.backButton} />
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.statusRow}>
          <StatusPill label="TRIP IN PROGRESS" variant="dark" />
          <AppText variant="bodySmall" color={theme.colors.green}>
            Active
          </AppText>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            accent="orange"
            label="MIN LEFT"
            value={String(remainingMinutes)}
          />
          <MetricCard
            label="KM LEFT"
            value={String(distanceKm)}
          />
          <MetricCard
            label="EARNING"
            value={formatNgn(ride.fareNgn)}
          />
        </View>

        <InstructionCard
          instruction={{
            icon: '↗',
            title: 'Head to destination',
            subtitle: ride.destination.address,
          }}
        />

        <AppButton title="End ride" onPress={handleEndRide} />
      </View>

      <Pressable style={styles.chatFab} onPress={() => setChatOpen(true)}>
        <AppText style={styles.chatFabIcon}>💬</AppText>
      </Pressable>

      <RideChat
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        rideId={ride.rideId}
        realtimeMessages={chatMessages}
        onSend={sendChatMessage}
        userRole="DRIVER"
      />
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
    top: 12,
    left: theme.spacing.gutter,
  },
  destinationMarker: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerEmoji: {
    fontSize: 16,
  },
  topBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.black,
    ...theme.shadows.card,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  chatFab: {
    position: 'absolute',
    bottom: 24,
    right: theme.spacing.gutter,
    width: 56,
    height: 56,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  chatFabIcon: {
    fontSize: 24,
  },
});
