import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { MetricCard } from '@/components/MetricCard';
import { SectionHeader } from '@/components/SectionHeader';
import { SkeletonCard, SkeletonLine, SkeletonMetricRow } from '@/components/SkeletonLoader';
import { useAuth } from '@/lib/auth';
import { getAccessTokenWithRetry } from '@/lib/access-token';
import { getDriverEarnings, type DriverEarningsResponse } from '@/lib/api';
import { theme } from '@/theme';

type Period = 'today' | 'week' | 'month';

const tabs: { label: string; value: Period }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

export default function DriverEarningsScreen() {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const [activePeriod, setActivePeriod] = useState<Period>('today');
  const [earnings, setEarnings] = useState<DriverEarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken || cancelled) return;
        const data = await getDriverEarnings({ accessToken, period: activePeriod });
        if (!cancelled) setEarnings(data);
      } catch {
        // non-blocking
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getAccessToken, activePeriod]);

  const totalEarnings = earnings?.totalEarningsNgn ?? 0;
  const rideCount = earnings?.rideCount ?? 0;
  const avgFare = rideCount > 0 ? totalEarnings / rideCount : 0;

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <SectionHeader
        actionLabel="Dashboard"
        onActionPress={() => router.replace('/driver/dashboard' as Href)}
        title="Earnings"
        titleVariant="h1"
      />

      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const active = tab.value === activePeriod;
          return (
            <Pressable
              key={tab.value}
              onPress={() => setActivePeriod(tab.value)}
              style={[styles.tab, active ? styles.tabActive : null]}>
              <AppText variant="bodySmall" color={active ? theme.colors.offWhite : theme.colors.muted}>
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {loading && !earnings ? (
        <>
          <SkeletonCard lines={2} />
          <SkeletonMetricRow count={2} />
          <View style={styles.itemsCard}>
            <SkeletonLine width="40%" height={18} />
            <SkeletonCard lines={2} style={{ marginTop: 12 }} />
            <SkeletonCard lines={2} style={{ marginTop: 8 }} />
            <SkeletonCard lines={2} style={{ marginTop: 8 }} />
          </View>
        </>
      ) : (
        <>
          <AppCard style={styles.totalCard}>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              Total {activePeriod}
            </AppText>
            <AppText variant="display">
              {formatNgn(totalEarnings)}
            </AppText>
          </AppCard>

          <View style={styles.metricsRow}>
            <MetricCard
              accent="orange"
              backgroundColor={theme.colors.orangeLight}
              label="Rides"
              value={String(rideCount)}
            />
            <MetricCard
              label="Avg fare"
              value={formatNgn(avgFare)}
            />
          </View>

          {earnings && earnings.items.length > 0 && (
            <AppCard style={styles.itemsCard}>
              <AppText variant="h3">Recent payouts</AppText>
              {earnings.items.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.itemRow, index < earnings.items.length - 1 ? styles.divider : null]}>
                  <View style={styles.itemCopy}>
                    <AppText variant="bodyMedium">Ride payout</AppText>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      {new Date(item.createdAt).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </AppText>
                  </View>
                  <AppText variant="mono" color={theme.colors.green}>
                    +{formatNgn(item.amountNgn)}
                  </AppText>
                </View>
              ))}
            </AppCard>
          )}
        </>
      )}

      <AppButton onPress={() => router.push('/driver/wallet' as Href)} title="Open wallet" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  tabs: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  tab: {
    minWidth: 72,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: theme.borders.regular,
    borderColor: '#DDD1C7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
  },
  tabActive: {
    backgroundColor: theme.colors.orange,
    borderColor: theme.colors.black,
    ...theme.shadows.card,
  },
  totalCard: {
    gap: theme.spacing.xxs,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  itemsCard: {
    gap: theme.spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  itemCopy: {
    flex: 1,
    gap: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEE0D4',
    paddingBottom: theme.spacing.md,
  },
});
