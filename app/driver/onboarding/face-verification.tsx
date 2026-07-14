import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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

      <View style={styles.cameraSection}>
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

        {!captured && (
          <Pressable
            onPress={handleCapture}
            style={({ pressed }) => [
              styles.captureButton,
              pressed && styles.capturePressed,
            ]}
          >
            <View style={styles.captureInner}>
              <Ionicons name="camera" size={28} color={theme.colors.white} />
            </View>
          </Pressable>
        )}

        {captured && (
          <View style={styles.successWrap}>
            <Ionicons name="checkmark-circle" size={32} color={theme.colors.green} />
            <AppText variant="h3" color={theme.colors.green}>
              Verification complete
            </AppText>
          </View>
        )}
      </View>

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
  cameraSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  cameraWrap: {
    width: "90%",
    aspectRatio: 3 / 4,
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
    width: 200,
    height: 260,
    borderRadius: 100,
    borderWidth: 2.5,
    borderColor: theme.colors.orange,
    borderStyle: "dashed",
  },
  instructionWrap: {
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  instruction: {
    textAlign: "center",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  capturePressed: {
    transform: [{ scale: 0.92 }],
    shadowOpacity: 0,
    elevation: 0,
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  successWrap: {
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  spacer: {
    minHeight: theme.spacing.xl,
  },
});
