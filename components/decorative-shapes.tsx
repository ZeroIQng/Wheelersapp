import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Rect } from 'react-native-svg';

type ShapeProps = {
  color: string;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function BlobShape({ color, width = 120, height = 120, style }: ShapeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 130 130" style={style}>
      <Path
        d="M65 10C90 10 118 28 120 55C122 82 100 110 72 118C44 126 14 108 8 80C2 52 20 18 65 10Z"
        fill={color}
      />
    </Svg>
  );
}

export function StarBurst({ color, width = 54, height = 54, style }: ShapeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 54 54" style={style}>
      <Path
        d="M27 4L30.5 22 46 8 33.5 22 52 27 33.5 32 46 46 30.5 32 27 50 23.5 32 8 46 20.5 32 2 27 20.5 22 8 8 23.5 22Z"
        fill={color}
      />
    </Svg>
  );
}

export function RingStack({ color, width = 120, height = 120, style }: ShapeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 140 140" style={style}>
      <Circle cx="70" cy="70" r="65" fill="none" stroke={color} strokeWidth="3" />
      <Circle cx="70" cy="70" r="48" fill="none" stroke={color} strokeWidth="2" />
      <Circle cx="70" cy="70" r="30" fill="none" stroke={color} strokeWidth="1.5" />
    </Svg>
  );
}

export function DiamondPair({ color, width = 36, height = 36, style }: ShapeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 36 36" style={style}>
      <Rect x="12" y="2" width="12" height="12" transform="rotate(45 18 8)" fill={color} />
      <Rect x="12" y="20" width="10" height="10" transform="rotate(45 17 25)" fill={color} opacity="0.6" />
    </Svg>
  );
}

export function DottedGrid({ color, width = 120, height = 120, style }: ShapeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 120" style={style}>
      {Array.from({ length: 8 }).map((_, row) =>
        Array.from({ length: 8 }).map((__, column) => (
          <Circle
            key={`${row}-${column}`}
            cx={8 + column * 14}
            cy={8 + row * 14}
            r="1.5"
            fill={color}
          />
        ))
      )}
    </Svg>
  );
}

export function WaveLine({ color, width = 280, height = 50, style }: ShapeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 280 50" style={style}>
      <Path
        d="M0 30Q35 10 70 30Q105 50 140 30Q175 10 210 30Q245 50 280 30"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
      />
    </Svg>
  );
}

export function CrossShape({ color, width = 40, height = 40, style }: ShapeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 40 40" style={style}>
      <Line x1="20" y1="2" x2="20" y2="38" stroke={color} strokeWidth="2.5" strokeDasharray="4 3" />
      <Line x1="2" y1="20" x2="38" y2="20" stroke={color} strokeWidth="2.5" strokeDasharray="4 3" />
    </Svg>
  );
}

export function GearOutline({ color, width = 60, height = 60, style }: ShapeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 60 60" style={style}>
      <Path
        d="M30 8L33 2 37 8 43 5 43 12 50 12 47 18 54 22 50 28 54 34 47 38 50 44 43 44 43 51 37 48 33 54 30 48 27 54 23 48 17 51 17 44 10 44 13 38 6 34 10 28 6 22 13 18 10 12 17 12 17 5 23 8 27 2Z"
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
      <Circle cx="30" cy="30" r="8" fill="none" stroke={color} strokeWidth="1.5" />
    </Svg>
  );
}

export function TriangleShape({ color, width = 30, height = 30, style }: ShapeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 30 30" style={style}>
      <Polygon points="15,2 28,26 2,26" fill={color} />
    </Svg>
  );
}
