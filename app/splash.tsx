import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BlobShape } from '@/components/decorative-shapes';
import { theme } from '@/theme';

export default function SplashScreen() {
  const router = useRouter();
  const floatY = useSharedValue(0);
  const dotOne = useSharedValue(0.35);
  const dotTwo = useSharedValue(0.35);
  const dotThree = useSharedValue(0.35);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, {
          duration: 900,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0, {
          duration: 900,
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1,
      false
    );

    dotOne.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 260 }),
        withTiming(0.35, { duration: 260 }),
        withTiming(0.35, { duration: 520 })
      ),
      -1,
      false
    );
    dotTwo.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 260 }),
        withTiming(1, { duration: 260 }),
        withTiming(0.35, { duration: 260 }),
        withTiming(0.35, { duration: 260 })
      ),
      -1,
      false
    );
    dotThree.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 520 }),
        withTiming(1, { duration: 260 }),
        withTiming(0.35, { duration: 260 })
      ),
      -1,
      false
    );

    const timer = setTimeout(() => {
      router.replace('/role-selection');
    }, 2000);

    return () => clearTimeout(timer);
  }, [dotOne, dotThree, dotTwo, floatY, router]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const dotOneStyle = useAnimatedStyle(() => ({
    opacity: dotOne.value,
    transform: [{ scale: 0.85 + dotOne.value * 0.2 }],
  }));

  const dotTwoStyle = useAnimatedStyle(() => ({
    opacity: dotTwo.value,
    transform: [{ scale: 0.85 + dotTwo.value * 0.2 }],
  }));

  const dotThreeStyle = useAnimatedStyle(() => ({
    opacity: dotThree.value,
    transform: [{ scale: 0.85 + dotThree.value * 0.2 }],
  }));

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <BlobShape color="rgba(255,92,0,0.08)" style={styles.blobTop} />

      <View style={styles.center}>
        <Animated.View entering={ZoomIn.duration(420)} style={[styles.logoWrap, logoStyle]}>
          <View style={styles.logoHalo}>
            <View style={styles.logoOuter}>
              <View style={styles.logoInner}>
                <AppText variant="h1" color={theme.colors.offWhite}>
                  W
                </AppText>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(100).duration(260)} style={styles.titleBlock}>
          <AppText variant="h2" style={styles.centerText}>
            Wheleers
          </AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            ride. earn. own.
          </AppText>
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(180).duration(260)} style={styles.bottom}>
        <View style={styles.loaderRow}>
          <Animated.View style={[styles.loaderDot, dotOneStyle]} />
          <Animated.View style={[styles.loaderDot, dotTwoStyle]} />
          <Animated.View style={[styles.loaderDot, dotThreeStyle]} />
        </View>
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
    gap: theme.spacing.lg,
  },
  logoWrap: {
    marginBottom: theme.spacing.sm,
  },
  logoHalo: {
    width: 112,
    height: 112,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,92,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoOuter: {
    width: 84,
    height: 84,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  logoInner: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    alignItems: 'center',
    gap: 2,
  },
  centerText: {
    textAlign: 'center',
  },
  bottom: {
    minHeight: 20,
    width: '100%',
    alignItems: 'center',
  },
  blobTop: {
    position: 'absolute',
    top: -18,
    left: -24,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loaderDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
  },
});
