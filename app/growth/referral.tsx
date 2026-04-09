import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { DecorativeBackground } from '@/components/DecorativeBackground';
import { ReferralRewardCard } from '@/components/ReferralRewardCard';
import { referralProgram } from '@/data/mock';
import { theme } from '@/theme';

export default function ReferralScreen() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    await Share.share({
      message: `Use my Wheleers referral code ${referralProgram.referralCode} and get rewarded.`,
    });
  }

  function handleCopyMock() {
    setCopied(true);
  }

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <DecorativeBackground motif="referral" />
      <View style={styles.headerRow}>
        <BackArrow />
        <View style={styles.headerCopy}>
          <AppText variant="screenTitle">{referralProgram.headline}</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            {referralProgram.supportingText}
          </AppText>
        </View>
      </View>

      <View style={styles.rewardRow}>
        {referralProgram.rewards.map((reward) => (
          <ReferralRewardCard
            accent={reward.accent}
            icon={reward.icon}
            key={reward.id}
            title={reward.title}
            value={reward.value}
          />
        ))}
      </View>

      <AppCard style={styles.codeCard}>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          Your referral code
        </AppText>
        <AppText variant="metric" style={styles.code}>
          {referralProgram.referralCode}
        </AppText>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          {referralProgram.successfulReferrals} people used your code
        </AppText>
      </AppCard>

      <View style={styles.totalsRow}>
        <AppCard backgroundColor={theme.colors.orangeLight} borderColor={theme.colors.orange} style={styles.totalCard}>
          <AppText variant="monoLarge" color={theme.colors.orange}>
            {referralProgram.successfulReferrals}
          </AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Successful referrals
          </AppText>
        </AppCard>
        <AppCard style={styles.totalCard}>
          <AppText variant="monoLarge">{referralProgram.totalEarned}</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Rewards earned
          </AppText>
        </AppCard>
      </View>

      <View style={styles.actions}>
        <AppButton onPress={handleShare} style={styles.primaryAction} title="Share code ↗" />
        <AppButton
          onPress={handleCopyMock}
          style={styles.secondaryAction}
          title={copied ? 'Copied' : 'Copy'}
          variant="inverse"
        />
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
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  rewardRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  codeCard: {
    alignItems: 'center',
    gap: 4,
  },
  code: {
    letterSpacing: 3,
  },
  totalsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  totalCard: {
    flex: 1,
    alignItems: 'center',
    minHeight: 98,
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  primaryAction: {
    flex: 2,
  },
  secondaryAction: {
    flex: 1,
  },
});
