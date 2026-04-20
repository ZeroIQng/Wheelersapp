import { Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { FlowHeader } from '@/components/flow-header';
import { FloatingView, PulseView, RevealView } from '@/components/motion';
import { RingStack, StarBurst } from '@/components/decorative-shapes';
import { RoleMotionBadge } from '@/components/role-motion-badge';
import { WalletConnectSheet } from '@/components/wallet-connect-sheet';
import { theme } from '@/theme';

type Role = 'ride' | 'drive';
type WalletProvider = 'WalletConnect' | 'MetaMask' | 'Coinbase';

export default function RoleSelectionScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>('drive');
  const [rideMotionKey, setRideMotionKey] = useState(0);
  const [driveMotionKey, setDriveMotionKey] = useState(1);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<WalletProvider | null>(null);
  const nextRoute = (selectedRole === 'ride' ? '/phone-auth' : '/driver/dashboard') as Href;

  useEffect(() => {
    if (!connectingWallet) {
      return;
    }

    const timer = setTimeout(() => {
      setWalletSheetOpen(false);
      setConnectingWallet(null);
      router.push('/phone-auth');
    }, 700);

    return () => clearTimeout(timer);
  }, [connectingWallet, router]);

  function handleRolePress(role: Role) {
    setSelectedRole(role);

    if (role === 'ride') {
      setRideMotionKey((current) => current + 1);
      return;
    }

    setDriveMotionKey((current) => current + 1);
  }

  function handleWalletConnect(provider: WalletProvider) {
    setConnectingWallet(provider);
  }

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} contentStyle={styles.container}>
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
          role="ride"
          title="I want to"
          accent="RIDE"
          selected={selectedRole === 'ride'}
          motionKey={rideMotionKey}
          onPress={() => handleRolePress('ride')}
        />
        <RoleCard
          role="drive"
          title="I want to"
          accent="DRIVE"
          selected={selectedRole === 'drive'}
          motionKey={driveMotionKey}
          onPress={() => handleRolePress('drive')}
        />
      </RevealView>

      <RevealView delay={220} style={styles.actions}>
        <AppButton title="Continue with Google ↗" onPress={() => router.push(nextRoute)} />
        <AppButton
          title={connectingWallet ? `Connecting ${connectingWallet}...` : 'Connect wallet'}
          variant="ghost"
          onPress={() => setWalletSheetOpen(true)}
          style={styles.walletButton}
        />
      </RevealView>

      <WalletConnectSheet
        visible={walletSheetOpen}
        connecting={connectingWallet}
        onClose={() => {
          if (connectingWallet) {
            return;
          }

          setWalletSheetOpen(false);
        }}
        onConnect={handleWalletConnect}
      />
    </AppScreen>
  );
}

type RoleCardProps = {
  role: Role;
  title: string;
  accent: string;
  selected: boolean;
  motionKey: number;
  onPress: () => void;
};

function RoleCard({ role, title, accent, selected, motionKey, onPress }: RoleCardProps) {
  const Wrapper = selected ? PulseView : FloatingView;
  const textColor = selected ? theme.colors.white : theme.colors.black;

  return (
    <Pressable onPress={onPress} style={styles.rolePressable}>
      <Wrapper>
        <AppCard backgroundColor={selected ? theme.colors.orange : theme.colors.white} style={[styles.roleCard, selected ? styles.roleCardSelected : null]}>
          <RoleMotionBadge motionKey={motionKey} role={role} selected={selected} />
          <View style={styles.roleTextBlock}>
            <AppText variant="bodySmall" color={selected ? 'rgba(255,255,255,0.82)' : theme.colors.muted} style={styles.roleIntro}>
              {title}
            </AppText>
            <AppText variant="h2" color={textColor} style={styles.roleAccent}>
              {accent}
            </AppText>
          </View>
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
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.lg,
  },
  roleCardSelected: {
    borderColor: theme.colors.black,
  },
  roleTextBlock: {
    alignItems: 'center',
    gap: 1,
  },
  roleIntro: {
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  roleAccent: {
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  actions: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  walletButton: {
    backgroundColor: theme.colors.white,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 0,
  },
});
