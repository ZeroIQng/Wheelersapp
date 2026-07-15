import { Href, useRouter } from 'expo-router';
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { useAuth } from '@/lib/auth';
import { useAppTheme } from '@/lib/theme-context';
import { theme } from '@/theme';

const APP_VERSION = '1.0.0';

// ── Icons ─────────────────────────────────────────────

function UserIcon({ size = 20, color = theme.colors.black }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

function PaletteIcon({ size = 20, color = theme.colors.black }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Circle cx="12" cy="8" r="1.5" fill={color} />
      <Circle cx="8.5" cy="13" r="1.5" fill={color} />
      <Circle cx="15.5" cy="13" r="1.5" fill={color} />
    </Svg>
  );
}

function HeadphonesIcon({ size = 20, color = theme.colors.black }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <Path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
      <Path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
    </Svg>
  );
}

function InfoIcon({ size = 20, color = theme.colors.black }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="16" x2="12" y2="12" />
      <Line x1="12" y1="8" x2="12.01" y2="8" />
    </Svg>
  );
}

function LogoutIcon({ size = 20, color = theme.colors.black }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  );
}

function TrashIcon({ size = 20, color = theme.colors.danger }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <Path d="M10 11v6" />
      <Path d="M14 11v6" />
      <Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Svg>
  );
}

function ChevronRightIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.mutedLight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

// ── Component ─────────────────────────────────────────

export default function DriverSettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useAppTheme();

  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/driver-auth' as Href);
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Account deletion requested', 'Our team will process your request within 48 hours.');
          },
        },
      ],
    );
  };

  const handleContactSupport = () => {
    // Open WhatsApp or email for support
    const supportUrl = 'https://wa.me/2349060003900?text=Hi%2C%20I%20need%20help%20with%20my%20driver%20account';
    Linking.openURL(supportUrl).catch(() => {
      Alert.alert('Could not open support chat', 'Please contact us at support@wheelers.ng');
    });
  };

  const cardBg = isDark ? theme.colors.darkSurface : theme.colors.white;
  const subtleBg = isDark ? theme.colors.darkSurfaceSoft : '#F0EDE8';
  const pressedBg = isDark ? theme.colors.darkSurfaceSoft : theme.colors.offWhite;
  const dividerColor = isDark ? theme.colors.darkBorder : theme.colors.borderLight;

  return (
    <AppScreen scroll contentStyle={styles.container}>
      <AppText variant="h1">Settings</AppText>

      {/* ── Account section ── */}
      <View style={styles.section}>
        <AppText variant="label" color={theme.colors.muted} style={styles.sectionLabel}>
          ACCOUNT
        </AppText>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Pressable
            onPress={() => {/* Profile page - future */}}
            style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: pressedBg }]}
          >
            <View style={[styles.menuIcon, { backgroundColor: theme.colors.orangeLight }]}>
              <UserIcon color={theme.colors.orange} size={18} />
            </View>
            <View style={styles.menuInfo}>
              <AppText variant="bodyMedium">Profile</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>Manage your personal info</AppText>
            </View>
            <ChevronRightIcon />
          </Pressable>
        </View>
      </View>

      {/* ── Appearance section ── */}
      <View style={styles.section}>
        <AppText variant="label" color={theme.colors.muted} style={styles.sectionLabel}>
          APPEARANCE
        </AppText>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: subtleBg }]}>
              <PaletteIcon color={theme.colors.muted} size={18} />
            </View>
            <View style={styles.menuInfo}>
              <AppText variant="bodyMedium">Dark mode</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {isDark ? 'On' : 'Off'}
              </AppText>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.orange }}
              thumbColor={theme.colors.white}
            />
          </View>
        </View>
      </View>

      {/* ── Support section ── */}
      <View style={styles.section}>
        <AppText variant="label" color={theme.colors.muted} style={styles.sectionLabel}>
          SUPPORT
        </AppText>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Pressable
            onPress={handleContactSupport}
            style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: pressedBg }]}
          >
            <View style={[styles.menuIcon, { backgroundColor: theme.colors.orangeLight }]}>
              <HeadphonesIcon color={theme.colors.orange} size={18} />
            </View>
            <View style={styles.menuInfo}>
              <AppText variant="bodyMedium">Customer support</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>Chat with us on WhatsApp</AppText>
            </View>
            <ChevronRightIcon />
          </Pressable>
        </View>
      </View>

      {/* ── About section ── */}
      <View style={styles.section}>
        <AppText variant="label" color={theme.colors.muted} style={styles.sectionLabel}>
          ABOUT
        </AppText>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: subtleBg }]}>
              <InfoIcon color={theme.colors.muted} size={18} />
            </View>
            <View style={styles.menuInfo}>
              <AppText variant="bodyMedium">App version</AppText>
            </View>
            <AppText variant="mono" color={theme.colors.muted}>{APP_VERSION}</AppText>
          </View>
        </View>
      </View>

      {/* ── Danger zone ── */}
      <View style={styles.section}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: pressedBg }]}
          >
            <View style={[styles.menuIcon, { backgroundColor: subtleBg }]}>
              <LogoutIcon color={isDark ? theme.colors.offWhite : theme.colors.black} size={18} />
            </View>
            <View style={styles.menuInfo}>
              <AppText variant="bodyMedium">Log out</AppText>
            </View>
            <ChevronRightIcon />
          </Pressable>

          <View style={[styles.menuDivider, { borderBottomColor: dividerColor }]} />

          <Pressable
            onPress={handleDeleteAccount}
            style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: pressedBg }]}
          >
            <View style={[styles.menuIcon, { backgroundColor: theme.colors.dangerLight }]}>
              <TrashIcon size={18} />
            </View>
            <View style={styles.menuInfo}>
              <AppText variant="bodyMedium" color={theme.colors.danger}>Delete account</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>Permanently remove your data</AppText>
            </View>
            <ChevronRightIcon />
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <AppText variant="bodySmall" color={theme.colors.mutedLight}>
          Wheelers v{APP_VERSION}
        </AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    paddingTop: theme.spacing.lg,
    paddingBottom: 40,
  },

  // Sections
  section: {
    gap: 8,
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },

  // Card
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },

  // Menu item
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemPressed: {
    backgroundColor: theme.colors.offWhite,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: {
    flex: 1,
    gap: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginLeft: 66,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: 24,
  },
});
