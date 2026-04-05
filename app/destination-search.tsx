import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { DottedGrid, WaveLine } from '@/components/decorative-shapes';
import { FlowHeader } from '@/components/flow-header';
import { recentPlaces } from '@/data/mock';
import { theme } from '@/theme';

export default function DestinationSearchScreen() {
  const router = useRouter();

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <DottedGrid color="rgba(13,13,13,0.08)" style={styles.grid} />
      <WaveLine color="rgba(255,92,0,0.12)" style={styles.wave} />
      <Animated.View entering={FadeInDown.duration(420)} style={styles.content}>
        <FlowHeader showBack title="Where to?" />

        <Field label="From" iconColor={theme.colors.green} value="123 Lekki Phase 1..." />
        <Field label="To" iconColor={theme.colors.black} value="Search destination..." active />

        <View style={styles.recentSection}>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Recent places
          </AppText>
          {recentPlaces.map((place) => (
            <Pressable key={place.id} onPress={() => router.push('/ride-selection')}>
              <AppCard style={styles.placeCard}>
                <View style={styles.placeIcon}>
                  <AppText>{place.emoji}</AppText>
                </View>
                <View style={styles.placeText}>
                  <AppText variant="bodyMedium">{place.name}</AppText>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    {place.meta}
                  </AppText>
                </View>
                <AppText variant="monoSmall" color={theme.colors.orange}>
                  {place.distance}
                </AppText>
              </AppCard>
            </Pressable>
          ))}
        </View>

        <AppButton title="Confirm destination ↗" onPress={() => router.push('/ride-selection')} />
      </Animated.View>
    </AppScreen>
  );
}

type FieldProps = {
  label: string;
  value: string;
  iconColor: string;
  active?: boolean;
};

function Field({ label, value, iconColor, active }: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <AppText variant="bodySmall" color={theme.colors.muted}>
        {label}
      </AppText>
      <View style={[styles.field, active ? styles.fieldActive : null]}>
        <View style={[styles.fieldDot, { backgroundColor: iconColor }]} />
        <AppText variant="body" color={active ? '#A59B92' : theme.colors.black}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.spacing.lg,
  },
  content: {
    gap: theme.spacing.lg,
  },
  grid: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  wave: {
    position: 'absolute',
    bottom: 20,
    left: 0,
  },
  fieldGroup: {
    gap: theme.spacing.sm,
  },
  field: {
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  fieldActive: {
    borderColor: theme.colors.orange,
  },
  fieldDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  recentSection: {
    gap: theme.spacing.sm,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  placeIcon: {
    width: 34,
    height: 34,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: {
    flex: 1,
    gap: 2,
  },
});
