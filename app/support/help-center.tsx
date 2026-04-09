import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { DecorativeBackground } from '@/components/DecorativeBackground';
import { HelpTopicRow } from '@/components/HelpTopicRow';
import { SearchField } from '@/components/SearchField';
import { helpCenter } from '@/data/mock';
import { theme } from '@/theme';

export default function HelpCenterScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <DecorativeBackground motif="help" />
      <View style={styles.headerRow}>
        <BackArrow />
        <AppText variant="screenTitle">Help Center</AppText>
      </View>

      <SearchField onChangeText={setQuery} placeholder={helpCenter.searchPlaceholder} value={query} />

      <View style={styles.section}>
        <AppText variant="monoSmall" color={theme.colors.muted}>
          POPULAR TOPICS
        </AppText>
        <View>
          {helpCenter.topics.map((topic) => (
            <HelpTopicRow key={topic.id} topic={topic} />
          ))}
        </View>
      </View>

      <AppButton onPress={() => router.push('/support/chat' as Href)} title="Chat with support ↗" />
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
  section: {
    gap: theme.spacing.sm,
  },
});
