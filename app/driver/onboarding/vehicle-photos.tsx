import { useRouter } from "expo-router";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { FlowHeader } from "@/components/flow-header";
import { theme } from "@/theme";
import { useDriverOnboarding } from "@/lib/driver-onboarding";
import { useAuth } from "@/lib/auth";

const MIN_PHOTOS = 7;
const MAX_PHOTOS = 10;

const PHOTO_TIPS = [
  "Front of the car",
  "Back of the car",
  "Driver side",
  "Passenger side",
  "Dashboard / interior",
  "Back seat",
  "Boot / trunk",
];

export default function VehiclePhotosScreen() {
  const router = useRouter();
  const { data, addVehiclePhoto, removeVehiclePhoto, submit, submitting } = useDriverOnboarding();
  const { getAccessToken } = useAuth();
  const photos = data.vehiclePhotos;
  const canAddMore = photos.length < MAX_PHOTOS;
  const isValid = photos.length >= MIN_PHOTOS;

  async function takePhoto() {
    if (!canAddMore) return;

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera access needed", "Please allow camera access to take vehicle photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      addVehiclePhoto(result.assets[0].uri);
    }
  }

  async function pickFromGallery() {
    if (!canAddMore) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    });

    if (!result.canceled && result.assets.length > 0) {
      for (const asset of result.assets) {
        if (photos.length + result.assets.indexOf(asset) < MAX_PHOTOS) {
          addVehiclePhoto(asset.uri);
        }
      }
    }
  }

  function handleRemove(index: number) {
    Alert.alert("Remove photo?", "Are you sure you want to remove this photo?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeVehiclePhoto(index) },
    ]);
  }

  return (
    <AppScreen scroll contentStyle={styles.container}>
      <FlowHeader
        title="Vehicle Photos"
        subtitle={`Take ${MIN_PHOTOS}-${MAX_PHOTOS} clear photos of your vehicle`}
        showBack
        progress={{ count: 6, active: 5 }}
      />

      <View style={styles.counterRow}>
        <AppText
          variant="bodyMedium"
          color={isValid ? theme.colors.green : theme.colors.orange}
        >
          {photos.length} / {MAX_PHOTOS} photos
        </AppText>
        {!isValid && (
          <AppText variant="bodySmall" color={theme.colors.muted}>
            (minimum {MIN_PHOTOS})
          </AppText>
        )}
      </View>

      {photos.length === 0 && (
        <View style={styles.tipsBox}>
          <AppText variant="label" color={theme.colors.black}>
            Suggested angles:
          </AppText>
          {PHOTO_TIPS.map((tip, i) => (
            <View key={tip} style={styles.tipRow}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {i + 1}. {tip}
              </AppText>
            </View>
          ))}
        </View>
      )}

      {photos.length > 0 && (
        <View style={styles.grid}>
          {photos.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.photoCard}>
              <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />
              <Pressable
                style={styles.removeButton}
                onPress={() => handleRemove(index)}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {canAddMore && (
        <View style={styles.addButtons}>
          <Pressable onPress={takePhoto} style={styles.addButton}>
            <Ionicons name="camera" size={24} color={theme.colors.orange} />
            <AppText variant="label" color={theme.colors.orange}>
              Take Photo
            </AppText>
          </Pressable>

          <Pressable onPress={pickFromGallery} style={styles.addButton}>
            <Ionicons name="images-outline" size={24} color={theme.colors.orange} />
            <AppText variant="label" color={theme.colors.orange}>
              Gallery
            </AppText>
          </Pressable>
        </View>
      )}

      <View style={styles.spacer} />

      <AppButton
        title="Submit for Review"
        onPress={async () => {
          try {
            await submit(getAccessToken);
            router.replace("/driver/onboarding/pending");
          } catch (error) {
            Alert.alert(
              "Submission failed",
              error instanceof Error ? error.message : "Could not submit. Please try again.",
            );
          }
        }}
        disabled={!isValid}
        loading={submitting}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.spacing.xxxl,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  tipsBox: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.borderLight,
    gap: theme.spacing.xs,
  },
  tipRow: {
    marginLeft: theme.spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  photoCard: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    overflow: "hidden",
    ...theme.shadows.subtle,
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
  },
  addButtons: {
    flexDirection: "row",
    gap: theme.spacing.lg,
    marginTop: theme.spacing.xl,
    justifyContent: "center",
  },
  addButton: {
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderWidth: theme.borders.thick,
    borderStyle: "dashed",
    borderColor: theme.colors.orange,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.orangeLight,
  },
  spacer: {
    flex: 1,
    minHeight: theme.spacing.xxxl,
  },
});
