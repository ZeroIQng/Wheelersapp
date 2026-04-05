import { Platform, TextStyle, ViewStyle } from 'react-native';

const colors = {
  orange: '#FF5C00',
  orangeLight: '#FFF0E8',
  black: '#0D0D0D',
  offWhite: '#FFFAF5',
  green: '#00C48C',
  white: '#FFFFFF',
  muted: '#786F68',
  mutedLight: '#B5ACA4',
  borderLight: '#E8DDD3',
  danger: '#CC3333',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
  gutter: 20,
};

const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

const borders = {
  thick: 2.5,
  regular: 1.5,
};

const shadowBase: ViewStyle = {
  shadowColor: colors.black,
  shadowOffset: {
    width: 3,
    height: 3,
  },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 5,
};

const shadows = {
  card: shadowBase,
  subtle: {
    ...shadowBase,
    shadowOffset: {
      width: 2,
      height: 2,
    },
    elevation: 3,
  },
};

const typography = {
  display: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: -1.3,
  } satisfies TextStyle,
  h1: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.9,
  } satisfies TextStyle,
  h2: {
    fontFamily: 'Syne_700Bold',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
  } satisfies TextStyle,
  h3: {
    fontFamily: 'Syne_700Bold',
    fontSize: 17,
    lineHeight: 20,
  } satisfies TextStyle,
  body: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  } satisfies TextStyle,
  bodyMedium: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
  } satisfies TextStyle,
  bodySmall: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    lineHeight: 16,
  } satisfies TextStyle,
  label: {
    fontFamily: 'Syne_700Bold',
    fontSize: 13,
    lineHeight: 16,
  } satisfies TextStyle,
  mono: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 13,
    lineHeight: 18,
  } satisfies TextStyle,
  monoSmall: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.6,
  } satisfies TextStyle,
  monoLarge: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 20,
    lineHeight: 24,
  } satisfies TextStyle,
};

export const theme = {
  colors,
  spacing,
  radius,
  borders,
  shadows,
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
