import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { BackArrow } from '@/components/back-arrow';
import { MapMock } from '@/components/MapMock';
import { MetricCard } from '@/components/MetricCard';
import { StatusPill } from '@/components/StatusPill';
import { driverNavigationDetails } from '@/data/mock';
import { theme } from '@/theme';

export default function DriverNavigationScreen() {
  const router = useRouter();

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />
      <View style={styles.mapWrap}>
        <MapMock
          height={290}
          instruction={driverNavigationDetails.instruction}
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
          label={driverNavigationDetails.status}
          variant="orange"
        />

        <View style={styles.metricsRow}>
          {driverNavigationDetails.metrics.map((metric) => (
            <MetricCard
              accent={metric.accent}
              key={metric.id}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </View>

        <AppButton title="I've arrived ✓" onPress={() => router.push('/driver/arrived')} />
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
