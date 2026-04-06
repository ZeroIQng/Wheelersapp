import { PropsWithChildren, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type FloatProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  duration?: number;
  delay?: number;
  distance?: number;
  rotate?: number;
}>;

export function FloatingView({
  children,
  style,
  duration = 2600,
  delay = 0,
  distance = 8,
  rotate = 0,
}: FloatProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      )
    );
  }, [delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -distance * progress.value },
      { translateX: (distance / 2) * progress.value },
      { rotate: `${rotate * progress.value}deg` },
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

type PulseProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  duration?: number;
  delay?: number;
  scaleTo?: number;
}>;

export function PulseView({
  children,
  style,
  duration = 1800,
  delay = 0,
  scaleTo = 1.04,
}: PulseProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      )
    );
  }, [delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (scaleTo - 1) * progress.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

type RevealProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  delay?: number;
  from?: 'up' | 'down';
}>;

export function RevealView({ children, style, delay = 0, from = 'up' }: RevealProps) {
  return (
    <Animated.View
      entering={
        from === 'up'
          ? FadeInUp.delay(delay).duration(420)
          : FadeInDown.delay(delay).duration(420)
      }
      style={style}>
      {children}
    </Animated.View>
  );
}
