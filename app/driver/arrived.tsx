import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { TripProgressBar } from '@/components/TripProgressBar';
import { driverArrivalState } from '@/data/mock';
import { theme } from '@/theme';

export default function DriverArrivedScreen() {
  const router = useRouter();
  const activeTripRoute = '/driver/active-trip' as Href;

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <BackArrow style={styles.backButton} />

      <View style={styles.pinBadge}>
        <AppText style={styles.pinEmoji}>📍</AppText>
      </View>

      <View style={styles.header}>
        <AppText variant="h1" style={styles.center}>
          You&apos;ve arrived!
        </AppText>
        <AppText variant="bodySmall" color={theme.colors.muted} style={styles.center}>
          Waiting for your rider
        </AppText>
      </View>

      <AppCard style={styles.riderCard}>
        <View style={styles.avatar}>
          <AppText variant="h3">{driverArrivalState.rider.initials}</AppText>
        </View>
        <View style={styles.riderCopy}>
          <AppText variant="h3">{driverArrivalState.rider.name}</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            ⭐ {driverArrivalState.rider.rating} · {driverArrivalState.rider.trips}
          </AppText>
        </View>
        <Pressable style={styles.callButton}>
          <AppText style={styles.callText}>📞</AppText>
        </Pressable>
      </AppCard>

      <TripProgressBar
        fillColor={theme.colors.green}
        label={driverArrivalState.freeWaitLabel}
        progress={driverArrivalState.waitProgress}
      />

      <AppButton title="Start trip ↗" onPress={() => router.push(activeTripRoute)} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  backButton: {
    position: 'absolute',
    top: 18,
    left: theme.spacing.gutter,
  },
  pinBadge: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  pinEmoji: {
    fontSize: 40,
  },
  header: {
    gap: theme.spacing.xs,
  },
  center: {
    textAlign: 'center',
  },
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderCopy: {
    flex: 1,
    gap: 2,
  },
  callButton: {
    width: 46,
    height: 46,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
    ...theme.shadows.card,
  },
  callText: {
    fontSize: 18,
  },
});
