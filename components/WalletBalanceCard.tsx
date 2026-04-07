import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { theme } from '@/theme';

type WalletBalanceCardProps = {
  balance: string;
  fiatApprox: string;
  onDeposit?: () => void;
  onWithdraw?: () => void;
};

export function WalletBalanceCard({
  balance,
  fiatApprox,
  onDeposit,
  onWithdraw,
}: WalletBalanceCardProps) {
  return (
    <View style={styles.card}>
      <Svg width={84} height={84} viewBox="0 0 84 84" style={styles.blob}>
        <Circle cx="42" cy="42" r="34" fill="rgba(255,92,0,0.32)" />
      </Svg>
      <Svg width={42} height={42} viewBox="0 0 42 42" style={styles.star}>
        <Path
          d="M21 3L23.5 15 33 7 25 17 38 20 25 24 33 35 23.5 27 21 39 18.5 27 9 35 17 24 4 20 17 17 9 7 18.5 15Z"
          fill="rgba(255,255,255,0.18)"
        />
      </Svg>
      <AppText variant="bodySmall" color="#9C948D">
        Total balance
      </AppText>
      <AppText variant="display" color={theme.colors.offWhite} style={styles.balance}>
        {balance}
      </AppText>
      <AppText variant="bodySmall" color="#9C948D">
        {fiatApprox}
      </AppText>
      <View style={styles.actions}>
        <Pressable onPress={onDeposit} style={[styles.actionButton, styles.deposit]}>
          <AppText variant="label" color={theme.colors.offWhite}>
            + Deposit
          </AppText>
        </Pressable>
        <Pressable onPress={onWithdraw} style={[styles.actionButton, styles.withdraw]}>
          <AppText variant="bodyMedium" color={theme.colors.offWhite}>
            Withdraw
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.black,
    padding: theme.spacing.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  blob: {
    position: 'absolute',
    top: -14,
    right: -8,
  },
  star: {
    position: 'absolute',
    bottom: 10,
    left: 12,
  },
  balance: {
    marginTop: theme.spacing.xxs,
    marginBottom: theme.spacing.xxs,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.regular,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deposit: {
    backgroundColor: theme.colors.orange,
    borderColor: theme.colors.orange,
    ...theme.shadows.card,
  },
  withdraw: {
    borderColor: '#444',
    backgroundColor: 'transparent',
  },
});
