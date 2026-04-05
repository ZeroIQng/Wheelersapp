import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ProgressDots } from '@/components/progress-dots';
import { theme } from '@/theme';

type FlowHeaderProps = {
  overline?: string;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  progress?: {
    count: number;
    active: number;
    dark?: boolean;
  };
  light?: boolean;
};

export function FlowHeader({
  overline,
  title,
  subtitle,
  showBack,
  progress,
  light,
}: FlowHeaderProps) {
  const router = useRouter();
  const accent = light ? theme.colors.offWhite : theme.colors.black;
  const muted = light ? '#8F8A86' : theme.colors.muted;

  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <View style={styles.backSlot}>
          {showBack ? (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <AppText variant="h3" color={accent}>
                ←
              </AppText>
            </Pressable>
          ) : null}
        </View>
        {progress ? (
          <ProgressDots
            count={progress.count}
            active={progress.active}
            activeColor={light ? theme.colors.orange : theme.colors.orange}
            inactiveColor={light ? '#2B2B2B' : theme.colors.offWhite}
          />
        ) : null}
      </View>
      {overline ? (
        <AppText variant="monoSmall" color={muted} style={styles.overline}>
          {overline}
        </AppText>
      ) : null}
      <AppText variant="h1" color={accent}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="bodySmall" color={muted} style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
  },
  backSlot: {
    minWidth: 32,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overline: {
    letterSpacing: 1,
  },
  subtitle: {
    maxWidth: 300,
  },
});
