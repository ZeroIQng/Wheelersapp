import { StyleProp, StyleSheet, Text, TextProps, TextStyle } from 'react-native';

import { theme } from '@/theme';

type Variant = keyof typeof styles;

type AppTextProps = TextProps & {
  variant?: Exclude<Variant, 'base'>;
  color?: string;
  style?: StyleProp<TextStyle>;
};

export function AppText({
  variant = 'body',
  color = theme.colors.black,
  style,
  ...props
}: AppTextProps) {
  return <Text {...props} style={[styles.base, styles[variant], { color }, style]} />;
}

const styles = StyleSheet.create({
  base: {
    color: theme.colors.black,
  },
  display: theme.typography.display,
  h1: theme.typography.h1,
  h2: theme.typography.h2,
  h3: theme.typography.h3,
  body: theme.typography.body,
  bodyMedium: theme.typography.bodyMedium,
  bodySmall: theme.typography.bodySmall,
  label: theme.typography.label,
  mono: theme.typography.mono,
  monoSmall: theme.typography.monoSmall,
  monoLarge: theme.typography.monoLarge,
});
