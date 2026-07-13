import { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { theme } from '@/theme';

type SkeletonLineProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A single pulsing skeleton line/block.
 */
export function SkeletonLine({
  width = '100%',
  height = 14,
  borderRadius = 6,
  style,
}: SkeletonLineProps) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: theme.colors.borderLight },
        animStyle,
        style,
      ]}
    />
  );
}

/**
 * A skeleton card mimicking an AppCard with pulsing lines.
 */
export function SkeletonCard({
  lines = 3,
  style,
}: {
  lines?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={i === 0 ? 18 : 12}
          style={i > 0 ? styles.lineGap : undefined}
        />
      ))}
    </View>
  );
}

/**
 * A skeleton metric card (square-ish block with a value and label).
 */
export function SkeletonMetric({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.metric, style]}>
      <SkeletonLine width={48} height={24} borderRadius={4} />
      <SkeletonLine width={64} height={10} />
    </View>
  );
}

/**
 * A row of skeleton metrics.
 */
export function SkeletonMetricRow({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.metricRow}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonMetric key={i} style={styles.metricItem} />
      ))}
    </View>
  );
}

/**
 * Full-screen skeleton for a list page (header + metric row + list items).
 */
export function SkeletonListPage({ itemCount = 4 }: { itemCount?: number }) {
  return (
    <View style={styles.page}>
      <SkeletonLine width="50%" height={22} />
      <SkeletonLine width="30%" height={12} style={styles.lineGap} />
      <SkeletonMetricRow />
      {Array.from({ length: itemCount }).map((_, i) => (
        <SkeletonCard key={i} lines={2} style={styles.lineGap} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
  },
  lineGap: {
    marginTop: theme.spacing.sm,
  },
  metric: {
    flex: 1,
    minHeight: 72,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.sm,
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  metricRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  metricItem: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
});
