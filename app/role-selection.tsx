import { Redirect, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { RingStack, StarBurst } from "@/components/decorative-shapes";
import { FlowHeader } from "@/components/flow-header";
import { FloatingView, PulseView, RevealView } from "@/components/motion";
import { RoleMotionBadge } from "@/components/role-motion-badge";
import { getAccessTokenWithRetry } from "@/lib/access-token";
import { isDriverApp, publicEntryRoute } from "@/lib/app-variant";
import {
  isBackendConfigured,
  getCurrentProfile,
} from "@/lib/api";
import {
  getAuthenticatedRoute,
  persistAuthenticatedRole,
  readStoredAuthState,
} from "@/lib/auth-state";
import { useAuth } from "@/lib/auth";
import { theme } from "@/theme";

type Role = "ride";

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { getAccessToken, isReady, user } = useAuth();
  const hasNavigated = useRef(false);

  // If user already has a stored session, redirect them
  useEffect(() => {
    if (!isReady || !user) return;

    let cancelled = false;

    void (async () => {
      const storedState = await readStoredAuthState();
      if (cancelled || hasNavigated.current) return;

      if (storedState) {
        hasNavigated.current = true;
        router.replace(getAuthenticatedRoute(storedState));
        return;
      }

      // Have a token but no stored state — try to restore from backend
      if (!isBackendConfigured()) return;

      const accessToken = await getAccessTokenWithRetry(getAccessToken);
      if (!accessToken || cancelled || hasNavigated.current) return;

      try {
        const response = await getCurrentProfile({ accessToken });
        const role = response.user.role === "DRIVER" ? "DRIVER" : "RIDER";
        const nextState = await persistAuthenticatedRole(role, {
          phoneVerified:
            role === "RIDER" &&
            typeof response.user.phone === "string" &&
            response.user.phone.length > 0,
        });

        if (!cancelled && !hasNavigated.current) {
          hasNavigated.current = true;
          router.replace(getAuthenticatedRoute(nextState));
        }
      } catch {
        // Could not restore — stay on selection screen
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isReady, router, user]);

  if (isDriverApp) {
    return <Redirect href={publicEntryRoute} />;
  }

  return <RoleSelectionScreenContent />;
}

function RoleSelectionScreenContent() {
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
        <AppButton
          title="Create an account"
          variant="inverse"
          style={styles.choiceButton}
          onPress={() => router.push("/account-auth")}
        />
        <AppButton
          title="Sign in"
          variant="inverse"
          style={styles.choiceButton}
          onPress={() => router.push("/account-auth")}
        />
      </RevealView>
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
});
