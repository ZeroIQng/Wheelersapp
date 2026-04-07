import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { theme } from '@/theme';

type MetricCardProps = {
  value: string;
  label: string;
  accent?: 'orange' | 'green' | 'black' | 'danger';
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
};

const accentColors = {
  orange: theme.colors.orange,
  green: theme.colors.green,
  black: theme.colors.black,
  danger: theme.colors.danger,
} as const;

export function MetricCard({
  value,
  label,
  accent = 'black',
  style,
  backgroundColor = theme.colors.white,
}: MetricCardProps) {
  return (
    <AppCard backgroundColor={backgroundColor} style={[styles.card, style]}>
      <AppText variant="monoLarge" color={accentColors[accent]} style={styles.value}>
        {value}
      </AppText>
      <AppText variant="bodySmall" color={theme.colors.muted} style={styles.label}>
        {label}
      </AppText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  value: {
    textAlign: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
