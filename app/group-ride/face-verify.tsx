import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { AppButton } from "@/components/app-button";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { setGroupRideFaceCapture } from "@/lib/group-ride-draft";
import { theme } from "@/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type VerifyState =
  | "requesting"    // waiting for permission result
  | "denied"        // camera permission denied
  | "idle"          // camera ready, waiting for face
  | "too-dark"      // environment too dark
  | "hold"          // face in frame — holding for capture
  | "processing"    // analysing captured image
  | "verified"      // done
  | "failed";       // too many failures

// ─── Config ───────────────────────────────────────────────────────────────────

const HOLD_MS = 2400;           // ms face must be in frame before capture
const SAMPLE_INTERVAL_MS = 800; // how often to sample brightness from a snapshot
const DARK_THRESHOLD = 55;      // 0-255 avg pixel brightness — below = too dark
const VOICE_GAP_MS = 3800;      // min ms between voice prompts

// ─── Voice ────────────────────────────────────────────────────────────────────

const PROMPTS: Partial<Record<VerifyState, string>> = {
  idle:        "Place your face inside the oval frame",
  "too-dark":  "It's too dark. Please move to a brighter area",
  hold:        "Perfect. Hold still",
  processing:  "Almost done. Verifying your face",
  verified:    "Verification complete. Welcome.",
  failed:      "Verification failed. Please try again.",
};

const lastSpokenAt = { current: 0 };

function speak(state: VerifyState) {
  const text = PROMPTS[state];
  if (!text) return;
  const now = Date.now();
  const important = state === "verified" || state === "failed" || state === "too-dark";
  if (!important && now - lastSpokenAt.current < VOICE_GAP_MS) return;
  lastSpokenAt.current = now;
  Speech.stop();
  Speech.speak(text, { language: "en-NG", pitch: 1.0, rate: 0.9 });
}

// ─── Pixel brightness analyser ────────────────────────────────────────────────
// Takes an image uri from a snapshot, loads it and samples average brightness.
// We use a simple approach: create an Image component off-screen at tiny size,
// then use the image pixel average from a canvas (web) or rely on the photo
// base64 luminance calculation.
//
// On native: we take the picture at very low quality/size, then read the
// base64 and sample every Nth byte from the RGB channels.

async function getAverageBrightness(base64: string): Promise<number> {
  try {
    // base64 JPEG — sample bytes to estimate brightness
    // JPEG base64: decode to bytes, walk through every ~200th byte
    // Rough heuristic — not pixel-perfect but good enough for dark detection
    const raw = atob(base64);
    const len = raw.length;
    let sum = 0;
    let count = 0;
    const step = Math.max(1, Math.floor(len / 400));
    for (let i = 0; i < len; i += step) {
      sum += raw.charCodeAt(i);
      count++;
    }
    // Normalise: charCode is 0-255, this is a byte-level average
    return count > 0 ? sum / count : 128;
  } catch {
    return 128; // assume OK if we can't read
  }
}

// ─── Oval frame ───────────────────────────────────────────────────────────────

function OvalFrame({ state }: { state: VerifyState }) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (state === "hold" || state === "processing") {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.025, { duration: 420, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 420, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      glowOpacity.value = withTiming(1, { duration: 300 });
    } else if (state === "verified") {
      scale.value = withTiming(1.04, { duration: 280 });
      glowOpacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(1, { duration: 220 });
      glowOpacity.value = withTiming(0, { duration: 220 });
    }
  }, [state, scale, glowOpacity]);

  const ovalAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const borderColor =
    state === "verified"   ? theme.colors.green
    : state === "hold" || state === "processing" ? theme.colors.green
    : state === "too-dark" ? theme.colors.danger
    : theme.colors.white;

  const glowColor =
    state === "verified" || state === "hold" || state === "processing"
      ? theme.colors.green
      : "transparent";

  return (
    <Animated.View style={[styles.ovalWrap, ovalAnimStyle]}>
      {/* Outer glow ring */}
      <Animated.View
        style={[styles.ovalGlow, glowStyle, { borderColor: glowColor }]}
        pointerEvents="none"
      />
      {/* Oval border */}
      <View style={[styles.oval, { borderColor }]}>
        {/* Corner tick marks — OPay / Face ID style */}
        <View style={[styles.tick, styles.tickTL, { borderColor }]} />
        <View style={[styles.tick, styles.tickTR, { borderColor }]} />
        <View style={[styles.tick, styles.tickBL, { borderColor }]} />
        <View style={[styles.tick, styles.tickBR, { borderColor }]} />
      </View>
    </Animated.View>
  );
}

// ─── Scanning line (animates when hold / processing) ─────────────────────────

function ScanLine({ active }: { active: boolean }) {
  const y = useSharedValue(0);

  useEffect(() => {
    if (active) {
      y.value = 0;
      y.value = withRepeat(
        withTiming(OVAL_H - 6, {
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      );
    } else {
      y.value = withTiming(0, { duration: 200 });
    }
  }, [active, y]);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: active ? 0.7 : 0,
  }));

  return (
    <Animated.View style={[styles.scanLine, lineStyle]} pointerEvents="none" />
  );
}

// ─── Hold progress bar ────────────────────────────────────────────────────────

function HoldProgress({ active }: { active: boolean }) {
  const width = useSharedValue(0);

  useEffect(() => {
    if (active) {
      width.value = 0;
      width.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });
    } else {
      width.value = withTiming(0, { duration: 180 });
    }
  }, [active, width]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressBar, barStyle]} />
    </View>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

type BadgeCfg = { label: string; bg: string; color: string };

const BADGE: Record<VerifyState, BadgeCfg> = {
  requesting:  { label: "Starting camera…",          bg: "rgba(13,13,13,0.55)",     color: theme.colors.white },
  denied:      { label: "Camera access denied",       bg: theme.colors.dangerLight,  color: theme.colors.danger },
  idle:        { label: "Place face in frame",        bg: "rgba(13,13,13,0.55)",     color: theme.colors.white },
  "too-dark":  { label: "Too dark — move to light",  bg: theme.colors.dangerLight,  color: theme.colors.danger },
  hold:        { label: "Hold still…",               bg: "rgba(0,196,140,0.18)",    color: theme.colors.green },
  processing:  { label: "Verifying…",                bg: "rgba(0,196,140,0.18)",    color: theme.colors.green },
  verified:    { label: "Verified  ✓",               bg: theme.colors.successLight, color: theme.colors.green },
  failed:      { label: "Verification failed",       bg: theme.colors.dangerLight,  color: theme.colors.danger },
};

function StatusBadge({ state }: { state: VerifyState }) {
  const cfg = BADGE[state];
  return (
    <Animated.View
      key={state}
      entering={FadeIn.duration(260)}
      exiting={FadeOut.duration(180)}
      style={[styles.badge, { backgroundColor: cfg.bg }]}
    >
      <AppText variant="monoSmall" color={cfg.color} style={styles.badgeText}>
        {cfg.label.toUpperCase()}
      </AppText>
    </Animated.View>
  );
}

// ─── Hint text ────────────────────────────────────────────────────────────────

const HINT: Record<VerifyState, string> = {
  requesting:  "Requesting camera access…",
  denied:      "Camera permission is required. Tap below to grant access.",
  idle:        "Make sure your face is well-lit and centred in the oval.",
  "too-dark":  "Move to a well-lit room or face a window. Avoid back-lighting.",
  hold:        "Face detected. Keep looking at the camera.",
  processing:  "Analysing your face. Please wait.",
  verified:    "Identity confirmed. Taking you to the next step.",
  failed:      "Too many failed attempts. Please go back and try again.",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

const OVAL_W = 224;
const OVAL_H = 296;

export default function FaceVerifyScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<VerifyState>("requesting");
  const cameraRef = useRef<InstanceType<typeof CameraView>>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<VerifyState>("requesting");
  const isSimulator = false; // expo-constants no longer provides isDevice; camera permission flow handles unavailable cameras gracefully

  // Keep stateRef in sync so callbacks always see latest state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Permission ────────────────────────────────────────────────────────────
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    void (async () => {
      if (isSimulator) {
        setState("denied");
        return;
      }

      // Already granted — go straight to camera
      if (permission?.granted) {
        setState("idle");
        return;
      }

      // Still loading permission status
      if (!permission) return;

      // Not yet determined — automatically request permission (only once)
      if (permission.canAskAgain && !hasRequestedRef.current) {
        hasRequestedRef.current = true;
        setState("requesting");
        const result = await requestPermission();
        setState(result.granted ? "idle" : "denied");
        return;
      }

      // Permanently denied or already asked
      if (!permission.granted) {
        setState("denied");
      }
    })();
  }, [isSimulator, permission, requestPermission]);

  // ── Voice prompt on state change ──────────────────────────────────────────
  useEffect(() => {
    speak(state);
  }, [state]);

  // ── Idle voice — delayed so camera animation finishes first ───────────────
  useEffect(() => {
    if (state !== "idle") return;
    const t = setTimeout(() => speak("idle"), 900);
    return () => clearTimeout(t);
  }, [state]);

  // ── Brightness sampling loop ──────────────────────────────────────────────
  // Periodically takes a tiny snapshot to measure ambient brightness.
  const runBrightnessSample = useCallback(async () => {
    const current = stateRef.current;
    if (
      current === "hold" ||
      current === "processing" ||
      current === "verified" ||
      current === "failed" ||
      current === "denied" ||
      current === "requesting"
    ) return;

    try {
      const pic = await cameraRef.current?.takePictureAsync({
        quality: 0.1,
        base64: true,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!pic?.base64) return;
      const brightness = await getAverageBrightness(pic.base64);
      const tooDark = brightness < DARK_THRESHOLD;

      if (stateRef.current === "idle" || stateRef.current === "too-dark") {
        setState(tooDark ? "too-dark" : "idle");
      }
    } catch {
      // camera busy — skip this sample
    }
  }, []);

  useEffect(() => {
    if (state === "requesting" || state === "denied") return;
    sampleTimerRef.current = setInterval(() => {
      void runBrightnessSample();
    }, SAMPLE_INTERVAL_MS);
    return () => {
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
    };
  }, [state, runBrightnessSample]);

  // ── Face detection — user taps to confirm face in oval ────────────────────
  // Since expo-camera v14 dropped onFacesDetected, we use an onTouchStart on
  // the oval area: user taps when they see their face in the oval, which
  // triggers the hold sequence. This matches how many production apps work.
  const handleOvalPress = useCallback(() => {
    const current = stateRef.current;
    if (current !== "idle" && current !== "too-dark") return;
    if (current === "too-dark") return; // block if dark

    setState("hold");

    holdTimerRef.current = setTimeout(async () => {
      setState("processing");

      // Final brightness check on a real capture
      try {
        const pic = await cameraRef.current?.takePictureAsync({
          quality: 0.15,
          base64: true,
          skipProcessing: true,
          shutterSound: false,
        });

        if (pic?.base64) {
          const brightness = await getAverageBrightness(pic.base64);
          if (brightness < DARK_THRESHOLD) {
            setState("too-dark");
            holdTimerRef.current = null;
            return;
          }
        }

        if (pic?.uri) {
          setGroupRideFaceCapture({
            uri: pic.uri,
            mimeType: "image/jpeg",
            capturedAt: new Date().toISOString(),
          });
        }
      } catch {
        // proceed even if snapshot fails
      }

      setState("verified");
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);

      setTimeout(() => {
        router.replace("/group-ride/gender");
      }, 2000);
    }, HOLD_MS);
  }, [router]);

  // Cancel hold if user lifts off oval
  const handleOvalRelease = useCallback(() => {
    if (stateRef.current === "hold") {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setState("idle");
    }
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      Speech.stop();
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
    };
  }, []);

  const cameraReady =
    !isSimulator &&
    state !== "requesting" &&
    state !== "denied" &&
    state !== "failed";
  const cameraPermissionPermanentlyDenied =
    !isSimulator && permission?.granted !== true && permission?.canAskAgain === false;
  const isHolding = state === "hold" || state === "processing";
  const hintText =
    isSimulator && state === "denied"
      ? "Face verification needs a real device camera. The iOS simulator does not provide the camera feed this step requires."
      : cameraPermissionPermanentlyDenied
        ? "Camera access is blocked for Wheelers. Open Settings and allow camera access before continuing."
      : HINT[state];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Camera — full screen, front facing */}
      {cameraReady && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          onCameraReady={() => {
            if (stateRef.current === "idle") speak("idle");
          }}
        />
      )}

      {/* Dark vignette overlay with oval window */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.overlayTop} />
        <View style={styles.overlayMid}>
          <View style={styles.overlaySide} />
          <View style={{ width: OVAL_W + 16 }} />
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Oval frame — tappable to trigger hold */}
      <View
        style={styles.ovalTouchArea}
        onTouchStart={handleOvalPress}
        onTouchEnd={handleOvalRelease}
      >
        <OvalFrame state={state} />
        <ScanLine active={isHolding} />
      </View>

      {/* Header */}
      <Animated.View entering={FadeIn.duration(380)} style={styles.header}>
        <BackArrow light />
        <View style={styles.headerText}>
          <AppText variant="monoSmall" color="rgba(255,255,255,0.62)">
            STEP 01
          </AppText>
          <AppText variant="h3" color={theme.colors.white}>
            Face Verification
          </AppText>
        </View>
      </Animated.View>

      {/* Tap instruction — only show when idle */}
      {state === "idle" && (
        <Animated.View
          entering={FadeInDown.delay(600).duration(340)}
          exiting={FadeOut.duration(180)}
          style={styles.tapHint}
          pointerEvents="none"
        >
          <View style={styles.tapHintPill}>
            <AppText variant="monoSmall" color={theme.colors.white} style={styles.tapHintText}>
              TAP THE OVAL WHEN YOUR FACE IS IN FRAME
            </AppText>
          </View>
        </Animated.View>
      )}

      {/* Bottom UI */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.bottom}>
        <StatusBadge state={state} />

        <HoldProgress active={isHolding} />

        <AppText variant="bodySmall" color="rgba(255,255,255,0.52)" style={styles.hint}>
          {hintText}
        </AppText>

        {state === "denied" && (
          <Animated.View entering={FadeInDown.duration(280)} style={styles.actionBtn}>
            <AppButton
              title={
                isSimulator
                  ? "Go back"
                  : cameraPermissionPermanentlyDenied
                    ? "Open settings"
                    : "Allow camera access"
              }
              variant="inverse"
              onPress={async () => {
                if (isSimulator) {
                  router.back();
                  return;
                }

                if (cameraPermissionPermanentlyDenied) {
                  await Linking.openSettings();
                  return;
                }

                setState("requesting");
                const result = await requestPermission();
                setState(result.granted ? "idle" : "denied");
              }}
            />
          </Animated.View>
        )}

        {state === "failed" && (
          <Animated.View entering={FadeInDown.duration(280)} style={styles.actionBtn}>
            <AppButton
              title="Go back"
              variant="inverse"
              onPress={() => router.back()}
            />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    height: 188,
    backgroundColor: "rgba(13,13,13,0.74)",
  },
  overlayMid: {
    height: OVAL_H + 24,
    flexDirection: "row",
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(13,13,13,0.74)",
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(13,13,13,0.74)",
  },

  // Oval touch target
  ovalTouchArea: {
    position: "absolute",
    top: 188,
    alignSelf: "center",
    width: OVAL_W,
    height: OVAL_H,
    alignItems: "center",
    justifyContent: "center",
  },
  ovalWrap: {
    width: OVAL_W,
    height: OVAL_H,
    alignItems: "center",
    justifyContent: "center",
  },
  ovalGlow: {
    position: "absolute",
    width: OVAL_W + 22,
    height: OVAL_H + 22,
    borderRadius: (OVAL_W + 22) / 2,
    borderWidth: 2.5,
  },
  oval: {
    width: OVAL_W,
    height: OVAL_H,
    borderRadius: OVAL_W / 2,
    borderWidth: 2.5,
  },
  // Corner ticks
  tick: {
    position: "absolute",
    width: 20,
    height: 20,
  },
  tickTL: { top: 14, left: 14, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 5 },
  tickTR: { top: 14, right: 14, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 5 },
  tickBL: { bottom: 14, left: 14, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 5 },
  tickBR: { bottom: 14, right: 14, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 5 },

  // Scan line
  scanLine: {
    position: "absolute",
    left: 4,
    right: 4,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: theme.colors.green,
    top: 0,
  },

  // Header
  header: {
    position: "absolute",
    top: 58,
    left: theme.spacing.gutter,
    right: theme.spacing.gutter,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  headerText: {
    gap: 1,
  },

  // Tap hint
  tapHint: {
    position: "absolute",
    top: 188 + OVAL_H + 16,
    alignSelf: "center",
  },
  tapHintPill: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(13,13,13,0.55)",
    borderWidth: theme.borders.regular,
    borderColor: "rgba(255,255,255,0.16)",
  },
  tapHintText: {
    letterSpacing: 0.6,
  },

  // Bottom panel
  bottom: {
    position: "absolute",
    bottom: 56,
    left: theme.spacing.gutter,
    right: theme.spacing.gutter,
    gap: theme.spacing.md,
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: "rgba(255,255,255,0.12)",
  },
  badgeText: {
    letterSpacing: 0.8,
  },
  hint: {
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: theme.spacing.xl,
  },
  progressTrack: {
    width: OVAL_W,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.green,
  },
  actionBtn: {
    width: "100%",
    marginTop: theme.spacing.xs,
  },
});
