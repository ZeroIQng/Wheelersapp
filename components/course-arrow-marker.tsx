import { Marker } from 'react-native-maps';
import Svg, { Circle, Path } from 'react-native-svg';

import { theme } from '@/theme';

/**
 * The driver on the map: a navigation arrow that rotates to the direction of
 * travel, replacing the anonymous blue dot. `flat` keeps it glued to the map
 * plane so the arrow turns with the road, not with the phone.
 */
export function CourseArrowMarker({
  coordinate,
  bearing,
}: {
  coordinate: { latitude: number; longitude: number };
  bearing: number;
}) {
  return (
    <Marker
      coordinate={coordinate}
      rotation={bearing}
      flat
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      zIndex={10}
    >
      <Svg width={44} height={44} viewBox="0 0 44 44">
        <Circle cx="22" cy="22" r="19" fill={theme.colors.black} stroke={theme.colors.white} strokeWidth="3" />
        <Path d="M22 9 L31 31 L22 25.5 L13 31 Z" fill={theme.colors.orange} stroke={theme.colors.offWhite} strokeWidth="1" />
      </Svg>
    </Marker>
  );
}
