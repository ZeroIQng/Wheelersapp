import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { FloatingView } from '@/components/motion';
import { SectionHeader } from '@/components/SectionHeader';
import { driverPayoutSummary } from '@/data/mock';
import { theme } from '@/theme';

export default function DriverPayoutScreen() {
  const router = useRouter();
  const earningsRoute = '/driver/earnings' as Href;
  const dashboardRoute = '/driver/dashboard' as Href;

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <Confetti color={theme.colors.orange} style={styles.confettiOne} />
      <Confetti color={theme.colors.black} style={styles.confettiTwo} />
      <Confetti color={theme.colors.green} style={styles.confettiThree} />

      <SectionHeader
        actionLabel="View earnings"
        onActionPress={() => router.push(earningsRoute)}
        subtitle={driverPayoutSummary.fiatApprox}
        title="Ride complete"
      />

      <View style={styles.earningsWrap}>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          YOU EARNED
        </AppText>
        <AppText variant="display" color={theme.colors.orange} style={styles.amount}>
          {driverPayoutSummary.payout}
        </AppText>
      </View>

      <AppCard style={styles.summaryCard}>
        <SummaryRow label="Gross fare" value={driverPayoutSummary.grossFare} />
        <SummaryRow
          color={theme.colors.danger}
          label={driverPayoutSummary.platformFeeLabel}
          value={driverPayoutSummary.platformFee}
        />
        <View style={styles.totalRow}>
          <AppText variant="bodyMedium">You receive</AppText>
          <AppText variant="monoLarge" color={theme.colors.orange}>
            {driverPayoutSummary.finalPayout}
          </AppText>
        </View>
      </AppCard>

      <AppButton title="Next ride ↗" onPress={() => router.replace(dashboardRoute)} />
      <Pressable style={styles.offlineButton}>
        <AppText variant="label" color={theme.colors.offWhite}>
          Go offline
        </AppText>
      </Pressable>
    </AppScreen>
  );
}

function SummaryRow({
  label,
  value,
  color = theme.colors.black,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.row}>
      <AppText variant="bodySmall" color={theme.colors.muted}>
        {label}
      </AppText>
      <AppText variant="mono" color={color}>
        {value}
      </AppText>
    </View>
  );
}

function Confetti({
  color,
  style,
}: {
  color: string;
  style: object;
}) {
  return (
    <FloatingView distance={14} style={style}>
      <View style={[styles.confettiPiece, { backgroundColor: color }]} />
    </FloatingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  earningsWrap: {
    alignItems: 'center',
    gap: theme.spacing.xxs,
  },
  amount: {
    textAlign: 'center',
  },
  summaryCard: {
    gap: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTopWidth: theme.borders.thick,
    borderTopColor: theme.colors.black,
  },
  offlineButton: {
    minHeight: 52,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  confettiPiece: {
    width: 9,
    height: 9,
    borderRadius: 3,
  },
  confettiOne: {
    position: 'absolute',
    top: 72,
    left: '18%',
  },
  confettiTwo: {
    position: 'absolute',
    top: 94,
    left: '46%',
  },
  confettiThree: {
    position: 'absolute',
    top: 118,
    left: '72%',
  },
});
