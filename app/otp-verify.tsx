import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BlobShape, StarBurst } from '@/components/decorative-shapes';
import { FlowHeader } from '@/components/flow-header';
import { FloatingView, PulseView, RevealView } from '@/components/motion';
import { theme } from '@/theme';

export default function OtpVerifyScreen() {
  const router = useRouter();
  const [digits, setDigits] = useState(['3', '7', '2', '']);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const backgroundColor = theme.colors.offWhite;
  const textColor = theme.colors.black;
  const mutedColor = theme.colors.muted;
  const inactiveBorder = '#DCCFC3';
  const filledBackground = theme.colors.orange;
  const filledText = theme.colors.white;
  const placeholderColor = '#C2B6AB';

  const updateDigit = (value: string, index: number) => {
    const next = [...digits];
    next[index] = value.slice(-1);
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
          title={'Enter the\n4-digit code'}
          subtitle="Sent to +234 801 234 5678"
          progress={{ count: 5, active: 3 }}
        />

        <Pressable onPress={() => router.replace('/phone-auth')} style={styles.changeNumberButton}>
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
            0:38
          </AppText>
        </PulseView>

        <RevealView delay={180} style={styles.verifyButtonWrap}>
          <AppButton title="Verify" onPress={() => router.push('/rider-home')} />
        </RevealView>

        <AppText variant="bodySmall" color={mutedColor} style={styles.resend}>
          Didn&apos;t receive it? Resend
        </AppText>
      </RevealView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: theme.spacing.xl,
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
    gap: theme.spacing.md,
    marginVertical: theme.spacing.sm,
  },
  digitInput: {
    width: 64,
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
  resend: {
    textAlign: 'center',
  },
});
