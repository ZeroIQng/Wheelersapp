import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { MapMock } from '@/components/MapMock';
import { MetricCard } from '@/components/MetricCard';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusPill } from '@/components/StatusPill';
import { driverDashboardSummary } from '@/data/mock';
import { theme } from '@/theme';

export default function DriverDashboardScreen() {
  const router = useRouter();
  const requestRoute = '/driver/incoming-request' as Href;

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <View style={styles.topRow}>
        <SectionHeader subtitle="Ready to pick up nearby riders" title="Online" />
        <StatusPill label={driverDashboardSummary.statusLabel} variant="green" />
      </View>

      <View style={styles.metricsRow}>
        {driverDashboardSummary.metrics.map((metric) => (
          <MetricCard
            accent={metric.accent}
            backgroundColor={metric.id === 'today' ? theme.colors.orangeLight : theme.colors.white}
            key={metric.id}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </View>

      <Pressable onPress={() => router.push(requestRoute)} style={styles.mapPressable}>
        <MapMock height={220} showPulse variant="driverDashboard" />
        <AppText variant="bodySmall" color={theme.colors.muted} style={styles.nearbyLabel}>
          {driverDashboardSummary.nearbyLabel}
        </AppText>
      </Pressable>

      <AppButton title="Open incoming request ↗" onPress={() => router.push(requestRoute)} />

      <Pressable style={styles.offlineButton}>
        <AppText variant="label" color={theme.colors.offWhite}>
          Go offline
        </AppText>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  mapPressable: {
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.mapBase,
    ...theme.shadows.card,
  },
  nearbyLabel: {
    textAlign: 'center',
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.white,
  },
  offlineButton: {
    minHeight: 52,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
});
