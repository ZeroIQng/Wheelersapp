import { PropsWithChildren, type ReactElement } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  type RefreshControlProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/theme-context';
import { theme } from '@/theme';

type AppScreenProps = PropsWithChildren<{
  backgroundColor?: string;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  safeAreaEdges?: Edge[];
  refreshControl?: ReactElement<RefreshControlProps>;
}>;

export function AppScreen({
  children,
  backgroundColor,
  scroll,
  contentStyle,
  safeAreaEdges,
  refreshControl,
}: AppScreenProps) {
  const { isDark } = useAppTheme();
  const resolvedBg = backgroundColor ?? (isDark ? theme.colors.black : theme.colors.offWhite);
  const containerStyle = [styles.content, contentStyle];

  return (
    <SafeAreaView
      edges={safeAreaEdges}
      style={[styles.safeArea, { backgroundColor: resolvedBg }]}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.flex}>
        {scroll ? (
          <ScrollView
            bounces={false}
            contentContainerStyle={containerStyle}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
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
