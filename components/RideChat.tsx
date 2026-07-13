import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { ChatComposer } from '@/components/ChatComposer';
import { useAuth } from '@/lib/auth';
import { getAccessTokenWithRetry } from '@/lib/access-token';
import { getRideChatMessages, type ChatMessageResponse } from '@/lib/api';
import { theme } from '@/theme';

type ChatMsg = {
  id: string;
  senderId: string;
  senderRole: 'RIDER' | 'DRIVER';
  content: string;
  createdAt: string;
};

type RideChatProps = {
  visible: boolean;
  onClose: () => void;
  rideId: string;
  /** WS-received messages from the session provider */
  realtimeMessages: ChatMsg[];
  /** Sends a chat message over WebSocket */
  onSend: (rideId: string, content: string) => Promise<void>;
  /** The current user's role in this ride */
  userRole: 'RIDER' | 'DRIVER';
};

export function RideChat({
  visible,
  onClose,
  rideId,
  realtimeMessages,
  onSend,
  userRole,
}: RideChatProps) {
  const { getAccessToken } = useAuth();
  const [historyMessages, setHistoryMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const loadedRef = useRef(false);

  // Load chat history when opened
  useEffect(() => {
    if (!visible || loadedRef.current) return;
    loadedRef.current = true;

    void (async () => {
      try {
        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken) return;
        const data = await getRideChatMessages({ accessToken, rideId, limit: 50 });
        setHistoryMessages(
          data.items.map((m: ChatMessageResponse) => ({
            id: m.id,
            senderId: m.senderId,
            senderRole: m.senderRole,
            content: m.content,
            createdAt: m.createdAt,
          })),
        );
      } catch {
        // non-blocking
      }
    })();
  }, [visible, rideId, getAccessToken]);

  // Merge history + realtime, deduplicate by id
  const allMessages = [...historyMessages, ...realtimeMessages].reduce<ChatMsg[]>(
    (acc, msg) => {
      if (!acc.some((m) => m.id === msg.id)) acc.push(msg);
      return acc;
    },
    [],
  );
  allMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      await onSend(rideId, text);
    } catch {
      // ignore — message may still appear via WS
    } finally {
      setSending(false);
    }
  };

  const isSelf = (msg: ChatMsg) => msg.senderRole === userRole;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <View style={styles.header}>
          <AppText variant="h3">Ride chat</AppText>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <AppText variant="bodyMedium">Close</AppText>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={allMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const self = isSelf(item);
            return (
              <View style={[styles.bubbleRow, self ? styles.rowEnd : styles.rowStart]}>
                <View style={[styles.bubble, self ? styles.selfBubble : styles.otherBubble]}>
                  <AppText
                    variant="bodySmall"
                    color={self ? theme.colors.white : theme.colors.black}
                    style={styles.messageText}>
                    {item.content}
                  </AppText>
                  <AppText
                    variant="monoSmall"
                    color={self ? 'rgba(255,255,255,0.68)' : theme.colors.mutedLight}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </AppText>
                </View>
              </View>
            );
          }}
        />

        <ChatComposer value={draft} onChangeText={setDraft} onSend={handleSend} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: theme.borders.thick,
    borderBottomColor: theme.colors.black,
  },
  closeButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  messageList: {
    paddingHorizontal: theme.spacing.gutter,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.xs,
  },
  rowStart: {
    justifyContent: 'flex-start',
  },
  rowEnd: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 4,
    ...theme.shadows.card,
  },
  selfBubble: {
    backgroundColor: theme.colors.orange,
    borderTopLeftRadius: theme.radii.sm,
    borderTopRightRadius: theme.radii.sm,
    borderBottomLeftRadius: theme.radii.sm,
    borderBottomRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.radii.sm,
    borderTopRightRadius: theme.radii.sm,
    borderBottomRightRadius: theme.radii.sm,
    borderBottomLeftRadius: 2,
  },
  messageText: {
    lineHeight: 17,
  },
});
