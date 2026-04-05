import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { StaticMap, MapPin } from '@/components/static-map';
import { TriangleShape, StarBurst } from '@/components/decorative-shapes';
import { quickPlaces, walletBalance } from '@/data/mock';
import { theme } from '@/theme';

export default function RiderHomeScreen() {
  const router = useRouter();

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor="#D4E6D4" />
      <View style={styles.mapWrap}>
        <StaticMap height={380}>
          <MapPin centered />
          <TriangleShape color="rgba(255,92,0,0.15)" style={styles.triangle} />
          <StarBurst color="rgba(13,13,13,0.12)" width={38} height={38} style={styles.star} />
          <View style={styles.mapTopRow}>
            <AppText variant="h2">Wheleers</AppText>
            <View style={styles.balance}>
              <AppText variant="monoSmall">{walletBalance}</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                USDT
              </AppText>
            </View>
          </View>
        </StaticMap>
      </View>

      <Animated.View entering={FadeInUp.duration(400)} style={styles.sheet}>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          Where to?
        </AppText>
        <Pressable onPress={() => router.push('/destination-search')} style={styles.searchBox}>
          <AppText variant="body" color="#B0A79F">
            Search destination...
          </AppText>
        </Pressable>
        <View style={styles.quickRow}>
          {quickPlaces.map((place) => (
            <Pressable
              key={place.id}
              onPress={() => router.push('/destination-search')}
              style={styles.quickChip}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {place.emoji} {place.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Animated.View>
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
