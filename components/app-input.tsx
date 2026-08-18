import { forwardRef } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { useResponsive } from '@/lib/responsive';
import { useAppTheme } from '@/lib/theme-context';
import { theme } from '@/theme';

type AppInputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  hint?: string;
  error?: string;
  /** Visual weight of the typed text. */
  size?: 'default' | 'large';
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

/**
 * Bordered text field used across the driver flows.
 *
 * Sizing follows the device: a 320pt phone gets a shorter box and smaller
 * type than a Pro Max, and the field grows with `multiline` instead of
 * clipping. Single-line fields keep scrolling horizontally as you type, so a
 * long value is never hidden behind the edge of the box.
 */
export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInput(
  { label, hint, error, size = 'default', containerStyle, inputStyle, multiline, ...props },
  ref,
) {
  const { isDark } = useAppTheme();
  const responsive = useResponsive();

  const minHeight = responsive.scale(size === 'large' ? 58 : 52);
  const fontSize = responsive.font(size === 'large' ? 20 : 15);

  return (
    <View style={[styles.field, containerStyle]}>
      {label ? (
        <AppText variant="label" style={styles.label} numberOfLines={2}>
          {label}
        </AppText>
      ) : null}

      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={isDark ? theme.colors.darkMuted : theme.colors.mutedLight}
        textAlignVertical={multiline ? 'top' : 'center'}
        underlineColorAndroid="transparent"
        {...props}
        style={[
          styles.input,
          {
            minHeight: multiline ? minHeight * 2 : minHeight,
            paddingHorizontal: responsive.scale(16),
            paddingVertical: multiline ? responsive.scale(12) : Platform.OS === 'ios' ? 0 : 4,
            fontSize,
            lineHeight: Math.round(fontSize * 1.35),
            fontFamily: size === 'large' ? 'ClashDisplay_700Bold' : 'ClashDisplay_500Medium',
            color: isDark ? theme.colors.offWhite : theme.colors.black,
            backgroundColor: isDark ? theme.colors.darkSurface : theme.colors.white,
            borderColor: error
              ? theme.colors.danger
              : isDark
                ? theme.colors.darkBorder
                : theme.colors.black,
          },
          inputStyle,
        ]}
      />

      {error ? (
        <AppText variant="bodySmall" color={theme.colors.danger} style={styles.helper}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="bodySmall" color={theme.colors.muted} style={styles.helper}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    gap: theme.spacing.xs,
    width: '100%',
  },
  label: {
    marginLeft: theme.spacing.xs,
  },
  input: {
    width: '100%',
    borderWidth: theme.borders.thick,
    borderRadius: theme.radius.sm,
    ...theme.shadows.subtle,
  },
  helper: {
    marginLeft: theme.spacing.xs,
  },
});
