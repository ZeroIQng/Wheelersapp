import { StyleSheet } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { theme } from '@/theme';

type TokenStatCardProps = {
  label: string;
  value: string;
  accent?: 'green' | 'orange' | 'white';
};

export function TokenStatCard({ label, value, accent = 'white' }: TokenStatCardProps) {
  const color =
    accent === 'green'
      ? theme.colors.green
      : accent === 'orange'
        ? theme.colors.orange
        : theme.colors.white;

  return (
    <AppCard backgroundColor={theme.colors.darkSurface} borderColor={theme.colors.darkBorder} style={styles.card}>
      <AppText variant="monoLarge" color={color}>
        {value}
      </AppText>
      <AppText variant="bodySmall" color={theme.colors.darkMuted}>
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
    shadowOpacity: 0,
    elevation: 0,
  },
});
