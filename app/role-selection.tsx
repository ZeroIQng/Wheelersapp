import { useLoginWithOAuth, usePrivy, type User } from "@privy-io/expo";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import { AppButton } from "@/components/app-button";
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BlobShape, DiamondPair, RingStack, StarBurst } from "@/components/decorative-shapes";
import { FlowHeader } from "@/components/flow-header";
import { FloatingView, PulseView, RevealView } from "@/components/motion";
import { RoleMotionBadge } from "@/components/role-motion-badge";
import { isBackendConfigured, syncPrivyAuth, type BackendRole } from "@/lib/api";
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
type AccessTokenGetter = () => Promise<string | null | undefined>;

function hasGoogleAccount(user: User): boolean {
  return user.linked_accounts.some((account) => account.type === "google_oauth");
}

async function resolveAuthenticatedRoute({
  authenticatedUser,
  getAccessToken,
  requestedRole,
}: {
  authenticatedUser: User;
  getAccessToken: AccessTokenGetter;
  requestedRole?: BackendRole;
}) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("Could not get a Privy access token.");
  }

  const response = await syncPrivyAuth({
    accessToken,
    authMethod: "google",
    role: requestedRole,
    email: getPrivyEmail(authenticatedUser),
    name: getPrivyName(authenticatedUser),
    walletAddress: getPrivyEthereumWalletAddress(authenticatedUser),
  });

  const resolvedRole = response.user.role === "DRIVER" ? "DRIVER" : "RIDER";
  const nextState = await persistAuthenticatedRole(resolvedRole, {
    phoneVerified:
      resolvedRole === "RIDER" &&
      typeof response.user.phone === "string" &&
      response.user.phone.length > 0,
  });

  return getAuthenticatedRoute(nextState);
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
  const { getAccessToken, isReady, user } = usePrivy();
  const [selectedRole, setSelectedRole] = useState<Role>("ride");
  const [rideMotionKey, setRideMotionKey] = useState(0);
  const [driveMotionKey, setDriveMotionKey] = useState(1);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(false);

  useEffect(() => {
    if (!isPrivyConfigured || !isReady || !user) {
      return;
    }

    let cancelled = false;

    if (!isBackendConfigured()) {
      setRestoreError("Set EXPO_PUBLIC_API_BASE_URL before continuing.");
      setIsRestoringSession(false);
      return;
    }

    setRestoreError(null);
    setIsRestoringSession(true);

    void (async () => {
      try {
        const destination = await resolveAuthenticatedRoute({
          authenticatedUser: user,
          getAccessToken,
        });

        if (cancelled) {
          return;
        }

        router.replace(destination);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setRestoreError(
          error instanceof Error
            ? error.message
            : "Could not restore your account.",
        );
        setIsRestoringSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isReady, restoreAttempt, router, user]);

  function handleRolePress(role: Role) {
    setSelectedRole(role);
    if (role === "ride") {
      setRideMotionKey((current) => current + 1);
      return;
    }
    setDriveMotionKey((current) => current + 1);
  }

  if (isPrivyConfigured && (!isReady || user)) {
    return (
      <SessionRestoreSplash
        isRestoring={isRestoringSession || !isReady}
        onContinue={
          !isRestoringSession && isReady && user
            ? () => setRestoreAttempt((current) => current + 1)
            : undefined
        }
        statusMessage={restoreError ?? undefined}
      />
    );
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

function SessionRestoreSplash({
  isRestoring,
  onContinue,
  statusMessage,
}: {
  isRestoring: boolean;
  onContinue?: () => void;
  statusMessage?: string;
}) {
  const floatY = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withTiming(-10, {
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    spin.value = withRepeat(
      withTiming(1, {
        duration: 9000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [floatY, spin]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const starStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <AppScreen backgroundColor={theme.colors.orange} contentStyle={styles.splashContainer}>
      <StatusBar style="light" backgroundColor={theme.colors.orange} />
      <Pressable onPress={onContinue} style={styles.splashPressable}>
        <BlobShape color="rgba(255,255,255,0.18)" style={styles.splashBlobTop} />
        <Animated.View style={[styles.splashStarRight, starStyle]}>
          <StarBurst color="rgba(255,255,255,0.22)" width={54} height={54} />
        </Animated.View>
        <DiamondPair color="rgba(255,255,255,0.18)" style={styles.splashDiamondLeft} />
        <View style={styles.splashCenter}>
          <Animated.View entering={ZoomIn.duration(500)} style={[styles.splashLogoWrap, logoStyle]}>
            <View style={styles.splashLogoOuter}>
              <View style={styles.splashLogoInner}>
                <AppText variant="h2" color={theme.colors.white} style={styles.splashMarkText}>
                  W
                </AppText>
              </View>
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.splashTitleBlock}>
            <View style={styles.splashWordmark}>
              <AppText variant="h1" color={theme.colors.white} style={styles.splashTitleLine}>
                WHEEL
              </AppText>
              <AppText variant="h1" color={theme.colors.white} style={styles.splashTitleLine}>
                ERS
              </AppText>
            </View>
            <AppText variant="bodySmall" color="rgba(255,255,255,0.74)" style={styles.splashTagline}>
              ride. earn. own.
            </AppText>
          </Animated.View>
        </View>
        <Animated.View entering={FadeIn.delay(250).duration(450)} style={styles.splashBottom}>
          <View style={styles.splashLoaderTrack}>
            <Animated.View style={styles.splashLoaderBar} />
          </View>
          <AppText
            variant="monoSmall"
            color="rgba(255,255,255,0.7)"
            style={styles.splashHint}
          >
            {isRestoring
              ? "opening your app..."
              : (statusMessage ?? "tap anywhere to continue")}
          </AppText>
        </Animated.View>
      </Pressable>
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

    const selectedBackendRole: BackendRole =
      role === "drive" ? "DRIVER" : "RIDER";
    let authenticatedUser = user ?? undefined;
    let requestedRole: BackendRole | undefined = selectedBackendRole;
    if (!authenticatedUser || !hasGoogleAccount(authenticatedUser)) {
      authenticatedUser = await login({
        provider: "google",
        redirectUri: privyOAuthRedirectPath,
      });
    } else {
      requestedRole = undefined;
    }

    if (!authenticatedUser) {
      return;
    }

    setIsSyncing(true);

    try {
      const destination = await resolveAuthenticatedRoute({
        authenticatedUser,
        getAccessToken,
        requestedRole,
      });
      router.replace(destination);
    } catch (error) {
      setSyncError(
        error instanceof Error
          ? error.message
          : "Could not sync your account with Wheelers.",
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
  splashContainer: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  splashPressable: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingVertical: theme.spacing.xxxl,
  },
  splashCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  splashLogoWrap: {
    marginBottom: theme.spacing.md,
  },
  splashLogoOuter: {
    width: 82,
    height: 82,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  splashLogoInner: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  splashMarkText: {
    fontSize: 25,
    lineHeight: 25,
    letterSpacing: -0.4,
  },
  splashTitleBlock: {
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  splashWordmark: {
    alignItems: "center",
    gap: 0,
  },
  splashTitleLine: {
    textAlign: "center",
    fontSize: 28,
    lineHeight: 27,
    letterSpacing: -0.8,
  },
  splashTagline: {
    letterSpacing: 0.4,
    lineHeight: 16,
  },
  splashBottom: {
    width: "100%",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  splashBlobTop: {
    position: "absolute",
    top: -18,
    left: -20,
  },
  splashStarRight: {
    position: "absolute",
    right: 20,
    bottom: 108,
  },
  splashDiamondLeft: {
    position: "absolute",
    top: 68,
    left: 28,
  },
  splashLoaderTrack: {
    width: 112,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.24)",
    overflow: "hidden",
  },
  splashLoaderBar: {
    width: "72%",
    height: "100%",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
  },
  splashHint: {
    letterSpacing: 1.2,
  },
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
