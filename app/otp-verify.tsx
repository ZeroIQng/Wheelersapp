import { usePrivy } from '@privy-io/expo';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BlobShape, StarBurst } from '@/components/decorative-shapes';
import { FlowHeader } from '@/components/flow-header';
import { sendPhoneOtp, verifyPhoneOtp } from '@/lib/api';
import {
  markStoredOnboardingComplete,
  readStoredAuthState,
  storePhoneEntryStep,
} from '@/lib/auth-state';
import { FloatingView, PulseView, RevealView } from '@/components/motion';
import { theme } from '@/theme';

const OTP_LENGTH = 6;

export default function OtpVerifyScreen() {
  const router = useRouter();
  const { getAccessToken, isReady } = usePrivy();
  const [digits, setDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ''));
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingPhone, setIsLoadingPhone] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const backgroundColor = theme.colors.offWhite;
  const textColor = theme.colors.black;
  const mutedColor = theme.colors.muted;
  const inactiveBorder = '#DCCFC3';
  const filledBackground = theme.colors.orange;
  const filledText = theme.colors.white;
  const placeholderColor = '#C2B6AB';

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await readStoredAuthState();
      if (cancelled) {
        return;
      }

      if (!stored?.pendingPhone) {
        router.replace('/phone-auth');
        return;
      }

      setPendingPhone(stored.pendingPhone);
      setIsLoadingPhone(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const updateDigit = (value: string, index: number) => {
    const next = [...digits];
    next[index] = value.replace(/\D/g, '').slice(-1);
    setDigits(next);
    if (value && index < digits.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key !== 'Backspace') return;
    if (digits[index]) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    if (index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  async function handleVerify() {
    if (isVerifying || isLoadingPhone) {
      return;
    }

    setErrorMessage(null);

    const code = digits.join('');
    if (code.length !== OTP_LENGTH) {
      setErrorMessage('Enter the full 6-digit verification code.');
      return;
    }

    if (!isReady) {
      setErrorMessage('Privy is still initializing. Try again in a moment.');
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setErrorMessage('Could not get a Privy access token.');
      return;
    }

    setIsVerifying(true);

    try {
      await verifyPhoneOtp({ accessToken, code });
      await markStoredOnboardingComplete();
      router.replace('/rider');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not verify the phone code.',
      );
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (!pendingPhone || isResending || isVerifying || isLoadingPhone) {
      return;
    }

    setErrorMessage(null);

    if (!isReady) {
      setErrorMessage('Privy is still initializing. Try again in a moment.');
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setErrorMessage('Could not get a Privy access token.');
      return;
    }

    setIsResending(true);

    try {
      await sendPhoneOtp({ accessToken, phone: pendingPhone });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not resend the phone verification code.',
      );
    } finally {
      setIsResending(false);
    }
  }

  async function handleChangeNumber() {
    await storePhoneEntryStep();
    router.replace('/phone-auth');
  }

  if (isLoadingPhone) {
    return (
      <AppScreen backgroundColor={backgroundColor} contentStyle={styles.loadingContainer}>
        <AppText variant="bodyMedium">Loading verification…</AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen backgroundColor={backgroundColor} contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={backgroundColor} />
      <FloatingView style={styles.blob} distance={12} rotate={6}>
        <BlobShape color="rgba(255,92,0,0.06)" />
      </FloatingView>
      <FloatingView style={styles.star} delay={180} distance={10} rotate={-10}>
        <StarBurst color="rgba(13,13,13,0.1)" width={44} height={44} />
      </FloatingView>

      <RevealView delay={40} from="down" style={styles.content}>
        <FlowHeader
          showBack
          backHref="/phone-auth"
          align="center"
          overline="VERIFICATION"
          title={'Enter the\n6-digit code'}
          subtitle={pendingPhone ? `Sent to ${pendingPhone}` : 'Enter the code we sent you'}
          progress={{ count: 5, active: 3 }}
        />

        <Pressable onPress={() => void handleChangeNumber()} style={styles.changeNumberButton}>
          <AppText variant="monoSmall" color={theme.colors.orange}>
            CHANGE NUMBER?
          </AppText>
        </Pressable>

        <View style={styles.digitsRow}>
          {digits.map((digit, index) => (
            <PulseView key={index} delay={index * 120} scaleTo={digit ? 1.04 : 1.015}>
              <TextInput
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                keyboardType="number-pad"
                maxLength={1}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                onChangeText={(value) => updateDigit(value, index)}
                placeholder=""
                placeholderTextColor={placeholderColor}
                selectionColor={theme.colors.orange}
                style={[
                  styles.digitInput,
                  {
                    backgroundColor: digit ? filledBackground : theme.colors.white,
                    borderColor: digit ? theme.colors.orange : inactiveBorder,
                    color: digit ? filledText : textColor,
                  },
                  !digit && index === digits.findIndex((item) => item === '') ? styles.digitInputActive : null,
                ]}
                value={digit}
              />
            </PulseView>
          ))}
        </View>

        <PulseView>
          <AppText variant="monoLarge" color={theme.colors.orange} style={styles.timer}>
            {isResending ? 'Sending…' : 'Ready'}
          </AppText>
        </PulseView>

        <RevealView delay={180} style={styles.verifyButtonWrap}>
          <AppButton
            title={isVerifying ? 'Verifying…' : 'Verify'}
            disabled={isVerifying || isResending}
            onPress={() => void handleVerify()}
          />
        </RevealView>

        {errorMessage ? (
          <AppText variant="bodySmall" color={theme.colors.danger} style={styles.feedback}>
            {errorMessage}
          </AppText>
        ) : null}

        <Pressable disabled={isResending || isVerifying} onPress={() => void handleResend()}>
          <AppText variant="bodySmall" color={mutedColor} style={styles.resend}>
            {isResending ? 'Resending code…' : 'Didn&apos;t receive it? Resend'}
          </AppText>
        </Pressable>
      </RevealView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blob: {
    position: 'absolute',
    top: -10,
    right: -8,
  },
  star: {
    position: 'absolute',
    bottom: 80,
    left: 18,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  changeNumberButton: {
    alignSelf: 'center',
  },
  digitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
  },
  digitInput: {
    width: 52,
    height: 64,
    borderWidth: theme.borders.thick,
    borderRadius: theme.radius.pill,
    textAlign: 'center',
    ...theme.typography.monoLarge,
  },
  digitInputActive: {
    borderColor: theme.colors.orange,
    shadowColor: theme.colors.orange,
    shadowOpacity: 0.2,
    shadowRadius: 0,
    shadowOffset: {
      width: 0,
      height: 0,
    },
  },
  timer: {
    textAlign: 'center',
    marginVertical: theme.spacing.sm,
  },
  verifyButtonWrap: {
    width: '100%',
  },
  feedback: {
    textAlign: 'center',
  },
  resend: {
    textAlign: 'center',
  },
});
