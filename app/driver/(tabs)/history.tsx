import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { useAuth } from '@/lib/auth';
import { getAccessTokenWithRetry } from '@/lib/access-token';
import {
  getDriverRideHistory,
  getWalletTransactions,
  type DriverHistoryRide,
  type WalletTransaction,
} from '@/lib/api';
import { useAppTheme } from '@/lib/theme-context';
import { theme } from '@/theme';

type Tab = 'rides' | 'transactions';

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

function statusColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return theme.colors.green;
    case 'CANCELLED':
      return theme.colors.danger;
    case 'IN_PROGRESS':
    case 'DRIVER_EN_ROUTE':
    case 'ARRIVED':
      return theme.colors.orange;
    default:
      return theme.colors.muted;
  }
}

export default function DriverHistoryScreen() {
  const { getAccessToken } = useAuth();
  const { isDark } = useAppTheme();
  const [activeTab, setActiveTab] = useState<Tab>('rides');
  const [rides, setRides] = useState<DriverHistoryRide[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loadingRides, setLoadingRides] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const accessToken = await getAccessTokenWithRetry(getAccessToken);
      if (!accessToken) return;
      const [rideData, txnData] = await Promise.all([
        getDriverRideHistory({ accessToken, limit: 30 }),
        getWalletTransactions({ accessToken, limit: 30 }),
      ]);
      setRides(rideData.items);
      setTransactions(txnData.items);
    } catch {
      // non-blocking
    } finally {
      setLoadingRides(false);
      setLoadingTxns(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const loading = activeTab === 'rides' ? loadingRides : loadingTxns;

  return (
    <AppScreen scroll contentStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.orange} colors={[theme.colors.orange]} />}>
      <AppText variant="h1">History</AppText>

      {/* Tab switcher */}
      <View style={[styles.tabs, isDark && { backgroundColor: theme.colors.darkSurface, borderColor: theme.colors.darkBorder }]}>
        <Pressable
          onPress={() => setActiveTab('rides')}
          style={[styles.tab, activeTab === 'rides' && styles.tabActive]}
        >
          <AppText
            variant="label"
            color={activeTab === 'rides' ? theme.colors.white : theme.colors.muted}
          >
            Rides
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('transactions')}
          style={[styles.tab, activeTab === 'transactions' && styles.tabActive]}
        >
          <AppText
            variant="label"
            color={activeTab === 'transactions' ? theme.colors.white : theme.colors.muted}
          >
            Transactions
          </AppText>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={theme.colors.orange} />
        </View>
      ) : activeTab === 'rides' ? (
        rides.length === 0 ? (
          <View style={styles.emptyWrap}>
            <AppText variant="body" color={theme.colors.muted} style={styles.emptyText}>
              No rides yet. Go online to start accepting ride requests.
            </AppText>
          </View>
        ) : (
          <View style={styles.list}>
            {rides.map((ride) => {
              const fare = ride.fareFinalNgn ?? ride.fareEstimateNgn;
              const date = ride.completedAt ?? ride.cancelledAt ?? ride.createdAt;
              return (
                <AppCard key={ride.id} style={styles.rideCard}>
                  <View style={styles.rideTop}>
                    <View style={styles.rideInfo}>
                      <AppText variant="bodyMedium" numberOfLines={1}>
                        {ride.pickupAddress}
                      </AppText>
                      <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={1}>
                        to {ride.destAddress}
                      </AppText>
                    </View>
                    <AppText
                      variant="mono"
                      color={ride.status === 'COMPLETED' ? theme.colors.green : theme.colors.muted}
                    >
                      {formatNgn(fare)}
                    </AppText>
                  </View>
                  <View style={styles.rideBottom}>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      {formatDate(date)}
                    </AppText>
                    <View
                      style={[styles.dot, { backgroundColor: statusColor(ride.status) }]}
                    />
                    <AppText variant="bodySmall" color={statusColor(ride.status)}>
                      {ride.status.replace(/_/g, ' ')}
                    </AppText>
                  </View>
                </AppCard>
              );
            })}
          </View>
        )
      ) : transactions.length === 0 ? (
        <View style={styles.emptyWrap}>
          <AppText variant="body" color={theme.colors.muted} style={styles.emptyText}>
            No transactions yet.
          </AppText>
        </View>
      ) : (
        <View style={styles.list}>
          {transactions.map((entry) => {
            const isCredit = entry.direction === 'CREDIT';
            return (
              <AppCard key={entry.id} style={styles.txnCard}>
                <View style={styles.txnRow}>
                  <View style={[styles.txnIcon, isCredit ? styles.txnIconCredit : styles.txnIconDebit]}>
                    <AppText variant="label" color={isCredit ? theme.colors.green : theme.colors.danger}>
                      {isCredit ? '+' : '-'}
                    </AppText>
                  </View>
                  <View style={styles.txnInfo}>
                    <AppText variant="bodyMedium">
                      {entry.type.replace(/_/g, ' ')}
                    </AppText>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      {formatDate(entry.createdAt)}
                    </AppText>
                  </View>
                  <AppText
                    variant="mono"
                    color={isCredit ? theme.colors.green : theme.colors.danger}
                  >
                    {isCredit ? '+' : '-'}{formatNgn(Math.abs(entry.amountNgn))}
                  </AppText>
                </View>
              </AppCard>
            );
          })}
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

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.sm,
    padding: 4,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    ...theme.shadows.subtle,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: theme.radii.xs,
  },
  tabActive: {
    backgroundColor: theme.colors.orange,
  },

  // Loader & empty
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

  // List
  list: {
    gap: 10,
  },

  // Ride card
  rideCard: {
    gap: 10,
  },
  rideTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  rideInfo: {
    flex: 1,
    gap: 2,
  },
  rideBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Transaction card
  txnCard: {
    paddingVertical: 14,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.xs,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnIconCredit: {
    backgroundColor: theme.colors.successLight,
  },
  txnIconDebit: {
    backgroundColor: theme.colors.dangerLight,
  },
  txnInfo: {
    flex: 1,
    gap: 2,
  },
});
