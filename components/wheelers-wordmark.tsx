import { useState } from "react";
import { Image, StyleProp, ImageStyle } from "react-native";

/**
 * The Wheelers wordmark, lifted from the brand splash artwork. Both files are
 * the same mark on a transparent background — they differ only in ink colour,
 * so either sits cleanly on any surface.
 */
const WORDMARK_INK = {
  black: require("../assets/images/splash-wordmark-light.png"),
  orange: require("../assets/images/splash-wordmark-dark.png"),
};

export type WordmarkInk = keyof typeof WORDMARK_INK;

// Intrinsic size of the exported artwork (787 x 165).
const WORDMARK_ASPECT = 787 / 165;

function pickInk(): WordmarkInk {
  return Math.random() < 0.5 ? "black" : "orange";
}

export function WheelersWordmark({
  width = 220,
  ink,
  style,
}: {
  width?: number;
  /** Pin the ink colour. Omit to let it alternate at random per mount. */
  ink?: WordmarkInk;
  style?: StyleProp<ImageStyle>;
}) {
  // Lazy initialiser so a re-render never reshuffles the mark mid-screen.
  const [randomInk] = useState(pickInk);
  const resolved = ink ?? randomInk;

  return (
    <Image
      accessibilityIgnoresInvertColors
      accessibilityLabel="Wheelers"
      resizeMode="contain"
      source={WORDMARK_INK[resolved]}
      style={[{ width, height: width / WORDMARK_ASPECT }, style]}
    />
  );
}
