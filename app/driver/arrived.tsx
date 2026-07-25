import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ride) {
      router.replace('/driver/(tabs)/home' as Href);
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - arrivedAtRef.current) / 1000;
      setWaitProgress(Math.min(1, elapsed / FREE_WAIT_SECONDS));
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

  const waitLabel = `Free wait time (${Math.ceil(FREE_WAIT_SECONDS / 60)} min)`;
  const elapsedSeconds = Math.floor((Date.now() - arrivedAtRef.current) / 1000);
  const remainingSeconds = Math.max(0, FREE_WAIT_SECONDS - elapsedSeconds);
  const remainingMinutes = Math.ceil(remainingSeconds / 60);

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
          Waiting for your rider at {ride.pickup.address}
        </AppText>
      </View>

      <AppCard style={styles.riderCard}>
        <View style={styles.riderInfo}>
          <View style={styles.avatar}>
            <AppText variant="h3">R</AppText>
          </View>
          <View style={styles.riderCopy}>
            <AppText variant="h3">Rider</AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              {ride.pickup.address}
            </AppText>
          </View>
        </View>

        <View style={styles.fareRow}>
          <AppText variant="bodySmall" color={theme.colors.muted}>Fare</AppText>
          <AppText variant="mono" color={theme.colors.orange}>{formatNgn(ride.fareNgn)}</AppText>
        </View>

        {ride.riderPhone ? (
          <View style={styles.phoneRow}>
            <Pressable style={styles.callButton} onPress={handleCallRider}>
              <AppText style={styles.callIcon}>📞</AppText>
              <AppText variant="label">Call rider</AppText>
            </Pressable>
            <Pressable style={styles.copyButton} onPress={handleCopyPhone}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {copied ? 'Copied!' : ride.riderPhone}
              </AppText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.noPhoneRow}>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              Rider phone not available
            </AppText>
          </View>
        )}
      </AppCard>

      <TripProgressBar
        fillColor={theme.colors.green}
        label={waitLabel}
        progress={waitProgress}
      />

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
    gap: theme.spacing.md,
  },
  riderInfo: {
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
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    height: 46,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.green,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    ...theme.shadows.card,
  },
  callIcon: {
    fontSize: 16,
  },
  copyButton: {
    height: 46,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  noPhoneRow: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
});
