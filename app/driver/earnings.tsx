import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Polyline } from 'react-native-svg';

import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { useAuth } from '@/lib/auth';
import { getAccessTokenWithRetry } from '@/lib/access-token';
import { getDriverEarnings, type DriverEarningsResponse } from '@/lib/api';
import { useAppTheme } from '@/lib/theme-context';
import { theme } from '@/theme';

type Period = 'today' | 'week' | 'month';

const periods: { label: string; value: Period }[] = [
  { label: 'Today', value: 'today' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
];

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function BackIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="19" y1="12" x2="5" y2="12" />
      <Polyline points="12 19 5 12 12 5" />
    </Svg>
  );
}

function EarningIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.orange} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="12" y1="1" x2="12" y2="23" />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  );
}

export default function DriverEarningsScreen() {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const { isDark } = useAppTheme();
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

  return (
    <AppScreen scroll contentStyle={styles.container}>
      {/* Header with back */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backBtn, isDark && { backgroundColor: theme.colors.darkSurface }]}>
          <BackIcon />
        </Pressable>
        <AppText variant="h1">Earnings</AppText>
      </View>

      {/* Period tab switcher (same style as History) */}
      <View style={[styles.tabs, isDark && { backgroundColor: theme.colors.darkSurface, borderColor: theme.colors.darkBorder }]}>
        {periods.map((p) => {
          const active = p.value === activePeriod;
          return (
            <Pressable
              key={p.value}
              onPress={() => setActivePeriod(p.value)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <AppText
                variant="label"
                color={active ? theme.colors.white : theme.colors.muted}
              >
                {p.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Summary card */}
      <View style={[styles.summaryCard, isDark && { backgroundColor: theme.colors.darkSurface }]}>
        <View style={styles.summaryItem}>
          <AppText variant="bodySmall" color={theme.colors.muted}>Total earned</AppText>
          <AppText variant="h1" color={theme.colors.orange}>{formatNgn(totalEarnings)}</AppText>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <AppText variant="bodySmall" color={theme.colors.muted}>Rides</AppText>
          <AppText variant="h1">{rideCount}</AppText>
        </View>
      </View>

      {/* Earnings list */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={theme.colors.orange} />
        </View>
      ) : earnings && earnings.items.length > 0 ? (
        <View style={styles.list}>
          {earnings.items.map((item) => (
            <AppCard key={item.id} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={styles.itemIcon}>
                  <EarningIcon />
                </View>
                <View style={styles.itemInfo}>
                  <AppText variant="bodyMedium">Ride payout</AppText>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    {formatDate(item.createdAt)}
                  </AppText>
                </View>
                <AppText variant="mono" color={theme.colors.orange}>
                  +{formatNgn(item.amountNgn)}
                </AppText>
              </View>
            </AppCard>
          ))}
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <AppText variant="body" color={theme.colors.muted} style={styles.emptyText}>
            No earnings for this period yet. Complete rides to start earning.
          </AppText>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingTop: theme.spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },

  // Tabs (matches History style)
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: theme.colors.orange,
  },

  // Summary
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.borderLight,
  },

  // List
  list: {
    gap: 10,
  },
  itemCard: {
    paddingVertical: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },

  // Empty & loader
  loaderWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 240,
  },
});
