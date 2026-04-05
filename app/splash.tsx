import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BlobShape, DiamondPair, StarBurst } from '@/components/decorative-shapes';
import { theme } from '@/theme';

export default function SplashScreen() {
  const router = useRouter();

  return (
    <AppScreen backgroundColor={theme.colors.orange} contentStyle={styles.container}>
      <StatusBar style="light" backgroundColor={theme.colors.orange} />
      <BlobShape color="rgba(255,255,255,0.18)" style={styles.blobTop} />
      <StarBurst color="rgba(255,255,255,0.22)" width={54} height={54} style={styles.starRight} />
      <DiamondPair color="rgba(255,255,255,0.18)" style={styles.diamondLeft} />
      <View style={styles.center}>
        <Animated.View entering={ZoomIn.duration(500)} style={styles.logoWrap}>
          <View style={styles.logoOuter}>
            <View style={styles.logoInner}>
              <AppText variant="h1" color={theme.colors.white}>
                W
              </AppText>
            </View>
          </View>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.titleBlock}>
          <AppText variant="display" color={theme.colors.white} style={styles.centerText}>
            WHELEERS
          </AppText>
          <AppText variant="monoSmall" color="rgba(255,255,255,0.74)" style={styles.tagline}>
            ride. earn. own.
          </AppText>
        </Animated.View>
      </View>
      <Animated.View entering={FadeIn.delay(250).duration(450)} style={styles.bottom}>
        <AppButton title="Get Started ↗" variant="inverse" onPress={() => router.push('/role-selection')} />
      </Animated.View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  logoWrap: {
    marginBottom: theme.spacing.lg,
  },
  logoOuter: {
    width: 92,
    height: 92,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 66,
    height: 66,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  centerText: {
    textAlign: 'center',
  },
  tagline: {
    letterSpacing: 1.4,
  },
  bottom: {
    width: '100%',
  },
  blobTop: {
    position: 'absolute',
    top: -18,
    left: -20,
  },
  starRight: {
    position: 'absolute',
    right: 20,
    bottom: 108,
  },
  diamondLeft: {
    position: 'absolute',
    top: 68,
    left: 28,
  },
});
