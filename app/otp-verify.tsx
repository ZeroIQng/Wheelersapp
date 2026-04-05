import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BlobShape, StarBurst } from '@/components/decorative-shapes';
import { FlowHeader } from '@/components/flow-header';
import { theme } from '@/theme';

export default function OtpVerifyScreen() {
  const router = useRouter();
  const [digits, setDigits] = useState(['3', '7', '2', '']);

  const updateDigit = (value: string, index: number) => {
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
  };

  return (
    <AppScreen backgroundColor={theme.colors.black} contentStyle={styles.container}>
      <StatusBar style="light" backgroundColor={theme.colors.black} />
      <BlobShape color="rgba(255,92,0,0.08)" style={styles.blob} />
      <StarBurst color="rgba(255,92,0,0.14)" width={44} height={44} style={styles.star} />
      <Animated.View entering={FadeInDown.duration(450)} style={styles.content}>
        <FlowHeader
          showBack
          light
          overline="VERIFICATION"
          title={'Enter the\n4-digit code'}
          subtitle="Sent to +234 801 234 5678"
          progress={{ count: 5, active: 3, dark: true }}
        />
        <AppText variant="monoSmall" color={theme.colors.orange}>
          CHANGE NUMBER?
        </AppText>
        <View style={styles.digitsRow}>
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              keyboardType="number-pad"
              maxLength={1}
              onChangeText={(value) => updateDigit(value, index)}
              placeholder="—"
              placeholderTextColor="#464646"
              selectionColor={theme.colors.orange}
              style={[
                styles.digitInput,
                index === 2 ? styles.digitInputActive : null,
              ]}
              value={digit}
            />
          ))}
        </View>
        <AppText variant="monoLarge" color={theme.colors.orange} style={styles.timer}>
          0:38
        </AppText>
        <AppButton title="Verify ↗" onPress={() => router.push('/kyc')} />
        <AppText variant="bodySmall" color="#555" style={styles.resend}>
          Didn&apos;t receive it? Resend
        </AppText>
      </Animated.View>
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
    gap: theme.spacing.md,
  },
  digitsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  digitInput: {
    flex: 1,
    height: 58,
    borderWidth: theme.borders.thick,
    borderColor: '#333333',
    borderRadius: theme.radius.sm,
    textAlign: 'center',
    color: theme.colors.white,
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
    marginVertical: theme.spacing.md,
  },
  resend: {
    textAlign: 'center',
  },
});
