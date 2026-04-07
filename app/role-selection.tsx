import { Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { FlowHeader } from '@/components/flow-header';
import { FloatingView, PulseView, RevealView } from '@/components/motion';
import { RingStack, StarBurst } from '@/components/decorative-shapes';
import { theme } from '@/theme';

type Role = 'ride' | 'drive';

export default function RoleSelectionScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>('drive');
  const nextRoute = (selectedRole === 'ride' ? '/phone-auth' : '/driver/dashboard') as Href;

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <FloatingView style={styles.rings} distance={10} rotate={8}>
        <RingStack color="rgba(255,92,0,0.12)" />
      </FloatingView>
      <FloatingView style={styles.star} delay={200} distance={12} rotate={-12}>
        <StarBurst color="rgba(13,13,13,0.08)" width={46} height={46} />
      </FloatingView>
      <RevealView delay={40} from="down" style={styles.headerWrap}>
        <FlowHeader
          overline="WELCOME TO WHELEERS"
          title={'Ride.\nEarn.\nOwn a piece.'}
          subtitle="The first decentralized ride-hailing app."
          progress={{ count: 5, active: 1 }}
        />
      </RevealView>

      <RevealView delay={120} style={styles.roles}>
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
      </RevealView>

      <RevealView delay={220} style={styles.actions}>
        <AppButton
          title="Continue with Google ↗"
          onPress={() => router.push(nextRoute)}
        />
        <AppButton title="Connect wallet" variant="ghost" />
      </RevealView>
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
  const Wrapper = selected || primary ? PulseView : FloatingView;

  return (
    <Pressable onPress={onPress} style={styles.rolePressable}>
      <Wrapper>
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
      </Wrapper>
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
