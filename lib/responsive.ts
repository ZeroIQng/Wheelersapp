import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Responsive sizing helpers.
 *
 * Every value in the design system was drawn against a 390 x 844 phone
 * (iPhone 14 / Pixel 7 class). These helpers scale those numbers so the same
 * screen works on a 320pt iPhone SE, a 430pt Pro Max, a foldable and a tablet
 * without hard-coding per-device branches in each screen.
 */

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

/** Phones narrower than this need tightened spacing / smaller type. */
const SMALL_WIDTH = 360;
/** Phones shorter than this cannot fit "one screenful" layouts. */
const SHORT_HEIGHT = 700;
/** Shortest side at or above this is treated as a tablet. */
const TABLET_SHORTEST = 600;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type Responsive = {
  width: number;
  height: number;
  /** Shortest side — stable across rotation. */
  shortest: number;
  isSmall: boolean;
  isShort: boolean;
  isTablet: boolean;
  isLandscape: boolean;
  /** Horizontal screen padding for the current width. */
  gutter: number;
  /** Scale a layout value (paddings, icon boxes, radii). */
  scale: (size: number) => number;
  /** Scale a font size — damped so text never becomes unreadable. */
  font: (size: number) => number;
  /** A percentage of screen height, clamped to sane bounds. */
  vh: (percent: number, min?: number, max?: number) => number;
  /** Pick a value per size class. */
  pick: <T>(options: { small: T; base: T; tablet?: T }) => T;
};

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const shortest = Math.min(width, height);
    const longest = Math.max(width, height);
    const isLandscape = width > height;
    const isTablet = shortest >= TABLET_SHORTEST;
    const isSmall = shortest < SMALL_WIDTH;
    const isShort = longest < SHORT_HEIGHT;

    // Width ratio drives layout scaling, clamped so tablets don't get
    // comically large controls and tiny phones stay tappable.
    const widthRatio = clamp(shortest / BASE_WIDTH, 0.82, 1.15);
    // Fonts scale at half the rate of layout so line lengths stay readable.
    const fontRatio = clamp(1 + (shortest / BASE_WIDTH - 1) * 0.5, 0.88, 1.1);

    const scale = (size: number) => Math.round(size * widthRatio);
    const font = (size: number) => Math.round(size * fontRatio * 100) / 100;
    const vh = (percent: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
      Math.round(clamp((height * percent) / 100, min, max));

    return {
      width,
      height,
      shortest,
      isSmall,
      isShort,
      isTablet,
      isLandscape,
      gutter: isTablet ? 28 : isSmall ? 14 : 20,
      scale,
      font,
      vh,
      pick: <T,>({ small, base, tablet }: { small: T; base: T; tablet?: T }): T => {
        if (isTablet && tablet !== undefined) return tablet;
        return isSmall ? small : base;
      },
    };
  }, [width, height]);
}

/** Non-hook clamp export — handy inside style callbacks. */
export { clamp };

export const BREAKPOINTS = {
  smallWidth: SMALL_WIDTH,
  shortHeight: SHORT_HEIGHT,
  tabletShortest: TABLET_SHORTEST,
  baseWidth: BASE_WIDTH,
  baseHeight: BASE_HEIGHT,
} as const;
