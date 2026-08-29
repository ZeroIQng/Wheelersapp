/**
 * The Wheelers splash palette, sampled from the brand artwork.
 *
 * These are the colours the app opens on, so screens that should feel like a
 * continuation of the splash (onboarding, sign-in) pull from here rather than
 * the orange-led defaults in the app theme.
 */
export const brand = {
  /** Cream backdrop of the light splash artwork. */
  cream: "#FEFAEF",
  /** Charcoal backdrop of the dark splash artwork. */
  charcoal: "#202020",
  /** Wordmark ink on the light artwork. */
  ink: "#0D0D0D",
  /** Wordmark ink on the dark artwork. */
  inkOnDark: "#FF7700",
  /** Hairline that reads correctly on the cream backdrop. */
  hairline: "#E6DFD2",
  /** Muted body copy on the cream backdrop. */
  muted: "#786F68",
} as const;

export const splashVariantPalette = {
  light: { background: brand.cream, statusBar: "dark" as const },
  dark: { background: brand.charcoal, statusBar: "light" as const },
} as const;
