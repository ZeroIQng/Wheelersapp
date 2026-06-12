import { usePrivy } from "@privy-io/expo";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { CrossShape, RingStack } from "@/components/decorative-shapes";
import { FlowHeader } from "@/components/flow-header";
import { FloatingView, RevealView } from "@/components/motion";
import { getAccessTokenWithRetry } from "@/lib/access-token";
import { sendPhoneOtp } from "@/lib/api";
import {
  storePendingPhoneVerification,
  storePhoneEntryStep,
} from "@/lib/auth-state";
import { isPrivyConfigured } from "@/lib/privy";
import { theme } from "@/theme";

type CountryDialOption = {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
  example: string;
};

const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { code: "NG", name: "Nigeria", flag: "🇳🇬", dialCode: "+234", example: "801 234 5678" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", dialCode: "+233", example: "24 123 4567" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", dialCode: "+254", example: "712 345 678" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", dialCode: "+27", example: "82 123 4567" },
  { code: "UG", name: "Uganda", flag: "🇺🇬", dialCode: "+256", example: "701 234 567" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", dialCode: "+255", example: "712 345 678" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", dialCode: "+250", example: "78 123 4567" },
  { code: "CM", name: "Cameroon", flag: "🇨🇲", dialCode: "+237", example: "6 71 23 45 67" },
  { code: "CI", name: "Cote d'Ivoire", flag: "🇨🇮", dialCode: "+225", example: "07 12 34 56 78" },
  { code: "SN", name: "Senegal", flag: "🇸🇳", dialCode: "+221", example: "77 123 45 67" },
  { code: "US", name: "United States", flag: "🇺🇸", dialCode: "+1", example: "415 555 2671" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dialCode: "+1", example: "416 555 2671" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", dialCode: "+44", example: "7123 456789" },
  { code: "IE", name: "Ireland", flag: "🇮🇪", dialCode: "+353", example: "85 123 4567" },
  { code: "FR", name: "France", flag: "🇫🇷", dialCode: "+33", example: "6 12 34 56 78" },
  { code: "DE", name: "Germany", flag: "🇩🇪", dialCode: "+49", example: "151 23456789" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", dialCode: "+31", example: "6 12345678" },
  { code: "ES", name: "Spain", flag: "🇪🇸", dialCode: "+34", example: "612 345 678" },
  { code: "IT", name: "Italy", flag: "🇮🇹", dialCode: "+39", example: "312 345 6789" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", dialCode: "+971", example: "50 123 4567" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", dialCode: "+966", example: "50 123 4567" },
  { code: "IN", name: "India", flag: "🇮🇳", dialCode: "+91", example: "98765 43210" },
  { code: "CN", name: "China", flag: "🇨🇳", dialCode: "+86", example: "131 2345 6789" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", dialCode: "+55", example: "11 91234 5678" },
];

const DEFAULT_COUNTRY = COUNTRY_DIAL_OPTIONS[0];

function getDialDigits(country: CountryDialOption): string {
  return country.dialCode.replace(/\D/g, "");
}

function toLocalPhoneDigits(phone: string, country: CountryDialOption): string {
  let digits = phone.replace(/\D/g, "");
  const dialDigits = getDialDigits(country);

  if (digits.startsWith(`00${dialDigits}`)) {
    digits = digits.slice(dialDigits.length + 2);
  } else if (digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
    digits = digits.slice(dialDigits.length);
  }

  while (digits.startsWith("0") && digits.length > 1) {
    digits = digits.slice(1);
  }

  return digits;
}

function toE164Phone(rawPhone: string, country: CountryDialOption): string {
  const localDigits = toLocalPhoneDigits(rawPhone, country);
  const normalizedPhone = `${country.dialCode}${localDigits}`;
  const normalizedDigits = normalizedPhone.replace(/\D/g, "");

  if (!localDigits || !/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
    throw new Error(`Enter a valid ${country.name} phone number.`);
  }

  return `+${normalizedDigits}`;
}

export default function PhoneAuthScreen() {
  if (!isPrivyConfigured) {
    return <PrivyUnavailableScreen />;
  }

  return <PrivyPhoneAuthScreen />;
}

function PrivyPhoneAuthScreen() {
  const router = useRouter();
  const { getAccessToken, isReady } = usePrivy();
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryDialOption>(DEFAULT_COUNTRY);
  const [isCountryPickerVisible, setCountryPickerVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const backgroundColor = theme.colors.offWhite;
  const textColor = theme.colors.black;
  const mutedColor = theme.colors.mutedLight;
  const borderColor = theme.colors.black;
  const fieldBackground = theme.colors.white;
  const prefixBackground = theme.colors.orangeLight;

  useEffect(() => {
    void storePhoneEntryStep();
  }, []);

  async function handleSendCode() {
    if (isSending) {
      return;
    }

    if (!isReady) {
      Alert.alert("Try again", "Authentication is still initializing. Try again in a moment.");
      return;
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = toE164Phone(phone, selectedCountry);
    } catch (error) {
      Alert.alert(
        "Invalid phone number",
        error instanceof Error ? error.message : "Enter a valid phone number.",
      );
      return;
    }

    const accessToken = await getAccessTokenWithRetry(getAccessToken);
    if (!accessToken) {
      Alert.alert("Authentication required", "Could not verify your session.");
      return;
    }

    setIsSending(true);

    try {
      const response = await sendPhoneOtp({
        accessToken,
        phone: normalizedPhone,
      });
      await storePendingPhoneVerification(response.phone);
      router.replace("/otp-verify");
    } catch (error) {
      Alert.alert(
        "Code send failed",
        error instanceof Error
          ? error.message
          : "Could not send the WhatsApp verification code.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AppScreen
      backgroundColor={backgroundColor}
      scroll
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor={backgroundColor} />
      <FloatingView style={styles.rings} distance={10} rotate={10}>
        <RingStack color="rgba(255,92,0,0.08)" width={88} height={88} />
      </FloatingView>
      <FloatingView style={styles.cross} delay={180} distance={9} rotate={-10}>
        <CrossShape color="rgba(13,13,13,0.12)" />
      </FloatingView>
      <RevealView delay={40} from="down" style={styles.content}>
        <FlowHeader
          showBack
          backHref="/role-selection"
          overline="WHATSAPP VERIFY"
          title={"What's your\nnumber?"}
          subtitle="We'll send a one-time code to your WhatsApp to verify your phone."
          progress={{ count: 5, active: 2 }}
        />

        <RevealView delay={120}>
          <View
            style={[
              styles.phoneField,
              { borderColor, backgroundColor: fieldBackground },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select phone country code"
              onPress={() => setCountryPickerVisible(true)}
              style={[
                styles.prefix,
                {
                  backgroundColor: prefixBackground,
                  borderRightColor: borderColor,
                },
              ]}
            >
              <AppText style={styles.flag}>{selectedCountry.flag}</AppText>
              <AppText variant="mono" color={textColor} style={styles.dialCode}>
                {selectedCountry.dialCode}
              </AppText>
              <MaterialIcons name="keyboard-arrow-down" size={18} color={textColor} />
            </Pressable>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setPhone}
              placeholder={selectedCountry.example}
              selectionColor={theme.colors.orange}
              placeholderTextColor={mutedColor}
              style={[styles.input, { color: textColor }]}
              value={phone}
            />
          </View>
        </RevealView>

        <AppText variant="bodySmall" color={mutedColor}>
          {/* No spam. Ever. Pinky promise. */}
        </AppText>

        <RevealView delay={220} style={styles.sendButtonWrap}>
          <AppButton
            title={isSending ? "Sending on WhatsApp…" : "Send on WhatsApp"}
            disabled={isSending}
            onPress={() => {
              void handleSendCode();
            }}
          />
        </RevealView>

        <AppText variant="bodySmall" color={mutedColor} style={styles.terms}>
          By continuing you agree to our Terms.
        </AppText>
      </RevealView>

      <CountryCodePickerModal
        selectedCountry={selectedCountry}
        visible={isCountryPickerVisible}
        onClose={() => setCountryPickerVisible(false)}
        onSelect={(country) => {
          setSelectedCountry(country);
          setCountryPickerVisible(false);
        }}
      />
    </AppScreen>
  );
}

function CountryCodePickerModal({
  selectedCountry,
  visible,
  onClose,
  onSelect,
}: {
  selectedCountry: CountryDialOption;
  visible: boolean;
  onClose: () => void;
  onSelect: (country: CountryDialOption) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismissArea} onPress={onClose} />
        <View style={styles.countrySheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <AppText variant="monoSmall" color={theme.colors.orange}>
                COUNTRY CODE
              </AppText>
              <AppText variant="h3" color={theme.colors.black}>
                Select your country
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close country selector"
              onPress={onClose}
              style={styles.sheetCloseButton}
            >
              <MaterialIcons name="close" size={18} color={theme.colors.black} />
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.countryList}
          >
            {COUNTRY_DIAL_OPTIONS.map((country) => {
              const isSelected = country.code === selectedCountry.code;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={`${country.code}-${country.dialCode}`}
                  onPress={() => onSelect(country)}
                  style={[
                    styles.countryOption,
                    isSelected && styles.countryOptionSelected,
                  ]}
                >
                  <View style={styles.countryOptionLeft}>
                    <AppText style={styles.countryFlag}>{country.flag}</AppText>
                    <View style={styles.countryCopy}>
                      <AppText variant="label" color={theme.colors.black}>
                        {country.name}
                      </AppText>
                      <AppText variant="bodySmall" color={theme.colors.muted}>
                        {country.code}
                      </AppText>
                    </View>
                  </View>
                  <View style={styles.countryOptionRight}>
                    <AppText variant="mono" color={theme.colors.black}>
                      {country.dialCode}
                    </AppText>
                    {isSelected ? (
                      <MaterialIcons name="check" size={18} color={theme.colors.orange} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PrivyUnavailableScreen() {
  const router = useRouter();

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      contentStyle={styles.unavailableContainer}
    >
      <AppText variant="h3">Privy setup missing</AppText>
      <AppText variant="bodySmall" color={theme.colors.muted}>
        Add the Privy Expo env keys before opening phone verification.
      </AppText>
      <AppButton
        title="Back to sign in"
        onPress={() => router.replace("/role-selection")}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.spacing.lg,
  },
  content: {
    gap: theme.spacing.xl,
  },
  rings: {
    position: "absolute",
    top: 20,
    right: 8,
  },
  cross: {
    position: "absolute",
    bottom: 58,
    right: 22,
  },
  phoneField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: theme.borders.thick,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
    ...theme.shadows.card,
  },
  prefix: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRightWidth: theme.borders.thick,
    minWidth: 118,
  },
  flag: {
    fontSize: 15,
  },
  dialCode: {
    minWidth: 34,
  },
  input: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    ...theme.typography.mono,
    letterSpacing: 1.8,
  },
  sendButtonWrap: {
    width: "100%",
  },
  unavailableContainer: {
    flex: 1,
    justifyContent: "center",
    gap: theme.spacing.md,
  },
  terms: {
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(13,13,13,0.42)",
  },
  modalDismissArea: {
    flex: 1,
  },
  countrySheet: {
    maxHeight: "76%",
    backgroundColor: theme.colors.offWhite,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderTopWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.borderLight,
    marginBottom: theme.spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
  },
  countryList: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  countryOption: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.white,
  },
  countryOptionSelected: {
    borderColor: theme.colors.orange,
    backgroundColor: theme.colors.orangeLight,
  },
  countryOptionLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  countryFlag: {
    width: 28,
    fontSize: 20,
  },
  countryCopy: {
    flex: 1,
    minWidth: 0,
  },
  countryOptionRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
    minWidth: 78,
  },
});
