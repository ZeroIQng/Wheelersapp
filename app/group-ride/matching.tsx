import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { usePrivy } from "@privy-io/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { getAccessTokenWithRetry } from "@/lib/access-token";
import { createIdempotencyKey } from "@/lib/idempotency";
import {
  completeGroupRideFaceUpload,
  createGroupRideFaceUploadUrl,
  createGroupRideMatchRequest,
  getGroupRideMatchRequest,
  type GroupRideGenderPreference,
  type GroupRideMatchRequest,
} from "@/lib/api";
import {
  clearGroupRideFaceCapture,
  getGroupRideFaceCapture,
} from "@/lib/group-ride-draft";
import { resolvePlaceQuery } from "@/lib/google-places";
import { theme } from "@/theme";

const MATCH_POLL_MS = 3000;

function getGroupRideStatusCopy(status: GroupRideMatchRequest["status"] | null) {
  switch (status) {
    case "PENDING_FACE_UPLOAD":
      return {
        heading: "Uploading your\nverification",
        body: "Securing your request before matching starts.",
      };
    case "READY_FOR_MATCH":
      return {
        heading: "Preparing\nyour match",
        body: "Your route is queued for shared-ride matching.",
      };
    case "MATCHING":
      return {
        heading: "Finding other\nriders",
        body: "Matching you with riders headed the same way.",
      };
    case "GROUPED":
      return {
        heading: "Riders found\nnearby",
        body: "Wheelers is building the shared route now.",
      };
    case "BOOKED":
      return {
        heading: "Group ride\nbooked",
        body: "Your shared ride is confirmed.",
      };
    case "EXPIRED":
      return {
        heading: "Match window\nexpired",
        body: "No compatible riders were available in time.",
      };
    case "CANCELLED":
      return {
        heading: "Request\ncancelled",
        body: "This group ride request is no longer active.",
      };
    default:
      return {
        heading: "Creating your\nrequest",
        body: "Preparing your route and verification details.",
      };
  }
}

async function uploadFaceImage(uploadUrl: string, uri: string, mimeType: string) {
  const fileResponse = await fetch(uri);
  const blob = await fileResponse.blob();
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": mimeType,
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error("Could not upload the face verification image.");
  }
}

export default function GroupRideMatchingScreen() {
  const router = useRouter();
  const { getAccessToken, isReady, user } = usePrivy();
  const params = useLocalSearchParams<{
    pickup?: string;
    destination?: string;
    genderPreference?: string;
  }>();
  const [requestId, setRequestId] = useState<string | null>(null);
  const [matchStatus, setMatchStatus] = useState<GroupRideMatchRequest["status"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastErrorAlertRef = useRef<string | null>(null);
  const createRequestIdempotencyKeyRef = useRef<string | null>(null);
  const genderPreference = normalizeGenderPreference(params.genderPreference);

  // Pulse rings
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);

  // Center dot pulse
  const centerScale = useSharedValue(1);

  // Rotating radar sweep
  const rotation = useSharedValue(0);

  // Floating dot positions
  const dot1Y = useSharedValue(0);
  const dot2Y = useSharedValue(0);
  const dot3Y = useSharedValue(0);

  useEffect(() => {
    const ringConfig = { duration: 2200, easing: Easing.out(Easing.cubic) };

    ring1.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, ringConfig),
      ),
      -1,
      false,
    );

    ring2.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, ringConfig),
        ),
        -1,
        false,
      ),
    );

    ring3.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, ringConfig),
        ),
        -1,
        false,
      ),
    );

    centerScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );

    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );

    const floatConfig = { duration: 1800, easing: Easing.inOut(Easing.quad) };
    dot1Y.value = withRepeat(
      withSequence(withTiming(-8, floatConfig), withTiming(0, floatConfig)),
      -1,
      true,
    );
    dot2Y.value = withDelay(
      400,
      withRepeat(
        withSequence(withTiming(-8, floatConfig), withTiming(0, floatConfig)),
        -1,
        true,
      ),
    );
    dot3Y.value = withDelay(
      800,
      withRepeat(
        withSequence(withTiming(-8, floatConfig), withTiming(0, floatConfig)),
        -1,
        true,
      ),
    );
  }, [centerScale, dot1Y, dot2Y, dot3Y, ring1, ring2, ring3, rotation]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function pollRequest(accessToken: string, activeRequestId: string) {
      const response = await getGroupRideMatchRequest({
        accessToken,
        requestId: activeRequestId,
      });

      if (cancelled) {
        return;
      }

      setMatchStatus(response.item.status);

      if (response.item.status === "BOOKED") {
        router.replace({
          pathname: "/group-ride/ride-selection",
          params: {
            requestId: response.item.id,
          },
        });
        return;
      }

      if (response.item.status === "EXPIRED") {
        setError("No nearby riders were available for this group ride. Try again in a moment.");
        return;
      }

      if (response.item.status === "CANCELLED") {
        setError("This group ride request was cancelled.");
        return;
      }

      pollTimer = setTimeout(() => {
        void pollRequest(accessToken, activeRequestId);
      }, MATCH_POLL_MS);
    }

    void (async () => {
      try {
        if (!isReady || !user) {
          throw new Error("Sign in before requesting a group ride.");
        }

        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken) {
          throw new Error("Could not get a valid access token.");
        }

        const faceCapture = getGroupRideFaceCapture();
        if (!faceCapture) {
          throw new Error("Complete face verification before requesting a group ride.");
        }

        const [pickup, destination] = await Promise.all([
          resolvePlaceQuery(params.pickup ?? ""),
          resolvePlaceQuery(params.destination ?? ""),
        ]);

        const created = await createGroupRideMatchRequest({
          accessToken,
          idempotencyKey:
            createRequestIdempotencyKeyRef.current ??
            (createRequestIdempotencyKeyRef.current = createIdempotencyKey(
              "group-ride-request",
            )),
          pickup,
          destination,
          stops: [],
          genderPreference,
          paymentMethod: "wallet_balance",
        });

        if (cancelled) {
          return;
        }

        setRequestId(created.item.id);
        setMatchStatus(created.item.status);

        const upload = await createGroupRideFaceUploadUrl({
          accessToken,
          requestId: created.item.id,
          mimeType: faceCapture.mimeType,
          capturedAt: faceCapture.capturedAt,
        });

        await uploadFaceImage(
          upload.upload.uploadUrl,
          faceCapture.uri,
          faceCapture.mimeType,
        );

        const completed = await completeGroupRideFaceUpload({
          accessToken,
          requestId: created.item.id,
          capturedAt: faceCapture.capturedAt,
        });

        clearGroupRideFaceCapture();

        if (cancelled) {
          return;
        }

        setMatchStatus(completed.item.status);
        await pollRequest(accessToken, created.item.id);
      } catch (matchingError) {
        if (!cancelled) {
          setError(
            matchingError instanceof Error
              ? matchingError.message
              : "Could not start group ride matching.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, [
    genderPreference,
    getAccessToken,
    isReady,
    params.destination,
    params.pickup,
    router,
    user,
  ]);

  const ring1Style = useAnimatedStyle(() => ({
    opacity: 1 - ring1.value,
    transform: [{ scale: 0.5 + ring1.value * 1.4 }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: 1 - ring2.value,
    transform: [{ scale: 0.5 + ring2.value * 1.4 }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    opacity: 1 - ring3.value,
    transform: [{ scale: 0.5 + ring3.value * 1.4 }],
  }));
  const centerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerScale.value }],
  }));
  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1Y.value }],
  }));
  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2Y.value }],
  }));
  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3Y.value }],
  }));

  useEffect(() => {
    if (!error) {
      lastErrorAlertRef.current = null;
      return;
    }

    if (lastErrorAlertRef.current === error) {
      return;
    }

    lastErrorAlertRef.current = error;
    Alert.alert("Group ride failed", error);
  }, [error]);
  const statusCopy = getGroupRideStatusCopy(matchStatus);

  return (
    <AppScreen
      backgroundColor={theme.colors.black}
      scroll={false}
      contentStyle={styles.container}
      safeAreaEdges={["top", "left", "right", "bottom"]}
    >
      <StatusBar style="light" />

      {/* Route pill at top */}
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.routePill}>
        <View style={styles.routePillDot} />
        <AppText variant="bodySmall" color={theme.colors.offWhite} numberOfLines={1} style={styles.routePillText}>
          {params.destination ?? "Your destination"}
        </AppText>
      </Animated.View>

      {/* Radar animation */}
      <View style={styles.radarWrap}>
        {/* Expanding rings */}
        <Animated.View style={[styles.ring, styles.ring1, ring1Style]} />
        <Animated.View style={[styles.ring, styles.ring2, ring2Style]} />
        <Animated.View style={[styles.ring, styles.ring3, ring3Style]} />

        {/* Rotating sweep arm */}
        <Animated.View style={[styles.sweepArm, rotationStyle]} pointerEvents="none">
          <View style={styles.sweepLine} />
          <View style={styles.sweepDot} />
        </Animated.View>

        {/* Center icon */}
        <Animated.View style={[styles.centerWrap, centerStyle]}>
          <View style={styles.centerDot}>
            <MaterialIcons name="group" size={28} color={theme.colors.black} />
          </View>
        </Animated.View>

        {/* Floating rider dots */}
        <Animated.View style={[styles.floatDot, styles.floatDot1, dot1Style]}>
          <MaterialIcons name="person-pin" size={20} color={theme.colors.orange} />
        </Animated.View>
        <Animated.View style={[styles.floatDot, styles.floatDot2, dot2Style]}>
          <MaterialIcons name="person-pin" size={16} color={theme.colors.green} />
        </Animated.View>
        <Animated.View style={[styles.floatDot, styles.floatDot3, dot3Style]}>
          <MaterialIcons name="person-pin" size={18} color={theme.colors.orange} />
        </Animated.View>
      </View>

      {/* Status text */}
      <Animated.View entering={FadeIn.delay(300).duration(600)} style={styles.statusWrap}>
        <AppText variant="h1" color={theme.colors.offWhite} style={styles.heading}>
          {statusCopy.heading}
        </AppText>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.pingDot, dot1Style]} />
          <Animated.View style={[styles.pingDot, dot2Style]} />
          <Animated.View style={[styles.pingDot, dot3Style]} />
        </View>
        <AppText variant="bodySmall" color={theme.colors.muted} style={styles.subText}>
          {statusCopy.body}
        </AppText>
      </Animated.View>

      {/* Info card */}
      <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <MaterialIcons name="savings" size={18} color={theme.colors.orange} />
          </View>
          <View style={styles.infoCopy}>
            <AppText variant="bodyMedium" color={theme.colors.offWhite}>
              {requestId ? `Request ${requestId.slice(0, 8)}` : "Split the fare"}
            </AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              {matchStatus === "GROUPED" || matchStatus === "BOOKED"
                ? "Shared route found and being finalised for your group."
                : "Ride cost is shared between all matched riders."}
            </AppText>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <MaterialIcons name="verified-user" size={18} color={theme.colors.green} />
          </View>
          <View style={styles.infoCopy}>
            <AppText variant="bodyMedium" color={theme.colors.offWhite}>Face-verified riders only</AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              {`Matching preference: ${formatGenderPreference(genderPreference)}.`}
            </AppText>
          </View>
        </View>
      </Animated.View>

      {error ? (
        <View style={styles.actionWrap}>
          <AppButton
            title="Try again"
            onPress={() => router.replace("/group-ride/destination")}
          />
        </View>
      ) : null}
    </AppScreen>
  );
}

function normalizeGenderPreference(
  value: string | string[] | undefined,
): GroupRideGenderPreference {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "women_only" || raw === "men_only" || raw === "any") {
    return raw;
  }

  return "any";
}

function formatGenderPreference(value: GroupRideGenderPreference): string {
  if (value === "women_only") return "Women only";
  if (value === "men_only") return "Men only";
  return "Any verified rider";
}

const RADAR_SIZE = 260;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.gutter,
    paddingBottom: theme.spacing.xxl,
  },
  routePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: theme.borders.regular,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    maxWidth: 280,
  },
  routePillDot: {
    width: 6,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
    flexShrink: 0,
  },
  routePillText: {
    flex: 1,
  },
  radarWrap: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 1.5,
  },
  ring1: {
    borderColor: theme.colors.orange,
  },
  ring2: {
    borderColor: theme.colors.orange,
    opacity: 0.7,
  },
  ring3: {
    borderColor: theme.colors.orange,
    opacity: 0.4,
  },
  sweepArm: {
    position: "absolute",
    width: RADAR_SIZE / 2,
    height: 2,
    left: RADAR_SIZE / 2,
    top: RADAR_SIZE / 2 - 1,
    transformOrigin: "0% 50%",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sweepLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.colors.orange,
    opacity: 0.5,
  },
  sweepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.orange,
    marginRight: -4,
  },
  centerWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  centerDot: {
    alignItems: "center",
    justifyContent: "center",
  },
  floatDot: {
    position: "absolute",
  },
  floatDot1: {
    top: 30,
    right: 40,
  },
  floatDot2: {
    bottom: 44,
    left: 36,
  },
  floatDot3: {
    bottom: 30,
    right: 30,
  },
  statusWrap: {
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  heading: {
    textAlign: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "center",
  },
  pingDot: {
    width: 7,
    height: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
  },
  subText: {
    textAlign: "center",
  },
  infoCard: {
    width: "100%",
    borderWidth: theme.borders.thick,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: theme.radius.lg,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  actionWrap: {
    width: "100%",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoCopy: {
    flex: 1,
    gap: 2,
  },
  infoDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
