import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { DecorativeBackground } from '@/components/DecorativeBackground';
import { NotificationSection } from '@/components/NotificationSection';
import { notificationsFeed, NotificationItem } from '@/data/mock';
import { theme } from '@/theme';

export default function NotificationsScreen() {
  const [unread, setUnread] = useState<NotificationItem[]>([...notificationsFeed.unread]);
  const [earlier, setEarlier] = useState<NotificationItem[]>([...notificationsFeed.earlier]);

  function handleMarkAllRead() {
    if (!unread.length) {
      return;
    }

    const moved = unread.map((item) => ({ ...item, unread: false }));
    setEarlier([...moved, ...earlier]);
    setUnread([]);
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
