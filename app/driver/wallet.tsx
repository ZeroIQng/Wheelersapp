import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { SectionHeader } from '@/components/SectionHeader';
import { SkeletonCard, SkeletonLine } from '@/components/SkeletonLoader';
import { useAuth } from '@/lib/auth';
import { getAccessTokenWithRetry } from '@/lib/access-token';
import { getWalletTransactions, type WalletTransaction } from '@/lib/api';
import { useWalletOverview } from '@/lib/wallet-overview';
import { theme } from '@/theme';

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

export default function DriverWalletScreen() {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const { overview } = useWalletOverview();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoadingTxns, setIsLoadingTxns] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken) return;
        const data = await getWalletTransactions({ accessToken, limit: 10 });
        setTransactions(data.items);
      } catch {
        // non-blocking
      } finally {
        setIsLoadingTxns(false);
      }
    })();
  }, [getAccessToken]);

  const balanceNgn = overview?.balanceNgn ?? 0;
  const lockedNgn = overview?.lockedNgn ?? 0;

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <SectionHeader
        actionLabel="Dashboard"
        onActionPress={() => router.replace('/driver/dashboard' as Href)}
        subtitle="Driver balance and payout activity"
        title="Wallet"
        titleVariant="h1"
      />

      <AppCard backgroundColor={theme.colors.black} style={styles.balanceCard}>
        <AppText variant="bodySmall" color="#9C948D">
          Available balance
        </AppText>
        <AppText variant="display" color={theme.colors.offWhite}>
          {formatNgn(balanceNgn)}
        </AppText>
        {lockedNgn > 0 && (
          <AppText variant="bodySmall" color="#9C948D">
            Locked: {formatNgn(lockedNgn)}
          </AppText>
        )}
      </AppCard>

      {isLoadingTxns && transactions.length === 0 ? (
        <View style={styles.activityCard}>
          <SkeletonLine width="45%" height={18} />
          <SkeletonCard lines={2} style={{ marginTop: 12 }} />
          <SkeletonCard lines={2} style={{ marginTop: 8 }} />
          <SkeletonCard lines={2} style={{ marginTop: 8 }} />
        </View>
      ) : transactions.length > 0 ? (
        <AppCard style={styles.activityCard}>
          <AppText variant="h3">Recent wallet activity</AppText>
          {transactions.map((entry, index) => {
            const isCredit = entry.direction === 'CREDIT';
            return (
              <View
                key={entry.id}
                style={[styles.activityRow, index < transactions.length - 1 ? styles.divider : null]}>
                <View style={styles.activityCopy}>
                  <AppText variant="bodyMedium">{entry.type.replace(/_/g, ' ')}</AppText>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    {new Date(entry.createdAt).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </AppText>
                </View>
                <AppText
                  variant="mono"
                  color={isCredit ? theme.colors.green : theme.colors.danger}>
                  {isCredit ? '+' : '-'}{formatNgn(Math.abs(entry.amountNgn))}
                </AppText>
              </View>
            );
          })}
        </AppCard>
      ) : null}

      <AppButton onPress={() => router.push('/driver/earnings' as Href)} title="View earnings" />
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
