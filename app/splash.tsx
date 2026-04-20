import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BlobShape, DiamondPair, StarBurst } from '@/components/decorative-shapes';
import { theme } from '@/theme';

export default function SplashScreen() {
  const router = useRouter();
  const floatY = useSharedValue(0);
  const spin = useSharedValue(0);
  const hasNavigated = useRef(false);

  function leaveSplash() {
    if (hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;
    router.replace('/role-selection');
  }

  useEffect(() => {
    floatY.value = withRepeat(
      withTiming(-10, {
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
    spin.value = withRepeat(
      withTiming(1, {
        duration: 9000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    const timer = setTimeout(() => {
      if (hasNavigated.current) {
        return;
      }

      hasNavigated.current = true;
      router.replace('/role-selection');
    }, 3000);

    return () => clearTimeout(timer);
  }, [floatY, router, spin]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const starStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <AppScreen backgroundColor={theme.colors.orange} contentStyle={styles.container}>
      <StatusBar style="light" backgroundColor={theme.colors.orange} />
      <Pressable onPress={leaveSplash} style={styles.pressable}>
        <BlobShape color="rgba(255,255,255,0.18)" style={styles.blobTop} />
        <Animated.View style={[styles.starRight, starStyle]}>
          <StarBurst color="rgba(255,255,255,0.22)" width={54} height={54} />
        </Animated.View>
        <DiamondPair color="rgba(255,255,255,0.18)" style={styles.diamondLeft} />
        <View style={styles.center}>
          <Animated.View entering={ZoomIn.duration(500)} style={[styles.logoWrap, logoStyle]}>
            <View style={styles.logoOuter}>
              <View style={styles.logoInner}>
                <AppText variant="h2" color={theme.colors.white} style={styles.markText}>
                  W
                </AppText>
              </View>
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.titleBlock}>
            <View style={styles.wordmark}>
              <AppText variant="h1" color={theme.colors.white} style={styles.titleLine}>
                WHEEL
              </AppText>
              <AppText variant="h1" color={theme.colors.white} style={styles.titleLine}>
                ERS
              </AppText>
            </View>
            <AppText variant="bodySmall" color="rgba(255,255,255,0.74)" style={styles.tagline}>
              ride. earn. own.
            </AppText>
          </Animated.View>
        </View>
        <Animated.View entering={FadeIn.delay(250).duration(450)} style={styles.bottom}>
          <View style={styles.loaderTrack}>
            <Animated.View style={styles.loaderBar} />
          </View>
          <AppText variant="monoSmall" color="rgba(255,255,255,0.7)" style={styles.hint}>
            tap anywhere to continue
          </AppText>
        </Animated.View>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  pressable: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: theme.spacing.xxxl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  logoWrap: {
    marginBottom: theme.spacing.md,
  },
  logoOuter: {
    width: 82,
    height: 82,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    fontSize: 25,
    lineHeight: 25,
    letterSpacing: -0.4,
  },
  titleBlock: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  wordmark: {
    alignItems: 'center',
    gap: 0,
  },
  titleLine: {
    textAlign: 'center',
    fontSize: 28,
    lineHeight: 27,
    letterSpacing: -0.8,
  },
  tagline: {
    letterSpacing: 0.4,
    lineHeight: 16,
  },
  bottom: {
    width: '100%',
    alignItems: 'center',
    gap: theme.spacing.sm,
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
  loaderTrack: {
    width: 112,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.24)',
    overflow: 'hidden',
  },
  loaderBar: {
    width: '72%',
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
  },
  hint: {
    letterSpacing: 1.2,
  },
});
