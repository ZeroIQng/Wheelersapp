import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import type { GroupRideGenderPreference } from "@/lib/api";
import { theme } from "@/theme";

type GenderOption = {
  id: GroupRideGenderPreference;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  body: string;
};

const GENDER_OPTIONS: GenderOption[] = [
  {
    id: "women_only",
    icon: "female",
    title: "Women only",
    body: "Match with riders who also choose women-only group rides.",
  },
  {
    id: "men_only",
    icon: "male",
    title: "Men only",
    body: "Match with riders who also choose men-only group rides.",
  },
  {
    id: "any",
    icon: "groups",
    title: "Any verified rider",
    body: "Match with other riders who are open to any verified group.",
  },
];

export default function GroupRideGenderScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<GroupRideGenderPreference>("any");

  const selectedLabel = useMemo(
    () => GENDER_OPTIONS.find((option) => option.id === selected)?.title ?? "Any verified rider",
    [selected],
  );

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      scroll={false}
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />

      <View style={styles.topBar}>
        <BackArrow onPress={() => router.back()} />
        <View style={styles.topCopy}>
          <AppText variant="monoSmall" color={theme.colors.muted}>
            GROUP RIDE
          </AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Choose who you want to match with
          </AppText>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <MaterialIcons name="verified-user" size={34} color={theme.colors.black} />
        </View>
        <AppText variant="h1">Set your ride preference</AppText>
        <AppText variant="body" color={theme.colors.muted} style={styles.heroBody}>
          Your face is verified. Now choose the group preference for this ride.
        </AppText>
      </View>

      <View style={styles.options}>
        {GENDER_OPTIONS.map((option, index) => {
          const isSelected = option.id === selected;
          return (
            <Animated.View
              entering={FadeInDown.delay(index * 70).duration(360)}
              key={option.id}
            >
              <Pressable
                onPress={() => setSelected(option.id)}
                style={[
                  styles.optionCard,
                  isSelected ? styles.optionCardSelected : null,
                ]}
              >
                <View
                  style={[
                    styles.optionIcon,
                    isSelected ? styles.optionIconSelected : null,
                  ]}
                >
                  <MaterialIcons
                    name={option.icon}
                    size={24}
                    color={theme.colors.black}
                  />
                </View>
                <View style={styles.optionCopy}>
                  <AppText variant="h3">{option.title}</AppText>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    {option.body}
                  </AppText>
                </View>
                <View
                  style={[
                    styles.radio,
                    isSelected ? styles.radioSelected : null,
                  ]}
                >
                  {isSelected ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.summaryPill}>
          <MaterialIcons name="lock" size={14} color={theme.colors.orange} />
          <AppText variant="monoSmall" color={theme.colors.orange}>
            {selectedLabel.toUpperCase()}
          </AppText>
        </View>
        <AppButton
          title="Continue"
          onPress={() =>
            router.replace({
              pathname: "/group-ride/destination",
              params: { genderPreference: selected },
            })
          }
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  topCopy: {
    flex: 1,
    gap: 2,
  },
  hero: {
    gap: theme.spacing.sm,
  },
  heroIcon: {
    width: 68,
    height: 68,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orangeLight,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  heroBody: {
    maxWidth: 320,
  },
  options: {
    gap: theme.spacing.sm,
  },
  optionCard: {
    minHeight: 104,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  optionCardSelected: {
    backgroundColor: "#FFF6F1",
    borderColor: theme.colors.orange,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.offWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconSelected: {
    backgroundColor: theme.colors.orangeLight,
  },
  optionCopy: {
    flex: 1,
    gap: 3,
  },
  radio: {
    width: 22,
    height: 22,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.white,
  },
  radioSelected: {
    borderColor: theme.colors.orange,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
  },
  footer: {
    marginTop: "auto",
    gap: theme.spacing.sm,
  },
  summaryPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.orange,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orangeLight,
  },
});
