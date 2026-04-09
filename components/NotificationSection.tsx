import { StyleSheet, View } from 'react-native';

import { NotificationCard } from '@/components/NotificationCard';
import { AppText } from '@/components/app-text';
import { RevealView } from '@/components/motion';
import { NotificationItem } from '@/data/mock';
import { theme } from '@/theme';

type NotificationSectionProps = {
  title: string;
  items: readonly NotificationItem[];
  muted?: boolean;
  delayStart?: number;
};

export function NotificationSection({
  title,
  items,
  muted,
  delayStart = 0,
}: NotificationSectionProps) {
  if (!items.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <AppText variant="monoSmall" color={muted ? theme.colors.mutedLight : theme.colors.muted}>
        {title}
      </AppText>
      <View style={styles.list}>
        {items.map((item, index) => (
          <RevealView delay={delayStart + index * 80} key={item.id}>
            <NotificationCard item={item} />
          </RevealView>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.sm,
  },
  list: {
    gap: theme.spacing.sm,
  },
});
