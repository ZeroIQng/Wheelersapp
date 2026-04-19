import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { FloatingView, PulseView, RevealView } from '@/components/motion';
import { StaticMap } from '@/components/static-map';
import { rideOptions } from '@/data/mock';
import { theme } from '@/theme';

export default function RideSelectionScreen() {
  const router = useRouter();
  const [selectedRide, setSelectedRide] = useState('comfort');
  const activeRide = rideOptions.find((ride) => ride.id === selectedRide) ?? rideOptions[1];

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor="#D4E6D4" />
      <RevealView style={styles.mapSection}>
        <StaticMap height={210} scene="rideSelection">
          <FloatingView style={styles.distanceChip} distance={6}>
            <AppText variant="monoSmall">5.2 km</AppText>
          </FloatingView>
        </StaticMap>
      </RevealView>

      <RevealView delay={120} style={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.inlineBack}>
          <AppText variant="h3">←</AppText>
        </Pressable>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          Choose your ride
        </AppText>
        <View style={styles.list}>
          {rideOptions.map((ride, index) => {
            const selected = ride.id === selectedRide;
            const Wrapper = selected ? PulseView : FloatingView;

            return (
              <RevealView key={ride.id} delay={160 + index * 70}>
                <Pressable onPress={() => setSelectedRide(ride.id)}>
                  <Wrapper>
                    <AppCard
                      backgroundColor={selected ? theme.colors.orange : theme.colors.white}
                      style={[styles.rideCard, selected ? styles.rideCardActive : null]}>
                      <View style={[styles.rideIcon, selected ? styles.rideIconActive : null]}>
                        <AppText style={styles.emoji}>{ride.emoji}</AppText>
                      </View>
                      <View style={styles.rideText}>
                        <AppText variant="h3" color={selected ? theme.colors.white : theme.colors.black}>
                          {ride.name}
                        </AppText>
                        <AppText
                          variant="bodySmall"
                          color={selected ? 'rgba(255,255,255,0.72)' : theme.colors.muted}>
                          {ride.meta}
                        </AppText>
                      </View>
                      <AppText variant="mono" color={selected ? theme.colors.white : theme.colors.black}>
                        {ride.price}
                      </AppText>
                    </AppCard>
                  </Wrapper>
                </Pressable>
              </RevealView>
            );
          })}
        </View>
        <RevealView delay={360}>
          <AppButton title={`Book ${activeRide.name} ↗`} onPress={() => router.push('/matching')} />
        </RevealView>
      </RevealView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: theme.spacing.xl,
  },
  mapSection: {
    borderBottomWidth: theme.borders.thick,
    borderBottomColor: theme.colors.black,
  },
  distanceChip: {
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
    gap: theme.spacing.sm,
  },
  inlineBack: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
  },
  rideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  rideCardActive: {
    borderColor: theme.colors.black,
  },
  rideIcon: {
    width: 40,
    height: 40,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideIconActive: {
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  rideText: {
    flex: 1,
    gap: 2,
  },
  emoji: {
    fontSize: 20,
  },
});
