import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, TextStyle, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { FlowHeader } from "@/components/flow-header";
import { theme } from "@/theme";
import { useDriverOnboarding } from "@/lib/driver-onboarding";

export default function VehicleInfoScreen() {
  const router = useRouter();
  const { setVehicleInfo } = useDriverOnboarding();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [year, setYear] = useState("");

  const isValid = make.trim() && model.trim() && plate.trim() && year.trim().length === 4;

  function handleContinue() {
    setVehicleInfo({ make: make.trim(), model: model.trim(), plate: plate.trim(), year: parseInt(year, 10) });
    router.push("/driver/onboarding/vehicle-photos");
  }

  return (
    <AppScreen scroll contentStyle={styles.container}>
      <FlowHeader
        title="Vehicle Details"
        subtitle="Tell us about the vehicle you'll be driving"
        showBack
        progress={{ count: 6, active: 4 }}
      />

      <View style={styles.form}>
        <View style={styles.field}>
          <AppText variant="label" style={styles.label}>
            Make
          </AppText>
          <TextInput
            style={styles.input}
            placeholder="e.g. Toyota"
            placeholderTextColor={theme.colors.mutedLight}
            value={make}
            onChangeText={setMake}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <AppText variant="label" style={styles.label}>
            Model
          </AppText>
          <TextInput
            style={styles.input}
            placeholder="e.g. Camry"
            placeholderTextColor={theme.colors.mutedLight}
            value={model}
            onChangeText={setModel}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <AppText variant="label" style={styles.label}>
            Plate Number
          </AppText>
          <TextInput
            style={styles.input}
            placeholder="e.g. LAG-123-XY"
            placeholderTextColor={theme.colors.mutedLight}
            value={plate}
            onChangeText={setPlate}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.field}>
          <AppText variant="label" style={styles.label}>
            Year
          </AppText>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2019"
            placeholderTextColor={theme.colors.mutedLight}
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
      </View>

      <View style={styles.spacer} />

      <AppButton title="Continue" onPress={handleContinue} disabled={!isValid} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.spacing.xxxl,
  },
  form: {
    marginTop: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  field: {
    gap: theme.spacing.xs,
  },
  label: {
    marginLeft: theme.spacing.xs,
  },
  input: {
    height: 52,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    fontFamily: "ClashDisplay_500Medium",
    fontSize: 14,
    color: theme.colors.black,
    ...theme.shadows.subtle,
  } as TextStyle,
  spacer: {
    flex: 1,
    minHeight: theme.spacing.xxxl,
  },
});
