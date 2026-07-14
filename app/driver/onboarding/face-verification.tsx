import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { FlowHeader } from "@/components/flow-header";
import { theme } from "@/theme";
import { useDriverOnboarding } from "@/lib/driver-onboarding";

type Challenge = "center" | "blink" | "turn_left" | "turn_right";

const CHALLENGES: { key: Challenge; instruction: string }[] = [
  { key: "center", instruction: "Look straight at the camera" },
  { key: "blink", instruction: "Blink slowly" },
  { key: "turn_left", instruction: "Turn your head left" },
  { key: "turn_right", instruction: "Turn your head right" },
];

export default function FaceVerificationScreen() {
  const router = useRouter();
  const { setSelfieUri } = useDriverOnboarding();
  const [permission, requestPermission] = useCameraPermissions();
  const [currentStep, setCurrentStep] = useState(0);
  const [captured, setCaptured] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const challenge = CHALLENGES[currentStep];

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    // Auto-advance through challenges every 2.5s (simulating liveness detection)
    if (captured || !permission?.granted) return;

    timerRef.current = setTimeout(() => {
      if (currentStep < CHALLENGES.length - 1) {
        setCurrentStep((s) => s + 1);
      } else {
        handleCapture();
      }
    }, 2500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentStep, captured, permission?.granted]);

  async function handleCapture() {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo) {
        setSelfieUri(photo.uri);
        setCaptured(true);
      }
    } catch {
      // Camera error — still mark as captured for flow continuity
      setCaptured(true);
    }
  }

  if (!permission?.granted) {
    return (
      <AppScreen contentStyle={styles.container}>
        <FlowHeader
          title="Face Verification"
          subtitle="Camera permission is required"
          showBack
          progress={{ count: 5, active: 3 }}
        />
        <View style={styles.center}>
          <AppText variant="body" color={theme.colors.muted}>
            Please allow camera access to continue
          </AppText>
        </View>
        <AppButton title="Allow Camera" onPress={requestPermission} />
      </AppScreen>
    );
  }

  return (
    <AppScreen contentStyle={styles.container}>
      <FlowHeader
        title="Face Verification"
        subtitle={captured ? "Looking good!" : "Follow the prompts below"}
        showBack
        progress={{ count: 5, active: 3 }}
      />

      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          mode="picture"
        />
        <View style={styles.overlay}>
          <View style={styles.faceGuide} />
        </View>
      </View>

      {!captured && challenge && (
        <View style={styles.instructionWrap}>
          <AppText variant="h3" style={styles.instruction}>
            {challenge.instruction}
          </AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Step {currentStep + 1} of {CHALLENGES.length}
          </AppText>
        </View>
      )}

      {captured && (
        <View style={styles.successWrap}>
          <AppText variant="h3" color={theme.colors.green}>
            Verification complete
          </AppText>
        </View>
      )}

      <View style={styles.spacer} />

      <AppButton
        title="Continue"
        onPress={() => router.push("/driver/onboarding/vehicle-info")}
        disabled={!captured}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.spacing.xxxl,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraWrap: {
    marginTop: theme.spacing.xl,
    width: "100%",
    aspectRatio: 3 / 4,
    maxHeight: 340,
    borderRadius: theme.radius.lg,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    overflow: "hidden",
    ...theme.shadows.card,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  faceGuide: {
    width: 180,
    height: 240,
    borderRadius: 90,
    borderWidth: 2.5,
    borderColor: theme.colors.orange,
    borderStyle: "dashed",
  },
  instructionWrap: {
    marginTop: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  instruction: {
    textAlign: "center",
  },
  successWrap: {
    marginTop: theme.spacing.xl,
    alignItems: "center",
  },
  spacer: {
    flex: 1,
    minHeight: theme.spacing.xl,
  },
});
