import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { FlowHeader } from '@/components/flow-header';
import { RingStack, StarBurst } from '@/components/decorative-shapes';
import { theme } from '@/theme';

type Role = 'ride' | 'drive';

export default function RoleSelectionScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>('drive');

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <RingStack color="rgba(255,92,0,0.12)" style={styles.rings} />
      <StarBurst color="rgba(13,13,13,0.08)" width={46} height={46} style={styles.star} />
      <Animated.View entering={FadeInDown.duration(400)} style={styles.headerWrap}>
        <FlowHeader
          overline="WELCOME TO WHELEERS"
          title={'Ride.\nEarn.\nOwn a piece.'}
          subtitle="The first decentralized ride-hailing app."
          progress={{ count: 5, active: 1 }}
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(120).duration(450)} style={styles.roles}>
        <RoleCard
          emoji="🛵"
          title="I want to"
          accent="RIDE"
          selected={selectedRole === 'ride'}
          onPress={() => setSelectedRole('ride')}
        />
        <RoleCard
          emoji="🚗"
          title="I want to"
          accent="DRIVE"
          selected={selectedRole === 'drive'}
          onPress={() => setSelectedRole('drive')}
          primary
        />
      </Animated.View>

      <View style={styles.actions}>
        <AppButton title="Continue with Google ↗" onPress={() => router.push('/phone-auth')} />
        <AppButton title="Connect wallet" variant="ghost" />
      </View>
    </AppScreen>
  );
}

type RoleCardProps = {
  emoji: string;
  title: string;
  accent: string;
  selected: boolean;
  onPress: () => void;
  primary?: boolean;
};

function RoleCard({ emoji, title, accent, selected, onPress, primary }: RoleCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.rolePressable}>
      <AppCard
        backgroundColor={primary || selected ? theme.colors.orange : theme.colors.white}
        style={[
          styles.roleCard,
          selected && !primary ? styles.roleCardSelected : null,
          primary ? styles.roleCardPrimary : null,
        ]}>
        <AppText style={styles.roleEmoji}>{emoji}</AppText>
        <AppText
          variant="h3"
          color={primary || selected ? theme.colors.white : theme.colors.black}
          style={styles.roleText}>
          {title}
          {'\n'}
          {accent}
        </AppText>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
  headerWrap: {
    marginTop: theme.spacing.sm,
  },
  rings: {
    position: 'absolute',
    top: -20,
    right: -32,
  },
  star: {
    position: 'absolute',
    bottom: 42,
    left: 16,
  },
  roles: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  rolePressable: {
    flex: 1,
  },
  roleCard: {
    minHeight: 164,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  roleCardSelected: {
    borderColor: theme.colors.orange,
  },
  roleCardPrimary: {
    backgroundColor: theme.colors.orange,
  },
  roleEmoji: {
    fontSize: 28,
  },
  roleText: {
    textAlign: 'center',
    lineHeight: 18,
  },
  actions: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
});
