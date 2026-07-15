import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { getAccessTokenWithRetry } from '@/lib/access-token';
import { getCurrentProfile, getDriverStats } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAppTheme } from '@/lib/theme-context';
import { theme } from '@/theme';

// ── Icons ─────────────────────────────────────────────

function BackIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="19" y1="12" x2="5" y2="12" />
      <Polyline points="12 19 5 12 12 5" />
    </Svg>
  );
}

function AvatarIcon({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.muted} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

function MailIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.orange} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="4" width="20" height="16" rx="2" />
      <Path d="M22 7l-10 7L2 7" />
    </Svg>
  );
}

function UserIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.orange} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

function CarIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.orange} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h8l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2" />
      <Circle cx="7.5" cy="17" r="2" />
      <Circle cx="16.5" cy="17" r="2" />
    </Svg>
  );
}

function PlateIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.orange} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="6" width="20" height="12" rx="2" />
      <Line x1="6" y1="12" x2="18" y2="12" />
    </Svg>
  );
}

// ── Component ─────────────────────────────────────────

export default function DriverProfileScreen() {
  const router = useRouter();
  const { isDark } = useAppTheme();
  const { getAccessToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [vehicleMake, setVehicleMake] = useState<string | null>(null);
  const [vehicleModel, setVehicleModel] = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState<string | null>(null);
  const [vehicleYear, setVehicleYear] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const accessToken = await getAccessTokenWithRetry(getAccessToken);
      if (!accessToken || cancelled) return;

      const [profileRes, statsRes] = await Promise.allSettled([
        getCurrentProfile({ accessToken }),
        getDriverStats({ accessToken }),
      ]);

      if (cancelled) return;

      if (profileRes.status === 'fulfilled') {
        setName(profileRes.value.user.name);
        setEmail(profileRes.value.user.email);
      }
      if (statsRes.status === 'fulfilled') {
        setVehicleMake(statsRes.value.vehicleMake);
        setVehicleModel(statsRes.value.vehicleModel);
        setVehiclePlate(statsRes.value.vehiclePlate);
        setVehicleYear(statsRes.value.vehicleYear);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [getAccessToken]);

  const cardBg = isDark ? theme.colors.darkSurface : theme.colors.white;
  const displayName = name || 'Driver';
  const displayEmail = email || '—';
  const hasVehicle = vehicleMake || vehicleModel || vehiclePlate;

  if (loading) {
    return (
      <AppScreen contentStyle={[styles.container, styles.centered]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backBtn, isDark && { backgroundColor: theme.colors.darkSurface }]}>
            <BackIcon />
          </Pressable>
          <AppText variant="h1">Profile</AppText>
        </View>
        <ActivityIndicator size="large" color={theme.colors.orange} style={{ marginTop: 60 }} />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll contentStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backBtn, isDark && { backgroundColor: theme.colors.darkSurface }]}>
          <BackIcon />
        </Pressable>
        <AppText variant="h1">Profile</AppText>
      </View>

      {/* Avatar + name */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatarCircle, isDark && { backgroundColor: theme.colors.darkSurfaceSoft }]}>
          <AvatarIcon />
        </View>
        <AppText variant="h2">{displayName}</AppText>
        <AppText variant="bodySmall" color={theme.colors.muted}>{displayEmail}</AppText>
      </View>

      {/* Personal info */}
      <View style={styles.section}>
        <AppText variant="label" color={theme.colors.muted} style={styles.sectionLabel}>
          PERSONAL INFO
        </AppText>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: theme.colors.orangeLight }]}>
              <UserIcon />
            </View>
            <View style={styles.infoContent}>
              <AppText variant="bodySmall" color={theme.colors.muted}>Full name</AppText>
              <AppText variant="bodyMedium">{displayName}</AppText>
            </View>
          </View>

          <View style={[styles.divider, isDark && { backgroundColor: theme.colors.darkBorder }]} />

          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: theme.colors.orangeLight }]}>
              <MailIcon />
            </View>
            <View style={styles.infoContent}>
              <AppText variant="bodySmall" color={theme.colors.muted}>Email</AppText>
              <AppText variant="bodyMedium">{displayEmail}</AppText>
            </View>
          </View>
        </View>
      </View>

      {/* Vehicle info */}
      {hasVehicle && (
        <View style={styles.section}>
          <AppText variant="label" color={theme.colors.muted} style={styles.sectionLabel}>
            VEHICLE INFO
          </AppText>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: theme.colors.orangeLight }]}>
                <CarIcon />
              </View>
              <View style={styles.infoContent}>
                <AppText variant="bodySmall" color={theme.colors.muted}>Vehicle</AppText>
                <AppText variant="bodyMedium">
                  {[vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(' ') || '—'}
                </AppText>
              </View>
            </View>

            {vehiclePlate && (
              <>
                <View style={[styles.divider, isDark && { backgroundColor: theme.colors.darkBorder }]} />
                <View style={styles.infoRow}>
                  <View style={[styles.infoIcon, { backgroundColor: theme.colors.orangeLight }]}>
                    <PlateIcon />
                  </View>
                  <View style={styles.infoContent}>
                    <AppText variant="bodySmall" color={theme.colors.muted}>Plate number</AppText>
                    <AppText variant="bodyMedium">{vehiclePlate}</AppText>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    paddingTop: theme.spacing.lg,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 8,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  // Sections
  section: {
    gap: 8,
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },

  // Card
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 3 },
    }),
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginLeft: 66,
  },
});
