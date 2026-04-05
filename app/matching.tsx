import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BlobShape, RingStack, StarBurst } from '@/components/decorative-shapes';
import { PulseCircle } from '@/components/static-map';
import { theme } from '@/theme';

export default function MatchingScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/driver-found');
    }, 2600);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <RingStack color="rgba(255,92,0,0.08)" width={100} height={100} style={styles.rings} />
      <StarBurst color="rgba(255,92,0,0.1)" width={60} height={60} style={styles.star} />
      <View style={styles.radarWrap}>
        <PulseCircle size={160} color={theme.colors.orange} />
        <PulseCircle size={120} color={theme.colors.orange} delay={300} style={styles.radarInner} />
        <PulseCircle size={80} color={theme.colors.orange} delay={600} style={styles.radarCore} />
        <Animated.View entering={FadeIn.duration(500)} style={styles.centerBadge}>
          <AppText style={styles.centerEmoji}>🛵</AppText>
        </Animated.View>
        <BlobDot emoji="🚗" style={styles.dotOne} delay={200} />
        <BlobDot emoji="🚗" style={styles.dotTwo} delay={500} />
        <BlobDot emoji="🚗" style={styles.dotThree} delay={700} />
      </View>
      <View style={styles.copy}>
        <AppText variant="h1" style={styles.centerText}>
          Finding your{'\n'}driver...
        </AppText>
        <AppText variant="bodySmall" color={theme.colors.muted} style={styles.centerText}>
          3 drivers nearby • Usually less than 2 min
        </AppText>
      </View>
      <View style={styles.blinkRow}>
        <BlinkDot delay={0} />
        <BlinkDot delay={200} />
        <BlinkDot delay={400} />
      </View>
      <AppButton title="Cancel search" variant="ghost" onPress={() => router.back()} style={styles.cancelButton} />
    </AppScreen>
  );
}

function BlobDot({ emoji, delay, style }: { emoji: string; delay: number; style: object }) {
  return (
    <Animated.View entering={FadeIn.delay(delay).duration(320)} style={[styles.driverDot, style]}>
      <AppText style={styles.driverEmoji}>{emoji}</AppText>
    </Animated.View>
  );
}

function BlinkDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0.3, {
          duration: 900,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      )
    );
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.blinkDot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  rings: {
    position: 'absolute',
    top: 18,
    right: 16,
  },
  star: {
    position: 'absolute',
    bottom: 34,
    left: 14,
  },
  radarWrap: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarInner: {
    top: 20,
    left: 20,
  },
  radarCore: {
    top: 40,
    left: 40,
  },
  centerBadge: {
    width: 62,
    height: 62,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  centerEmoji: {
    fontSize: 24,
  },
  driverDot: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  dotOne: {
    top: 8,
    right: 20,
  },
  dotTwo: {
    bottom: 16,
    left: 10,
  },
  dotThree: {
    top: 78,
    right: 0,
  },
  driverEmoji: {
    fontSize: 12,
  },
  copy: {
    gap: theme.spacing.sm,
  },
  centerText: {
    textAlign: 'center',
  },
  blinkRow: {
    flexDirection: 'row',
    gap: 6,
  },
  blinkDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
  },
  cancelButton: {
    width: 180,
  },
});
