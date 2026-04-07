import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { InstructionCard } from '@/components/InstructionCard';
import { MapMock } from '@/components/MapMock';
import { MetricCard } from '@/components/MetricCard';
import { StatusPill } from '@/components/StatusPill';
import { driverActiveTripDetails } from '@/data/mock';
import { theme } from '@/theme';

export default function DriverActiveTripScreen() {
  const router = useRouter();

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
          <StatusPill label={driverActiveTripDetails.status} variant="dark" />
          <AppText variant="bodySmall" color={theme.colors.green}>
            ● {driverActiveTripDetails.substatus}
          </AppText>
        </View>

        <View style={styles.metricsRow}>
          {driverActiveTripDetails.metrics.map((metric) => (
            <MetricCard
              accent={metric.accent}
              key={metric.id}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </View>

        <InstructionCard instruction={driverActiveTripDetails.instruction} />

        <AppButton title="End ride ✓" onPress={() => router.push('/driver/payout')} />
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
});
