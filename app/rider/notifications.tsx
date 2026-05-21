import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { DecorativeBackground } from '@/components/DecorativeBackground';
import { NotificationSection } from '@/components/NotificationSection';
import type { NotificationItem } from '@/data/mock';
import { useAppNotifications } from '@/lib/notifications';
import { theme } from '@/theme';

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, 'day');
}

function mapCategoryToAccent(category: string): NotificationItem['accent'] {
  if (category === 'wallet' || category === 'payment' || category === 'defi') {
    return 'green';
  }

  if (category === 'ride') {
    return 'orange';
  }

  return 'black';
}

function mapCategoryToIcon(category: string): string {
  if (category === 'wallet' || category === 'payment') {
    return '💰';
  }

  if (category === 'ride') {
    return '🚗';
  }

  if (category === 'kyc') {
    return '🪪';
  }

  return '🔔';
}

export default function NotificationsScreen() {
  const { markAllRead, notifications } = useAppNotifications();
  const items = useMemo<NotificationItem[]>(
    () =>
      notifications.map((item) => ({
        id: item.id,
        icon: mapCategoryToIcon(item.category),
        title: item.title,
        message: item.body,
        timestamp: formatRelativeTime(item.createdAt),
        unread: !item.read,
        accent: mapCategoryToAccent(item.category),
      })),
    [notifications],
  );
  const unread = useMemo(
    () => items.filter((item) => item.unread),
    [items],
  );
  const earlier = useMemo(
    () => items.filter((item) => !item.unread),
    [items],
  );

  async function handleMarkAllRead() {
    await markAllRead();
  }

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <DecorativeBackground motif="notifications" />
      <View style={styles.headerRow}>
        <BackArrow />
        <View style={styles.headerCopy}>
          <AppText variant="screenTitle">Notifications</AppText>
        </View>
        <Pressable onPress={handleMarkAllRead}>
          <AppText variant="monoSmall" color={theme.colors.orange}>
            Mark all read
          </AppText>
        </Pressable>
      </View>

      <NotificationSection delayStart={40} items={unread} title="NEW" />
      <NotificationSection delayStart={180} items={earlier} muted title="EARLIER" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
});
