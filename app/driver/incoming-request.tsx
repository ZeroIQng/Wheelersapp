import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { RideRequestSheet } from '@/components/RideRequestSheet';
import { useDriverSession } from '@/lib/driver-session';
import { theme } from '@/theme';

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

export default function IncomingRequestScreen() {
  const router = useRouter();
  const { session, acceptRide, rejectRide } = useDriverSession();
  const offer = session.currentOffer;
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!offer?.expiresAt) return;
    const expiresMs = new Date(offer.expiresAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.round((expiresMs - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        router.replace('/driver/dashboard' as Href);
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [offer?.expiresAt, router]);

  // If no offer, go back to dashboard
  useEffect(() => {
    if (!offer) {
      router.replace('/driver/dashboard' as Href);
    }
  }, [offer, router]);

  // Navigate forward when ride is accepted (status transitions to 'navigating')
  useEffect(() => {
    if (session.status === 'navigating') {
      router.replace('/driver/navigation' as Href);
    }
  }, [session.status, router]);

  const handleAccept = async () => {
    if (!offer) return;
    await acceptRide(offer.rideId);
  };

  const handleDecline = async () => {
    if (!offer) return;
    await rejectRide(offer.rideId);
    router.replace('/driver/dashboard' as Href);
  };

  if (!offer) return null;

  const distanceKm = offer.plannedDistanceKm
    ? `${offer.plannedDistanceKm.toFixed(1)}km`
    : '--';

  const requestData = {
    riderName: 'Rider',
    distanceAwayKm: distanceKm,
    estimatedFare: formatNgn(offer.fareEstimateNgn),
    rideDistanceKm: distanceKm,
    expiresInSeconds: countdown,
    pickupLabel: offer.pickup.address,
    destinationLabel: offer.destination.address,
  };

  return (
    <AppScreen backgroundColor={theme.colors.orange} contentStyle={styles.container}>
      <StatusBar style="light" backgroundColor={theme.colors.orange} />
      <BackArrow light style={styles.backButton} onPress={handleDecline} />

      <Svg width={84} height={84} viewBox="0 0 84 84" style={styles.shapeRight}>
        <Path
          d="M42 6C58 4 72 12 78 28C84 44 80 62 64 72C48 82 26 80 14 66C2 52 2 30 12 18C22 6 30 8 42 6Z"
          fill="rgba(255,255,255,0.22)"
        />
      </Svg>

      <View style={styles.topCopy}>
        <AppText variant="bodySmall" color="rgba(255,255,255,0.74)">
          New ride request!
        </AppText>
        <AppText variant="h1" color={theme.colors.offWhite}>
          {offer.pickup.address}
        </AppText>
      </View>

      <View style={styles.sheetWrap}>
        <RideRequestSheet
          request={requestData}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    justifyContent: 'flex-end',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: theme.spacing.gutter,
    zIndex: 2,
  },
  shapeRight: {
    position: 'absolute',
    top: 20,
    right: 18,
  },
  topCopy: {
    position: 'absolute',
    left: theme.spacing.gutter,
    right: theme.spacing.gutter,
    bottom: 250,
    gap: theme.spacing.xs,
  },
  sheetWrap: {
    paddingTop: theme.spacing.xl,
  },
});
