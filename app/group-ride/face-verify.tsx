import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, Linking, StyleSheet, View } from "react-native";
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
import Svg, {
  Defs,
  Ellipse,
  Mask,
  Path,
  Rect,
} from "react-native-svg";

import { AppButton } from "@/components/app-button";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { setGroupRideFaceCapture } from "@/lib/group-ride-draft";
import { theme } from "@/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────

type VerifyState =
  | "requesting"    // waiting for permission result
  | "denied"        // camera permission denied
  | "scanning"      // camera ready, checking the frame
  | "too-dark"      // environment too dark
  | "detected"      // frame is usable, capture is queued
  | "processing"    // capturing final image
  | "verified"      // done
  | "failed";       // too many failures

// ─── Config ───────────────────────────────────────────────────────────────────

const CAPTURE_DELAY_MS = 650;             // small delay so the UI can show progress
const SAMPLE_INTERVAL_MS = 850;           // how often to sample a snapshot
const DARK_THRESHOLD = 48;                // 0-255 avg brightness — below = too dark
const VOICE_GAP_MS = 4000;               // min ms between voice prompts
const MAX_FAILURES = 6;                   // failures before "failed" state

// ─── Oval dimensions ─────────────────────────────────────────────────────────

const OVAL_W = 300;
const OVAL_H = 400;
const OVAL_TOP = 150;                     // distance from top of screen

// ─── Voice ────────────────────────────────────────────────────────────────────

const PROMPTS: Partial<Record<VerifyState, string>> = {
  scanning:    "Center your face inside the oval frame",
  "too-dark":  "It's too dark. Please move to a brighter area",
  detected:    "Face framed. Capturing now",
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

// ─── Camera frame analyser ───────────────────────────────────────────────────
// The frontend only gates unusable lighting. The backend does the real identity
// verification after the image is uploaded.

type AnalysisResult = {
  brightness: number;
  isBrightEnough: boolean;
};

function analyzeCameraFrame(base64: string): AnalysisResult {
  try {
    const raw = atob(base64);
    const len = raw.length;

    if (len < 800) return { brightness: 0, isBrightEnough: false };

    // Skip JPEG header (~600 bytes of metadata)
    const dataStart = Math.min(600, Math.floor(len * 0.05));
    const dataLen = len - dataStart;

    let sum = 0;
    let count = 0;
    const sampleCount = 900;
    const step = Math.max(1, Math.floor(dataLen / sampleCount));

    for (let i = dataStart; i < len; i += step) {
      sum += raw.charCodeAt(i);
      count++;
    }

    const brightness = count > 0 ? sum / count : 0;
    return {
      brightness,
      isBrightEnough: brightness >= DARK_THRESHOLD,
    };
  } catch {
    return { brightness: 0, isBrightEnough: false };
  }
}

// ─── SVG Oval frame with white guide markers ─────────────────────────────────

const SVG_PAD = 24;
const SVG_W = OVAL_W + SVG_PAD * 2;
const SVG_H = OVAL_H + SVG_PAD * 2;
const CX = SVG_W / 2;
const CY = SVG_H / 2;
const RX = OVAL_W / 2;
const RY = OVAL_H / 2;

// Helper: point on ellipse at angle t (radians)
function ellipsePoint(t: number): [number, number] {
  return [CX + RX * Math.cos(t), CY + RY * Math.sin(t)];
}

// Build arc path between two angles
function arcPath(startAngle: number, endAngle: number): string {
  const [x1, y1] = ellipsePoint(startAngle);
  const [x2, y2] = ellipsePoint(endAngle);
  // SVG arc: A rx ry x-rotation large-arc-flag sweep-flag x y
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${RX} ${RY} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// Guide marker arcs — ~30 degrees each at cardinal positions
const DEG = Math.PI / 180;
const GUIDE_SPAN = 20 * DEG; // 20 degrees each side of cardinal
const topArc = arcPath(-90 * DEG - GUIDE_SPAN, -90 * DEG + GUIDE_SPAN);
const bottomArc = arcPath(90 * DEG - GUIDE_SPAN, 90 * DEG + GUIDE_SPAN);
const leftArc = arcPath(180 * DEG - GUIDE_SPAN, 180 * DEG + GUIDE_SPAN);
const rightArc = arcPath(-GUIDE_SPAN, GUIDE_SPAN);

// ─── Oval overlay (dark everywhere EXCEPT the oval cutout) ──────────────────

const OVERLAY_CX = SCREEN_W / 2;
const OVERLAY_CY = OVAL_TOP + OVAL_H / 2;
const OVERLAY_RX = OVAL_W / 2;
const OVERLAY_RY = OVAL_H / 2;

function OvalOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SCREEN_W} height={SCREEN_H}>
        <Defs>
          <Mask id="ovalMask">
            {/* White = visible (dark overlay shows), black = hidden (oval cutout) */}
            <Rect x={0} y={0} width={SCREEN_W} height={SCREEN_H} fill="white" />
            <Ellipse cx={OVERLAY_CX} cy={OVERLAY_CY} rx={OVERLAY_RX} ry={OVERLAY_RY} fill="black" />
          </Mask>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={SCREEN_W}
          height={SCREEN_H}
          fill="rgba(13,13,13,0.78)"
          mask="url(#ovalMask)"
        />
      </Svg>
    </View>
  );
}

function OvalFrame({ state }: { state: VerifyState }) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (state === "detected" || state === "processing") {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      glowOpacity.value = withTiming(1, { duration: 300 });
    } else if (state === "verified") {
      scale.value = withTiming(1.03, { duration: 280 });
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

  const strokeColor =
    state === "verified" ? theme.colors.green
    : state === "detected" || state === "processing" ? theme.colors.green
    : state === "too-dark" ? theme.colors.danger
    : "rgba(255,255,255,0.5)";

  const glowColor =
    state === "verified" || state === "detected" || state === "processing"
      ? theme.colors.green
      : "transparent";

  return (
    <Animated.View style={[styles.ovalWrap, ovalAnimStyle]}>
      {/* Outer glow ring */}
      <Animated.View
        style={[styles.ovalGlow, glowStyle, { borderColor: glowColor }]}
        pointerEvents="none"
      />
      {/* SVG oval + guide markers */}
      <Svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
        {/* Main oval border */}
        <Ellipse
          cx={CX}
          cy={CY}
          rx={RX}
          ry={RY}
          stroke={strokeColor}
          strokeWidth={2.5}
          fill="none"
        />
        {/* White guide markers at cardinal positions */}
        <Path d={topArc} stroke={theme.colors.white} strokeWidth={4.5} fill="none" strokeLinecap="round" />
        <Path d={bottomArc} stroke={theme.colors.white} strokeWidth={4.5} fill="none" strokeLinecap="round" />
        <Path d={leftArc} stroke={theme.colors.white} strokeWidth={4.5} fill="none" strokeLinecap="round" />
        <Path d={rightArc} stroke={theme.colors.white} strokeWidth={4.5} fill="none" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

// ─── Step progress (green completion steps) ─────────────────────────────────

type StepStatus = "pending" | "active" | "done";

const STEPS = [
  { key: "frame", label: "Frame ready" },
  { key: "light", label: "Light checked" },
  { key: "capture", label: "Capturing" },
  { key: "verify", label: "Verified" },
] as const;

function getStepStatuses(state: VerifyState): StepStatus[] {
  switch (state) {
    case "requesting":
    case "denied":
      return ["pending", "pending", "pending", "pending"];
    case "scanning":
      return ["active", "pending", "pending", "pending"];
    case "too-dark":
      return ["done", "active", "pending", "pending"];
    case "detected":
      return ["done", "done", "active", "pending"];
    case "processing":
      return ["done", "done", "active", "pending"];
    case "verified":
      return ["done", "done", "done", "done"];
    case "failed":
      return ["pending", "pending", "pending", "pending"];
    default:
      return ["pending", "pending", "pending", "pending"];
  }
}

function StepProgress({ state }: { state: VerifyState }) {
  const statuses = getStepStatuses(state);

  return (
    <View style={styles.stepsRow}>
      {STEPS.map((step, i) => {
        const status = statuses[i];
        const isDone = status === "done";
        const isActive = status === "active";

        const dotBg = isDone
          ? theme.colors.green
          : isActive
            ? theme.colors.green
            : "rgba(255,255,255,0.18)";
        const dotBorder = isDone || isActive
          ? theme.colors.green
          : "rgba(255,255,255,0.25)";
        const labelColor = isDone
          ? theme.colors.green
          : isActive
            ? theme.colors.white
            : "rgba(255,255,255,0.35)";

        return (
          <View key={step.key} style={styles.stepItem}>
            <View style={styles.stepDotRow}>
              {/* Connector line before (skip first) */}
              {i > 0 && (
                <View
                  style={[
                    styles.stepConnector,
                    { backgroundColor: isDone ? theme.colors.green : "rgba(255,255,255,0.12)" },
                  ]}
                />
              )}
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: dotBg, borderColor: dotBorder },
                  isActive && styles.stepDotActive,
                ]}
              >
                {isDone && (
                  <AppText variant="monoSmall" color={theme.colors.white} style={{ fontSize: 10, lineHeight: 14 }}>
                    {"\u2713"}
                  </AppText>
                )}
              </View>
            </View>
            <AppText variant="monoSmall" color={labelColor} style={styles.stepLabel}>
              {step.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

// ─── Scanning line (animates during scanning / detected / processing) ───────

function ScanLine({ state }: { state: VerifyState }) {
  const y = useSharedValue(0);
  const active = state === "scanning" || state === "detected" || state === "processing";
  const speed = state === "detected" || state === "processing" ? 1200 : 2200;

  useEffect(() => {
    if (active) {
      y.value = 0;
      y.value = withRepeat(
        withTiming(OVAL_H - 6, {
          duration: speed,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      );
    } else {
      y.value = withTiming(0, { duration: 200 });
    }
  }, [active, speed, y]);

  const lineColor =
    state === "detected" || state === "processing"
      ? theme.colors.green
      : "rgba(255,255,255,0.5)";

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: active ? 0.7 : 0,
  }));

  return (
    <Animated.View
      style={[styles.scanLine, lineStyle, { backgroundColor: lineColor }]}
      pointerEvents="none"
    />
  );
}

// ─── Hold progress bar ────────────────────────────────────────────────────────

function CaptureProgress({ active }: { active: boolean }) {
  const width = useSharedValue(0);

  useEffect(() => {
    if (active) {
      width.value = 0;
      width.value = withTiming(1, { duration: CAPTURE_DELAY_MS, easing: Easing.linear });
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
  requesting:  { label: "Starting camera\u2026",          bg: "rgba(13,13,13,0.55)",     color: theme.colors.white },
  denied:      { label: "Camera access denied",       bg: theme.colors.dangerLight,  color: theme.colors.danger },
  scanning:    { label: "Checking frame\u2026",           bg: "rgba(13,13,13,0.55)",     color: theme.colors.white },
  "too-dark":  { label: "Too dark \u2014 move to light",  bg: theme.colors.dangerLight,  color: theme.colors.danger },
  detected:    { label: "Frame ready",                bg: "rgba(0,196,140,0.18)",    color: theme.colors.green },
  processing:  { label: "Capturing\u2026",                bg: "rgba(0,196,140,0.18)",    color: theme.colors.green },
  verified:    { label: "Verified  \u2713",               bg: theme.colors.successLight, color: theme.colors.green },
  failed:      { label: "Verification failed",        bg: theme.colors.dangerLight,  color: theme.colors.danger },
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
  requesting:  "Requesting camera access\u2026",
  denied:      "Camera permission is required. Tap below to grant access.",
  scanning:    "Center your face in the oval. Capture starts automatically once the camera has a usable frame.",
  "too-dark":  "Move to a well-lit room or face a window. Avoid back-lighting.",
  detected:    "Frame is clear. Capturing now.",
  processing:  "Capturing your face. Please wait.",
  verified:    "Identity confirmed. Taking you to the next step.",
  failed:      "Could not capture a usable photo. Please try again.",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FaceVerifyScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<VerifyState>("requesting");
  const cameraRef = useRef<InstanceType<typeof CameraView>>(null);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<VerifyState>("requesting");

  const captureInFlightRef = useRef(false);
  const failureCount = useRef(0);
  const sampleFailureCount = useRef(0);

  // Keep stateRef in sync so callbacks always see latest state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Permission ────────────────────────────────────────────────────────────
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    void (async () => {
      // Already granted — go straight to scanning
      if (permission?.granted) {
        setState("scanning");
        return;
      }

      // Still loading permission status
      if (!permission) return;

      // Not yet determined — automatically request permission (only once)
      if (permission.canAskAgain && !hasRequestedRef.current) {
        hasRequestedRef.current = true;
        setState("requesting");
        const result = await requestPermission();
        setState(result.granted ? "scanning" : "denied");
        return;
      }

      // Permanently denied or already asked
      if (!permission.granted) {
        setState("denied");
      }
    })();
  }, [permission, requestPermission]);

  // ── Voice prompt on state change ──────────────────────────────────────────
  useEffect(() => {
    speak(state);
  }, [state]);

  // ── Delayed initial voice for scanning ────────────────────────────────────
  useEffect(() => {
    if (state !== "scanning") return;
    const t = setTimeout(() => speak("scanning"), 900);
    return () => clearTimeout(t);
  }, [state]);

  // ── Trigger capture ───────────────────────────────────────────────────────
  const triggerCapture = useCallback(async () => {
    if (captureInFlightRef.current) return;
    captureInFlightRef.current = true;
    if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
    setState("processing");

    try {
      const pic = await cameraRef.current?.takePictureAsync({
        quality: 0.72,
        base64: true,
        skipProcessing: false,
        shutterSound: false,
      });

      if (!pic?.uri) {
        failureCount.current++;
        captureInFlightRef.current = false;
        setState(failureCount.current >= MAX_FAILURES ? "failed" : "scanning");
        return;
      }

      if (pic.base64 && !analyzeCameraFrame(pic.base64).isBrightEnough) {
        captureInFlightRef.current = false;
        setState("too-dark");
        return;
      }

      setGroupRideFaceCapture({
        uri: pic.uri,
        mimeType: "image/jpeg",
        capturedAt: new Date().toISOString(),
      });

      setState("verified");
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);

      setTimeout(() => {
        router.replace("/group-ride/gender");
      }, 2000);
    } catch {
      failureCount.current++;
      captureInFlightRef.current = false;
      setState(failureCount.current >= MAX_FAILURES ? "failed" : "scanning");
    }
  }, [router]);

  const queueCapture = useCallback(() => {
    if (captureInFlightRef.current) return;
    if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
    setState("detected");
    if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
    captureTimeoutRef.current = setTimeout(() => {
      void triggerCapture();
    }, CAPTURE_DELAY_MS);
  }, [triggerCapture]);

  // ── Continuous camera frame check ─────────────────────────────────────────
  const runCameraFrameSample = useCallback(async () => {
    const current = stateRef.current;
    if (current !== "scanning" && current !== "too-dark") return;

    try {
      const pic = await cameraRef.current?.takePictureAsync({
        quality: 0.1,
        base64: true,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!pic?.base64) {
        sampleFailureCount.current++;
        if (sampleFailureCount.current >= 4) {
          queueCapture();
        }
        return;
      }

      const result = analyzeCameraFrame(pic.base64);
      if (!result.isBrightEnough) {
        sampleFailureCount.current = 0;
        setState("too-dark");
        return;
      }

      sampleFailureCount.current = 0;
      queueCapture();
    } catch {
      sampleFailureCount.current++;
      if (sampleFailureCount.current >= 4) {
        queueCapture();
      }
    }
  }, [queueCapture]);

  useEffect(() => {
    if (state !== "scanning" && state !== "too-dark") return;
    sampleTimerRef.current = setInterval(() => {
      void runCameraFrameSample();
    }, SAMPLE_INTERVAL_MS);
    return () => {
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
    };
  }, [state, runCameraFrameSample]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      Speech.stop();
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
    };
  }, []);

  const cameraReady =
    state !== "requesting" &&
    state !== "denied" &&
    state !== "failed";
  const cameraPermissionPermanentlyDenied =
    permission?.granted !== true && permission?.canAskAgain === false;
  const isCapturing = state === "detected" || state === "processing";
  const hintText =
    cameraPermissionPermanentlyDenied && state === "denied"
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
            if (stateRef.current === "scanning") {
              speak("scanning");
              void runCameraFrameSample();
            }
          }}
        />
      )}

      {/* Dark overlay with oval cutout */}
      <OvalOverlay />

      {/* Oval frame — no touch, auto-detects */}
      <View style={styles.ovalArea} pointerEvents="none">
        <OvalFrame state={state} />
        <ScanLine state={state} />
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

      {/* Bottom UI */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.bottom}>
        <StatusBadge state={state} />

        <StepProgress state={state} />

        <CaptureProgress active={isCapturing} />

        <AppText variant="bodySmall" color="rgba(255,255,255,0.52)" style={styles.hint}>
          {hintText}
        </AppText>

        {state === "denied" && (
          <Animated.View entering={FadeInDown.duration(280)} style={styles.actionBtn}>
            <AppButton
              title={
                cameraPermissionPermanentlyDenied
                  ? "Open settings"
                  : "Allow camera access"
              }
              variant="inverse"
              onPress={async () => {
                if (cameraPermissionPermanentlyDenied) {
                  await Linking.openSettings();
                  return;
                }

                setState("requesting");
                const result = await requestPermission();
                setState(result.granted ? "scanning" : "denied");
              }}
            />
          </Animated.View>
        )}

        {state === "failed" && (
          <Animated.View entering={FadeInDown.duration(280)} style={styles.actionBtn}>
            <AppButton
              title="Try again"
              variant="inverse"
              onPress={() => {
                failureCount.current = 0;
                sampleFailureCount.current = 0;
                captureInFlightRef.current = false;
                setState("scanning");
              }}
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

  // Oval area (non-interactive)
  ovalArea: {
    position: "absolute",
    top: OVAL_TOP,
    alignSelf: "center",
    width: OVAL_W,
    height: OVAL_H,
    alignItems: "center",
    justifyContent: "center",
  },
  ovalWrap: {
    width: SVG_W,
    height: SVG_H,
    alignItems: "center",
    justifyContent: "center",
  },
  ovalGlow: {
    position: "absolute",
    width: OVAL_W + 28,
    height: OVAL_H + 28,
    borderRadius: (OVAL_H + 28) / 2,
    borderWidth: 2.5,
  },

  // Scan line
  scanLine: {
    position: "absolute",
    left: 14,
    right: 14,
    height: 2.5,
    borderRadius: 2,
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

  // Step progress
  stepsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 0,
    width: "100%",
    paddingHorizontal: theme.spacing.sm,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  stepDotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 22,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    shadowColor: theme.colors.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  stepConnector: {
    width: 24,
    height: 2,
    borderRadius: 1,
    marginRight: -1,
  },
  stepLabel: {
    fontSize: 10,
    textAlign: "center",
  },
});
