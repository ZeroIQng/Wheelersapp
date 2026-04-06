import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AppBadge } from '@/components/app-badge';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { FloatingView, PulseView, RevealView } from '@/components/motion';
import { StaticMap, MovingVehicle } from '@/components/static-map';
import { driver } from '@/data/mock';
import { theme } from '@/theme';

export default function DriverFoundScreen() {
  const router = useRouter();

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor="#D4E6D4" />
      <RevealView style={styles.mapWrap}>
        <StaticMap height={232}>
          <MovingVehicle />
          <PulseView style={styles.centerPinWrap} scaleTo={1.08}>
            <View style={styles.centerPin} />
          </PulseView>
          <FloatingView style={styles.etaChip} distance={6}>
            <AppText variant="monoSmall">ETA: 2 min</AppText>
          </FloatingView>
        </StaticMap>
      </RevealView>

      <RevealView delay={120} style={styles.content}>
        <View style={styles.headerRow}>
          <AppBadge label="DRIVER MATCHED" />
          <AppText variant="monoSmall" color={theme.colors.green}>
            ● CONFIRMED
          </AppText>
        </View>

        <View style={styles.driverRow}>
          <PulseView>
            <View style={styles.avatar}>
              <AppText variant="h3" color={theme.colors.white}>
                {driver.initials}
              </AppText>
            </View>
          </PulseView>
          <View style={styles.driverText}>
            <AppText variant="h3">{driver.name}</AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              ⭐ {driver.rating} · {driver.vehicle}
            </AppText>
            <View style={styles.plate}>
              <AppText variant="monoSmall" color={theme.colors.offWhite}>
                {driver.plate}
              </AppText>
            </View>
          </View>
          <AppText style={styles.chat}>💬</AppText>
        </View>

        <View style={styles.statsRow}>
          <RevealView delay={180} style={styles.statSlot}>
            <StatCard value={`${driver.etaMinutes}`} label="MIN AWAY" accent />
          </RevealView>
          <RevealView delay={240} style={styles.statSlot}>
            <StatCard value={driver.fare} label="FARE" />
          </RevealView>
          <RevealView delay={300} style={styles.statSlot}>
            <StatCard value={`${driver.tripMinutes}`} label="MIN TRIP" />
          </RevealView>
        </View>

        <View style={styles.actions}>
          <AppButton title="Call" variant="ghost" />
          <AppButton title="Cancel" variant="danger" onPress={() => router.replace('/rider-home')} />
        </View>
      </RevealView>
    </AppScreen>
  );
}

function StatCard({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <AppCard style={styles.statCard}>
      <AppText variant="monoLarge" color={accent ? theme.colors.orange : theme.colors.black}>
        {value}
      </AppText>
      <AppText variant="bodySmall" color={theme.colors.muted}>
        {label}
      </AppText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: theme.spacing.xl,
  },
  mapWrap: {
    borderBottomWidth: theme.borders.thick,
    borderBottomColor: theme.colors.black,
  },
  centerPin: {
    width: 14,
    height: 14,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
  },
  centerPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -7,
    marginTop: -7,
  },
  etaChip: {
    position: 'absolute',
    top: 12,
    left: theme.spacing.gutter,
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    ...theme.shadows.card,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: theme.borders.regular,
    borderBottomColor: '#EEE0D4',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  driverText: {
    flex: 1,
    gap: 3,
  },
  plate: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.black,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    ...theme.shadows.subtle,
  },
  chat: {
    fontSize: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statSlot: {
    flex: 1,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: theme.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
});
