import { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

type AppScreenProps = PropsWithChildren<{
  backgroundColor?: string;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  safeAreaEdges?: Edge[];
}>;

export function AppScreen({
  children,
  backgroundColor = theme.colors.offWhite,
  scroll,
  contentStyle,
  safeAreaEdges,
}: AppScreenProps) {
  const containerStyle = [styles.content, contentStyle];

  return (
    <SafeAreaView
      edges={safeAreaEdges}
      style={[styles.safeArea, { backgroundColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.flex}>
        {scroll ? (
          <ScrollView
            bounces={false}
            contentContainerStyle={containerStyle}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={containerStyle}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: theme.layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.spacing.xl,
  },
});
