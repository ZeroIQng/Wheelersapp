import { useRouter } from 'expo-router';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { theme } from '@/theme';

type BackArrowProps = {
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  light?: boolean;
};

export function BackArrow({ style, onPress, light }: BackArrowProps) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => router.back())}
      style={[
        styles.button,
        {
          backgroundColor: light ? 'rgba(255,255,255,0.18)' : theme.colors.white,
          borderColor: light ? theme.colors.white : theme.colors.black,
        },
        style,
      ]}>
      <AppText variant="h3" color={light ? theme.colors.white : theme.colors.black}>
        ←
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
});
