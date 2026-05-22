import { usePrivy } from "@privy-io/expo";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { CrossShape, RingStack } from "@/components/decorative-shapes";
import { FlowHeader } from "@/components/flow-header";
import { FloatingView, RevealView } from "@/components/motion";
import { sendPhoneOtp } from "@/lib/api";
import {
  storePendingPhoneVerification,
  storePhoneEntryStep,
} from "@/lib/auth-state";
import { isPrivyConfigured } from "@/lib/privy";
import { theme } from "@/theme";

function toLocalPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length > 3) {
    return digits.slice(3);
  }

  if (digits.startsWith("0") && digits.length > 1) {
    return digits.slice(1);
  }

  return digits;
}

function toE164Phone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  const localDigits = toLocalPhoneDigits(digits);

  if (!/^\d{10}$/.test(localDigits)) {
    throw new Error("Enter a valid Nigerian phone number.");
  }

  return `+234${localDigits}`;
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
      Alert.alert("Try again", "Privy is still initializing. Try again in a moment.");
      return;
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = toE164Phone(phone);
    } catch (error) {
      Alert.alert(
        "Invalid phone number",
        error instanceof Error ? error.message : "Enter a valid phone number.",
      );
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      Alert.alert("Authentication required", "Could not get a Privy access token.");
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
            <View
              style={[
                styles.prefix,
                {
                  backgroundColor: prefixBackground,
                  borderRightColor: borderColor,
                },
              ]}
            >
              <AppText style={styles.flag}>🇳🇬</AppText>
              <AppText variant="mono" color={textColor}>
                +234
              </AppText>
            </View>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setPhone}
              placeholder="801 234 5678"
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
    </AppScreen>
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
  },
  flag: {
    fontSize: 15,
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
});
