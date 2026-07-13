import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { BackArrow } from '@/components/back-arrow';
import { MapMock } from '@/components/MapMock';
import { MetricCard } from '@/components/MetricCard';
import { StatusPill } from '@/components/StatusPill';
import { useDriverSession } from '@/lib/driver-session';
import { theme } from '@/theme';

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

export default function DriverNavigationScreen() {
  const router = useRouter();
  const { session, arriveAtPickup } = useDriverSession();
  const ride = session.currentRide;

  useEffect(() => {
    if (!ride) {
      router.replace('/driver/dashboard' as Href);
    }
  }, [ride, router]);

  useEffect(() => {
    if (session.status === 'arrived') {
      router.replace('/driver/arrived' as Href);
    }
  }, [session.status, router]);

  if (!ride) return null;

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
        <MapMock
          height={290}
          instruction={{
            icon: '↖',
            title: 'Head to pickup',
            subtitle: ride.pickup.address,
          }}
          showCar
          showDestination
          showInstructionBanner
          showRoute
          variant="driverNavigation">
          <BackArrow style={styles.backButton} />
        </MapMock>
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
