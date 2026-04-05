import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { theme } from '@/theme';

type Variant = 'primary' | 'ghost' | 'inverse' | 'danger';

type AppButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const variantStyles = {
  primary: {
    backgroundColor: theme.colors.orange,
    borderColor: theme.colors.black,
    textColor: theme.colors.offWhite,
    shadowColor: theme.colors.black,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.black,
    textColor: theme.colors.black,
    shadowColor: theme.colors.black,
  },
  inverse: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.black,
    textColor: theme.colors.orange,
    shadowColor: theme.colors.black,
  },
  danger: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.danger,
    textColor: theme.colors.danger,
    shadowColor: theme.colors.danger,
  },
} as const;

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: AppButtonProps) {
  const current = variantStyles[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: current.backgroundColor,
          borderColor: current.borderColor,
          shadowColor: current.shadowColor,
        },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <AppText variant="label" color={current.textColor} style={styles.label}>
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderWidth: theme.borders.thick,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...theme.shadows.card,
  },
  label: {
    textAlign: 'center',
  },
  pressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: {
    opacity: 0.4,
  },
});
