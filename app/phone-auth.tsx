import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { CrossShape, RingStack } from '@/components/decorative-shapes';
import { FlowHeader } from '@/components/flow-header';
import { theme } from '@/theme';

export default function PhoneAuthScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('801 234 5678');

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <RingStack color="rgba(255,92,0,0.08)" width={88} height={88} style={styles.rings} />
      <CrossShape color="rgba(13,13,13,0.12)" style={styles.cross} />
      <Animated.View entering={FadeInDown.duration(420)} style={styles.content}>
        <FlowHeader
          showBack
          overline="PHONE VERIFY"
          title={"What's your\nnumber?"}
          subtitle="We'll send a one-time code to verify your phone."
          progress={{ count: 5, active: 2 }}
        />

        <View style={styles.phoneField}>
          <View style={styles.prefix}>
            <AppText style={styles.flag}>🇳🇬</AppText>
            <AppText variant="mono">+234</AppText>
          </View>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setPhone}
            selectionColor={theme.colors.orange}
            style={styles.input}
            value={phone}
          />
        </View>

        <AppText variant="bodySmall" color={theme.colors.mutedLight}>
          No spam. Ever. Pinky promise.
        </AppText>

        <AppButton title="Send code ↗" onPress={() => router.push('/otp-verify')} />

        <AppText variant="bodySmall" color={theme.colors.mutedLight} style={styles.terms}>
          By continuing you agree to our Terms.
        </AppText>
      </Animated.View>
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
    position: 'absolute',
    top: 20,
    right: 8,
  },
  cross: {
    position: 'absolute',
    bottom: 58,
    right: 22,
  },
  phoneField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.white,
    ...theme.shadows.card,
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.orangeLight,
    borderRightWidth: theme.borders.thick,
    borderRightColor: theme.colors.black,
  },
  flag: {
    fontSize: 15,
  },
  input: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    ...theme.typography.mono,
    color: theme.colors.black,
    letterSpacing: 1.8,
  },
  terms: {
    textAlign: 'center',
  },
});
