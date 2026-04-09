import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { DecorativeBackground } from '@/components/DecorativeBackground';
import { EmergencyStatusCard } from '@/components/EmergencyStatusCard';
import { PulseView } from '@/components/motion';
import { emergencyState } from '@/data/mock';
import { theme } from '@/theme';

export default function EmergencyScreen() {
  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <DecorativeBackground motif="emergency" />
      <View style={styles.copy}>
        <AppText variant="monoSmall" color={theme.colors.muted}>
          {emergencyState.eyebrow}
        </AppText>
        <AppText variant="screenTitle" style={styles.title}>
          {emergencyState.title}
        </AppText>
        <AppText variant="bodySmall" color={theme.colors.muted} style={styles.subtitle}>
          {emergencyState.reassurance}
        </AppText>
      </View>

      <PulseView scaleTo={1.06} style={styles.pulseWrap}>
        <View style={styles.sosButton}>
          <AppText variant="metric" color={theme.colors.white}>
            🆘
          </AppText>
          <AppText variant="h3" color={theme.colors.white}>
            SOS
          </AppText>
        </View>
      </PulseView>

      <View style={styles.statusList}>
        {emergencyState.statuses.map((status) => (
          <EmergencyStatusCard key={status.id} status={status} />
        ))}
      </View>

      <AppButton title="Cancel emergency" variant="danger" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xxl,
  },
  copy: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 260,
  },
  pulseWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButton: {
    width: 120,
    height: 120,
    borderRadius: theme.radii.pill,
    borderWidth: 4,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  statusList: {
    width: '100%',
    gap: theme.spacing.sm,
  },
});
