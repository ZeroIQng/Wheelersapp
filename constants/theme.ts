import { Platform, TextStyle, ViewStyle } from 'react-native';

const colors = {
  orange: '#FF5C00',
  orangeLight: '#FFF0E8',
  black: '#0D0D0D',
  offWhite: '#FFFAF5',
  green: '#00C48C',
  red: '#FF3333',
  white: '#FFFFFF',
  muted: '#786F68',
  mutedLight: '#B5ACA4',
  borderLight: '#E8DDD3',
  danger: '#CC3333',
  dangerLight: '#FFF0F0',
  warning: '#F59E0B',
  successLight: '#E8FFF7',
  darkSurface: '#111111',
  darkSurfaceSoft: '#1A1A1A',
  darkBorder: '#333333',
  darkMuted: '#8E8882',
  mapBase: '#D4E6D4',
  mapBlock: 'rgba(185,208,185,0.85)',
  mapRoad: 'rgba(255,255,255,0.62)',
} as const;

const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
  gutter: 20,
} as const;

const radii = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

const borderWidths = {
  thick: 2.5,
  regular: 1.5,
} as const;

const cardShadow: ViewStyle = {
  shadowColor: colors.black,
  shadowOffset: {
    width: 3,
    height: 3,
  },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 5,
};

const subtleShadow: ViewStyle = {
  ...cardShadow,
  shadowOffset: {
    width: 2,
    height: 2,
  },
  elevation: 3,
};

const shadowPresets = {
  card: cardShadow,
  subtle: subtleShadow,
} as const;

const status = {
  live: colors.green,
  urgent: colors.red,
  pending: colors.warning,
  inactive: colors.mutedLight,
} as const;

const cardVariants = {
  default: {
    backgroundColor: colors.white,
    borderColor: colors.black,
  },
  accent: {
    backgroundColor: colors.orangeLight,
    borderColor: colors.orange,
  },
  muted: {
    backgroundColor: '#F5F2ED',
    borderColor: colors.borderLight,
  },
  dark: {
    backgroundColor: colors.darkSurface,
    borderColor: colors.darkBorder,
  },
  danger: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
  },
} as const;

const typography = {
  display: {
    fontFamily: 'ClashDisplay_700Bold',
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1,
  } satisfies TextStyle,
  h1: {
    fontFamily: 'ClashDisplay_700Bold',
    fontSize: 24,
    lineHeight: 27,
    letterSpacing: -0.7,
  } satisfies TextStyle,
  h2: {
    fontFamily: 'ClashDisplay_600Semibold',
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.3,
  } satisfies TextStyle,
  h3: {
    fontFamily: 'ClashDisplay_600Semibold',
    fontSize: 15,
    lineHeight: 18,
  } satisfies TextStyle,
  body: {
    fontFamily: 'ClashDisplay_400Regular',
    fontSize: 13,
    lineHeight: 18,
  } satisfies TextStyle,
  bodyMedium: {
    fontFamily: 'ClashDisplay_500Medium',
    fontSize: 13,
    lineHeight: 18,
  } satisfies TextStyle,
  bodySmall: {
    fontFamily: 'ClashDisplay_400Regular',
    fontSize: 10,
    lineHeight: 14,
  } satisfies TextStyle,
  label: {
    fontFamily: 'ClashDisplay_600Semibold',
    fontSize: 12,
    lineHeight: 15,
  } satisfies TextStyle,
  mono: {
    fontFamily: 'ClashDisplay_500Medium',
    fontSize: 12,
    lineHeight: 16,
  } satisfies TextStyle,
  monoSmall: {
    fontFamily: 'ClashDisplay_600Semibold',
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.45,
  } satisfies TextStyle,
  monoLarge: {
    fontFamily: 'ClashDisplay_700Bold',
    fontSize: 17,
    lineHeight: 20,
  } satisfies TextStyle,
  screenTitle: {
    fontFamily: 'ClashDisplay_700Bold',
    fontSize: 20,
    lineHeight: 23,
    letterSpacing: -0.4,
  } satisfies TextStyle,
  metric: {
    fontFamily: 'ClashDisplay_700Bold',
    fontSize: 24,
    lineHeight: 28,
  } satisfies TextStyle,
  caption: {
    fontFamily: 'ClashDisplay_500Medium',
    fontSize: 9,
    lineHeight: 12,
  } satisfies TextStyle,
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  radius: radii,
  borderWidths,
  borders: borderWidths,
  status,
  cardVariants,
  shadowPresets,
  shadows: shadowPresets,
  typography,
  layout: {
    screenPadding: spacing.gutter,
    maxWidth: 560,
    mapHeight: 280,
  },
  fonts: {
    heading: typography.h1.fontFamily,
    headingAlt: typography.h2.fontFamily,
    body: typography.body.fontFamily,
    bodyMedium: typography.bodyMedium.fontFamily,
    mono: typography.mono.fontFamily,
    monoBold: typography.monoSmall.fontFamily,
  },
  platform: {
    topPadding: Platform.select({
      android: 4,
      default: 0,
    }),
  },
} as const;

export type AppTheme = typeof theme;

export const Colors = {
  light: {
    text: theme.colors.black,
    background: theme.colors.offWhite,
    tint: theme.colors.orange,
    icon: theme.colors.muted,
    tabIconDefault: theme.colors.mutedLight,
    tabIconSelected: theme.colors.orange,
  },
  dark: {
    text: theme.colors.offWhite,
    background: theme.colors.black,
    tint: theme.colors.offWhite,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: theme.colors.offWhite,
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: theme.fonts.body,
    serif: theme.fonts.heading,
    rounded: theme.fonts.headingAlt,
    mono: theme.fonts.mono,
  },
  default: {
    sans: theme.fonts.body,
    serif: theme.fonts.heading,
    rounded: theme.fonts.headingAlt,
    mono: theme.fonts.mono,
  },
  web: {
    sans: theme.fonts.body,
    serif: theme.fonts.heading,
    rounded: theme.fonts.headingAlt,
    mono: theme.fonts.mono,
  },
});
