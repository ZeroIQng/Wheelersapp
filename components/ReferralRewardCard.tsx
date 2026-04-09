import { StyleSheet } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { theme } from '@/theme';

type ReferralRewardCardProps = {
  icon: string;
  value: string;
  title: string;
  accent?: boolean;
};

export function ReferralRewardCard({
  icon,
  value,
  title,
  accent,
}: ReferralRewardCardProps) {
  return (
    <AppCard
      backgroundColor={accent ? theme.colors.orangeLight : theme.colors.white}
      borderColor={accent ? theme.colors.orange : theme.colors.black}
      style={[styles.card, accent ? styles.accentCard : null]}>
      <AppText variant="metric" style={styles.icon}>
        {icon}
      </AppText>
      <AppText variant="monoLarge" color={accent ? theme.colors.orange : theme.colors.black}>
        {value}
      </AppText>
      <AppText variant="bodySmall" color={theme.colors.muted}>
        {title}
      </AppText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 138,
    gap: 4,
  },
  accentCard: {
    shadowColor: theme.colors.orange,
  },
  icon: {
    marginBottom: 2,
  },
});
