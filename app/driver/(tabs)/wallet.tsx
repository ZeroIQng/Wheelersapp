import { Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { useAuth } from '@/lib/auth';
import { getAccessTokenWithRetry } from '@/lib/access-token';
import {
  getDriverEarnings,
  provisionVirtualAccount,
  type DriverEarningsResponse,
  type ProvisionVirtualAccountResponse,
} from '@/lib/api';
import { useAppTheme } from '@/lib/theme-context';
import { useWalletOverview } from '@/lib/wallet-overview';
import { theme } from '@/theme';

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

// ── Icons ──────────────────────────────────────────────

function EyeIcon({ open, size = 20 }: { open: boolean; size?: number }) {
  const c = '#9C948D';
  if (open) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <Circle cx="12" cy="12" r="3" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <Line x1="1" y1="1" x2="23" y2="23" />
    </Svg>
  );
}

function CopyIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.orange} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <Path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" />
    </Svg>
  );
}

function ArrowUpIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.white} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="12" y1="19" x2="12" y2="5" />
      <Polyline points="5 12 12 5 19 12" />
    </Svg>
  );
}

// ── Component ──────────────────────────────────────────

export default function DriverWalletTabScreen() {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const { isDark } = useAppTheme();
  const { overview } = useWalletOverview();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [earnings, setEarnings] = useState<DriverEarningsResponse | null>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [account, setAccount] = useState<ProvisionVirtualAccountResponse | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const accessToken = await getAccessTokenWithRetry(getAccessToken);
    if (!accessToken) return;
    const [earningsRes, accountRes] = await Promise.allSettled([
      getDriverEarnings({ accessToken, period: 'today' }),
      provisionVirtualAccount({ accessToken }),
    ]);
    if (earningsRes.status === 'fulfilled') setEarnings(earningsRes.value);
    if (accountRes.status === 'fulfilled') setAccount(accountRes.value);
    setLoadingEarnings(false);
    setLoadingAccount(false);
  }, [getAccessToken]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const balanceNgn = overview?.balanceNgn ?? 0;
  const lockedNgn = overview?.lockedNgn ?? 0;
  const totalEarnings = earnings?.totalEarningsNgn ?? 0;
  const rideCount = earnings?.rideCount ?? 0;

  const handleCopy = async () => {
    if (!account) return;
    await Clipboard.setStringAsync(account.accountNumber);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppScreen scroll contentStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.orange} colors={[theme.colors.orange]} />}>
      {/* ── Balance card ── */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <AppText variant="bodySmall" color="#9C948D">Available balance</AppText>
          <Pressable onPress={() => setBalanceVisible(!balanceVisible)} hitSlop={12}>
            <EyeIcon open={balanceVisible} size={18} />
          </Pressable>
        </View>
        <AppText variant="display" color={theme.colors.offWhite}>
          {balanceVisible ? formatNgn(balanceNgn) : 'NGN ****'}
        </AppText>
        {lockedNgn > 0 && (
          <AppText variant="bodySmall" color="#9C948D">
            Locked: {balanceVisible ? formatNgn(lockedNgn) : '****'}
          </AppText>
        )}
      </View>

      {/* ── Virtual account (fund wallet) ── */}
      <View style={[styles.accountCard, isDark && { backgroundColor: theme.colors.darkSurface }]}>
        <AppText variant="label" color={theme.colors.muted} style={styles.accountLabel}>
          Fund your wallet
        </AppText>
        {loadingAccount ? (
          <ActivityIndicator size="small" color={theme.colors.orange} style={{ paddingVertical: 12 }} />
        ) : account ? (
          <>
            <View style={styles.accountRow}>
              <View style={styles.accountInfo}>
                <AppText variant="h2">{account.accountNumber}</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  {account.bankName} — {account.accountName}
                </AppText>
              </View>
              <Pressable onPress={handleCopy} style={styles.copyBtn} hitSlop={8}>
                {copied ? (
                  <AppText variant="bodySmall" color={theme.colors.orange}>Copied</AppText>
                ) : (
                  <CopyIcon />
                )}
              </Pressable>
            </View>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              Transfer to this account to top up your wallet
            </AppText>
          </>
        ) : (
          <AppText variant="bodySmall" color={theme.colors.muted} style={{ paddingVertical: 8 }}>
            Could not load account details
          </AppText>
        )}
      </View>

      {/* ── Withdraw button ── */}
      <Pressable
        style={({ pressed }) => [styles.withdrawBtn, pressed && styles.btnPressed]}
        onPress={() => router.push('/driver/withdraw' as Href)}
      >
        <ArrowUpIcon size={18} />
        <AppText variant="label" color={theme.colors.white}>Withdraw</AppText>
      </Pressable>

      {/* ── Earnings quick card ── */}
      <Pressable
        onPress={() => router.push('/driver/earnings' as Href)}
        style={({ pressed }) => [styles.earningsCard, isDark && { backgroundColor: theme.colors.darkSurface }, pressed && styles.btnPressed]}
      >
        <View style={styles.earningsLeft}>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            {loadingEarnings ? 'Loading...' : `Today's earnings`}
          </AppText>
          <AppText variant="h1" color={theme.colors.orange}>
            {loadingEarnings ? '--' : formatNgn(totalEarnings)}
          </AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            {loadingEarnings ? '' : `${rideCount} ride${rideCount !== 1 ? 's' : ''}`}
          </AppText>
        </View>
        <View style={styles.earningsArrow}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Polyline points="9 18 15 12 9 6" />
          </Svg>
        </View>
      </Pressable>
    </AppScreen>
  );
}

// ── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingTop: theme.spacing.lg,
  },

  // Balance card
  balanceCard: {
    backgroundColor: theme.colors.black,
    borderRadius: theme.radii.lg,
    padding: 24,
    gap: 6,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    ...theme.shadows.card,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  // Virtual account
  accountCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.md,
    padding: 18,
    gap: 8,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    ...theme.shadows.card,
  },
  accountLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 10,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountInfo: {
    flex: 1,
    gap: 2,
  },
  copyBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.xs,
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Withdraw
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    ...theme.shadows.card,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  // Earnings card
  earningsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.md,
    padding: 20,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    ...theme.shadows.card,
  },
  earningsLeft: {
    flex: 1,
    gap: 4,
  },
  earningsArrow: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.xs,
    backgroundColor: theme.colors.offWhite,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
