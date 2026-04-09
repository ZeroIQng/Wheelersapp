import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { ChatBubble } from '@/components/ChatBubble';
import { ChatComposer } from '@/components/ChatComposer';
import { DecorativeBackground } from '@/components/DecorativeBackground';
import { RevealView } from '@/components/motion';
import { supportChat } from '@/data/mock';
import { theme } from '@/theme';

export default function SupportChatScreen() {
  const [draft, setDraft] = useState('');

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <View style={styles.header}>
        <DecorativeBackground motif="support" />
        <BackArrow />
        <View style={styles.avatar}>
          <AppText variant="body">{supportChat.avatar}</AppText>
        </View>
        <View style={styles.headerCopy}>
          <AppText variant="label">{supportChat.agentName}</AppText>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <AppText variant="bodySmall" color={theme.colors.green}>
              {supportChat.status}
            </AppText>
          </View>
        </View>
      </View>

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {supportChat.messages.map((message, index) => (
          <RevealView delay={index * 90} key={message.id}>
            <ChatBubble avatar={supportChat.avatar} message={message} />
          </RevealView>
        ))}

        <View style={styles.chips}>
          {supportChat.quickReplies.map((reply) => (
            <Pressable
              key={reply}
              onPress={() => setDraft(reply)}
              style={[
                styles.chip,
                reply === supportChat.quickReplies[0] ? styles.primaryChip : styles.secondaryChip,
              ]}>
              <AppText
                variant="bodySmall"
                color={reply === supportChat.quickReplies[0] ? theme.colors.orange : theme.colors.muted}>
                {reply}
              </AppText>
            </Pressable>
          ))}
        </View>

        {supportChat.typing ? (
          <RevealView delay={360}>
            <ChatBubble avatar={supportChat.avatar} typing />
          </RevealView>
        ) : null}
      </ScrollView>

      <ChatComposer onChangeText={setDraft} onSend={() => setDraft('')} value={draft} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.gutter,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: theme.borders.thick,
    borderBottomColor: theme.colors.black,
    overflow: 'hidden',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.green,
  },
  messages: {
    paddingHorizontal: theme.spacing.gutter,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  chip: {
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  primaryChip: {
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.orange,
  },
  secondaryChip: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.borderLight,
  },
});
