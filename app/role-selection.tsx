import { useLoginWithOAuth, usePrivy, type User } from "@privy-io/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { RingStack, StarBurst } from "@/components/decorative-shapes";
import { FlowHeader } from "@/components/flow-header";
import { getAccessTokenWithRetry } from "@/lib/access-token";
import { getDisplayErrorMessage, isIgnorableUserCancelledError } from "@/lib/errors";
import { FloatingView, PulseView, RevealView } from "@/components/motion";
import { RoleMotionBadge } from "@/components/role-motion-badge";
import {
  isBackendConfigured,
  syncPrivyAuth,
  type BackendRole,
} from "@/lib/api";
import {
  getAuthenticatedRoute,
  persistAuthenticatedRole,
  readLogoutPending,
} from "@/lib/auth-state";
import { isPrivyConfigured, privyOAuthRedirectPath } from "@/lib/privy";
import {
  getPrivyEmail,
  getPrivyEthereumWalletAddress,
  getPrivyName,
} from "@/lib/privy-user";
import { theme } from "@/theme";

type Role = "ride";
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
  const accessToken = await getAccessTokenWithRetry(getAccessToken);
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

export default function RoleSelectionScreen() {
  if (!isPrivyConfigured) {
    return <RoleSelectionScreenContent />;
  }

  return <PrivyRoleSelectionScreen />;
}

function PrivyRoleSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ logout?: string | string[] }>();
  const { getAccessToken, isReady, user } = usePrivy();
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const [isManualAuthFlow, setIsManualAuthFlow] = useState(false);
  const lastRestoreAlertRef = useRef<string | null>(null);
  const logoutRequested =
    (Array.isArray(params.logout) ? params.logout[0] : params.logout) === "1";
  const shouldSuppressRestore = logoutRequested || logoutPending;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const pending = await readLogoutPending();
      if (!cancelled) {
        setLogoutPending(pending);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPrivyConfigured || !isReady || !user || shouldSuppressRestore || isManualAuthFlow) {
      return;
    }

    let cancelled = false;

    if (!isBackendConfigured()) {
      setRestoreError("Set EXPO_PUBLIC_API_BASE_URL before continuing.");
      return;
    }

    setRestoreError(null);

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

        setRestoreError(getDisplayErrorMessage(error, "Could not restore your account."));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isManualAuthFlow, isReady, router, shouldSuppressRestore, user]);

  useEffect(() => {
    if (!restoreError) {
      lastRestoreAlertRef.current = null;
      return;
    }

    if (lastRestoreAlertRef.current === restoreError) {
      return;
    }

    lastRestoreAlertRef.current = restoreError;
    Alert.alert("Account restore failed", restoreError);
  }, [restoreError]);

  return (
    <RoleSelectionScreenContent
      onSyncStateChange={setIsManualAuthFlow}
    />
  );
}

function RoleSelectionScreenContent({
  onSyncStateChange,
}: {
  onSyncStateChange?: (active: boolean) => void;
}) {
  const router = useRouter();
  const [rideMotionKey, setRideMotionKey] = useState(0);

  function handleRolePress() {
    setRideMotionKey((current) => current + 1);
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
          overline="WELCOME TO WHEELERS"
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
          selected
          motionKey={rideMotionKey}
          onPress={handleRolePress}
        />
      </RevealView>

      <RevealView delay={220} style={styles.actions}>
        {isPrivyConfigured ? (
          <GoogleContinueButton
            onSyncStateChange={onSyncStateChange}
            buttonStyle={styles.choiceButton}
          />
        ) : (
          <AppButton
            title="Connect with Google"
            disabled
            variant="inverse"
            style={styles.choiceButton}
          />
        )}
        <AppButton
          title="Create an account"
          variant="inverse"
          style={styles.choiceButton}
          onPress={() => {
            onSyncStateChange?.(true);
            router.push("/account-auth");
          }}
        />
      </RevealView>
    </AppScreen>
  );
}

function GoogleContinueButton({
  onSyncStateChange,
  buttonStyle,
}: {
  onSyncStateChange?: (active: boolean) => void;
  buttonStyle?: Parameters<typeof AppButton>[0]["style"];
}) {
  const router = useRouter();
  const { user, isReady, getAccessToken } = usePrivy();
  // const { logout } = usePrivy();
  const { login, state } = useLoginWithOAuth();
  const [syncError, setSyncError] = useState<string | null>(null);
  const hasGoogleLinkedAccount = Boolean(user && hasGoogleAccount(user));
  const [isSyncing, setIsSyncing] = useState(false);
  const lastInlineAlertRef = useRef<string | null>(null);
  // const [isResetting, setIsResetting] = useState(false);
  const isLoading = state.status === "loading";
  const errorMessage =
    syncError ??
    (state.status === "error"
      ? getDisplayErrorMessage(state.error, "Could not continue with Google.")
      : null);

  useEffect(() => {
    if (!errorMessage) {
      lastInlineAlertRef.current = null;
      return;
    }

    if (lastInlineAlertRef.current === errorMessage) {
      return;
    }

    lastInlineAlertRef.current = errorMessage;
    Alert.alert("Sign-in failed", errorMessage);
  }, [errorMessage]);

  async function handlePress() {
    if (isLoading || isSyncing) return;

    setSyncError(null);
    onSyncStateChange?.(true);

    if (!isBackendConfigured()) {
      setSyncError("Set EXPO_PUBLIC_API_BASE_URL before continuing.");
      onSyncStateChange?.(false);
      return;
    }

    if (!isReady) {
      setSyncError("Privy is still initializing. Try again in a moment.");
      onSyncStateChange?.(false);
      return;
    }

    const selectedBackendRole: BackendRole = "RIDER";
    let authenticatedUser = user ?? undefined;
    let requestedRole: BackendRole | undefined = selectedBackendRole;
    if (!authenticatedUser || !hasGoogleAccount(authenticatedUser)) {
      try {
        authenticatedUser = await login({
          provider: "google",
          redirectUri: privyOAuthRedirectPath,
        });
      } catch (error) {
        if (!isIgnorableUserCancelledError(error) || __DEV__) {
          setSyncError(getDisplayErrorMessage(error, "Could not continue with Google."));
        }
        onSyncStateChange?.(false);
        return;
      }
    } else {
      requestedRole = undefined;
    }

    if (!authenticatedUser) {
      onSyncStateChange?.(false);
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
      setSyncError(getDisplayErrorMessage(error, "Could not sync your account with Wheelers."));
      onSyncStateChange?.(false);
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
        style={buttonStyle}
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
  roles: { width: "100%" },
  rolePressable: { width: "100%" },
  roleCard: {
    minHeight: 190,
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xl,
  },
  roleCardSelected: { borderColor: theme.colors.black },
  roleTextBlock: { alignItems: "center", gap: 1 },
  roleIntro: { textAlign: "center", lineHeight: 14, letterSpacing: 0.3 },
  roleAccent: { textAlign: "center", lineHeight: 22, letterSpacing: 0 },
  actions: { gap: theme.spacing.md, marginTop: theme.spacing.sm },
  choiceButton: {
    minHeight: 54,
  },
  googleActionBlock: { gap: theme.spacing.xs },
});
