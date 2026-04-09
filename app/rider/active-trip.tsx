import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { MapMock } from '@/components/MapMock';
import { MetricCard } from '@/components/MetricCard';
import { StatusPill } from '@/components/StatusPill';
import { TripProgressBar } from '@/components/TripProgressBar';
import { riderTripDetails } from '@/data/mock';
import { theme } from '@/theme';

export default function RiderActiveTripScreen() {
  const router = useRouter();
  const ratingRoute = '/rider/trip-rating' as Href;
  const emergencyRoute = '/safety/emergency' as Href;

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />
      <View style={styles.mapWrap}>
        <MapMock
          height={260}
          showCar
          showDestination
          showRoute
          topBadge="LIVE"
          variant="riderTrip">
          <BackArrow style={styles.backButton} />
        </MapMock>
      </View>

      <View style={styles.content}>
        <View style={styles.statusRow}>
          <StatusPill label={riderTripDetails.status} variant="dark" />
          <AppText variant="monoSmall" color={theme.colors.muted}>
            ● {riderTripDetails.substatus}
          </AppText>
        </View>

        <TripProgressBar progress={riderTripDetails.progress} />

        <View style={styles.metricsRow}>
          {riderTripDetails.metrics.map((metric) => (
            <MetricCard
              accent={metric.accent}
              key={metric.id}
              label={metric.label}
              style={styles.metric}
              value={metric.value}
            />
          ))}
        </View>

        <AppCard style={styles.routeCard}>
          <StopRow color={theme.colors.green} label={riderTripDetails.pickup} />
          <StopRow color={theme.colors.orange} label={riderTripDetails.destination} />
        </AppCard>

        <View style={styles.actions}>
          <Pressable onPress={() => router.push(emergencyRoute)} style={styles.sosButton}>
            <AppText variant="label" color={theme.colors.offWhite}>
              SOS
            </AppText>
          </Pressable>
          <AppButton title="Share trip ↗" variant="ghost" style={styles.shareButton} />
        </View>

        <AppButton title="Arrived at destination ↗" onPress={() => router.push(ratingRoute)} />
      </View>
    </AppScreen>
  );
}

function StopRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.stopRow}>
      <View style={[styles.stopDot, { backgroundColor: color }]} />
      <AppText variant="bodyMedium">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: theme.spacing.xl,
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
  metric: {
    minHeight: 86,
  },
  routeCard: {
    gap: theme.spacing.sm,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  sosButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: '#FF3333',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  shareButton: {
    flex: 2,
  },
});
