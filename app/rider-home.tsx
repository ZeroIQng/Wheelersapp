import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';

import { BackArrow } from '@/components/back-arrow';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { TriangleShape, StarBurst } from '@/components/decorative-shapes';
import { FloatingView, PulseView, RevealView } from '@/components/motion';
import { StaticMap, MapPin } from '@/components/static-map';
import { quickPlaces, walletBalance } from '@/data/mock';
import { theme } from '@/theme';

export default function RiderHomeScreen() {
  const router = useRouter();

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor="#D4E6D4" />
      <RevealView style={styles.mapWrap}>
        <StaticMap height={380}>
          <MapPin centered />
          <FloatingView style={styles.triangle} distance={12} rotate={8}>
            <TriangleShape color="rgba(255,92,0,0.15)" />
          </FloatingView>
          <FloatingView style={styles.star} delay={180} distance={10} rotate={-10}>
            <StarBurst color="rgba(13,13,13,0.12)" width={38} height={38} />
          </FloatingView>
          <View style={styles.mapTopRow}>
            <View style={styles.titleRow}>
              <BackArrow style={styles.backButton} />
              <AppText variant="h2">Wheleers</AppText>
            </View>
            <FloatingView style={styles.balance} distance={6}>
              <AppText variant="monoSmall">{walletBalance}</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                USDT
              </AppText>
            </FloatingView>
          </View>
        </StaticMap>
      </RevealView>

      <RevealView delay={120} style={styles.sheet}>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          Where to?
        </AppText>
        <PulseView>
          <Pressable onPress={() => router.push('/destination-search')} style={styles.searchBox}>
            <AppText variant="body" color="#B0A79F">
              Search destination...
            </AppText>
          </Pressable>
        </PulseView>
        <View style={styles.quickRow}>
          {quickPlaces.map((place, index) => (
            <RevealView key={place.id} delay={180 + index * 70} style={styles.quickSlot}>
              <Pressable
                onPress={() => router.push('/destination-search')}
                style={styles.quickChip}>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  {place.emoji} {place.label}
                </AppText>
              </Pressable>
            </RevealView>
          ))}
        </View>
      </RevealView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  mapWrap: {
    flex: 1,
  },
  mapTopRow: {
    position: 'absolute',
    top: 14,
    left: theme.spacing.gutter,
    right: theme.spacing.gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  backButton: {
    width: 34,
    height: 34,
  },
  balance: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    ...theme.shadows.card,
  },
  triangle: {
    position: 'absolute',
    top: '22%',
    left: '18%',
  },
  star: {
    position: 'absolute',
    right: '6%',
    bottom: '10%',
  },
  sheet: {
    borderTopWidth: theme.borders.thick,
    borderTopColor: theme.colors.black,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    backgroundColor: theme.colors.offWhite,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  searchBox: {
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.card,
  },
  quickRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  quickSlot: {
    flex: 1,
  },
  quickChip: {
    flex: 1,
    borderWidth: theme.borders.regular,
    borderColor: '#DDD1C7',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
});
