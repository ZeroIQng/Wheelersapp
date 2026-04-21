import { useLoginWithOAuth, usePrivy } from '@privy-io/expo';
import { Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { FlowHeader } from '@/components/flow-header';
import { FloatingView, PulseView, RevealView } from '@/components/motion';
import { RingStack, StarBurst } from '@/components/decorative-shapes';
import { RoleMotionBadge } from '@/components/role-motion-badge';
import {
  isPrivyConfigured,
  privyAppIdEnvVar,
  privyClientIdEnvVar,
  privyOAuthRedirectPath,
} from '@/lib/privy';
import {
  isWalletConnectConfigured,
  walletConnectProjectIdEnvVar,
} from '@/lib/reown';
import { AppKitButton, useAccount } from '@/lib/reown-runtime';
import { theme } from '@/theme';

type Role = 'ride' | 'drive';

export default function RoleSelectionScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>('ride');
  const [rideMotionKey, setRideMotionKey] = useState(0);
  const [driveMotionKey, setDriveMotionKey] = useState(1);
  const nextRoute = (selectedRole === 'ride' ? '/phone-auth' : '/driver/dashboard') as Href;

  function handleRolePress(role: Role) {
    setSelectedRole(role);

    if (role === 'ride') {
      setRideMotionKey((current) => current + 1);
      return;
    }

    setDriveMotionKey((current) => current + 1);
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
        {isPrivyConfigured ? (
          <GoogleContinueButton nextRoute={nextRoute} />
        ) : (
          <AppButton title="Continue with Google ↗" onPress={() => router.push(nextRoute)} />
        )}
        {selectedRole === 'ride'
          ? isWalletConnectConfigured
            ? <WalletConnectCard />
            : <WalletConnectUnavailableCard />
          : null}
      </RevealView>
    </AppScreen>
  );
}

function GoogleContinueButton({ nextRoute }: { nextRoute: Href }) {
  const router = useRouter();
  const { user, isReady } = usePrivy();
  const { login, state } = useLoginWithOAuth();
  const isLoading = state.status === 'loading';
  const errorMessage =
    state.status === 'error' ? state.error?.message ?? 'Could not continue with Google.' : null;

  async function handlePress() {
    if (!isReady || isLoading) {
      return;
    }

    if (user) {
      router.push(nextRoute);
      return;
    }

    const authenticatedUser = await login({
      provider: 'google',
      redirectUri: privyOAuthRedirectPath,
    });

    if (authenticatedUser) {
      router.push(nextRoute);
    }
  }

  return (
    <View style={styles.googleActionBlock}>
      <AppButton
        title={user ? 'Continue ↗' : isLoading ? 'Opening Google…' : 'Continue with Google ↗'}
        onPress={() => {
          void handlePress();
        }}
        disabled={!isReady || isLoading}
      />
      {errorMessage ? (
        <AppText variant="bodySmall" color={theme.colors.danger}>
          {errorMessage}
        </AppText>
      ) : null}
    </View>
  );
}

function WalletConnectCard() {
  const router = useRouter();
  const { address, chain, isConnected } = useAccount();

  return (
    <AppCard
      backgroundColor={isConnected ? theme.colors.orangeLight : theme.colors.white}
      borderColor={isConnected ? theme.colors.orange : theme.colors.black}
      style={styles.walletCard}>
      <View style={styles.walletCopy}>
        <AppText variant="monoSmall" color={theme.colors.muted} style={styles.walletEyebrow}>
          OFFICIAL REOWN APPKIT
        </AppText>
        <AppText variant="h3">Connect your wallet</AppText>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          {isConnected
            ? `Connected on ${chain?.name ?? 'Ethereum'} as ${truncateAddress(address)}.`
            : 'Open the official wallet flow, then continue to phone verification when you are ready.'}
        </AppText>
      </View>
      <AppKitButton
        label="Connect wallet"
        loadingLabel="Opening wallet"
        connectStyle={styles.walletConnectButton}
        accountStyle={styles.walletConnectButton}
      />
      {isConnected ? (
        <AppButton
          title="Continue to verify your phone number ↗"
          variant="ghost"
          onPress={() => router.push('/phone-auth')}
          style={styles.walletContinueButton}
        />
      ) : null}
    </AppCard>
  );
}

function WalletConnectUnavailableCard() {
  return (
    <AppCard style={styles.walletCard}>
      <View style={styles.walletCopy}>
        <AppText variant="monoSmall" color={theme.colors.muted} style={styles.walletEyebrow}>
          OFFICIAL REOWN APPKIT
        </AppText>
        <AppText variant="h3">Connect your wallet</AppText>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          Set {walletConnectProjectIdEnvVar} to enable the official WalletConnect flow.
        </AppText>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          Google auth needs {privyAppIdEnvVar} and {privyClientIdEnvVar}.
        </AppText>
      </View>
      <AppButton
        title="Project ID required"
        variant="ghost"
        disabled
        style={styles.walletButtonDisabled}
      />
    </AppCard>
  );
}

function truncateAddress(address?: string) {
  if (!address) {
    return 'your wallet';
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
  googleActionBlock: {
    gap: theme.spacing.xs,
  },
  walletCard: {
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  walletCopy: {
    gap: theme.spacing.xs,
  },
  walletEyebrow: {
    letterSpacing: 0.8,
  },
  walletConnectButton: {
    minHeight: 52,
  },
  walletContinueButton: {
    backgroundColor: theme.colors.white,
  },
  walletButtonDisabled: {
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
