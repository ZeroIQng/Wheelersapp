import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { DecorativeBackground } from '@/components/DecorativeBackground';
import { TokenBalanceCard } from '@/components/TokenBalanceCard';
import { TokenStatCard } from '@/components/TokenStatCard';
import { tokenPortfolio } from '@/data/mock';
import { theme } from '@/theme';

export default function TokenScreen() {
  return (
    <AppScreen backgroundColor={theme.colors.black} scroll contentStyle={styles.container}>
      <StatusBar style="light" backgroundColor={theme.colors.black} />
      <DecorativeBackground dark motif="token" />
      <View style={styles.headerRow}>
        <BackArrow light />
        <View>
          <AppText variant="monoSmall" color={theme.colors.darkMuted}>
            DEFI + TOKENS
          </AppText>
          <AppText variant="screenTitle" color={theme.colors.white}>
            Your Token Stake
          </AppText>
        </View>
      </View>

      <TokenBalanceCard balance={tokenPortfolio.balance} fiatApprox={tokenPortfolio.fiatApprox} />

      <View style={styles.statsRow}>
        <TokenStatCard accent="green" label="Staking APY" value={tokenPortfolio.apy} />
        <TokenStatCard label="WHE Staked" value={tokenPortfolio.stakedBalance} />
        <TokenStatCard accent="orange" label="Today&apos;s earn" value={tokenPortfolio.dailyEarnings} />
      </View>

      <View style={styles.activitySection}>
        <AppText variant="monoSmall" color="#555">
          RECENT ACTIVITY
        </AppText>
        <View style={styles.activityCard}>
          {tokenPortfolio.activity.map((item, index) => (
            <View
              key={item.id}
              style={[styles.activityRow, index < tokenPortfolio.activity.length - 1 ? styles.divider : null]}>
              <View style={styles.activityCopy}>
                <AppText variant="bodyMedium" color="#B9B4AF">
                  {item.title}
                </AppText>
                <AppText variant="monoSmall" color="#66615B">
                  {item.timestamp}
                </AppText>
              </View>
              <AppText
                variant="mono"
                color={item.direction === 'credit' ? theme.colors.green : theme.colors.red}>
                {item.amount}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  activitySection: {
    gap: theme.spacing.sm,
  },
  activityCard: {
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.darkBorder,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.darkSurface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  activityCopy: {
    flex: 1,
    gap: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
});
