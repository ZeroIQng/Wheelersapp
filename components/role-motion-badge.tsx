import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { theme } from '@/theme';

type RoleMotionBadgeProps = {
  role: 'ride' | 'drive';
  selected: boolean;
  motionKey: number;
};

export function RoleMotionBadge({ role, selected, motionKey }: RoleMotionBadgeProps) {
  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: selected ? 'rgba(255,255,255,0.14)' : theme.colors.orangeLight,
          borderColor: selected ? 'rgba(255,255,255,0.42)' : theme.colors.black,
        },
      ]}>
      {role === 'ride' ? (
        <RideBadge motionKey={motionKey} selected={selected} />
      ) : (
        <DriveBadge motionKey={motionKey} selected={selected} />
      )}
    </View>
  );
}

type BadgeProps = {
  selected: boolean;
  motionKey: number;
};

function RideBadge({ selected, motionKey }: BadgeProps) {
  const travel = useSharedValue(0);

  useEffect(() => {
    travel.value = withRepeat(
      withTiming(1, {
        duration: selected ? 1200 : 2200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [selected, travel]);

  useEffect(() => {
    if (motionKey === 0) {
      return;
    }

    travel.value = withSequence(
      withTiming(1, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0, {
        duration: 280,
        easing: Easing.inOut(Easing.quad),
      }),
      withRepeat(
        withTiming(1, {
          duration: selected ? 1200 : 2200,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      )
    );
  }, [motionKey, selected, travel]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(travel.value, [0, 1], [-18, 18]) },
      { translateY: interpolate(travel.value, [0, 1], [14, -12]) },
      { scale: interpolate(travel.value, [0, 0.5, 1], [0.92, 1.08, 0.96]) },
    ],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(travel.value, [0, 0.5, 1], [0.2, 0.7, 0.22]),
    transform: [{ scale: interpolate(travel.value, [0, 1], [0.9, 1.08]) }],
  }));

  const lineColor = selected ? 'rgba(255,255,255,0.72)' : theme.colors.black;
  const fillColor = selected ? theme.colors.white : theme.colors.orange;
  const softFill = selected ? 'rgba(255,255,255,0.22)' : 'rgba(255,92,0,0.18)';

  return (
    <View style={styles.badgeInner}>
      <Svg width={74} height={62} viewBox="0 0 74 62">
        <Path
          d="M10 48C18 44 22 40 28 33C35 25 42 18 58 14"
          fill="none"
          stroke={lineColor}
          strokeDasharray="4 5"
          strokeLinecap="round"
          strokeWidth={3}
        />
        <Circle cx="11" cy="48" fill={fillColor} r="6" />
        <Circle cx="58" cy="14" fill={softFill} r="10" />
        <Circle
          cx="58"
          cy="14"
          fill="none"
          r="6"
          stroke={selected ? theme.colors.white : theme.colors.orange}
          strokeWidth={3}
        />
      </Svg>
      <Animated.View style={[styles.rideRipple, rippleStyle, { borderColor: softFill }]} />
      <Animated.View style={[styles.rideOrb, orbStyle, { backgroundColor: fillColor }]} />
    </View>
  );
}

function DriveBadge({ selected, motionKey }: BadgeProps) {
  const lane = useSharedValue(0);
  const lean = useSharedValue(0);

  useEffect(() => {
    lane.value = withRepeat(
      withTiming(1, {
        duration: selected ? 900 : 1600,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    lean.value = withRepeat(
      withTiming(1, {
        duration: selected ? 1600 : 2400,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [selected, lane, lean]);

  useEffect(() => {
    if (motionKey === 0) {
      return;
    }

    lane.value = withSequence(
      withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      }),
      withRepeat(
        withTiming(1, {
          duration: selected ? 900 : 1600,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );
  }, [motionKey, selected, lane]);

  const roadStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(lean.value, [0, 1], [-4, 5])}deg` }],
  }));

  const markerOneStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate((lane.value + 0.05) % 1, [0, 1], [-16, 34]) }],
    opacity: interpolate((lane.value + 0.05) % 1, [0, 0.2, 1], [0, 0.9, 0]),
  }));

  const markerTwoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate((lane.value + 0.38) % 1, [0, 1], [-16, 34]) }],
    opacity: interpolate((lane.value + 0.38) % 1, [0, 0.2, 1], [0, 0.9, 0]),
  }));

  const markerThreeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate((lane.value + 0.72) % 1, [0, 1], [-16, 34]) }],
    opacity: interpolate((lane.value + 0.72) % 1, [0, 0.2, 1], [0, 0.9, 0]),
  }));

  const lineColor = selected ? theme.colors.white : theme.colors.black;
  const roadFill = selected ? 'rgba(255,255,255,0.18)' : 'rgba(255,92,0,0.16)';
  const markerColor = selected ? theme.colors.white : theme.colors.orange;

  return (
    <View style={styles.badgeInner}>
      <Svg width={74} height={62} viewBox="0 0 74 62" style={styles.driveBase}>
        <Path
          d="M16 17C21 11 28 8 37 8C46 8 53 11 58 17"
          fill="none"
          stroke={lineColor}
          strokeLinecap="round"
          strokeWidth={3}
        />
        <Path
          d="M24 54L31 23C32 18 42 18 43 23L50 54Z"
          fill={roadFill}
          stroke={lineColor}
          strokeLinejoin="round"
          strokeWidth={3}
        />
      </Svg>
      <Animated.View style={[styles.roadBody, roadStyle, { borderColor: lineColor, backgroundColor: roadFill }]}>
        <Animated.View style={[styles.laneMarker, markerOneStyle, { backgroundColor: markerColor }]} />
        <Animated.View style={[styles.laneMarker, markerTwoStyle, { backgroundColor: markerColor }]} />
        <Animated.View style={[styles.laneMarker, markerThreeStyle, { backgroundColor: markerColor }]} />
      </Animated.View>
      <View style={[styles.dashboardGlow, { backgroundColor: selected ? 'rgba(255,255,255,0.2)' : softOrange }]} />
    </View>
  );
}

const softOrange = 'rgba(255,92,0,0.18)';

const styles = StyleSheet.create({
  shell: {
    width: 92,
    height: 92,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInner: {
    width: 74,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideOrb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: theme.radius.pill,
    top: 26,
    left: 31,
    borderWidth: 2,
    borderColor: 'rgba(13,13,13,0.08)',
  },
  rideRipple: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: theme.radius.pill,
    top: 18,
    right: 8,
    borderWidth: 2,
  },
  driveBase: {
    position: 'absolute',
  },
  roadBody: {
    position: 'absolute',
    bottom: 4,
    width: 24,
    height: 36,
    borderRadius: theme.radius.sm,
    borderWidth: 2.5,
    overflow: 'hidden',
    alignItems: 'center',
  },
  laneMarker: {
    position: 'absolute',
    width: 4,
    height: 10,
    borderRadius: theme.radius.pill,
  },
  dashboardGlow: {
    position: 'absolute',
    top: 12,
    width: 34,
    height: 10,
    borderRadius: theme.radius.pill,
  },
});
