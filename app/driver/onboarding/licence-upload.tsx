import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { FlowHeader } from "@/components/flow-header";
import { theme } from "@/theme";
import { useDriverOnboarding } from "@/lib/driver-onboarding";

export default function LicenceUploadScreen() {
  const router = useRouter();
  const { setLicenceUri, data } = useDriverOnboarding();
  const [imageUri, setImageUri] = useState<string | null>(data.licenceUri);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setLicenceUri(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setLicenceUri(result.assets[0].uri);
    }
  }

  return (
    <AppScreen scroll contentStyle={styles.container}>
      <FlowHeader
        title="Driver's Licence"
        subtitle="Take a clear photo of your driver's licence (front)"
        showBack
        progress={{ count: 5, active: 2 }}
      />

      <View style={styles.uploadArea}>
        {imageUri ? (
          <Pressable onPress={pickImage} style={styles.previewWrap}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
            <View style={styles.changeOverlay}>
              <AppText variant="label" color={theme.colors.white}>
                Tap to change
              </AppText>
            </View>
          </Pressable>
        ) : (
          <View style={styles.placeholderArea}>
            <Pressable onPress={takePhoto} style={styles.captureButton}>
              <Ionicons name="camera" size={28} color={theme.colors.orange} />
              <AppText variant="label" color={theme.colors.orange}>
                Take Photo
              </AppText>
            </Pressable>

            <AppText variant="bodySmall" color={theme.colors.muted}>
              or
            </AppText>

            <Pressable onPress={pickImage} style={styles.galleryButton}>
              <Ionicons name="images-outline" size={20} color={theme.colors.muted} />
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Choose from gallery
              </AppText>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.spacer} />

      <AppButton
        title="Continue"
        onPress={() => router.push("/driver/onboarding/face-verification")}
        disabled={!imageUri}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.spacing.xxxl,
  },
  uploadArea: {
    marginTop: theme.spacing.xxl,
    width: "100%",
  },
  placeholderArea: {
    borderWidth: theme.borders.thick,
    borderStyle: "dashed",
    borderColor: theme.colors.orange,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.orangeLight,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xxxl,
    gap: theme.spacing.md,
  },
  captureButton: {
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  galleryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  previewWrap: {
    borderRadius: theme.radius.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    overflow: "hidden",
    ...theme.shadows.card,
  },
  preview: {
    width: "100%",
    height: 220,
  },
  changeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
  },
  spacer: {
    flex: 1,
    minHeight: theme.spacing.xxxl,
  },
});
