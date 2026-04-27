import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';

import { AppText } from '@/components/app-text';
import { theme } from '@/theme';

type WalletBalanceCardProps = {
  balance: string;
  fiatApprox: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  activeAction?: 'deposit' | 'withdraw';
};

export function WalletBalanceCard({
  balance,
  fiatApprox,
  accountName,
  accountNumber,
  bankName,
  onDeposit,
  onWithdraw,
  activeAction = 'deposit',
}: WalletBalanceCardProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyAccountNumber = async () => {
    if (!accountNumber) {
      return;
    }

    await Clipboard.setStringAsync(accountNumber);
    setIsCopied(true);

    setTimeout(() => {
      setIsCopied(false);
    }, 1600);
  };

  return (
    <View style={styles.card}>
      <Svg width={72} height={72} viewBox="0 0 84 84" style={styles.blob}>
        <Circle cx="42" cy="42" r="34" fill="rgba(255,92,0,0.32)" />
      </Svg>
      <Svg width={34} height={34} viewBox="0 0 42 42" style={styles.star}>
        <Path
          d="M21 3L23.5 15 33 7 25 17 38 20 25 24 33 35 23.5 27 21 39 18.5 27 9 35 17 24 4 20 17 17 9 7 18.5 15Z"
          fill="rgba(255,255,255,0.18)"
        />
      </Svg>
      <AppText variant="bodySmall" color={theme.colors.muted}>
        Total balance
      </AppText>
      <AppText variant="display" color={theme.colors.black} style={styles.balance}>
        {balance}
      </AppText>
      <View style={styles.approxChip}>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          {fiatApprox}
        </AppText>
      </View>
      {accountNumber ? (
        <Pressable onPress={handleCopyAccountNumber} style={styles.accountCard}>
          <View style={styles.accountHeader}>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              Account number
            </AppText>
            <View style={styles.copyChip}>
              <MaterialIcons
                color={isCopied ? theme.colors.green : theme.colors.black}
                name={isCopied ? 'check' : 'content-copy'}
                size={14}
              />
            </View>
          </View>
          <View style={styles.accountCopy}>
            <AppText variant="mono">{accountNumber}</AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              {[bankName, accountName].filter(Boolean).join(' • ')}
            </AppText>
          </View>
        </Pressable>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          onPress={onDeposit}
          style={[
            styles.actionButton,
            activeAction === 'deposit' ? styles.actionButtonPrimary : styles.actionButtonSecondary,
          ]}>
          <AppText
            variant="label"
            color={activeAction === 'deposit' ? theme.colors.offWhite : theme.colors.black}>
            + Deposit
          </AppText>
        </Pressable>
        <Pressable
          onPress={onWithdraw}
          style={[
            styles.actionButton,
            activeAction === 'withdraw' ? styles.actionButtonDark : styles.actionButtonSecondary,
          ]}>
          <AppText
            variant="bodyMedium"
            color={activeAction === 'withdraw' ? theme.colors.offWhite : theme.colors.black}>
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
    borderColor: theme.colors.orange,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.orangeLight,
    padding: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  blob: {
    position: 'absolute',
    top: -12,
    right: -10,
  },
  star: {
    position: 'absolute',
    bottom: 8,
    left: 10,
  },
  balance: {
    marginTop: theme.spacing.xxs,
    marginBottom: theme.spacing.xs,
  },
  approxChip: {
    alignSelf: 'flex-start',
    borderWidth: theme.borders.regular,
    borderColor: '#F4B28D',
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  accountCard: {
    marginTop: theme.spacing.sm,
    borderWidth: theme.borders.regular,
    borderColor: '#F4B28D',
    borderRadius: theme.radii.sm,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  accountCopy: {
    gap: 2,
  },
  copyChip: {
    borderWidth: theme.borders.regular,
    borderColor: '#F4B28D',
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.regular,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: theme.colors.orange,
    borderColor: theme.colors.orange,
    ...theme.shadows.card,
  },
  actionButtonDark: {
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.black,
    ...theme.shadows.card,
  },
  actionButtonSecondary: {
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
  },
});
