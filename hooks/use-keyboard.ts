import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * Height of the on-screen keyboard, in points, or 0 when it is closed.
 *
 * We track it ourselves instead of relying on KeyboardAvoidingView because
 * that component only behaves on iOS: on Android (especially edge-to-edge,
 * which this app enables) `behavior="padding"` is a no-op and `"height"`
 * fights with `adjustResize`, so inputs end up under the keyboard.
 *
 * iOS uses the *WillShow* events so the layout animates with the keyboard;
 * Android only fires *DidShow* reliably.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const isIOS = Platform.OS === 'ios';

    const onShow = (event: KeyboardEvent) => {
      const screenHeight = Dimensions.get('screen').height;
      // endCoordinates.height is right on Android; on iOS derive it from the
      // frame so split/floating iPad keyboards report the real overlap.
      const overlap = isIOS
        ? screenHeight - event.endCoordinates.screenY
        : event.endCoordinates.height;
      setHeight(Math.max(0, Math.round(overlap)));
    };

    const onHide = () => setHeight(0);

    const showSub = Keyboard.addListener(
      isIOS ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
      onShow,
    );
    const hideSub = Keyboard.addListener(
      isIOS ? 'keyboardWillHide' : 'keyboardDidHide',
      onHide,
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}

/** True while the keyboard is on screen. */
export function useKeyboardVisible(): boolean {
  return useKeyboardHeight() > 0;
}
