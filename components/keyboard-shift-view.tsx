import { PropsWithChildren } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { useKeyboardHeight } from '@/hooks/use-keyboard';

type KeyboardShiftViewProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /** Extra clearance kept above the keyboard. */
  offset?: number;
}>;

/**
 * A View that shrinks its content box by the keyboard's height, so centered
 * or bottom-anchored children lift clear of it. For content rendered inside
 * a react-native `Modal`, which sits outside AppScreen and never receives
 * its keyboard inset — the reason modal inputs used to disappear behind the
 * keyboard.
 */
export function KeyboardShiftView({ children, style, offset = 0 }: KeyboardShiftViewProps) {
  const keyboardHeight = useKeyboardHeight();
  return (
    <View style={[style, keyboardHeight > 0 ? { paddingBottom: keyboardHeight + offset } : null]}>
      {children}
    </View>
  );
}
