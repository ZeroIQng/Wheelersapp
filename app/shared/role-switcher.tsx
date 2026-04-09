import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { DecorativeBackground } from '@/components/DecorativeBackground';
import { ModeSwitchCard } from '@/components/ModeSwitchCard';
import { roleModes } from '@/data/mock';
import { theme } from '@/theme';

export default function RoleSwitcherScreen() {
  const [activeRole, setActiveRole] = useState<'rider' | 'driver'>(roleModes.activeRole);

  const current = roleModes.roles.find((role) => role.id === activeRole) ?? roleModes.roles[0];
  const target = roleModes.roles.find((role) => role.id !== activeRole) ?? roleModes.roles[1];

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <DecorativeBackground motif="roleSwitcher" />
      <View style={styles.header}>
        <BackArrow />
        <View style={styles.headerCopy}>
          <AppText variant="screenTitle">Switch Mode</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            You can be a rider and driver. Swap anytime.
          </AppText>
        </View>
      </View>

      <View style={styles.cards}>
        <ModeSwitchCard active role={current} />
        <View style={styles.switchVisual}>
          <AppText variant="h2" color={theme.colors.white}>
            ⇅
          </AppText>
        </View>
        <ModeSwitchCard onPress={() => setActiveRole(target.id)} role={target} target />
      </View>

      <AppButton onPress={() => setActiveRole(target.id)} title={`Switch to ${target.title} ↗`} />
      <AppText variant="bodySmall" color={theme.colors.mutedLight} style={styles.note}>
        {roleModes.reassurance}
      </AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  cards: {
    gap: theme.spacing.md,
  },
  switchVisual: {
    width: 42,
    height: 42,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    ...theme.shadows.card,
  },
  note: {
    textAlign: 'center',
  },
});
