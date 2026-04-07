import { PropsWithChildren, useEffect } from 'react';
import { DimensionValue, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Polygon, Rect } from 'react-native-svg';

import { InstructionCard } from '@/components/InstructionCard';
import { AppText } from '@/components/app-text';
import { RouteInstruction } from '@/data/mock';
import { theme } from '@/theme';

type MapVariant = 'riderTrip' | 'driverNavigation' | 'driverDashboard' | 'driverActive';

type PositionedBox = {
  top?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  bottom?: DimensionValue;
  width: number;
  height: number;
};

type VariantConfig = {
  roadsH: { top: DimensionValue; height: number }[];
  roadsV: { left: DimensionValue; width: number }[];
  blocks: PositionedBox[];
  routeStyle: ViewStyle;
  routeDashed?: boolean;
  carStyle?: ViewStyle;
  destinationStyle?: ViewStyle;
  pulseStyle?: ViewStyle;
  badgeStyle?: ViewStyle;
  decoration: 'rings' | 'diamonds' | 'ellipses' | 'polygon';
};

type MapMockProps = PropsWithChildren<{
  variant: MapVariant;
  height?: number;
  showRoute?: boolean;
  showCar?: boolean;
  showDestination?: boolean;
  showPulse?: boolean;
  showInstructionBanner?: boolean;
  instruction?: RouteInstruction;
  topBadge?: string;
}>;

const configs: Record<MapVariant, VariantConfig> = {
  riderTrip: {
    roadsH: [
      { top: '44%', height: 9 },
      { top: '68%', height: 6 },
    ],
    roadsV: [
      { left: '30%', width: 8 },
      { left: '64%', width: 6 },
    ],
    blocks: [
      { top: '12%', left: '5%', width: 50, height: 36 },
      { top: '14%', right: '7%', width: 36, height: 50 },
      { top: '55%', right: '15%', width: 44, height: 30 },
    ],
    routeStyle: {
      top: '47%',
      left: '14%',
      right: '14%',
      height: 4,
    },
    carStyle: {
      top: '42%',
      left: '14%',
    },
    destinationStyle: {
      top: '38%',
      right: '11%',
    },
    badgeStyle: {
      top: 10,
      right: 10,
    },
    decoration: 'rings',
  },
  driverNavigation: {
    roadsH: [
      { top: '42%', height: 9 },
      { top: '66%', height: 6 },
    ],
    roadsV: [
      { left: '35%', width: 8 },
      { left: '65%', width: 6 },
    ],
    blocks: [
      { top: '10%', left: '6%', width: 50, height: 36 },
      { top: '50%', right: '7%', width: 36, height: 50 },
    ],
    routeStyle: {
      top: '40%',
      left: '10%',
      right: '10%',
      height: 16,
    },
    routeDashed: true,
    carStyle: {
      top: '34%',
      left: '24%',
    },
    destinationStyle: {
      top: '28%',
      right: '18%',
    },
    decoration: 'diamonds',
  },
  driverDashboard: {
    roadsH: [{ top: '45%', height: 7 }],
    roadsV: [{ left: '40%', width: 6 }],
    blocks: [
      { top: '10%', left: '8%', width: 42, height: 30 },
      { top: '55%', right: '10%', width: 34, height: 42 },
    ],
    routeStyle: {
      top: '47%',
      left: '24%',
      right: '24%',
      height: 3,
    },
    pulseStyle: {
      top: '50%',
      left: '50%',
      marginLeft: -7,
      marginTop: -7,
    },
    decoration: 'ellipses',
  },
  driverActive: {
    roadsH: [{ top: '45%', height: 9 }],
    roadsV: [
      { left: '28%', width: 7 },
      { left: '62%', width: 6 },
    ],
    blocks: [
      { top: '12%', left: '6%', width: 50, height: 34 },
      { top: '55%', right: '10%', width: 36, height: 48 },
    ],
    routeStyle: {
      top: '47%',
      left: '13%',
      right: '14%',
      height: 4,
    },
    carStyle: {
      top: '41%',
      left: '16%',
    },
    destinationStyle: {
      top: '32%',
      right: '13%',
    },
    badgeStyle: {
      top: 10,
      right: 10,
    },
    decoration: 'polygon',
  },
};

export function MapMock({
  children,
  variant,
  height = 280,
  showRoute,
  showCar,
  showDestination,
  showPulse,
  showInstructionBanner,
  instruction,
  topBadge,
}: MapMockProps) {
  const config = configs[variant];
  const carProgress = useSharedValue(0);
  const pulseProgress = useSharedValue(0);

  useEffect(() => {
    carProgress.value = withRepeat(
      withTiming(1, {
        duration: variant === 'driverActive' ? 5000 : 3600,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
    pulseProgress.value = withRepeat(
      withTiming(1, {
        duration: 2200,
        easing: Easing.out(Easing.ease),
      }),
      -1,
      false
    );
  }, [carProgress, pulseProgress, variant]);

  const carStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 22 * carProgress.value }, { translateY: -2 * carProgress.value }],
  }));

  const pulseOuterStyle = useAnimatedStyle(() => ({
    opacity: 0.5 - 0.5 * pulseProgress.value,
    transform: [{ scale: 1 + pulseProgress.value * 1.2 }],
  }));

  return (
    <View style={[styles.container, { height }]}>
      {config.roadsH.map((road, index) => (
        <View key={`rh-${index}`} style={[styles.roadHorizontal, road]} />
      ))}
      {config.roadsV.map((road, index) => (
        <View key={`rv-${index}`} style={[styles.roadVertical, road]} />
      ))}
      {config.blocks.map((block, index) => (
        <View key={`block-${index}`} style={[styles.block, block]} />
      ))}

      {showRoute ? (
        config.routeDashed ? (
          <Svg style={[styles.routeSvg, config.routeStyle]} viewBox="0 0 240 20" preserveAspectRatio="none">
            <Path
              d="M6 10 L234 10"
              stroke={theme.colors.orange}
              strokeWidth="4"
              strokeDasharray="10 6"
              fill="none"
            />
          </Svg>
        ) : (
          <View style={[styles.route, config.routeStyle]} />
        )
      ) : null}

      {showPulse && config.pulseStyle ? (
        <>
          <Animated.View style={[styles.pulseOuter, config.pulseStyle, pulseOuterStyle]} />
          <View style={[styles.pulseCenter, config.pulseStyle]} />
        </>
      ) : null}

      {showCar && config.carStyle ? (
        <Animated.View style={[styles.car, config.carStyle, carStyle]}>
          <Text style={styles.carEmoji}>🚗</Text>
        </Animated.View>
      ) : null}

      {showDestination && config.destinationStyle ? (
        <View style={[styles.destination, config.destinationStyle]}>
          <Text style={styles.destinationText}>
            {variant === 'driverNavigation' ? '🟢' : '📍'}
          </Text>
        </View>
      ) : null}

      {showInstructionBanner && instruction ? (
        <View style={styles.bannerWrap}>
          <InstructionCard instruction={instruction} variant="banner" />
        </View>
      ) : null}

      {topBadge ? (
        <View style={[styles.topBadge, config.badgeStyle]}>
          <View style={styles.liveDot} />
          <AppText variant="monoSmall" color={theme.colors.offWhite}>
            {topBadge}
          </AppText>
        </View>
      ) : null}

      <Decoration variant={config.decoration} />
      {children}
    </View>
  );
}

function Decoration({ variant }: { variant: VariantConfig['decoration'] }) {
  switch (variant) {
    case 'rings':
      return (
        <>
          <Svg width={54} height={54} viewBox="0 0 54 54" style={styles.decorationBottomLeft}>
            <Circle cx="18" cy="28" r="13" fill="none" stroke={theme.colors.orange} strokeWidth="2" />
            <Circle cx="34" cy="28" r="13" fill="none" stroke={theme.colors.black} strokeWidth="2" />
            <Circle cx="26" cy="16" r="10" fill="none" stroke={theme.colors.orange} strokeWidth="1.5" opacity="0.6" />
          </Svg>
          <Svg width={64} height={22} viewBox="0 0 64 22" style={styles.decorationTopLeft}>
            <Path
              d="M2 11 L50 11 L40 3 M50 11 L40 19"
              fill="none"
              stroke={theme.colors.orange}
              strokeWidth="2"
              strokeDasharray="5 3"
            />
          </Svg>
        </>
      );
    case 'diamonds':
      return (
        <Svg width={46} height={46} viewBox="0 0 46 46" style={styles.decorationBottomRight}>
          <Rect x="11" y="11" width="24" height="24" transform="rotate(45 23 23)" fill="none" stroke={theme.colors.orange} strokeWidth="2" />
          <Rect x="17" y="17" width="12" height="12" transform="rotate(45 23 23)" fill="none" stroke={theme.colors.black} strokeWidth="1.5" />
          <Circle cx="23" cy="23" r="3" fill={theme.colors.orange} />
        </Svg>
      );
    case 'ellipses':
      return (
        <Svg width={110} height={110} viewBox="0 0 110 110" style={styles.decorationTopRight}>
          <Ellipse cx="55" cy="55" rx="50" ry="32" fill="none" stroke={theme.colors.orange} strokeWidth="2" />
          <Ellipse cx="55" cy="55" rx="32" ry="50" fill="none" stroke={theme.colors.black} strokeWidth="1.5" />
          <Ellipse
            cx="55"
            cy="55"
            rx="50"
            ry="32"
            fill="none"
            stroke={theme.colors.orange}
            strokeWidth="1"
            transform="rotate(45 55 55)"
            opacity="0.5"
          />
        </Svg>
      );
    case 'polygon':
      return (
        <Svg width={50} height={50} viewBox="0 0 50 50" style={styles.decorationBottomLeft}>
          <Polygon
            points="25,3 28,10 35,7 33,14 40,16 35,21 38,28 31,28 30,36 25,32 20,36 19,28 12,28 15,21 10,16 17,14 15,7 22,10"
            fill="none"
            stroke={theme.colors.orange}
            strokeWidth="1.8"
          />
          <Circle cx="25" cy="25" r="6" fill="none" stroke={theme.colors.black} strokeWidth="1.5" />
        </Svg>
      );
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.mapBase,
    overflow: 'hidden',
    position: 'relative',
  },
  roadHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.mapRoad,
    borderRadius: 3,
  },
  roadVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.mapRoad,
    borderRadius: 3,
  },
  block: {
    position: 'absolute',
    backgroundColor: theme.colors.mapBlock,
    borderWidth: 1,
    borderColor: 'rgba(145,175,145,0.5)',
    borderRadius: 4,
  },
  route: {
    position: 'absolute',
    backgroundColor: theme.colors.orange,
    borderRadius: 3,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  routeSvg: {
    position: 'absolute',
  },
  car: {
    position: 'absolute',
  },
  carEmoji: {
    fontSize: 19,
  },
  destination: {
    position: 'absolute',
  },
  destinationText: {
    fontSize: 18,
  },
  pulseOuter: {
    position: 'absolute',
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.orange,
  },
  pulseCenter: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
  },
  bannerWrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
  },
  topBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.black,
    borderRadius: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: '#FF4444',
  },
  decorationBottomLeft: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    opacity: 0.13,
  },
  decorationTopLeft: {
    position: 'absolute',
    top: 8,
    left: 10,
    opacity: 0.12,
  },
  decorationBottomRight: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    opacity: 0.13,
  },
  decorationTopRight: {
    position: 'absolute',
    top: -12,
    right: -10,
    opacity: 0.08,
  },
});
