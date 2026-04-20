import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { CrossShape, RingStack } from '@/components/decorative-shapes';
import { FlowHeader } from '@/components/flow-header';
import { FloatingView, RevealView } from '@/components/motion';
import { theme } from '@/theme';

export default function PhoneAuthScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const backgroundColor = theme.colors.offWhite;
  const textColor = theme.colors.black;
  const mutedColor = theme.colors.mutedLight;
  const borderColor = theme.colors.black;
  const fieldBackground = theme.colors.white;
  const prefixBackground = theme.colors.orangeLight;

  return (
    <AppScreen backgroundColor={backgroundColor} scroll contentStyle={styles.container}>
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
          overline="PHONE VERIFY"
          title={"What's your\nnumber?"}
          subtitle="We'll send a one-time code to verify your phone."
          progress={{ count: 5, active: 2 }}
        />

        <RevealView delay={120}>
          <View style={[styles.phoneField, { borderColor, backgroundColor: fieldBackground }]}>
            <View style={[styles.prefix, { backgroundColor: prefixBackground, borderRightColor: borderColor }]}>
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
          No spam. Ever. Pinky promise.
        </AppText>

        <RevealView delay={220}>
          <AppButton title="Send code ↗" onPress={() => router.push('/otp-verify')} />
        </RevealView>

        <AppText variant="bodySmall" color={mutedColor} style={styles.terms}>
          By continuing you agree to our Terms.
        </AppText>
      </RevealView>
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
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
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
  terms: {
    textAlign: 'center',
  },
});
