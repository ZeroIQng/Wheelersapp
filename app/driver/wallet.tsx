import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { SectionHeader } from '@/components/SectionHeader';
import { driverWalletOverview } from '@/data/mock';
import { theme } from '@/theme';

export default function DriverWalletScreen() {
  const router = useRouter();
  const dashboardRoute = '/driver/dashboard' as Href;

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <SectionHeader
        actionLabel="Dashboard"
        onActionPress={() => router.replace(dashboardRoute)}
        subtitle="Driver balance and payout activity"
        title="Wallet"
        titleVariant="h1"
      />

      <AppCard backgroundColor={theme.colors.black} style={styles.balanceCard}>
        <AppText variant="bodySmall" color="#9C948D">
          Available balance
        </AppText>
        <AppText variant="display" color={theme.colors.offWhite}>
          {driverWalletOverview.availableBalance}
        </AppText>
        <AppText variant="bodySmall" color="#9C948D">
          Instant cashout: {driverWalletOverview.instantCashout}
        </AppText>
      </AppCard>

      <View style={styles.metricsRow}>
        <AppCard backgroundColor={theme.colors.orangeLight} borderColor={theme.colors.orange} style={styles.metricCard}>
          <AppText variant="monoLarge" color={theme.colors.orange}>
            {driverWalletOverview.pendingPayouts}
          </AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Pending payouts
          </AppText>
        </AppCard>
        <AppCard style={styles.metricCard}>
          <AppText variant="monoLarge">{driverWalletOverview.lifetimeEarnings}</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Lifetime earnings
          </AppText>
        </AppCard>
      </View>

      <AppCard style={styles.activityCard}>
        <AppText variant="h3">Recent wallet activity</AppText>
        {driverWalletOverview.activity.map((entry, index) => (
          <View
            key={entry.id}
            style={[styles.activityRow, index < driverWalletOverview.activity.length - 1 ? styles.divider : null]}>
            <View style={styles.activityCopy}>
              <AppText variant="bodyMedium">{entry.title}</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {entry.timestamp}
              </AppText>
            </View>
            <AppText
              variant="mono"
              color={entry.direction === 'credit' ? theme.colors.green : theme.colors.danger}>
              {entry.amount}
            </AppText>
          </View>
        ))}
      </AppCard>

      <AppButton onPress={() => router.push('/driver/earnings' as Href)} title="View earnings ↗" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  balanceCard: {
    gap: theme.spacing.xxs,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  metricCard: {
    flex: 1,
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCard: {
    gap: theme.spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  activityCopy: {
    flex: 1,
    gap: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEE0D4',
    paddingBottom: theme.spacing.md,
  },
});
