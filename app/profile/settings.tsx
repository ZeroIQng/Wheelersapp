import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { ProfileHeaderCard } from '@/components/ProfileHeaderCard';
import { SettingsRow } from '@/components/SettingsRow';
import { settingsOptions } from '@/data/mock';
import { theme } from '@/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  function handleRowPress(id: string, route?: string) {
    if (route) {
      router.push(route as Href);
      return;
    }

    if (id === 'logout') {
      router.replace('/role-selection');
    }
  }

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="light" backgroundColor={theme.colors.black} />
      <View style={styles.fullBleed}>
        <ProfileHeaderCard />
      </View>

      <View style={styles.list}>
        {settingsOptions.map((item, index) => (
          <SettingsRow
            destructive={item.type === 'danger'}
            highlight={item.id === 'switch-driver'}
            icon={item.icon}
            key={item.id}
            onPress={
              item.type === 'navigation' || item.type === 'danger'
                ? () => handleRowPress(item.id, item.route)
                : undefined
            }
            onToggle={item.type === 'toggle' ? () => setNotificationsEnabled((current) => !current) : undefined}
            subtitle={item.subtitle}
            title={item.title}
            toggleValue={item.type === 'toggle' ? notificationsEnabled : undefined}
            value={item.type === 'value' ? item.value : undefined}
          />
        ))}
      </View>

      <AppButton
        onPress={() => router.push('/support/help-center' as Href)}
        title="Need help? Open Help Center ↗"
        variant="ghost"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    paddingBottom: theme.spacing.xxl,
  },
  fullBleed: {
    marginBottom: theme.spacing.md,
  },
  list: {
    paddingHorizontal: theme.spacing.gutter,
    marginBottom: theme.spacing.lg,
  },
});
