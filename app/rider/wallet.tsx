import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { MetricCard } from '@/components/MetricCard';
import { SectionHeader } from '@/components/SectionHeader';
import { WalletBalanceCard } from '@/components/WalletBalanceCard';
import { walletOverview } from '@/data/mock';
import { theme } from '@/theme';

export default function WalletScreen() {
  const router = useRouter();

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <SectionHeader
        actionLabel="Rider home"
        onActionPress={() => router.replace('/rider-home')}
        title="Wallet"
        titleVariant="h1"
      />

      <WalletBalanceCard balance={walletOverview.balance} fiatApprox={walletOverview.fiatApprox} />

      <View style={styles.metricsRow}>
        <MetricCard
          accent="orange"
          backgroundColor={theme.colors.white}
          label="Yield today"
          value={walletOverview.yieldToday}
        />
        <MetricCard
          backgroundColor={theme.colors.white}
          label="Current APY"
          value={walletOverview.apy}
        />
      </View>

      <SectionHeader subtitle="Your latest wallet activity" title="Recent" titleVariant="h3" />
      <AppCard style={styles.transactions}>
        {walletOverview.recentTransactions.map((transaction, index) => (
          <View
            key={transaction.id}
            style={[
              styles.transactionRow,
              index < walletOverview.recentTransactions.length - 1 ? styles.divider : null,
            ]}>
            <View style={styles.transactionCopy}>
              <AppText variant="bodyMedium">{transaction.title}</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {transaction.timestamp}
              </AppText>
            </View>
            <AppText
              variant="mono"
              color={
                transaction.direction === 'credit' ? theme.colors.green : theme.colors.danger
              }>
              {transaction.amount}
            </AppText>
          </View>
        ))}
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  transactions: {
    gap: theme.spacing.sm,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  transactionCopy: {
    flex: 1,
    gap: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEE0D4',
    paddingBottom: theme.spacing.md,
  },
});
