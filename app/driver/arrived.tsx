import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { StatusPill } from '@/components/StatusPill';
import { TripProgressBar } from '@/components/TripProgressBar';
import { useDriverSession } from '@/lib/driver-session';
import { theme } from '@/theme';

const FREE_WAIT_SECONDS = 180; // 3 minutes

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

export default function DriverArrivedScreen() {
  const router = useRouter();
  const { session, startTrip } = useDriverSession();
  const ride = session.currentRide;

  const arrivedAtRef = useRef(Date.now());
  const [waitProgress, setWaitProgress] = useState(0);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ride) {
      router.replace('/driver/(tabs)/home' as Href);
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - arrivedAtRef.current) / 1000;
      setWaitProgress(Math.min(1, elapsed / FREE_WAIT_SECONDS));
      setWaitSeconds(Math.floor(elapsed));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [ride, router]);

  useEffect(() => {
    if (session.status === 'active') {
      router.replace('/driver/active-trip' as Href);
    }
  }, [session.status, router]);

  if (!ride) return null;

  const handleCallRider = () => {
    if (ride.riderPhone) {
      Linking.openURL(`tel:${ride.riderPhone}`);
    }
  };

  const handleCopyPhone = async () => {
    if (ride.riderPhone) {
      await Clipboard.setStringAsync(ride.riderPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartTrip = async () => {
    try {
      await startTrip(ride.rideId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not start trip. Please try again.');
    }
  };

  const remainingSeconds = Math.max(0, FREE_WAIT_SECONDS - waitSeconds);
  const remainingMin = Math.floor(remainingSeconds / 60);
  const remainingSec = remainingSeconds % 60;
  const waitOverdue = waitSeconds >= FREE_WAIT_SECONDS;

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />

      <View style={styles.headerSection}>
        <StatusPill
          dotColor={theme.colors.orange}
          label="WAITING FOR RIDER"
          variant="dark"
        />
        <AppText variant="h1" style={styles.center}>
          You&apos;ve arrived
        </AppText>
      </View>

      {/* Rider card */}
      <AppCard style={styles.riderCard}>
        <View style={styles.riderInfo}>
          <View style={styles.avatar}>
            <AppText variant="h3" color={theme.colors.orange}>R</AppText>
          </View>
          <View style={styles.riderCopy}>
            <AppText variant="h3">Rider</AppText>
            <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={1}>
              {ride.pickup.address}
            </AppText>
          </View>
          <View style={styles.fareTag}>
            <AppText variant="mono" color={theme.colors.green}>{formatNgn(ride.fareNgn)}</AppText>
          </View>
        </View>

        {ride.riderPhone ? (
          <View style={styles.phoneRow}>
            <Pressable style={styles.callButton} onPress={handleCallRider}>
              <AppText variant="label">Call rider</AppText>
            </Pressable>
            <Pressable style={styles.copyButton} onPress={handleCopyPhone}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {copied ? 'Copied!' : ride.riderPhone}
              </AppText>
            </Pressable>
          </View>
        ) : null}
      </AppCard>

      {/* Wait timer */}
      <View style={styles.waitSection}>
        <TripProgressBar
          fillColor={waitOverdue ? theme.colors.danger : theme.colors.green}
          label={waitOverdue
            ? 'Free wait time exceeded'
            : `Free wait: ${remainingMin}:${remainingSec.toString().padStart(2, '0')} left`
          }
          progress={waitProgress}
        />
      </View>

      <AppButton title="Start trip" onPress={handleStartTrip} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  headerSection: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  center: {
    textAlign: 'center',
  },
  riderCard: {
    gap: theme.spacing.md,
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderCopy: {
    flex: 1,
    gap: 1,
  },
  fareTag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.green,
    backgroundColor: theme.colors.successLight,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  callButton: {
    flex: 1,
    height: 42,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.green,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.subtle,
  },
  copyButton: {
    height: 42,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  waitSection: {
    gap: theme.spacing.xs,
  },
});
