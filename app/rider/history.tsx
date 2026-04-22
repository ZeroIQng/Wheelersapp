import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { SectionHeader } from '@/components/SectionHeader';
import { theme } from '@/theme';

const rides = [
  {
    id: 'marina',
    title: 'Marina to Lekki Phase 1',
    fare: '$1.85',
    time: 'Today, 2:14 PM',
    status: 'Completed',
    icon: 'directions-car',
  },
  {
    id: 'airport',
    title: 'Airport pickup',
    fare: '$3.40',
    time: 'Yesterday, 8:05 PM',
    status: 'Completed',
    icon: 'flight-land',
  },
  {
    id: 'vi',
    title: 'Victoria Island dropoff',
    fare: '$2.25',
    time: 'Yesterday, 1:23 PM',
    status: 'Completed',
    icon: 'location-on',
  },
] as const;

export default function RiderHistoryScreen() {
  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <SectionHeader
        eyebrow="RIDER ACTIVITY"
        title="History"
        subtitle="Your latest rides and completed trips."
        titleVariant="h1"
      />

      <View style={styles.list}>
        {rides.map((ride) => (
          <AppCard key={ride.id} style={styles.card}>
            <View style={styles.iconWrap}>
              <MaterialIcons name={ride.icon} size={20} color={theme.colors.black} />
            </View>
            <View style={styles.copy}>
              <AppText variant="bodyMedium">{ride.title}</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {ride.time}
              </AppText>
            </View>
            <View style={styles.meta}>
              <AppText variant="mono" color={theme.colors.orange}>
                {ride.fare}
              </AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {ride.status}
              </AppText>
            </View>
          </AppCard>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  list: {
    gap: theme.spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 2,
  },
});
