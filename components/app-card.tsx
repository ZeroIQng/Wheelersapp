import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { theme } from '@/theme';

type AppCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  borderColor?: string;
}>;

export function AppCard({
  children,
  style,
  backgroundColor = theme.colors.white,
  borderColor = theme.colors.black,
}: AppCardProps) {
  return (
    <View style={[styles.card, { backgroundColor, borderColor }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: theme.borders.thick,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
});
