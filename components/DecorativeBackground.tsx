import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Rect } from 'react-native-svg';

import { FloatingView } from '@/components/motion';

type Motif =
  | 'notifications'
  | 'profile'
  | 'support'
  | 'docs'
  | 'token'
  | 'referral'
  | 'promos'
  | 'help'
  | 'emergency'
  | 'roleSwitcher';

type DecorativeBackgroundProps = {
  motif: Motif;
  dark?: boolean;
};

export function DecorativeBackground({ motif, dark }: DecorativeBackgroundProps) {
  const stroke = dark ? 'rgba(255,255,255,0.16)' : 'rgba(13,13,13,0.08)';
  const accent = dark ? 'rgba(255,92,0,0.24)' : 'rgba(255,92,0,0.12)';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {motif === 'notifications' ? (
        <>
          <FloatingView delay={80} rotate={8} style={styles.topRight}>
            <Svg height={80} viewBox="0 0 72 72" width={80}>
              <Polygon
                fill="none"
                points="36,4 62,18 62,46 36,60 10,46 10,18"
                stroke={accent}
                strokeWidth="2.5"
              />
              <Polygon
                fill="none"
                points="36,12 56,22 56,44 36,54 16,44 16,22"
                stroke={stroke}
                strokeWidth="1.8"
              />
              <Circle cx="36" cy="36" fill={accent} opacity="0.4" r="3.5" />
              <Circle cx="36" cy="36" fill="none" r="9" stroke={accent} strokeWidth="2" />
            </Svg>
          </FloatingView>
          <FloatingView delay={160} distance={6} style={styles.bottomLeft}>
            <Svg height={44} viewBox="0 0 60 40" width={66}>
              <Path
                d="M4 36 Q30 4,56 36"
                fill="none"
                stroke={stroke}
                strokeDasharray="3 4"
                strokeWidth="2"
              />
              <Circle cx="4" cy="36" fill={stroke} r="3" />
              <Circle cx="30" cy="10" fill={accent} r="3" />
              <Circle cx="56" cy="36" fill={stroke} r="3" />
            </Svg>
          </FloatingView>
        </>
      ) : null}
      {motif === 'profile' ? (
        <Svg height="100%" style={styles.full} viewBox="0 0 320 220" width="100%">
          {Array.from({ length: 8 }).map((_, index) => {
            const x = index * 44;
            return (
              <Polygon
                fill={accent}
                key={index}
                opacity={index % 2 === 0 ? '0.7' : '0.36'}
                points={`${x},120 ${x + 22},84 ${x + 44},120`}
              />
            );
          })}
          {Array.from({ length: 8 }).map((_, index) => {
            const x = index * 44;
            return (
              <Polygon
                fill={accent}
                key={`top-${index}`}
                opacity={index % 2 === 0 ? '0.26' : '0.14'}
                points={`${x},76 ${x + 22},40 ${x + 44},76`}
              />
            );
          })}
        </Svg>
      ) : null}
      {motif === 'support' ? (
        <>
          <FloatingView rotate={10} style={styles.topRightSmall}>
            <Svg height={52} viewBox="0 0 40 40" width={52}>
              <Path
                d="M20 4 C32 4,36 12,36 20 C36 28,28 36,20 36 C12 36,4 28,4 20 C4 12,8 8,20 8 C28 8,34 14,34 20 C34 28,26 32,20 32 C14 32,10 26,10 20 C10 16,14 12,20 12"
                fill="none"
                stroke={accent}
                strokeWidth="1.8"
              />
            </Svg>
          </FloatingView>
          <FloatingView delay={180} distance={10} style={styles.bottomRight}>
            <Svg height={80} viewBox="0 0 160 80" width={160}>
              <Path
                d="M8 54 C34 22,56 24,84 44 C106 60,128 56,152 22"
                fill="none"
                stroke={stroke}
                strokeWidth="2"
              />
              <Circle cx="8" cy="54" fill={accent} r="3" />
              <Circle cx="84" cy="44" fill={accent} r="3" />
              <Circle cx="152" cy="22" fill={accent} r="3" />
            </Svg>
          </FloatingView>
        </>
      ) : null}
      {motif === 'docs' ? (
        <>
          <FloatingView rotate={8} style={styles.topRight}>
            <Svg height={72} viewBox="0 0 70 70" width={72}>
              <Rect fill={stroke} height="40" rx="3" width="14" x="28" y="5" />
              <Rect fill={accent} height="14" rx="3" width="60" x="5" y="5" />
              <Rect fill={accent} height="20" opacity="0.5" rx="2" width="16" x="14" y="45" />
              <Rect fill={stroke} height="20" opacity="0.5" rx="2" width="16" x="40" y="45" />
            </Svg>
          </FloatingView>
          <FloatingView delay={180} rotate={-12} style={styles.bottomLeft}>
            <Svg height={58} viewBox="0 0 56 56" width={58}>
              <Path
                d="M9 30c0-6 7-11 15-11s15 5 15 11-7 11-15 11S9 36 9 30Z"
                fill="none"
                stroke={accent}
                strokeWidth="2.5"
                transform="rotate(-28 24 30)"
              />
              <Path
                d="M17 30c0-6 7-11 15-11s15 5 15 11-7 11-15 11S17 36 17 30Z"
                fill="none"
                stroke={stroke}
                strokeWidth="2.5"
                transform="rotate(28 32 30)"
              />
            </Svg>
          </FloatingView>
        </>
      ) : null}
      {motif === 'token' ? (
        <>
          <FloatingView delay={60} style={styles.tokenOrbit}>
            <Svg height={72} viewBox="0 0 72 72" width={72}>
              <Circle cx="36" cy="36" fill="none" r="20" stroke={stroke} strokeWidth="1.5" />
              <Circle cx="52" cy="20" fill={accent} r="4" />
              <Circle cx="22" cy="54" fill={stroke} r="3" />
              <Circle cx="40" cy="42" fill={accent} opacity="0.4" r="8" />
            </Svg>
          </FloatingView>
          <FloatingView delay={160} distance={6} style={styles.bottomLeft}>
            <Svg height={34} viewBox="0 0 70 30" width={74}>
              {[10, 5, 14, 2, 8, 12, 6].map((y, index) => (
                <Rect
                  fill={accent}
                  height={30 - y}
                  key={index}
                  width="5"
                  x={2 + index * 9}
                  y={y}
                />
              ))}
            </Svg>
          </FloatingView>
        </>
      ) : null}
      {motif === 'referral' ? (
        <>
          <FloatingView rotate={8} style={styles.topRight}>
            <Svg height={86} viewBox="0 0 70 80" width={76}>
              <Circle cx="35" cy="10" fill="none" r="8" stroke={accent} strokeWidth="2" />
              <Line stroke={stroke} strokeWidth="2" x1="35" x2="35" y1="18" y2="35" />
              <Line stroke={stroke} strokeWidth="2" x1="35" x2="15" y1="35" y2="52" />
              <Line stroke={stroke} strokeWidth="2" x1="35" x2="55" y1="35" y2="52" />
              <Circle cx="15" cy="60" fill="none" r="7" stroke={accent} strokeWidth="2" />
              <Circle cx="55" cy="60" fill="none" r="7" stroke={accent} strokeWidth="2" />
            </Svg>
          </FloatingView>
          <FloatingView delay={220} rotate={-10} style={styles.bottomLeft}>
            <Svg height={52} viewBox="0 0 60 50" width={64}>
              <Polygon
                fill="none"
                points="15,2 25,2 30,10 25,18 15,18 10,10"
                stroke={accent}
                strokeWidth="1.5"
              />
              <Polygon
                fill="none"
                points="35,22 45,22 50,30 45,38 35,38 30,30"
                stroke={stroke}
                strokeWidth="1.5"
              />
            </Svg>
          </FloatingView>
        </>
      ) : null}
      {motif === 'promos' ? (
        <>
          <FloatingView rotate={12} style={styles.topRight}>
            <Svg height={86} viewBox="0 0 80 80" width={86}>
              <Circle
                cx="40"
                cy="40"
                fill="none"
                r="36"
                stroke={accent}
                strokeDasharray="4 5"
                strokeWidth="1.5"
              />
              <Circle
                cx="40"
                cy="40"
                fill="none"
                r="26"
                stroke={stroke}
                strokeDasharray="3 4"
                strokeWidth="1.5"
              />
              <Circle
                cx="40"
                cy="40"
                fill="none"
                r="16"
                stroke={accent}
                strokeDasharray="2 3"
                strokeWidth="2"
              />
            </Svg>
          </FloatingView>
          <FloatingView delay={140} style={styles.bottomLeft}>
            <Svg height={62} viewBox="0 0 50 60" width={54}>
              <Path
                d="M10 5 C30 5,40 20,25 30 C10 40,20 55,40 55"
                fill="none"
                stroke={accent}
                strokeLinecap="round"
                strokeWidth="3"
              />
              <Path
                d="M40 5 C20 5,10 20,25 30 C40 40,30 55,10 55"
                fill="none"
                stroke={stroke}
                strokeLinecap="round"
                strokeWidth="2"
              />
            </Svg>
          </FloatingView>
        </>
      ) : null}
      {motif === 'help' ? (
        <>
          <FloatingView rotate={8} style={styles.topRight}>
            <Svg height={74} viewBox="0 0 70 70" width={74}>
              <Path d="M35 6L62 54H8L35 6Z" fill="none" stroke={accent} strokeWidth="2.5" />
              <Path d="M35 18L54 52H16L35 18Z" fill="none" stroke={stroke} strokeWidth="1.5" />
            </Svg>
          </FloatingView>
          <FloatingView delay={180} style={styles.bottomLeft}>
            <Svg height={70} viewBox="0 0 40 70" width={44}>
              <Path
                d="M20 5 C35 5,35 15,20 15 C5 15,5 25,20 25 C35 25,35 35,20 35 C5 35,5 45,20 45 C35 45,35 55,20 55 C5 55,5 65,20 65"
                fill="none"
                stroke={accent}
                strokeLinecap="round"
                strokeWidth="2.5"
              />
            </Svg>
          </FloatingView>
        </>
      ) : null}
      {motif === 'emergency' ? (
        <>
          <FloatingView rotate={8} style={styles.topRight}>
            <Svg height={72} viewBox="0 0 60 70" width={64}>
              <Path
                d="M30 4L54 14V36C54 50,42 62,30 66C18 62,6 50,6 36V14Z"
                fill="none"
                stroke={stroke}
                strokeWidth="2"
              />
              <Path
                d="M30 12L46 20V38C46 48,38 56,30 60C22 56,14 48,14 38V20Z"
                fill="none"
                stroke={accent}
                strokeWidth="2"
              />
            </Svg>
          </FloatingView>
          <FloatingView delay={180} rotate={-14} style={styles.bottomLeft}>
            <Svg height={54} viewBox="0 0 50 50" width={54}>
              <Circle cx="25" cy="25" fill="none" r="10" stroke={accent} strokeWidth="2" />
              {[
                [25, 5, 25, 12],
                [25, 38, 25, 45],
                [5, 25, 12, 25],
                [38, 25, 45, 25],
                [10, 10, 15, 15],
                [35, 35, 40, 40],
                [40, 10, 35, 15],
                [15, 35, 10, 40],
              ].map(([x1, y1, x2, y2], index) => (
                <Line
                  key={index}
                  stroke={accent}
                  strokeLinecap="round"
                  strokeWidth="2"
                  x1={x1}
                  x2={x2}
                  y1={y1}
                  y2={y2}
                />
              ))}
            </Svg>
          </FloatingView>
        </>
      ) : null}
      {motif === 'roleSwitcher' ? (
        <>
          <FloatingView rotate={12} style={styles.topRight}>
            <Svg height={76} viewBox="0 0 70 70" width={76}>
              <Path
                d="M20 35 C20 20,35 10,50 20 L44 26 L56 14 L56 34 L36 34 L44 26"
                fill="none"
                stroke={accent}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
              <Path
                d="M50 35 C50 50,35 60,20 50 L26 44 L14 56 L14 36 L34 36 L26 44"
                fill="none"
                stroke={stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </Svg>
          </FloatingView>
          <Svg height={80} style={styles.bottomLeftHatch} viewBox="0 0 70 70" width={80}>
            {Array.from({ length: 9 }).map((_, index) => (
              <Line
                key={index}
                stroke={accent}
                strokeWidth="2"
                x1={index * 10 - 10}
                x2={index * 10 + 20}
                y1="70"
                y2="0"
              />
            ))}
          </Svg>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  topRight: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  topRightSmall: {
    position: 'absolute',
    top: 8,
    right: 12,
  },
  bottomLeft: {
    position: 'absolute',
    left: 10,
    bottom: 18,
  },
  bottomRight: {
    position: 'absolute',
    right: 12,
    bottom: 92,
  },
  tokenOrbit: {
    position: 'absolute',
    top: 24,
    right: 20,
  },
  bottomLeftHatch: {
    position: 'absolute',
    bottom: 18,
    left: 8,
    opacity: 0.06,
  },
});
