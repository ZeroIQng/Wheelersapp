import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
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
  const bounce = useSharedValue(0);
  const wheels = useSharedValue(0);

  useEffect(() => {
    bounce.value = withRepeat(
      withTiming(1, {
        duration: selected ? 950 : 1800,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [bounce, selected]);

  useEffect(() => {
    wheels.value = withSequence(
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
  }, [motionKey, selected, wheels]);

  const carStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bounce.value, [0, 1], [0, -4]) },
      { translateX: interpolate(bounce.value, [0, 1], [-1, 2]) },
      { rotate: `${interpolate(bounce.value, [0, 1], [-1.5, 1.5])}deg` },
    ],
  }));

  const wheelFrontStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wheels.value * 360}deg` }],
  }));

  const wheelBackStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wheels.value * 360}deg` }],
  }));

  const motionLineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(wheels.value % 1, [0, 0.2, 1], [0, 0.9, 0]),
    transform: [{ translateX: interpolate(wheels.value % 1, [0, 1], [8, -8]) }],
  }));

  return (
    <View style={styles.badgeInner}>
      <Animated.View style={[styles.motionLineTop, motionLineStyle, selected ? styles.motionLineLight : null]} />
      <Animated.View style={[styles.motionLineBottom, motionLineStyle, selected ? styles.motionLineLight : null]} />
      <Animated.View style={[styles.vehicleWrap, carStyle]}>
        <RideVehicle selected={selected} />
      </Animated.View>
      <Animated.View style={[styles.wheelFront, wheelFrontStyle]}>
        <Wheel selected={selected} />
      </Animated.View>
      <Animated.View style={[styles.wheelBack, wheelBackStyle]}>
        <Wheel selected={selected} />
      </Animated.View>
    </View>
  );
}

function DriveBadge({ selected, motionKey }: BadgeProps) {
  const drive = useSharedValue(0);
  const lane = useSharedValue(0);

  useEffect(() => {
    drive.value = withRepeat(
      withTiming(1, {
        duration: selected ? 900 : 1700,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [drive, selected]);

  useEffect(() => {
    lane.value = withSequence(
      withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      }),
      withRepeat(
        withTiming(1, {
          duration: selected ? 720 : 1200,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );
  }, [lane, motionKey, selected]);

  const carStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(drive.value, [0, 1], [1, -3]) },
      { rotate: `${interpolate(drive.value, [0, 1], [-2, 2])}deg` },
    ],
  }));

  const laneOneStyle = useAnimatedStyle(() => ({
    opacity: interpolate((lane.value + 0.05) % 1, [0, 0.2, 1], [0, 1, 0]),
    transform: [{ translateY: interpolate((lane.value + 0.05) % 1, [0, 1], [-16, 16]) }],
  }));

  const laneTwoStyle = useAnimatedStyle(() => ({
    opacity: interpolate((lane.value + 0.45) % 1, [0, 0.2, 1], [0, 1, 0]),
    transform: [{ translateY: interpolate((lane.value + 0.45) % 1, [0, 1], [-16, 16]) }],
  }));

  const laneThreeStyle = useAnimatedStyle(() => ({
    opacity: interpolate((lane.value + 0.82) % 1, [0, 0.2, 1], [0, 1, 0]),
    transform: [{ translateY: interpolate((lane.value + 0.82) % 1, [0, 1], [-16, 16]) }],
  }));

  return (
    <View style={styles.badgeInner}>
      <View style={[styles.roadStrip, selected ? styles.roadStripLight : null]}>
        <Animated.View style={[styles.laneDash, laneOneStyle, selected ? styles.laneDashLight : null]} />
        <Animated.View style={[styles.laneDash, laneTwoStyle, selected ? styles.laneDashLight : null]} />
        <Animated.View style={[styles.laneDash, laneThreeStyle, selected ? styles.laneDashLight : null]} />
      </View>
      <Animated.View style={[styles.vehicleWrap, carStyle]}>
        <DriveVehicle selected={selected} />
      </Animated.View>
    </View>
  );
}

function RideVehicle({ selected }: { selected: boolean }) {
  const carBody = selected ? theme.colors.white : theme.colors.orange;
  const trim = theme.colors.black;
  const windowFill = selected ? 'rgba(255,92,0,0.18)' : '#FFF6F0';
  const riderSkin = '#F3C9A6';
  const riderShirt = selected ? '#FFB37E' : '#FFD6B8';
  const seatColor = selected ? '#FFD8BF' : '#FFE7D6';

  return (
    <Svg width={78} height={54} viewBox="0 0 78 54">
      <Rect
        x="10"
        y="28"
        width="54"
        height="14"
        rx="6"
        fill={carBody}
        stroke={trim}
        strokeWidth="2.5"
      />
      <Path
        d="M18 28L28 18H52C56 18 58 20 60 24L64 28Z"
        fill={carBody}
        stroke={trim}
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <Path d="M30 20H41V28H24C25 24 27 22 30 20Z" fill={windowFill} stroke={trim} strokeWidth="2" />
      <Path d="M43 20H51C54 20 56 22 58 28H43Z" fill={windowFill} stroke={trim} strokeWidth="2" />
      <Rect x="24" y="30" width="30" height="7" rx="3.5" fill={seatColor} />
      <Circle cx="49" cy="25" r="4.5" fill={riderSkin} stroke={trim} strokeWidth="1.5" />
      <Path
        d="M45 34C45 31.5 46.8 30 49 30C51.2 30 53 31.5 53 34V37H45Z"
        fill={riderShirt}
        stroke={trim}
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <Path
        d="M43 31C42 29 40.5 28 38 28"
        fill="none"
        stroke={trim}
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <Circle cx="18" cy="43" r="2.5" fill={selected ? '#FFD6B8' : '#FFC9A1'} stroke={trim} strokeWidth="1.5" />
      <Circle cx="56" cy="43" r="2.5" fill={selected ? '#FFD6B8' : '#FFC9A1'} stroke={trim} strokeWidth="1.5" />
    </Svg>
  );
}

function DriveVehicle({ selected }: { selected: boolean }) {
  const carBody = selected ? theme.colors.white : theme.colors.orange;
  const trim = theme.colors.black;
  const windowFill = selected ? 'rgba(255,92,0,0.18)' : '#FFF6F0';
  const driverSkin = '#F3C9A6';
  const driverShirt = selected ? '#FFC48A' : '#FFE1C6';
  const wheelFill = selected ? '#FFB37E' : '#FFD2AE';

  return (
    <Svg width={78} height={54} viewBox="0 0 78 54">
      <Rect
        x="14"
        y="28"
        width="52"
        height="14"
        rx="6"
        fill={carBody}
        stroke={trim}
        strokeWidth="2.5"
      />
      <Path
        d="M22 28L31 18H55C58 18 61 20 63 24L66 28Z"
        fill={carBody}
        stroke={trim}
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <Path d="M33 20H46V28H27C28 23.5 30 21.5 33 20Z" fill={windowFill} stroke={trim} strokeWidth="2" />
      <Path d="M48 20H55C58 20 60 22 61.5 28H48Z" fill={windowFill} stroke={trim} strokeWidth="2" />
      <Circle cx="39" cy="24" r="4.5" fill={driverSkin} stroke={trim} strokeWidth="1.5" />
      <Path
        d="M35 34C35 31 36.8 29 39 29C41.2 29 43 31 43 34V37H35Z"
        fill={driverShirt}
        stroke={trim}
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <Circle cx="46.5" cy="31.5" r="4" fill="none" stroke={trim} strokeWidth="1.5" />
      <Path d="M42.5 31.5H39.5" fill="none" stroke={trim} strokeLinecap="round" strokeWidth="1.5" />
      <Path d="M47 27.5V24.5" fill="none" stroke={trim} strokeLinecap="round" strokeWidth="1.5" />
      <Rect x="50" y="29" width="8" height="7" rx="3.5" fill={wheelFill} opacity={0.8} />
      <Circle cx="22" cy="43" r="2.5" fill={selected ? '#FFD6B8' : '#FFC9A1'} stroke={trim} strokeWidth="1.5" />
      <Circle cx="58" cy="43" r="2.5" fill={selected ? '#FFD6B8' : '#FFC9A1'} stroke={trim} strokeWidth="1.5" />
    </Svg>
  );
}

function Wheel({ selected }: { selected: boolean }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Circle cx="6" cy="6" r="4.8" fill={theme.colors.black} />
      <Circle cx="6" cy="6" r="1.8" fill={selected ? theme.colors.orange : theme.colors.white} />
      <Path d="M6 1.8V10.2" stroke={selected ? theme.colors.orange : theme.colors.white} strokeWidth="1.2" />
      <Path d="M1.8 6H10.2" stroke={selected ? theme.colors.orange : theme.colors.white} strokeWidth="1.2" />
    </Svg>
  );
}

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
    width: 80,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleWrap: {
    width: 78,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motionLineTop: {
    position: 'absolute',
    left: 0,
    top: 22,
    width: 14,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
  },
  motionLineBottom: {
    position: 'absolute',
    left: 4,
    top: 30,
    width: 10,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
  },
  motionLineLight: {
    backgroundColor: theme.colors.white,
  },
  wheelFront: {
    position: 'absolute',
    bottom: 6,
    left: 21,
  },
  wheelBack: {
    position: 'absolute',
    bottom: 6,
    right: 17,
  },
  roadStrip: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 34,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.black,
    overflow: 'hidden',
    alignItems: 'center',
  },
  roadStripLight: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  laneDash: {
    position: 'absolute',
    width: 4,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
  },
  laneDashLight: {
    backgroundColor: theme.colors.white,
  },
});
