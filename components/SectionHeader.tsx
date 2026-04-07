import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { theme } from '@/theme';

type TitleVariant = 'h1' | 'h2' | 'h3';

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  titleVariant?: TitleVariant;
  actionLabel?: string;
  onActionPress?: () => void;
  light?: boolean;
};

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  titleVariant = 'h2',
  actionLabel,
  onActionPress,
  light,
}: SectionHeaderProps) {
  const titleColor = light ? theme.colors.offWhite : theme.colors.black;
  const mutedColor = light ? 'rgba(255,255,255,0.72)' : theme.colors.muted;

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.copy}>
          {eyebrow ? (
            <AppText variant="monoSmall" color={mutedColor}>
              {eyebrow}
            </AppText>
          ) : null}
          <AppText variant={titleVariant} color={titleColor}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="bodySmall" color={mutedColor}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {actionLabel ? (
          <Pressable onPress={onActionPress} style={styles.action}>
            <AppText variant="monoSmall" color={light ? theme.colors.offWhite : theme.colors.orange}>
              {actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  action: {
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
});
