import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { theme } from '@/theme';

type ChatComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend?: () => void;
};

export function ChatComposer({ value, onChangeText, onSend }: ChatComposerProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.inputWrap}>
        <TextInput
          onChangeText={onChangeText}
          placeholder="Type a message..."
          placeholderTextColor="#C9C1BA"
          style={styles.input}
          value={value}
        />
      </View>
      <Pressable onPress={onSend} style={styles.sendButton}>
        <AppText variant="h3" color={theme.colors.white}>
          ↗
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.gutter,
    paddingVertical: theme.spacing.md,
    borderTopWidth: theme.borders.thick,
    borderTopColor: theme.colors.black,
    backgroundColor: theme.colors.offWhite,
  },
  inputWrap: {
    flex: 1,
    minHeight: 46,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  input: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.black,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
});
