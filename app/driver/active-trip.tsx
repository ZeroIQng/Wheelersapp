import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { InstructionCard } from '@/components/InstructionCard';
import { MapMock } from '@/components/MapMock';
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

  if (!ride) return null;

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
        <MapMock
          height={250}
          showCar
          showDestination
          showRoute
          topBadge="REC"
          variant="driverActive">
          <BackArrow style={styles.backButton} />
        </MapMock>
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
