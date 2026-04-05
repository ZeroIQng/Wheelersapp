import { PropsWithChildren, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { theme } from '@/theme';

type StaticMapProps = PropsWithChildren<{
  height?: number;
  roundedTop?: boolean;
}>;

export function StaticMap({ children, height = 280, roundedTop }: StaticMapProps) {
  return (
    <View
      style={[
        styles.container,
        {
          height,
          borderTopLeftRadius: roundedTop ? theme.radius.lg : 0,
          borderTopRightRadius: roundedTop ? theme.radius.lg : 0,
        },
      ]}>
      <View style={[styles.roadHorizontal, { top: '38%', height: 9 }]} />
      <View style={[styles.roadHorizontal, { top: '62%', height: 6 }]} />
      <View style={[styles.roadVertical, { left: '32%', width: 9 }]} />
      <View style={[styles.roadVertical, { left: '62%', width: 6 }]} />
      <View style={[styles.block, { top: '14%', left: '6%', width: 52, height: 38 }]} />
      <View style={[styles.block, { top: '15%', right: '8%', width: 38, height: 52 }]} />
      <View style={[styles.block, { top: '48%', left: '38%', width: 44, height: 32 }]} />
      <View style={[styles.block, { top: '68%', right: '20%', width: 36, height: 44 }]} />
      {children}
    </View>
  );
}

export function MapTopChip({ label }: { label: string }) {
  return (
    <View style={styles.mapChip}>
      <View>
        <Animated.Text style={styles.mapChipText}>{label}</Animated.Text>
      </View>
    </View>
  );
}

export function MapPin({ centered }: { centered?: boolean }) {
  return (
    <>
      <PulseCircle size={30} color={theme.colors.orange} style={centered ? styles.pinPulseCenter : styles.pinPulseLeft} />
      <View style={centered ? styles.centeredPinWrap : styles.pinWrap}>
        <View style={styles.pin} />
      </View>
    </>
  );
}

export function MapRoute() {
  return (
    <>
      <View style={styles.route} />
      <View style={styles.routeStart} />
      <View style={styles.routeEnd} />
    </>
  );
}

export function MovingVehicle() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 4000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 160 }],
  }));

  return (
    <Animated.View style={[styles.vehicle, animatedStyle]}>
      <Animated.Text style={styles.vehicleEmoji}>🚗</Animated.Text>
    </Animated.View>
  );
}

type PulseCircleProps = {
  size: number;
  color: string;
  style?: object;
  delay?: number;
};

export function PulseCircle({ size, color, style, delay = 0 }: PulseCircleProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration: 2000,
          easing: Easing.out(Easing.ease),
        }),
        -1,
        false
      )
    );
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.65 - progress.value * 0.65,
    transform: [{ scale: 1 + progress.value * 1.4 }],
  }));

  return (
    <Animated.View
      style={[
        styles.pulse,
        {
          width: size,
          height: size,
          borderColor: color,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#D4E6D4',
    overflow: 'hidden',
    position: 'relative',
  },
  roadHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: 3,
  },
  roadVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: 3,
  },
  block: {
    position: 'absolute',
    backgroundColor: 'rgba(190,210,190,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(150,180,150,0.5)',
    borderRadius: 4,
  },
  mapChip: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    ...theme.shadows.card,
  },
  mapChipText: {
    ...theme.typography.monoSmall,
    color: theme.colors.black,
  },
  pinWrap: {
    position: 'absolute',
    top: '48%',
    left: '20%',
  },
  centeredPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -8,
    marginTop: -22,
  },
  pin: {
    width: 16,
    height: 16,
    backgroundColor: theme.colors.orange,
    borderRadius: 16,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    transform: [{ rotate: '45deg' }],
  },
  pulse: {
    position: 'absolute',
    borderWidth: theme.borders.regular,
    borderRadius: theme.radius.pill,
  },
  pinPulseLeft: {
    top: '47%',
    left: '18%',
  },
  pinPulseCenter: {
    top: '49%',
    left: '49%',
  },
  route: {
    position: 'absolute',
    top: '48%',
    left: '22%',
    right: '22%',
    height: 4,
    borderRadius: 3,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  routeStart: {
    position: 'absolute',
    top: '46.5%',
    left: '19%',
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.green,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  routeEnd: {
    position: 'absolute',
    top: '46.5%',
    right: '19%',
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.black,
  },
  vehicle: {
    position: 'absolute',
    top: '36%',
    left: '18%',
  },
  vehicleEmoji: {
    fontSize: 18,
  },
});
