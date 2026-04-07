import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { RideRequestSheet } from '@/components/RideRequestSheet';
import { incomingRideRequest } from '@/data/mock';
import { theme } from '@/theme';

export default function IncomingRequestScreen() {
  const router = useRouter();

  return (
    <AppScreen backgroundColor={theme.colors.orange} contentStyle={styles.container}>
      <StatusBar style="light" backgroundColor={theme.colors.orange} />
      <BackArrow light style={styles.backButton} onPress={() => router.back()} />

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
          {incomingRideRequest.riderName}
          {'\n'}
          {incomingRideRequest.distanceAwayKm} km away
        </AppText>
      </View>

      <View style={styles.sheetWrap}>
        <RideRequestSheet
          onAccept={() => router.push('/driver/navigation')}
          onDecline={() => router.replace('/driver/dashboard')}
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
