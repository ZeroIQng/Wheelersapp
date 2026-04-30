import { useLoginWithOAuth, usePrivy, type User } from "@privy-io/expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { RingStack, StarBurst } from "@/components/decorative-shapes";
import { FlowHeader } from "@/components/flow-header";
import { FloatingView, PulseView, RevealView } from "@/components/motion";
import { RoleMotionBadge } from "@/components/role-motion-badge";
import { isBackendConfigured, syncPrivyAuth } from "@/lib/api";
import { getAuthenticatedRoute, persistAuthenticatedRole } from "@/lib/auth-state";
// import { clearStoredAuthState } from "@/lib/auth-state";
import { isPrivyConfigured, privyOAuthRedirectPath } from "@/lib/privy";
import {
  getPrivyEmail,
  getPrivyEthereumWalletAddress,
  getPrivyName,
} from "@/lib/privy-user";
import {
  isThirdwebConfigured,
  thirdwebAppMetadata,
  thirdwebChain,
  thirdwebClient,
  thirdwebWallets,
} from "@/lib/thirdweb";
import {
  ConnectButton,
  isThirdwebRuntimeAvailable,
} from "@/lib/thirdweb-runtime";
import { theme } from "@/theme";

type Role = "ride" | "drive";

function hasGoogleAccount(user: User): boolean {
  return user.linked_accounts.some((account) => account.type === "google_oauth");
}

const walletConnectTheme = {
  type: "light" as const,
  fontFamily: theme.fonts.headingAlt,
  colors: {
    accentButtonBg: theme.colors.orange,
    accentButtonText: theme.colors.white,
    accentText: theme.colors.orange,
    borderColor: theme.colors.black,
    connectedButtonBg: theme.colors.white,
    connectedButtonBgHover: theme.colors.orangeLight,
    danger: theme.colors.danger,
    inputAutofillBg: theme.colors.offWhite,
    modalBg: theme.colors.white,
    modalOverlayBg: "rgba(13,13,13,0.78)",
    primaryButtonBg: theme.colors.white,
    primaryButtonText: theme.colors.black,
    primaryText: theme.colors.black,
    scrollbarBg: theme.colors.orangeLight,
    secondaryButtonBg: theme.colors.offWhite,
    secondaryButtonHoverBg: theme.colors.orangeLight,
    secondaryButtonText: theme.colors.black,
    secondaryIconColor: theme.colors.muted,
    secondaryIconHoverBg: theme.colors.orangeLight,
    secondaryIconHoverColor: theme.colors.black,
    secondaryText: theme.colors.muted,
    selectedTextBg: theme.colors.black,
    selectedTextColor: theme.colors.white,
    separatorLine: theme.colors.borderLight,
    skeletonBg: theme.colors.borderLight,
    success: theme.colors.green,
    tertiaryBg: theme.colors.orangeLight,
    tooltipBg: theme.colors.black,
    tooltipText: theme.colors.white,
  },
};

export default function RoleSelectionScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>("ride");
  const [rideMotionKey, setRideMotionKey] = useState(0);
  const [driveMotionKey, setDriveMotionKey] = useState(1);

  function handleRolePress(role: Role) {
    setSelectedRole(role);
    if (role === "ride") {
      setRideMotionKey((current) => current + 1);
      return;
    }
    setDriveMotionKey((current) => current + 1);
  }

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      contentStyle={styles.container}
    >
      <FloatingView style={styles.rings} distance={10} rotate={8}>
        <RingStack color="rgba(255,92,0,0.12)" />
      </FloatingView>
      <FloatingView style={styles.star} delay={200} distance={12} rotate={-12}>
        <StarBurst color="rgba(13,13,13,0.08)" width={46} height={46} />
      </FloatingView>
      <RevealView delay={40} from="down" style={styles.headerWrap}>
        <FlowHeader
          overline="WELCOME TO WHELEERS"
          title={"Ride.\nEarn.\nOwn a piece."}
          subtitle="The first decentralized ride-hailing app."
          progress={{ count: 5, active: 1 }}
        />
      </RevealView>

      <RevealView delay={120} style={styles.roles}>
        <RoleCard
          role="ride"
          title="I want to"
          accent="RIDE"
          selected={selectedRole === "ride"}
          motionKey={rideMotionKey}
          onPress={() => handleRolePress("ride")}
        />
        <RoleCard
          role="drive"
          title="I want to"
          accent="DRIVE"
          selected={selectedRole === "drive"}
          motionKey={driveMotionKey}
          onPress={() => handleRolePress("drive")}
        />
      </RevealView>

      <RevealView delay={220} style={styles.actions}>
        {isPrivyConfigured ? (
          <GoogleContinueButton role={selectedRole} />
        ) : (
          <AppButton
            title="Connect with Google ↗"
            onPress={() => router.push("/phone-auth")}
          />
        )}
        {selectedRole === "ride" ? <WalletConnectAction /> : null}
      </RevealView>
    </AppScreen>
  );
}

function GoogleContinueButton({
  role,
}: {
  role: Role;
}) {
  const router = useRouter();
  const { user, isReady, getAccessToken } = usePrivy();
  // const { logout } = usePrivy();
  const { login, state } = useLoginWithOAuth();
  const [syncError, setSyncError] = useState<string | null>(null);
  const hasGoogleLinkedAccount = Boolean(user && hasGoogleAccount(user));
  const [isSyncing, setIsSyncing] = useState(false);
  // const [isResetting, setIsResetting] = useState(false);
  const isLoading = state.status === "loading";
  const errorMessage =
    syncError ??
    (state.status === "error"
      ? (state.error?.message ?? "Could not continue with Google.")
      : null);

  async function handlePress() {
    if (isLoading || isSyncing) return;

    setSyncError(null);

    if (!isBackendConfigured()) {
      setSyncError("Set EXPO_PUBLIC_API_BASE_URL before continuing.");
      return;
    }

    if (!isReady) {
      setSyncError("Privy is still initializing. Try again in a moment.");
      return;
    }

    let authenticatedUser = user ?? undefined;
    if (!authenticatedUser || !hasGoogleAccount(authenticatedUser)) {
      authenticatedUser = await login({
        provider: "google",
        redirectUri: privyOAuthRedirectPath,
      });
    }

    if (!authenticatedUser) {
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setSyncError("Could not get a Privy access token.");
      return;
    }

    setIsSyncing(true);

    const authRole = role === "drive" ? "DRIVER" : "RIDER";

    try {
      const response = await syncPrivyAuth({
        accessToken,
        authMethod: "google",
        role: authRole,
        email: getPrivyEmail(authenticatedUser),
        name: getPrivyName(authenticatedUser),
        walletAddress: getPrivyEthereumWalletAddress(authenticatedUser),
      });
      const nextState = await persistAuthenticatedRole(authRole, {
        phoneVerified:
          authRole === "RIDER" &&
          typeof response.user?.phone === "string" &&
          response.user.phone.length > 0,
      });
      router.replace(getAuthenticatedRoute(nextState));
    } catch (error) {
      setSyncError(
        error instanceof Error
          ? error.message
          : "Could not sync your account with Wheelers."
      );
    } finally {
      setIsSyncing(false);
    }
  }

  // async function handleResetSession() {
  //   if (isSyncing || isLoading || isResetting) {
  //     return;
  //   }
// 
  //   setSyncError(null);
  //   setIsResetting(true);
// 
  //   try {
  //     await logout();
  //     await clearStoredAuthState();
  //   } catch (error) {
  //     setSyncError(
  //       error instanceof Error
  //         ? error.message
  //         : "Could not clear the previous session."
  //     );
  //   } finally {
  //     setIsResetting(false);
  //   }
  // }

  return (
    <View style={styles.googleActionBlock}>
      <AppButton
        title={
          hasGoogleLinkedAccount
            ? isSyncing
              ? "Setting up account…"
              : "Continue"
            : isLoading
              ? "Opening Google…"
              : isSyncing
                ? "Setting up account…"
                : "Connect with Google"
        }
        // disabled={isResetting}
        onPress={() => {
          void handlePress();
        }}
      />
      {/*
      {user ? (
        <AppButton
          title={isResetting ? "Clearing session…" : "Reset session"}
          variant="ghost"
          disabled={isSyncing || isLoading || isResetting}
          onPress={() => {
            void handleResetSession();
          }}
        />
      ) : null}
      */}
      {errorMessage ? (
        <AppText variant="bodySmall" color={theme.colors.danger}>
          {errorMessage}
        </AppText>
      ) : null}
    </View>
  );
}

function WalletConnectAction() {
  const router = useRouter();

  if (!isThirdwebConfigured || !isThirdwebRuntimeAvailable || !thirdwebClient) {
    return (
      <AppButton
        title="Connect your wallet"
        variant="inverse"
        disabled
        style={styles.walletFallbackButton}
      />
    );
  }

  return (
    <View style={styles.walletConnectButtonWrap}>
      <View style={styles.walletConnectFrame}>
        <ConnectButton
          appMetadata={thirdwebAppMetadata}
          chain={thirdwebChain ?? undefined}
          client={thirdwebClient}
          connectButton={{ label: "Connect your wallet" }}
          connectModal={{
            size: "compact",
            showThirdwebBranding: false,
            title: "Connect your wallet",
            titleIcon: "",
          }}
          detailsModal={{
            assetTabs: [],
            hideBuyFunds: true,
            hideReceiveFunds: true,
            hideSendFunds: true,
            hideSwitchWallet: true,
          }}
          onConnect={() => router.push("/phone-auth")}
          theme={walletConnectTheme}
          wallets={thirdwebWallets}
        />
      </View>
    </View>
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

function RoleCard({
  role,
  title,
  accent,
  selected,
  motionKey,
  onPress,
}: RoleCardProps) {
  const Wrapper = selected ? PulseView : FloatingView;
  const textColor = selected ? theme.colors.white : theme.colors.black;

  return (
    <Pressable onPress={onPress} style={styles.rolePressable}>
      <Wrapper>
        <AppCard
          backgroundColor={selected ? theme.colors.orange : theme.colors.white}
          style={[styles.roleCard, selected ? styles.roleCardSelected : null]}
        >
          <RoleMotionBadge
            motionKey={motionKey}
            role={role}
            selected={selected}
          />
          <View style={styles.roleTextBlock}>
            <AppText
              variant="bodySmall"
              color={selected ? "rgba(255,255,255,0.82)" : theme.colors.muted}
              style={styles.roleIntro}
            >
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
  container: { gap: theme.spacing.xl, paddingTop: theme.spacing.lg },
  headerWrap: { marginTop: theme.spacing.sm },
  rings: { position: "absolute", top: -20, right: -32 },
  star: { position: "absolute", bottom: 42, left: 16 },
  roles: { flexDirection: "row", gap: theme.spacing.md },
  rolePressable: { flex: 1 },
  roleCard: {
    minHeight: 164,
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.lg,
  },
  roleCardSelected: { borderColor: theme.colors.black },
  roleTextBlock: { alignItems: "center", gap: 1 },
  roleIntro: { textAlign: "center", lineHeight: 14, letterSpacing: 0.3 },
  roleAccent: { textAlign: "center", lineHeight: 22, letterSpacing: -0.2 },
  actions: { gap: theme.spacing.md, marginTop: theme.spacing.sm },
  googleActionBlock: { gap: theme.spacing.xs },
  walletConnectButtonWrap: { width: "100%" },
  walletConnectFrame: {
    width: "100%",
    overflow: "hidden",
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    ...theme.shadows.card,
  },
  walletFallbackButton: { backgroundColor: theme.colors.white },
});
